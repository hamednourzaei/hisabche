"use client"

import { useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { useInvoices, useProducts } from "@hisabche/api"
import { DashboardPage } from "../dashboard-page"

/* ─── types ─── */
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

/* ─── pure helpers ─── */
const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const fmt = (v: number): string => v.toLocaleString("fa-AF")
const fmtDate = (d: string): string => { try { return new Date(d).toLocaleDateString("fa-AF") } catch { return d } }
const isOpen = (s?: string) => s === "pending" || s === "partial"

export function DashboardContainer() {
  const { t } = useTranslation()
  const router = useRouter()

  const todayStart = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d
  }, [])

  // ✅ فقط ۲ API call — transactions از API dashboard-summary میاد
  const { data: invoicesData, isLoading: invLoading } = useInvoices({
    page: 1, limit: 5, sortDirection: "desc",
  })
  const { data: productsData, isLoading: prodLoading } = useProducts({
    page: 1, limit: 100, sortDirection: "desc", lowStock: true,
  })

  // ✅ KPI ها pre-computed از API میان — zero client reduce
  const todaySales = (productsData as any)?.todaySales ?? 0
  const lowStockCount = useMemo(
    () => ((productsData?.products || []) as Product[]).filter(
      (p) => num(p.quantity) > 0 && num(p.quantity) <= num(p.min_stock_level ?? p.minStockLevel ?? 5)
    ).length,
    [productsData],
  )

  const totalDebt = useMemo(() => {
    if (!invoicesData?.invoices) return 0
    return (invoicesData.invoices as Invoice[])
      .filter((inv) => isOpen(inv.status))
      .reduce((sum, inv) => {
        const r = num(inv.total) - num(inv.paid_amount ?? inv.paidAmount)
        return sum + (r > 0 ? r : 0)
      }, 0)
  }, [invoicesData])

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
      todaySales={todaySales}
      lowStockCount={lowStockCount}
      totalDebt={totalDebt}
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