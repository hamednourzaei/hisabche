"use client"

import { Card, CardContent, CardHeader, CardTitle } from "../card"
import { Button } from "../button"
import { Skeleton } from "../skeleton"
import { TrendingUp, Package, Users, Receipt, ArrowUpRight, PlusCircle, Sparkles, type LucideIcon } from "lucide-react"

interface RecentInvoice { 
  id: string
  customer: string
  total: number
  date: string 
}

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

interface StatCardProps {
  label: string
  value: string
  hint?: string
  Icon: LucideIcon
  tone: Tone
  onClick?: () => void
  isLoading?: boolean
}

function StatCard({ label, value, hint, Icon, tone, onClick, isLoading }: StatCardProps) {
  const Wrap = onClick ? "button" : "div"
  return (
    <Wrap
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={`glass-card group relative overflow-hidden rounded-xl p-5 text-start motion-safe:transition-all motion-safe:hover:-translate-y-0.5 ${
        onClick ? "cursor-pointer" : "cursor-default"
      } bg-gradient-to-br ${TONE_BG[tone]} border border-white/10`}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${TONE_ICON[tone]}`}>
          <Icon className="size-5" aria-hidden />
        </div>
        {onClick && (
          <ArrowUpRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
        )}
      </div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      {isLoading ? (
        <Skeleton className="h-8 w-32 rounded-lg" />
      ) : (
        <p className="text-2xl font-bold tabular-nums sm:text-3xl text-foreground">{value}</p>
      )}
      {hint && <p className="mt-1.5 text-[10px] text-muted-foreground">{hint}</p>}
    </Wrap>
  )
}

function InvoiceRowSkeleton() {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-card/50 p-4">
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-32 rounded-md" />
        <Skeleton className="h-3 w-20 rounded-md" />
      </div>
      <Skeleton className="h-4 w-24 rounded-md" />
    </div>
  )
}

function RecentInvoiceRow({ inv, onClick }: { inv: RecentInvoice; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="interactive-card group flex w-full items-center justify-between rounded-xl p-4 text-start motion-safe:transition-all hover:bg-muted/50"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500/15 to-cyan-500/15 text-primary">
          <Receipt className="size-4" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{inv.customer}</p>
          <p className="text-xs text-muted-foreground">{inv.date}</p>
        </div>
      </div>
      <div className="ms-3 shrink-0 font-bold tabular-nums text-foreground">
        {inv.total.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">AFN</span>
      </div>
    </button>
  )
}

function EmptyInvoices({ onCreate, t }: { onCreate: () => void; t: (key: string, fallback?: string) => string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-gradient-to-br from-purple-500/15 to-cyan-500/15">
          <Receipt className="size-7 text-primary" aria-hidden />
        </div>
      </div>
      <div className="space-y-1">
        <p className="font-semibold text-foreground">{t("dashboard.empty.title", "آماده‌ی اولین فروش")}</p>
        <p className="text-sm text-muted-foreground">{t("dashboard.empty.subtitle", "یک فاکتور ثبت کن تا ماجرا شروع بشه")}</p>
      </div>
      <Button onClick={onCreate} className="shimmer-btn mt-2 inline-flex items-center gap-2 rounded-xl">
        <PlusCircle className="size-4" aria-hidden />
        {t("faktoor.newFaktoor", "فاکتور جدید")}
      </Button>
    </div>
  )
}

function Greeting({ t }: { t: (key: string, fallback?: string) => string }) {
  const h = new Date().getHours()
  const k = h < 12 ? "morning" : h < 17 ? "afternoon" : h < 21 ? "evening" : "night"
  const greetings = { 
    morning: "صبح بخیر", 
    afternoon: "ظهر بخیر", 
    evening: "عصر بخیر", 
    night: "شب بخیر" 
  }
  return (
    <div className="space-y-1.5">
      <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl text-foreground">
        {t(`dashboard.greeting.${k}`, greetings[k])}
        <Sparkles className="size-5 text-primary" aria-hidden />
      </h1>
      <p className="text-sm text-muted-foreground">{t("dashboard.subtitle", "امروز چه خبر از کسب‌وکارت؟")}</p>
    </div>
  )
}

export interface DashboardPageProps {
  t: (key: string, fallback?: string) => string
  fmt: (v: number) => string
  todaySales: number
  lowStockCount: number
  totalDebt: number
  txLoading: boolean
  prodLoading: boolean
  invLoading: boolean
  recentInvoices: RecentInvoice[]
  onNavigateGodam: () => void
  onNavigateBaqidari: () => void
  onNavigateQuickInvoice: () => void
  onNavigateInvoices: () => void
  onNavigateInvoice: (id: string) => void
  onViewAllInvoices: () => void
}

export function DashboardPage({
  t,
  fmt,
  todaySales,
  lowStockCount,
  totalDebt,
  txLoading,
  prodLoading,
  invLoading,
  recentInvoices,
  onNavigateGodam,
  onNavigateBaqidari,
  onNavigateQuickInvoice,
  onNavigateInvoices,
  onNavigateInvoice,
  onViewAllInvoices,
}: DashboardPageProps) {
  return (
    <div className="space-y-6">
      <Greeting t={t} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label={t("dashboard.todaySales", "فروش امروز")}
          value={`${fmt(todaySales)} AFN`}
          Icon={TrendingUp}
          tone="emerald"
          isLoading={txLoading}
        />

        <StatCard
          label={t("dashboard.lowStockAlert", "موجودی کم")}
          value={fmt(lowStockCount)}
          hint={t("dashboard.lowStockHint", "قلم نیاز به شارژ")}
          Icon={Package}
          tone="amber"
          isLoading={prodLoading}
          onClick={onNavigateGodam}
        />

        <StatCard
          label={t("dashboard.totalDebt", "مجموع بدهی")}
          value={`${fmt(totalDebt)} AFN`}
          Icon={Users}
          tone="rose"
          isLoading={invLoading}
          onClick={onNavigateBaqidari}
        />
      </div>

      <Card className="glass-card border border-white/10 bg-card/40 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="size-5 text-primary" aria-hidden />
            {t("dashboard.recentInvoices", "آخرین فاکتورها")}
          </CardTitle>
        </CardHeader>

        <CardContent>
          {invLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <InvoiceRowSkeleton key={i} />
              ))}
            </div>
          ) : recentInvoices.length === 0 ? (
            <EmptyInvoices onCreate={onNavigateQuickInvoice} t={t} />
          ) : (
            <div className="space-y-3">
              {recentInvoices.map((inv) => (
                <RecentInvoiceRow key={inv.id} inv={inv} onClick={() => onNavigateInvoice(inv.id)} />
              ))}

              <Button
                variant="outline"
                onClick={onViewAllInvoices}
                className="mt-2 w-full rounded-xl border-dashed"
              >
                {t("dashboard.viewAllInvoices", "مشاهده همه فاکتورها")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}