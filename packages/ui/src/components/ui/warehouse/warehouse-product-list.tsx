// packages/ui/src/components/ui/warehouse/warehouse-product-list.tsx
"use client";

import { memo, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Package, Eye, Trash2, Loader2 } from "lucide-react";
import type { Product } from "../../../lib/warehouse/warehouse-types";

/* ═══════════════════════════════════════════════════════════════════════════
   WarehouseProductList v5 — Memoized · PascalCase
   ✅ هر ردیف یک کامپوننت مستقل است (رفع React error #310:
      قبلاً useMemo/useCallback داخل .map() صدا زده می‌شدند که چون طول
      products متغیر است، تعداد فراخوانی هوک‌ها بین رندرها عوض می‌شد)
   ═══════════════════════════════════════════════════════════════════════════ */

type StockStatus = "success" | "warning" | "destructive" | "secondary";

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
  success:
    "bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))] border-[hsl(var(--color-success)/0.2)]",
  warning:
    "bg-[hsl(var(--color-warning)/0.12)] text-[hsl(var(--color-warning))] border-[hsl(var(--color-warning)/0.2)]",
  destructive:
    "bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))] border-[hsl(var(--color-destructive)/0.2)]",
  secondary:
    "bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-secondary))] border-[hsl(var(--border-default))]",
};

const actionBtnBase =
  "inline-flex items-center justify-center rounded-full p-2 min-h-[44px] min-w-[44px] sm:min-h-[40px] sm:min-w-[40px] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] transition-colors duration-150 motion-reduce:transition-none";

// ─── Product Row (کامپوننت مستقل — هوک‌ها اینجا امن هستند) ─────────────────

interface ProductRowProps {
  product: Product;
  t: (key: string, fallback?: string) => string;
  fmt: (v: number) => string;
  status: StockStatus;
  stockLabel: (qty: number, min: number) => string;
  onNavigate: (id: string) => void;
  onDelete: (product: Product) => void;
  isDeleting: boolean;
}

const ProductRow = memo(function ProductRow({
  product,
  t,
  fmt,
  status,
  stockLabel,
  onNavigate,
  onDelete,
  isDeleting,
}: ProductRowProps) {
  const qty = product.quantity;
  const min = product.minStockLevel;

  // ✅ حالا این‌ها داخل یک کامپوننت واقعی هستند، نه داخل .map()
  const badgeStyle = useMemo(
    () => statusBadgeStyles[status] ?? statusBadgeStyles.secondary,
    [status]
  );

  const handleNavigate = useCallback(() => {
    onNavigate(product.id);
  }, [onNavigate, product.id]);

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete(product);
    },
    [onDelete, product]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onNavigate(product.id);
      }
    },
    [onNavigate, product.id]
  );

  return (
    <div
      onClick={handleNavigate}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={cn(
        "cursor-pointer rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]",
        "transition-all duration-200 hover:shadow-lg hover:border-[hsl(var(--color-primary)/0.3)]",
        "focus-visible:ring-4 focus-visible:ring-[rgba(18,200,160,0.18)] focus-visible:outline-none",
      )}
    >
      <div className="flex items-center justify-between p-5 gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-4 text-start">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--surface-muted))]">
            <Package
              className="size-5 text-[hsl(var(--fg-tertiary))]"
              aria-hidden="true"
            />
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-[hsl(var(--fg-primary))]">
              {product.name}
            </p>
            <p className="text-xs text-[hsl(var(--fg-secondary))]">
              {product.category} · {product.unit} ·{" "}
              {t("warehouse.buyPrice", "قیمت خرید")}: {fmt(product.buyPrice)} AFN
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-4">
          <div className="text-end">
            <p className="font-bold tabular-nums text-[hsl(var(--fg-primary))]">
              {fmt(product.sellPrice)} AFN
            </p>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border",
                badgeStyle,
              )}
            >
              {stockLabel(qty, min)} ({qty})
            </span>
          </div>

          <button
            type="button"
            onClick={handleNavigate}
            aria-label={t("action.view", "مشاهده")}
            className={actionBtnBase}
          >
            <Eye className="size-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            aria-label={t("action.delete", "حذف")}
            className={cn(
              actionBtnBase,
              "hover:bg-[hsl(var(--color-destructive)/0.1)] hover:text-[hsl(var(--color-destructive))]",
              "disabled:opacity-40 disabled:cursor-not-allowed",
            )}
          >
            {isDeleting ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
});
ProductRow.displayName = "ProductRow";

// ─── Main Component ─────────────────────────────────────────────────────────

export const WarehouseProductList = memo(function WarehouseProductList({
  t,
  fmt,
  products,
  stockStatus,
  stockLabel,
  onNavigate,
  onDelete,
  deletingId,
}: WarehouseProductListProps) {
  return (
    <div className="space-y-3">
      {products.map((product) => (
        <ProductRow
          key={product.id}
          product={product}
          t={t}
          fmt={fmt}
          status={stockStatus(product.quantity, product.minStockLevel)}
          stockLabel={stockLabel}
          onNavigate={onNavigate}
          onDelete={onDelete}
          isDeleting={deletingId === product.id}
        />
      ))}
    </div>
  );
});

WarehouseProductList.displayName = "WarehouseProductList";