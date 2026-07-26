// packages/ui/src/components/ui/manufacturing/manufacturing-view.tsx
"use client";

import { memo, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Factory, Layers, ClipboardList, Check } from "lucide-react";
import type { BOM, WorkOrder } from "@hisabche/api";

/* ═══════════════════════════════════════════════════════════════════════════
   ManufacturingView — Memoized · Performance Optimized
   ✅ memo · props صریح · بدون hook داده‌ای مستقیم
   ═══════════════════════════════════════════════════════════════════════════ */

export type ManufacturingTabId = "boms" | "workOrders";

interface ManufacturingViewProps {
  t: (key: string, fallback?: string) => string;
  activeTab: ManufacturingTabId;
  onTabChange: (tab: ManufacturingTabId) => void;
  boms: BOM[];
  workOrders: WorkOrder[];
  isLoading: boolean;
  error?: string | null;
  completingId?: string | null;
  onCompleteWorkOrder: (id: string) => void;
}

const STATUS_BADGE_MAP: Record<string, string> = {
  planned: "bg-[hsl(var(--fg-tertiary)/0.12)] text-[hsl(var(--fg-tertiary))]",
  in_progress: "bg-[hsl(var(--color-info)/0.12)] text-[hsl(var(--color-info))]",
  completed: "bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]",
  cancelled: "bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))]",
};

function formatDate(date?: string): string {
  if (!date) return "-";
  try {
    return new Date(date).toLocaleDateString("fa-AF", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return date;
  }
}

export const ManufacturingView = memo(function ManufacturingView({
  t,
  activeTab,
  onTabChange,
  boms,
  workOrders,
  isLoading,
  error,
  completingId,
  onCompleteWorkOrder,
}: ManufacturingViewProps) {
  const statusLabel = useMemo(
    () => (status: string) => {
      const map: Record<string, string> = {
        planned: t("manufacturing.status.planned", "برنامه‌ریزی‌شده"),
        in_progress: t("manufacturing.status.inProgress", "در حال انجام"),
        completed: t("manufacturing.status.completed", "تکمیل‌شده"),
        cancelled: t("manufacturing.status.cancelled", "لغوشده"),
      };
      return map[status] || status;
    },
    [t]
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Factory className="size-6 text-[hsl(var(--color-primary))]" />
        <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))]">
          {t("nav.production", "ساخت و تولید")}
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[hsl(var(--border-default))]">
        <button
          type="button"
          onClick={() => onTabChange("boms")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
            activeTab === "boms"
              ? "border-[hsl(var(--color-primary))] text-[hsl(var(--color-primary))]"
              : "border-transparent text-[hsl(var(--fg-tertiary))] hover:text-[hsl(var(--fg-primary))]"
          )}
        >
          <Layers className="size-4" />
          {t("manufacturing.tabs.boms", "فرمول‌های ساخت")}
        </button>
        <button
          type="button"
          onClick={() => onTabChange("workOrders")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
            activeTab === "workOrders"
              ? "border-[hsl(var(--color-primary))] text-[hsl(var(--color-primary))]"
              : "border-transparent text-[hsl(var(--fg-tertiary))] hover:text-[hsl(var(--fg-primary))]"
          )}
        >
          <ClipboardList className="size-4" />
          {t("manufacturing.tabs.workOrders", "دستورهای تولید")}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-2xl border border-[hsl(var(--color-destructive)/0.3)] bg-[hsl(var(--color-destructive)/0.05)] p-4 text-center text-[hsl(var(--color-destructive))]">
          {error}
        </div>
      )}

      {/* Body */}
      <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 rounded-xl bg-[hsl(var(--surface-muted))] animate-pulse" />
            ))}
          </div>
        ) : activeTab === "boms" ? (
          boms.length === 0 ? (
            <div className="p-12 text-center">
              <Layers className="size-12 mx-auto mb-3 text-[hsl(var(--fg-tertiary))]" />
              <p className="text-[hsl(var(--fg-secondary))]">
                {t("manufacturing.boms.empty", "هیچ فرمول ساختی ثبت نشده")}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))]">
                    <th className="px-4 py-3 text-start font-medium text-[hsl(var(--fg-secondary))] text-xs">
                      {t("manufacturing.boms.product", "محصول")}
                    </th>
                    <th className="px-4 py-3 text-start font-medium text-[hsl(var(--fg-secondary))] text-xs">
                      {t("manufacturing.boms.version", "نسخه")}
                    </th>
                    <th className="px-4 py-3 text-start font-medium text-[hsl(var(--fg-secondary))] text-xs">
                      {t("manufacturing.boms.itemsCount", "تعداد اقلام")}
                    </th>
                    <th className="px-4 py-3 text-center font-medium text-[hsl(var(--fg-secondary))] text-xs">
                      {t("manufacturing.boms.status", "وضعیت")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {boms.map((bom) => (
                    <tr
                      key={bom.id}
                      className="border-b border-[hsl(var(--border-default))] hover:bg-[hsl(var(--surface-muted)/0.5)] transition-colors"
                    >
                      <td className="px-4 py-3 text-[hsl(var(--fg-primary))]">
                        {bom.product?.name || bom.productId.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3 text-xs text-[hsl(var(--fg-secondary))]">v{bom.version}</td>
                      <td className="px-4 py-3 text-xs text-[hsl(var(--fg-secondary))]">
                        {bom.items?.length ?? 0}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-xs font-medium",
                            bom.isActive ? STATUS_BADGE_MAP.completed : STATUS_BADGE_MAP.cancelled
                          )}
                        >
                          {bom.isActive
                            ? t("manufacturing.boms.active", "فعال")
                            : t("manufacturing.boms.inactive", "غیرفعال")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : workOrders.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardList className="size-12 mx-auto mb-3 text-[hsl(var(--fg-tertiary))]" />
            <p className="text-[hsl(var(--fg-secondary))]">
              {t("manufacturing.workOrders.empty", "هیچ دستور تولیدی ثبت نشده")}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))]">
                  <th className="px-4 py-3 text-start font-medium text-[hsl(var(--fg-secondary))] text-xs">
                    {t("manufacturing.workOrders.product", "محصول")}
                  </th>
                  <th className="px-4 py-3 text-start font-medium text-[hsl(var(--fg-secondary))] text-xs">
                    {t("manufacturing.workOrders.quantity", "تعداد")}
                  </th>
                  <th className="px-4 py-3 text-start font-medium text-[hsl(var(--fg-secondary))] text-xs">
                    {t("manufacturing.workOrders.status", "وضعیت")}
                  </th>
                  <th className="px-4 py-3 text-start font-medium text-[hsl(var(--fg-secondary))] text-xs hidden sm:table-cell">
                    {t("manufacturing.workOrders.startDate", "تاریخ شروع")}
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-[hsl(var(--fg-secondary))] text-xs">
                    {t("manufacturing.workOrders.actions", "عملیات")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {workOrders.map((workOrder) => (
                  <tr
                    key={workOrder.id}
                    className="border-b border-[hsl(var(--border-default))] hover:bg-[hsl(var(--surface-muted)/0.5)] transition-colors"
                  >
                    <td className="px-4 py-3 text-[hsl(var(--fg-primary))]">
                      {workOrder.product?.name || workOrder.productId.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-xs text-[hsl(var(--fg-secondary))]">{workOrder.quantity}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-medium",
                          STATUS_BADGE_MAP[workOrder.status] || STATUS_BADGE_MAP.planned
                        )}
                      >
                        {statusLabel(workOrder.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[hsl(var(--fg-secondary))] hidden sm:table-cell whitespace-nowrap">
                      {formatDate(workOrder.startDate)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {workOrder.status !== "completed" && workOrder.status !== "cancelled" && (
                        <button
                          type="button"
                          onClick={() => onCompleteWorkOrder(workOrder.id)}
                          disabled={completingId === workOrder.id}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium",
                            "border border-[hsl(var(--color-success)/0.4)] text-[hsl(var(--color-success))]",
                            "hover:bg-[hsl(var(--color-success)/0.08)] disabled:opacity-40"
                          )}
                        >
                          <Check className="size-3.5" />
                          {t("manufacturing.workOrders.complete", "تکمیل")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
});

ManufacturingView.displayName = "ManufacturingView";
