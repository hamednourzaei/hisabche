import type { CurrencyCode } from '@hisabche/store'
// packages/ui/src/lib/invoices/invoices-types.ts

export interface RawInvoice {
  id?: string | undefined
  _id?: string | undefined
  invoiceId?: string | undefined
  invoice_id?: string | undefined
  invoiceNumber?: string | undefined
  invoice_number?: string | undefined
  date?: string | undefined
  created_at?: string | undefined
  updated_at?: string | undefined
  status?: string | undefined
  total?: number | undefined
  currency?: string | undefined
  type?: string | undefined
  customerName?: string | null | undefined
  /** H2 — the API selects `customer_id`; both spellings are accepted because
   *  the list and the detail endpoint disagree about casing. */
  customerId?: string | null | undefined
  customer_id?: string | null | undefined
  customer?: { id?: string; full_name?: string; company?: string | null } | null | undefined
  paid_amount?: number | undefined
  /** V53 OD-3: the server's answer about this sale's credit. `null` = no question was asked. */
  credit_status?: string | null | undefined
  creditStatus?: string | null | undefined
  itemsSent?: number | undefined
  publicToken?: string | undefined
  public_token?: string | undefined
}

export interface Invoice {
  id: string
  invoiceNumber: string
  date: string
  createdAt: string
  /** تاریخ خام ISO — برای محاسبات آماری (نمایش داده نمی‌شود) */
  isoDate: string
  status: string
  total: number
  currency: string
  type: string
  customerName: string
  /** H2 — present when the invoice has a real party; drives the link in the table. */
  customerId?: string | undefined
  /** Business/company name for the customer — blank until customers.company exists in the schema */
  company: string
  paymentDate: string
  itemsSent: number
  publicToken?: string
  /**
   * V53 OD-3 — the server's credit verdict on a sale made offline. `null`/absent = nothing was asked.
   * `pending_validation` and `rejected` mean the sale is NOT final: it is kept out of revenue and shows a
   * marker; `validated` needs no marker (that is an ordinary accepted sale).
   */
  creditStatus?: string | null
}

// این تایپ باید دقیقاً با useInvoices از @hisabche/api مطابقت داشته باشد
export interface InvoicesQueryParams {
  page: number
  limit: number
  sortDirection: 'asc' | 'desc' // required
  search?: string
  type?: 'sale' | 'purchase'
  status?: 'pending' | 'completed' | 'cancelled' | 'partial'
  branchId?: string
  warehouseId?: string
  customerId?: string | undefined
  supplierId?: string
  currency?: CurrencyCode
  dateFrom?: string
  dateTo?: string
  minTotal?: number
  maxTotal?: number
  sortBy?: string
  /** H1 — «anything still owed». See invoice-filter-link.ts. */
  outstanding?: boolean
}
