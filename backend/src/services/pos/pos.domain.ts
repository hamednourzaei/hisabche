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
  /** Money taken out mid-session (paying a delivery). */
  | 'cash_out'
  /**
   * Cash deposited in the bank / withdrawn from it. Posted to the ledger when
   * it happens (Dr bank / Cr cash), so it is in expected cash but NOT in the
   * close posting — booking it again there would count it twice.
   */
  | 'transfer_to_bank'
  | 'transfer_from_bank'

export interface CashMovement {
  id: string
  kind: CashMovementKind
  amountMinor: number
  /** Never optional. Cash leaving a drawer with no stated reason is a hole. */
  reason: string
  createdAt: string
}

/**
 * Cash that changed hands at this drawer through an INVOICE payment — the
 * «ثبت دریافت» on an invoice, or a supplier paid in cash — recorded by the
 * cashier while their session was open.
 *
 * The payment is the settlement and already has its own ledger entry. The
 * drawer only needs to KNOW the cash is in it: without this, every invoice
 * paid in cash made the close read as «over» by exactly that amount, and the
 * cashier was pushed to record it a second time as a cash_in to make the
 * count agree — the duplicate entry this model exists to prevent.
 */
export interface CashSettlement {
  id: string
  paymentNumber: string
  /** 'in' = money received into the drawer, 'out' = paid out of it. */
  direction: 'in' | 'out'
  amountMinor: number
  createdAt: string
}

export function settlementsNetMinor(settlements: CashSettlement[]): number {
  return settlements.reduce(
    (sum, s) => (s.direction === 'in' ? sum + s.amountMinor : sum - s.amountMinor),
    0,
  )
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

/** Ordinary cash in / out — what the session close posts. Transfers excluded. */
export function movementsNetMinor(movements: CashMovement[]): number {
  return movements.reduce((sum, movement) => {
    if (movement.kind === 'cash_in') return sum + movement.amountMinor
    if (movement.kind === 'cash_out') return sum - movement.amountMinor
    return sum
  }, 0)
}

/** Till ↔ bank transfers, signed. Already posted when they happened. */
export function transfersNetMinor(movements: CashMovement[]): number {
  return movements.reduce((sum, movement) => {
    if (movement.kind === 'transfer_from_bank') return sum + movement.amountMinor
    if (movement.kind === 'transfer_to_bank') return sum - movement.amountMinor
    return sum
  }, 0)
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
  settlements: CashSettlement[] = [],
): number {
  return (
    session.openingFloatMinor +
    cashTakenMinor(orders) +
    movementsNetMinor(movements) +
    transfersNetMinor(movements) +
    settlementsNetMinor(settlements)
  )
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
  /**
   * Net of cash put in and taken out during the session, signed.
   *
   * Money a seller takes out for a delivery fare has LEFT the drawer, so the
   * count is legitimately lower by that amount. It is not a shortage and it is
   * not revenue — it is a payment, and the ledger has to say so or the entry
   * does not balance.
   */
  movementsMinor: number
  /**
   * Net cash from invoice payments at this drawer, signed. Part of expected
   * cash; NOT posted again at close (the payment already posted itself).
   */
  settlementsMinor: number
  /** Till ↔ bank transfers, signed. In expected cash; posted separately. */
  transfersMinor: number
}

export function summarise(
  session: PosSession,
  orders: PosOrder[],
  movements: CashMovement[],
  settlements: CashSettlement[] = [],
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

  const expected = expectedCashMinor(session, orders, movements, settlements)
  const counted = session.countedCashMinor ?? null

  return {
    orderCount: completed.length,
    voidedCount: orders.length - completed.length,
    movementsMinor: movementsNetMinor(movements),
    settlementsMinor: settlementsNetMinor(settlements),
    transfersMinor: transfersNetMinor(movements),
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
    settlements?: CashSettlement[] | undefined
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
      expectedCashMinor: expectedCashMinor(
        entry.session,
        entry.orders,
        entry.movements,
        entry.settlements ?? [],
      ),
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
  /**
   * Net cash movements, signed. Negative means money left the drawer.
   *
   * This was MISSING, and its absence produced an unbalanced entry on any day
   * a seller took money out: the counted cash was lower by the withdrawal, the
   * debits were short by exactly that, and the ledger refused the posting —
   * so the day never booked and the cashier saw a generic failure.
   */
  movementsMinor: number
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
    //
    // Invoice settlements are subtracted too: each payment already debited
    // cash in its own entry, and debiting it again here would book the same
    // money twice. `?? 0` for totals frozen before settlements existed.
    // Transfers likewise: each one already moved cash in its own entry.
    cashMinor:
      counted -
      session.openingFloatMinor -
      (totals.settlementsMinor ?? 0) -
      (totals.transfersMinor ?? 0),
    cardMinor: totals.byMethod.card,
    transferMinor: totals.byMethod.transfer,
    creditMinor: totals.byMethod.credit,
    varianceMinor: totals.varianceMinor ?? 0,
    revenueMinor: totals.grossSalesMinor,
    movementsMinor: totals.movementsMinor,
  }
}

// ─── The drawer as a ledger ──────────────────────────────────────────────────

export type DrawerEntryKind =
  | 'opening_float'
  | 'sale'
  | 'cash_in'
  | 'cash_out'
  | 'transfer_to_bank'
  | 'transfer_from_bank'
  | 'settlement_in'
  | 'settlement_out'

export interface DrawerEntry {
  kind: DrawerEntryKind
  /** Signed minor units: positive into the drawer, negative out of it. */
  amountMinor: number
  /** Running expected balance after this entry. */
  balanceMinor: number
  at: string
  /** pos order ref, movement reason, or payment number — never blank context. */
  reference: string
  /** For settlements: the payment id, so the UI can link to the document. */
  sourceId: string | null
}

/**
 * Every cash event, oldest first, with a running balance. The last balance is
 * exactly `expectedCashMinor` — the invariant the tests hold it to.
 */
export function buildDrawerLedger(
  session: PosSession,
  orders: PosOrder[],
  movements: CashMovement[],
  settlements: CashSettlement[],
): { entries: DrawerEntry[]; expectedCashMinor: number } {
  const events: Array<Omit<DrawerEntry, 'balanceMinor'>> = [
    ...orders
      .filter((order) => order.status === 'completed')
      .map((order) => ({
        kind: 'sale' as const,
        amountMinor:
          order.payments.filter((p) => p.method === 'cash').reduce((s, p) => s + p.amountMinor, 0) -
          order.changeMinor,
        at: order.createdAt,
        reference: order.orderRef,
        sourceId: order.id,
      }))
      .filter((event) => event.amountMinor !== 0),
    ...movements.map((m) => ({
      kind: m.kind,
      amountMinor:
        m.kind === 'cash_in' || m.kind === 'transfer_from_bank' ? m.amountMinor : -m.amountMinor,
      at: m.createdAt,
      reference: m.reason,
      sourceId: m.id,
    })),
    ...settlements.map((s) => ({
      kind: s.direction === 'in' ? ('settlement_in' as const) : ('settlement_out' as const),
      amountMinor: s.direction === 'in' ? s.amountMinor : -s.amountMinor,
      at: s.createdAt,
      reference: s.paymentNumber,
      sourceId: s.id,
    })),
  ].sort((a, b) => a.at.localeCompare(b.at))

  let balance = session.openingFloatMinor
  const entries: DrawerEntry[] = [
    {
      kind: 'opening_float',
      amountMinor: session.openingFloatMinor,
      balanceMinor: balance,
      at: session.openedAt,
      reference: '',
      sourceId: null,
    },
  ]
  for (const event of events) {
    balance += event.amountMinor
    entries.push({ ...event, balanceMinor: balance })
  }

  return { entries, expectedCashMinor: balance }
}

// ─── Cash flow by day ────────────────────────────────────────────────────────

export interface CashEvent {
  /** ISO timestamp. */
  at: string
  /** Signed minor units: positive in, negative out. */
  amountMinor: number
}

export interface CashFlowDay {
  /** Local calendar day, YYYY-MM-DD. */
  day: string
  inMinor: number
  outMinor: number
  netMinor: number
}

/**
 * Daily in/out/net over the last `days` local days ending `today`.
 *
 * Every day in the window is present — a day with no cash is a real zero,
 * not a gap the chart must interpolate. `offsetMinutes` is the shop's UTC
 * offset (Kabul +270), so 23:00 local does not land on tomorrow.
 */
export function dailyCashFlow(
  events: CashEvent[],
  days: number,
  today: string,
  offsetMinutes: number,
): CashFlowDay[] {
  const out: CashFlowDay[] = []
  const index = new Map<string, CashFlowDay>()
  const end = new Date(`${today}T00:00:00Z`)
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(end)
    d.setUTCDate(d.getUTCDate() - i)
    const row = { day: d.toISOString().slice(0, 10), inMinor: 0, outMinor: 0, netMinor: 0 }
    out.push(row)
    index.set(row.day, row)
  }
  for (const event of events) {
    const local = new Date(Date.parse(event.at) + offsetMinutes * 60_000).toISOString().slice(0, 10)
    const row = index.get(local)
    if (!row) continue
    if (event.amountMinor >= 0) row.inMinor += event.amountMinor
    else row.outMinor -= event.amountMinor
    row.netMinor += event.amountMinor
  }
  return out
}
