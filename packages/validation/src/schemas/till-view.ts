// ============================================
// packages/validation/src/schemas/till-view.ts
//
// The till as the screens read it — one rule, two runtimes. The server
// (`PosService`, rows from Postgres) and the device (the local engine's
// `routes/till.ts`, rows from SQLite) hand their rows to these functions.
// Neither re-derives how a stored row becomes a session, an order or a
// movement; which ledger lines a closed session books; what is frozen at the
// close; or how a day's cash flow is assembled.
//
// The arithmetic itself is `pos.domain` (summarise, validateOrder, …).
// ============================================

import type { AccountRole } from './accounting.schema'
import {
  dailyCashFlow,
  paymentMargin,
  type CashEvent,
  type CashMovement,
  type CashSettlement,
  type DrawerEntry,
  type PosOrder,
  type PosPaymentMethod,
  type PosSession,
  type SessionPosting,
  type SessionTotals,
} from './pos.domain'
import { majorToTillMinor, tillMinorToMajor } from './payments.domain'

type Raw = Record<string, unknown>

// ─── Rows → domain ───────────────────────────────────────────────────────────

export function toPosOrder(raw: Raw): PosOrder {
  const payments = (raw.payments ?? []) as Array<{ method: unknown; amount_minor: unknown }>
  return {
    id: String(raw.id),
    orderRef: String(raw.order_ref),
    totalMinor: Number(raw.total_minor) || 0,
    changeMinor: Number(raw.change_minor) || 0,
    status: raw.status as PosOrder['status'],
    createdAt: String(raw.created_at),
    payments: payments.map((payment) => ({
      method: payment.method as PosPaymentMethod,
      amountMinor: Number(payment.amount_minor) || 0,
    })),
  }
}

export function toCashMovement(raw: Raw): CashMovement {
  return {
    id: String(raw.id),
    kind: raw.kind as CashMovement['kind'],
    amountMinor: Number(raw.amount_minor) || 0,
    reason: String(raw.reason),
    createdAt: String(raw.created_at),
  }
}

export function toPosSession(raw: Raw, defaultCurrency?: string): PosSession {
  return {
    id: String(raw.id),
    currency: (raw.currency as string | null | undefined) ?? defaultCurrency ?? undefined,
    label: (raw.label as string | null | undefined) ?? undefined,
    status: raw.status as PosSession['status'],
    openingFloatMinor: Number(raw.opening_float_minor) || 0,
    openedAt: String(raw.opened_at),
    openedBy: String(raw.opened_by),
    closedAt: (raw.closed_at as string | null | undefined) ?? null,
    closedBy: (raw.closed_by as string | null | undefined) ?? null,
    countedCashMinor: raw.counted_cash_minor == null ? null : Number(raw.counted_cash_minor),
  }
}

/** A posted payment that went through this drawer (`till_amount_minor` is in the till's own units). */
export function toCashSettlement(raw: Raw): CashSettlement {
  return {
    id: String(raw.id),
    paymentNumber: String(raw.payment_number ?? ''),
    direction: raw.direction === 'out' ? 'out' : 'in',
    amountMinor: Number(raw.till_amount_minor) || 0,
    createdAt: String(raw.created_at),
  }
}

export interface ShiftHistoryRow {
  id: string
  status: string
  openedAt: string | null
  closedAt: string | null
  openedBy: string | null
  closedBy: string | null
  openingFloatMinor: number
  cashSalesMinor: number | null
  cashInMinor: number | null
  cashOutMinor: number | null
  expectedCashMinor: number | null
  countedCashMinor: number | null
  varianceMinor: number | null
  varianceReason: string | null
  wasForced: boolean
  /** False for a shift closed before the handover was frozen. */
  handoverFrozen: boolean
}

/**
 * A past shift, with the handover it was signed off against.
 *
 * ⚠️ THE FROZEN FIGURES ARE RETURNED AS STORED, NOT RECOMPUTED — recomputing
 * would let a later void change a handover somebody already signed.
 */
export function toShiftHistoryRow(raw: Raw): ShiftHistoryRow {
  const num = (value: unknown) => (value === null || value === undefined ? null : Number(value))
  return {
    id: String(raw.id),
    status: String(raw.status),
    openedAt: (raw.opened_at as string | null | undefined) ?? null,
    closedAt: (raw.closed_at as string | null | undefined) ?? null,
    openedBy: (raw.opened_by as string | null | undefined) ?? null,
    closedBy: (raw.closed_by as string | null | undefined) ?? null,
    openingFloatMinor: Number(raw.opening_float_minor) || 0,
    cashSalesMinor: num(raw.cash_sales_minor),
    cashInMinor: num(raw.cash_in_minor),
    cashOutMinor: num(raw.cash_out_minor),
    expectedCashMinor: num(raw.expected_cash_minor),
    countedCashMinor: num(raw.counted_cash_minor),
    varianceMinor: num(raw.variance_minor),
    varianceReason: (raw.variance_reason as string | null | undefined) ?? null,
    wasForced: raw.was_forced === true || raw.was_forced === 1,
    handoverFrozen: raw.expected_cash_minor !== null && raw.expected_cash_minor !== undefined,
  }
}

/**
 * The columns a close writes (M3 — FREEZE THE HANDOVER): the figures are stored
 * as of the moment of the count, so a later void cannot move a signed handover.
 */
export function closeColumns(input: {
  finalTotals: SessionTotals
  countedCashMinor: number
  varianceReason?: string | undefined
  force?: boolean | undefined
  closedAt: string
  closedBy: string
}) {
  const { finalTotals } = input
  return {
    status: input.force ? 'force_closed' : 'closed',
    counted_cash_minor: input.countedCashMinor,
    variance_reason: input.varianceReason ?? null,
    closed_at: input.closedAt,
    closed_by: input.closedBy,
    was_forced: input.force === true,
    expected_cash_minor: finalTotals.expectedCashMinor,
    cash_sales_minor: finalTotals.byMethod.cash ?? 0,
    // Split by sign rather than one net figure: «took 500 out and put 500 in»
    // and «nothing happened» are different shifts.
    cash_in_minor: Math.max(0, finalTotals.movementsMinor),
    cash_out_minor: Math.max(0, -finalTotals.movementsMinor),
    variance_minor: finalTotals.varianceMinor,
  }
}

// ─── What the ledger books ───────────────────────────────────────────────────

export interface LedgerDraftLine {
  accountId: string
  debit: number
  credit: number
}

export const SESSION_POSTING_ROLES: AccountRole[] = [
  'cash',
  'sales',
  'receivable',
  'bank',
  'purchase',
]

/**
 * The lines a closed session books. Cash is debited at what was COUNTED; the
 * variance and the drawer's movements are separate lines, never netted into
 * sales. A role is only REQUIRED when there is money that needs it.
 */
export function sessionPostingLines(input: {
  posting: SessionPosting
  tillCurrency: string
  accounts: Partial<Record<AccountRole, string>>
  missing: readonly AccountRole[]
}): { required: AccountRole[] } | { lines: LedgerDraftLine[] } {
  const { posting, accounts } = input
  const major = (amountMinor: number) => tillMinorToMajor(amountMinor, input.tillCurrency)
  const cardAndTransferMinor = posting.cardMinor + posting.transferMinor

  const required = input.missing.filter((role) => {
    if (role === 'bank') return cardAndTransferMinor !== 0
    if (role === 'purchase') return posting.movementsMinor !== 0
    return true
  })
  if (required.length > 0) return { required }

  const lines: LedgerDraftLine[] = [
    { accountId: accounts.cash!, debit: major(posting.cashMinor), credit: 0 },
    { accountId: accounts.sales!, debit: 0, credit: major(posting.revenueMinor) },
  ]
  // Card and transfer takings: money the shop has, but not in the drawer.
  if (cardAndTransferMinor > 0) {
    lines.push({ accountId: accounts.bank!, debit: major(cardAndTransferMinor), credit: 0 })
  }
  if (posting.creditMinor > 0) {
    lines.push({ accountId: accounts.receivable!, debit: major(posting.creditMinor), credit: 0 })
  }
  // Cash put in or taken out: a payment (purchases), cash is already reduced by the count.
  if (posting.movementsMinor !== 0) {
    const amount = major(Math.abs(posting.movementsMinor))
    lines.push(
      posting.movementsMinor < 0
        ? { accountId: accounts.purchase!, debit: amount, credit: 0 }
        : { accountId: accounts.purchase!, debit: 0, credit: amount },
    )
  }
  // The variance balances the entry, on its own line.
  if (posting.varianceMinor !== 0) {
    const amount = major(Math.abs(posting.varianceMinor))
    lines.push(
      posting.varianceMinor < 0
        ? { accountId: accounts.sales!, debit: amount, credit: 0 }
        : { accountId: accounts.sales!, debit: 0, credit: amount },
    )
  }
  return { lines }
}

/** Dr bank / Cr cash (to the bank) or the reverse. */
export function transferLines(
  direction: 'to_bank' | 'from_bank',
  accounts: { cash: string; bank: string },
  amount: number,
): LedgerDraftLine[] {
  return direction === 'to_bank'
    ? [
        { accountId: accounts.bank, debit: amount, credit: 0 },
        { accountId: accounts.cash, debit: 0, credit: amount },
      ]
    : [
        { accountId: accounts.cash, debit: amount, credit: 0 },
        { accountId: accounts.bank, debit: 0, credit: amount },
      ]
}

/** Dr cash (in a till) or bank / Cr owner's capital. */
export function openingCapitalLines(
  assetAccount: string,
  capitalAccount: string,
  amount: number,
): LedgerDraftLine[] {
  return [
    { accountId: assetAccount, debit: amount, credit: 0 },
    { accountId: capitalAccount, debit: 0, credit: amount },
  ]
}

export const TILL_TRANSFER_DESCRIPTION = {
  to_bank: 'انتقال نقد صندوق به بانک',
  from_bank: 'برداشت از بانک به صندوق',
} as const

export const OPENING_CAPITAL_REASON = 'سرمایه‌ی افتتاحیه'

// ─── The drawer's ledger and the cash-flow chart ─────────────────────────────

/** Profit % of each cash receipt, from the accounting core's invoice margins. */
export function attachDrawerMargins(
  drawer: { entries: DrawerEntry[]; expectedCashMinor: number },
  invoicesByPayment: ReadonlyMap<string, string[]>,
  margins: Map<string, { revenue: number; cost: number; costMissing: boolean }>,
) {
  return {
    ...drawer,
    entries: drawer.entries.map((entry) =>
      entry.kind === 'settlement_in' && entry.sourceId
        ? {
            ...entry,
            marginPercent: invoicesByPayment.has(entry.sourceId)
              ? paymentMargin(invoicesByPayment.get(entry.sourceId) ?? [], margins)
              : null,
          }
        : entry,
    ),
  }
}

/** The instant a cash-flow window of `days` local days starts. */
export function cashFlowSince(days: number, offsetMinutes: number, now = Date.now()): string {
  const today = new Date(now + offsetMinutes * 60_000).toISOString().slice(0, 10)
  return new Date(
    Date.parse(`${today}T00:00:00Z`) - (days - 1) * 86_400_000 - offsetMinutes * 60_000,
  ).toISOString()
}

/**
 * Cash in and out of the business's drawers per local day: posted CASH invoice
 * payments, till cash movements, and the cash portion of completed till orders
 * (net of change). Card and transfer never touched a drawer.
 */
export function buildCashFlowView(input: {
  payments: ReadonlyArray<Raw>
  movements: ReadonlyArray<Raw>
  orders: ReadonlyArray<Raw>
  sessionCurrencies: ReadonlyMap<string, string>
  booksCurrency: string
  targetCurrency: string
  days: number
  offsetMinutes: number
  now?: number
}) {
  const { booksCurrency, targetCurrency } = input
  const now = (input.now ?? Date.now()) + input.offsetMinutes * 60_000
  const today = new Date(now).toISOString().slice(0, 10)
  const sessionCurrency = (id: unknown) => input.sessionCurrencies.get(String(id)) ?? booksCurrency

  const events: CashEvent[] = [
    ...input.payments
      .filter((p) => ((p.currency as string | null) ?? booksCurrency) === targetCurrency)
      .map((p) => ({
        at: String(p.created_at),
        amountMinor:
          (p.direction === 'out' ? -1 : 1) *
          majorToTillMinor(Number(p.amount) || 0, (p.currency as string | null) ?? booksCurrency),
      })),
    ...input.movements
      .filter((m) => sessionCurrency(m.session_id) === targetCurrency)
      .map((m) => ({
        at: String(m.created_at),
        amountMinor: (m.kind === 'cash_out' ? -1 : 1) * (Number(m.amount_minor) || 0),
      })),
    ...input.orders
      .filter((o) => sessionCurrency(o.session_id) === targetCurrency)
      .map((o) => ({
        at: String(o.created_at),
        amountMinor:
          ((o.payments ?? []) as Array<{ method: string; amount_minor: number }>)
            .filter((p) => p.method === 'cash')
            .reduce((sum, p) => sum + (Number(p.amount_minor) || 0), 0) -
          (Number(o.change_minor) || 0),
      })),
  ]

  return {
    days: dailyCashFlow(events, input.days, today, input.offsetMinutes),
    today,
    currency: targetCurrency,
  }
}
