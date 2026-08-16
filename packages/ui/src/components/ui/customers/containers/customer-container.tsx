// packages/ui/src/components/ui/customers/containers/customers-container.tsx
// 🎯 Container — مدیریت state و ترکیب View

'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { customersView } from '../customer-view'
import { fmt } from '../../../../lib/customers/customers-format'
import type { CustomerWithDebt } from '../../../../lib/customers/customers-types'
import { useCustomersData } from '../../../../hooks/customers/use-customers-data'

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
  const router = useRouter()
  const tOriginal = useTranslations()
  // ✅ Wrapper برای تطابق signature با CustomersViewProps
  const t = (key: string, fallback?: string): string => {
    const v = tOriginal(key as Parameters<typeof tOriginal>[0])
    return v && v !== key ? v : (fallback ?? key)
  }

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
    totalSales,
    topCustomerName,
    topCustomerAmount,
    openDealsCount,
    customersDelta,
    salesDelta,
    debtDelta,
    topCustomerDelta,
    isLoading,
    isError,
    error,
    refetch,
  } = useCustomersData()

  // ============================================================
  // 🎯 Stateهای UI
  // ============================================================
  // ورودی از command palette: `?add=true` مودال افزودن را باز می‌کند و `?q=`
  // جستجو را از قبل پر می‌کند. بدون این، دستورهای «افزودن مشتری» و «جستجوی
  // مشتری» فقط مسیر را عوض می‌کردند و هیچ کاری انجام نمی‌دادند.
  const searchParams = useSearchParams()
  const addParam = searchParams?.get('add')
  const queryParam = searchParams?.get('q')

  const [search, setSearch] = useState(queryParam ?? '')
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(addParam === 'true')

  // مسیر مقصد ممکن است همین صفحه باشد؛ در آن حالت کامپوننت remount نمی‌شود و
  // مقدار اولیه‌ی useState دوباره خوانده نمی‌شود.
  useEffect(() => {
    if (addParam === 'true') setShowAddModal(true)
  }, [addParam])

  useEffect(() => {
    if (queryParam !== null && queryParam !== undefined) setSearch(queryParam)
  }, [queryParam])
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentCustomer, setPaymentCustomer] = useState<CustomerWithInvoices | null>(null)

  // ============================================================
  // 🧠 Callbackها
  // ============================================================
  const handleOpenPayment = useCallback(
    (customer: CustomerWithDebt) => {
      const customerWithInvoices = customersWithOpenInvoices.find((c) => c.id === customer.id)
      if (customerWithInvoices) {
        setPaymentCustomer(customerWithInvoices as CustomerWithInvoices)
      }
      setShowPaymentModal(true)
    },
    [customersWithOpenInvoices],
  )

  const handleClosePayment = useCallback(() => {
    setShowPaymentModal(false)
    setPaymentCustomer(null)
  }, [])

  const handlePaymentSuccess = useCallback(() => {
    handleClosePayment()
    refetch()
  }, [handleClosePayment, refetch])

  // Each customer gets its own address. Rendering the profile inline left the
  // URL on /customers, so the record could not be linked, bookmarked, or
  // reopened with the browser's back button.
  const handleSelectCustomer = useCallback(
    (id: string) => router.push(`/customers/${id}`),
    [router],
  )

  const handleClearSelection = useCallback(() => {
    setSelectedCustomerId(null)
  }, [])

  // فیلتر کردن بر اساس جستجو
  const filteredCustomers = useMemo(() => {
    if (!search.trim()) return customersWithDebt
    const term = search.toLowerCase()
    return customersWithDebt.filter(
      (c) =>
        (c.fullName || c.name || '').toLowerCase().includes(term) ||
        (c.phone || '').toLowerCase().includes(term),
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
    totalSales,
    topCustomerName,
    topCustomerAmount,
    openDealsCount,
    customersDelta,
    salesDelta,
    debtDelta,
    topCustomerDelta,
    isLoading,
    isError,
    errorMessage: error?.message || '',
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
    currency: 'AFN',
  })
}

// ✅ Alias برای backward compatibility
export const customersContainer = CustomersContainer
