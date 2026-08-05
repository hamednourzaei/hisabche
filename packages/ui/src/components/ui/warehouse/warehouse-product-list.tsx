// packages/ui/src/components/ui/warehouse/warehouse-product-list.tsx
"use client";

import { memo, useMemo, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Pencil } from "lucide-react";
import { DataTable, type TableColumn } from "../data-table";
import type { Product } from "../../../lib/warehouse/warehouse-types";

/* ═══════════════════════════════════════════════════════════════════════════
   WarehouseProductList v7 — shared DataTable
   collapsible search · column settings · sortable headers · responsive columns
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
  search: string;
  onSearchChange: (value: string) => void;
  /** Export controls, rendered beside the search and column icons. */
  actions?: ReactNode;
  emptyState?: ReactNode;
}

const statusBadgeStyles: Record<string, string> = {
  success: "bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))] border-[hsl(var(--color-success)/0.2)]",
  warning: "bg-[hsl(var(--color-warning)/0.12)] text-[hsl(var(--color-warning))] border-[hsl(var(--color-warning)/0.2)]",
  destructive: "bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))] border-[hsl(var(--color-destructive)/0.2)]",
  secondary: "bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-secondary))] border-[hsl(var(--border-default))]",
};

function useProductColumns(
  t: (key: string, fallback?: string) => string,
  fmt: (v: number) => string,
  stockStatus: (qty: number, min: number) => StockStatus,
  onNavigate: (id: string) => void,
): TableColumn<Product>[] {
  return useMemo(
    () => [
      {
        id: "name",
        labelKey: "warehouse.name",
        labelFallback: "نام",
        locked: true,
        sortValue: (product) => product.name,
        render: (product) => (
          <span className="font-medium text-[hsl(var(--fg-primary))]">{product.name}</span>
        ),
      },
      {
        id: "unit",
        labelKey: "warehouse.unit",
        labelFallback: "واحد",
        showFrom: "md",
        sortValue: (product) => product.unit,
        render: (product) => <span className="text-[hsl(var(--fg-secondary))]">{product.unit}</span>,
      },
      {
        id: "buyPrice",
        labelKey: "warehouse.buyPrice",
        labelFallback: "قیمت خرید",
        showFrom: "sm",
        align: "end",
        sortValue: (product) => product.buyPrice,
        render: (product) => (
          <span className="tabular-nums text-[hsl(var(--fg-secondary))]">{fmt(product.buyPrice)}</span>
        ),
      },
      {
        id: "sellPrice",
        labelKey: "warehouse.sellPrice",
        labelFallback: "قیمت فروش",
        align: "end",
        sortValue: (product) => product.sellPrice,
        render: (product) => (
          <span className="tabular-nums text-[hsl(var(--fg-primary))]">{fmt(product.sellPrice)}</span>
        ),
      },
      {
        id: "quantity",
        labelKey: "warehouse.quantity",
        labelFallback: "تعداد",
        align: "end",
        sortValue: (product) => product.quantity,
        render: (product) => (
          <span
            className={cn(
              "inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums",
              statusBadgeStyles[stockStatus(product.quantity, product.minStockLevel)] ??
                statusBadgeStyles.secondary,
            )}
          >
            {product.quantity}
          </span>
        ),
      },
      {
        id: "category",
        labelKey: "warehouse.category",
        labelFallback: "دسته‌بندی",
        showFrom: "md",
        sortValue: (product) => product.category ?? "",
        render: (product) => (
          <span className="text-[hsl(var(--fg-secondary))]">{product.category || "—"}</span>
        ),
      },
      {
        id: "itemValue",
        labelKey: "warehouse.itemValue",
        labelFallback: "ارزش",
        showFrom: "sm",
        align: "end",
        sortValue: (product) => product.quantity * product.buyPrice,
        render: (product) => (
          <span className="font-semibold tabular-nums text-[hsl(var(--fg-primary))]">
            {fmt(product.quantity * product.buyPrice)}
          </span>
        ),
      },
      {
        id: "actions",
        labelKey: "invoices.actions",
        labelFallback: "عملیات",
        locked: true,
        align: "end",
        render: (product) => (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onNavigate(product.id);
            }}
            aria-label={t("action.edit", "ویرایش")}
            className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-full text-[hsl(var(--fg-secondary))] transition-colors duration-150 hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]"
          >
            <Pencil className="size-4" aria-hidden="true" />
          </button>
        ),
      },
    ],
    [fmt, onNavigate, stockStatus, t],
  );
}

export const WarehouseProductList = memo(function WarehouseProductList({
  t,
  fmt,
  products,
  stockStatus,
  onNavigate,
  search,
  onSearchChange,
  actions,
  emptyState,
}: WarehouseProductListProps) {
  const columns = useProductColumns(t, fmt, stockStatus, onNavigate);

  return (
    <DataTable
      tableId="warehouse-products"
      t={t}
      rows={products}
      columns={columns}
      rowKey={(product) => product.id}
      onRowClick={(product) => onNavigate(product.id)}
      searchValue={search}
      onSearchChange={onSearchChange}
      minWidthClass="min-w-[420px] sm:min-w-[680px]"
      actions={actions}
      emptyState={emptyState}
    />
  );
});

WarehouseProductList.displayName = "WarehouseProductList";
