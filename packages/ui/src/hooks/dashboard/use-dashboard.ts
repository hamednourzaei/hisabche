// packages/ui/src/hooks/dashboard/use-dashboard.ts
"use client"

import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useInvoices, useProducts, useDashboardKPIs, useAIInsights } from "@hisabche/api"
import { mapRecentInvoices } from "../../lib/dashboard/dashboard-mappers"
import { useCurrency } from "./use-currency" // ✅ حذف type CurrencyCode
import type { InvoicesResponse } from "../../lib/dashboard/dashboard-types"

// ─── Types ─────────────────────────────────────────────────────────────────

interface InvoicesSummary {
  todaySales?: number
  todayCount?: number
  monthlyRevenue?: number
  totalDebt?: number
  customerCount?: number
  pendingCount?: number
}

interface ProductsSummary {
  lowStockCount?: number
  lowStockItems?: Array<{
    id: string
    name: string
    quantity: number
    reorderPoint: number
  }>
}

// ✅ تعریف تایپ صحیح برای ProductsResponse
interface ProductsResponse {
  products?: Array<{
    id: string
    name: string
    quantity: number
    reorderPoint: number
  }>
  summary?: ProductsSummary
}

type InvoicesResponseWithSummary = InvoicesResponse & { summary?: InvoicesSummary }
type ProductsResponseWithSummary = ProductsResponse & { summary?: ProductsSummary }

// ─── Main Hook ─────────────────────────────────────────────────────────────

export function useDashboard() {
  const { t } = useTranslation()
  const currency = useCurrency() // ✅ بدون آرگومان

  // 1. Fetch KPI data
  const {
    data: kpis,
    isLoading: kpiLoading,
    isError: kpiError,
  } = useDashboardKPIs()

  // 2. Fetch AI Insights
  const { 
    data: insights, 
    isLoading: insightsLoading 
  } = useAIInsights()

  // 3. Fetch Invoices (limited to 5 recent)
  const {
    data: invoicesData,
    isLoading: invLoading,
    isError: invError,
  } = useInvoices(
    { page: 1, limit: 5, sortDirection: "desc" }
  ) as { data: InvoicesResponseWithSummary | undefined; isLoading: boolean; isError: boolean }

  // 4. Fetch Products (for low stock alerts)
  const {
    data: productsData,
    isLoading: prodLoading,
    isError: prodError,
  } = useProducts(
    { page: 1, limit: 100, sortDirection: "desc" }
  ) as { data: ProductsResponseWithSummary | undefined; isLoading: boolean; isError: boolean }

  // 5. Determine if we need to use fallback data
  const needsFallback = kpiError || (!kpiLoading && !kpis)
  const usingFallbackData = needsFallback && (!!invoicesData || !!productsData)
  const hasAnyError = kpiError || invError || prodError

  // 6. Compute derived values with fallbacks
  const todaySales = kpis?.todaySales ?? invoicesData?.summary?.todaySales ?? 0
  const todayInvoices = kpis?.todayInvoices ?? invoicesData?.summary?.todayCount ?? 0
  const monthlyRevenue = kpis?.monthlyRevenue ?? invoicesData?.summary?.monthlyRevenue ?? 0
  const monthlyGrowth = kpis?.monthlyGrowth ?? 0
  const pendingPayments = kpis?.pendingPayments ?? invoicesData?.summary?.totalDebt ?? 0
  const pendingPaymentsCount = kpis?.pendingPaymentsCount ?? invoicesData?.summary?.pendingCount ?? 0
  const activeCustomers = kpis?.activeCustomers ?? invoicesData?.summary?.customerCount ?? 0
  const customerGrowth = kpis?.customerGrowth ?? 0
  const lowStockAlerts = kpis?.lowStockAlerts ?? productsData?.summary?.lowStockCount ?? 0
  const totalDebt = invoicesData?.summary?.totalDebt ?? 0

  // 7. Compute low stock items from products data
  const lowStockItems = useMemo(() => {
    // ✅ ابتدا از summary استفاده می‌کنیم
    if (productsData?.summary?.lowStockItems) {
      return productsData.summary.lowStockItems
    }
    
    // ✅ سپس از products array
    if (!productsData?.products) return []
    
    return productsData.products
      .filter(p => p.quantity <= p.reorderPoint)
      .slice(0, 5)
      .map(p => ({
        name: p.name,
        quantity: p.quantity
      }))
  }, [productsData])

  // 8. Map recent invoices
  const simpleT = (key: string): string => t(key)
  
  const recentInvoices = useMemo(
    () => mapRecentInvoices(invoicesData?.invoices, simpleT),
    [invoicesData, t],
  )

  // 9. Return unified dashboard data
  return {
    // KPI Data
    todaySales,
    todayInvoices,
    monthlyRevenue,
    monthlyGrowth,
    pendingPayments,
    pendingPaymentsCount,
    activeCustomers,
    customerGrowth,
    lowStockAlerts,
    lowStockItems,
    totalDebt,
    
    // Recent Invoices
    recentInvoices,
    
    // AI Insights
    insights: insights ?? [],
    
    // Loading States
    isLoading: kpiLoading || (needsFallback && (invLoading || prodLoading)),
    kpiLoading,
    insightsLoading,
    invLoading,
    prodLoading,
    
    // Status
    isError: hasAnyError,
    usingFallbackData,
    needsFallback,
    
    // Utility functions
    fmt: currency.format, // ✅ از currency.format استفاده می‌کند
    getSymbol: currency.getSymbol,
    t,
  }
}