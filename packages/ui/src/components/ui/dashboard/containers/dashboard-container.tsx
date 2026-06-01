"use client"

import { useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { useInvoices, useProducts } from "@hisabche/api"
import { DashboardPage } from "../dashboard-page"

/* ─── Typed KPI contract ─── */
interface DashboardSummary {
  todaySales: number
  totalDebt: number
  lowStockCount: number
}

interface InvoiceItem {
  id?: string; status?: string
  total?: number; paid_amount?: number; paidAmount?: number
  customer_name?: string; customerName?: string
  date?: string; created_at?: string
}

/* ─── Pure helpers ─── */
const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const fmt = (v: number): string => v.toLocaleString("fa-AF")
const fmtDate = (d: string): string => { try { return new Date(d).toLocaleDateString("fa-AF") } catch { return d } }

// ✅ Graceful degradation — safe defaults
const FALLBACK_KPI: DashboardSummary = { todaySales: 0, totalDebt: 0, lowStockCount: 0 }

export function DashboardContainer() {
  const { t } = useTranslation()
  const router = useRouter()

  // ✅ KPI from invoices (financial) — typed, no `any`
  const { data: invoicesData, isLoading: invLoading } = useInvoices({
    page: 1, limit: 5, sortDirection: "desc",
  })
  const kpi = (invoicesData as { summary?: DashboardSummary } | undefined)?.summary ?? FALLBACK_KPI

  // ✅ Inventory from products — independent, safe fallback
  const { data: productsData, isLoading: prodLoading } = useProducts({
    page: 1, limit: 100, sortDirection: "desc", lowStock: true,
  })

  const recentInvoices = useMemo(
    () => ((invoicesData as any)?.invoices ?? []).slice(0, 5).map((inv: InvoiceItem) => ({
      id: inv.id ?? "",
      customer: inv.customer_name ?? inv.customerName ?? t("common.noName"),
      total: num(inv.total ?? 0),
      date: fmtDate(inv.date ?? inv.created_at ?? ""),
    })),
    [invoicesData, t],
  )

  const safeT = useCallback(
    (key: string, fallback?: string) => { const v = t(key); return v !== key ? v : (fallback ?? key) },
    [t],
  )

  const nav = useMemo(() => ({
    godam: () => router.push("/godam"),
    baqidari: () => router.push("/baqidari"),
    quickInvoice: () => router.push("/quick-invoice"),
    invoices: () => router.push("/invoices"),
    invoice: (id: string) => router.push(`/invoices/${id}`),
    viewAll: () => router.push("/invoices"),
  }), [router])

  return (
    <DashboardPage
      t={safeT}
      fmt={fmt}
      todaySales={kpi.todaySales}
      lowStockCount={kpi.lowStockCount}
      totalDebt={kpi.totalDebt}
      txLoading={false}
      prodLoading={prodLoading}
      invLoading={invLoading}
      recentInvoices={recentInvoices}
      onNavigateGodam={nav.godam}
      onNavigateBaqidari={nav.baqidari}
      onNavigateQuickInvoice={nav.quickInvoice}
      onNavigateInvoices={nav.invoices}
      onNavigateInvoice={nav.invoice}
      onViewAllInvoices={nav.viewAll}
    />
  )
}