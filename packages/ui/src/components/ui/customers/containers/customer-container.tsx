// packages/ui/src/components/ui/customers/containers/customers-container.tsx
// 🎯 Container — مدیریت state و ترکیب View

"use client"

import { useState, useCallback, useMemo } from "react"
import { useTranslations } from "next-intl";
import { customersView } from "../customer-view"
import { fmt } from "../../../../lib/customers/customers-format"
import type { CustomerWithDebt } from "../../../../lib/customers/customers-types"
import { useCustomersData } from "../../../../hooks/customers/use-customers-data"

// ============================================================
// 📦 Typeهای محلی
// ============================================================

type CustomerWithInvoices = CustomerWithDebt & {
  invoices: any[]
}

// ============================================================
// 🎯 کامپوننت اصلی
// ============================================================

export function CustomersContainer() {
  const t = useTranslations();// ✅ Wrapper برای تطابق signature با CustomersViewProps


  // ============================================================
  // 📦 داده‌ها
  // ============================================================
  const {
    customersWithDebt,
    customersWithOpenInvoices,
    totalCustomers,
    debtorCount,
    totalDebt,
    overdueCount,
    vipCount,
    todaySales,
    openDealsCount,
    isLoading,
    isError,
    error,
    refetch,
  } = useCustomersData()

  // ============================================================
  // 🎯 Stateهای UI
  // ============================================================
  const [search, setSearch] = useState("")
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentCustomer, setPaymentCustomer] = useState<CustomerWithInvoices | null>(null)

  // ============================================================
  // 🧠 Callbackها
  // ============================================================
  const handleOpenPayment = useCallback(
    (customer: CustomerWithDebt) => {
      const customerWithInvoices = customersWithOpenInvoices.find(
        (c) => c.id === customer.id
      )
      if (customerWithInvoices) {
        setPaymentCustomer(customerWithInvoices as CustomerWithInvoices)
      }
      setShowPaymentModal(true)
    },
    [customersWithOpenInvoices]
  )

  const handleClosePayment = useCallback(() => {
    setShowPaymentModal(false)
    setPaymentCustomer(null)
  }, [])

  const handlePaymentSuccess = useCallback(() => {
    handleClosePayment()
    refetch()
  }, [handleClosePayment, refetch])

  const handleSelectCustomer = useCallback((id: string) => {
    setSelectedCustomerId(id)
  }, [])

  const handleClearSelection = useCallback(() => {
    setSelectedCustomerId(null)
  }, [])

  // فیلتر کردن بر اساس جستجو
  const filteredCustomers = useMemo(() => {
    if (!search.trim()) return customersWithDebt
    const term = search.toLowerCase()
    return customersWithDebt.filter(
      (c) =>
        (c.fullName || c.name || "").toLowerCase().includes(term) ||
        (c.phone || "").toLowerCase().includes(term)
    )
  }, [customersWithDebt, search])

  // ============================================================
  // 🎨 رندر
  // ============================================================
  return customersView({
    t,
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
    isError,
    errorMessage: error?.message || "",
    onRetry: refetch,
    selectedCustomerId,
    onSelectCustomer: handleSelectCustomer,
    onClearSelection: handleClearSelection,
    showAddModal,
    onOpenAddModal: () => setShowAddModal(true),
    onCloseAddModal: () => setShowAddModal(false),
    showPaymentModal,
    paymentCustomer,
    paymentInvoices: paymentCustomer?.invoices || [],
    onOpenPayment: handleOpenPayment,
    onClosePayment: handleClosePayment,
    onPaymentSuccess: handlePaymentSuccess,
    onNewCreditInvoice: () => {},
    currency: "AFN",
  })
}

// ✅ Alias برای backward compatibility
export const customersContainer = CustomersContainer