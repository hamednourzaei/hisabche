// packages/ui/src/lib/customers/customers-types.ts

import type { PartyRole } from '@hisabche/validation'

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
  /**
   * What the party declared when it was created (buyer/seller/both). Legacy
   * rows may still say `both`; new records are created as one of the two.
   */
  declaredRole?: 'buyer' | 'seller' | 'both' | null
  /**
   * The resolved role the server returns: `declared_role` merged with the
   * direction of the invoices the party actually appears on. Read, never
   * recomputed here — the role column must show the server's answer.
   */
  role?: PartyRole
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
