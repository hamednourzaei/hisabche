// packages/ui/src/components/ui/dashboard/dashboard-view.tsx
"use client";

import { cn } from "@/lib/utils";
import { Sparkles, Receipt, TrendingUp, Package, Users } from "lucide-react";
import { StatCard } from "./dashboard-stats";
import { DashboardInvoices } from "./dashboard-invoices";

/* ═══════════════════════════════════════════════════════════════════════════
   DashboardView v3 — Hisabche Design Language
   Zero hardcoded colors — all tokens from design system
   No external component dependencies (Card, CardContent, etc. removed)
   ═══════════════════════════════════════════════════════════════════════════ */

interface DashboardViewProps {
  t: (key: string, fallback?: string) => string;
  fmt: (v: number) => string;
  todaySales: number;
  lowStockCount: number;
  totalDebt: number;
  invLoading: boolean;
  prodLoading: boolean;
  recentInvoices: Array<{
    id: string;
    customer: string;
    total: number;
    date: string;
  }>;
  onNavigateGodam: () => void;
  onNavigateBaqidari: () => void;
  onNavigateQuickInvoice: () => void;
  onNavigateInvoice: (id: string) => void;
  onViewAllInvoices: () => void;
}

function Greeting({ t }: { t: (key: string, fallback?: string) => string }) {
  const h = new Date().getHours();
  const k = h < 12 ? "morning" : h < 17 ? "afternoon" : h < 21 ? "evening" : "night";
  const greetings = {
    morning: "صبح بخیر",
    afternoon: "ظهر بخیر",
    evening: "عصر بخیر",
    night: "شب بخیر",
  };
  return (
    <div className="space-y-1.5">
      <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl text-[hsl(var(--fg-primary))]">
        {t(`dashboard.greeting.${k}`, greetings[k])}
        <Sparkles className="size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
      </h1>
      <p className="text-sm text-[hsl(var(--fg-secondary))]">
        {t("dashboard.subtitle", "امروز چه خبر از کسب‌وکارت؟")}
      </p>
    </div>
  );
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

      {/* Stat cards */}
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

      {/* Recent invoices card */}
      <div
        className={cn(
          "rounded-2xl border border-[hsl(var(--border-default))]",
          "bg-[hsl(var(--surface-elevated))]",
          "backdrop-blur-sm",
          "overflow-hidden",
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-6 pt-5 pb-3">
          <Receipt className="size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
          <h2 className="text-base font-semibold text-[hsl(var(--fg-primary))]">
            {t("dashboard.recentInvoices", "آخرین فاکتورها")}
          </h2>
        </div>

        {/* Content */}
        <div className="px-6 pb-5">
          <DashboardInvoices
            t={t}
            invLoading={invLoading}
            recentInvoices={recentInvoices}
            onNavigateInvoice={onNavigateInvoice}
            onNavigateQuickInvoice={onNavigateQuickInvoice}
            onViewAllInvoices={onViewAllInvoices}
          />
        </div>
      </div>
    </div>
  );
}