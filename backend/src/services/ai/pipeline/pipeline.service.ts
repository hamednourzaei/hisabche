// ============================================
// backend/src/services/ai/pipeline/pipeline.service.ts
//
// The AI action pipeline — the orchestrator.
//
//   understand → authorize → investigate → ask → validate → propose
//                                                              │
//                              a person (or, rarely, the rule) confirms
//                                                              │
//                                   execute → verify → (audit throughout)
//
// ⚠️ IT IS AN ORCHESTRATOR AND NOTHING ELSE.
//
// It reads and writes the business's data ONLY through `runner`: a function the
// route hands it that sends a request through the server's own router with a
// PERSON's session (services/mcp/own-route). So every read is authorized, every
// write is validated, made idempotent, booked, cached and turned into events by
// the same code that serves the screens. This file imports no invoice, payment
// or customer service and never names a business table.
//
// ⚠️ WHOSE SESSION. Investigation runs as the person who asked. Execution runs
// as the person who APPROVED — their capabilities, their segregation-of-duties
// record. Usually that is the same person; when the requester may not do the
// operation themselves, it is a manager or owner who may.
//
// ⚠️ NO AUDIT, NO WRITE. Every stage before execution writes its step first; a
// step that cannot be written stops the run. After execution the write has
// already happened, so a failed step there is logged loudly instead.
// ============================================

import { ForbiddenError } from '../../../errors/auth.error'
import { BaseError } from '../../../errors/base.error'
import { ConflictError, NotFoundError } from '../../../errors/database.error'
import { ValidationError } from '../../../errors/validation.error'
import { holds, roleAtLeast, type Capability } from '../../authorization'
import type { McpHttpCall } from '../../mcp/mcp-tools'
import { isOk, type RouteAnswer } from '../../mcp/own-route'
import type { TenancyContext } from '../../tenancy.service'
import { AiChatService } from '../ai-chat.service'
import { AiQuotaService } from '../ai-quota.service'
import { AiSettingsService, type AiProviderConfig } from '../ai-settings.service'

import {
  MAX_OPTIONS,
  OPERATION_SPECS,
  UNDERSTAND_PROMPT,
  applyAnswers,
  mayAutoApprove,
  parseDraft,
  parseIntent,
  pickOne,
  plan,
  readBackCall,
  toHttpCall,
  toNumber,
  verifyOutcome,
  type Lookup,
  type Mismatch,
  type OpenInvoiceFact,
  type PartyFact,
  type PipelineDraft,
  type PipelineFacts,
  type PipelineOperation,
  type PipelineSettings,
  type ProductFact,
} from './pipeline.domain'
import {
  PipelineNotMigratedError,
  PipelineRepository,
  type PipelineRun,
  type PipelineStep,
} from './pipeline.repository'

/** Send one request through the server's own router, as one person. */
export type RouteRunner = (call: McpHttpCall) => Promise<RouteAnswer>
/** One model call. Injected so the provider is not needed to test the rules. */
export type ModelCaller = (
  config: AiProviderConfig,
  system: string,
  user: string,
) => Promise<string>

/** What the person asking must be allowed to READ for an operation to be planned. */
const READS: Readonly<Record<PipelineOperation, readonly Capability[]>> = {
  create_invoice: ['customer.read', 'product.read'],
  register_payment: ['customer.read', 'invoice.read'],
  create_customer: ['customer.read'],
  update_customer: ['customer.read'],
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** A run as the client sees it. No workspace, no command body. */
export interface RunView {
  id: string
  requestText: string
  dryRun: boolean
  operation: PipelineOperation | null
  status: PipelineRun['status']
  questions: PipelineRun['questions']
  proposal: PipelineRun['proposal']
  reasonCode: string | null
  requestedBy: string
  approvedBy: string | null
  approvedAt: string | null
  autoApproved: boolean
  resultStatus: number | null
  result: Record<string, unknown> | null
  entityType: PipelineRun['entityType']
  entityId: string | null
  createdAt: string
  /** Whether THIS caller may approve it now. For showing the button only. */
  canApprove: boolean
  /** The requester may not run it themselves: a manager or owner must approve. */
  needsApprover: boolean
  steps: PipelineStep[]
}

/** A read the route refused: the person asking may not see what the plan needs. */
class ReadRefused extends Error {}

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])
const textOrNull = (value: unknown): string | null =>
  typeof value === 'string' && value !== '' ? value : null

function toParty(raw: unknown): PartyFact | null {
  const row = record(raw)
  if (typeof row.id !== 'string' || typeof row.fullName !== 'string') return null
  return {
    id: row.id,
    fullName: row.fullName,
    phone: textOrNull(row.phone),
    email: textOrNull(row.email),
    address: textOrNull(row.address),
    notes: textOrNull(row.notes),
    type: textOrNull(row.type),
    isActive: typeof row.isActive === 'boolean' ? row.isActive : null,
    updatedAt: textOrNull(row.updatedAt),
  }
}

function toProduct(raw: unknown): ProductFact | null {
  const row = record(raw)
  if (typeof row.id !== 'string' || typeof row.name !== 'string') return null
  return {
    id: row.id,
    name: row.name,
    unit: textOrNull(row.unit) ?? 'piece',
    sellPrice: toNumber(row.sellPrice ?? row.sell_price),
    quantity: toNumber(row.quantity),
  }
}

function toOpenInvoice(raw: unknown): OpenInvoiceFact | null {
  const row = record(raw)
  const outstanding = toNumber(row.outstanding)
  if (typeof row.invoiceId !== 'string' || outstanding === null) return null
  return { id: row.invoiceId, invoiceNumber: String(row.invoiceNumber ?? ''), outstanding }
}

const present = <T>(value: T | null): value is T => value !== null

export class PipelineService {
  constructor(
    private readonly repo = new PipelineRepository(),
    private readonly aiSettings = new AiSettingsService(),
    private readonly quota = new AiQuotaService(),
    private readonly model: ModelCaller = (config, system, user) =>
      new AiChatService().complete(config, system, user),
  ) {}

  // ─── The switch ───────────────────────────────────────────────────────────

  async readSettings(ctx: TenancyContext) {
    const { settings, available } = await this.repo.getSettings(ctx.workspaceId)
    return { ...settings, available, canManage: roleAtLeast(ctx.role, 'owner') }
  }

  /** Owner only: this decides whether an assistant may change the books at all. */
  async saveSettings(ctx: TenancyContext, settings: PipelineSettings) {
    if (!roleAtLeast(ctx.role, 'owner')) throw new ForbiddenError('AI_PIPELINE_OWNER_ONLY')
    await this.repo.saveSettings(ctx, settings)
    return this.readSettings(ctx)
  }

  private async enabledSettings(ctx: TenancyContext): Promise<PipelineSettings> {
    const { settings, available } = await this.repo.getSettings(ctx.workspaceId)
    if (!available) throw new PipelineNotMigratedError()
    if (!settings.enabled) throw new ForbiddenError('AI_PIPELINE_DISABLED')
    return settings
  }

  // ─── Start ────────────────────────────────────────────────────────────────

  async start(
    ctx: TenancyContext,
    runner: RouteRunner,
    input: { request: string; dryRun: boolean },
  ): Promise<RunView> {
    const settings = await this.enabledSettings(ctx)
    const config = await this.aiSettings.getConfig()
    if (!config) throw new ValidationError('AI_NOT_CONFIGURED')

    // Checked BEFORE the provider is called, so a refused run costs nothing.
    const quota = await this.quota.status(ctx)
    if (quota.remaining <= 0) throw new ValidationError('AI_QUOTA_EXCEEDED')

    const run = await this.repo.createRun(ctx, input.request, input.dryRun)

    const started = Date.now()
    let reply: string
    try {
      reply = await this.model(config, UNDERSTAND_PROMPT, input.request)
    } catch (err) {
      await this.stop(ctx, run, 'understand', 'failed', 'failed', 'MODEL_UNAVAILABLE')
      throw err
    }
    // One run, one unit of the allowance — written once, here.
    await this.repo.logUsage(ctx, {
      runId: run.id,
      requestText: input.request,
      provider: config.provider,
      model: config.model,
      latencyMs: Date.now() - started,
    })

    const intent = parseIntent(reply)
    if (!intent.operation) {
      return this.stop(ctx, run, 'understand', 'stopped', 'refused', 'UNSUPPORTED_REQUEST')
    }
    await this.repo.addStep(run, 'understand', 'ok', ctx.userId, {
      operation: intent.operation,
      fields: Object.keys(intent.draft),
      uncertain: intent.uncertain,
    })

    const spec = OPERATION_SPECS[intent.operation]
    const missing = READS[intent.operation].filter((capability) => !holds(ctx, capability))
    if (missing.length > 0) {
      return this.stop(ctx, run, 'authorize', 'stopped', 'refused', 'NOT_ALLOWED', { missing })
    }
    await this.repo.addStep(run, 'authorize', 'ok', ctx.userId, {
      capability: spec.capability,
      requesterHolds: holds(ctx, spec.capability),
    })

    return this.advance(ctx, runner, run, intent.operation, intent.draft, settings)
  }

  // ─── Answers to what was missing ──────────────────────────────────────────

  async answer(
    ctx: TenancyContext,
    runner: RouteRunner,
    runId: string,
    answers: Readonly<Record<string, unknown>>,
  ): Promise<RunView> {
    const settings = await this.enabledSettings(ctx)
    const run = await this.mustFind(ctx, runId)
    // Only the person who asked can say what they meant.
    if (run.requestedBy !== ctx.userId) throw new ForbiddenError('AI_RUN_NOT_YOURS')
    if (run.status !== 'needs_input' || !run.operation) {
      throw new ConflictError('AI_RUN_NOT_WAITING')
    }

    const applied = applyAnswers(run.draft, run.questions, answers)
    let draft = applied.draft
    if (applied.retext.length > 0) {
      // Free text («دو کیلو چای و یک قند») is the one thing only the model can
      // read. Same run, so it is not counted against the allowance again.
      const config = await this.aiSettings.getConfig()
      if (!config) throw new ValidationError('AI_NOT_CONFIGURED')
      const reply = await this.model(
        config,
        UNDERSTAND_PROMPT,
        `${run.requestText}\n\nMore details from the same person:\n${applied.retext.join('\n')}`,
      )
      const again = parseIntent(reply)
      // What was already settled — a chosen customer, an entered amount — wins.
      if (again.operation === run.operation) draft = parseDraft({ ...again.draft, ...draft })
      await this.repo.addStep(run, 'understand', 'ok', ctx.userId, {
        again: true,
        sameOperation: again.operation === run.operation,
        fields: Object.keys(again.draft),
      })
    }

    return this.advance(ctx, runner, run, run.operation, draft, settings)
  }

  // ─── Investigate → ask | refuse | propose ─────────────────────────────────

  private async advance(
    ctx: TenancyContext,
    runner: RouteRunner,
    run: PipelineRun,
    operation: PipelineOperation,
    draft: PipelineDraft,
    settings: PipelineSettings,
  ): Promise<RunView> {
    let facts: PipelineFacts
    try {
      facts = await this.investigate(runner, operation, draft)
    } catch (err) {
      if (err instanceof ReadRefused) {
        return this.stop(ctx, run, 'investigate', 'stopped', 'refused', 'NOT_ALLOWED')
      }
      await this.stop(ctx, run, 'investigate', 'failed', 'failed', 'INVESTIGATION_FAILED')
      throw err
    }
    await this.repo.addStep(run, 'investigate', 'ok', ctx.userId, {
      customer: facts.customer.state,
      products: facts.products.map((lookup) => lookup.state),
      openInvoices: facts.openInvoices.length,
      duplicates: facts.duplicates.length,
    })

    const planned = plan(operation, draft, facts)

    if (planned.kind === 'questions') {
      await this.repo.addStep(run, 'ask', 'stopped', ctx.userId, {
        questions: planned.questions.map((question) => `${question.id}:${question.reason}`),
      })
      const waiting = await this.repo.move(
        ctx.workspaceId,
        run.id,
        ['understanding', 'needs_input'],
        {
          status: 'needs_input',
          operation,
          draft,
          questions: planned.questions,
        },
      )
      if (!waiting) throw new ConflictError('AI_RUN_ALREADY_DECIDED')
      return this.view(ctx, waiting)
    }

    if (planned.kind === 'refused') {
      return this.stop(ctx, run, 'validate', 'stopped', 'refused', planned.reason)
    }

    await this.repo.addStep(run, 'validate', 'ok', ctx.userId, {
      warnings: planned.proposal.warnings.map((warning) => warning.code),
      exactMatches: planned.proposal.exactMatches,
    })
    const proposed = await this.repo.move(
      ctx.workspaceId,
      run.id,
      ['understanding', 'needs_input'],
      {
        status: 'proposed',
        operation,
        draft,
        questions: [],
        command: planned.command,
        proposal: planned.proposal,
      },
    )
    if (!proposed) throw new ConflictError('AI_RUN_ALREADY_DECIDED')
    await this.repo.addStep(proposed, 'propose', 'ok', ctx.userId, {
      changes: planned.proposal.changes.length,
      dryRun: proposed.dryRun,
    })

    const requesterHolds = holds(ctx, OPERATION_SPECS[operation].capability)
    if (!proposed.dryRun && mayAutoApprove(settings, planned.proposal, requesterHolds)) {
      return this.execute(ctx, runner, proposed, true)
    }
    return this.view(ctx, proposed)
  }

  /**
   * Read what the plan needs, through the app's own routes, as the requester.
   *
   * ⚠️ Every search is capped (MAX_OPTIONS) and scoped by the session — there
   * is no workspace in any of these URLs to get wrong.
   */
  private async investigate(
    runner: RouteRunner,
    operation: PipelineOperation,
    draft: PipelineDraft,
  ): Promise<PipelineFacts> {
    const read = async (url: string): Promise<RouteAnswer> => {
      const answer = await runner({ method: 'GET', url })
      if (answer.httpStatus === 401 || answer.httpStatus === 403) throw new ReadRefused()
      if (answer.httpStatus >= 500) throw new Error(`pipeline read failed: ${answer.httpStatus}`)
      return answer
    }
    const search = (name: string) => `search=${encodeURIComponent(name)}&limit=${MAX_OPTIONS}`

    const findCustomers = async (name: string): Promise<PartyFact[]> => {
      const answer = await read(`/api/customers?${search(name)}`)
      return isOk(answer) ? list(record(answer.body).customers).map(toParty).filter(present) : []
    }

    let customer: Lookup<PartyFact> = { state: 'absent' }
    if (operation !== 'create_customer') {
      if (draft.customerId) {
        const answer = await read(`/api/customers/${encodeURIComponent(draft.customerId)}`)
        const party = isOk(answer) ? toParty(answer.body) : null
        customer = party
          ? { state: 'one', value: party, exact: true }
          : { state: 'none', asked: draft.customerName ?? '' }
      } else if (draft.customerName) {
        const found = pickOne(
          await findCustomers(draft.customerName),
          draft.customerName,
          (party) => party.fullName,
        )
        if (found.state === 'one' && operation === 'update_customer') {
          // The list does not carry every field (nor `updatedAt`, the condition
          // of the write): the row being changed is read in full.
          const answer = await read(`/api/customers/${encodeURIComponent(found.value.id)}`)
          const party = isOk(answer) ? toParty(answer.body) : null
          customer = party
            ? { ...found, value: party }
            : { state: 'none', asked: draft.customerName }
        } else {
          customer = found
        }
      }
    }

    const products: Lookup<ProductFact>[] = []
    if (operation === 'create_invoice') {
      for (const line of draft.items ?? []) {
        if (line.productId) {
          const answer = await read(`/api/products/${encodeURIComponent(line.productId)}`)
          const product = isOk(answer) ? toProduct(answer.body) : null
          products.push(
            product
              ? { state: 'one', value: product, exact: true }
              : { state: 'none', asked: line.productName ?? '' },
          )
        } else if (line.productName) {
          const answer = await read(`/api/products?${search(line.productName)}`)
          const found = isOk(answer)
            ? list(record(answer.body).products).map(toProduct).filter(present)
            : []
          products.push(pickOne(found, line.productName, (product) => product.name))
        } else {
          products.push({ state: 'absent' })
        }
      }
    }

    let openInvoices: OpenInvoiceFact[] = []
    if (operation === 'register_payment' && customer.state === 'one') {
      const answer = await read(
        `/api/payments/open-invoices/customer/${encodeURIComponent(customer.value.id)}`,
      )
      openInvoices = isOk(answer) ? list(answer.body).map(toOpenInvoice).filter(present) : []
    }

    const duplicates =
      operation === 'create_customer' && draft.fullName ? await findCustomers(draft.fullName) : []

    return { customer, products, openInvoices, duplicates }
  }

  // ─── Approve, reject ──────────────────────────────────────────────────────

  /**
   * @param runner sends requests AS THE APPROVER — the write is theirs.
   */
  async approve(ctx: TenancyContext, runner: RouteRunner, runId: string): Promise<RunView> {
    await this.enabledSettings(ctx)
    const run = await this.mustFind(ctx, runId)
    if (run.dryRun) throw new ConflictError('AI_RUN_IS_DRY_RUN')
    if (run.status !== 'proposed') throw new ConflictError('AI_RUN_ALREADY_DECIDED')
    return this.execute(ctx, runner, run, false)
  }

  async reject(ctx: TenancyContext, runId: string): Promise<RunView> {
    const run = await this.mustFind(ctx, runId)
    const rejected = await this.repo.move(ctx.workspaceId, run.id, ['needs_input', 'proposed'], {
      status: 'rejected',
    })
    if (!rejected) throw new ConflictError('AI_RUN_ALREADY_DECIDED')
    await this.repo.addStep(rejected, 'confirm', 'stopped', ctx.userId, { rejected: true })
    return this.view(ctx, rejected)
  }

  /** May this person approve this run? The existing permission model decides. */
  private mayApprove(ctx: TenancyContext, run: PipelineRun): boolean {
    if (!run.operation) return false
    // The capability of the operation itself, as resolved for THIS member
    // (role, the business's overrides, a custom role, personal blocks).
    if (!holds(ctx, OPERATION_SPECS[run.operation].capability)) return false
    // Their own request, or — for somebody else's — a manager or owner.
    return run.requestedBy === ctx.userId || roleAtLeast(ctx.role, 'manager')
  }

  private async execute(
    ctx: TenancyContext,
    runner: RouteRunner,
    run: PipelineRun,
    auto: boolean,
  ): Promise<RunView> {
    if (!run.operation || !run.command) throw new ConflictError('AI_RUN_ALREADY_DECIDED')
    if (!this.mayApprove(ctx, run)) {
      await this.repo.addStep(run, 'confirm', 'stopped', ctx.userId, { reason: 'NOT_ALLOWED' })
      throw new ForbiddenError('AI_RUN_APPROVAL_NOT_ALLOWED')
    }

    // The claim. Exactly one approval gets a row back; the rest stop here.
    const claimed = await this.repo.move(ctx.workspaceId, run.id, ['proposed'], {
      status: 'approved',
      approvedBy: ctx.userId,
      autoApproved: auto,
    })
    if (!claimed || !claimed.command || !claimed.operation) {
      throw new ConflictError('AI_RUN_ALREADY_DECIDED')
    }
    await this.repo.addStep(claimed, 'confirm', 'ok', ctx.userId, { auto })

    // ─── Execute: the same route a person uses, with the run's own key ───
    let answer: RouteAnswer
    try {
      answer = await runner(toHttpCall(claimed.command, claimed.id))
    } catch (err) {
      console.error('[PipelineService] execution threw:', err)
      return this.finish(ctx, claimed, 'execute', 'failed', {
        status: 'failed',
        reasonCode: 'EXECUTION_ERROR',
      })
    }
    if (!isOk(answer)) {
      const body = record(answer.body)
      const reason = textOrNull(body.code) ?? `HTTP_${answer.httpStatus}`
      return this.finish(
        ctx,
        claimed,
        'execute',
        'failed',
        {
          status: 'failed',
          reasonCode: reason,
          resultStatus: answer.httpStatus,
          // A refusal's reason is kept; a server fault's body is not.
          ...(answer.httpStatus < 500 ? { result: { code: reason } } : {}),
        },
        { httpStatus: answer.httpStatus, reason },
      )
    }

    const written = record(answer.body)
    const entityId = claimed.command.targetId ?? textOrNull(written.id)
    const entity = OPERATION_SPECS[claimed.operation].entity
    await this.afterWrite(() =>
      this.repo.addStep(claimed, 'execute', 'ok', ctx.userId, {
        httpStatus: answer.httpStatus,
        entityId,
      }),
    )

    // ─── Verify: read it back and compare with what was agreed ───
    let mismatches: Mismatch[]
    if (!entityId || !UUID.test(entityId)) {
      mismatches = [{ field: 'id', expected: 'a record id', actual: entityId }]
    } else {
      try {
        const readBack = await runner(readBackCall(claimed.operation, entityId))
        mismatches = isOk(readBack)
          ? verifyOutcome(claimed.command, readBack.body)
          : [{ field: 'readBack', expected: 200, actual: readBack.httpStatus }]
      } catch (err) {
        console.error('[PipelineService] read-back threw:', err)
        mismatches = [{ field: 'readBack', expected: 200, actual: null }]
      }
    }

    return this.finish(
      ctx,
      claimed,
      'verify',
      mismatches.length === 0 ? 'ok' : 'failed',
      {
        status: mismatches.length === 0 ? 'executed' : 'needs_review',
        resultStatus: answer.httpStatus,
        result: {
          number:
            textOrNull(written.invoiceNumber) ??
            textOrNull(written.paymentNumber) ??
            textOrNull(written.fullName),
          mismatches,
        },
        entityType: entity,
        ...(entityId && UUID.test(entityId) ? { entityId } : {}),
      },
      { mismatches },
    )
  }

  /** After the route committed, the audit trail must not turn a done write into an error. */
  private async afterWrite(write: () => Promise<unknown>): Promise<void> {
    try {
      await write()
    } catch (err) {
      console.error('[PipelineService] audit write failed AFTER execution:', err)
    }
  }

  private async finish(
    ctx: TenancyContext,
    run: PipelineRun,
    stage: 'execute' | 'verify',
    outcome: PipelineStep['outcome'],
    patch: Parameters<PipelineRepository['move']>[3],
    detail: Record<string, unknown> = {},
  ): Promise<RunView> {
    await this.afterWrite(() => this.repo.addStep(run, stage, outcome, ctx.userId, detail))
    const finished = await this.repo.move(ctx.workspaceId, run.id, ['approved'], patch)
    return this.view(ctx, finished ?? run)
  }

  // ─── Reading ──────────────────────────────────────────────────────────────

  async get(ctx: TenancyContext, runId: string): Promise<RunView> {
    return this.view(ctx, await this.mustFind(ctx, runId))
  }

  /** One's own recent runs, plus — for whoever could decide them — what awaits a decision. */
  async list(ctx: TenancyContext): Promise<RunView[]> {
    const own = await this.repo.listRuns(ctx.workspaceId, { requestedBy: ctx.userId })
    const waiting = roleAtLeast(ctx.role, 'manager')
      ? await this.repo.listRuns(ctx.workspaceId, { awaitingDecision: true })
      : []
    const seen = new Set<string>()
    const runs = [...waiting, ...own]
      .filter((run) => (seen.has(run.id) ? false : (seen.add(run.id), true)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return runs.map((run) => this.toView(ctx, run, []))
  }

  /** A run this person may look at: their own, or any when they could decide it. */
  private async mustFind(ctx: TenancyContext, runId: string): Promise<PipelineRun> {
    const run = await this.repo.getRun(ctx.workspaceId, runId)
    if (!run || (run.requestedBy !== ctx.userId && !roleAtLeast(ctx.role, 'manager'))) {
      throw new NotFoundError('AI run')
    }
    return run
  }

  private async stop(
    ctx: TenancyContext,
    run: PipelineRun,
    stage: 'understand' | 'authorize' | 'investigate' | 'validate',
    outcome: PipelineStep['outcome'],
    status: 'refused' | 'failed',
    reasonCode: string,
    detail: Record<string, unknown> = {},
  ): Promise<RunView> {
    await this.repo.addStep(run, stage, outcome, ctx.userId, { reason: reasonCode, ...detail })
    const stopped = await this.repo.move(
      ctx.workspaceId,
      run.id,
      ['understanding', 'needs_input'],
      {
        status,
        reasonCode,
      },
    )
    return this.view(ctx, stopped ?? run)
  }

  private async view(ctx: TenancyContext, run: PipelineRun): Promise<RunView> {
    return this.toView(ctx, run, await this.repo.steps(ctx.workspaceId, run.id))
  }

  private toView(ctx: TenancyContext, run: PipelineRun, steps: PipelineStep[]): RunView {
    const open = run.status === 'proposed' && !run.dryRun
    return {
      id: run.id,
      requestText: run.requestText,
      dryRun: run.dryRun,
      operation: run.operation,
      status: run.status,
      questions: run.questions,
      proposal: run.proposal,
      reasonCode: run.reasonCode,
      requestedBy: run.requestedBy,
      approvedBy: run.approvedBy,
      approvedAt: run.approvedAt,
      autoApproved: run.autoApproved,
      resultStatus: run.resultStatus,
      result: run.result,
      entityType: run.entityType,
      entityId: run.entityId,
      createdAt: run.createdAt,
      canApprove: open && this.mayApprove(ctx, run),
      needsApprover: open && run.requestedBy === ctx.userId && !this.mayApprove(ctx, run),
      steps,
    }
  }
}

/** A refusal the route can say as one (4xx), as opposed to a fault. */
export const isPipelineRefusal = (err: unknown): err is BaseError =>
  err instanceof BaseError && (err.statusCode < 500 || err.statusCode === 503)
