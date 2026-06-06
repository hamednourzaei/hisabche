// packages/ui/src/components/ui/dashboard/dashboard-view.tsx
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "../card"
import { Sparkles, Receipt, TrendingUp, Package, Users } from "lucide-react"
import { StatCard } from "./dashboard-stats"
import { DashboardInvoices } from "./dashboard-invoices"

// packages/ui/src/components/ui/dashboard/dashboard-view.tsx
interface DashboardViewProps {
  t: (key: string, fallback?: string) => string
  fmt: (v: number) => string
  todaySales: number
  lowStockCount: number
  totalDebt: number
  invLoading: boolean
  prodLoading: boolean
  recentInvoices: Array<{
    id: string
    customer: string
    total: number
    date: string
  }>
  onNavigateGodam: () => void
  onNavigateBaqidari: () => void
  onNavigateQuickInvoice: () => void
  onNavigateInvoice: (id: string) => void
  onViewAllInvoices: () => void
}

function Greeting({ t }: { t: (key: string, fallback?: string) => string }) {
  const h = new Date().getHours()
  const k = h < 12 ? "morning" : h < 17 ? "afternoon" : h < 21 ? "evening" : "night"
  const greetings = {
    morning: "صبح بخیر",
    afternoon: "ظهر بخیر",
    evening: "عصر بخیر",
    night: "شب بخیر",
  }
  return (
    <div className="space-y-1.5">
      <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl text-foreground">
        {t(`dashboard.greeting.${k}`, greetings[k])}
        <Sparkles className="size-5 text-primary" aria-hidden />
      </h1>
      <p className="text-sm text-muted-foreground">
        {t("dashboard.subtitle", "امروز چه خبر از کسب‌وکارت؟")}
      </p>
    </div>
  )
}

export function DashboardView({
  t,
  fmt,
  todaySales,
  lowStockCount,
  totalDebt,
  invLoading,
  prodLoading,
  recentInvoices,
  onNavigateGodam,
  onNavigateBaqidari,
  onNavigateQuickInvoice,
  onNavigateInvoice,
  onViewAllInvoices,
}: DashboardViewProps) {
  return (
    <div className="space-y-6">
      <Greeting t={t} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label={t("dashboard.todaySales", "فروش امروز")}
          value={`${fmt(todaySales)} AFN`}
          Icon={TrendingUp}
          tone="emerald"
          isLoading={false}
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
          <DashboardInvoices
            t={t}
            invLoading={invLoading}
            recentInvoices={recentInvoices}
            onNavigateInvoice={onNavigateInvoice}
            onNavigateQuickInvoice={onNavigateQuickInvoice}
            onViewAllInvoices={onViewAllInvoices}
          />
        </CardContent>
      </Card>
    </div>
  )
}