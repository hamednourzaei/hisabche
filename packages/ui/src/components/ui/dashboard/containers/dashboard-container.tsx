"use client"

import { useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { useInvoices, useProducts, useTransactions } from "@hisabche/api"
import { DashboardPage } from "../dashboard-page"

interface Transaction {
  date?: string
  created_at?: string
  type?: string
  amount?: number | string
}

interface Product {
  quantity?: number | string
  min_stock_level?: number | string
  minStockLevel?: number | string
}

interface Invoice {
  id?: string
  status?: string
  total?: number | string
  paid_amount?: number | string
  paidAmount?: number | string
  customer_name?: string
  customerName?: string
  date?: string
  created_at?: string
}

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const fmt = (v: number): string => v.toLocaleString("fa-AF")

const fmtDate = (d: string): string => {
  try {
    return new Date(d).toLocaleDateString("fa-AF")
  } catch {
    return d
  }
}

const todayStart = new Date()
todayStart.setHours(0, 0, 0, 0)

export function DashboardContainer() {
  const { t } = useTranslation()
  const router = useRouter()

  const { data: invoicesData, isLoading: invLoading } = useInvoices({
    page: 1,
    limit: 5,
    sortDirection: "desc",
  })

  const { data: productsData, isLoading: prodLoading } = useProducts({
    page: 1,
    limit: 100,
    sortDirection: "desc",
    lowStock: true,
  })

  const { data: txData, isLoading: txLoading } = useTransactions({
    page: 1,
    limit: 1000,
    sortDirection: "desc",
  })

  const todaySales = useMemo(() => {
    if (!txData?.transactions) return 0
    return (txData.transactions as Transaction[])
      .filter((tr) => {
        const d = new Date(tr.date || tr.created_at || "")
        return d >= todayStart && (tr.type === "sale" || tr.type === "payment")
      })
      .reduce((sum, tr) => sum + num(tr.amount), 0)
  }, [txData])

  const lowStockCount = useMemo(
    () =>
      ((productsData?.products || []) as Product[]).filter(
        (p) =>
          num(p.quantity) > 0 &&
          num(p.quantity) <= num(p.min_stock_level ?? p.minStockLevel ?? 5)
      ).length,
    [productsData]
  )

  const totalDebt = useMemo(() => {
    if (!invoicesData?.invoices) return 0
    return (invoicesData.invoices as Invoice[])
      .filter(
        (inv) => inv.status === "pending" || inv.status === "partial"
      )
      .reduce((sum, inv) => {
        const r = num(inv.total) - num(inv.paid_amount ?? inv.paidAmount)
        return sum + (r > 0 ? r : 0)
      }, 0)
  }, [invoicesData])

  const recentInvoices = useMemo(
    () =>
      ((invoicesData?.invoices || []) as Invoice[])
        .slice(0, 5)
        .map((inv) => ({
          id: inv.id ?? "",
          customer:
            inv.customer_name ??
            inv.customerName ??
            t("common.noName", "بدون نام"),
          total: num(inv.total),
          date: fmtDate(inv.date ?? inv.created_at ?? ""),
        })),
    [invoicesData, t]
  )

  const safeT = useCallback(
    (key: string, fallback?: string) => {
      const v = t(key)
      return v && v !== key ? v : (fallback ?? key)
    },
    [t]
  )

  const handleNavigateGodam = useCallback(
    () => router.push("/godam"),
    [router]
  )
  const handleNavigateBaqidari = useCallback(
    () => router.push("/baqidari"),
    [router]
  )
  const handleNavigateQuickInvoice = useCallback(
    () => router.push("/quick-invoice"),
    [router]
  )
  const handleNavigateInvoices = useCallback(
    () => router.push("/invoices"),
    [router]
  )
  const handleNavigateInvoice = useCallback(
    (id: string) => router.push(`/invoices/${id}`),
    [router]
  )
  const handleViewAllInvoices = useCallback(
    () => router.push("/invoices"),
    [router]
  )

  return (
    <DashboardPage
      t={safeT}
      fmt={fmt}
      todaySales={todaySales}
      lowStockCount={lowStockCount}
      totalDebt={totalDebt}
      txLoading={txLoading}
      prodLoading={prodLoading}
      invLoading={invLoading}
      recentInvoices={recentInvoices}
      onNavigateGodam={handleNavigateGodam}
      onNavigateBaqidari={handleNavigateBaqidari}
      onNavigateQuickInvoice={handleNavigateQuickInvoice}
      onNavigateInvoices={handleNavigateInvoices}
      onNavigateInvoice={handleNavigateInvoice}
      onViewAllInvoices={handleViewAllInvoices}
    />
  )
}