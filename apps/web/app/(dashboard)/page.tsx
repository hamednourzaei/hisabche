"use client"

import { useMemo } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { useInvoices, useProducts, useTransactions } from "@hisabche/api"
import { Card, CardContent, CardHeader, CardTitle } from "@hisabche/ui"
import { TrendingUp, Package, Users, Receipt, AlertCircle } from "lucide-react"

// ═══ Types ═══
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

interface RecentInvoice {
  id: string
  customer: string
  total: number
  date: string
}

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const fmt = (v: unknown): string => num(v).toLocaleString("fa-AF")
const fmtDate = (d: string): string => {
  try { return new Date(d).toLocaleDateString("fa-AF") } catch { return d }
}

const todayStart = new Date()
todayStart.setHours(0, 0, 0, 0)

export default function DashboardPage() {
  const { t } = useTranslation()
  const router = useRouter()

  const { data: invoicesData } = useInvoices({ page: 1, limit: 5, sortDirection: "desc" })
  const { data: productsData } = useProducts({ page: 1, limit: 100, sortDirection: "desc", lowStock: true })
  const { data: txData } = useTransactions({ page: 1, limit: 1000, sortDirection: "desc" })

  const todaySales = useMemo(() => {
    if (!txData?.transactions) return 0
    return (txData.transactions as Transaction[])
      .filter((t: Transaction) => {
        const d = new Date(t.date || t.created_at || "")
        return d >= todayStart && (t.type === "sale" || t.type === "payment")
      })
      .reduce((sum: number, t: Transaction) => sum + num(t.amount), 0)
  }, [txData])

  const lowStockCount = ((productsData?.products || []) as Product[]).filter(
    (p: Product) => num(p.quantity) > 0 && num(p.quantity) <= num(p.min_stock_level ?? p.minStockLevel ?? 5)
  ).length || 0

  const totalDebt = useMemo(() => {
    if (!invoicesData?.invoices) return 0
    return (invoicesData.invoices as Invoice[])
      .filter((inv: Invoice) => (inv.status === "pending" || inv.status === "partial"))
      .reduce((sum: number, inv: Invoice) => {
        const remaining = num(inv.total) - num(inv.paid_amount ?? inv.paidAmount)
        return sum + (remaining > 0 ? remaining : 0)
      }, 0)
  }, [invoicesData])

  const recentInvoices: RecentInvoice[] = useMemo(() => {
    return ((invoicesData?.invoices || []) as Invoice[]).slice(0, 5).map((inv: Invoice) => ({
      id: inv.id ?? "",
      customer: inv.customer_name ?? inv.customerName ?? "بدون نام",
      total: num(inv.total),
      date: fmtDate(inv.date ?? inv.created_at ?? ""),
    }))
  }, [invoicesData])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-[var(--hisab-foreground)]">
          {t("dashboard.welcome") || "خوش آمدید"} 👋
        </h1>
        <p className="text-[var(--hisab-muted-fg)]">امروز چه خبر از کسب‌وکارت؟</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-[var(--hisab-muted-fg)]">
              {t("dashboard.todaySales") || "فروش امروز"}
            </CardTitle>
            <TrendingUp className="size-5 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{fmt(todaySales)} AFN</div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer transition-shadow hover:shadow-[var(--hisab-shadow-md)]" onClick={() => router.push("/godam")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-[var(--hisab-muted-fg)]">
              {t("dashboard.lowStockAlert") || "موجودی کم"}
            </CardTitle>
            <Package className="size-5 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{lowStockCount}</div>
            <p className="text-xs text-[var(--hisab-muted-fg)] mt-1">قلم نیاز به شارژ</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer transition-shadow hover:shadow-[var(--hisab-shadow-md)]" onClick={() => router.push("/baqidari")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-[var(--hisab-muted-fg)]">
              {t("dashboard.totalDebt") || "مجموع بدهی"}
            </CardTitle>
            <Users className="size-5 text-[var(--hisab-destructive)]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[var(--hisab-destructive)]">{fmt(totalDebt)} AFN</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="size-5" />
            {t("dashboard.recentInvoices") || "آخرین فاکتورها"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <AlertCircle className="size-12 text-[var(--hisab-muted-fg)]" />
              <p className="text-[var(--hisab-muted-fg)]">هنوز فاکتوری ثبت نشده</p>
              <button onClick={() => router.push("/quick-invoice")} className="mt-4 rounded-lg bg-[var(--hisab-primary)] px-6 py-2.5 text-sm font-medium text-white hover:bg-[var(--hisab-primary)]/90">
                {t("faktoor.newFaktoor") || "فاکتور جدید"}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {recentInvoices.map((inv: RecentInvoice) => (
                <div key={inv.id} className="flex cursor-pointer items-center justify-between rounded-lg border border-[var(--hisab-border)] p-4 hover:bg-[var(--hisab-muted)] transition-colors" onClick={() => router.push(`/invoices/${inv.id}`)}>
                  <div>
                    <p className="font-medium text-[var(--hisab-foreground)]">{inv.customer}</p>
                    <p className="text-sm text-[var(--hisab-muted-fg)]">{inv.date}</p>
                  </div>
                  <div className="text-right font-semibold text-[var(--hisab-foreground)]">{fmt(inv.total)} AFN</div>
                </div>
              ))}
              <button onClick={() => router.push("/invoices")} className="mt-4 w-full rounded-lg border border-[var(--hisab-border)] py-3 text-sm font-medium hover:bg-[var(--hisab-muted)] transition-colors">
                {t("dashboard.viewAllInvoices") || "مشاهده همه فاکتورها"}
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}