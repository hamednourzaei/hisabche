// ============================================
// backend/src/services/payments/payments.domain.ts
//
// What a payment settles, what is still owed, and how overdue it is — as pure
// functions.
//
// The rule that shapes all of it: an invoice's outstanding balance is
// `total − everything allocated to it`. It is DERIVED. The stored
// `paid_amount` is a cache that any PATCH on the invoice could overwrite, and
// a debt figure anyone can overwrite is not a debt figure.
// ============================================

import { minor, round2 } from '../../utils/money'

/**
 * Both helpers moved to `utils/money` in Phase 0 — one implementation, guarded
 * by `money-primitive-guard.test.ts`. Re-exported because `services/payments`
 * is the module other services import them from, and `supplier.service` among
 * them.
 */
export { round2, minor }

export type PaymentDirection = 'in' | 'out'
export type PartyType = 'customer' | 'supplier'

export interface OpenInvoice {
  invoiceId: string
  invoiceNumber: string
  total: number
  allocated: number
  /** The day the money is due. Falls back to the invoice date when unset. */
  dueDate: string
  invoiceDate: string
  /** The invoice's own currency; null/absent = the books currency. */
  currency?: string | null | undefined
}

/**
 * Whether a payment in `paymentCurrency` may settle this invoice.
 *
 * 100 afghani paid does not reduce a debt of 100 dollars. An invoice with no
 * currency of its own is in the books currency.
 */
export function settlesInCurrency(
  invoice: Pick<OpenInvoice, 'currency'>,
  paymentCurrency: string,
  bookCurrency: string,
): boolean {
  return (invoice.currency || bookCurrency) === paymentCurrency
}

export interface AllocationRequest {
  invoiceId: string
  amount: number
}

export function outstandingOf(invoice: OpenInvoice): number {
  return round2(invoice.total - invoice.allocated)
}

/** Only invoices with something left to pay, oldest due date first. */
export function openInvoices(invoices: OpenInvoice[]): OpenInvoice[] {
  return invoices
    .filter((invoice) => minor(outstandingOf(invoice)) > 0)
    .sort((a, b) => {
      const left = a.dueDate || a.invoiceDate
      const right = b.dueDate || b.invoiceDate
      return left < right ? -1 : left > right ? 1 : 0
    })
}

export type AllocationRuleCode =
  | 'PAYMENT_AMOUNT_INVALID'
  | 'PAYMENT_OVER_ALLOCATED'
  | 'PAYMENT_ALLOCATION_EXCEEDS_OUTSTANDING'
  | 'PAYMENT_ALLOCATION_INVOICE_UNKNOWN'
  | 'PAYMENT_ALLOCATION_AMOUNT_INVALID'
  | 'PAYMENT_ALLOCATION_DUPLICATE'

/**
 * Every reason this payment may not be recorded as asked.
 *
 * Under-allocating is deliberately NOT one of them: a customer who pays more
 * than they owe has made an advance, and the remainder stays on the payment
 * rather than being refused or quietly dropped.
 */
export function validateAllocations(
  amount: number,
  allocations: AllocationRequest[],
  invoices: OpenInvoice[],
): AllocationRuleCode[] {
  const problems: AllocationRuleCode[] = []

  if (!Number.isFinite(amount) || minor(amount) <= 0) {
    problems.push('PAYMENT_AMOUNT_INVALID')
  }

  const byId = new Map(invoices.map((i) => [i.invoiceId, i]))
  const seen = new Set<string>()
  let total = 0

  for (const allocation of allocations) {
    if (!Number.isFinite(allocation.amount) || minor(allocation.amount) <= 0) {
      problems.push('PAYMENT_ALLOCATION_AMOUNT_INVALID')
      continue
    }

    if (seen.has(allocation.invoiceId)) {
      // Two rows against one invoice would each be checked against the same
      // outstanding balance and together exceed it.
      problems.push('PAYMENT_ALLOCATION_DUPLICATE')
      continue
    }
    seen.add(allocation.invoiceId)

    const invoice = byId.get(allocation.invoiceId)
    if (!invoice) {
      problems.push('PAYMENT_ALLOCATION_INVOICE_UNKNOWN')
      continue
    }

    if (minor(allocation.amount) > minor(outstandingOf(invoice))) {
      problems.push('PAYMENT_ALLOCATION_EXCEEDS_OUTSTANDING')
    }

    total += minor(allocation.amount)
  }

  if (total > minor(amount)) problems.push('PAYMENT_OVER_ALLOCATED')

  return [...new Set(problems)]
}

export interface AutoAllocation {
  allocations: AllocationRequest[]
  /** What is left over — an advance, not an error. */
  unallocated: number
}

/**
 * Spread a payment over the open invoices, oldest due first.
 *
 * This is what a shopkeeper means by "he paid me 500": settle the oldest
 * unpaid bills until the money runs out. The remainder stays on the payment
 * and can be applied to whatever they buy next.
 */
export function autoAllocate(amount: number, invoices: OpenInvoice[]): AutoAllocation {
  let remaining = minor(amount)
  const allocations: AllocationRequest[] = []

  for (const invoice of openInvoices(invoices)) {
    if (remaining <= 0) break

    const take = Math.min(remaining, minor(outstandingOf(invoice)))
    if (take <= 0) continue

    allocations.push({ invoiceId: invoice.invoiceId, amount: take / 100 })
    remaining -= take
  }

  return { allocations, unallocated: round2(remaining / 100) }
}

/** How much of a payment has not been applied to anything. */
export function unallocatedOf(amount: number, allocations: AllocationRequest[]): number {
  const used = allocations.reduce((sum, a) => sum + minor(a.amount), 0)
  return round2((minor(amount) - used) / 100)
}

// ─── Aging ───────────────────────────────────────────────────────────────────

export interface AgingBuckets {
  current: number
  days1to30: number
  days31to60: number
  days61to90: number
  over90: number
  total: number
}

export function emptyAging(): AgingBuckets {
  return { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, over90: 0, total: 0 }
}

/** Whole days between two dates, ignoring the time of day entirely. */
export function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${String(from).slice(0, 10)}T00:00:00Z`)
  const end = Date.parse(`${String(to).slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(start) || Number.isNaN(end)) return 0
  return Math.round((end - start) / 86_400_000)
}

/**
 * How overdue each unpaid amount is, as of `asOf`.
 *
 * Measured from the DUE date, falling back to the invoice date when a business
 * does not set due dates — measuring from the invoice date when a due date
 * exists would report a bill inside its payment terms as overdue.
 */
export function ageInvoices(invoices: OpenInvoice[], asOf: string): AgingBuckets {
  const buckets = emptyAging()

  for (const invoice of openInvoices(invoices)) {
    const outstanding = outstandingOf(invoice)
    const overdueBy = daysBetween(invoice.dueDate || invoice.invoiceDate, asOf)

    if (overdueBy <= 0) buckets.current += outstanding
    else if (overdueBy <= 30) buckets.days1to30 += outstanding
    else if (overdueBy <= 60) buckets.days31to60 += outstanding
    else if (overdueBy <= 90) buckets.days61to90 += outstanding
    else buckets.over90 += outstanding

    buckets.total += outstanding
  }

  return {
    current: round2(buckets.current),
    days1to30: round2(buckets.days1to30),
    days31to60: round2(buckets.days31to60),
    days61to90: round2(buckets.days61to90),
    over90: round2(buckets.over90),
    total: round2(buckets.total),
  }
}

// ─── Party ledger ────────────────────────────────────────────────────────────

export interface LedgerMovement {
  date: string
  kind: 'sale' | 'purchase' | 'payment_in' | 'payment_out' | 'return'
  amount: number
  reference: string
  /** The currency of the amount. Absent = the currency the books are kept in. */
  currency?: string | undefined
}

/**
 * A party's running balance. Positive means they owe us.
 *
 * ⚠️ ONE CURRENCY AT A TIME. This adds amounts; it does not know what they
 * are amounts OF. Handed a 100-dollar sale and a 10,000-afghani sale it
 * answers 10,100, which is a number of nothing. Every caller that may hold
 * more than one currency goes through `partyBalancesByCurrency`, which calls
 * this once per currency.
 *
 * The signs are the whole point. The balance this replaces ADDED receipts to
 * the customer's debt: taking money from a customer made them owe more. A
 * receipt is money arriving — it can only reduce what they owe.
 */
export function partyBalance(movements: LedgerMovement[]): number {
  let balance = 0

  for (const movement of movements) {
    switch (movement.kind) {
      case 'sale':
        balance += movement.amount // we billed them
        break
      case 'payment_in':
      case 'return':
        balance -= movement.amount // they paid, or we credited them
        break
      case 'purchase':
        balance -= movement.amount // we owe them
        break
      case 'payment_out':
        balance += movement.amount // we settled what we owed
        break
    }
  }

  return round2(balance)
}

export interface CurrencyBalance {
  currency: string
  /** Positive: they owe us, in THIS currency. */
  balance: number
}

/**
 * What a party owes, currency by currency — never one figure across them.
 *
 * A movement that names no currency is in the books currency, and so is the
 * opening balance. The books currency is always first and always present
 * (a zero there is an answer); any other currency appears when the party has
 * a movement in it.
 */
export function partyBalancesByCurrency(
  movements: LedgerMovement[],
  bookCurrency: string,
  openingBalance = 0,
): CurrencyBalance[] {
  const groups = new Map<string, LedgerMovement[]>([[bookCurrency, []]])
  for (const movement of movements) {
    const currency = movement.currency || bookCurrency
    const rows = groups.get(currency)
    if (rows) rows.push(movement)
    else groups.set(currency, [movement])
  }

  return [...groups.entries()]
    .map(([currency, rows]) => ({
      currency,
      balance: round2(partyBalance(rows) + (currency === bookCurrency ? openingBalance : 0)),
    }))
    .sort((a, b) =>
      a.currency === bookCurrency
        ? -1
        : b.currency === bookCurrency
          ? 1
          : a.currency < b.currency
            ? -1
            : 1,
    )
}

/**
 * The ledger with a running balance on each row, oldest first.
 *
 * The balance on a row runs over the rows of ITS OWN currency: a dollar
 * payment moves the dollar balance and leaves the afghani one where it was.
 */
export function runningLedger(movements: LedgerMovement[]) {
  const ordered = [...movements].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  const running = new Map<string, number>()

  return ordered.map((movement) => {
    const key = movement.currency ?? ''
    const balance = partyBalance([{ ...movement }]) + (running.get(key) ?? 0)
    running.set(key, balance)
    return { ...movement, balance: round2(balance) }
  })
}

// ─── Party summary (Customer 360) ────────────────────────────────────────────

export interface SummaryInvoice {
  id: string
  type: 'sale' | 'purchase'
  status: string
  total: number
  /** Projection of SUM(payment_allocations) — kept by the settlement trigger. */
  paidAmount: number
  invoiceDate: string
  dueDate: string
  currency: string
}

export interface SummaryPayment {
  direction: PaymentDirection
  amount: number
  entryDate: string
  currency: string
}

export interface PartySummary {
  asOf: string
  totalSales: number
  totalPurchases: number
  totalReceived: number
  totalPaid: number
  /**
   * Balance carried in when the customer was created (customers.opening_balance;
   * positive: they owe us). Part of `receivable` and `netBalance`, shown apart.
   */
  openingBalance: number
  /** What the party still owes us: open sale invoices plus a positive opening balance. */
  receivable: number
  /** What we still owe the party on purchase invoices. */
  payable: number
  /** Positive: they owe us. Same sign convention as `partyBalance`. */
  netBalance: number
  overdue: number
  dueToday: number
  dueLater: number
  aging: AgingBuckets
  invoiceCount: number
  openInvoiceCount: number
  overdueInvoiceCount: number
  lastSaleAt: string | null
  lastPaymentAt: string | null
  /** Every currency seen. More than one means the totals mix currencies. */
  currencies: string[]
}

/**
 * The money picture of one party, from its invoices and posted payments.
 *
 * ⚠️ A CANCELLED INVOICE IS NOT DEBT. It is excluded from every figure here.
 * (`invoice_outstanding` does not filter status, so reading open amounts from
 * it would count a cancelled bill as still owed.)
 *
 * Outstanding comes from `paidAmount`, the trigger-kept projection of the
 * allocations — never from «sales − receipts», which would treat an unapplied
 * advance as settling a specific invoice.
 */
export function summarizeParty(
  invoices: SummaryInvoice[],
  payments: SummaryPayment[],
  asOf: string,
  openingBalance = 0,
): PartySummary {
  const live = invoices.filter((invoice) => invoice.status !== 'cancelled')
  const sales = live.filter((invoice) => invoice.type === 'sale')
  const purchases = live.filter((invoice) => invoice.type === 'purchase')

  const outstanding = (invoice: SummaryInvoice) =>
    Math.max(0, round2(invoice.total - invoice.paidAmount))

  const open = live.filter((invoice) => outstanding(invoice) > 0)
  const openSales = sales.filter((invoice) => outstanding(invoice) > 0)

  let overdue = 0
  let dueToday = 0
  let dueLater = 0
  let overdueInvoiceCount = 0
  for (const invoice of openSales) {
    const due = daysBetween(invoice.dueDate || invoice.invoiceDate, asOf)
    if (due > 0) {
      overdue += outstanding(invoice)
      overdueInvoiceCount++
    } else if (due === 0) dueToday += outstanding(invoice)
    else dueLater += outstanding(invoice)
  }

  const sum = (values: number[]) => round2(values.reduce((acc, value) => acc + value, 0))
  const opening = round2(openingBalance)
  const receivable = sum([...sales.map(outstanding), Math.max(0, opening)])
  const payable = sum([...purchases.map(outstanding), Math.max(0, -opening)])
  const latest = (dates: string[]) => dates.filter(Boolean).sort().at(-1) ?? null

  return {
    asOf,
    totalSales: sum(sales.map((invoice) => invoice.total)),
    totalPurchases: sum(purchases.map((invoice) => invoice.total)),
    totalReceived: sum(payments.filter((p) => p.direction === 'in').map((p) => p.amount)),
    totalPaid: sum(payments.filter((p) => p.direction === 'out').map((p) => p.amount)),
    openingBalance: opening,
    receivable,
    payable,
    netBalance: round2(receivable - payable),
    overdue: round2(overdue),
    dueToday: round2(dueToday),
    dueLater: round2(dueLater),
    aging: ageInvoices(
      openSales.map((invoice) => ({
        invoiceId: invoice.id,
        invoiceNumber: '',
        total: invoice.total,
        allocated: invoice.paidAmount,
        dueDate: invoice.dueDate,
        invoiceDate: invoice.invoiceDate,
      })),
      asOf,
    ),
    invoiceCount: live.length,
    openInvoiceCount: open.length,
    overdueInvoiceCount,
    lastSaleAt: latest(sales.map((invoice) => invoice.invoiceDate)),
    lastPaymentAt: latest(payments.map((payment) => payment.entryDate)),
    currencies: [
      ...new Set(
        [...live.map((i) => i.currency), ...payments.map((p) => p.currency)].filter(Boolean),
      ),
    ].sort(),
  }
}

// ─── Party activity (Customer 360 chart and products) ────────────────────────

export interface MonthlyActivity {
  /** YYYY-MM */
  month: string
  sales: number
  receipts: number
}

/**
 * Sales and receipts per calendar month for the last `months` months up to
 * `asOf`, oldest first, with empty months present (a gap is information).
 * Cancelled invoices are already excluded by the reader.
 */
/**
 * The same summary, once per currency the party has documents in.
 *
 * `summarizeParty` adds every invoice it is given; given two currencies its
 * totals are a sum of unlike things (it says so in `currencies`). This is the
 * figure a screen can actually show: one row per currency, each internally
 * consistent. The opening balance belongs to the books currency.
 */
export function summarizePartyByCurrency(
  invoices: SummaryInvoice[],
  payments: SummaryPayment[],
  asOf: string,
  openingBalance: number,
  bookCurrency: string,
): Array<PartySummary & { currency: string }> {
  const of = (currency: string) => currency || bookCurrency
  const present = new Set<string>([
    bookCurrency,
    ...invoices.map((invoice) => of(invoice.currency)),
    ...payments.map((payment) => of(payment.currency)),
  ])
  return [...present]
    .sort((a, b) => (a === bookCurrency ? -1 : b === bookCurrency ? 1 : a < b ? -1 : 1))
    .map((currency) => ({
      currency,
      ...summarizeParty(
        invoices.filter((invoice) => of(invoice.currency) === currency),
        payments.filter((payment) => of(payment.currency) === currency),
        asOf,
        currency === bookCurrency ? openingBalance : 0,
      ),
    }))
}

export function monthlyActivity(
  invoices: Array<{ type: string; total: number; invoiceDate: string }>,
  payments: Array<{ direction: PaymentDirection; amount: number; entryDate: string }>,
  asOf: string,
  months = 12,
): MonthlyActivity[] {
  const [year, month] = asOf.slice(0, 7).split('-').map(Number) as [number, number]
  const keys: string[] = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(year, month - 1 - i, 1))
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
  }
  const rows = new Map(keys.map((key) => [key, { month: key, sales: 0, receipts: 0 }]))
  for (const invoice of invoices) {
    if (invoice.type !== 'sale') continue
    const row = rows.get(invoice.invoiceDate.slice(0, 7))
    if (row) row.sales = round2(row.sales + invoice.total)
  }
  for (const payment of payments) {
    if (payment.direction !== 'in') continue
    const row = rows.get(payment.entryDate.slice(0, 7))
    if (row) row.receipts = round2(row.receipts + payment.amount)
  }
  return keys.map((key) => rows.get(key)!)
}

export interface PartyProduct {
  productId: string | null
  name: string
  unit: string
  /** Summed only within one unit — pieces and kilos are separate rows. */
  quantity: number
  amount: number
  invoiceCount: number
  lastSoldAt: string
}

/** A party's most-bought products, by amount. Lines are grouped by product and unit. */
export function rankPartyProducts(
  items: Array<{
    invoiceId: string
    productId: string | null
    name: string
    unit: string
    quantity: number
    amount: number
  }>,
  invoiceDates: ReadonlyMap<string, string>,
  limit = 10,
): PartyProduct[] {
  const groups = new Map<string, PartyProduct & { invoices: Set<string> }>()
  for (const item of items) {
    const key = `${item.productId ?? `name:${item.name.trim().toLowerCase()}`}|${item.unit}`
    const date = invoiceDates.get(item.invoiceId) ?? ''
    const group = groups.get(key) ?? {
      productId: item.productId,
      name: item.name,
      unit: item.unit,
      quantity: 0,
      amount: 0,
      invoiceCount: 0,
      lastSoldAt: '',
      invoices: new Set<string>(),
    }
    group.quantity = Math.round((group.quantity + item.quantity) * 1000) / 1000
    group.amount = round2(group.amount + item.amount)
    group.invoices.add(item.invoiceId)
    if (date > group.lastSoldAt) group.lastSoldAt = date
    groups.set(key, group)
  }
  return [...groups.values()]
    .map(({ invoices, ...rest }) => ({ ...rest, invoiceCount: invoices.size }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit)
}

// ─── The till a cash payment names ─────────────────────────────────────────

/**
 * What a payment moves in the till it names, in the TILL's currency (minor
 * units) — or null when this money cannot be counted in that till.
 *
 *   · the till counts in the payment's currency → the amount itself
 *   · the till counts in the books currency and the payment is in another
 *     → the amount at the payment's rate (the rate is required for such a
 *       payment anyway, so the drawer and the ledger say the same figure)
 *   · anything else → null. A toman payment has no place in a dollar till:
 *     there is no rate between two foreign currencies here, and inventing
 *     one would put a made-up figure in a drawer somebody counts.
 */
export function tillAmountMinor(input: {
  amount: number
  currency: string
  tillCurrency: string
  bookCurrency: string
  /** Books currency per one unit of the payment's currency. */
  rate: number
}): number | null {
  if (!(input.amount > 0)) return null
  if (input.tillCurrency === input.currency) return Math.round(input.amount * 100)
  if (input.tillCurrency === input.bookCurrency && input.rate > 0 && Number.isFinite(input.rate)) {
    const minorUnits = Math.round(input.amount * input.rate * 100)
    return minorUnits > 0 ? minorUnits : null
  }
  return null
}

// ─── What a payment puts in the books ──────────────────────────────────────

export interface PaymentPosting {
  /** Books currency: what the cash or bank account moves by. */
  cash: number
  /** Books currency: what the receivable or payable is relieved by. */
  party: number
  /**
   * The exchange difference, in books currency. Positive = a gain, negative =
   * a loss, zero = none. Always: cash, party and this make a balanced entry.
   */
  difference: number
}

/**
 * The three amounts of a payment's journal entry.
 *
 * The money is worth what it was worth the day it MOVED (the payment's rate).
 * The debt it closes was booked the day of the INVOICE (the invoice's rate).
 * When the two rates differ, closing the debt by the cash figure would leave a
 * residue on the receivable or payable for ever; closing it by its own figure
 * leaves a difference, and that difference is a gain or a loss:
 *
 *   money in   more books-currency received than was owed  → gain
 *   money out  less books-currency paid than was owed      → gain
 *
 * A part of the payment that settles no invoice (an advance) has no earlier
 * rate to differ from. An invoice with no rate of its own (rate null: the
 * books currency, or made before rates were kept) is closed at the payment's
 * rate — no rate is guessed for it, so no difference is claimed.
 */
export function paymentPosting(input: {
  direction: PaymentDirection
  amount: number
  paymentRate: number
  allocations: ReadonlyArray<{ amount: number; rate: number | null }>
}): PaymentPosting {
  const cash = round2(input.amount * input.paymentRate)
  let settled = 0
  let allocated = 0
  for (const allocation of input.allocations) {
    const rate =
      typeof allocation.rate === 'number' && allocation.rate > 0 && Number.isFinite(allocation.rate)
        ? allocation.rate
        : input.paymentRate
    settled += round2(allocation.amount * rate)
    allocated += allocation.amount
  }
  const advance = round2(Math.max(0, round2(input.amount - allocated)) * input.paymentRate)
  const party = round2(settled + advance)
  // When nothing differs, rounding line by line must not invent a difference.
  const same = input.allocations.every(
    (allocation) => allocation.rate === null || allocation.rate === input.paymentRate,
  )
  if (same) return { cash, party: cash, difference: 0 }
  const difference = round2(input.direction === 'in' ? cash - party : party - cash)
  return { cash, party, difference }
}
