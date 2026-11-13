// packages/ui/src/lib/customers/customers-types.ts

export interface Customer {
  id: string
  fullName?: string
  name?: string
  phone?: string
  email?: string
  /** A text line, or a structured address object from older rows — rendered via String(). */
  address?: string | Record<string, unknown> | null
  openingBalance?: number
  isActive?: boolean
  createdAt?: string
  updatedAt?: string
  userId?: string
  notes?: string
  type?: 'cash' | 'credit'
}

export interface CustomerWithDebt extends Customer {
  totalDebt: number
  /** What the business owes this customer (a return on an invoice already paid). */
  creditBalance?: number
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
