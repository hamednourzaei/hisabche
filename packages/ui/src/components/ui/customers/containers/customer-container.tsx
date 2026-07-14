// packages/ui/src/components/ui/customers/containers/customer-container.tsx
"use client"

import { useState, useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useCustomers } from "../../../../hooks/customers/use-customers"
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

  const {
    customersWithDebt,
    debtorCount,
    totalDebt,
    openDealsCount,
    customersLoading,
    invoicesLoading,
    refetchInvoices,
    getOpenInvoicesForCustomer,
  } = useCustomers()

  const isLoading = customersLoading || invoicesLoading

  const filteredCustomers = useMemo(() => {
    if (!search.trim()) return customersWithDebt
    const term = search.toLowerCase()
    return customersWithDebt.filter(
      (c: any) =>
        (c.fullName?.toLowerCase().includes(term)) ||
        (c.name?.toLowerCase().includes(term)) ||
        (c.phone?.toLowerCase().includes(term))
    )
  }, [customersWithDebt, search])

  // ✅ Computed values for sticky summary
  const totalCustomers = customersWithDebt.length
  const overdueCount = customersWithDebt.filter((c: any) => c.isOverdue).length
  const vipCount = customersWithDebt.filter((c: any) => c.tags?.includes('vip')).length
  const todaySales = 0 // از API جداگانه یا useDashboardKPIs

  const paymentInvoicesForModal = useMemo(() => {
    if (!paymentCustomer) return []
    const openInvoices = getOpenInvoicesForCustomer(paymentCustomer.id)
    return openInvoices.map((inv: any) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      total: inv.total,
      paidAmount: inv.paidAmount,
      date: inv.date,
      status: inv.status,
      customerId: paymentCustomer.id,
    }))
  }, [paymentCustomer, getOpenInvoicesForCustomer])

  const handleOpenPayment = useCallback((customer: CustomerWithDebt) => {
    setPaymentCustomer(customer)
    setShowPaymentModal(true)
  }, [])

  const handleClosePayment = useCallback(() => {
    setShowPaymentModal(false)
    setPaymentCustomer(null)
  }, [])

  const handlePaymentSuccess = useCallback(() => {
    refetchInvoices()
    handleClosePayment()
  }, [refetchInvoices, handleClosePayment])

  const handleSelectCustomer = useCallback((id: string) => {
    setSelectedCustomerId(id)
  }, [])

  const handleClearSelection = useCallback(() => {
    setSelectedCustomerId(null)
  }, [])

  const safeT = useCallback(
    (key: string, fallback?: string) => {
      const v = t(key)
      return v !== key ? v : (fallback ?? key)
    },
    [t]
  )

  return customersView({
    t: safeT,
    fmt,
    search,
    onSearchChange: setSearch,
    customersWithDebt: filteredCustomers,
    totalCustomers,
    debtorCount,
    totalDebt,
    overdueCount,
    vipCount,
    todaySales,
    openDealsCount,
    isLoading,
    selectedCustomerId,
    onSelectCustomer: handleSelectCustomer,
    onClearSelection: handleClearSelection,
    showAddModal,
    onOpenAddModal: () => setShowAddModal(true),
    onCloseAddModal: () => setShowAddModal(false),
    showPaymentModal,
    paymentCustomer,
    paymentInvoices: paymentInvoicesForModal,
    onOpenPayment: handleOpenPayment,
    onClosePayment: handleClosePayment,
    onPaymentSuccess: handlePaymentSuccess,
    onNewCreditInvoice: () => {},
    currency: "AFN",
  })
}