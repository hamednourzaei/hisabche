"use client"

import { useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { useInvoices, useProducts } from "@hisabche/api"
import { DashboardPage } from "../dashboard-page"

interface Product {
  quantity?: number | string
  min_stock_level?: number | string; minStockLevel?: number | string
}
interface Invoice {
  id?: string; status?: string
  total?: number | string
  paid_amount?: number | string; paidAmount?: number | string
  customer_name?: string; customerName?: string
  date?: string; created_at?: string
}

const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const fmt = (v: number): string => v.toLocaleString("fa-AF")
const fmtDate = (d: string): string => { try { return new Date(d).toLocaleDateString("fa-AF") } catch { return d } }
const isOpen = (s?: string) => s === "pending" || s === "partial"

export function DashboardContainer() {
  const { t } = useTranslation()
  const router = useRouter()

  const { data: invoicesData, isLoading: invLoading } = useInvoices({
    page: 1, limit: 5, sortDirection: "desc",
  })
  const { data: productsData, isLoading: prodLoading } = useProducts({
    page: 1, limit: 100, sortDirection: "desc", lowStock: true,
  })

  // ✅ KPI from backend summary — zero client filter/reduce
  const todaySales = (invoicesData as any)?.summary?.todaySales ?? 0
  const totalDebt = (invoicesData as any)?.summary?.totalDebt ?? 0
  const lowStockCount = (invoicesData as any)?.summary?.lowStockCount ?? 0

  const recentInvoices = useMemo(
    () => ((invoicesData?.invoices || []) as Invoice[]).slice(0, 5).map((inv) => ({
      id: inv.id ?? "",
      customer: inv.customer_name ?? inv.customerName ?? t("common.noName"),
      total: num(inv.total),
      date: fmtDate(inv.date ?? inv.created_at ?? ""),
    })),
    [invoicesData, t],
  )

  const safeT = useCallback(
    (key: string, fallback?: string) => { const v = t(key); return v !== key ? v : (fallback ?? key) },
    [t],
  )

  return (
    <DashboardPage
      t={safeT}
      fmt={fmt}
      todaySales={todaySales}
      lowStockCount={lowStockCount}
      totalDebt={totalDebt}
      txLoading={false}
      prodLoading={prodLoading}
      invLoading={invLoading}
      recentInvoices={recentInvoices}
      onNavigateGodam={() => router.push("/godam")}
      onNavigateBaqidari={() => router.push("/baqidari")}
      onNavigateQuickInvoice={() => router.push("/quick-invoice")}
      onNavigateInvoices={() => router.push("/invoices")}
      onNavigateInvoice={(id) => router.push(`/invoices/${id}`)}
      onViewAllInvoices={() => router.push("/invoices")}
    />
  )
}