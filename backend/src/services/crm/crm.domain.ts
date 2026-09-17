// ============================================
// backend/src/services/crm/crm.domain.ts
//
// CRM Core — pure rules. No Supabase, no clock in a decision path, no cache.
//
// Two record kinds:
//   interaction  a task / contact with one or more customers (the table is
//                `interactions`; a task may cover several customers through
//                `customers_snapshot`, with a per-customer result in
//                `customer_outcomes`)
//   opportunity  a potential sale moving through stages
// ============================================

// ─── Vocabulary ──────────────────────────────────────────────────────────────

export const INTERACTION_STATUSES = ['pending', 'in_progress', 'completed'] as const
export type InteractionStatus = (typeof INTERACTION_STATUSES)[number]

/**
 * The stage names the API accepts (validation `crm.schema.ts`). The removed
 * pipeline method counted `closed_won` / `closed_lost`, names no write path
 * ever stores — won and lost deals vanished from it.
 */
export const OPPORTUNITY_STAGES = [
  'lead',
  'qualified',
  'proposal',
  'negotiation',
  'won',
  'lost',
] as const
export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number]

export function isOpenStage(stage: string | null | undefined): boolean {
  return stage !== 'won' && stage !== 'lost'
}

export type CrmRuleCode = 'CRM_OUTCOME_NOTE_REQUIRED' | 'CRM_OUTCOME_CUSTOMER_NOT_ON_TASK'

export class CrmRuleError extends Error {
  constructor(readonly code: CrmRuleCode) {
    super(code)
  }
}

// ─── Shapes ──────────────────────────────────────────────────────────────────

export interface CustomerRef {
  id: string
  name: string
  phone: string | null
}

export interface StatusChange {
  status: InteractionStatus
  changedAt: string
  changedBy: string
}

export interface CustomerOutcome {
  customerId: string
  outcome: 'done' | 'failed'
  recordedAt: string
  recordedBy: 'owner' | 'employee'
  note?: string
}

export interface Interaction {
  id: string
  customerId: string | null
  type: string | null
  subject: string | null
  content: string | null
  interactionDate: string | null
  createdAt: string | null
  status: string
  publicToken: string | null
  employeeId: string | null
  employeeName: string | null
  customers: CustomerRef[]
  statusHistory: StatusChange[]
  customerOutcomes: CustomerOutcome[]
}

export interface Opportunity {
  id: string
  customerId: string | null
  title: string
  description: string
  stage: string
  value: number
  probability: number
  expectedCloseDate: string | null
  createdAt: string | null
  updatedAt: string | null
}

// ─── Mapping (DB row → API shape) ────────────────────────────────────────────

const list = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : [])

/** snake_case row → camelCase. Missing this once made every CRM date render «-». */
export function toInteraction(raw: Record<string, any>): Interaction {
  return {
    id: raw.id,
    customerId: raw.customer_id ?? null,
    type: raw.type ?? null,
    subject: raw.subject ?? null,
    content: raw.content ?? null,
    interactionDate: raw.interaction_date ?? null,
    createdAt: raw.created_at ?? null,
    status: raw.status ?? 'pending',
    publicToken: raw.public_token ?? null,
    employeeId: raw.employee_id ?? null,
    employeeName: raw.employee_name ?? null,
    customers: list<CustomerRef>(raw.customers_snapshot),
    statusHistory: list<StatusChange>(raw.status_history),
    // An absent entry means «not attempted yet» — distinct from a recorded failure.
    customerOutcomes: list<CustomerOutcome>(raw.customer_outcomes),
  }
}

/**
 * snake_case row → camelCase. The list endpoint used to return raw rows while
 * the client type (and UI) read `customerId` / `expectedCloseDate` — both were
 * always undefined on the client.
 */
export function toOpportunity(raw: Record<string, any>): Opportunity {
  return {
    id: raw.id,
    customerId: raw.customer_id ?? null,
    title: raw.title ?? '',
    description: raw.description ?? '',
    stage: raw.stage ?? 'lead',
    value: Number(raw.value) || 0,
    probability: Number(raw.probability) || 0,
    expectedCloseDate: raw.expected_close_date ?? null,
    createdAt: raw.created_at ?? null,
    updatedAt: raw.updated_at ?? null,
  }
}

// ─── Rules ───────────────────────────────────────────────────────────────────

export function appendStatus(
  history: StatusChange[],
  status: InteractionStatus,
  changedBy: string,
  at: string,
): StatusChange[] {
  return [...history, { status, changedAt: at, changedBy }]
}

/**
 * Record one customer's result on a task. Re-recording replaces the previous
 * entry: a second attempt that reached someone must be able to correct an ❌.
 *
 * ⚠️ The customer must already be on the task's snapshot. The public token
 * path is unauthenticated; without this check a token holder could attach
 * notes to any customer of the shop.
 */
export function recordOutcome(
  snapshot: Array<{ id: string }>,
  current: CustomerOutcome[],
  input: { customerId: string; outcome: 'done' | 'failed'; note?: string | undefined },
  recordedBy: 'owner' | 'employee',
  at: string,
): CustomerOutcome[] {
  const note = input.note?.trim() ?? ''
  // A failure without a reason tells the task's owner nothing.
  if (input.outcome === 'failed' && !note) throw new CrmRuleError('CRM_OUTCOME_NOTE_REQUIRED')
  if (!snapshot.some((c) => c.id === input.customerId)) {
    throw new CrmRuleError('CRM_OUTCOME_CUSTOMER_NOT_ON_TASK')
  }
  return [
    ...current.filter((entry) => entry.customerId !== input.customerId),
    {
      customerId: input.customerId,
      outcome: input.outcome,
      recordedAt: at,
      recordedBy,
      ...(note ? { note } : {}),
    },
  ]
}

/** Distinct subjects, most recent first; case-insensitive, keeps the typed casing. */
export function distinctSubjects(
  subjects: Array<string | null | undefined>,
  limit: number,
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of subjects) {
    const subject = String(raw ?? '').trim()
    if (!subject) continue
    const key = subject.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(subject)
    if (out.length >= limit) break
  }
  return out
}

/** Whether a task concerns a customer: as its primary customer or on its snapshot. */
export function concernsCustomer(interaction: Interaction, customerId: string): boolean {
  return (
    interaction.customerId === customerId ||
    interaction.customers.some((customer) => customer.id === customerId)
  )
}

// ─── Customer view (Customer 360 and anything else that shows a party) ───────

export interface CustomerCrmSummary {
  openTasks: number
  completedTasks: number
  lastInteractionAt: string | null
  /** The oldest task still open — what to do next for this customer. */
  nextTask: { id: string; subject: string | null; interactionDate: string | null } | null
  openOpportunities: number
  openPipelineValue: number
  /** Σ value × probability over open opportunities. */
  weightedPipelineValue: number
  wonValue: number
  lostCount: number
}

export function summarizeCustomerCrm(
  interactions: Interaction[],
  opportunities: Opportunity[],
): CustomerCrmSummary {
  const open = interactions.filter((i) => i.status !== 'completed')
  const byDate = (a: Interaction, b: Interaction) =>
    String(a.interactionDate ?? '').localeCompare(String(b.interactionDate ?? ''))
  const next = [...open].sort(byDate)[0] ?? null
  const latest = [...interactions].sort(byDate).at(-1) ?? null

  const openDeals = opportunities.filter((o) => isOpenStage(o.stage))
  const round2 = (n: number) => Math.round(n * 100) / 100

  return {
    openTasks: open.length,
    completedTasks: interactions.length - open.length,
    lastInteractionAt: latest?.interactionDate ?? null,
    nextTask: next
      ? { id: next.id, subject: next.subject, interactionDate: next.interactionDate }
      : null,
    openOpportunities: openDeals.length,
    openPipelineValue: round2(openDeals.reduce((sum, o) => sum + o.value, 0)),
    weightedPipelineValue: round2(
      openDeals.reduce(
        (sum, o) => sum + (o.value * Math.min(100, Math.max(0, o.probability))) / 100,
        0,
      ),
    ),
    wonValue: round2(
      opportunities.filter((o) => o.stage === 'won').reduce((sum, o) => sum + o.value, 0),
    ),
    lostCount: opportunities.filter((o) => o.stage === 'lost').length,
  }
}
