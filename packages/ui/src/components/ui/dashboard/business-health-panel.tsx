// packages/ui/src/components/ui/dashboard/business-health-panel.tsx
"use client";

import { memo, useMemo, useId } from "react"; // ✅ useId اضافه شد
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { 
  TrendingUp, 
  TrendingDown, 
  Receipt, 
  AlertTriangle, 
  Package, 
  Users,
  ArrowRight,
  CheckCircle,
  Clock,
  FileText
} from "lucide-react";
import { useCurrency } from "../../../hooks/dashboard/use-currency"; // ✅ استفاده از currency service

// ─── Types ────────────────────────────────────────────────────────────────

interface BusinessHealthData {
  todaySales: number;
  todayInvoices: number;
  monthlyRevenue: number;
  monthlyGrowth: number;
  pendingPayments: number;
  pendingPaymentsCount: number;
  activeCustomers: number;
  customerGrowth: number;
  lowStockAlerts: number;
  lowStockItems: Array<{ name: string; quantity: number }>;
}

interface BusinessHealthPanelProps {
  data: BusinessHealthData;
  isLoading: boolean;
  onAction: (action: "invoice" | "payments" | "warehouse" | "customers") => void;
}

// ─── Skeleton ──────────────────────────────────────────────────────────────

const BusinessHealthSkeleton = memo(function BusinessHealthSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-32 rounded-2xl bg-[hsl(var(--surface-muted))] animate-pulse" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-24 rounded-2xl bg-[hsl(var(--surface-muted))] animate-pulse" />
        <div className="h-24 rounded-2xl bg-[hsl(var(--surface-muted))] animate-pulse" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="h-20 rounded-2xl bg-[hsl(var(--surface-muted))] animate-pulse" />
        <div className="h-20 rounded-2xl bg-[hsl(var(--surface-muted))] animate-pulse" />
      </div>
    </div>
  );
});
BusinessHealthSkeleton.displayName = "BusinessHealthSkeleton";

// ─── Status Badge ──────────────────────────────────────────────────────────

const StatusBadge = memo(function StatusBadge({ status }: { status: "excellent" | "good" | "neutral" | "attention" }) {
  const { t } = useTranslation();
  
  // ✅ useMemo برای جلوگیری از rebuild در هر render
  const statusMap = useMemo(() => ({
    excellent: {
      icon: CheckCircle,
      label: t("status.excellent"),
      className: "bg-[hsl(var(--status-positive)/0.1)] text-[hsl(var(--status-positive))] border-[hsl(var(--status-positive)/0.2)]"
    },
    good: {
      icon: TrendingUp,
      label: t("status.good"),
      className: "bg-[hsl(var(--status-info)/0.1)] text-[hsl(var(--status-info))] border-[hsl(var(--status-info)/0.2)]"
    },
    neutral: {
      icon: Clock,
      label: t("status.neutral"),
      className: "bg-[hsl(var(--status-warning)/0.1)] text-[hsl(var(--status-warning))] border-[hsl(var(--status-warning)/0.2)]"
    },
    attention: {
      icon: AlertTriangle,
      label: t("status.attention"),
      className: "bg-[hsl(var(--status-negative)/0.1)] text-[hsl(var(--status-negative))] border-[hsl(var(--status-negative)/0.2)]"
    }
  }), [t]);

  const { icon: Icon, label, className } = statusMap[status];

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border",
      className
    )}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </span>
  );
});
StatusBadge.displayName = "StatusBadge";

// ─── BusinessHealthHero ────────────────────────────────────────────────────

const BusinessHealthHero = memo(function BusinessHealthHero({
  todaySales,
  todayInvoices,
  monthlyGrowth,
  isLoading,
  onAction,
  formatCurrency, // ✅ از parent دریافت می‌شود
}: {
  todaySales: number;
  todayInvoices: number;
  monthlyGrowth: number;
  isLoading: boolean;
  onAction: () => void;
  formatCurrency: (v: number) => string;
}) {
  const { t } = useTranslation();
  const descriptionId = useId(); // ✅ استفاده از useId برای جلوگیری از duplicate
  
  const { status, statusText, interpretation } = useMemo(() => {
    if (monthlyGrowth >= 15) {
      return {
        status: "excellent" as const,
        statusText: t("health.excellent"),
        interpretation: t("health.excellentDetail")
      };
    } else if (monthlyGrowth >= 5) {
      return {
        status: "good" as const,
        statusText: t("health.good"),
        interpretation: t("health.goodDetail")
      };
    } else if (monthlyGrowth >= -5) {
      return {
        status: "neutral" as const,
        statusText: t("health.neutral"),
        interpretation: t("health.neutralDetail")
      };
    } else {
      return {
        status: "attention" as const,
        statusText: t("health.attention"),
        interpretation: t("health.attentionDetail")
      };
    }
  }, [monthlyGrowth, t]);

  if (isLoading) {
    return <div className="h-32 rounded-2xl bg-[hsl(var(--surface-muted))] animate-pulse" />;
  }

  return (
    <button
      onClick={onAction}
      className={cn(
        "relative w-full rounded-2xl p-6 text-start transition-all duration-200",
        "border-2 border-[hsl(var(--border-default))]",
        "bg-gradient-to-br from-[hsl(var(--surface-elevated))] to-[hsl(var(--surface-muted))]",
        "motion-safe:hover:scale-[1.01] hover:shadow-lg", // ✅ motion-safe اضافه شد
        "focus-visible:ring-4 focus-visible:ring-[hsl(var(--color-primary)/0.3)] focus-visible:outline-none"
      )}
      aria-describedby={descriptionId} // ✅ استفاده از useId
    >
      <div id={descriptionId} className="sr-only">
        {statusText}. {interpretation}. {t("health.salesSummary", {
          sales: formatCurrency(todaySales),
          invoices: todayInvoices
        })}
      </div>

      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-[hsl(var(--fg-primary))]">
              {t("health.title")}
            </h2>
            <StatusBadge status={status} />
          </div>
          <p className="text-xl font-bold text-[hsl(var(--fg-primary))]">
            {statusText}
          </p>
          <p className="text-sm text-[hsl(var(--fg-tertiary))]">
            {interpretation}
          </p>
          <div className="flex items-center gap-4 pt-2">
            <div>
              <p className="text-xs text-[hsl(var(--fg-tertiary))]">
                {t("health.todaySales")}
              </p>
              <p className="text-xl font-bold text-[hsl(var(--fg-primary))]">
                {formatCurrency(todaySales)}
              </p>
            </div>
            <div className="h-8 w-px bg-[hsl(var(--border-default))]" />
            <div>
              <p className="text-xs text-[hsl(var(--fg-tertiary))]">
                {t("health.todayInvoices")}
              </p>
              <p className="text-lg font-bold text-[hsl(var(--fg-primary))]">
                {todayInvoices}
              </p>
            </div>
            <div className="h-8 w-px bg-[hsl(var(--border-default))]" />
            <div>
              <p className="text-xs text-[hsl(var(--fg-tertiary))]">
                {t("health.growth")}
              </p>
              <p className={cn(
                "text-lg font-bold",
                monthlyGrowth >= 0 ? "text-[hsl(var(--status-positive))]" : "text-[hsl(var(--status-negative))]"
              )}>
                {monthlyGrowth >= 0 ? "+" : ""}{monthlyGrowth.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
        <ArrowRight className="h-6 w-6 text-[hsl(var(--fg-tertiary))] rtl:rotate-180 group-hover:text-[hsl(var(--fg-primary))]" /> {/* ✅ rtl:rotate-180 */}
      </div>
    </button>
  );
});
BusinessHealthHero.displayName = "BusinessHealthHero";

// ─── PerformanceSnapshot ──────────────────────────────────────────────────

const PerformanceSnapshot = memo(function PerformanceSnapshot({
  monthlyRevenue,
  monthlyGrowth, // ✅ monthlyGrowth اضافه شد
  activeCustomers,
  customerGrowth,
  isLoading,
  formatCurrency,
}: {
  monthlyRevenue: number;
  monthlyGrowth: number; // ✅ اضافه شد
  activeCustomers: number;
  customerGrowth: number;
  isLoading: boolean;
  formatCurrency: (v: number) => string;
}) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4">
        <div className="h-24 rounded-2xl bg-[hsl(var(--surface-muted))] animate-pulse" />
        <div className="h-24 rounded-2xl bg-[hsl(var(--surface-muted))] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4">
        <p className="text-xs text-[hsl(var(--fg-tertiary))]">
          {t("performance.monthlyRevenue")}
        </p>
        <p className="text-xl font-bold text-[hsl(var(--fg-primary))]">
          {formatCurrency(monthlyRevenue)}
        </p>
        <div className="flex items-center gap-1 mt-1">
          <TrendingUp className="h-3 w-3 text-[hsl(var(--status-positive))]" />
          <span className="text-xs text-[hsl(var(--status-positive))]">
            +{monthlyGrowth.toFixed(1)}% {t("performance.growthLabel")} {/* ✅ hardcode حذف شد */}
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4">
        <p className="text-xs text-[hsl(var(--fg-tertiary))]">
          {t("performance.activeCustomers")}
        </p>
        <p className="text-xl font-bold text-[hsl(var(--fg-primary))]">
          {activeCustomers}
        </p>
        <div className="flex items-center gap-1 mt-1">
          <Users className="h-3 w-3 text-[hsl(var(--status-info))]" />
          <span className="text-xs text-[hsl(var(--status-info))]">
            +{customerGrowth.toFixed(1)}% {t("performance.thisMonth")}
          </span>
        </div>
      </div>
    </div>
  );
});
PerformanceSnapshot.displayName = "PerformanceSnapshot";

// ─── AttentionPanel ───────────────────────────────────────────────────────

const AttentionPanel = memo(function AttentionPanel({
  pendingPayments,
  pendingPaymentsCount,
  lowStockAlerts,
  lowStockItems,
  isLoading,
  onAction,
  formatCurrency, // ✅ از parent دریافت می‌شود
}: {
  pendingPayments: number;
  pendingPaymentsCount: number;
  lowStockAlerts: number;
  lowStockItems: Array<{ name: string; quantity: number }>;
  isLoading: boolean;
  onAction: (action: "payments" | "warehouse") => void;
  formatCurrency: (v: number) => string;
}) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4">
        <div className="h-20 rounded-2xl bg-[hsl(var(--surface-muted))] animate-pulse" />
        <div className="h-20 rounded-2xl bg-[hsl(var(--surface-muted))] animate-pulse" />
      </div>
    );
  }

  const hasAlerts = pendingPaymentsCount > 0 || lowStockAlerts > 0;

  if (!hasAlerts) {
    return (
      <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4 text-center">
        <CheckCircle className="h-6 w-6 text-[hsl(var(--status-positive))] mx-auto mb-2" />
        <p className="text-sm text-[hsl(var(--fg-secondary))]">
          {t("attention.allGood")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-[hsl(var(--status-negative))]" aria-hidden="true" />
        <h3 className="text-sm font-medium text-[hsl(var(--fg-primary))]">
          {t("attention.needAttention")}
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {pendingPaymentsCount > 0 && (
          <button
            onClick={() => onAction("payments")}
            className={cn(
              "relative rounded-2xl p-3 text-start transition-all duration-200",
              "border border-[hsl(var(--status-negative)/0.3)] bg-[hsl(var(--status-negative)/0.05)]",
              "hover:border-[hsl(var(--status-negative)/0.6)] hover:shadow-md",
              "focus-visible:ring-4 focus-visible:ring-[hsl(var(--status-negative)/0.3)] focus-visible:outline-none"
            )}
            aria-label={t("attention.paymentsAria", {
              count: pendingPaymentsCount,
              amount: formatCurrency(pendingPayments)
            })}
          >
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-[hsl(var(--status-negative))]" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-[hsl(var(--status-negative))]">
                  {t("attention.pendingPayments")}
                </p>
                <p className="text-xs text-[hsl(var(--fg-tertiary))]">
                  {t("attention.paymentsDetail", {
                    count: pendingPaymentsCount,
                    amount: formatCurrency(pendingPayments)
                  })}
                </p>
              </div>
            </div>
          </button>
        )}

        {lowStockAlerts > 0 && (
          <button
            onClick={() => onAction("warehouse")}
            className={cn(
              "relative rounded-2xl p-3 text-start transition-all duration-200",
              "border border-[hsl(var(--status-warning)/0.3)] bg-[hsl(var(--status-warning)/0.05)]",
              "hover:border-[hsl(var(--status-warning)/0.6)] hover:shadow-md",
              "focus-visible:ring-4 focus-visible:ring-[hsl(var(--status-warning)/0.3)] focus-visible:outline-none"
            )}
            aria-label={t("attention.stockAria", { count: lowStockAlerts })}
          >
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-[hsl(var(--status-warning))]" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-[hsl(var(--status-warning))]">
                  {t("attention.lowStock")}
                </p>
                <p className="text-xs text-[hsl(var(--fg-tertiary))]">
                  {lowStockItems.slice(0, 2).map(item => item.name).join("، ")}
                  {lowStockItems.length > 2 && ` +${lowStockItems.length - 2} ${t("common.moreItems")}`}
                </p>
              </div>
            </div>
          </button>
        )}
      </div>
    </div>
  );
});
AttentionPanel.displayName = "AttentionPanel";

// ─── QuickActions ─────────────────────────────────────────────────────────

const QuickActions = memo(function QuickActions({
  onAction,
}: {
  onAction: (action: "invoice" | "payments" | "warehouse" | "customers") => void;
}) {
  const { t } = useTranslation();

  const actions = useMemo(() => [
    {
      id: "invoice" as const,
      label: t("actions.newInvoice"),
      icon: FileText,
      description: t("actions.newInvoiceDesc"),
      color: "text-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary)/0.1)]"
    },
    {
      id: "payments" as const,
      label: t("actions.viewPayments"),
      icon: Receipt,
      description: t("actions.viewPaymentsDesc"),
      color: "text-[hsl(var(--status-negative))] bg-[hsl(var(--status-negative)/0.1)]"
    },
    {
      id: "warehouse" as const,
      label: t("actions.manageStock"),
      icon: Package,
      description: t("actions.manageStockDesc"),
      color: "text-[hsl(var(--status-warning))] bg-[hsl(var(--status-warning)/0.1)]"
    }
  ], [t]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <ArrowRight className="h-4 w-4 text-[hsl(var(--fg-tertiary))] rtl:rotate-180" aria-hidden="true" /> {/* ✅ rtl:rotate-180 */}
        <h3 className="text-sm font-medium text-[hsl(var(--fg-secondary))]">
          {t("actions.quickActions")}
        </h3>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {actions.map(({ id, label, icon: Icon, description, color }) => (
          <button
            key={id}
            onClick={() => onAction(id)}
            className={cn(
              "flex items-center gap-3 rounded-2xl p-4 text-start transition-all duration-200",
              "border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]",
              "motion-safe:hover:border-[hsl(var(--color-primary)/0.3)] motion-safe:hover:shadow-md motion-safe:hover:scale-[1.01]", // ✅ motion-safe
              "focus-visible:ring-4 focus-visible:ring-[hsl(var(--color-primary)/0.3)] focus-visible:outline-none"
            )}
          >
            <div className={cn("rounded-lg p-2", color)}>
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium text-[hsl(var(--fg-primary))]">
                {label}
              </p>
              <p className="text-xs text-[hsl(var(--fg-tertiary))]">
                {description}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
});
QuickActions.displayName = "QuickActions";

// ─── Main Component ──────────────────────────────────────────────────────

export const BusinessHealthPanel = memo(function BusinessHealthPanel({
  data,
  isLoading,
  onAction,
}: BusinessHealthPanelProps) {
  const { t } = useTranslation();
  const { format } = useCurrency(); // ✅ یک بار در parent

  if (isLoading) {
    return <BusinessHealthSkeleton />;
  }

  return (
    <section
      className="space-y-4"
      aria-label={t("panel.ariaLabel")}
    >
      <BusinessHealthHero
        todaySales={data.todaySales}
        todayInvoices={data.todayInvoices}
        monthlyGrowth={data.monthlyGrowth}
        isLoading={isLoading}
        onAction={() => onAction("invoice")}
        formatCurrency={format} // ✅ پاس‌دادن به child
      />

      <PerformanceSnapshot
        monthlyRevenue={data.monthlyRevenue}
        monthlyGrowth={data.monthlyGrowth} // ✅ پاس‌دادن monthlyGrowth
        activeCustomers={data.activeCustomers}
        customerGrowth={data.customerGrowth}
        isLoading={isLoading}
        formatCurrency={format} // ✅ پاس‌دادن به child
      />

      <AttentionPanel
        pendingPayments={data.pendingPayments}
        pendingPaymentsCount={data.pendingPaymentsCount}
        lowStockAlerts={data.lowStockAlerts}
        lowStockItems={data.lowStockItems}
        isLoading={isLoading}
        onAction={onAction}
        formatCurrency={format} // ✅ پاس‌دادن به child
      />

      <QuickActions onAction={onAction} />
    </section>
  );
});

BusinessHealthPanel.displayName = "BusinessHealthPanel";