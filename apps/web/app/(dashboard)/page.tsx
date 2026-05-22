"use client"

import { useMemo } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { useInvoices, useProducts, useTransactions } from "@hisabche/api"
import { Card, CardContent, CardHeader, CardTitle } from "@hisabche/ui"
import {
  TrendingUp, Package, Users, Receipt,
  ArrowUpRight, PlusCircle, Sparkles, type LucideIcon,
} from "lucide-react"

// ═══ Types (UNCHANGED) ═══
interface Transaction { date?: string; created_at?: string; type?: string; amount?: number | string }
interface Product { quantity?: number | string; min_stock_level?: number | string; minStockLevel?: number | string }
interface Invoice {
  id?: string; status?: string; total?: number | string
  paid_amount?: number | string; paidAmount?: number | string
  customer_name?: string; customerName?: string
  date?: string; created_at?: string
}
interface RecentInvoice { id: string; customer: string; total: number; date: string }

// ═══ Helpers (UNCHANGED) ═══
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

// ═══ Greeting ═══
function Greeting() {
  const { t } = useTranslation()
  const h = new Date().getHours()
  const k = h < 12 ? "morning" : h < 17 ? "afternoon" : h < 21 ? "evening" : "night"
  const fb = { morning: "صبح بخیر", afternoon: "ظهر بخیر", evening: "عصر بخیر", night: "شب بخیر" }[k]
  return (
    <div className="space-y-1.5">
      <h1 className="flex items-center gap-2 text-2xl sm:text-3xl font-bold text-[var(--hisab-foreground)]">
        {t(`dashboard.greeting.${k}`) || fb}
        <Sparkles className="size-5 text-[var(--hisab-primary)]" aria-hidden />
      </h1>
      <p className="text-sm text-[var(--hisab-muted-fg)]">
        {t("dashboard.subtitle") || "امروز چه خبر از کسب‌وکارت؟"}
      </p>
    </div>
  )
}

// ═══ Stat card ═══
type Tone = "emerald" | "amber" | "rose"
interface StatCardProps {
  label: string
  value: string
  hint?: string
  Icon: LucideIcon
  tone: Tone
  onClick?: () => void
  isLoading?: boolean
  delay?: string
}

const TONE_BG: Record<Tone, string> = {
  emerald: "from-emerald-500/10 to-emerald-500/[0.02] border-emerald-500/20",
  amber:   "from-amber-500/10   to-amber-500/[0.02]   border-amber-500/20",
  rose:    "from-rose-500/10    to-rose-500/[0.02]    border-rose-500/20",
}
const TONE_ICON: Record<Tone, string> = {
  emerald: "bg-emerald-500/15 text-emerald-500",
  amber:   "bg-amber-500/15 text-amber-500",
  rose:    "bg-rose-500/15 text-rose-500",
}

function StatCard({ label, value, hint, Icon, tone, onClick, isLoading, delay }: StatCardProps) {
  const Wrap = onClick ? "button" : "div"
  return (
    <Wrap
      {...(onClick ? { type: "button" as const, onClick } : {})}
      style={delay ? { animationDelay: delay } : undefined}
      className={`stat-card group relative overflow-hidden rounded-2xl border bg-gradient-to-br ${TONE_BG[tone]} p-5 text-right backdrop-blur-xl transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 ${onClick ? "cursor-pointer" : "cursor-default"}`}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${TONE_ICON[tone]}`}>
          <Icon className="size-5" aria-hidden />
        </div>
        {onClick && (
          <ArrowUpRight className="size-4 text-[var(--hisab-muted-fg)] opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
        )}
      </div>
      <p className="mb-1 text-xs font-medium text-[var(--hisab-muted-fg)]">{label}</p>
      {isLoading
        ? <div className="h-8 w-32 animate-pulse rounded-md bg-[var(--hisab-muted-fg)]/15" />
        : <div className="text-2xl sm:text-3xl font-bold tabular-nums text-[var(--hisab-foreground)]">{value}</div>
      }
      {hint && <p className="mt-1.5 text-[10px] text-[var(--hisab-muted-fg)]">{hint}</p>}
    </Wrap>
  )
}

// ═══ Invoice row ═══
function InvoiceRowSkeleton() {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[var(--hisab-border)] bg-[var(--hisab-card)]/50 p-4">
      <div className="space-y-2">
        <div className="h-3.5 w-32 animate-pulse rounded bg-[var(--hisab-muted-fg)]/15" />
        <div className="h-3 w-20 animate-pulse rounded bg-[var(--hisab-muted-fg)]/10" />
      </div>
      <div className="h-4 w-24 animate-pulse rounded bg-[var(--hisab-muted-fg)]/15" />
    </div>
  )
}

function RecentInvoiceRow({ inv, onClick }: { inv: RecentInvoice; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center justify-between rounded-xl border border-[var(--hisab-border)] bg-[var(--hisab-card)]/40 p-4 backdrop-blur-sm transition-all hover:border-[var(--hisab-primary)]/30 hover:bg-[var(--hisab-card)]/70 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hisab-primary)]/40"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3 text-right">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500/15 to-cyan-500/15 text-[var(--hisab-primary)]">
          <Receipt className="size-4" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--hisab-foreground)]">{inv.customer}</p>
          <p className="text-xs text-[var(--hisab-muted-fg)]">{inv.date}</p>
        </div>
      </div>
      <div className="ml-3 shrink-0 font-bold tabular-nums text-[var(--hisab-foreground)]">
        {fmt(inv.total)} <span className="text-xs font-normal text-[var(--hisab-muted-fg)]">AFN</span>
      </div>
    </button>
  )
}

// ═══ Empty state ═══
function EmptyInvoices({ onCreate }: { onCreate: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-[var(--hisab-primary)]/20 blur-2xl" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--hisab-border)] bg-gradient-to-br from-purple-500/15 to-cyan-500/15">
          <Receipt className="size-7 text-[var(--hisab-primary)]" aria-hidden />
        </div>
      </div>
      <div className="space-y-1">
        <p className="font-semibold text-[var(--hisab-foreground)]">
          {t("dashboard.empty.title") || "آماده‌ی اولین فروش"}
        </p>
        <p className="text-sm text-[var(--hisab-muted-fg)]">
          {t("dashboard.empty.subtitle") || "یک فاکتور ثبت کن تا ماجرا شروع بشه"}
        </p>
      </div>
      <button
        onClick={onCreate}
        className="mt-2 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/20 transition-all hover:opacity-90 active:scale-95"
      >
        <PlusCircle className="size-4" aria-hidden />
        {t("faktoor.newFaktoor") || "فاکتور جدید"}
      </button>
    </div>
  )
}

// ═══ Main ═══
export default function DashboardPage() {
  const { t } = useTranslation()
  const router = useRouter()

  const { data: invoicesData, isLoading: invLoading } = useInvoices({ page: 1, limit: 5, sortDirection: "desc" })
  const { data: productsData, isLoading: prodLoading } = useProducts({ page: 1, limit: 100, sortDirection: "desc", lowStock: true })
  const { data: txData, isLoading: txLoading } = useTransactions({ page: 1, limit: 1000, sortDirection: "desc" })

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
    () => ((productsData?.products || []) as Product[]).filter(
      (p) => num(p.quantity) > 0 && num(p.quantity) <= num(p.min_stock_level ?? p.minStockLevel ?? 5)
    ).length,
    [productsData],
  )

  const totalDebt = useMemo(() => {
    if (!invoicesData?.invoices) return 0
    return (invoicesData.invoices as Invoice[])
      .filter((inv) => inv.status === "pending" || inv.status === "partial")
      .reduce((sum, inv) => {
        const remaining = num(inv.total) - num(inv.paid_amount ?? inv.paidAmount)
        return sum + (remaining > 0 ? remaining : 0)
      }, 0)
  }, [invoicesData])

  const recentInvoices: RecentInvoice[] = useMemo(
    () => ((invoicesData?.invoices || []) as Invoice[]).slice(0, 5).map((inv) => ({
      id: inv.id ?? "",
      customer: inv.customer_name ?? inv.customerName ?? (t("common.noName") || "بدون نام"),
      total: num(inv.total),
      date: fmtDate(inv.date ?? inv.created_at ?? ""),
    })),
    [invoicesData, t],
  )

  return (
    <div className="space-y-6 dash-fade">
      <Greeting />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label={t("dashboard.todaySales") || "فروش امروز"}
          value={`${fmt(todaySales)} AFN`}
          Icon={TrendingUp} tone="emerald" isLoading={txLoading} delay="0.05s"
        />
        <StatCard
          label={t("dashboard.lowStockAlert") || "موجودی کم"}
          value={fmt(lowStockCount)}
          hint={t("dashboard.lowStockHint") || "قلم نیاز به شارژ"}
          Icon={Package} tone="amber" isLoading={prodLoading}
          onClick={() => router.push("/godam")} delay="0.12s"
        />
        <StatCard
          label={t("dashboard.totalDebt") || "مجموع بدهی"}
          value={`${fmt(totalDebt)} AFN`}
          Icon={Users} tone="rose" isLoading={invLoading}
          onClick={() => router.push("/baqidari")} delay="0.19s"
        />
      </div>

      <Card className="border-[var(--hisab-border)] bg-[var(--hisab-card)]/60 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="size-5 text-[var(--hisab-primary)]" aria-hidden />
            {t("dashboard.recentInvoices") || "آخرین فاکتورها"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invLoading ? (
            <div className="space-y-3">{[0, 1, 2].map((i) => <InvoiceRowSkeleton key={i} />)}</div>
          ) : recentInvoices.length === 0 ? (
            <EmptyInvoices onCreate={() => router.push("/quick-invoice")} />
          ) : (
            <div className="space-y-3">
              {recentInvoices.map((inv) => (
                <RecentInvoiceRow key={inv.id} inv={inv} onClick={() => router.push(`/invoices/${inv.id}`)} />
              ))}
              <button
                onClick={() => router.push("/invoices")}
                className="mt-2 w-full rounded-xl border border-dashed border-[var(--hisab-border)] py-3 text-sm font-medium text-[var(--hisab-muted-fg)] transition-all hover:border-[var(--hisab-primary)]/40 hover:bg-[var(--hisab-card)]/60 hover:text-[var(--hisab-foreground)]"
              >
                {t("dashboard.viewAllInvoices") || "مشاهده همه فاکتورها"}
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      <style>{`
        @keyframes dashFade {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .dash-fade  { animation: dashFade 0.4s cubic-bezier(0.2, 0.8, 0.2, 1); }
        .stat-card  { animation: dashFade 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) backwards; }
        @media (prefers-reduced-motion: reduce) {
          .dash-fade, .stat-card { animation: none; }
        }
      `}</style>
    </div>
  )
}