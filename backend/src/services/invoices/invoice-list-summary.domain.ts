// ============================================
// backend/src/services/invoices/invoice-list-summary.domain.ts
//
// The figures on the invoice page's stat cards, computed over EVERY invoice
// that matches the request's filters — not over the page the table shows.
//
// Before this, the browser asked for `limit: 500`, the route capped it at
// 100, and the cards summed whatever came back. A workspace with 300 invoices
// read «مجموع مبلغ» off its latest 100 and was told it was the whole business.
//
// The rules are the ones the cards already used, moved here unchanged:
//   - cancelled invoices are excluded from everything;
//   - `paid` and `completed` are settled, every other status is pending;
//   - month buckets are calendar months of the invoice's `date`
//     (falling back to `created_at`), relative to `now`.
// ============================================

export const SUMMARY_PAID_STATUSES: ReadonlySet<string> = new Set(['paid', 'completed'])

export interface InvoiceSummaryRow {
  total: number | string | null
  status: string | null
  date: string | null
  created_at: string | null
  currency: string | null
}

export interface InvoiceSummaryBucket {
  count: number
  totalAmount: number
  pendingAmount: number
  paidAmount: number
}

export interface InvoiceListSummary extends InvoiceSummaryBucket {
  currentMonth: InvoiceSummaryBucket
  previousMonth: InvoiceSummaryBucket
  /** Distinct currencies among the counted invoices. Amounts are NOT converted. */
  currencies: string[]
}

const emptyBucket = (): InvoiceSummaryBucket => ({
  count: 0,
  totalAmount: 0,
  pendingAmount: 0,
  paidAmount: 0,
})

function monthOffset(value: string | null, now: Date): number | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return (now.getUTCFullYear() - d.getUTCFullYear()) * 12 + (now.getUTCMonth() - d.getUTCMonth())
}

function add(bucket: InvoiceSummaryBucket, amount: number, paid: boolean) {
  bucket.count += 1
  bucket.totalAmount += amount
  if (paid) bucket.paidAmount += amount
  else bucket.pendingAmount += amount
}

export function summarizeInvoices(
  rows: readonly InvoiceSummaryRow[],
  now: Date,
): InvoiceListSummary {
  const all = emptyBucket()
  const currentMonth = emptyBucket()
  const previousMonth = emptyBucket()
  const currencies = new Set<string>()

  for (const row of rows) {
    if (row.status === 'cancelled') continue
    const amount = Number(row.total) || 0
    const paid = SUMMARY_PAID_STATUSES.has(row.status ?? '')
    add(all, amount, paid)
    if (row.currency) currencies.add(row.currency)
    const offset = monthOffset(row.date ?? row.created_at, now)
    if (offset === 0) add(currentMonth, amount, paid)
    else if (offset === 1) add(previousMonth, amount, paid)
  }

  return { ...all, currentMonth, previousMonth, currencies: [...currencies].sort() }
}
