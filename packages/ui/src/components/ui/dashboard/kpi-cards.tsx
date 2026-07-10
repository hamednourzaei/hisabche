// packages/ui/src/components/ui/dashboard/kpi-cards.tsx
"use client";

import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Package, Users, Receipt, AlertTriangle, Activity } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

interface KPIData {
  todaySales: number; todayInvoices: number; monthlyRevenue: number; monthlyGrowth: number;
  pendingPayments: number; activeCustomers: number; lowStockAlerts: number;
}

interface KPICardsProps { data: KPIData; isLoading: boolean; onNavigate: (route: string) => void; }

function KPICard({ label, value, sub, icon: Icon, tone, onClick, isLoading }: {
  label: string; value: string; sub?: string; icon: LucideIcon;
  tone: "primary" | "success" | "warning" | "danger" | "info"; onClick?: () => void; isLoading: boolean;
}) {
  const toneStyles = {
    primary: { bg: "from-[hsl(var(--color-primary)/0.1)] to-[hsl(var(--color-primary)/0.02)]", icon: "bg-[hsl(var(--color-primary)/0.15)] text-[hsl(var(--color-primary))]" },
    success: { bg: "from-[hsl(var(--color-success)/0.1)] to-[hsl(var(--color-success)/0.02)]", icon: "bg-[hsl(var(--color-success)/0.15)] text-[hsl(var(--color-success))]" },
    warning: { bg: "from-[hsl(var(--color-warning)/0.1)] to-[hsl(var(--color-warning)/0.02)]", icon: "bg-[hsl(var(--color-warning)/0.15)] text-[hsl(var(--color-warning))]" },
    danger: { bg: "from-[hsl(var(--color-destructive)/0.1)] to-[hsl(var(--color-destructive)/0.02)]", icon: "bg-[hsl(var(--color-destructive)/0.15)] text-[hsl(var(--color-destructive))]" },
    info: { bg: "from-[hsl(var(--color-info)/0.1)] to-[hsl(var(--color-info)/0.02)]", icon: "bg-[hsl(var(--color-info)/0.15)] text-[hsl(var(--color-info))]" },
  };
  const Wrap = onClick ? "button" : "div";

  return (
    <Wrap {...(onClick ? { type: "button" as const, onClick } : {})}
      className={cn("flex items-center gap-3 p-4 rounded-2xl text-start w-full", "border border-[hsl(var(--border-default))]", "bg-gradient-to-br", toneStyles[tone].bg, onClick && "cursor-pointer hover:-translate-y-0.5 transition-transform")}>
      <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl shrink-0", toneStyles[tone].icon)}><Icon className="size-5" aria-hidden="true" /></div>
      <div className="flex-1 min-w-0">
        {isLoading ? (<><div className="h-5 w-16 rounded bg-[hsl(var(--surface-muted))] animate-pulse mb-1" /><div className="h-3 w-20 rounded bg-[hsl(var(--surface-muted))] animate-pulse" /></>)
          : (<><p className="text-lg font-bold tabular-nums text-[hsl(var(--fg-primary))]">{value}</p><p className="text-xs text-[hsl(var(--fg-secondary))]">{label}</p></>)}
        {sub && !isLoading && <p className="text-[10px] text-[hsl(var(--fg-tertiary))] mt-0.5">{sub}</p>}
      </div>
    </Wrap>
  );
}

export function KPICards({ data, isLoading, onNavigate }: KPICardsProps) {
  const { t } = useTranslation();
  const fmt = (v: number) => (v === undefined || v === null || isNaN(v)) ? "۰" : v.toLocaleString("fa-AF");
  const growth = typeof data.monthlyGrowth === 'number' ? data.monthlyGrowth : 0;
  const growthDisplay = growth >= 0 ? `+${growth.toFixed(1)}%` : `${growth.toFixed(1)}%`;
  const growthIcon = growth >= 0 ? TrendingUp : TrendingDown;
  const growthTone = growth >= 0 ? "success" : "danger";

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <KPICard label={t("dashboard.todaySales", "فروش امروز")} value={`${fmt(data.todaySales)} AFN`}
        sub={t("dashboard.invoicesCount", `${data.todayInvoices} فاکتور`).replace("{count}", String(data.todayInvoices))}
        icon={TrendingUp} tone="primary" isLoading={isLoading} onClick={() => onNavigate("/invoices")} />
      <KPICard label={t("dashboard.monthlyRevenue", "درآمد ماهانه")} value={`${fmt(data.monthlyRevenue)} AFN`}
        sub={growthDisplay} icon={growthIcon} tone={growthTone} isLoading={isLoading} />
      <KPICard label={t("dashboard.pendingPayments", "پرداخت‌های معوق")} value={`${fmt(data.pendingPayments)} AFN`}
        icon={Receipt} tone="warning" isLoading={isLoading} onClick={() => onNavigate("/invoices")} />
      <KPICard label={t("dashboard.activeCustomers", "مشتریان فعال")} value={fmt(data.activeCustomers)}
        icon={Users} tone="info" isLoading={isLoading} onClick={() => onNavigate("/customers")} />
      <KPICard label={t("dashboard.lowStockAlerts", "هشدار موجودی")} value={fmt(data.lowStockAlerts)}
        sub={t("dashboard.itemsNeedReorder", "محصول نیازمند سفارش")}
        icon={AlertTriangle} tone={data.lowStockAlerts > 0 ? "danger" : "success"} isLoading={isLoading} onClick={() => onNavigate("/warehouse")} />
    </div>
  );
}