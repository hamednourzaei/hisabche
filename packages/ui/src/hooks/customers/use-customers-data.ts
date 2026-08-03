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
  createdAt?: string
  created_at?: string
}

// ============================================================
// 📈 کمک‌تابع‌های محاسبه‌ی درصد تغییر
// ============================================================

/** درصد تغییر؛ null یعنی داده‌ای برای مقایسه وجود ندارد */
function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? null : 100
  return ((current - previous) / Math.abs(previous)) * 100
}

/** شماره‌ی ماه نسبی: 0 = ماه جاری، 1 = ماه قبل */
function monthOffset(value: string | undefined | null, now: Date): number | null {
  if (!value) return null
  const d = new Date(value)
  if (isNaN(d.getTime())) return null
  return (
    (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
  )
}

/** اختلاف روز نسبت به امروز: 0 = امروز، 1 = دیروز */
function dayOffset(value: string | undefined | null, now: Date): number | null {
  if (!value) return null
  const d = new Date(value)
  if (isNaN(d.getTime())) return null
  const ms = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  return Math.round(ms / 86_400_000)
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
  /** درصد تغییر ماهانه */
  customersDelta: number | null
  salesDelta: number | null
  debtDelta: number | null
  topCustomerDelta: number | null
  /** درصد تغییر روزانه */
  todaySalesDelta: number | null
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

    // ============================================================
    // 📈 درصد تغییر (ماهانه / روزانه)
    // ============================================================
    const now = new Date()
    const activeInvoices = invoices.filter((inv) => inv.status !== "cancelled")
    const invoiceDate = (inv: ExtendedInvoice) => inv.date || inv.created_at

    const salesByMonth = (offset: number) =>
      activeInvoices
        .filter((inv) => monthOffset(invoiceDate(inv), now) === offset)
        .reduce((sum, inv) => sum + (inv.total || 0), 0)

    const debtByMonth = (offset: number) =>
      activeInvoices
        .filter(
          (inv) =>
            inv.status !== "paid" && monthOffset(invoiceDate(inv), now) === offset
        )
        .reduce(
          (sum, inv) =>
            sum + Math.max(0, (inv.total || 0) - (inv.paidAmount || inv.paid_amount || 0)),
          0
        )

    const customersByMonth = (offset: number) =>
      customers.filter(
        (c) => monthOffset(c.createdAt || c.created_at, now) === offset
      ).length

    const topCustomerByMonth = (offset: number) =>
      topCustomer
        ? activeInvoices
            .filter(
              (inv) =>
                (inv.customerId === topCustomer.id || inv.customer_id === topCustomer.id) &&
                monthOffset(invoiceDate(inv), now) === offset
            )
            .reduce((sum, inv) => sum + (inv.total || 0), 0)
        : 0

    const salesByDay = (offset: number) =>
      activeInvoices
        .filter((inv) => dayOffset(invoiceDate(inv), now) === offset)
        .reduce((sum, inv) => sum + (inv.total || 0), 0)

    const customersDelta = percentChange(customersByMonth(0), customersByMonth(1))
    const salesDelta = percentChange(salesByMonth(0), salesByMonth(1))
    const debtDelta = percentChange(debtByMonth(0), debtByMonth(1))
    const topCustomerDelta = percentChange(topCustomerByMonth(0), topCustomerByMonth(1))
    const todaySalesDelta = percentChange(salesByDay(0), salesByDay(1))

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
      customersDelta,
      salesDelta,
      debtDelta,
      topCustomerDelta,
      todaySalesDelta,
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