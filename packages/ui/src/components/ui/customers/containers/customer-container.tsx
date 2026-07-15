// packages/ui/src/components/ui/customers/containers/customer-container.tsx
"use client"

import { useState, useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useCustomers, useInvoices } from "@hisabche/api"
import { customersView } from "../customer-view"
import { fmt } from "../../../../lib/customers/customers-format"
import type { CustomerWithDebt } from "../../../../lib/customers/customers-types"

export function customersContainer() {
  const { t } = useTranslation()
  const [search, setSearch] = useState("")
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentCustomer, setPaymentCustomer] = useState<CustomerWithDebt | null>(null)

  // ✅ Fetch all data — high limit for accurate KPIs
  const { data: customersData, isLoading: customersLoading } = useCustomers({ page: 1, limit: 500, sortDirection: 'desc' })
  const { data: invoicesData, isLoading: invoicesLoading } = useInvoices({ page: 1, limit: 1000, sortDirection: 'desc' } as any)

  const isLoading = customersLoading || invoicesLoading

  // ✅ Compute customers with real debt from invoices
  const customersWithDebt = useMemo(() => {
    const customers = (customersData as any)?.customers || []
    const invoices = (invoicesData as any)?.invoices || []
    
    return customers.map((c: any) => {
      // Match by customerId OR customer_id (both possible from API)
      const customerInvoices = invoices.filter((inv: any) => 
        inv.customerId === c.id || inv.customer_id === c.id
      )
      
      // Open invoices = not paid, not cancelled
      const openInvoices = customerInvoices.filter((inv: any) => 
        inv.status !== 'paid' && inv.status !== 'cancelled'
      )
      
      // Total debt = sum of (total - paidAmount)
      const totalDebt = openInvoices.reduce((sum: number, inv: any) => 
        sum + Math.max(0, (inv.total || 0) - (inv.paidAmount || inv.paid_amount || 0)), 0
      )
      
      // Total purchases = sum of all invoice totals
      const totalPurchases = customerInvoices.reduce((sum: number, inv: any) => 
        sum + (inv.total || 0), 0
      )
      
      // Last invoice by date
      const sortedInvoices = [...customerInvoices].sort((a: any, b: any) => 
        new Date(b.date || b.created_at).getTime() - new Date(a.date || a.created_at).getTime()
      )
      const lastInvoice = sortedInvoices[0]
      
      // Is overdue = any open invoice past due date
      const now = new Date()
      const isOverdue = openInvoices.some((inv: any) => {
        const dueDate = inv.dueDate || inv.due_date
        if (!dueDate) return false
        return new Date(dueDate) < now
      })
      
      // Auto-tag VIP if total purchases > 100,000
      const tags = c.tags || []
      if (totalPurchases > 100000 && !tags.includes('vip')) {
        tags.push('vip')
      }
      
      return {
        ...c,
        id: c.id,
        fullName: c.fullName || c.full_name || '',
        name: c.fullName || c.full_name || '',
        phone: c.phone || '',
        totalDebt,
        openCount: openInvoices.length,
        totalPurchases,
        lastInvoiceDate: lastInvoice?.date || lastInvoice?.created_at || null,
        isOverdue,
        tags,
      }
    })
  }, [customersData, invoicesData])

  // Filter by search
  const filteredCustomers = useMemo(() => {
    if (!search.trim()) return customersWithDebt
    const term = search.toLowerCase()
    return customersWithDebt.filter(
      (c: any) =>
        (c.fullName || c.name || '').toLowerCase().includes(term) ||
        (c.phone || '').toLowerCase().includes(term)
    )
  }, [customersWithDebt, search])

  // ✅ Real KPIs
  const totalCustomers = customersWithDebt.length
  const totalDebt = customersWithDebt.reduce((sum: number, c: any) => sum + (c.totalDebt || 0), 0)
  const debtorCount = customersWithDebt.filter((c: any) => (c.totalDebt || 0) > 0).length
  const openDealsCount = customersWithDebt.reduce((sum: number, c: any) => sum + (c.openCount || 0), 0)
  const overdueCount = customersWithDebt.filter((c: any) => c.isOverdue).length
  const vipCount = customersWithDebt.filter((c: any) => c.tags?.includes('vip')).length
  const todaySales = 0

  // Payment invoices for modal
  const paymentInvoicesForModal = useMemo(() => {
    if (!paymentCustomer) return []
    const invoices = (invoicesData as any)?.invoices || []
    return invoices
      .filter((inv: any) => 
        (inv.customerId === paymentCustomer.id || inv.customer_id === paymentCustomer.id) && 
        inv.status !== 'paid' && inv.status !== 'cancelled'
      )
      .map((inv: any) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber || inv.invoice_number || '',
        total: inv.total || 0,
        paidAmount: inv.paidAmount || inv.paid_amount || 0,
        date: inv.date || inv.created_at || '',
        status: inv.status || 'pending',
        customerId: paymentCustomer.id,
      }))
  }, [paymentCustomer, invoicesData])

  const handleOpenPayment = useCallback((customer: CustomerWithDebt) => {
    setPaymentCustomer(customer)
    setShowPaymentModal(true)
  }, [])

  const handleClosePayment = useCallback(() => {
    setShowPaymentModal(false)
    setPaymentCustomer(null)
  }, [])

  const handlePaymentSuccess = useCallback(() => {
    handleClosePayment()
  }, [handleClosePayment])

  const handleSelectCustomer = useCallback((id: string) => {
    setSelectedCustomerId(id)
  }, [])

  const handleClearSelection = useCallback(() => {
    setSelectedCustomerId(null)
  }, [])

  const safeT = useCallback((key: string, fallback?: string) => {
    const v = t(key)
    return v !== key ? v : (fallback ?? key)
  }, [t])

  return customersView({
    t: safeT, fmt, search, onSearchChange: setSearch,
    customersWithDebt: filteredCustomers,
    totalCustomers, debtorCount, totalDebt, overdueCount, vipCount, todaySales, openDealsCount,
    isLoading, selectedCustomerId,
    onSelectCustomer: handleSelectCustomer, onClearSelection: handleClearSelection,
    showAddModal, onOpenAddModal: () => setShowAddModal(true), onCloseAddModal: () => setShowAddModal(false),
    showPaymentModal, paymentCustomer, paymentInvoices: paymentInvoicesForModal,
    onOpenPayment: handleOpenPayment, onClosePayment: handleClosePayment, onPaymentSuccess: handlePaymentSuccess,
    onNewCreditInvoice: () => {}, currency: "AFN",
  })
}