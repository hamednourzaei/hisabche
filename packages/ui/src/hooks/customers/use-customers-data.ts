// packages/ui/src/components/ui/customers/hooks/use-customers-data.ts
// 🎯 Custom hook for customers data fetching & computation

import { useMemo } from "react"
import { useCustomers, useInvoices } from "@hisabche/api"
import type { CustomerWithDebt, InvoiceForDebt } from "../../lib/customers/customers-types"

// ============================================================
// 📦 Typeهای توسعه‌یافته (محلی - بدون تغییر فایل اصلی)
// ============================================================

type ExtendedInvoice = InvoiceForDebt & {
  due_date?: string
  created_at?: string
  customer_id?: string
  paid_amount?: number
}

type ExtendedCustomer = CustomerWithDebt & {
  tags?: string[]
  isOverdue?: boolean
  totalPurchases?: number
  invoices?: InvoiceForDebt[]
  lastInvoiceDate?: string | null
  paidAmount?: number  // ✅ اضافه شد
}

// Type برای مشتری با invoices (برای Payment Modal)
type CustomerWithOpenInvoices = ExtendedCustomer & {
  invoices: InvoiceForDebt[]
}

interface UseCustomersDataOptions {
  customerLimit?: number
  invoiceLimit?: number
}

interface UseCustomersDataResult {
  customersWithDebt: CustomerWithDebt[]
  customersWithOpenInvoices: CustomerWithOpenInvoices[]
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
  isLoading: boolean
  isError: boolean
  error: Error | null
  refetch: () => void
}

// ============================================================
// 🎯 هوک اصلی
// ============================================================

export function useCustomersData(
  options: UseCustomersDataOptions = {}
): UseCustomersDataResult {
  const { customerLimit = 500, invoiceLimit = 500 } = options

  const {
    data: customersData,
    isLoading: customersLoading,
    isError: customersError,
    error: customersErrorObj,
    refetch: refetchCustomers,
  } = useCustomers({
    page: 1,
    limit: customerLimit,
    sortDirection: "desc",
  })

  const {
    data: invoicesData,
    isLoading: invoicesLoading,
    isError: invoicesError,
    error: invoicesErrorObj,
    refetch: refetchInvoices,
  } = useInvoices({
    page: 1,
    limit: invoiceLimit,
    sortDirection: "desc",
  })

  const isLoading = customersLoading || invoicesLoading
  const isError = customersError || invoicesError
  const error = customersErrorObj || invoicesErrorObj

  const refetch = useMemo(() => {
    return () => {
      refetchCustomers()
      refetchInvoices()
    }
  }, [refetchCustomers, refetchInvoices])

  // ============================================================
  // 🧮 محاسبات اصلی
  // ============================================================

  const result = useMemo(() => {
    const customers = (customersData?.customers || []) as ExtendedCustomer[]
    const invoices = (invoicesData?.invoices || []) as ExtendedInvoice[]

    // محاسبه برای هر مشتری
    const enrichedCustomers = customers.map((customer): CustomerWithOpenInvoices => {
      // پیدا کردن فاکتورهای این مشتری
      const customerInvoices = invoices.filter(
        (inv) =>
          inv.customerId === customer.id ||
          inv.customer_id === customer.id
      )

      // فاکتورهای باز (پرداخت نشده)
      const openInvoices = customerInvoices.filter(
        (inv) => inv.status !== "paid" && inv.status !== "cancelled"
      )

      // محاسبه‌ی کل بدهی
      const totalDebt = openInvoices.reduce((sum, inv) => {
        const paid = inv.paidAmount || inv.paid_amount || 0
        return sum + Math.max(0, (inv.total || 0) - paid)
      }, 0)

      // کل خریدها
      const totalPurchases = customerInvoices.reduce(
        (sum, inv) => sum + (inv.total || 0),
        0
      )

      // آخرین فاکتور (با `date`)
      const sortedInvoices = [...customerInvoices].sort(
        (a, b) =>
          new Date(b.date || 0).getTime() -
          new Date(a.date || 0).getTime()
      )
      const lastInvoice = sortedInvoices[0]

      // ✅ وضعیت عقب‌افتادگی (فقط از `due_date` استفاده کن)
      const now = new Date()
      const isOverdue = openInvoices.some((inv) => {
        const dueDate = inv.due_date  // ✅ فقط due_date
        return dueDate ? new Date(dueDate) < now : false
      })

      // محاسبه‌ی VIP
      const tags = [...(customer.tags || [])]
      if (totalPurchases > 100000 && !tags.includes("vip")) {
        tags.push("vip")
      }

      // ✅ بازگشت با تمام فیلدهای موردنیاز
      return {
        ...customer,
        id: customer.id,
        fullName: customer.fullName || (customer as any).full_name || "",
        name: customer.fullName || (customer as any).full_name || "",
        phone: customer.phone || "",
        totalDebt,
        openCount: openInvoices.length,
        totalPurchases,
        lastInvoiceDate: lastInvoice?.date || null,  // ✅ حالا در type وجود دارد
        isOverdue,
        tags,
        invoices: openInvoices,
        paidAmount: 0,
      }
    })

    // ============================================================
    // 📊 محاسبه‌ی KPIها
    // ============================================================

    const totalCustomers = enrichedCustomers.length
    const totalDebt = enrichedCustomers.reduce(
      (sum, c) => sum + (c.totalDebt || 0),
      0
    )
    const debtorCount = enrichedCustomers.filter((c) => (c.totalDebt || 0) > 0).length
    const openDealsCount = enrichedCustomers.reduce(
      (sum, c) => sum + (c.openCount || 0),
      0
    )
    const overdueCount = enrichedCustomers.filter((c) => c.isOverdue).length
    const vipCount = enrichedCustomers.filter((c) => c.tags?.includes("vip")).length

    // فروش امروز
    const today = new Date().toISOString().slice(0, 10)
    const todaySales = invoices
      .filter((inv) => {
        const invDate = (inv.date || "").slice(0, 10)
        return invDate === today && inv.status !== "cancelled"
      })
      .reduce((sum, inv) => sum + (inv.total || 0), 0)

    // کل فروش (مجموع خرید همه‌ی مشتریان)
    const totalSales = enrichedCustomers.reduce(
      (sum, c) => sum + (c.totalPurchases || 0),
      0
    )

    // پرخریدترین مشتری
    const topCustomer = enrichedCustomers.reduce<ExtendedCustomer | null>(
      (top, c) =>
        (c.totalPurchases || 0) > (top?.totalPurchases || 0) ? c : top,
      null
    )
    const topCustomerName =
      topCustomer && (topCustomer.totalPurchases || 0) > 0
        ? topCustomer.fullName || topCustomer.name || null
        : null
    const topCustomerAmount = topCustomer?.totalPurchases || 0

    return {
      customersWithDebt: enrichedCustomers,
      customersWithOpenInvoices: enrichedCustomers,
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
    }
  }, [customersData, invoicesData])

  return {
    ...result,
    isLoading,
    isError,
    error,
    refetch,
  }
}