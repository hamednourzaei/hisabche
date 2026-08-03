// packages/ui/src/components/ui/customers/customer-view.types.ts
// 🎯 Types for Customer View Component

import type { CustomerWithDebt, InvoiceForDebt } from "../../../lib/customers/customers-types"

export interface CustomersViewProps {
  // i18n
  t: (key: string, fallback?: string) => string
  fmt: (v: number) => string

  // Search & Filter
  search: string
  onSearchChange: (value: string) => void

  // Data
  customersWithDebt: CustomerWithDebt[]
  totalCustomers: number
  debtorCount: number
  totalDebt: number
  overdueCount: number
  vipCount: number
  todaySales: number
  totalSales: number
  topCustomerName: string | null
  topCustomerAmount: number
  openDealsCount: number

  // Trends (درصد تغییر ماهانه)
  customersDelta?: number | null
  salesDelta?: number | null
  debtDelta?: number | null
  topCustomerDelta?: number | null

  // States
  isLoading: boolean
  isError: boolean
  errorMessage: string
  onRetry: () => void

  // Selection & Navigation
  selectedCustomerId: string | null
  onSelectCustomer: (id: string) => void
  onClearSelection: () => void

  // Modals
  showAddModal: boolean
  onOpenAddModal: () => void
  onCloseAddModal: () => void

  showPaymentModal: boolean
  paymentCustomer: CustomerWithDebt | null
  paymentInvoices: InvoiceForDebt[]
  onOpenPayment: (customer: CustomerWithDebt) => void
  onClosePayment: () => void
  onPaymentSuccess: () => void

  // Actions
  onNewCreditInvoice: () => void

  // Configuration
  currency?: string
}

export type FilterId = "all" | "debtors" | "vip" | "overdue"