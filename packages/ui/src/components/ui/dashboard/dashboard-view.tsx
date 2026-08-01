// packages/ui/src/components/ui/dashboard/dashboard-view.tsx
"use client";

import { memo, useId, useMemo } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  TrendingUp,
  Wallet,
  CreditCard,
  Boxes,
  Activity as ActivityIcon,
} from "lucide-react";
import { SalesChart, type ChartDataPoint } from "./sales-chart";
import { DateRangePicker, type DateRange, type PresetKey } from "./date-range-picker";
import type { AIInsight } from "@hisabche/api";
import type { ActivityGroupDto } from "@hisabche/api";
import dynamic from "next/dynamic";

// ─── Types ────────────────────────────────────────────────────────────────

type Translate = (key: string, fallback?: string) => string;

interface DashboardViewProps {
  t: Translate;
  fmt: (v: number) => string;

  // KPI Data
  totalSales: number;
  todaySales: number;
  customerDebt: number;
  warehouseValue: number;

  // Loading States
  kpiLoading: boolean;
  insightsLoading: boolean;
  chartLoading: boolean;
  activitiesLoading: boolean;

  // AI Insights
  insights: AIInsight[];

  // Chart Data
  salesChartData: ChartDataPoint[];
  dateRange: DateRange;

  // Activities
  recentActivities: ActivityGroupDto[];

  // Actions
  onNavigate: (route: string) => void;
  onInsightAction: (action: string) => void;
  onDateRangeChange: (range: DateRange, preset: PresetKey) => void;
}

// ─── Lazy Load Components ─────────────────────────────────────────────────

const LazySalesChart = dynamic(
  () => import("./sales-chart").then(mod => mod.SalesChart),
  {
    ssr: false,
    loading: () => <div className="h-[180px] sm:h-[200px] rounded-2xl bg-[hsl(var(--surface-muted))] animate-pulse" />
  }
);

// ─── Greeting ──────────────────────────────────────────────────────────────

const Greeting = memo(function Greeting({
  t,
}: {
  t: Translate;
}) {
  const h = new Date().getHours();
  const k = h < 12 ? "morning" : h < 17 ? "afternoon" : h < 21 ? "evening" : "night";
  const label = k === "morning" ? "صبح بخیر" : k === "afternoon" ? "ظهر بخیر" : k === "evening" ? "عصر بخیر" : "شب بخیر";

  return (
    <header className="space-y-1 sm:space-y-1.5">
      <h1 className="flex items-center gap-1.5 sm:gap-2 text-xl sm:text-2xl md:text-3xl font-bold text-[hsl(var(--fg-primary))]">
        {t(`dashboard.greeting.${k}`, label)}
        <Sparkles className="size-4 sm:size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
      </h1>
      <p className="text-xs sm:text-sm text-[hsl(var(--fg-secondary))]">
        {t("dashboard.subtitle")}
      </p>
    </header>
  );
});
Greeting.displayName = "Greeting";

// ─── KPI Card + Sparkline ───────────────────────────────────────────────────

// اسپارک‌لاین SVG سبک (بدون کتابخانه‌ی جداگانه) — فقط برای کارت‌هایی که
// سری زمانی واقعی دارند رنگی/جهت‌دار رسم می‌شود؛ برای کارت‌هایی که هنوز
// اسنپ‌شات تاریخی ندارند (بدهی مشتریان، ارزش انبار) یک خط خنثی نمایش داده
// می‌شود تا روند غلط/جعلی به کاربر نشان داده نشود.
const Sparkline = memo(function Sparkline({ values }: { values: number[] | null }) {
  const id = useId();
  if (!values || values.length < 2) {
    return (
      <svg viewBox="0 0 100 28" className="w-full h-7" aria-hidden="true">
        <line x1="0" y1="20" x2="100" y2="20" stroke="hsl(var(--border-strong))" strokeWidth="2" strokeDasharray="2 3" />
      </svg>
    );
  }
  // ✅ FIX: Math.min(...values)/Math.max(...values) با آرایه‌ی نسبتاً بزرگ
  // (مثلاً بازه‌ی زمانی طولانی در نمودار فروش) می‌تواند Call Stack را پر کند
  // و کل تب مرورگر را کرش کند (نه یک خطای قابل catch در React) — چون
  // spread کردن آرگومان‌ها به یک تابع، هر عنصر را یک آرگومان جداگانه می‌کند.
  // با یک حلقه‌ی ساده، این محدودیت اندازه‌ی آرایه از بین می‌رود.
  let min = values[0]!;
  let max = values[0]!;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min || 1;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * 100;
      const y = 26 - ((v - min) / range) * 24;
      return `${x},${y}`;
    })
    .join(" ");
  const trendingUp = values[values.length - 1]! >= values[0]!;
  const color = trendingUp ? "hsl(var(--status-positive))" : "hsl(var(--status-negative))";

  return (
    <svg viewBox="0 0 100 28" className="w-full h-7" aria-hidden="true">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
});
Sparkline.displayName = "Sparkline";

const KpiCard = memo(function KpiCard({
  icon: Icon,
  label,
  value,
  trend,
  isLoading,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  trend: number[] | null;
  isLoading: boolean;
}) {
  if (isLoading) {
    return <div className="h-[104px] rounded-2xl bg-[hsl(var(--surface-muted))] animate-pulse" />;
  }
  return (
    <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-[hsl(var(--color-primary))]" aria-hidden="true" />
        <span className="text-xs text-[hsl(var(--fg-secondary))]">{label}</span>
      </div>
      <p className="text-xl font-bold tabular-nums text-[hsl(var(--fg-primary))]">{value}</p>
      <Sparkline values={trend} />
    </div>
  );
});
KpiCard.displayName = "KpiCard";

// ─── AI Insights (عمودی) ────────────────────────────────────────────────────

const AIInsightsPanel = memo(function AIInsightsPanel({
  insights,
  isLoading,
  onAction,
}: {
  insights: AIInsight[];
  isLoading: boolean;
  onAction: (action: string) => void;
}) {
  const tOriginal = useTranslations();
  const t = (key: string, fallback?: string) => {
    const v = tOriginal(key as Parameters<typeof tOriginal>[0]);
    return v && v !== key ? v : (fallback ?? key);
  };

  return (
    <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] overflow-hidden">
      <div className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 pt-4 sm:pt-5 pb-2 sm:pb-3">
        <Sparkles className="size-4 sm:size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
        <h2 className="text-sm sm:text-base font-semibold text-[hsl(var(--fg-primary))]">
          {t("dashboard.aiInsights", "پیشنهادهای هوشمند")}
        </h2>
      </div>
      <div className="px-4 sm:px-6 pb-4 sm:pb-5 space-y-2.5">
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-16 rounded-xl bg-[hsl(var(--surface-muted))] animate-pulse" />
            <div className="h-16 rounded-xl bg-[hsl(var(--surface-muted))] animate-pulse" />
          </div>
        ) : insights.length === 0 ? (
          <p className="text-xs text-[hsl(var(--fg-tertiary))] py-4 text-center">
            {t("dashboard.noInsights", "فعلاً پیشنهادی وجود ندارد")}
          </p>
        ) : (
          insights.map((insight, i) => (
            <div
              key={i}
              className="rounded-xl border border-[hsl(var(--color-primary)/0.2)] bg-[hsl(var(--color-primary)/0.05)] p-3"
            >
              <p className="text-xs sm:text-sm font-medium text-[hsl(var(--fg-primary))]">{insight.title}</p>
              <p className="text-[11px] sm:text-xs text-[hsl(var(--fg-secondary))] mt-0.5">{insight.description}</p>
              {insight.action && (
                <button
                  onClick={() => onAction(insight.action!)}
                  className="mt-1.5 text-[11px] sm:text-xs font-medium text-[hsl(var(--color-primary))] hover:underline focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))] rounded-md"
                >
                  {insight.actionLabel || t("dashboard.aiInsight.action")}
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
});
AIInsightsPanel.displayName = "AIInsightsPanel";

// ─── Recent Activities (پایین صفحه) ─────────────────────────────────────────

const RecentActivities = memo(function RecentActivities({
  groups,
  isLoading,
  onNavigate,
}: {
  groups: ActivityGroupDto[];
  isLoading: boolean;
  onNavigate: (route: string) => void;
}) {
  const tOriginal = useTranslations();
  const t = (key: string, fallback?: string) => {
    const v = tOriginal(key as Parameters<typeof tOriginal>[0]);
    return v && v !== key ? v : (fallback ?? key);
  };

  const items = useMemo(
    () =>
      groups
        .flatMap((g) =>
          (g.activities ?? []).map((a) => ({
            ...a,
            entitySummary: g.entitySummary ?? { route: "", label: "" },
          }))
        )
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 8),
    [groups]
  );

  return (
    <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] overflow-hidden">
      <div className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 pt-4 sm:pt-5 pb-2 sm:pb-3">
        <ActivityIcon className="size-4 sm:size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
        <h2 className="text-sm sm:text-base font-semibold text-[hsl(var(--fg-primary))]">
          {t("dashboard.recentActivities", "فعالیت‌های اخیر")}
        </h2>
      </div>
      <div className="px-4 sm:px-6 pb-4 sm:pb-5">
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 rounded-xl bg-[hsl(var(--surface-muted))] animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-xs text-[hsl(var(--fg-tertiary))] py-4 text-center">
            {t("dashboard.noActivities", "فعالیتی ثبت نشده است")}
          </p>
        ) : (
          <ul className="divide-y divide-[hsl(var(--border-default)/0.6)]">
            {items.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => a.entitySummary.route && onNavigate(a.entitySummary.route)}
                  className="w-full flex items-center justify-between gap-3 py-2.5 text-start hover:bg-[hsl(var(--surface-muted)/0.5)] rounded-lg px-2 -mx-2 transition-colors duration-150"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-[hsl(var(--fg-primary))] truncate">{a.title}</p>
                    <p className="text-[11px] text-[hsl(var(--fg-tertiary))] truncate">{a.entitySummary.label}</p>
                  </div>
                  <span className="text-[11px] text-[hsl(var(--fg-tertiary))] shrink-0">
                    {new Date(a.timestamp).toLocaleDateString("fa-AF")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
});
RecentActivities.displayName = "RecentActivities";

// ─── Main Component ───────────────────────────────────────────────────────

export const DashboardView = memo(function DashboardView(props: DashboardViewProps) {
  const {
    t,
    fmt,
    totalSales,
    todaySales,
    customerDebt,
    warehouseValue,
    kpiLoading,
    insights,
    insightsLoading,
    salesChartData,
    chartLoading,
    dateRange,
    activitiesLoading,
    recentActivities,
    onNavigate,
    onInsightAction,
    onDateRangeChange,
  } = props;

  const salesTrend = useMemo(
    () => (salesChartData.length > 1 ? salesChartData.map((d) => d.value) : null),
    [salesChartData]
  );

  const previousDaySalesTotal = useMemo(() => {
    if (!salesChartData || salesChartData.length === 0) return 0;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];
    return salesChartData.find((d) => d.date === yesterdayStr)?.value ?? 0;
  }, [salesChartData]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Level 1: Context */}
      <Greeting t={t} />

      {/* Level 2: KPI cards — ۴ کارت افقی */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard icon={TrendingUp} label={t("dashboard.totalSales", "فروش کل")} value={fmt(totalSales)} trend={salesTrend} isLoading={kpiLoading} />
        <KpiCard icon={Wallet} label={t("dashboard.todaySales", "فروش امروز")} value={fmt(todaySales)} trend={salesTrend} isLoading={kpiLoading} />
        <KpiCard icon={CreditCard} label={t("dashboard.customerDebt", "بدهی مشتریان")} value={fmt(customerDebt)} trend={null} isLoading={kpiLoading} />
        <KpiCard icon={Boxes} label={t("dashboard.warehouseValue", "ارزش کل انبار")} value={fmt(warehouseValue)} trend={null} isLoading={kpiLoading} />
      </div>

      {/* Level 3: Chart + AI Insights (عمودی، جای قبلی صورت‌حساب‌های اخیر) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2">
          <div className={cn(
            "rounded-2xl border border-[hsl(var(--border-default))]",
            "bg-[hsl(var(--surface-elevated))]",
            "p-4 sm:p-5"
          )}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 mb-3 sm:mb-4">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <TrendingUp className="size-4 sm:size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
                <h2 className="text-sm sm:text-base font-semibold text-[hsl(var(--fg-primary))]">
                  {t("dashboard.salesChartTitle", "نمودار فروش")}
                </h2>
              </div>
              <DateRangePicker
                value={dateRange}
                onChange={onDateRangeChange}
                t={t}
                disabled={chartLoading}
              />
            </div>
            <LazySalesChart
              data={salesChartData}
              isLoading={chartLoading}
              fmt={fmt}
              height={180}
              previousPeriodTotal={previousDaySalesTotal}
              currentPeriodTotal={todaySales}
              onViewFullReport={() => onNavigate("/reports")}
            />
          </div>
        </div>

        <div className="lg:col-span-1">
          <AIInsightsPanel insights={insights} isLoading={insightsLoading} onAction={onInsightAction} />
        </div>
      </div>

      {/* Level 4: Recent Activities — انتهای صفحه */}
      <RecentActivities groups={recentActivities} isLoading={activitiesLoading} onNavigate={onNavigate} />
    </div>
  );
});

DashboardView.displayName = "DashboardView";
