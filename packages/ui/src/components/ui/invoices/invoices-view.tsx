// packages/ui/src/components/ui/invoices/invoices-view.tsx
"use client";

import { cn } from "@/lib/utils";
import { EmptyState } from "../empty-state";
import { InvoicesSkeleton } from "./invoices-skeleton";
import { Plus, Search } from "lucide-react";
import { InvoiceCard } from "./invoices-card";
import type { Invoice } from "../../../lib/invoices/invoices-types";

/* ═══════════════════════════════════════════════════════════════════════════
   InvoicesView v2 — Hisabche Design Language
   Zero hardcoded colors — all tokens from design system
   No external component dependencies (Button, Input removed)
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold sm:text-3xl text-[hsl(var(--fg-primary))]">
            {t("faktoor.title", "فاکتورها")}
          </h1>
          <p className="text-sm text-[hsl(var(--fg-secondary))]">
            {t("faktoor.description", "مدیریت و مشاهده فاکتورها")}
          </p>
        </div>

        {/* New invoice button */}
        <button
          type="button"
          onClick={onNewInvoice}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-5 py-2.5",
            "text-sm font-bold text-white",
            "bg-[var(--gradient-brand)]",
            "shadow-sm shadow-[hsl(var(--color-primary)/0.15)]",
            "transition-all duration-200 hover:brightness-110 active:scale-[0.98]",
            "motion-reduce:transition-none",
          )}
        >
          <Plus className="size-4" aria-hidden="true" />
          {t("faktoor.newFaktoor", "فاکتور جدید")}
        </button>
      </div>

      {/* Search + Clear */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="max-w-sm relative">
          <Search
            className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--fg-tertiary))] pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="text"
            placeholder={t("action.search", "جستجو")}
            onChange={(e) => onSearchChange(e.target.value)}
            className={cn(
              "w-full rounded-xl ps-9 pe-3 py-2.5 text-sm",
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

        <button
          type="button"
          onClick={onClearFilters}
          className={cn(
            "inline-flex items-center rounded-full px-4 py-2.5 text-sm font-medium",
            "border border-[hsl(var(--border-default))]",
            "text-[hsl(var(--fg-secondary))]",
            "hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]",
            "transition-colors duration-150",
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
          title={t("faktoor.noFaktoors", "هیچ فاکتوری یافت نشد")}
          description={t(
            "faktoor.noFaktoorsDesc",
            "هنوز هیچ فاکتوری ثبت نشده است.",
          )}
          action={{
            label: t("faktoor.newFaktoor", "فاکتور جدید"),
            onClick: onNewInvoice,
          }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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

      {/* Pagination */}
      {total > 10 && (
        <div className="flex items-center justify-center gap-3 pt-4">
          <button
            type="button"
            disabled={filters.page === 1}
            onClick={() => onPageChange(filters.page - 1)}
            className={cn(
              "inline-flex items-center rounded-full px-4 py-2 text-sm font-medium",
              "border border-[hsl(var(--border-default))]",
              "text-[hsl(var(--fg-secondary))]",
              "hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]",
              "disabled:opacity-40 disabled:cursor-not-allowed",
              "transition-colors duration-150",
              "motion-reduce:transition-none",
            )}
          >
            {t("action.previous", "قبلی")}
          </button>

          <span className="text-sm tabular-nums text-[hsl(var(--fg-secondary))]">
            {filters.page} / {Math.ceil(total / 10)}
          </span>

          <button
            type="button"
            disabled={filters.page * 10 >= total}
            onClick={() => onPageChange(filters.page + 1)}
            className={cn(
              "inline-flex items-center rounded-full px-4 py-2 text-sm font-medium",
              "border border-[hsl(var(--border-default))]",
              "text-[hsl(var(--fg-secondary))]",
              "hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]",
              "disabled:opacity-40 disabled:cursor-not-allowed",
              "transition-colors duration-150",
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