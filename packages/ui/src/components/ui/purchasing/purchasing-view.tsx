// packages/ui/src/components/ui/purchasing/purchasing-view.tsx
"use client";

import { memo, useMemo } from "react";
import { cn } from "@/lib/utils";
import { ShoppingCart, PackageCheck } from "lucide-react";
import type { PurchaseOrder } from "@hisabche/api";

/* ═══════════════════════════════════════════════════════════════════════════
   PurchasingView — Memoized · Performance Optimized
   ✅ memo · props صریح · بدون hook داده‌ای مستقیم
   ═══════════════════════════════════════════════════════════════════════════ */

interface PurchasingViewProps {
  t: (key: string, fallback?: string) => string;
  orders: PurchaseOrder[];
  isLoading: boolean;
  error?: string | null;
  receivingId?: string | null;
  onReceiveGoods: (id: string) => void;
}

const STATUS_BADGE_MAP: Record<string, string> = {
  pending: "bg-[hsl(var(--color-warning)/0.12)] text-[hsl(var(--color-warning))]",
  received: "bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]",
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

export const PurchasingView = memo(function PurchasingView({
  t,
  orders,
  isLoading,
  error,
  receivingId,
  onReceiveGoods,
}: PurchasingViewProps) {
  const statusLabel = useMemo(
    () => (status: string) => {
      const map: Record<string, string> = {
        pending: t("purchasing.status.pending", "در انتظار"),
        received: t("purchasing.status.received", "دریافت‌شده"),
        cancelled: t("purchasing.status.cancelled", "لغوشده"),
      };
      return map[status] || status;
    },
    [t]
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <ShoppingCart className="size-6 text-[hsl(var(--color-primary))]" />
        <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))]">
          {t("nav.buy", "خرید")}
        </h1>
        <span className="text-xs text-[hsl(var(--fg-tertiary))] bg-[hsl(var(--surface-muted))] px-2 py-1 rounded-full">
          {orders.length.toLocaleString("fa-AF")}
        </span>
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
        ) : orders.length === 0 ? (
          <div className="p-12 text-center">
            <ShoppingCart className="size-12 mx-auto mb-3 text-[hsl(var(--fg-tertiary))]" />
            <p className="text-[hsl(var(--fg-secondary))]">
              {t("purchasing.empty", "هیچ سفارش خریدی ثبت نشده")}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))]">
                  <th className="px-4 py-3 text-start font-medium text-[hsl(var(--fg-secondary))] text-xs">
                    {t("purchasing.supplier", "تأمین‌کننده")}
                  </th>
                  <th className="px-4 py-3 text-start font-medium text-[hsl(var(--fg-secondary))] text-xs">
                    {t("purchasing.orderDate", "تاریخ سفارش")}
                  </th>
                  <th className="px-4 py-3 text-start font-medium text-[hsl(var(--fg-secondary))] text-xs">
                    {t("purchasing.itemsCount", "تعداد اقلام")}
                  </th>
                  <th className="px-4 py-3 text-start font-medium text-[hsl(var(--fg-secondary))] text-xs hidden sm:table-cell">
                    {t("purchasing.expectedDeliveryDate", "تاریخ تحویل")}
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-[hsl(var(--fg-secondary))] text-xs">
                    {t("purchasing.statusLabel", "وضعیت")}
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-[hsl(var(--fg-secondary))] text-xs">
                    {t("purchasing.actions", "عملیات")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-[hsl(var(--border-default))] hover:bg-[hsl(var(--surface-muted)/0.5)] transition-colors"
                  >
                    <td className="px-4 py-3 text-[hsl(var(--fg-primary))]">
                      {order.supplier?.name || order.supplierId.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-xs text-[hsl(var(--fg-secondary))] whitespace-nowrap">
                      {formatDate(order.orderDate)}
                    </td>
                    <td className="px-4 py-3 text-xs text-[hsl(var(--fg-secondary))]">
                      {order.items?.length ?? 0}
                    </td>
                    <td className="px-4 py-3 text-xs text-[hsl(var(--fg-secondary))] hidden sm:table-cell whitespace-nowrap">
                      {formatDate(order.expectedDeliveryDate)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-medium",
                          STATUS_BADGE_MAP[order.status] || STATUS_BADGE_MAP.pending
                        )}
                      >
                        {statusLabel(order.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {order.status === "pending" && (
                        <button
                          type="button"
                          onClick={() => onReceiveGoods(order.id)}
                          disabled={receivingId === order.id}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium",
                            "border border-[hsl(var(--color-success)/0.4)] text-[hsl(var(--color-success))]",
                            "hover:bg-[hsl(var(--color-success)/0.08)] disabled:opacity-40"
                          )}
                        >
                          <PackageCheck className="size-3.5" />
                          {t("purchasing.receiveGoods", "دریافت کالا")}
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

PurchasingView.displayName = "PurchasingView";
