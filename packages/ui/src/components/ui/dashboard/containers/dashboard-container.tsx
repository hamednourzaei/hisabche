// packages/ui/src/components/ui/dashboard/containers/dashboard-container.tsx
"use client"

import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { useDashboard } from "../../../../hooks/use-dashboard"
import { DashboardView } from "../dashboard-view"
import { fmt } from "../../../../lib/dashboard-format"

export function DashboardContainer() {
  const { t } = useTranslation()
  const router = useRouter()
  const dashboard = useDashboard()

  const safeT = (key: string, fallback?: string) => {
    const v = t(key)
    return v !== key ? v : (fallback ?? key)
  }

  return (
    <DashboardView
      t={safeT}
      fmt={fmt}
      todaySales={dashboard.todaySales}
      lowStockCount={dashboard.lowStockCount}
      totalDebt={dashboard.totalDebt}
      invLoading={dashboard.invLoading}
      prodLoading={dashboard.prodLoading}
      recentInvoices={dashboard.recentInvoices}
      onNavigateGodam={() => router.push("/godam")}
      onNavigateBaqidari={() => router.push("/baqidari")}
      onNavigateQuickInvoice={() => router.push("/quick-invoice")}
      onNavigateInvoice={(id) => router.push(`/invoices/${id}`)}
      onViewAllInvoices={() => router.push("/invoices")}
    />
  )
}