// ============================================
// backend/src/services/conflict/conflict.domain.ts
//
// What to do when an offline device and the server disagree about a row.
//
// ---------------------------------------------------------------------------
// THE RULE THAT SHAPES EVERYTHING HERE
//
//   A financial conflict is NEVER resolved by last-write-wins.
//
// Last-write-wins is a rule about clocks. Whose total ends up in the books
// would then depend on which phone reconnected second, and a shopkeeper whose
// device was offline for an hour would silently overwrite an amount somebody
// corrected in the meantime. There is no clock reading that makes that right.
//
// So: PRESERVE BOTH → REVIEW → AUTHORIZED RESOLUTION → AUDIT. Both versions
// are kept, a person with the authority decides, and the decision is recorded.
//
// Non-financial fields are a different matter. Two people editing a customer's
// notes and their phone number are not in conflict at all, and making someone
// adjudicate that is how a review queue becomes noise nobody reads.
// ============================================

export type ConflictEntity =
  'invoice' | 'payment' | 'journal_entry' | 'customer' | 'product' | 'transaction'

/**
 * Fields whose value is money, quantity, or the identity of what was traded.
 *
 * A disagreement about any of them is a disagreement about what happened, and
 * it goes to a person. The list is per-entity and deliberately explicit: a
 * heuristic on field names would classify `discount_note` as financial and
 * `qty` as not.
 */
const FINANCIAL_FIELDS: Record<ConflictEntity, string[]> = {
  invoice: [
    'total',
    'subtotal',
    'discount_total',
    'tax_total',
    'paid_amount',
    'currency',
    'type',
    'customer_id',
    'supplier_id',
    'status',
    'date',
    'items',
  ],
  payment: ['amount', 'currency', 'direction', 'party_id', 'party_type', 'entry_date', 'status'],
  journal_entry: ['date', 'status', 'lines', 'entry_number'],
  customer: ['opening_balance'],
  product: ['quantity', 'buy_price', 'sell_price'],
  transaction: ['amount', 'currency', 'type', 'date'],
}

export function isFinancialField(entity: ConflictEntity, field: string): boolean {
  return (FINANCIAL_FIELDS[entity] ?? []).includes(field)
}

export interface FieldDivergence {
  field: string
  serverValue: unknown
  clientValue: unknown
  financial: boolean
}

/**
 * Where the two versions actually differ.
 *
 * Only the fields the client SENT are compared. A partial update that omits a
 * field is not claiming anything about it, and treating an absent key as an
 * intent to blank the value is how offline edits erase data they never
 * touched.
 */
export function diverging(
  entity: ConflictEntity,
  serverRow: Record<string, unknown>,
  clientPayload: Record<string, unknown>,
): FieldDivergence[] {
  const divergences: FieldDivergence[] = []

  for (const [field, clientValue] of Object.entries(clientPayload)) {
    if (IGNORED_FIELDS.has(field)) continue

    const serverValue = serverRow[field]
    if (sameValue(serverValue, clientValue)) continue

    divergences.push({
      field,
      serverValue,
      clientValue,
      financial: isFinancialField(entity, field),
    })
  }

  return divergences
}

/** Bookkeeping columns the server owns; a difference in them is not a conflict. */
const IGNORED_FIELDS = new Set([
  'version',
  'updated_at',
  'created_at',
  'workspace_id',
  'user_id',
  'id',
  'locked_by_user_id',
  'lock_expires_at',
])

function sameValue(left: unknown, right: unknown): boolean {
  if (left === right) return true
  if (left == null && right == null) return true
  if (typeof left === 'number' || typeof right === 'number') {
    const a = Number(left)
    const b = Number(right)
    // Money arrives as a string from Postgres and as a number from the client.
    if (Number.isFinite(a) && Number.isFinite(b)) return Math.round(a * 100) === Math.round(b * 100)
  }
  if (typeof left === 'object' && typeof right === 'object') {
    return JSON.stringify(left) === JSON.stringify(right)
  }
  return String(left ?? '') === String(right ?? '')
}

export type ConflictVerdict =
  /** Nothing actually differs. The client can simply take the server version. */
  | { kind: 'no_divergence' }
  /**
   * Only non-financial fields differ. Safe to merge without a person, and the
   * merge is stated rather than assumed.
   */
  | { kind: 'auto_merge'; merged: Record<string, unknown>; fields: string[] }
  /**
   * Money, quantity or identity differs. A person with the authority decides;
   * until then BOTH versions are kept and neither is applied.
   */
  | { kind: 'needs_review'; divergences: FieldDivergence[] }

export function classifyConflict(
  entity: ConflictEntity,
  serverRow: Record<string, unknown>,
  clientPayload: Record<string, unknown>,
): ConflictVerdict {
  const divergences = diverging(entity, serverRow, clientPayload)

  if (divergences.length === 0) return { kind: 'no_divergence' }

  if (divergences.some((d) => d.financial)) {
    return { kind: 'needs_review', divergences }
  }

  const merged = { ...serverRow }
  for (const divergence of divergences) merged[divergence.field] = divergence.clientValue

  return { kind: 'auto_merge', merged, fields: divergences.map((d) => d.field) }
}

// ─── Resolution ──────────────────────────────────────────────────────────────

export type ResolutionChoice = 'keep_server' | 'keep_client' | 'merge'

export interface ResolutionRequest {
  choice: ResolutionChoice
  /** Required for `merge`: which side each diverging field takes. */
  fieldChoices?: Record<string, 'server' | 'client'> | undefined
  reason: string
}

export type ResolutionRuleCode =
  | 'CONFLICT_REASON_REQUIRED'
  | 'CONFLICT_MERGE_FIELDS_REQUIRED'
  | 'CONFLICT_MERGE_FIELD_UNKNOWN'
  | 'CONFLICT_ALREADY_RESOLVED'

export function validateResolution(
  request: ResolutionRequest,
  divergences: FieldDivergence[],
  alreadyResolved: boolean,
): ResolutionRuleCode[] {
  const problems: ResolutionRuleCode[] = []

  if (alreadyResolved) problems.push('CONFLICT_ALREADY_RESOLVED')

  // A financial correction with no stated reason is unauditable six months
  // later, which is exactly when somebody asks about it.
  if (!request.reason || request.reason.trim().length === 0) {
    problems.push('CONFLICT_REASON_REQUIRED')
  }

  if (request.choice === 'merge') {
    const choices = request.fieldChoices ?? {}
    const known = new Set(divergences.map((d) => d.field))

    // Every diverging field must be decided. Leaving one out would silently
    // fall back to a default — and a default IS last-write-wins wearing a
    // different hat.
    for (const divergence of divergences) {
      if (!choices[divergence.field]) problems.push('CONFLICT_MERGE_FIELDS_REQUIRED')
    }

    for (const field of Object.keys(choices)) {
      if (!known.has(field)) problems.push('CONFLICT_MERGE_FIELD_UNKNOWN')
    }
  }

  return [...new Set(problems)]
}

/** The row that results from a decision. Pure: it applies nothing. */
export function applyResolution(
  serverRow: Record<string, unknown>,
  clientPayload: Record<string, unknown>,
  divergences: FieldDivergence[],
  request: ResolutionRequest,
): Record<string, unknown> {
  if (request.choice === 'keep_server') return { ...serverRow }

  if (request.choice === 'keep_client') {
    const applied = { ...serverRow }
    for (const divergence of divergences) applied[divergence.field] = divergence.clientValue
    return applied
  }

  const choices = request.fieldChoices ?? {}
  const merged = { ...serverRow }

  for (const divergence of divergences) {
    if (choices[divergence.field] === 'client') {
      merged[divergence.field] = divergence.clientValue
    }
  }

  return merged
}

/**
 * The order financial mutations must be applied in.
 *
 * Sorted by when the device recorded them, with the mutation id breaking ties
 * so two mutations stamped in the same millisecond do not swap places between
 * runs. Ordering is not an optimisation here: applying a payment before the
 * invoice it settles fails, and applying a reversal before its entry books a
 * correction to nothing.
 */
export function orderMutations<T extends { createdAt: number; mutationId: string }>(
  mutations: T[],
): T[] {
  return [...mutations].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt
    return a.mutationId < b.mutationId ? -1 : a.mutationId > b.mutationId ? 1 : 0
  })
}
