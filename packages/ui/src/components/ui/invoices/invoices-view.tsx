"use client";

import { memo, useMemo, useCallback } from "react";  // ✅ اضافه شد
import { cn } from "@/lib/utils";
import { EmptyState } from "../empty-state";
import { InvoicesSkeleton } from "./invoices-skeleton";
import { Plus, Search } from "lucide-react";
import { InvoiceCard } from "./invoices-card";
import type { Invoice } from "../../../lib/invoices/invoices-types";

/* ═══════════════════════════════════════════════════════════════════════════
   InvoicesView v2.2 — Mobile-First · Memoized · Performance-Optimized
   ✅ memo · useMemo · useCallback · جدا شده به کامپوننت‌های کوچک
   ═══════════════════════════════════════════════════════════════════════════ */

interface InvoicesViewProps {
  t: (key: string, fallback?: string) => string;
  invoices: Invoice[];
  isLoading: boolean;
  total: number;
  filters: { page: number; limit: number };
  onSearchChange: (value: string) => void;
  onClearFilters: () => void;
  onPageChange: (page: number) => void;
  onNavigateInvoice: (id: string) => void;
  onNewInvoice: () => void;
  onDeleteInvoice: (id: string) => void;
  statusVariant: (
    status: string,
  ) => "success" | "warning" | "destructive" | "secondary";
}

// ─── Sub-components (هر کدام < ۲۰ خط) ──────────────────────────────────────

const InvoicesHeader = memo(function InvoicesHeader({
  t,
  onNewInvoice,
}: {
  t: (key: string, fallback?: string) => string;
  onNewInvoice: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <h1 className="text-xl font-bold sm:text-2xl lg:text-3xl text-[hsl(var(--fg-primary))]">
          {t("nav.getPaid", "دریافت پول")}
        </h1>
        <p className="text-xs sm:text-sm text-[hsl(var(--fg-secondary))]">
          {t("nav.getPaid.description", "چه کسی چقدر باید بپردازد")}
        </p>
      </div>
      <button
        type="button"
        onClick={onNewInvoice}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-full px-5",
          "min-h-[44px] sm:min-h-[40px]",
          "text-sm font-bold text-white",
          "bg-[hsl(var(--color-primary))]",
          "shadow-sm shadow-[hsl(var(--color-primary)/0.15)]",
          "transition-all duration-200",
          "hover:brightness-110 active:scale-[0.98]",
          "focus-visible:ring-4 focus-visible:ring-[rgba(18,200,160,0.18)] focus-visible:outline-none",
          "motion-reduce:transition-none motion-reduce:active:scale-100",
        )}
      >
        <Plus className="size-4 sm:size-[18px]" aria-hidden="true" />
        {t("invoices.newinvoices", "فاکتور جدید")}
      </button>
    </div>
  );
});
InvoicesHeader.displayName = "InvoicesHeader";

const SearchBar = memo(function SearchBar({
  t,
  onSearchChange,
  onClearFilters,
}: {
  t: (key: string, fallback?: string) => string;
  onSearchChange: (value: string) => void;
  onClearFilters: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <div className="relative w-full sm:max-w-sm">
        <Search
          className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--fg-tertiary))] pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="text"
          inputMode="search"
          enterKeyHint="search"
          placeholder={t("action.search", "جستجو")}
          onChange={(e) => onSearchChange(e.target.value)}
          className={cn(
            "w-full rounded-xl ps-9 pe-3 py-2.5",
            "min-h-[44px] sm:min-h-[40px]",
            "text-sm sm:text-base",
            "border border-[hsl(var(--border-default))]",
            "bg-[hsl(var(--surface-base))]",
            "text-[hsl(var(--fg-primary))]",
            "placeholder:text-[hsl(var(--fg-tertiary))]",
            "focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)]",
            "focus:ring-1 focus:ring-[hsl(var(--color-primary)/0.3)]",
            "transition-colors duration-200",
            "motion-reduce:transition-none",
          )}
        />
      </div>
      <button
        type="button"
        onClick={onClearFilters}
        className={cn(
          "inline-flex items-center justify-center rounded-full px-4",
          "min-h-[44px] sm:min-h-[40px]",
          "text-sm font-medium",
          "border border-[hsl(var(--border-default))]",
          "text-[hsl(var(--fg-secondary))]",
          "hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]",
          "active:bg-[hsl(var(--surface-muted)/0.6)]",
          "transition-colors duration-150",
          "focus-visible:ring-4 focus-visible:ring-[rgba(18,200,160,0.18)] focus-visible:outline-none",
          "motion-reduce:transition-none",
        )}
      >
        {t("action.clear", "پاک کردن")}
      </button>
    </div>
  );
});
SearchBar.displayName = "SearchBar";

const PaginationControls = memo(function PaginationControls({
  t,
  page,
  totalPages,
  onPageChange,
}: {
  t: (key: string, fallback?: string) => string;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 sm:gap-3 pt-4",
        "sticky bottom-0 pb-2 sm:pb-0",
        "bg-[hsl(var(--surface-base)/0.95)] backdrop-blur-sm sm:bg-transparent sm:backdrop-blur-none",
      )}
    >
      <button
        type="button"
        disabled={page === 1}
        onClick={() => onPageChange(page - 1)}
        className={cn(
          "inline-flex items-center justify-center rounded-full px-4",
          "min-h-[44px] sm:min-h-[40px]",
          "text-sm font-medium",
          "border border-[hsl(var(--border-default))]",
          "text-[hsl(var(--fg-secondary))]",
          "hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]",
          "disabled:opacity-30 disabled:cursor-not-allowed",
          "active:bg-[hsl(var(--surface-muted)/0.6)]",
          "transition-colors duration-150",
          "focus-visible:ring-4 focus-visible:ring-[rgba(18,200,160,0.18)] focus-visible:outline-none",
          "motion-reduce:transition-none",
        )}
      >
        {t("action.previous", "قبلی")}
      </button>

      <span className="text-sm tabular-nums text-[hsl(var(--fg-secondary))] min-w-[60px] text-center">
        {page} / {totalPages}
      </span>

      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className={cn(
          "inline-flex items-center justify-center rounded-full px-4",
          "min-h-[44px] sm:min-h-[40px]",
          "text-sm font-medium",
          "border border-[hsl(var(--border-default))]",
          "text-[hsl(var(--fg-secondary))]",
          "hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]",
          "disabled:opacity-30 disabled:cursor-not-allowed",
          "active:bg-[hsl(var(--surface-muted)/0.6)]",
          "transition-colors duration-150",
          "focus-visible:ring-4 focus-visible:ring-[rgba(18,200,160,0.18)] focus-visible:outline-none",
          "motion-reduce:transition-none",
        )}
      >
        {t("action.next", "بعدی")}
      </button>
    </div>
  );
});
PaginationControls.displayName = "PaginationControls";

// ─── Main Component ─────────────────────────────────────────────────────────

export const InvoicesView = memo(function InvoicesView({
  t,
  invoices,
  isLoading,
  total,
  filters,
  onSearchChange,
  onClearFilters,
  onPageChange,
  onNavigateInvoice,
  onNewInvoice,
  onDeleteInvoice,
  statusVariant,
}: InvoicesViewProps) {
  // ✅ useMemo: فقط زمانی محاسبه می‌شود که invoices یا فیلترها تغییر کنند
  const totalPages = useMemo(
    () => Math.ceil(total / filters.limit),
    [total, filters.limit]
  );

  // ✅ useMemo: فقط زمانی کارت‌ها رندر می‌شوند که invoices تغییر کند
  const invoiceCards = useMemo(
    () =>
      invoices.map((inv) => (
        <InvoiceCard
          key={inv.id}
          inv={inv}
          onNavigate={onNavigateInvoice}
          onDelete={onDeleteInvoice}
          statusVariant={statusVariant}
          t={t}
        />
      )),
    [invoices, onNavigateInvoice, onDeleteInvoice, statusVariant, t]
  );

  if (isLoading) {
    return <InvoicesSkeleton />;
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <InvoicesHeader t={t} onNewInvoice={onNewInvoice} />
      <SearchBar t={t} onSearchChange={onSearchChange} onClearFilters={onClearFilters} />

      {invoices.length === 0 ? (
        <EmptyState
          icon="invoice"
          title={t("invoices.noinvoicess", "هیچ فاکتوری یافت نشد")}
          description={t("invoices.noinvoicessDesc", "هنوز هیچ فاکتوری ثبت نشده است.")}
          action={{
            label: t("invoices.newinvoices", "فاکتور جدید"),
            onClick: onNewInvoice,
          }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
          {invoiceCards}
        </div>
      )}

      {total > filters.limit && (
        <PaginationControls
          t={t}
          page={filters.page}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
});

InvoicesView.displayName = "InvoicesView";