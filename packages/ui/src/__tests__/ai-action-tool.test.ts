// ============================================
// «انجام کار» — the assistant's action screen, and the boundaries it rests on.
//
// What can go wrong: a code the server sends being handed to `t()` and taking
// the page down; a word missing in one language; the screen writing data itself
// instead of asking the pipeline; the pipeline growing a second way to write an
// invoice; an API key reaching it; the mode shown to somebody who can only be
// told it is off.
// ============================================

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  ACTION_ERROR_CODES,
  ACTION_FIELDS,
  ACTION_REASON_CODES,
  ACTION_STAGES,
  ACTION_WARNING_CODES,
} from '../components/ui/ai/ai-action-tool'

const ROOT = join(__dirname, '..', '..', '..', '..')
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8')
/** Comments describe the hazards; only code is asserted on. Flattened: the formatter wraps. */
const code = (source: string) =>
  source
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line))
    .join('\n')
    .split(/\s+/)
    .join(' ')

const tool = code(read('packages', 'ui', 'src', 'components', 'ui', 'ai', 'ai-action-tool.tsx'))
const container = code(
  read(
    'packages',
    'ui',
    'src',
    'components',
    'ui',
    'ai',
    'containers',
    'ai-assistant-container.tsx',
  ),
)
const PIPELINE = ['backend', 'src', 'services', 'ai', 'pipeline']
const domain = code(read(...PIPELINE, 'pipeline.domain.ts'))
const service = code(read(...PIPELINE, 'pipeline.service.ts'))
const repository = code(read(...PIPELINE, 'pipeline.repository.ts'))
const routes = code(read('backend', 'src', 'routes', 'ai-pipeline.routes.ts'))

const OPERATIONS = ['create_invoice', 'register_payment', 'create_customer', 'update_customer']
const STATUSES = [
  'understanding',
  'needs_input',
  'proposed',
  'approved',
  'executed',
  'failed',
  'needs_review',
  'rejected',
  'refused',
]
const QUESTIONS = [
  'customer.missing',
  'customer.not_found',
  'customer.ambiguous',
  'items.missing',
  'product.not_found',
  'product.ambiguous',
  'quantity.missing',
  'unitPrice.missing',
  'amount.missing',
  'invoice.not_found',
  'fullName.missing',
  'changes.missing',
]

describe('every word exists in all three languages', () => {
  it.each(['fa', 'af', 'en'])('%s', (lang) => {
    const all = JSON.parse(read('packages', 'i18n', 'messages', lang, 'common.json'))
    const a = all.aiAction
    const text = (value: unknown, name: string) =>
      expect(typeof value === 'string' && value.length > 0, `${lang} ${name}`).toBe(true)

    text(all.ai.modeDo, 'ai.modeDo')
    for (const key of [...tool.matchAll(/\bt\('([a-zA-Z]+)'/g)].map(
      (match) => match[1] as string,
    )) {
      text(a[key], `aiAction.${key}`)
    }
    for (const key of ACTION_ERROR_CODES) text(a.errors[key], `errors.${key}`)
    for (const key of ACTION_REASON_CODES) text(a.reasons[key], `reasons.${key}`)
    for (const key of ACTION_WARNING_CODES) text(a.warnings[key], `warnings.${key}`)
    for (const key of ACTION_FIELDS) text(a.fields[key], `fields.${key}`)
    for (const key of ACTION_STAGES) text(a.stages[key], `stages.${key}`)
    for (const key of [...OPERATIONS, 'unknown']) text(a.operations[key], `operations.${key}`)
    for (const key of STATUSES) text(a.status[key], `status.${key}`)
    for (const key of ['ok', 'stopped', 'failed']) text(a.outcomes[key], `outcomes.${key}`)
    for (const key of ['cash', 'bank', 'mobile_money', 'other'])
      text(a.methods[key], `methods.${key}`)
    for (const key of ['cash', 'credit']) text(a.customerTypes[key], `customerTypes.${key}`)
    for (const key of ['create', 'update']) text(a.proposalTitle[key], `proposalTitle.${key}`)
    for (const key of ['general']) {
      text(a.errors[key], 'errors.general')
      text(a.reasons[key], 'reasons.general')
    }
    for (const path of QUESTIONS) {
      const [field, reason] = path.split('.') as [string, string]
      text(a.questions[field]?.[reason], `questions.${path}`)
    }
  })
})

describe('what the server sends is never trusted to be a translation key', () => {
  it('the screen knows every code the pipeline can answer with', () => {
    // Every refusal and reason the backend names has words here — and a code it
    // does not know falls to the general sentence instead of reaching `t()`.
    const raised = [
      ...`${service} ${routes} ${repository}`.matchAll(
        /'(AI_(?:PIPELINE|RUN|NOT|QUOTA)_[A-Z_]+)'/g,
      ),
    ].map((match) => match[1] as string)
    expect(raised.length).toBeGreaterThan(8)
    for (const errorCode of new Set(raised)) {
      expect(ACTION_ERROR_CODES as readonly string[], errorCode).toContain(errorCode)
    }
    for (const reason of [
      'UNSUPPORTED_REQUEST',
      'NOT_ALLOWED',
      'MODEL_UNAVAILABLE',
      'INVESTIGATION_FAILED',
      'EXECUTION_ERROR',
    ]) {
      expect(service, reason).toContain(`'${reason}'`)
      expect(ACTION_REASON_CODES as readonly string[], reason).toContain(reason)
    }
    for (const warning of ACTION_WARNING_CODES) expect(domain, warning).toContain(`'${warning}'`)
    expect(tool).toContain(
      "isOneOf(ACTION_ERROR_CODES, code) ? t(`errors.${code}`) : t('errors.general')",
    )
    expect(tool).toContain('isOneOf(ACTION_REASON_CODES, run.reasonCode)')
    expect(tool).toContain('isOneOf(ACTION_WARNING_CODES, warning.code)')
    expect(tool).toContain('isOneOf(ACTION_STAGES, step.stage)')
  })

  it('the stages and questions shown are the ones the pipeline has', () => {
    for (const stage of ACTION_STAGES) expect(domain, stage).toContain(`'${stage}',`)
    for (const path of QUESTIONS) {
      const [field, reason] = path.split('.') as [string, string]
      expect(domain, path).toContain(`'${field}'`)
      expect(domain, path).toContain(`'${reason}'`)
    }
  })
})

describe('the screen asks; it does not write', () => {
  it('uses the pipeline hooks and no other mutation', () => {
    expect(tool).toContain('useStartAiPipelineRun()')
    expect(tool).toContain('useDecideAiActionRequest()')
    expect(tool).toContain('useCancelAiPipelineRun()')
    for (const banned of [
      'useCreateInvoice',
      'useRecordPayment',
      'useCreateCustomer',
      'useUpdateCustomer',
      'apiClient',
    ]) {
      expect(tool, banned).not.toContain(banned)
    }
  })

  it('approve is offered only when the server said this person may', () => {
    expect(tool).toContain('{open && run.canApprove ? (')
    expect(tool).toContain("const open = run.status === 'proposed' && !run.dryRun")
  })

  it('the mode is offered when it is on — or to the owner, who can turn it on', () => {
    expect(container).toContain(
      'const offersActions = pipeline?.enabled === true || pipeline?.canManage === true',
    )
    expect(container).toContain(
      "ASSISTANT_MODES.filter((value) => value !== 'do' || offersActions)",
    )
  })

  it('shared controls, no raw select, no physical direction', () => {
    expect(tool).not.toContain('<select')
    expect(tool).toContain('<SelectField')
    for (const physical of [' ml-', ' mr-', ' pl-', ' pr-', 'text-left', 'text-right']) {
      expect(tool, physical).not.toContain(physical)
    }
  })
})

describe('the pipeline is an orchestrator', () => {
  it('its own directory holds three files and reads three tables of its own', () => {
    expect(readdirSync(join(ROOT, ...PIPELINE)).sort()).toEqual([
      'pipeline.domain.ts',
      'pipeline.repository.ts',
      'pipeline.service.ts',
    ])
    const tables = [...repository.matchAll(/\.from\('([a-z_]+)'\)/g)].map((match) => match[1])
    expect([...new Set(tables)].sort()).toEqual([
      'ai_pipeline_runs',
      'ai_pipeline_settings',
      'ai_pipeline_steps',
      'ai_query_log',
    ])
    // The usage row is only ever ADDED: the allowance is counted from it.
    expect(repository).toContain("supabase.from('ai_query_log').insert(")
  })

  it('neither the rules nor the orchestrator touch the database or a business service', () => {
    for (const source of [domain, service, routes]) {
      expect(source).not.toContain('supabase')
      expect(source).not.toContain('.rpc(')
      for (const banned of [
        'invoice.service',
        'customer.service',
        'payments.service',
        "services/payments'",
      ]) {
        expect(source, banned).not.toContain(banned)
      }
    }
  })

  it('every write goes through the server’s own router, with the run as its key', () => {
    expect(service).toContain('answer = await runner(toHttpCall(claimed.command, claimed.id))')
    expect(routes).toContain(
      "runRoute(fastify, call, request.headers.authorization ?? '', request.tenancy.workspaceId)",
    )
    expect(domain).toContain(
      'export const idempotencyKeyOf = (runId: string): string => `aip-${runId}`',
    )
  })

  it('the claim comes before the write, and the audit step before the claim result is used', () => {
    const execute = service.slice(service.indexOf('async runClaimed('))
    const claim = execute.indexOf("status: 'approved',")
    const audit = execute.indexOf("addStep(claimed, 'confirm', 'ok'")
    const executeCall = execute.indexOf('runner(toHttpCall(')
    expect(claim).toBeLessThan(audit)
    expect(audit).toBeLessThan(executeCall)
  })

  it('an API key cannot reach it', () => {
    const scopes = code(read('backend', 'src', 'services', 'developer', 'developer.domain.ts'))
    expect(scopes).not.toContain('/api/ai/pipeline')
    // …and every route asks for a member of the business.
    expect(routes.split('{ preHandler: MEMBER }').length - 1).toBe(5)
    expect(routes.split(/fastify\.(?:get|post|put|patch|delete)\(/).length - 1).toBe(5)
  })

  it('a customer change proposed earlier cannot overwrite a newer one', () => {
    const customers = code(read('backend', 'src', 'services', 'customer.service.ts'))
    expect(customers).toContain("write = write.eq('updated_at', options.expectedUpdatedAt)")
    expect(customers).toContain("if (conditional) throw new ConflictError('CUSTOMER_CHANGED')")
    expect(domain).toContain('body: { ...changes, expectedUpdatedAt: current.updatedAt },')
  })
})
