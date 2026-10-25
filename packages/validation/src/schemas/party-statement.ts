// ============================================
// packages/validation/src/schemas/party-statement.ts
//
// The customer / supplier statement — open invoices, ledger, summary, activity —
// assembled from the rows of a party. ONE rule, two runtimes: the server
// (`PaymentsService`, rows from Postgres) and the device (`routes/payments.ts`
// in the local engine, rows from SQLite) both hand their rows to these four
// functions. Neither re-derives a balance, a currency split or a ranking.
//
// The rows are the database rows (snake_case) because both stores keep that
// shape; every loose field is read with the same coercion the server always used.
// ============================================

import {
  monthlyActivity,
  openInvoices,
  outstandingOf,
  partyBalancesByCurrency,
  rankPartyProducts,
  round2,
  runningLedger,
  summarizeParty,
  summarizePartyByCurrency,
  type LedgerMovement,
  type MonthlyActivity,
  type OpenInvoice,
  type PartyProduct,
  type PartySummary,
  type PartyType,
  type SummaryInvoice,
  type SummaryPayment,
} from './payments.domain'

type Loose = string | number | null | undefined

export interface PartyInvoiceRow {
  id: string
  invoice_number?: Loose
  type?: Loose
  status?: Loose
  total?: Loose
  paid_amount?: Loose
  date?: Loose
  due_date?: Loose
  currency?: Loose
}

export interface PartyPaymentRow {
  id: string
  payment_number?: Loose
  direction?: Loose
  amount?: Loose
  entry_date?: Loose
  currency?: Loose
  method?: Loose
}

export interface PartyLineRow {
  invoice_id: Loose
  product_id?: Loose
  product_name?: Loose
  unit?: Loose
  unit_label?: Loose
  quantity?: Loose
  total_price?: Loose
}

export interface PartyRows {
  invoices: readonly PartyInvoiceRow[]
  payments: readonly PartyPaymentRow[]
  openingBalance: number
}

const num = (value: Loose): number => Number(value) || 0
const day = (value: Loose): string => String(value ?? '').slice(0, 10)

/** What a party still owes, invoice by invoice. */
export function buildOpenInvoicesView(invoices: readonly OpenInvoice[]) {
  return openInvoices([...invoices]).map((invoice) => ({
    ...invoice,
    outstanding: outstandingOf(invoice),
  }))
}

/**
 * A party's statement: every invoice and payment, with a running balance.
 * Positive means they owe us.
 */
export function buildPartyLedger(input: {
  partyType: PartyType
  partyId: string
  rows: PartyRows
  bookCurrency: string
}) {
  const { invoices, payments, openingBalance } = input.rows
  const bookCurrency = input.bookCurrency

  // Each row keeps what the statement needs to link back to its document.
  const sources = new Map<
    string,
    { sourceType: 'invoice' | 'payment'; sourceId: string; currency: string; method?: string }
  >()
  const movements: (LedgerMovement & { key: string })[] = [
    ...invoices.map((invoice) => {
      const reference = String(invoice.invoice_number ?? invoice.id)
      sources.set(`i:${invoice.id}`, {
        sourceType: 'invoice',
        sourceId: invoice.id,
        currency: String(invoice.currency ?? ''),
      })
      return {
        date: day(invoice.date),
        kind: (invoice.type === 'purchase' ? 'purchase' : 'sale') as LedgerMovement['kind'],
        amount: num(invoice.total),
        reference,
        ...(invoice.currency ? { currency: String(invoice.currency) } : {}),
        key: `i:${invoice.id}`,
      }
    }),
    ...payments.map((payment) => {
      sources.set(`p:${payment.id}`, {
        sourceType: 'payment',
        sourceId: payment.id,
        currency: String(payment.currency ?? ''),
        ...(payment.method ? { method: String(payment.method) } : {}),
      })
      return {
        date: day(payment.entry_date),
        kind: (payment.direction === 'in' ? 'payment_in' : 'payment_out') as LedgerMovement['kind'],
        amount: num(payment.amount),
        reference: String(payment.payment_number ?? payment.id),
        ...(payment.currency ? { currency: String(payment.currency) } : {}),
        key: `p:${payment.id}`,
      }
    }),
  ]

  // The running balance starts from the opening balance, not from zero — and the
  // opening balance is in the books currency, so only rows of that currency
  // carry it.
  const opening = round2(openingBalance)
  const balances = partyBalancesByCurrency(movements, bookCurrency, opening)
  return {
    partyType: input.partyType,
    partyId: input.partyId,
    openingBalance: opening,
    movements: runningLedger(
      movements.map((movement) => ({ ...movement, currency: movement.currency || bookCurrency })),
    ).map((row) => {
      const { key, ...rest } = row as typeof row & { key: string }
      const carried = rest.currency === bookCurrency ? opening : 0
      return {
        ...rest,
        balance: round2(rest.balance + carried),
        ...sources.get(key),
        currency: rest.currency,
      }
    }),
    /** The currency the books are kept in. */
    currency: bookCurrency,
    /** IN THE BOOKS CURRENCY ONLY; other currencies are in `balances`. */
    balance: balances[0]?.balance ?? opening,
    balances,
  }
}

/** The authoritative figures of the party page (never added up in the browser). */
export function buildPartySummary(input: {
  rows: PartyRows
  bookCurrency: string
  asOf: string
}): PartySummary & {
  bookCurrency: string
  byCurrency: Array<PartySummary & { currency: string }>
} {
  const { invoices, payments, openingBalance } = input.rows
  const summaryInvoices: SummaryInvoice[] = invoices.map((invoice) => ({
    id: invoice.id,
    type: invoice.type === 'purchase' ? 'purchase' : 'sale',
    status: String(invoice.status ?? ''),
    total: num(invoice.total),
    paidAmount: num(invoice.paid_amount),
    invoiceDate: day(invoice.date),
    dueDate: day(invoice.due_date),
    currency: String(invoice.currency ?? ''),
  }))
  const summaryPayments: SummaryPayment[] = payments.map((payment) => ({
    direction: payment.direction === 'out' ? 'out' : 'in',
    amount: num(payment.amount),
    entryDate: day(payment.entry_date),
    currency: String(payment.currency ?? ''),
  }))
  return {
    ...summarizeParty(summaryInvoices, summaryPayments, input.asOf, openingBalance),
    // The figures above add every document whatever its currency; `byCurrency`
    // is the same summary once per currency.
    bookCurrency: input.bookCurrency,
    byCurrency: summarizePartyByCurrency(
      summaryInvoices,
      summaryPayments,
      input.asOf,
      openingBalance,
      input.bookCurrency,
    ),
  }
}

/** Sales vs receipts for the last 12 months, and the products the party moves most. */
export function buildPartyActivity(input: {
  partyType: PartyType
  rows: Pick<PartyRows, 'invoices' | 'payments'>
  /** The lines of the invoices `partyActivityInvoices` returned. */
  lines: readonly PartyLineRow[]
  asOf: string
}): { monthly: MonthlyActivity[]; products: PartyProduct[] } {
  const { invoices, payments } = input.rows
  const relevant = partyActivityInvoices(input.partyType, invoices)
  return {
    monthly: monthlyActivity(
      invoices.map((invoice) => ({
        type: invoice.type === 'purchase' ? 'purchase' : 'sale',
        total: num(invoice.total),
        invoiceDate: String(invoice.date ?? ''),
      })),
      payments.map((payment) => ({
        direction: payment.direction === 'out' ? 'out' : 'in',
        amount: num(payment.amount),
        entryDate: String(payment.entry_date ?? ''),
      })),
      input.asOf,
    ),
    products: rankPartyProducts(
      input.lines.map((line) => ({
        invoiceId: String(line.invoice_id),
        productId: line.product_id ? String(line.product_id) : null,
        name: String(line.product_name ?? ''),
        unit: String(line.unit === 'custom' ? (line.unit_label ?? 'custom') : (line.unit ?? '')),
        quantity: num(line.quantity),
        amount: num(line.total_price),
      })),
      new Map(relevant.map((invoice) => [String(invoice.id), day(invoice.date)])),
    ),
  }
}

/** The invoices whose lines the activity ranks (sales for a customer, purchases for a supplier). */
export function partyActivityInvoices(
  partyType: PartyType,
  invoices: readonly PartyInvoiceRow[],
): PartyInvoiceRow[] {
  const documentType = partyType === 'customer' ? 'sale' : 'purchase'
  return invoices.filter((invoice) => (invoice.type ?? 'sale') === documentType)
}
