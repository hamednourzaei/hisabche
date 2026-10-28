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

import { FRACTION_DIGITS } from '@hisabche/formatting'
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
  type SummaryReturn,
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

/**
 * A return document of one of the party's invoices (`invoice_returns`). The
 * amount is in MINOR units of the original invoice's currency — the same unit
 * the function that wrote it divided by (an invoice with no currency used 2).
 */
export interface PartyReturnRow {
  id: string
  original_invoice_id: string
  return_type?: Loose
  return_number?: Loose
  return_date?: Loose
  grand_total_minor?: Loose
  /** The original invoice's currency; empty = the books currency. */
  currency?: Loose
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
  /** Sale returns. Absent where returns are not kept (the device). */
  returns?: readonly PartyReturnRow[] | undefined
}

const num = (value: Loose): number => Number(value) || 0
const day = (value: Loose): string => String(value ?? '').slice(0, 10)

/**
 * The sale returns of a party as MAJOR amounts. A purchase return is not here:
 * the return function posts only the sales side (sales, receivable, inventory,
 * cost of sales), so a supplier statement has nothing to subtract.
 */
export function saleReturnsOf(
  returns: readonly PartyReturnRow[] | undefined,
): Array<SummaryReturn & { id: string; invoiceId: string; reference: string }> {
  return (returns ?? [])
    .filter((entry) => entry.return_type !== 'purchase_return')
    .map((entry) => {
      const currency = String(entry.currency ?? '')
      const digits = currency
        ? ((FRACTION_DIGITS as Record<string, number>)[currency.toUpperCase()] ?? 2)
        : 2
      return {
        id: entry.id,
        invoiceId: entry.original_invoice_id,
        reference: String(entry.return_number ?? entry.id),
        returnDate: day(entry.return_date),
        currency,
        amount: round2(num(entry.grand_total_minor) / 10 ** digits),
      }
    })
}

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
  const saleReturns = saleReturnsOf(input.rows.returns)
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
    // A return reads in the statement as a credit and links to the invoice it came from.
    ...saleReturns.map((entry) => {
      sources.set(`r:${entry.id}`, {
        sourceType: 'invoice',
        sourceId: entry.invoiceId,
        currency: entry.currency,
      })
      return {
        date: entry.returnDate,
        kind: 'return' as LedgerMovement['kind'],
        amount: entry.amount,
        reference: entry.reference,
        ...(entry.currency ? { currency: entry.currency } : {}),
        key: `r:${entry.id}`,
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
  const summaryReturns: SummaryReturn[] = saleReturnsOf(input.rows.returns).map(
    ({ amount, returnDate, currency, invoiceId }) => ({
      amount,
      returnDate,
      currency,
      invoiceId,
    }),
  )
  return {
    ...summarizeParty(summaryInvoices, summaryPayments, input.asOf, openingBalance, summaryReturns),
    // The figures above add every document whatever its currency; `byCurrency`
    // is the same summary once per currency.
    bookCurrency: input.bookCurrency,
    byCurrency: summarizePartyByCurrency(
      summaryInvoices,
      summaryPayments,
      input.asOf,
      openingBalance,
      input.bookCurrency,
      summaryReturns,
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
