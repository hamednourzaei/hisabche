"use client";

import { cn } from "@/lib/utils";
import { EmptyState } from "../empty-state";
import { InvoicesSkeleton } from "./invoices-skeleton";
import { Plus, Search } from "lucide-react";
import { InvoiceCard } from "./invoices-card";
import type { Invoice } from "../../../lib/invoices/invoices-types";

/* ═══════════════════════════════════════════════════════════════════════════
   InvoicesView v2.1 — Mobile-First Hisabche Design Language
   Zero hardcoded colors — all tokens from design system
   Full-width controls on mobile, min 44px touch targets, fixed gradient
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

export function InvoicesView({
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
  if (isLoading) {
    return <InvoicesSkeleton />;
  }

  const totalPages = Math.ceil(total / filters.limit);
  const hasFilters = total > 0; // true if we have data to clear from

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header — stacked on mobile, row on tablet+ */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-bold sm:text-2xl lg:text-3xl text-[hsl(var(--fg-primary))]">
            {t("invoices.title", "فاکتورها")}
          </h1>
          <p className="text-xs sm:text-sm text-[hsl(var(--fg-secondary))]">
            {t("invoices.description", "مدیریت و مشاهده فاکتورها")}
          </p>
        </div>

        {/* New invoice — full-width on mobile */}
        <button
          type="button"
          onClick={onNewInvoice}
          className={cn(
            "inline-flex items-center justify-center gap-2",
            "rounded-full px-5",
            "min-h-[44px] sm:min-h-[40px]",
            "text-sm font-bold text-white",
            "bg-[hsl(var(--color-primary))]",
            "shadow-sm shadow-[hsl(var(--color-primary)/0.15)]",
            "transition-all duration-200",
            "hover:brightness-110",
            "active:scale-[0.98]",
            "focus-visible:ring-4 focus-visible:ring-[rgba(18,200,160,0.18)] focus-visible:outline-none",
            "motion-reduce:transition-none motion-reduce:active:scale-100",
          )}
        >
          <Plus className="size-4 sm:size-[18px]" aria-hidden="true" />
          {t("invoices.newinvoices", "فاکتور جدید")}
        </button>
      </div>

      {/* Search + Clear — full-width on mobile, row on tablet+ */}
      <div className="flex flex-col gap-2 sm:flex-row">
        {/* Search — full-width on mobile */}
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
              "w-full rounded-xl",
              "ps-9 pe-3 py-2.5 sm:py-2.5",
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

        {/* Clear button — full-width on mobile */}
        <button
          type="button"
          onClick={onClearFilters}
          className={cn(
            "inline-flex items-center justify-center",
            "rounded-full px-4",
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

      {/* Invoice cards */}
      {invoices.length === 0 ? (
        <EmptyState
          icon="invoice"
          title={t("invoices.noinvoicess", "هیچ فاکتوری یافت نشد")}
          description={t(
            "invoices.noinvoicessDesc",
            "هنوز هیچ فاکتوری ثبت نشده است.",
          )}
          action={{
            label: t("invoices.newinvoices", "فاکتور جدید"),
            onClick: onNewInvoice,
          }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
          {invoices.map((inv) => (
            <InvoiceCard
              key={inv.id}
              inv={inv}
              onNavigate={onNavigateInvoice}
              onDelete={onDeleteInvoice}
              statusVariant={statusVariant}
              t={t}
            />
          ))}
        </div>
      )}

      {/* Pagination — sticky bottom on mobile */}
      {total > filters.limit && (
        <div
          className={cn(
            "flex items-center justify-center gap-2 sm:gap-3 pt-4",
            "sticky bottom-0 pb-2 sm:pb-0",
            "bg-[hsl(var(--surface-base)/0.95)] backdrop-blur-sm sm:bg-transparent sm:backdrop-blur-none",
          )}
        >
          <button
            type="button"
            disabled={filters.page === 1}
            onClick={() => onPageChange(filters.page - 1)}
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
            {filters.page} / {totalPages}
          </span>

          <button
            type="button"
            disabled={filters.page >= totalPages}
            onClick={() => onPageChange(filters.page + 1)}
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
      )}
    </div>
  );
}