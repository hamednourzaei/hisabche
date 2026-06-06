// packages/ui/src/lib/invoices/invoices-types.ts

export interface RawInvoice {
  id?: string
  _id?: string
  invoiceId?: string
  invoice_id?: string
  invoiceNumber?: string
  invoice_number?: string
  date?: string
  status?: string
  total?: number
  currency?: string
}

export interface Invoice {
  id: string
  invoiceNumber: string
  date: string
  status: string
  total: number
  currency: string
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