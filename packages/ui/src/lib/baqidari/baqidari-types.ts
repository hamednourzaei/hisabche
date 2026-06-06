// packages/ui/src/lib/baqidari-types.ts

export interface Customer {
  id: string
  fullName?: string
  name?: string
  phone?: string
}

export interface CustomerWithDebt extends Customer {
  totalDebt: number
  openCount: number
}

export interface InvoiceForDebt {
  id: string
  invoiceNumber?: string
  total: number
  paidAmount: number
  date: string
  status: string
  customerId: string
}

export interface OpenInvoice {
  id: string
  invoiceNumber: string
  total: number
  paidAmount: number
  remaining: number
  date: string
  status: string
}

export interface CustomerDetail {
  id: string
  name: string
  phone?: string
}