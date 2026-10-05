// packages/ui/src/lib/invoices/invoices-types.ts

export interface RawInvoice {
  id?: string
  _id?: string
  invoiceId?: string
  invoice_id?: string
  invoiceNumber?: string
  invoice_number?: string
  date?: string
  created_at?: string
  updated_at?: string
  status?: string
  total?: number
  currency?: string
  type?: string
  customerName?: string | null
  /** H2 — the API selects `customer_id`; both spellings are accepted because
   *  the list and the detail endpoint disagree about casing. */
  customerId?: string | null
  customer_id?: string | null
  customer?: { id?: string; full_name?: string; company?: string | null } | null
  paid_amount?: number
  itemsSent?: number
  publicToken?: string
  public_token?: string
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
  currency?: 'AFN' | 'USD' | 'PKR' | 'IRR'
  dateFrom?: string
  dateTo?: string
  minTotal?: number
  maxTotal?: number
  sortBy?: string
  /** H1 — «anything still owed». See invoice-filter-link.ts. */
  outstanding?: boolean
}
