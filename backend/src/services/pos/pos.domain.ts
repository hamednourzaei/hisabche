// ============================================
// backend/src/services/pos/pos.domain.ts
//
// A till session: what was opened with, what was sold, what is in the drawer.
//
// ---------------------------------------------------------------------------
// POS IS NOT A SPECIAL OFFLINE MODE HERE
//
// Odoo and ERPNext both ship an offline POS because the till is the one place
// a retailer cannot tolerate a spinner. It is a carve-out: the rest of those
// products needs the server.
//
// Hisabche is offline everywhere, so the till needs no carve-out. What it
// needs is the thing a carve-out cannot give it — the same idempotency,
// ordering and conflict rules the rest of the financial cores already have.
//
// ---------------------------------------------------------------------------
// THE PROBLEM NEITHER OF THEM SOLVES: THE SESSION THAT NEVER CAME BACK
//
// A phone opens a session, takes 40,000 in cash, and is dropped in a canal.
// In both competitors the session stays open forever: the cash is
// unaccounted, the orders never post, and the books wait on a device that no
// longer exists.
//
// So this core makes an orphaned session a FIRST-CLASS state with a defined
// recovery: an owner counts the drawer from another device, force-closes it,
// and the variance is attributed to that session by name. The money is
// accounted for even though the device is gone.
//
// ---------------------------------------------------------------------------
// EXPECTED CASH IS DERIVED, NEVER STORED
//
// Same rule as an invoice's outstanding balance. A stored "expected" figure is
// a number somebody can edit, and the whole point of a cash count is that the
// two sides were computed independently.
// ============================================

export type SessionStatus = 'open' | 'closing' | 'closed' | 'force_closed'

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'credit' | 'other'

export interface PosPayment {
  method: PaymentMethod
  /** Minor units. What the customer handed over for this method. */
  amountMinor: number
}

export interface PosOrder {
  id: string
  /** Stable across every retry. Generated once on the device, never re-made. */
  orderRef: string
  /** Minor units. The invoice total this order became. */
  totalMinor: number
  payments: PosPayment[]
  /** Minor units. Cash handed back. Reduces what is in the drawer. */
  changeMinor: number
  status: 'completed' | 'voided'
  createdAt: string
}

export type CashMovementKind =
  /** Money put into the drawer mid-session (a float top-up). */
  | 'cash_in'
  /** Money taken out mid-session (paying a delivery, banking excess). */
  | 'cash_out'

export interface CashMovement {
  id: string
  kind: CashMovementKind
  amountMinor: number
  /** Never optional. Cash leaving a drawer with no stated reason is a hole. */
  reason: string
  createdAt: string
}

export interface PosSession {
  id: string
  status: SessionStatus
  /** Minor units. The float the drawer started with. */
  openingFloatMinor: number
  openedAt: string
  openedBy: string
  closedAt?: string | null
  closedBy?: string | null
  /** Minor units. What a person physically counted at close. */
  countedCashMinor?: number | null
}

// ─── What should be in the drawer ────────────────────────────────────────────

/**
 * The cash a session took, net of change given.
 *
 * ONLY cash. A card payment never touches the drawer, and counting it as
 * though it did is the single most common way a till "goes missing" money
 * that was never there.
 */
export function cashTakenMinor(orders: PosOrder[]): number {
  return orders
    .filter((order) => order.status === 'completed')
    .reduce((sum, order) => {
      const cash = order.payments
        .filter((payment) => payment.method === 'cash')
        .reduce((paid, payment) => paid + payment.amountMinor, 0)

      // Change comes OUT of the drawer, so it nets against what came in.
      return sum + cash - order.changeMinor
    }, 0)
}

export function movementsNetMinor(movements: CashMovement[]): number {
  return movements.reduce(
    (sum, movement) =>
      movement.kind === 'cash_in' ? sum + movement.amountMinor : sum - movement.amountMinor,
    0,
  )
}

/**
 * What the drawer SHOULD hold: float + cash taken + movements.
 *
 * Derived on every call, never stored. A stored figure is one somebody can
 * edit, and the point of a cash count is that the two sides were arrived at
 * independently.
 */
export function expectedCashMinor(
  session: PosSession,
  orders: PosOrder[],
  movements: CashMovement[],
): number {
  return session.openingFloatMinor + cashTakenMinor(orders) + movementsNetMinor(movements)
}

export interface SessionTotals {
  orderCount: number
  voidedCount: number
  /** Minor units, all methods. */
  grossSalesMinor: number
  byMethod: Record<PaymentMethod, number>
  expectedCashMinor: number
  countedCashMinor: number | null
  /**
   * counted − expected. Positive is over, negative is short.
   * Null until somebody has counted.
   */
  varianceMinor: number | null
}

export function summarise(
  session: PosSession,
  orders: PosOrder[],
  movements: CashMovement[],
): SessionTotals {
  const completed = orders.filter((order) => order.status === 'completed')

  const byMethod: Record<PaymentMethod, number> = {
    cash: 0,
    card: 0,
    transfer: 0,
    credit: 0,
    other: 0,
  }

  for (const order of completed) {
    for (const payment of order.payments) {
      byMethod[payment.method] += payment.amountMinor
    }
  }

  const expected = expectedCashMinor(session, orders, movements)
  const counted = session.countedCashMinor ?? null

  return {
    orderCount: completed.length,
    voidedCount: orders.length - completed.length,
    grossSalesMinor: completed.reduce((sum, order) => sum + order.totalMinor, 0),
    byMethod,
    expectedCashMinor: expected,
    countedCashMinor: counted,
    varianceMinor: counted === null ? null : counted - expected,
  }
}

// ─── Rules ───────────────────────────────────────────────────────────────────

export type PosRuleCode =
  | 'POS_SESSION_NOT_OPEN'
  | 'POS_SESSION_ALREADY_OPEN'
  | 'POS_PAYMENT_SHORT'
  | 'POS_PAYMENT_NEGATIVE'
  | 'POS_CHANGE_EXCEEDS_CASH'
  | 'POS_COUNT_REQUIRED'
  | 'POS_COUNT_NEGATIVE'
  | 'POS_VARIANCE_REASON_REQUIRED'
  | 'POS_MOVEMENT_REASON_REQUIRED'
  | 'POS_FORCE_CLOSE_FORBIDDEN'

/**
 * Whether an order may be taken.
 *
 * The payments must COVER the total. Under-payment is not a partial sale at a
 * till — it is a sale on credit, and that is a `credit` payment method with a
 * receivable behind it, not a shortfall the drawer absorbs.
 */
export function validateOrder(
  session: PosSession,
  order: { totalMinor: number; payments: PosPayment[]; changeMinor: number },
): PosRuleCode[] {
  const problems: PosRuleCode[] = []

  if (session.status !== 'open') problems.push('POS_SESSION_NOT_OPEN')

  if (order.payments.some((payment) => payment.amountMinor < 0)) {
    problems.push('POS_PAYMENT_NEGATIVE')
  }

  const paid = order.payments.reduce((sum, payment) => sum + payment.amountMinor, 0)
  if (paid - order.changeMinor < order.totalMinor) problems.push('POS_PAYMENT_SHORT')

  // Change can only come out of cash that came in. Giving change against a
  // card payment is handing out the drawer's float.
  const cash = order.payments
    .filter((payment) => payment.method === 'cash')
    .reduce((sum, payment) => sum + payment.amountMinor, 0)
  if (order.changeMinor > cash) problems.push('POS_CHANGE_EXCEEDS_CASH')

  return [...new Set(problems)]
}

export function validateMovement(
  session: PosSession,
  movement: { amountMinor: number; reason: string },
): PosRuleCode[] {
  const problems: PosRuleCode[] = []

  if (session.status !== 'open') problems.push('POS_SESSION_NOT_OPEN')

  // Cash leaving a drawer with no stated reason is indistinguishable from
  // cash going missing.
  if (!movement.reason || movement.reason.trim().length === 0) {
    problems.push('POS_MOVEMENT_REASON_REQUIRED')
  }

  if (movement.amountMinor <= 0) problems.push('POS_PAYMENT_NEGATIVE')

  return problems
}

export interface CloseRequest {
  countedCashMinor: number | null
  /** Required once the variance exceeds the tolerance. */
  varianceReason?: string | undefined
  /** Set when an owner is closing somebody else's abandoned session. */
  force?: boolean | undefined
  /** The role of whoever is closing. Force-close is an owner's act. */
  role: 'owner' | 'manager' | 'seller'
}

/**
 * Whether a session may be closed, and whether the variance needs explaining.
 *
 * `toleranceMinor` exists because a real drawer is out by a few units and
 * demanding a written explanation for every one of those trains people to
 * type "ok". Above it, the reason is required — that is where the control has
 * value.
 */
export function validateClose(
  session: PosSession,
  totals: SessionTotals,
  request: CloseRequest,
  toleranceMinor = 100,
): PosRuleCode[] {
  const problems: PosRuleCode[] = []

  if (session.status !== 'open' && session.status !== 'closing') {
    problems.push('POS_SESSION_NOT_OPEN')
  }

  if (request.countedCashMinor === null || request.countedCashMinor === undefined) {
    problems.push('POS_COUNT_REQUIRED')
  } else if (request.countedCashMinor < 0) {
    problems.push('POS_COUNT_NEGATIVE')
  }

  // Force-closing somebody else's session writes off whatever is missing from
  // a drawer the closer never saw. Owner only.
  if (request.force && request.role !== 'owner') problems.push('POS_FORCE_CLOSE_FORBIDDEN')

  if (request.countedCashMinor !== null && request.countedCashMinor !== undefined) {
    const variance = request.countedCashMinor - totals.expectedCashMinor
    if (Math.abs(variance) > toleranceMinor && !request.varianceReason?.trim()) {
      problems.push('POS_VARIANCE_REASON_REQUIRED')
    }
  }

  return [...new Set(problems)]
}

// ─── Abandoned sessions ──────────────────────────────────────────────────────

export interface AbandonedSession {
  sessionId: string
  openedBy: string
  openedAt: string
  hoursOpen: number
  /** What the orders say should be in a drawer nobody can reach. */
  expectedCashMinor: number
  orderCount: number
}

/**
 * Sessions that have been open too long to be in use.
 *
 * A till session is a shift. One open for two days is a device that went away
 * — a phone that broke, an employee who left — and the cash it holds is
 * unaccounted until somebody says otherwise.
 *
 * Surfaced rather than auto-closed: closing it decides where the money went,
 * and that is a person's call.
 */
export function findAbandoned(
  sessions: Array<{
    session: PosSession
    orders: PosOrder[]
    movements: CashMovement[]
  }>,
  asOf: string,
  staleAfterHours = 24,
): AbandonedSession[] {
  const now = Date.parse(asOf)

  return sessions
    .filter((entry) => entry.session.status === 'open')
    .map((entry) => ({
      sessionId: entry.session.id,
      openedBy: entry.session.openedBy,
      openedAt: entry.session.openedAt,
      hoursOpen: (now - Date.parse(entry.session.openedAt)) / 3_600_000,
      expectedCashMinor: expectedCashMinor(entry.session, entry.orders, entry.movements),
      orderCount: entry.orders.filter((order) => order.status === 'completed').length,
    }))
    .filter((entry) => entry.hoursOpen >= staleAfterHours)
    .sort((a, b) => b.hoursOpen - a.hoursOpen)
}

// ─── Posting ─────────────────────────────────────────────────────────────────

export interface SessionPosting {
  /** Idempotency key. A retried close must not post the session twice. */
  sourceId: string
  /** Debit cash for what was actually counted, not what was expected. */
  cashMinor: number
  cardMinor: number
  transferMinor: number
  /** Sales made on credit become receivables, not cash. */
  creditMinor: number
  /**
   * The variance, signed. Posted to a NAMED over/short account with the
   * session id on it — never netted into sales, where it would quietly change
   * the reported revenue of a day nobody would think to question.
   */
  varianceMinor: number
  revenueMinor: number
}

/**
 * What a closed session posts to the ledger.
 *
 * Cash is debited at the COUNTED figure, because that is what the business
 * actually has. The difference between counted and expected is the variance,
 * and it goes to its own account so a run of small shortages is visible as a
 * pattern rather than dissolved into a month of sales.
 */
export function buildPosting(session: PosSession, totals: SessionTotals): SessionPosting {
  const counted = totals.countedCashMinor ?? totals.expectedCashMinor

  return {
    sourceId: session.id,
    // Net of the float, which was already the business's money and is not
    // revenue arriving today.
    cashMinor: counted - session.openingFloatMinor,
    cardMinor: totals.byMethod.card,
    transferMinor: totals.byMethod.transfer,
    creditMinor: totals.byMethod.credit,
    varianceMinor: totals.varianceMinor ?? 0,
    revenueMinor: totals.grossSalesMinor,
  }
}
