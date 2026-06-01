"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@hisabche/ui"
import { TrendingUp, Package, Users, Receipt, ArrowUpRight, PlusCircle, Sparkles, type LucideIcon } from "lucide-react"

interface RecentInvoice { id: string; customer: string; total: number; date: string }
type Tone = "emerald" | "amber" | "rose"

const TONE_BG: Record<Tone, string> = {
  emerald: "from-emerald-500/10 to-emerald-500/[0.02]",
  amber: "from-amber-500/10 to-amber-500/[0.02]",
  rose: "from-rose-500/10 to-rose-500/[0.02]",
}
const TONE_ICON: Record<Tone, string> = {
  emerald: "bg-emerald-500/15 text-emerald-500",
  amber: "bg-amber-500/15 text-amber-500",
  rose: "bg-rose-500/15 text-rose-500",
}

function StatCard({ label, value, hint, Icon, tone, onClick, isLoading, delay }: {
  label: string; value: string; hint?: string; Icon: LucideIcon; tone: Tone; onClick?: () => void; isLoading?: boolean; delay?: string
}) {
  const Wrap = onClick ? "button" : "div"
  return (
    <Wrap {...(onClick ? { type: "button" as const, onClick } : {})} style={delay ? { animationDelay: delay } : undefined}
      className={`glass-card group relative overflow-hidden p-5 text-start motion-safe:transition-all motion-safe:hover:-translate-y-0.5 ${onClick ? "cursor-pointer" : "cursor-default"} bg-gradient-to-br ${TONE_BG[tone]}`}>
      <div className="mb-4 flex items-center justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${TONE_ICON[tone]}`}><Icon className="size-5" aria-hidden /></div>
        {onClick && <ArrowUpRight className="size-4 text-[var(--hisab-muted-fg)] opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />}
      </div>
      <p className="mb-1 text-xs font-medium text-[var(--hisab-muted-fg)]">{label}</p>
      {isLoading ? <div className="skeleton-shimmer h-8 w-32 rounded-lg" /> : <p className="text-2xl font-bold tabular-nums sm:text-3xl">{value}</p>}
      {hint && <p className="mt-1.5 text-[10px] text-[var(--hisab-muted-fg)]">{hint}</p>}
    </Wrap>
  )
}

function InvoiceRowSkeleton() {
  return <div className="flex items-center justify-between rounded-xl border border-[var(--hisab-border)] bg-[var(--hisab-card)]/50 p-4"><div className="space-y-2"><div className="skeleton-shimmer h-3.5 w-32 rounded-md" /><div className="skeleton-shimmer h-3 w-20 rounded-md" /></div><div className="skeleton-shimmer h-4 w-24 rounded-md" /></div>
}

function RecentInvoiceRow({ inv, onClick }: { inv: RecentInvoice; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="interactive-card group flex w-full items-center justify-between rounded-xl p-4 motion-safe:transition-all">
      <div className="flex min-w-0 flex-1 items-center gap-3 text-start">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500/15 to-cyan-500/15 text-[var(--hisab-primary)]"><Receipt className="size-4" aria-hidden /></div>
        <div className="min-w-0"><p className="truncate text-sm font-semibold">{inv.customer}</p><p className="text-xs text-[var(--hisab-muted-fg)]">{inv.date}</p></div>
      </div>
      <div className="ms-3 shrink-0 font-bold tabular-nums">{inv.total} <span className="text-xs font-normal text-[var(--hisab-muted-fg)]">AFN</span></div>
    </button>
  )
}

function EmptyInvoices({ onCreate, t }: { onCreate: () => void; t: (key: string, fallback?: string) => string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-[var(--hisab-primary)]/20 blur-2xl" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--hisab-border)] bg-gradient-to-br from-purple-500/15 to-cyan-500/15"><Receipt className="size-7 text-[var(--hisab-primary)]" aria-hidden /></div>
      </div>
      <div className="space-y-1"><p className="font-semibold">{t("dashboard.empty.title", "آماده‌ی اولین فروش")}</p><p className="text-sm text-[var(--hisab-muted-fg)]">{t("dashboard.empty.subtitle", "یک فاکتور ثبت کن تا ماجرا شروع بشه")}</p></div>
      <button onClick={onCreate} className="shimmer-btn mt-2 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold"><PlusCircle className="size-4" aria-hidden />{t("faktoor.newFaktoor", "فاکتور جدید")}</button>
    </div>
  )
}

function Greeting({ t }: { t: (key: string, fallback?: string) => string }) {
  const h = new Date().getHours()
  const k = h < 12 ? "morning" : h < 17 ? "afternoon" : h < 21 ? "evening" : "night"
  const greetings = { morning: "صبح بخیر", afternoon: "ظهر بخیر", evening: "عصر بخیر", night: "شب بخیر" }
  return (
    <div className="space-y-1.5">
      <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">{t(`dashboard.greeting.${k}`, greetings[k])}<Sparkles className="size-5 text-[var(--hisab-primary)]" aria-hidden /></h1>
      <p className="text-sm text-[var(--hisab-muted-fg)]">{t("dashboard.subtitle", "امروز چه خبر از کسب‌وکارت؟")}</p>
    </div>
  )
}

export interface DashboardPageProps {
  t: (key: string, fallback?: string) => string; fmt: (v: number) => string
  todaySales: number; lowStockCount: number; totalDebt: number
  txLoading: boolean; prodLoading: boolean; invLoading: boolean
  recentInvoices: RecentInvoice[]
  onNavigateGodam: () => void; onNavigateBaqidari: () => void
  onNavigateQuickInvoice: () => void; onNavigateInvoices: () => void
  onNavigateInvoice: (id: string) => void; onViewAllInvoices: () => void
}

export function DashboardPage({
  t, fmt, todaySales, lowStockCount, totalDebt,
  txLoading, prodLoading, invLoading, recentInvoices,
  onNavigateGodam, onNavigateBaqidari, onNavigateQuickInvoice,
  onNavigateInvoices, onNavigateInvoice, onViewAllInvoices,
}: DashboardPageProps) {
  return (
    <div className="space-y-6">
      <Greeting t={t} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label={t("dashboard.todaySales", "فروش امروز")} value={`${fmt(todaySales)} AFN`} Icon={TrendingUp} tone="emerald" isLoading={txLoading} delay="0.05s" />
        <StatCard label={t("dashboard.lowStockAlert", "موجودی کم")} value={fmt(lowStockCount)} hint={t("dashboard.lowStockHint", "قلم نیاز به شارژ")} Icon={Package} tone="amber" isLoading={prodLoading} onClick={onNavigateGodam} delay="0.12s" />
        <StatCard label={t("dashboard.totalDebt", "مجموع بدهی")} value={`${fmt(totalDebt)} AFN`} Icon={Users} tone="rose" isLoading={invLoading} onClick={onNavigateBaqidari} delay="0.19s" />
      </div>
      <Card className="glass-card">
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Receipt className="size-5 text-[var(--hisab-primary)]" aria-hidden />{t("dashboard.recentInvoices", "آخرین فاکتورها")}</CardTitle></CardHeader>
        <CardContent>
          {invLoading ? (
            <div className="space-y-3">{[0, 1, 2].map((i) => <InvoiceRowSkeleton key={i} />)}</div>
          ) : recentInvoices.length === 0 ? (
            <EmptyInvoices onCreate={onNavigateQuickInvoice} t={t} />
          ) : (
            <div className="space-y-3">
              {recentInvoices.map((inv) => <RecentInvoiceRow key={inv.id} inv={inv} onClick={() => onNavigateInvoice(inv.id)} />)}
              <button onClick={onViewAllInvoices} className="mt-2 w-full rounded-xl border border-dashed border-[var(--hisab-border)] py-3 text-sm font-medium text-[var(--hisab-muted-fg)] transition-all hover:border-[var(--hisab-primary)]/40 hover:bg-[var(--hisab-card)]/60 hover:text-[var(--hisab-foreground)]">{t("dashboard.viewAllInvoices", "مشاهده همه فاکتورها")}</button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}