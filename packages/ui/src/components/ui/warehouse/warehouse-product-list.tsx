// packages/ui/src/components/ui/warehouse/warehouse-product-list.tsx
"use client";

import { memo, useMemo, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Pencil, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { Product } from "../../../lib/warehouse/warehouse-types";

/* ═══════════════════════════════════════════════════════════════════════════
   WarehouseProductList v6 — جدول (به‌جای کارت‌ها) با ستون تعداد قابل‌مرتب‌سازی
   ═══════════════════════════════════════════════════════════════════════════ */

type StockStatus = "success" | "warning" | "destructive" | "secondary";
type QtySort = "none" | "asc" | "desc";

interface WarehouseProductListProps {
  t: (key: string, fallback?: string) => string;
  fmt: (v: number) => string;
  products: Product[];
  stockStatus: (qty: number, min: number) => StockStatus;
  stockLabel: (qty: number, min: number) => string;
  onNavigate: (id: string) => void;
  onDelete: (product: Product) => void;
  deletingId: string | null;
}

const statusBadgeStyles: Record<string, string> = {
  success: "bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))] border-[hsl(var(--color-success)/0.2)]",
  warning: "bg-[hsl(var(--color-warning)/0.12)] text-[hsl(var(--color-warning))] border-[hsl(var(--color-warning)/0.2)]",
  destructive: "bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))] border-[hsl(var(--color-destructive)/0.2)]",
  secondary: "bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-secondary))] border-[hsl(var(--border-default))]",
};

export const WarehouseProductList = memo(function WarehouseProductList({
  t,
  fmt,
  products,
  stockStatus,
  onNavigate,
  onDelete: _onDelete,
  deletingId: _deletingId,
}: WarehouseProductListProps) {
  const [qtySort, setQtySort] = useState<QtySort>("none");

  // ✅ کلیک روی عنوان «تعداد» بین سه حالت می‌چرخد: عادی → زیاد به کم → کم به زیاد
  const cycleQtySort = useCallback(() => {
    setQtySort((prev) => (prev === "none" ? "desc" : prev === "desc" ? "asc" : "none"));
  }, []);

  const sortedProducts = useMemo(() => {
    if (qtySort === "none") return products;
    const sign = qtySort === "desc" ? -1 : 1;
    return [...products].sort((a, b) => sign * (a.quantity - b.quantity));
  }, [products, qtySort]);

  const QtySortIcon = qtySort === "none" ? ArrowUpDown : qtySort === "desc" ? ArrowDown : ArrowUp;

  return (
    <div className="overflow-x-auto rounded-2xl border border-[hsl(var(--border-default))]">
      <table className="w-full min-w-[820px] text-sm">
        <thead>
          <tr className="border-b border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))]">
            <th className="whitespace-nowrap px-3 py-2.5 text-start text-xs font-semibold text-[hsl(var(--fg-tertiary))]">{t("warehouse.name", "نام")}</th>
            <th className="whitespace-nowrap px-3 py-2.5 text-start text-xs font-semibold text-[hsl(var(--fg-tertiary))]">{t("warehouse.unit", "واحد")}</th>
            <th className="whitespace-nowrap px-3 py-2.5 text-start text-xs font-semibold text-[hsl(var(--fg-tertiary))]">{t("warehouse.buyPrice", "قیمت خرید")}</th>
            <th className="whitespace-nowrap px-3 py-2.5 text-start text-xs font-semibold text-[hsl(var(--fg-tertiary))]">{t("warehouse.sellPrice", "قیمت فروش")}</th>
            <th className="whitespace-nowrap px-3 py-2.5 text-start text-xs font-semibold text-[hsl(var(--fg-tertiary))]">
              <button type="button" onClick={cycleQtySort} className="inline-flex items-center gap-1 hover:text-[hsl(var(--fg-primary))]">
                {t("warehouse.quantity", "تعداد")}
                <QtySortIcon className="size-3.5" aria-hidden="true" />
              </button>
            </th>
            <th className="whitespace-nowrap px-3 py-2.5 text-start text-xs font-semibold text-[hsl(var(--fg-tertiary))]">{t("warehouse.category", "دسته‌بندی")}</th>
            <th className="whitespace-nowrap px-3 py-2.5 text-start text-xs font-semibold text-[hsl(var(--fg-tertiary))]">{t("warehouse.itemValue", "ارزش")}</th>
            <th className="whitespace-nowrap px-3 py-2.5 text-start text-xs font-semibold text-[hsl(var(--fg-tertiary))]">{t("invoices.actions", "عملیات")}</th>
          </tr>
        </thead>
        <tbody>
          {sortedProducts.map((product) => {
            const status = stockStatus(product.quantity, product.minStockLevel);
            return (
              <tr
                key={product.id}
                onClick={() => onNavigate(product.id)}
                className="cursor-pointer border-b border-[hsl(var(--border-default))] last:border-0 hover:bg-[hsl(var(--surface-muted)/0.5)] transition-colors duration-150"
              >
                <td className="whitespace-nowrap px-3 py-2.5 font-medium text-[hsl(var(--fg-primary))]">{product.name}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-[hsl(var(--fg-secondary))]">{product.unit}</td>
                <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-[hsl(var(--fg-secondary))]">{fmt(product.buyPrice)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-[hsl(var(--fg-primary))]">{fmt(product.sellPrice)}</td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border tabular-nums", statusBadgeStyles[status] ?? statusBadgeStyles.secondary)}>
                    {product.quantity}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-[hsl(var(--fg-secondary))]">{product.category || "—"}</td>
                <td className="whitespace-nowrap px-3 py-2.5 tabular-nums font-semibold text-[hsl(var(--fg-primary))]">{fmt(product.quantity * product.buyPrice)}</td>
                <td className="whitespace-nowrap px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => onNavigate(product.id)}
                    aria-label={t("action.edit", "ویرایش")}
                    className="inline-flex items-center justify-center rounded-full min-h-[36px] min-w-[36px] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] transition-colors duration-150"
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});

WarehouseProductList.displayName = "WarehouseProductList";
