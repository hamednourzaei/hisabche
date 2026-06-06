// packages/ui/src/hooks/use-dashboard.ts
"use client"

import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useInvoices, useProducts } from "@hisabche/api"
import { mapRecentInvoices } from "../lib/dashboard-mappers"
import type { InvoicesResponse } from "../lib/dashboard-types"

export function useDashboard() {
  const { t } = useTranslation()

  const { data: invoicesData, isLoading: invLoading } = useInvoices({
    page: 1,
    limit: 5,
    sortDirection: "desc",
  }) as { data: InvoicesResponse | undefined; isLoading: boolean }

  const { data: productsData, isLoading: prodLoading } = useProducts({
    page: 1,
    limit: 100,
    sortDirection: "desc",
    lowStock: true,
  })

  const todaySales = (invoicesData as any)?.summary?.todaySales ?? 0
  const totalDebt = (invoicesData as any)?.summary?.totalDebt ?? 0
  const lowStockCount = (invoicesData as any)?.summary?.lowStockCount ?? 0

  const simpleT = (key: string): string => t(key)

  const recentInvoices = useMemo(
    () => mapRecentInvoices(invoicesData?.invoices, simpleT),
    [invoicesData, t]
  )

  return {
    todaySales,
    totalDebt,
    lowStockCount,
    recentInvoices,
    invLoading,
    prodLoading,
  }
}