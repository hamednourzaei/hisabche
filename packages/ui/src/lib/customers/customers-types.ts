// packages/ui/src/lib/customers/customers-types.ts

export interface Customer {
  id: string
  fullName?: string
  name?: string
  phone?: string
  email?: string
  address?: any // ← تغییر: به any برای سازگاری با ساختارهای مختلف
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