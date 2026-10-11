// ============================================
// backend/src/services/migration/migration.service.ts
//
// The migration job: upload, scan, map, validate, dry run, commit, reconcile.
//
// ---------------------------------------------------------------------------
// THE FILE NEVER REACHES THE DATABASE
//
// What is committed are ordinary INSERTs and UPDATEs on `customers` and
// `products`, built from values the pure layer already parsed and validated.
// No user-supplied string ever becomes SQL, no dump is ever restored, and no
// column is written that the existing services do not write. The production
// database receives application-level mutations only — which is the whole
// point of §23.1.
//
// ---------------------------------------------------------------------------
// WHY THE COMMIT IS BATCHED AND NOT ONE TRANSACTION
//
// supabase-js has no transactions, and this capability does not get to invent
// one. So the commit is made SAFE TO REPEAT instead: every written row is
// recorded in `migration_records` under a unique (workspace, entity, source
// identity), and a re-run finds the identity already there and updates the
// existing target rather than creating a second one. A commit interrupted
// halfway is resumed by running it again — never by a compensating DELETE,
// which is forbidden and would delete rows a person may have edited since.
//
// ---------------------------------------------------------------------------
// EVERY QUERY IS SCOPED BY workspace_id
//
// `ctx.userId` appears only as `created_by`. A manager must be able to see and
// continue a migration a colleague started; filtering by the creator would
// make the history lie about what happened in the workspace.
// ============================================

import { baseCurrencyOf } from '../base-currency'
import { selectAllPages } from '../../utils/fetch-all-pages'
import { createHash } from 'node:crypto'

import { supabase } from '../../db'
import {
  ConflictError,
  DatabaseError,
  NotFoundError,
  isFailedRead,
} from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { ForbiddenError } from '../../errors/auth.error'
import { IdempotencyUnavailableError } from '../../utils/client-request'
import type { TenancyContext } from '../tenancy.service'
import { InvoiceService } from '../invoice.service'
import { inferMappingFromContent } from './column-shape.domain'
import { ManufacturingService } from '../manufacturing.service'
import { ProductService } from '../product.service'
import { CustomerService } from '../customer.service'
import { CURRENCY_CODES, productCategorySchema, unitSchema } from '@hisabche/validation'
import type { NamedPlace } from './places.domain'
import {
  planStock,
  stockTotals,
  warehouseColumns,
  warehouseOfStockField,
  type ProductStock,
  type StockPlan,
} from './stock-import.domain'
import { productionColumns, saveProductionDefinitionSchema } from '@hisabche/validation'
import {
  planBoms,
  resolveBoms,
  toProductionRows,
  type BomPlan,
  type CatalogueProduct,
} from './bom-import.domain'
import { createInvoiceSchema } from '@hisabche/validation'
import {
  groupInvoiceRows,
  resolveInvoiceParties,
  resolveInvoicePlaces,
  toInvoiceBody,
  type InvoiceDraft,
  type KnownParty,
  type KnownProduct,
} from './invoice-import.domain'

import {
  checkIntake,
  checkParsed,
  parseDelimited,
  comparisonKey,
  normalizePhone,
  MIGRATION_ENTITIES,
  type MigrationEntity,
  type MigrationSourceType,
  type MigrationStatus,
} from './migration.domain'
import {
  ENTITY_FIELDS,
  detectSource,
  suggestMapping,
  type MappingSuggestion,
} from './migration.entities'
import {
  EXPORT_COLUMNS,
  applyProfile,
  planRollback,
  toCsvRow,
  toProfile,
  type ImportProfile,
  type ProfileFit,
  type RollbackCandidate,
  type RollbackPlan,
} from './migration.recovery'
import {
  dryRun,
  reconcile,
  validateRows,
  type ColumnMapping,
  type CandidateRow,
  type DryRunSummary,
  type Finding,
  type ReconciliationLine,
} from './migration.validate'

/* ─── Shapes the route and the UI share ───────────────────────────────────── */

export interface MigrationDiscovery {
  headers: string[]
  delimiter: string
  rowCount: number
  raggedRows: number[]
  source: ReturnType<typeof detectSource>
  suggestions: MappingSuggestion[]
  /** First few rows, so the user can see what they uploaded. */
  sample: string[][]
  /** Fields connected from what a column HOLDS, not from its name. */
  inferred?: string[] | undefined
  /** The currency chosen for invoices whose rows name none. */
  defaultCurrency?: string | undefined
  /**
   * Product rows whose product already had stock when the file was checked:
   * their opening stock is NOT written, and the check afterwards does not
   * expect it.
   */
  stockLeftAlone?: number[] | undefined
}

export interface MigrationJob {
  id: string
  entity: MigrationEntity
  sourceType: MigrationSourceType
  originalFilename: string
  byteSize: number
  status: MigrationStatus
  discovery: MigrationDiscovery | null
  mapping: ColumnMapping
  findings: Finding[]
  dryRun: DryRunSummary | null
  reconciliation: { lines: ReconciliationLine[]; matched: boolean } | null
  rowsScanned: number
  rowsCreated: number
  rowsUpdated: number
  rowsSkipped: number
  createdBy: string
  createdAt: string
  completedAt: string | null
  errorCode: string | null
}

const COLUMNS =
  'id, entity, source_type, original_filename, byte_size, status, discovery, mapping, findings, ' +
  'dry_run, reconciliation, rows_scanned, rows_created, rows_updated, rows_skipped, created_by, ' +
  'created_at, completed_at, error_code'

function mapJob(raw: Record<string, any>): MigrationJob {
  return {
    id: raw.id,
    entity: raw.entity,
    sourceType: raw.source_type,
    originalFilename: raw.original_filename,
    byteSize: Number(raw.byte_size) || 0,
    status: raw.status,
    discovery: raw.discovery && Object.keys(raw.discovery).length > 0 ? raw.discovery : null,
    mapping: raw.mapping ?? {},
    findings: raw.findings ?? [],
    dryRun: raw.dry_run ?? null,
    reconciliation: raw.reconciliation ?? null,
    rowsScanned: Number(raw.rows_scanned) || 0,
    rowsCreated: Number(raw.rows_created) || 0,
    rowsUpdated: Number(raw.rows_updated) || 0,
    rowsSkipped: Number(raw.rows_skipped) || 0,
    createdBy: raw.created_by,
    createdAt: raw.created_at,
    completedAt: raw.completed_at ?? null,
    errorCode: raw.error_code ?? null,
  }
}

/**
 * Sample rows shown back to the user, capped.
 *
 * Five is enough to recognise your own file and few enough that a customer
 * list is not casually re-displayed in full inside a progress screen.
 */
const SAMPLE_ROWS = 5

/** Rows written per round trip. Small enough that an interrupted commit leaves
 *  little to redo, large enough that fifty thousand rows is not fifty thousand
 *  requests. */
const BATCH_SIZE = 200

/**
 * How much ONE commit request does before it answers.
 *
 * An import used to be a single request: thirty thousand invoices, each one
 * a round trip to the invoice service, inside one HTTP call that the platform
 * cuts off long before it ends — leaving a job «importing» for ever. Now a
 * request does a bounded piece and answers `importing`; the client asks
 * again, and the job picks up where the record says it stopped.
 *
 * Mutable so a test can make a chunk three rows long.
 */
export const IMPORT_LIMITS = {
  /** Wall-clock budget of one request. */
  budgetMs: 20_000,
  invoicesPerRequest: 100,
  rowsPerRequest: 1_000,
  /**
   * A run that has not said anything for this long is taken to be dead (the
   * server restarted, the connection was cut) and may be taken over.
   */
  staleAfterMs: 120_000,
  /** How often a running chunk writes its progress down. */
  heartbeatEvery: 25,
}

/** `error_code` while a chunk is running: the lease. Cleared when the chunk ends. */
const RUNNING = 'MIGRATION_RUNNING'

export class MigrationService {
  /* ─── Intake ────────────────────────────────────────────────────────────── */

  /**
   * Accept a file, parse it, and describe what is in it.
   *
   * The parse happens HERE, in the request, and the text is discarded when it
   * returns. Nothing hostile is persisted, so there is no quarantined blob to
   * secure, expire or accidentally serve — the isolation §23.1 asks for is
   * achieved by not keeping the thing at all.
   */
  async create(
    ctx: TenancyContext,
    input: {
      entity: MigrationEntity
      sourceType: MigrationSourceType
      filename: string
      content: string
    },
  ): Promise<MigrationJob> {
    this.assertMayImport(ctx)

    if (!MIGRATION_ENTITIES.includes(input.entity)) {
      throw new ValidationError('MIGRATION_ENTITY_UNSUPPORTED')
    }

    const rejection = checkIntake(input.content)
    if (rejection) throw new ValidationError(`MIGRATION_${rejection.code}`)

    const table = parseDelimited(input.content, input.sourceType === 'tsv' ? '\t' : undefined)
    const shape = checkParsed(table)
    if (shape) throw new ValidationError(`MIGRATION_${shape.code}`)

    const suggestions = suggestMapping(input.entity, table.headers)

    const discovery: MigrationDiscovery = {
      headers: table.headers,
      delimiter: table.delimiter,
      rowCount: table.rows.length,
      raggedRows: table.raggedRows.slice(0, 200),
      source: detectSource(table.headers),
      suggestions,
      sample: table.rows.slice(0, SAMPLE_ROWS),
    }

    // The mapping the wizard opens with: only the confident guesses. A
    // `needs_review` suggestion is shown but NOT pre-applied, so a user who
    // clicks through without reading imports nothing the importer guessed.
    const mapping: ColumnMapping = {}
    suggestions.forEach((suggestion, index) => {
      if (suggestion.status === 'matched' && suggestion.targetField) {
        mapping[suggestion.targetField] = index
      }
    })

    // A column headed with the name of one of this business's warehouses is
    // the quantity in that warehouse (one row per product, a column each).
    if (input.entity === 'product') {
      const { warehouses } = await this.places(ctx)
      Object.assign(
        mapping,
        warehouseColumns(table.headers, warehouses, new Set(Object.values(mapping))),
      )
    }

    // What the names did not connect, the contents may: a column of phone
    // numbers, the only column of dates, quantity × price = amount. Only
    // where there is ONE answer — and each such field is named, so the screen
    // can ask the person to look at it.
    const fromContent = inferMappingFromContent(input.entity, table.headers, table.rows, mapping)
    Object.assign(mapping, fromContent.mapping)
    discovery.inferred = fromContent.inferred

    const { data, error } = await supabase
      .from('migration_jobs')
      .insert({
        workspace_id: ctx.workspaceId,
        created_by: ctx.userId,
        entity: input.entity,
        source_type: input.sourceType,
        original_filename: input.filename.slice(0, 260),
        byte_size: Buffer.byteLength(input.content, 'utf8'),
        content_digest: createHash('sha256').update(input.content).digest('hex'),
        status: 'scanned' satisfies MigrationStatus,
        discovery,
        mapping,
        rows_scanned: table.rows.length,
      })
      .select(COLUMNS)
      .single()

    if (error) {
      // 23514 on an invoice job: the database still lists only customers and
      // products. Said by name — docs/data-migration-invoices-01-migration.sql —
      // rather than as a 500 nobody can act on.
      if (error.code === '23514' && input.entity === 'invoice') {
        throw new ConflictError('MIGRATION_INVOICE_SCHEMA_REQUIRED')
      }
      throw new DatabaseError('Failed to create the migration job', error)
    }
    return mapJob(data)
  }

  /* ─── Reading ───────────────────────────────────────────────────────────── */

  async list(ctx: TenancyContext): Promise<MigrationJob[]> {
    const { data, error } = await supabase
      .from('migration_jobs')
      .select(COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw new DatabaseError('Failed to fetch migrations', error)
    return (data ?? []).map(mapJob)
  }

  async get(ctx: TenancyContext, id: string): Promise<MigrationJob> {
    const { data, error } = await supabase
      .from('migration_jobs')
      .select(COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', id)
      .single()

    if (isFailedRead(error)) throw new DatabaseError('Failed to read migration', error)
    if (!data) throw new NotFoundError('Migration')
    return mapJob(data)
  }

  /* ─── Mapping and validation ────────────────────────────────────────────── */

  /**
   * Replace the mapping.
   *
   * The mapping is re-checked against the file's OWN headers rather than
   * trusted: a client that posts `{ fullName: 99 }` for a nine-column file
   * would otherwise read undefined for every row and import blanks.
   */
  async setMapping(ctx: TenancyContext, id: string, mapping: ColumnMapping): Promise<MigrationJob> {
    this.assertMayImport(ctx)
    const job = await this.get(ctx, id)
    this.assertOpen(job)

    const headerCount = job.discovery?.headers.length ?? 0
    const fields = new Set(ENTITY_FIELDS[job.entity].map((spec) => spec.key))
    const clean: ColumnMapping = {}

    // ⚠️ The id inside a warehouse column's key came from the client. It is
    // matched against this business's own warehouses — an id from another
    // business, or one that was deleted, is refused here rather than at the
    // moment stock would have been written into it.
    const stockFields = Object.keys(mapping).filter((field) => warehouseOfStockField(field))
    const ownWarehouses =
      job.entity === 'product' && stockFields.length > 0
        ? new Set((await this.places(ctx)).warehouses.map((warehouse) => warehouse.id))
        : new Set<string>()

    for (const [field, column] of Object.entries(mapping)) {
      const warehouseId = warehouseOfStockField(field)
      if (warehouseId !== null) {
        if (!ownWarehouses.has(warehouseId)) {
          throw new ValidationError('MIGRATION_WAREHOUSE_UNKNOWN')
        }
      } else if (!fields.has(field)) throw new ValidationError('MIGRATION_UNKNOWN_TARGET_FIELD')
      if (!Number.isInteger(column) || column < 0 || column >= headerCount) {
        throw new ValidationError('MIGRATION_COLUMN_OUT_OF_RANGE')
      }
      clean[field] = column
    }

    // One column may not feed two fields. Silently allowing it produces a
    // product whose buy and sell price are the same number, which reads as a
    // zero margin rather than as a mistake.
    const used = new Set(Object.values(clean))
    if (used.size !== Object.keys(clean).length) {
      throw new ValidationError('MIGRATION_COLUMN_MAPPED_TWICE')
    }

    return this.update(ctx, id, { mapping: clean, status: 'mapping', findings: [], dry_run: null })
  }

  /**
   * Validate and dry-run in one step, from the file the client still holds.
   *
   * The content is re-sent rather than stored between steps. That is the
   * trade this design makes: the user's export never rests on our disk, at the
   * cost of the browser keeping it in memory while the wizard is open. The
   * digest is compared so a DIFFERENT file cannot be slipped in between the
   * mapping step and the commit.
   */
  async validate(
    ctx: TenancyContext,
    id: string,
    content: string,
    currency?: string | undefined,
  ): Promise<{ job: MigrationJob; dryRun: DryRunSummary; findings: Finding[] }> {
    this.assertMayImport(ctx)
    const job = await this.get(ctx, id)
    this.assertOpen(job)
    await this.assertSameFile(ctx, id, content)

    if (currency !== undefined && !(CURRENCY_CODES as readonly string[]).includes(currency)) {
      throw new ValidationError('MIGRATION_CURRENCY_UNSUPPORTED')
    }
    const defaultCurrency = currency ?? job.discovery?.defaultCurrency ?? null

    const parsed = this.parseAgainstJob(job, content)
    const { candidates } = parsed
    let findings = parsed.findings
    let summary: DryRunSummary
    const stockLeftAlone: number[] = []

    if (job.entity === 'invoice') {
      // Rows become documents first; what is counted is invoices, not rows.
      const plan = await this.planInvoices(ctx, candidates, defaultCurrency)
      findings = [...findings, ...plan.findings]
      summary = {
        entity: 'invoice',
        toCreate: plan.fresh.length,
        toUpdate: 0,
        toSkip: plan.alreadyImported,
        needsReview: plan.drafts.filter((draft) => !draft.importable).length,
        financialImpactMinor: {
          invoiceTotal: plan.fresh.reduce((sum, draft) => sum + draft.totalMinor, 0),
          paid: plan.fresh.reduce((sum, draft) => sum + draft.paidMinor, 0),
        },
        productionDataChanged: false,
      }
    } else {
      // Decided BEFORE the count: which rows are an existing record, and
      // whether each product's stock has a warehouse to go into.
      const prepared = await this.prepareRows(ctx, job.entity, candidates)
      findings = [...findings, ...prepared.findings]
      summary = dryRun(job.entity, candidates, new Set(prepared.existing.keys()))

      if (prepared.stock) {
        // A product that already has stock keeps it: its opening figure is not
        // restated. Said now, and remembered for the check after the import.
        const stocked = await this.stockedProducts(ctx, [...prepared.targetOfRow.values()])
        for (const [row, target] of prepared.targetOfRow) {
          if (!prepared.stock.byRow.has(row) || !stocked.has(target)) continue
          stockLeftAlone.push(row)
          prepared.stock.byRow.delete(row)
          findings.push({ severity: 'info', row, column: null, code: 'PRODUCT_ALREADY_STOCKED' })
        }
        const totals = stockTotals(prepared.stock)
        if (totals.units > 0) {
          summary = { ...summary, stockUnits: totals.units, stockPlacements: totals.placements }
        }
      }

      if (job.entity === 'product') {
        const formulas = await this.planProductBoms(ctx, candidates)
        findings = [...findings, ...formulas.findings]
        if (formulas.plans.length > 0) summary = { ...summary, boms: formulas.plans.length }
      }
    }

    const updated = await this.update(ctx, id, {
      status: summary.toCreate + summary.toUpdate > 0 ? 'ready' : 'validating',
      findings: findings.slice(0, 2000),
      dry_run: summary,
      ...(job.discovery && (defaultCurrency || job.entity === 'product')
        ? {
            discovery: {
              ...job.discovery,
              ...(defaultCurrency ? { defaultCurrency } : {}),
              ...(job.entity === 'product' ? { stockLeftAlone } : {}),
            },
          }
        : {}),
    })

    return { job: updated, dryRun: summary, findings }
  }

  /* ─── Commit ────────────────────────────────────────────────────────────── */

  /**
   * Write the rows, record what was written, then reconcile.
   *
   * `committed_at` is claimed with a conditional UPDATE before any row is
   * written, so two clicks on the confirm button cannot both start a commit.
   * The second gets `MIGRATION_ALREADY_COMMITTED` — which is a correct answer,
   * not an error to retry past.
   */
  async commit(ctx: TenancyContext, id: string, content: string): Promise<MigrationJob> {
    this.assertMayImport(ctx)
    const job = await this.get(ctx, id)
    this.assertOpen(job)

    if (!job.dryRun) throw new ConflictError('MIGRATION_NOT_SIMULATED')
    await this.assertSameFile(ctx, id, content)
    await this.claimRun(ctx, id)

    const deadline = Date.now() + IMPORT_LIMITS.budgetMs
    try {
      const { candidates } = this.parseAgainstJob(job, content)
      return job.entity === 'invoice'
        ? await this.commitInvoices(ctx, job, candidates, deadline)
        : await this.commitRows(ctx, job, candidates, deadline)
    } catch (error) {
      // What was written before the failure stays written AND recorded; the
      // job says it failed, with the reason, and holds no lease.
      // The count comes from the record of what was made, not from a counter
      // this request was keeping in memory when it fell over.
      const made = await this.countLedger(ctx, id).catch(() => null)
      await this.update(ctx, id, {
        status: 'failed',
        error_code: error instanceof Error ? error.message.slice(0, 200) : 'UNKNOWN',
        ...(made ? { rows_created: made.created, rows_updated: made.updated } : {}),
      }).catch(() => undefined)
      throw error
    }
  }

  /**
   * Take the right to run this job — or be told somebody else has it.
   *
   * Three ways in, each ONE conditional update, so two requests arriving
   * together cannot both win:
   *
   *   • a first commit: nobody has committed yet;
   *   • the next chunk: the job is importing and no chunk holds it;
   *   • a takeover: a chunk holds it but has been silent for longer than
   *     `staleAfterMs` — the run died and left the lease behind.
   *
   * Anything else is a live run in another request: `MIGRATION_BUSY`.
   */
  private async claimRun(ctx: TenancyContext, id: string): Promise<void> {
    const now = new Date()
    const mine = () =>
      supabase
        .from('migration_jobs')
        .update({ status: 'importing', error_code: RUNNING, updated_at: now.toISOString() })
        .eq('workspace_id', ctx.workspaceId)
        .eq('id', id)

    const first = await supabase
      .from('migration_jobs')
      .update({
        status: 'importing',
        error_code: RUNNING,
        committed_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', id)
      .is('committed_at', null)
      .select('id')
    if (first.error) throw new DatabaseError('Failed to start the import', first.error)
    if ((first.data ?? []).length > 0) return

    const next = await mine().eq('status', 'importing').is('error_code', null).select('id')
    if (next.error) throw new DatabaseError('Failed to continue the import', next.error)
    if ((next.data ?? []).length > 0) return

    const stale = new Date(now.getTime() - IMPORT_LIMITS.staleAfterMs).toISOString()
    const takeover = await mine()
      .eq('status', 'importing')
      .eq('error_code', RUNNING)
      .lt('updated_at', stale)
      .select('id')
    if (takeover.error) throw new DatabaseError('Failed to resume the import', takeover.error)
    if ((takeover.data ?? []).length > 0) return

    throw new ConflictError('MIGRATION_BUSY')
  }

  /**
   * Customers and products: one bounded piece of the importable rows.
   *
   * Where to start is read from the job itself — the rows already created,
   * updated or skipped — so a second request, or a run taken over after a
   * crash, goes on from the last progress written rather than from the top.
   */
  private async commitRows(
    ctx: TenancyContext,
    job: MigrationJob,
    candidates: CandidateRow[],
    deadline: number,
  ): Promise<MigrationJob> {
    // The same decisions the preview made, made again from the database as
    // it is NOW: which rows are an existing record, and where stock goes.
    const prepared = await this.prepareRows(ctx, job.entity, candidates)
    const importable = candidates.filter((candidate) => candidate.importable)
    const notImportable = candidates.length - importable.length
    const leftAlone = new Set(job.discovery?.stockLeftAlone ?? [])

    let created = job.rowsCreated
    let updatedCount = job.rowsUpdated
    let skipped = job.rowsSkipped
    const start = created + updatedCount + skipped
    const ledger = await this.mappedIdentities(ctx, job.entity)

    let at = start
    for (; at < importable.length; at++) {
      if (at - start >= IMPORT_LIMITS.rowsPerRequest || Date.now() >= deadline) break

      const candidate = importable[at] as CandidateRow
      const strong = candidate.keys.find((key) => key.strength === 'strong')?.key ?? null
      // A row with no code or phone has no identity of its own; within THIS
      // run it is «row N of this job», which is enough to never write it twice.
      const identity = strong ?? `row:${job.id}:${candidate.row}`

      // ⚠️ ALREADY WRITTEN BY THIS RUN. Progress is noted every few rows, so a
      // run that died is resumed a little before where it stopped. Those rows
      // are counted as what they were, and nothing is done to them again — a
      // second pass would turn a «created» into an «updated» and take the row
      // out of what a rollback may remove.
      const done = ledger.get(identity)
      if (done && done.migrationId === job.id) {
        if (done.outcome === 'updated') updatedCount += 1
        else created += 1
        continue
      }

      // The existing record: the one the database holds under this row's own
      // key, or — when the key has since been edited there — the one an
      // earlier import of this identity became.
      const existingTarget =
        prepared.targetOfRow.get(candidate.row) ?? (strong ? done?.targetId : undefined)
      const stock = leftAlone.has(candidate.row)
        ? undefined
        : prepared.stock?.byRow.get(candidate.row)

      const written = existingTarget
        ? await this.updateEntity(ctx, job.entity, existingTarget, candidate.values, stock)
        : await this.createEntity(
            ctx,
            job.entity,
            candidate.values,
            stock,
            `mig-row-${createHash('sha256').update(`${job.id}|${candidate.row}`).digest('hex').slice(0, 32)}`,
          )

      if (written === null) skipped += 1
      else {
        if (existingTarget) updatedCount += 1
        else created += 1

        await this.recordIdentity(ctx, {
          migrationId: job.id,
          entity: job.entity,
          identity,
          row: candidate.row,
          targetId: written,
          outcome: existingTarget ? 'updated' : 'created',
        })
        ledger.set(identity, {
          targetId: written,
          migrationId: job.id,
          outcome: existingTarget ? 'updated' : 'created',
        })
      }

      // Progress is written down as the work goes, so a run that dies loses at
      // most the rows since the last note — and keeps its lease alive meanwhile.
      if ((at + 1 - start) % IMPORT_LIMITS.heartbeatEvery === 0) {
        await this.update(ctx, job.id, {
          rows_created: created,
          rows_updated: updatedCount,
          rows_skipped: skipped,
        })
      }
    }

    if (at < importable.length) {
      // More to do: say how far it got and let go of the lease.
      return this.update(ctx, job.id, {
        status: 'importing',
        error_code: null,
        rows_created: created,
        rows_updated: updatedCount,
        rows_skipped: skipped,
      })
    }

    if (job.entity === 'product') {
      // The products exist now, so their formulas can name them. Bounded by the
      // same clock: if it runs out the job stays «importing», and the next
      // request comes straight back here — a formula already written is seen
      // and skipped.
      const finished = await this.writeProductBoms(ctx, candidates, deadline)
      if (!finished) {
        return this.update(ctx, job.id, {
          status: 'importing',
          error_code: null,
          rows_created: created,
          rows_updated: updatedCount,
          rows_skipped: skipped,
        })
      }
    }

    const actual = await this.countLedger(ctx, job.id)
    // ⚠️ STOCK IS CHECKED WHERE IT IS — per product AND warehouse, read back
    // from the movements. One total could be right while two warehouses each
    // hold the other's figure.
    const stock = prepared.stock
      ? await this.reconcileStock(ctx, job.id, prepared.stock, leftAlone)
      : null
    const result = reconcile(
      {
        created: job.dryRun?.toCreate ?? 0,
        updated: job.dryRun?.toUpdate ?? 0,
        ...(stock ? stock.expected : {}),
      },
      { ...actual, ...(stock ? stock.actual : {}) },
    )

    return this.update(ctx, job.id, {
      status: result.matched ? 'completed' : 'completed_with_warnings',
      error_code: null,
      rows_created: created,
      rows_updated: updatedCount,
      rows_skipped: skipped + notImportable,
      reconciliation: result,
      completed_at: new Date().toISOString(),
    })
  }

  /* ─── §39 Rollback ──────────────────────────────────────────────────────── */

  /**
   * What undoing this migration would do — WITHOUT doing it.
   *
   * The same preview-then-commit shape as the import itself. §39 forbids a
   * blanket delete, and the reason is visible in the plan: a row the import
   * created that a real business has since built on cannot go, and the plan
   * names it rather than deleting it and breaking the invoice that references
   * it.
   */
  async planRollback(ctx: TenancyContext, id: string): Promise<RollbackPlan> {
    this.assertMayImport(ctx)
    const job = await this.get(ctx, id)

    // The WHOLE ledger (27 Sep 2026): a rollback planned from the first 1000 records leaves the rest behind.
    const { data, error } = await selectAllPages((lo, hi) =>
      supabase
        .from('migration_records')
        .select('target_id, outcome')
        .eq('workspace_id', ctx.workspaceId)
        .eq('migration_id', id)
        .order('id', { ascending: true })
        .range(lo, hi),
    )

    if (error) throw new DatabaseError('Failed to read the migration ledger', error)

    const rows = data ?? []
    const createdIds = rows
      .filter((row) => row.outcome === 'created')
      .map((row) => row.target_id as string)

    const dependents = await this.dependentCounts(ctx, job.entity, createdIds)

    const candidates: RollbackCandidate[] = rows.map((row) => ({
      targetId: row.target_id as string,
      outcome: row.outcome as 'created' | 'updated' | 'skipped',
      dependentCount: dependents.get(row.target_id as string) ?? 0,
    }))

    return planRollback(job.entity, candidates)
  }

  /**
   * Delete exactly the rows the plan says are free, and nothing else.
   *
   * The plan is RECOMPUTED here rather than accepted from the client: a plan
   * posted back could name a row that has acquired an invoice in the seconds
   * since, and trusting it would delete a customer somebody is billing.
   */
  async rollback(ctx: TenancyContext, id: string): Promise<RollbackPlan> {
    this.assertMayImport(ctx)

    // Only the owner may undo an import. Creating rows and destroying them are
    // not the same act — this mirrors `invoice.delete` being owner-only.
    if (ctx.role !== 'owner') throw new ConflictError('MIGRATION_ROLLBACK_FORBIDDEN')

    const job = await this.get(ctx, id)
    const plan = await this.planRollback(ctx, id)

    if (job.entity === 'invoice') {
      // ⚠️ THROUGH THE INVOICE SERVICE, one by one. An imported invoice posted
      // an entry, moved stock and may have recorded a payment; removing its row
      // from the table would leave all three behind. `delete` gives them back.
      const invoices = new InvoiceService()
      for (const invoiceId of plan.deletable) {
        await invoices.delete(invoiceId, ctx)
        await supabase
          .from('migration_records')
          .delete()
          .eq('workspace_id', ctx.workspaceId)
          .eq('migration_id', id)
          .eq('target_id', invoiceId)
      }
    } else if (plan.deletable.length > 0) {
      const { error } = await supabase
        .from(job.entity === 'customer' ? 'customers' : 'products')
        .delete()
        .eq('workspace_id', ctx.workspaceId)
        .in('id', plan.deletable)

      if (error) throw new DatabaseError('Failed to roll back the migration', error)

      // The ledger entries go with the rows. Leaving them would make a second
      // rollback try to delete ids that no longer exist, and would leave the
      // identity map claiming a source row still points somewhere.
      await supabase
        .from('migration_records')
        .delete()
        .eq('workspace_id', ctx.workspaceId)
        .eq('migration_id', id)
        .in('target_id', plan.deletable)
    }

    await this.update(ctx, id, {
      status: 'cancelled',
      rows_created: Math.max(0, job.rowsCreated - plan.deletable.length),
      completed_at: new Date().toISOString(),
    })

    return plan
  }

  /**
   * How many live rows point at each of these.
   *
   * ⚠️ A failed read counts as ONE dependent, not zero. Reporting zero because
   * the query broke would green-light a delete on the strength of a failure —
   * the quiet direction of wrong. "Cannot prove it is free" must behave like
   * "not free".
   */
  private async dependentCounts(
    ctx: TenancyContext,
    entity: MigrationEntity,
    ids: string[],
  ): Promise<Map<string, number>> {
    const counts = new Map<string, number>()
    // What depends on an imported invoice (its entry, its stock, its payment)
    // is undone WITH it by the invoice service, so nothing holds it back here.
    if (ids.length === 0 || entity === 'invoice') return counts

    const sources =
      entity === 'customer'
        ? ([
            ['invoices', 'customer_id'],
            ['transactions', 'customer_id'],
          ] as const)
        : ([
            ['stock_movements', 'product_id'],
            ['invoice_items', 'product_id'],
            // A formula written for it (by this import or by a person) holds it.
            ['boms', 'product_id'],
          ] as const)

    for (const [table, column] of sources) {
      const { data, error } = await selectAllPages((lo, hi) =>
        supabase
          .from(table)
          .select(column)
          .eq('workspace_id', ctx.workspaceId)
          .in(column, ids)
          .order('id', { ascending: true })
          .range(lo, hi),
      )

      if (error) {
        for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1)
        continue
      }

      for (const row of data ?? []) {
        const id = (row as Record<string, string>)[column]
        if (id) counts.set(id, (counts.get(id) ?? 0) + 1)
      }
    }

    return counts
  }

  /* ─── §40 Import profiles ───────────────────────────────────────────────── */

  async saveProfile(ctx: TenancyContext, id: string, name: string): Promise<ImportProfile> {
    this.assertMayImport(ctx)
    const job = await this.get(ctx, id)
    if (!job.discovery) throw new ConflictError('MIGRATION_NOT_SCANNED')

    const profile = toProfile(
      id,
      name.slice(0, 120),
      job.entity,
      job.discovery.headers,
      job.mapping,
    )

    const { data, error } = await supabase
      .from('migration_profiles')
      .upsert(
        {
          workspace_id: ctx.workspaceId,
          created_by: ctx.userId,
          name: profile.name,
          entity: profile.entity,
          columns_by_name: profile.columnsByName,
          signature: profile.signature,
        },
        { onConflict: 'workspace_id,entity,name' },
      )
      .select('id')
      .single()

    if (error) throw new DatabaseError('Failed to save the import profile', error)
    return { ...profile, id: (data?.id as string) ?? profile.id }
  }

  async listProfiles(ctx: TenancyContext, entity: MigrationEntity): Promise<ImportProfile[]> {
    const { data, error } = await supabase
      .from('migration_profiles')
      .select('id, name, entity, columns_by_name, signature')
      .eq('workspace_id', ctx.workspaceId)
      .eq('entity', entity)
      .limit(100)

    if (error) throw new DatabaseError('Failed to read import profiles', error)

    return (data ?? []).map((row) => ({
      id: row.id as string,
      name: row.name as string,
      entity: row.entity as MigrationEntity,
      columnsByName: (row.columns_by_name as Record<string, string>) ?? {},
      signature: (row.signature as string[]) ?? [],
    }))
  }

  /**
   * Apply a saved profile to this job.
   *
   * A drifted profile is applied AND reported. §40 forbids applying a stale
   * mapping silently, so the caller receives the columns that have gone
   * missing and is expected to show them.
   */
  async useProfile(
    ctx: TenancyContext,
    id: string,
    profileId: string,
  ): Promise<{ job: MigrationJob; fit: ProfileFit }> {
    this.assertMayImport(ctx)
    const job = await this.get(ctx, id)
    this.assertOpen(job)
    if (!job.discovery) throw new ConflictError('MIGRATION_NOT_SCANNED')

    const profiles = await this.listProfiles(ctx, job.entity)
    const profile = profiles.find((candidate) => candidate.id === profileId)
    if (!profile) throw new NotFoundError('Import profile')

    const fit = applyProfile(profile, job.entity, job.discovery.headers)
    if (!fit.fits) return { job, fit }

    return { job: await this.setMapping(ctx, id, fit.mapping), fit }
  }

  /* ─── §41 Export symmetry ───────────────────────────────────────────────── */

  /**
   * Export in the shape this importer reads back.
   *
   * The first column is Hisabche's own id as `externalId`, which is what makes
   * a round trip MATCH existing rows instead of creating twins. Without it,
   * export-then-import is a duplication machine.
   */
  async exportCsv(ctx: TenancyContext, entity: MigrationEntity): Promise<string> {
    if (entity === 'invoice') throw new ValidationError('MIGRATION_EXPORT_UNSUPPORTED')
    const columns = EXPORT_COLUMNS[entity]

    // The WHOLE table (27 Sep 2026): an export cut at PostgREST's 1000 rows lost the rest silently.
    const { data, error } = await selectAllPages((lo, hi) =>
      supabase
        .from(entity === 'customer' ? 'customers' : 'products')
        .select('*')
        .eq('workspace_id', ctx.workspaceId)
        .order('id', { ascending: true })
        .range(lo, hi),
    )

    if (error) throw new DatabaseError('Failed to export', error)

    const snake = (field: string) => field.replace(/[A-Z]/g, (letter) => '_' + letter.toLowerCase())

    const rows = (data ?? []).map((row: Record<string, unknown>) =>
      toCsvRow(
        columns.map((field) => {
          if (field === 'externalId') return String(row['id'] ?? '')
          const value = row[snake(field)]
          return value === null || value === undefined ? '' : String(value)
        }),
      ),
    )

    return [toCsvRow([...columns]), ...rows].join('\n')
  }

  async cancel(ctx: TenancyContext, id: string): Promise<MigrationJob> {
    this.assertMayImport(ctx)
    const job = await this.get(ctx, id)
    this.assertOpen(job)

    if (job.status !== 'importing') {
      return this.update(ctx, id, { status: 'cancelled', completed_at: new Date().toISOString() })
    }

    // ⚠️ An import that has started has WRITTEN things. Closing it is not
    // «cancelled» (that would read as «nothing happened»): it is an
    // interrupted import, and what it made stays on record — to be finished
    // by giving the file again, or undone by rolling the job back.
    //
    // A chunk that is still running is not closed underneath itself: the same
    // lease rule as a commit.
    const stale = new Date(Date.now() - IMPORT_LIMITS.staleAfterMs).toISOString()
    const close = () =>
      supabase
        .from('migration_jobs')
        .update({
          status: 'failed',
          error_code: 'MIGRATION_INTERRUPTED',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('workspace_id', ctx.workspaceId)
        .eq('id', id)
        .eq('status', 'importing')

    // Nobody holds it …
    let closed = await close().is('error_code', null).select(COLUMNS)
    // … or whoever held it has been silent too long to still be there.
    if (!closed.error && (closed.data ?? []).length === 0) {
      closed = await close().eq('error_code', RUNNING).lt('updated_at', stale).select(COLUMNS)
    }

    if (closed.error) throw new DatabaseError('Failed to close the import', closed.error)
    const row = (closed.data ?? [])[0]
    if (!row) throw new ConflictError('MIGRATION_BUSY')
    return mapJob(row)
  }

  /* ─── Internals ─────────────────────────────────────────────────────────── */

  /**
   * Importing is an owner/manager act.
   *
   * A seller creates customers one at a time at the counter; creating four
   * thousand at once, with opening balances, is a different operation with a
   * different blast radius. This mirrors `product.write`, which a seller also
   * does not hold.
   */
  /**
   * Rows → invoices, with the customer and products each one names looked up
   * in this business. Reads only.
   */
  private async planInvoices(
    ctx: TenancyContext,
    candidates: CandidateRow[],
    defaultCurrency: string | null,
  ) {
    const grouped = groupInvoiceRows(candidates)

    const [customers, products] = await Promise.all([
      selectAllPages((lo, hi) =>
        supabase
          .from('customers')
          .select('id, full_name, phone')
          .eq('workspace_id', ctx.workspaceId)
          .order('id', { ascending: true })
          .range(lo, hi),
      ),
      selectAllPages((lo, hi) =>
        supabase
          .from('products')
          .select('id, name, sku, barcode')
          .eq('workspace_id', ctx.workspaceId)
          .order('id', { ascending: true })
          .range(lo, hi),
      ),
    ])
    // A failed lookup is not «nobody by that name»: every invoice would be
    // refused for an unknown customer, with the real cause hidden.
    if (customers.error) throw new DatabaseError('Failed to read customers', customers.error)
    if (products.error) throw new DatabaseError('Failed to read products', products.error)

    const knownCustomers: KnownParty[] = (customers.data ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.full_name ?? ''),
      phone: row.phone ? String(row.phone) : null,
    }))
    const knownProducts: KnownProduct[] = (products.data ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.name ?? ''),
      sku: row.sku ? String(row.sku) : null,
      barcode: row.barcode ? String(row.barcode) : null,
    }))

    const partyFindings = resolveInvoiceParties(grouped.drafts, {
      customers: knownCustomers,
      products: knownProducts,
    })

    const places = await this.places(ctx)
    const placeFindings = resolveInvoicePlaces(grouped.drafts, {
      ...places,
      currencies: CURRENCY_CODES,
      defaultCurrency,
    })

    // ⚠️ CLOSED: an invoice in a currency other than the books currency.
    //
    // The invoice itself would be written correctly — and its ledger entry
    // would not: the ledger has no currency and books the figure as it stands
    // (100 USD as 100), which month-end revaluation then «corrects» with an
    // exchange gain that never happened (01-CURRENCY-AUDIT.md, DEFECT-CUR-02).
    // Until a document carries its rate, importing one writes a wrong entry
    // per invoice. Refused here, by name, rather than imported and wrong.
    const base = await baseCurrencyOf(ctx.workspaceId)
    for (const draft of grouped.drafts) {
      if (!draft.importable || !draft.currency || draft.currency === base) continue
      draft.importable = false
      placeFindings.push({
        severity: 'warning',
        row: draft.firstRow,
        column: null,
        code: 'INVOICE_FOREIGN_CURRENCY_CLOSED',
        detail: draft.currency,
      })
    }

    // An invoice this business already imported (from this file or another)
    // is not imported again.
    const mapped = await this.mappedIdentities(ctx, 'invoice')
    const ready = grouped.drafts.filter((draft) => draft.importable)
    const fresh = ready.filter((draft) => !mapped.has(draft.identity))

    return {
      drafts: grouped.drafts,
      fresh,
      alreadyImported: ready.length - fresh.length,
      findings: [...grouped.findings, ...partyFindings, ...placeFindings],
    }
  }

  /**
   * Create the invoices of a job — each through `InvoiceService.create`, the
   * same path a person typing it takes: numbering, stock, costing, the ledger
   * and the payment are that service's, not written a second time here.
   *
   * The idempotency key is derived from the document, so a commit that is
   * retried after a crash — even as a new job — creates nothing twice.
   */
  private async commitInvoices(
    ctx: TenancyContext,
    job: MigrationJob,
    candidates: CandidateRow[],
    deadline: number,
  ): Promise<MigrationJob> {
    const invoices = new InvoiceService()
    const plan = await this.planInvoices(ctx, candidates, job.discovery?.defaultCurrency ?? null)

    // What is left is simply what has not been recorded yet: an invoice made
    // by an earlier chunk (or an earlier, dead run) is in the record and so
    // is not in `fresh`. No cursor to lose.
    let done = 0
    for (const draft of plan.fresh) {
      if (done >= IMPORT_LIMITS.invoicesPerRequest || Date.now() >= deadline) break

      const body = createInvoiceSchema.parse(toInvoiceBody(draft))
      // The branch travels beside the body, as it does for a typed invoice.
      const invoice = await invoices.create(ctx, body, draft.branchId, {
        clientRequestId: this.invoiceRequestId(draft),
      })
      await this.recordIdentity(ctx, {
        migrationId: job.id,
        entity: 'invoice',
        identity: draft.identity,
        row: draft.firstRow,
        targetId: String((invoice as { id: string }).id),
        outcome: 'created',
      })
      done += 1

      if (done % IMPORT_LIMITS.heartbeatEvery === 0) {
        await this.update(ctx, job.id, { rows_created: job.rowsCreated + done })
      }
    }

    if (done < plan.fresh.length) {
      return this.update(ctx, job.id, {
        status: 'importing',
        error_code: null,
        rows_created: job.rowsCreated + done,
      })
    }

    const result = await this.reconcileInvoices(ctx, job, plan.drafts)
    const created = result.lines.find((line) => line.measure === 'invoices')?.hisabcheValue ?? 0

    return this.update(ctx, job.id, {
      status: result.matched ? 'completed' : 'completed_with_warnings',
      error_code: null,
      rows_created: created,
      rows_updated: 0,
      rows_skipped: plan.drafts.length - created,
      reconciliation: result,
      completed_at: new Date().toISOString(),
    })
  }

  /**
   * What the file said, against what is now in the books — read back, not
   * remembered.
   *
   * «Two invoices were created» proves that two calls returned. It does not
   * prove the business is owed what the file says it is owed. So the invoices
   * this job made are READ from the database and their figures set beside the
   * source's: how many, how many lines, the total, what was paid, and what is
   * still receivable. Any difference makes the job «completed with warnings»
   * and is shown line by line.
   */
  private async reconcileInvoices(ctx: TenancyContext, job: MigrationJob, drafts: InvoiceDraft[]) {
    const records = await selectAllPages((lo, hi) =>
      supabase
        .from('migration_records')
        .select('source_identity, target_id')
        .eq('workspace_id', ctx.workspaceId)
        .eq('migration_id', job.id)
        .order('id', { ascending: true })
        .range(lo, hi),
    )
    if (records.error) throw new DatabaseError('Failed to reconcile the migration', records.error)

    const made = new Map<string, string>()
    for (const row of records.data ?? [])
      made.set(String(row.source_identity), String(row.target_id))

    const source = drafts.filter((draft) => made.has(draft.identity))
    const expected = {
      invoices: source.length,
      lines: source.reduce((sum, draft) => sum + draft.lines.length, 0),
      totalMinor: source.reduce((sum, draft) => sum + draft.totalMinor, 0),
      paidMinor: source.reduce(
        (sum, draft) => sum + Math.min(draft.paidMinor, draft.totalMinor),
        0,
      ),
      receivableMinor: source.reduce(
        (sum, draft) => sum + Math.max(0, draft.totalMinor - draft.paidMinor),
        0,
      ),
    }

    const ids = [...made.values()]
    const actual = { invoices: 0, lines: 0, totalMinor: 0, paidMinor: 0, receivableMinor: 0 }
    for (let start = 0; start < ids.length; start += BATCH_SIZE) {
      const chunk = ids.slice(start, start + BATCH_SIZE)
      const [headers, items] = await Promise.all([
        supabase
          .from('invoices')
          .select('id, total, paid_amount')
          .eq('workspace_id', ctx.workspaceId)
          .in('id', chunk),
        supabase
          .from('invoice_items')
          .select('id', { count: 'exact', head: true })
          .in('invoice_id', chunk),
      ])
      if (headers.error)
        throw new DatabaseError('Failed to read the imported invoices', headers.error)
      if (items.error) throw new DatabaseError('Failed to count the imported lines', items.error)

      for (const row of headers.data ?? []) {
        const total = Math.round((Number(row.total) || 0) * 100)
        const paid = Math.round((Number(row.paid_amount) || 0) * 100)
        actual.invoices += 1
        actual.totalMinor += total
        actual.paidMinor += paid
        actual.receivableMinor += Math.max(0, total - paid)
      }
      actual.lines += items.count ?? 0
    }

    return reconcile(expected, actual)
  }

  /**
   * ⚠️ FROM THE DOCUMENT ALONE — not from the job.
   *
   * A commit can die between «the invoice was created» and «it was written
   * down as imported»: the connection drops, the server is restarted. The
   * person then does the only thing they can — gives the same file again,
   * which is a NEW job. A key that carried the job id would be a new key, and
   * that invoice would be created a second time. Keyed by what the document
   * is, the second attempt is answered with the first invoice.
   */
  private invoiceRequestId(draft: InvoiceDraft): string {
    const digest = createHash('sha256').update(draft.identity).digest('hex').slice(0, 32)
    return `mig-inv-${digest}`
  }
  /** Every product of the business, as the formula reader needs it. Reads only. */
  private async catalogue(ctx: TenancyContext): Promise<CatalogueProduct[]> {
    const { data, error } = await selectAllPages((lo, hi) =>
      supabase
        .from('products')
        .select('id, name, buy_price')
        .eq('workspace_id', ctx.workspaceId)
        .order('id', { ascending: true })
        .range(lo, hi),
    )
    if (error) throw new DatabaseError('Failed to read the products', error)
    return (data ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.name ?? ''),
      buyPrice:
        row.buy_price === null || row.buy_price === undefined ? null : Number(row.buy_price),
    }))
  }

  /** The formulas a product file carries, tied to the catalogue as it is now. */
  private async planProductBoms(ctx: TenancyContext, candidates: CandidateRow[]) {
    const { plans, findings } = planBoms(candidates)
    if (plans.length === 0) return { plans, findings }

    const incoming = candidates
      .filter((candidate) => candidate.importable)
      .map((candidate) => String(candidate.values['name'] ?? ''))
    const resolved = resolveBoms(plans, await this.catalogue(ctx), incoming)
    return { plans, findings: [...findings, ...resolved] }
  }

  /**
   * Write the formulas — each through `ManufacturingService.saveDefinition`,
   * the path the production screen itself saves through. The cost of a
   * formula is that service's to work out; nothing is computed here.
   *
   * A product that ALREADY has a formula is left alone: importing a file
   * twice must not put a second version over one a person may have edited.
   *
   * @returns false when the clock ran out before the last formula.
   */
  private async writeProductBoms(
    ctx: TenancyContext,
    candidates: CandidateRow[],
    deadline: number,
  ): Promise<boolean> {
    const { plans } = planBoms(candidates)
    if (plans.length === 0) return true

    // Read AFTER the product rows were written: the file's own products are
    // in the catalogue now and are found by name like any other.
    resolveBoms(plans, await this.catalogue(ctx))
    const manufacturing = new ManufacturingService()

    for (const plan of plans) {
      if (Date.now() >= deadline) return false
      // Two products share the name, or it was not created: nothing to attach to.
      if (!plan.productId) continue
      if (await manufacturing.getDefinition(ctx, plan.productId)) continue
      await manufacturing.saveDefinition(ctx, this.toDefinition(plan, plan.productId))
    }
    return true
  }

  private toDefinition(plan: BomPlan, productId: string) {
    // The same default an invoice gets when nothing names a currency.
    const currency = 'AFN' as const
    return saveProductionDefinitionSchema.parse({
      productId,
      currency,
      columns: productionColumns(currency),
      rows: toProductionRows(plan),
    })
  }

  private assertMayImport(ctx: TenancyContext) {
    if (ctx.role !== 'owner' && ctx.role !== 'manager') {
      throw new ConflictError('MIGRATION_FORBIDDEN')
    }
  }

  private assertOpen(job: MigrationJob) {
    const closed: MigrationStatus[] = [
      'completed',
      'completed_with_warnings',
      'cancelled',
      'failed',
    ]
    if (closed.includes(job.status)) throw new ConflictError('MIGRATION_CLOSED')
  }

  /** The file re-sent at a later step must be the file that was scanned. */
  private async assertSameFile(ctx: TenancyContext, id: string, content: string) {
    const { data, error } = await supabase
      .from('migration_jobs')
      .select('content_digest')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', id)
      .single()

    if (isFailedRead(error)) throw new DatabaseError('Failed to read migration', error)
    if (!data) throw new NotFoundError('Migration')

    const digest = createHash('sha256').update(content).digest('hex')
    if (data.content_digest && data.content_digest !== digest) {
      throw new ConflictError('MIGRATION_FILE_CHANGED')
    }
  }

  private parseAgainstJob(job: MigrationJob, content: string) {
    const rejection = checkIntake(content)
    if (rejection) throw new ValidationError(`MIGRATION_${rejection.code}`)

    const table = parseDelimited(content, job.discovery?.delimiter)
    return validateRows(job.entity, table.headers, table.rows, job.mapping, {
      raggedRows: table.raggedRows,
    })
  }

  private async update(
    ctx: TenancyContext,
    id: string,
    patch: Record<string, unknown>,
  ): Promise<MigrationJob> {
    const { data, error } = await supabase
      .from('migration_jobs')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', id)
      .select(COLUMNS)
      .single()

    if (error || !data) throw new DatabaseError('Failed to update the migration', error)
    return mapJob(data)
  }

  /**
   * The business keys already present in this workspace.
   *
   * Read once per validation rather than per row: four thousand rows against
   * four thousand single-row lookups is four thousand round trips, and the set
   * does not change while a dry run is computing.
   */
  private async existingTargets(
    ctx: TenancyContext,
    entity: MigrationEntity,
  ): Promise<Map<string, string | null>> {
    // key → the ONE row that holds it, or null when several do.
    const targets = new Map<string, string | null>()
    const note = (key: string, id: string) => {
      const held = targets.get(key)
      targets.set(key, held === undefined || held === id ? id : null)
    }
    if (entity === 'invoice') throw new ValidationError('MIGRATION_ENTITY_UNSUPPORTED')

    if (entity === 'customer') {
      // EVERY existing key (27 Sep 2026): with only the first 1000, an import into a larger book created twins of the rest.
      const { data, error } = await selectAllPages((lo, hi) =>
        supabase
          .from('customers')
          .select('id, phone, email, full_name')
          .eq('workspace_id', ctx.workspaceId)
          .order('id', { ascending: true })
          .range(lo, hi),
      )

      if (error) throw new DatabaseError('Failed to read existing customers', error)

      for (const row of data ?? []) {
        const id = String(row.id)
        const phone = normalizePhone(row.phone ?? '')
        if (phone) note(`phone:${phone}`, id)
        const email = (row.email ?? '').trim().toLowerCase()
        if (email) note(`email:${email}`, id)
        const name = comparisonKey(row.full_name ?? '')
        if (name) note(`name:${name}`, id)
      }
    } else {
      const { data, error } = await selectAllPages((lo, hi) =>
        supabase
          .from('products')
          .select('id, sku, barcode, name')
          .eq('workspace_id', ctx.workspaceId)
          .order('id', { ascending: true })
          .range(lo, hi),
      )

      if (error) throw new DatabaseError('Failed to read existing products', error)

      for (const row of data ?? []) {
        const id = String(row.id)
        const sku = comparisonKey(row.sku ?? '')
        if (sku) note(`sku:${sku}`, id)
        const barcode = comparisonKey(row.barcode ?? '')
        if (barcode) note(`barcode:${barcode}`, id)
        const name = comparisonKey(row.name ?? '')
        if (name) note(`name:${name}`, id)
      }
    }

    return targets
  }

  /**
   * What the preview AND the commit both decide before a row is counted or
   * written — so the two cannot disagree:
   *
   *   • which existing record a row is (by its own code, phone or email). It
   *     used to be decided twice: the preview said «update» from the database,
   *     the commit looked only at earlier imports and CREATED a second record
   *     for anything typed in by hand;
   *   • a row whose keys point at two different records is neither;
   *   • for products, where each one's opening stock goes.
   */
  private async prepareRows(
    ctx: TenancyContext,
    entity: MigrationEntity,
    candidates: CandidateRow[],
  ) {
    const findings: Finding[] = []
    const existing = await this.existingTargets(ctx, entity)
    const targetOfRow = new Map<number, string>()

    for (const candidate of candidates) {
      if (!candidate.importable) continue
      const held = new Set<string | null>()
      for (const key of candidate.keys) {
        if (key.strength === 'strong' && existing.has(key.key))
          held.add(existing.get(key.key) ?? null)
      }
      const [only] = [...held]

      if (held.size === 0) {
        // A stock row names a product only by its code. With no such product
        // there is nothing to put the stock on — and nothing to create it from.
        if (entity === 'product' && String(candidate.values['name'] ?? '') === '') {
          findings.push({
            severity: 'warning',
            row: candidate.row,
            column: null,
            code: 'PRODUCT_NOT_FOUND_FOR_STOCK',
          })
          candidate.importable = false
        }
        continue
      }
      if (held.size > 1 || only === null || only === undefined) {
        findings.push({
          severity: 'warning',
          row: candidate.row,
          column: null,
          code: 'EXISTING_MATCH_AMBIGUOUS',
        })
        candidate.importable = false
        continue
      }
      targetOfRow.set(candidate.row, only)
    }

    let stock: StockPlan | null = null
    if (entity === 'product') {
      const places = await this.places(ctx)
      stock = planStock(candidates, places.warehouses)
      findings.push(...stock.findings)
      for (const candidate of candidates) {
        if (stock.refused.has(candidate.row)) candidate.importable = false
      }
    }

    return { existing, targetOfRow, stock, findings }
  }

  /** Of these products, the ones that already have a quantity or any stock movement. */
  private async stockedProducts(ctx: TenancyContext, ids: string[]): Promise<Set<string>> {
    const stocked = new Set<string>()
    const unique = [...new Set(ids)]
    for (let at = 0; at < unique.length; at += 150) {
      const chunk = unique.slice(at, at + 150)
      const [products, movements] = await Promise.all([
        supabase
          .from('products')
          .select('id, quantity')
          .eq('workspace_id', ctx.workspaceId)
          .in('id', chunk),
        selectAllPages((lo, hi) =>
          supabase
            .from('stock_movements')
            .select('product_id')
            .eq('workspace_id', ctx.workspaceId)
            .in('product_id', chunk)
            .order('id', { ascending: true })
            .range(lo, hi),
        ),
      ])
      if (products.error) throw new DatabaseError('Failed to read product stock', products.error)
      if (movements.error) {
        throw new DatabaseError('Failed to read the stock movements', movements.error)
      }
      for (const row of products.data ?? []) {
        if ((Number(row.quantity) || 0) !== 0) stocked.add(String(row.id))
      }
      for (const row of movements.data ?? []) stocked.add(String(row.product_id))
    }
    return stocked
  }

  /**
   * The opening stock this import was to write, against what the movements
   * say is there — per product and warehouse.
   *
   *   stockUnits       every unit, summed;
   *   stockPlacements  how many (product, warehouse) pairs hold EXACTLY their figure.
   *
   * A pair holding a different figure fails the second line even when the
   * units happen to add up.
   */
  private async reconcileStock(
    ctx: TenancyContext,
    migrationId: string,
    plan: StockPlan,
    leftAlone: ReadonlySet<number>,
  ) {
    const { data: records, error } = await selectAllPages((lo, hi) =>
      supabase
        .from('migration_records')
        .select('source_row, target_id')
        .eq('workspace_id', ctx.workspaceId)
        .eq('migration_id', migrationId)
        .order('id', { ascending: true })
        .range(lo, hi),
    )
    if (error) throw new DatabaseError('Failed to reconcile the migration', error)

    const wanted = new Map<string, number>()
    let unplaced = 0
    const productIds: string[] = []
    const unplacedIds: string[] = []
    for (const record of records ?? []) {
      const row = Number(record.source_row)
      const stock = leftAlone.has(row) ? undefined : plan.byRow.get(row)
      if (!stock) continue
      const productId = String(record.target_id)
      if (stock.entries.length > 0) productIds.push(productId)
      for (const entry of stock.entries) {
        wanted.set(`${productId}|${entry.warehouseId}`, entry.quantity)
      }
      if (stock.unplaced > 0) {
        unplaced += stock.unplaced
        unplacedIds.push(productId)
      }
    }

    const held = new Map<string, number>()
    for (let at = 0; at < productIds.length; at += 150) {
      const chunk = productIds.slice(at, at + 150)
      const { data, error: readError } = await selectAllPages((lo, hi) =>
        supabase
          .from('stock_movements')
          .select('product_id, to_warehouse_id, quantity')
          .eq('workspace_id', ctx.workspaceId)
          .eq('reference_type', 'product_opening')
          .in('product_id', chunk)
          .order('id', { ascending: true })
          .range(lo, hi),
      )
      if (readError) throw new DatabaseError('Failed to read the opening stock', readError)
      for (const row of data ?? []) {
        const key = `${String(row.product_id)}|${String(row.to_warehouse_id ?? '')}`
        held.set(key, (held.get(key) ?? 0) + (Number(row.quantity) || 0))
      }
    }

    // A business with no warehouses keeps the figure on the product itself.
    let unplacedHeld = 0
    for (let at = 0; at < unplacedIds.length; at += 150) {
      const { data, error: readError } = await supabase
        .from('products')
        .select('id, quantity')
        .eq('workspace_id', ctx.workspaceId)
        .in('id', unplacedIds.slice(at, at + 150))
      if (readError) throw new DatabaseError('Failed to read product stock', readError)
      for (const row of data ?? []) unplacedHeld += Number(row.quantity) || 0
    }

    let wantedUnits = unplaced
    let exact = 0
    for (const [key, quantity] of wanted) {
      wantedUnits += quantity
      if (Math.abs((held.get(key) ?? 0) - quantity) < 1e-6) exact += 1
    }
    let heldUnits = unplacedHeld
    for (const quantity of held.values()) heldUnits += quantity

    return {
      expected: { stockUnits: wantedUnits, stockPlacements: wanted.size },
      actual: { stockUnits: heldUnits, stockPlacements: exact },
    }
  }

  /** Source identity → the Hisabche row it already became. */
  private async mappedIdentities(
    ctx: TenancyContext,
    entity: MigrationEntity,
  ): Promise<Map<string, { targetId: string; migrationId: string; outcome: string }>> {
    const { data, error } = await selectAllPages((lo, hi) =>
      supabase
        .from('migration_records')
        .select('source_identity, target_id, migration_id, outcome')
        .eq('workspace_id', ctx.workspaceId)
        .eq('source_entity_type', entity)
        .order('id', { ascending: true })
        .range(lo, hi),
    )

    if (error) throw new DatabaseError('Failed to read the migration ledger', error)

    const map = new Map<string, { targetId: string; migrationId: string; outcome: string }>()
    for (const row of data ?? []) {
      map.set(String(row.source_identity), {
        targetId: String(row.target_id),
        migrationId: String(row.migration_id),
        outcome: String(row.outcome),
      })
    }
    return map
  }

  private async recordIdentity(
    ctx: TenancyContext,
    input: {
      migrationId: string
      entity: MigrationEntity
      identity: string
      row: number
      targetId: string
      outcome: 'created' | 'updated' | 'skipped'
    },
  ) {
    const { error } = await supabase.from('migration_records').upsert(
      {
        workspace_id: ctx.workspaceId,
        migration_id: input.migrationId,
        source_entity_type: input.entity,
        source_identity: input.identity,
        source_row: input.row,
        target_entity_type: input.entity,
        target_id: input.targetId,
        outcome: input.outcome,
      },
      { onConflict: 'workspace_id,source_entity_type,source_identity' },
    )

    if (error) throw new DatabaseError('Failed to record the migration identity', error)
  }

  private async countLedger(ctx: TenancyContext, migrationId: string) {
    const { data, error } = await selectAllPages((lo, hi) =>
      supabase
        .from('migration_records')
        .select('outcome')
        .eq('workspace_id', ctx.workspaceId)
        .eq('migration_id', migrationId)
        .order('id', { ascending: true })
        .range(lo, hi),
    )

    if (error) throw new DatabaseError('Failed to reconcile the migration', error)

    const counts = { created: 0, updated: 0 }
    for (const row of data ?? []) {
      if (row.outcome === 'created') counts.created += 1
      if (row.outcome === 'updated') counts.updated += 1
    }
    return counts
  }

  /* ─── Writing the actual business rows ──────────────────────────────────── */

  /**
   * Money crosses a unit boundary here, and only here.
   *
   * The parser works in integer minor units because that is the only way to
   * read `1.234,50` without a float. `customers.opening_balance` and the
   * `products` price columns are stored in MAJOR units by the services that
   * already own them. Dividing at this one seam keeps the importer's
   * arithmetic exact and keeps an imported product identical to a typed one —
   * changing the columns instead would be a schema change for every other
   * caller, which is not this capability's to make.
   */
  private toMajor(minor: unknown): number {
    return typeof minor === 'number' ? minor / 100 : 0
  }

  /**
   * ⚠️ THROUGH THE PRODUCT'S OWN SERVICES — not into the tables.
   *
   * This used to be two inserts. A product arrived with a quantity written
   * straight onto its row: in no warehouse, with no stock movement behind it,
   * so the first sale took the figure negative in a building that had never
   * held the goods. A customer arrived with an opening balance that no
   * transaction recorded, so the «balance» on the row and the customer's
   * statement disagreed from the first day.
   *
   * `ProductService.create` puts opening stock in a warehouse as a movement;
   * `CustomerService.create` records the opening balance as what it is. An
   * imported record is now indistinguishable from one typed in — which is the
   * only way every screen that reads it can be right.
   *
   * @returns the new id, or null when the row is skipped (said in the dry run).
   */
  private async createEntity(
    ctx: TenancyContext,
    entity: MigrationEntity,
    values: Record<string, string | number | boolean>,
    stock: ProductStock | undefined,
    requestId: string,
  ): Promise<string | null> {
    // An invoice is never written as a table row: it goes through the invoice service.
    if (entity === 'invoice') throw new ValidationError('MIGRATION_ENTITY_UNSUPPORTED')

    if (entity === 'customer') {
      const made = await this.keyed(requestId, (options) =>
        new CustomerService().create(
          ctx,
          {
            fullName: String(values['fullName'] ?? ''),
            phone: values['phone'] ? String(values['phone']) : null,
            email: values['email'] ? String(values['email']) : '',
            address: values['address'] ? String(values['address']) : null,
            notes: String(values['notes'] ?? ''),
            openingBalance: this.toMajor(values['openingBalance']),
            type: values['type'] === 'credit' ? 'credit' : 'cash',
            isActive: true,
          },
          options,
        ),
      )
      return String(made.id)
    }

    // A stock row for a product that does not exist was refused before this;
    // a product is never made out of a code and a quantity.
    if (String(values['name'] ?? '') === '') return null

    // A unit or a category the product does not have a name for is kept as
    // the text the file gave, not forced into the nearest one.
    const unit = unitSchema.safeParse(String(values['unit'] ?? '').toLowerCase())
    const category = productCategorySchema.safeParse(String(values['category'] ?? '').toLowerCase())

    const made = await this.keyed(requestId, (options) =>
      new ProductService().create(
        ctx,
        {
          name: String(values['name'] ?? ''),
          sku: String(values['sku'] ?? ''),
          barcode: String(values['barcode'] ?? ''),
          category: category.success ? category.data : 'general',
          unit: unit.success ? unit.data : 'piece',
          ...(!unit.success && values['unit']
            ? { unitLabel: String(values['unit']).slice(0, 40) }
            : {}),
          // Only a business with no warehouses keeps a figure on the product
          // itself; everywhere else the stock arrives warehouse by warehouse.
          quantity: stock?.unplaced ?? 0,
          minStockLevel: typeof values['minStockLevel'] === 'number' ? values['minStockLevel'] : 5,
          buyPrice: this.toMajor(values['buyPrice']),
          sellPrice: this.toMajor(values['sellPrice']),
          ...(values['wholesalePrice'] === undefined
            ? {}
            : { wholesalePrice: this.toMajor(values['wholesalePrice']) }),
          isActive: true,
        },
        { ...options, openingStock: stock?.entries },
      ),
    )
    return String((made as { id: string }).id)
  }

  /**
   * A keyed create, so a row whose response was lost is answered with the
   * record it already made instead of a second one. A database that has not
   * had the idempotency migration cannot honour the key; the row is then
   * written without it, exactly as it was before this existed.
   */
  private async keyed<T>(
    requestId: string,
    run: (options: { clientRequestId?: string | null }) => Promise<T>,
  ): Promise<T> {
    try {
      return await run({ clientRequestId: requestId })
    } catch (error) {
      if (error instanceof IdempotencyUnavailableError) return run({})
      throw error
    }
  }

  /** The warehouses and branches of this business, by name. Reads only. */
  private async places(
    ctx: TenancyContext,
  ): Promise<{ warehouses: NamedPlace[]; branches: NamedPlace[] }> {
    const [warehouses, branches] = await Promise.all([
      supabase
        .from('warehouses')
        .select('id, name, is_active')
        .eq('workspace_id', ctx.workspaceId)
        .is('deleted_at', null),
      supabase.from('branches').select('id, name').eq('workspace_id', ctx.workspaceId),
    ])
    // A business that has never set up warehouses or branches has none; a
    // read that FAILED is not that, and is not allowed to look like it.
    const missing = (code: string | undefined) =>
      ['42P01', 'PGRST205', '42703', 'PGRST204'].includes(code ?? '')
    if (warehouses.error && !missing(warehouses.error.code)) {
      throw new DatabaseError('Failed to read the warehouses', warehouses.error)
    }
    if (branches.error && !missing(branches.error.code)) {
      throw new DatabaseError('Failed to read the branches', branches.error)
    }
    return {
      warehouses: (warehouses.data ?? [])
        .filter((row) => row.is_active !== false)
        .map((row) => ({ id: String(row.id), name: String(row.name ?? '') })),
      branches: (branches.data ?? []).map((row) => ({
        id: String(row.id),
        name: String(row.name ?? ''),
      })),
    }
  }

  /**
   * ⚠️ THROUGH THE SAME SERVICES AS A CREATE.
   *
   * This was a raw UPDATE: no scope check (any importer could rewrite a
   * record of a branch they do not hold), no cache dropped, and a quantity
   * written straight over `products.quantity` — a figure that is a projection
   * of the stock movements, so the next movement silently undid it.
   *
   * What an update never touches: a customer's opening balance and a
   * product's stock that has already started. Both are where the books
   * BEGAN; restating them from a second file would rewrite a figure that
   * sales and payments have since moved. A product that has never been
   * stocked does get its opening stock — once (ProductService.recordOpeningStock).
   *
   * @returns the id, or null when this importer may not touch the record.
   */
  private async updateEntity(
    ctx: TenancyContext,
    entity: MigrationEntity,
    targetId: string,
    values: Record<string, string | number | boolean>,
    stock: ProductStock | undefined,
  ): Promise<string | null> {
    // An invoice is never written as a table row: it goes through the invoice service.
    if (entity === 'invoice') throw new ValidationError('MIGRATION_ENTITY_UNSUPPORTED')
    // Only fields the source actually supplied are written. A blank cell means
    // "the export did not say", not "set this to empty" — overwriting a phone
    // number the shopkeeper typed by hand with a blank from a partial export
    // is data loss dressed up as an update.
    const said = (key: string): string | undefined => {
      const value = values[key]
      return value === undefined || value === '' ? undefined : String(value)
    }

    try {
      if (entity === 'customer') {
        const patch = {
          ...(said('fullName') ? { fullName: said('fullName') as string } : {}),
          ...(said('phone') ? { phone: said('phone') as string } : {}),
          ...(said('email') ? { email: said('email') as string } : {}),
          ...(said('address') ? { address: said('address') as string } : {}),
          ...(said('notes') ? { notes: said('notes') as string } : {}),
        }
        if (Object.keys(patch).length > 0)
          await new CustomerService().update(targetId, ctx, { id: targetId, ...patch })
        return targetId
      }

      const unit = unitSchema.safeParse(String(values['unit'] ?? '').toLowerCase())
      const category = productCategorySchema.safeParse(
        String(values['category'] ?? '').toLowerCase(),
      )
      const patch = {
        ...(said('name') ? { name: said('name') as string } : {}),
        ...(said('sku') ? { sku: said('sku') as string } : {}),
        ...(said('barcode') ? { barcode: said('barcode') as string } : {}),
        ...(category.success ? { category: category.data } : {}),
        ...(unit.success ? { unit: unit.data } : {}),
        ...(typeof values['buyPrice'] === 'number'
          ? { buyPrice: this.toMajor(values['buyPrice']) }
          : {}),
        ...(typeof values['sellPrice'] === 'number'
          ? { sellPrice: this.toMajor(values['sellPrice']) }
          : {}),
        ...(typeof values['wholesalePrice'] === 'number'
          ? { wholesalePrice: this.toMajor(values['wholesalePrice']) }
          : {}),
      }
      const products = new ProductService()
      if (Object.keys(patch).length > 0)
        await products.update(targetId, ctx, { id: targetId, ...patch })
      if (stock && stock.entries.length > 0) {
        await products.recordOpeningStock(ctx, targetId, stock.entries)
      }
      return targetId
    } catch (error) {
      // Not this importer's to change, or gone since the file was checked:
      // that row is skipped and the rest of the file goes on.
      if (error instanceof ForbiddenError || error instanceof NotFoundError) return null
      throw error
    }
  }
}
