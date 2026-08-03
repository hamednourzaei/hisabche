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
  customer?: { full_name?: string; company?: string | null } | null
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
  sortDirection: "asc" | "desc"  // required
  search?: string
  type?: "sale" | "purchase"
  status?: "pending" | "completed" | "cancelled" | "partial"
  customerId?: string
  supplierId?: string
  currency?: "AFN" | "USD" | "PKR" | "IRR"
  fromDate?: string
  toDate?: string
  minTotal?: number
  maxTotal?: number
  sortBy?: string
}