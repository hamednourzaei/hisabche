"use client";

import { memo, useEffect, useState, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   LandingPreview v4 — Memoized · Performance Optimized
   ✅ memo · useMemo · useCallback · safeT wrapper
   ═══════════════════════════════════════════════════════════════════════════ */

const CHART_HEIGHTS = [42, 68, 48, 82, 58, 92, 72, 86, 64, 78];

// ─── KpiCard ─────────────────────────────────────────────────────────────────

const KpiCard = memo(function KpiCard({
  label,
  value,
  change,
  tone,
}: {
  label: string;
  value: string;
  change: string;
  tone: "success" | "destructive";
}) {
  const changeColor =
    tone === "success"
      ? "text-[hsl(var(--color-success))]"
      : "text-[hsl(var(--color-destructive))]";

  return (
    <div
      className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-2.5 transition-shadow duration-200 hover:shadow-[var(--ledger-shadow,0_4px_24px_rgba(0,0,0,0.12))]"
      role="group"
      aria-label={`${label}: ${value}, ${change}`}
    >
      <div className="mb-1 text-[9px] text-[hsl(var(--fg-tertiary))]">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-sm font-bold tabular-nums text-[hsl(var(--fg-primary))]">
          {value}
        </span>
        <span className={cn("text-[10px] font-medium", changeColor)}>{change}</span>
      </div>
    </div>
  );
});
KpiCard.displayName = "KpiCard";

// ─── ChartBars ───────────────────────────────────────────────────────────────

const ChartBars = memo(function ChartBars({
  t,
}: {
  t: (key: string, fallback: string) => string;
}) {
  return (
    <div
      className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-3"
      role="img"
      aria-label={t("dashboard.salesChart", "نمودار فروش")}
    >
      <div className="flex h-[60px] items-end gap-1">
        {CHART_HEIGHTS.map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm bg-[hsl(var(--color-primary)/0.15)] transition-all duration-200 hover:bg-[hsl(var(--color-primary)/0.35)]"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
});
ChartBars.displayName = "ChartBars";

// ─── InvoiceFeed ─────────────────────────────────────────────────────────────

const InvoiceFeed = memo(function InvoiceFeed({
  t,
}: {
  t: (key: string, fallback: string) => string;
}) {
  const invoices = useMemo(
    () => [
      {
        name: t("landing.previewCustomer1", "احمد رحمانی"),
        amount: "۴۵,۰۰۰",
        status: t("invoices.paid", "پرداخت"),
        tone: "success" as const,
      },
      {
        name: t("landing.previewCustomer2", "فاطمه کریمی"),
        amount: "۱۲۰,۰۰۰",
        status: t("invoices.unpaid", "بدهی"),
        tone: "destructive" as const,
      },
    ],
    [t]
  );

  return (
    <div className="overflow-hidden rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]">
      <div className="bg-[hsl(var(--surface-muted)/0.4)] px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--fg-secondary))]">
        {t("landing.recentTransactions", "آخرین تراکنش‌ها")}
      </div>
      {invoices.map((inv, i) => (
        <div
          key={i}
          className="flex items-center justify-between border-b border-[hsl(var(--border-default))] px-3 py-2.5 last:border-0"
          role="listitem"
        >
          <div className="flex items-center gap-2 text-start min-w-0">
            <div
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--color-primary)/0.1)] text-[10px] font-medium text-[hsl(var(--color-primary))]"
              aria-hidden="true"
            >
              {inv.name[0]}
            </div>
            <span className="text-[11px] text-[hsl(var(--fg-primary))] truncate">
              {inv.name}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-medium tabular-nums text-[hsl(var(--fg-primary))]">
              {inv.amount} ؋
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-medium",
                inv.tone === "success"
                  ? "bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))] border border-[hsl(var(--color-success)/0.2)]"
                  : "bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))] border border-[hsl(var(--color-destructive)/0.2)]"
              )}
            >
              {inv.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
});
InvoiceFeed.displayName = "InvoiceFeed";

// ─── useInView Hook ─────────────────────────────────────────────────────────

function useInView(threshold = 0.05) {
  const [inView, setInView] = useState(false);
  const ref = useCallback(
    (el: HTMLDivElement | null) => {
      if (!el) return;
      const obs = new IntersectionObserver(
        ([e]) => {
          if (e?.isIntersecting) {
            setInView(true);
            obs.disconnect();
          }
        },
        { threshold }
      );
      obs.observe(el);
    },
    [threshold]
  );
  return { ref, inView };
}

// ─── Main Component ─────────────────────────────────────────────────────────

export const LandingPreview = memo(function LandingPreview() {
  const tOriginal = useTranslations();

  const t = (key: string, fallback?: string): string => {

    const v = tOriginal(key as Parameters<typeof tOriginal>[0]);

    return v && v !== key ? v : (fallback ?? key);

  };

  // ✅ safeT wrapper


  const { ref, inView } = useInView(0.05);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (inView) setHydrated(true);
  }, [inView]);

  const kpiData = useMemo(
    () => [
      {
        label: t("dashboard.todaySales", "فروش امروز"),
        value: "۱۲۵,۰۰۰",
        change: "+۱۲٪",
        tone: "success" as const,
      },
      {
        label: t("landing.invoices", "فاکتورها"),
        value: "۲۴",
        change: "+۳",
        tone: "success" as const,
      },
      {
        label: t("dashboard.totalDebt", "بدهی"),
        value: "۸۵,۰۰۰",
        change: "-۵٪",
        tone: "destructive" as const,
      },
    ],
    [t]
  );

  return (
    <div
      ref={ref}
      className={cn(
        "relative mx-auto max-w-2xl transition-all duration-700",
        "motion-reduce:transition-none",
        inView ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
      )}
      role="complementary"
      aria-label={t("landing.previewAria", "پیش‌نمایش داشبورد حسابچه")}
    >
      <div
        className="absolute -bottom-4 start-3 end-3 h-full rounded-2xl border border-[hsl(var(--border-default)/0.5)] bg-[hsl(var(--surface-base)/0.5)]"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-2 start-1 end-1 h-full rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted)/0.7)]"
        aria-hidden="true"
      />
      <div className="relative overflow-hidden rounded-2xl border border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-elevated))] shadow-lg">
        <div className="flex items-center gap-2 border-b border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted)/0.3)] px-4 py-2.5">
          <div className="flex gap-1.5" aria-hidden="true">
            <div className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--color-destructive)/0.6)]" />
            <div className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--color-warning)/0.6)]" />
            <div className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--color-success)/0.6)]" />
          </div>
          <span className="ms-2 text-[10px] text-[hsl(var(--fg-tertiary))]">
            {t("nav.dashboard", "داشبورد")}
          </span>
          <span
            className={cn(
              "ms-auto inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-medium",
              "bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]",
              "border border-[hsl(var(--color-success)/0.2)]"
            )}
          >
            <span
              className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--color-success))]"
              aria-hidden="true"
            />
            {t("sync.online", "آنلاین")}
          </span>
        </div>

        {hydrated ? (
          <div className="space-y-3 p-4">
            <div
              className="grid grid-cols-3 gap-2"
              role="list"
              aria-label={t("landing.kpiAria", "شاخص‌های کلیدی")}
            >
              {kpiData.map((kpi, i) => (
                <KpiCard key={i} {...kpi} />
              ))}
            </div>
            <ChartBars t={t} />
            <InvoiceFeed t={t} />
          </div>
        ) : (
          <div className="h-[200px] p-4" />
        )}
      </div>

      <div
        className="absolute -end-4 -top-4 hidden rounded-xl border border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-elevated))] p-3 shadow-xl lg:block"
        aria-hidden="true"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--color-primary)/0.12)] text-sm">
            🧾
          </div>
          <div className="text-start">
            <div className="text-[10px] text-[hsl(var(--fg-tertiary))]">
              {t("invoices.newInvoice", "فاکتور جدید")}
            </div>
            <div className="text-xs font-semibold text-[hsl(var(--color-primary))]">
              INV-042
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

LandingPreview.displayName = "LandingPreview";