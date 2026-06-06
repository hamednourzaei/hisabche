// packages/ui/src/containers/baqidari-container.tsx
"use client"

import { useState, useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useBaqidari } from "../../../../hooks/baqidari/use-baqidari"
import { BaqidariView } from "../baqidari-view"
import { fmt } from "../../../../lib/baqidari/baqidari-format"
import type { CustomerWithDebt } from "../../../../lib/baqidari/baqidari-types"

export function BaqidariContainer() {
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
  } = useBaqidari()

  const isLoading = customersLoading || invoicesLoading

  // Filter customers by search
  const filteredCustomers = useMemo(() => {
    if (!search.trim()) return customersWithDebt
    const term = search.toLowerCase()
    return customersWithDebt.filter(
      (c) =>
        (c.fullName?.toLowerCase().includes(term)) ||
        (c.name?.toLowerCase().includes(term)) ||
        (c.phone?.toLowerCase().includes(term))
    )
  }, [customersWithDebt, search])

  // تبدیل OpenInvoice[] به InvoiceForDebt[] برای PaymentModal
  const paymentInvoicesForModal = useMemo(() => {
    if (!paymentCustomer) return []
    const openInvoices = getOpenInvoicesForCustomer(paymentCustomer.id)
    // تبدیل به فرمت مورد انتظار PaymentModal
    return openInvoices.map((inv) => ({
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

  return (
    <BaqidariView
      t={safeT}
      fmt={fmt}
      search={search}
      onSearchChange={setSearch}
      customersWithDebt={filteredCustomers}
      debtorCount={debtorCount}
      totalDebt={totalDebt}
      openDealsCount={openDealsCount}
      isLoading={isLoading}
      selectedCustomerId={selectedCustomerId}
      onSelectCustomer={handleSelectCustomer}
      onClearSelection={handleClearSelection}
      showAddModal={showAddModal}
      onOpenAddModal={() => setShowAddModal(true)}
      onCloseAddModal={() => setShowAddModal(false)}
      showPaymentModal={showPaymentModal}
      paymentCustomer={paymentCustomer}
      paymentInvoices={paymentInvoicesForModal}
      onOpenPayment={handleOpenPayment}
      onClosePayment={handleClosePayment}
      onPaymentSuccess={handlePaymentSuccess}
      onNewCreditInvoice={() => {}}
    />
  )
}