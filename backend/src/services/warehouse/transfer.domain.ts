// ============================================
// backend/src/services/warehouse/transfer.domain.ts
//
// K2 — what may happen to a transfer, and when.
//
// ---------------------------------------------------------------------------
// WHY THE LIFECYCLE IS A PURE FUNCTION
//
// Every invariant the spec names is a statement about a TRANSITION:
//
//   • a transfer cannot be received twice
//   • a cancelled transfer cannot be received
//   • a shipped transfer must remain queryable
//   • a transfer must not silently disappear
//
// None of those needs a database to decide. Keeping them here means they can
// be tested exhaustively — every state against every action — instead of
// through a mocked client that proves only that a query was written.
//
// The service below applies the verdict; it does not re-derive it.
// ============================================

export type TransferStatus =
  'requested' | 'approved' | 'picking' | 'shipped' | 'in_transit' | 'received' | 'cancelled'

export type TransferAction = 'approve' | 'pick' | 'ship' | 'mark_in_transit' | 'receive' | 'cancel'

/**
 * Which status each action leads to, from which statuses.
 *
 * Stated as a table rather than a switch so the whole lifecycle is readable at
 * once — and so a state with no exits is visibly a dead end rather than an
 * omission somebody has to notice.
 */
const TRANSITIONS: Record<TransferAction, { from: TransferStatus[]; to: TransferStatus }> = {
  approve: { from: ['requested'], to: 'approved' },
  pick: { from: ['approved'], to: 'picking' },

  // Shipping is the moment the stock actually leaves. It may be reached
  // directly from `approved` — a small shop with one person does not pick as a
  // separate step, and forcing it would make them click twice to describe one
  // action.
  ship: { from: ['approved', 'picking'], to: 'shipped' },

  // An acknowledgement, not a movement. Nothing about the stock changes.
  mark_in_transit: { from: ['shipped'], to: 'in_transit' },

  receive: { from: ['shipped', 'in_transit'], to: 'received' },

  // ⚠️ Only BEFORE the stock has left. Once shipped, the goods are on a road
  // and «cancelled» would say they never moved — a lie the stock movements
  // would then contradict. After shipping, the way back is to receive it and
  // transfer it back, which is what physically happens.
  cancel: { from: ['requested', 'approved', 'picking'], to: 'cancelled' },
}

/** Terminal states. Nothing leaves these. */
const TERMINAL: TransferStatus[] = ['received', 'cancelled']

export type TransferVerdict =
  { ok: true; next: TransferStatus } | { ok: false; code: TransferRefusal }

export type TransferRefusal =
  'TRANSFER_ALREADY_RECEIVED' | 'TRANSFER_CANCELLED' | 'TRANSFER_INVALID_TRANSITION'

/**
 * May this action be applied to a transfer in this state?
 *
 * The two terminal states are refused with their OWN codes rather than a
 * generic one: «this was already received» and «this was cancelled» are
 * different facts, and a person told only «invalid transition» has to go and
 * look up which.
 */
export function canTransition(status: TransferStatus, action: TransferAction): TransferVerdict {
  const rule = TRANSITIONS[action]

  if (rule.from.includes(status)) return { ok: true, next: rule.to }

  // «Transfer cannot Receive twice» and «Cancelled transfer cannot Receive»
  // are the invariants these two branches enforce.
  if (status === 'received') return { ok: false, code: 'TRANSFER_ALREADY_RECEIVED' }
  if (status === 'cancelled') return { ok: false, code: 'TRANSFER_CANCELLED' }

  return { ok: false, code: 'TRANSFER_INVALID_TRANSITION' }
}

/** Has this transfer reached a state nothing leaves? */
export function isTerminal(status: TransferStatus): boolean {
  return TERMINAL.includes(status)
}

/**
 * Does stock physically move on this action?
 *
 * Only two of the six do. The rest change a word on a document, and running
 * the stock RPC for them would move goods twice — the defect this separation
 * exists to make impossible.
 *
 *   ship    → TRANSFER_OUT, stock leaves the source
 *   receive → TRANSFER_IN,  stock arrives at the destination
 */
export function movesStock(action: TransferAction): 'out' | 'in' | null {
  if (action === 'ship') return 'out'
  if (action === 'receive') return 'in'
  return null
}

export interface TransferLineInput {
  productId: string
  quantity: number
  /** K0 — null means the base unit, the only unit that exists before L1. */
  unitId?: string | null | undefined
}

export type LineRefusal =
  'TRANSFER_NO_LINES' | 'TRANSFER_LINE_QUANTITY_INVALID' | 'TRANSFER_DUPLICATE_PRODUCT'

/**
 * Is this a transfer that can be raised at all?
 *
 * Duplicates are refused rather than summed. Two lines for the same product
 * would each be shipped and received separately, and a partial receipt could
 * then be attributed to either — the document would stop being able to say
 * what arrived.
 */
export function validateLines(lines: TransferLineInput[]): LineRefusal[] {
  const problems: LineRefusal[] = []

  if (lines.length === 0) problems.push('TRANSFER_NO_LINES')

  if (lines.some((line) => !Number.isFinite(line.quantity) || line.quantity <= 0)) {
    problems.push('TRANSFER_LINE_QUANTITY_INVALID')
  }

  const seen = new Set<string>()
  for (const line of lines) {
    // Keyed by product AND unit: once L1 exists, «10 boxes» and «10 pieces» of
    // the same product are two different lines, and collapsing them here would
    // silently drop one.
    const key = `${line.productId}::${line.unitId ?? 'base'}`
    if (seen.has(key)) {
      problems.push('TRANSFER_DUPLICATE_PRODUCT')
      break
    }
    seen.add(key)
  }

  return problems
}

/**
 * How much of a line is still on the road.
 *
 * `received` is nullable — an uncounted line is fully in transit, not zero.
 * Reading a null as 0 received is right; reading it as 0 REMAINING would make
 * every unreceived transfer vanish from the in-transit report.
 */
export function remainingQuantity(sent: number, received: number | null | undefined): number {
  return Math.max(0, sent - (received ?? 0))
}

/** Is every line on this transfer fully accounted for? */
export function isFullyReceived(
  lines: { quantity: number; receivedQuantity?: number | null }[],
): boolean {
  if (lines.length === 0) return false
  return lines.every((line) => remainingQuantity(line.quantity, line.receivedQuantity) === 0)
}
