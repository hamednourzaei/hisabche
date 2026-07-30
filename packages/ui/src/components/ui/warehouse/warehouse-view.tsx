// packages/ui/src/components/ui/warehouse/warehouse-view.tsx
"use client";

import { memo, useMemo } from "react";
import { cn } from "@/lib/utils";
import { EmptyState } from "../empty-state";
import { WarehouseStats } from "./warehouse-stats";
import { WarehouseProductList } from "./warehouse-product-list";
import { Plus, Search, Check } from "lucide-react";
import type { Product, Currency } from "../../../lib/warehouse/warehouse-types";

/* ═══════════════════════════════════════════════════════════════════════════
   WarehouseView v4 — Memoized · Component Separation · PascalCase
   ✅ memo · useMemo · PascalCase components
   ═══════════════════════════════════════════════════════════════════════════ */

interface WarehouseViewProps {
  t: (key: string, fallback?: string) => string;
  fmt: (v: number) => string;
  search: string;
  onSearchChange: (value: string) => void;
  onOpenAddModal: () => void;
  deletingId: string | null;
  products: Product[];
  total: number;
  isLoading: boolean;
  totalValue: number;
  outOfStock: number;
  currencies: Currency[];
  onNavigate: (id: string) => void;
  onDelete: (product: Product) => void;
  stockStatus: (
    qty: number,
    min: number,
  ) => "success" | "warning" | "destructive" | "secondary";
  stockLabel: (qty: number, min: number) => string;
}

// ─── SaveIndicator ──────────────────────────────────────────────────────────

const SaveIndicator = memo(function SaveIndicator({
  t,
  deletingId,
}: {
  t: (key: string, fallback?: string) => string;
  deletingId: string | null;
}) {
  if (deletingId === null) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed start-1/2 top-4 z-50 -translate-x-1/2"
    >
      <div className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium bg-[hsl(var(--surface-elevated))] border border-[hsl(var(--border-strong))] shadow-lg">
        <Check className="size-4 text-[hsl(var(--color-success))]" aria-hidden="true" />
        <span className="text-[hsl(var(--color-success))]">
          {t("common.saved", "حفظ شد")}
        </span>
      </div>
    </div>
  );
});
SaveIndicator.displayName = "SaveIndicator";

// ─── Header ─────────────────────────────────────────────────────────────────

const WarehouseHeader = memo(function WarehouseHeader({
  t,
  onOpenAddModal,
}: {
  t: (key: string, fallback?: string) => string;
  onOpenAddModal: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold sm:text-3xl text-[hsl(var(--fg-primary))]">
          {t("nav.stock", "موجودی")}
        </h1>
        <p className="text-sm text-[hsl(var(--fg-secondary))]">
          {t("nav.stock.description", "چه چیزی داریم و چه چیزی کم است")}
        </p>
      </div>

      <button
        type="button"
        onClick={onOpenAddModal}
        className={cn(
          "inline-flex items-center gap-2 rounded-full px-5 py-2.5",
          "min-h-[44px] sm:min-h-[40px]",
          "text-sm font-bold text-white",
          "bg-[var(--gradient-brand)]",
          "shadow-sm shadow-[hsl(var(--color-primary)/0.15)]",
          "transition-all duration-200 hover:brightness-110 active:scale-[0.98]",
          "focus-visible:ring-4 focus-visible:ring-[rgba(18,200,160,0.18)] focus-visible:outline-none",
          "motion-reduce:transition-none",
        )}
      >
        <Plus className="size-4" aria-hidden="true" />
        {t("warehouse.addProduct", "افزودن محصول")}
      </button>
    </div>
  );
});
WarehouseHeader.displayName = "WarehouseHeader";

// ─── SearchBar ──────────────────────────────────────────────────────────────

const WarehouseSearch = memo(function WarehouseSearch({
  t,
  search,
  onSearchChange,
}: {
  t: (key: string, fallback?: string) => string;
  search: string;
  onSearchChange: (value: string) => void;
}) {
  return (
    <div className="max-w-sm relative">
      <Search
        className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--fg-tertiary))] pointer-events-none"
        aria-hidden="true"
      />
      <input
        type="text"
        placeholder={`${t("action.search", "جستجو")}...`}
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className={cn(
          "w-full rounded-xl ps-9 pe-3 py-2.5 text-sm",
          "min-h-[44px] sm:min-h-[40px]",
          "border border-[hsl(var(--border-default))]",
          "bg-[hsl(var(--surface-base))]",
          "text-[hsl(var(--fg-primary))]",
          "placeholder:text-[hsl(var(--fg-tertiary))]",
          "focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)] focus:ring-1 focus:ring-[hsl(var(--color-primary)/0.3)]",
          "transition-colors duration-200",
          "motion-reduce:transition-none",
        )}
      />
    </div>
  );
});
WarehouseSearch.displayName = "WarehouseSearch";

// ─── CurrencyChips ─────────────────────────────────────────────────────────

const CurrencyChips = memo(function CurrencyChips({
  fmt,
  currencies,
  totalValue,
}: {
  fmt: (v: number) => string;
  currencies: Currency[];
  totalValue: number;
}) {
  return (
    <div className="flex flex-wrap gap-2 text-xs text-[hsl(var(--fg-secondary))]">
      {currencies.map((c) => (
        <span
          key={c.code}
          className="rounded-lg bg-[hsl(var(--surface-muted))] px-2 py-1"
        >
          {c.label}: {fmt(totalValue * c.rate)}
        </span>
      ))}
    </div>
  );
});
CurrencyChips.displayName = "CurrencyChips";

// ─── LoadingSkeleton ────────────────────────────────────────────────────────

const LoadingSkeleton = memo(function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="h-16 rounded-2xl bg-[hsl(var(--surface-muted))] animate-pulse"
        />
      ))}
    </div>
  );
});
LoadingSkeleton.displayName = "LoadingSkeleton";

// ─── Main Component ────────────────────────────────────────────────────────

export const WarehouseView = memo(function WarehouseView({
  t,
  fmt,
  search,
  onSearchChange,
  onOpenAddModal,
  deletingId,
  products,
  total,
  isLoading,
  totalValue,
  outOfStock,
  currencies,
  onNavigate,
  onDelete,
  stockStatus,
  stockLabel,
}: WarehouseViewProps) {
  const statsProps = useMemo(
    () => ({
      t,
      fmt,
      total,
      outOfStock,
      totalValue,
      products,
      isLoading,
    }),
    [t, fmt, total, outOfStock, totalValue, products, isLoading]
  );

  const showEmptyState = !isLoading && products.length === 0;

  return (
    <div className="space-y-6">
      <SaveIndicator t={t} deletingId={deletingId} />
      <WarehouseHeader t={t} onOpenAddModal={onOpenAddModal} />

      {/* ✅ استفاده از JSX با PascalCase */}
      <WarehouseStats {...statsProps} />

      <CurrencyChips fmt={fmt} currencies={currencies} totalValue={totalValue} />

      <WarehouseSearch t={t} search={search} onSearchChange={onSearchChange} />

      {isLoading ? (
        <LoadingSkeleton />
      ) : showEmptyState ? (
        <EmptyState
          icon="product"
          title={t("warehouse.noProducts", "هیچ محصولی موجود نیست")}
          description={t("warehouse.noProductsDesc", "اولین محصول خود را اضافه کنید")}
          action={{
            label: t("warehouse.addProduct", "افزودن محصول"),
            onClick: onOpenAddModal,
          }}
        />
      ) : (
        <WarehouseProductList
          t={t}
          fmt={fmt}
          products={products}
          stockStatus={stockStatus}
          stockLabel={stockLabel}
          onNavigate={onNavigate}
          onDelete={onDelete}
          deletingId={deletingId}
        />
      )}
    </div>
  );
});

WarehouseView.displayName = "WarehouseView";