"use client";

import { memo, useMemo } from "react";
import { cn } from "@/lib/utils";
import { EmptyState } from "../empty-state";
import { InvoicesSkeleton } from "./invoices-skeleton";
import { Plus, Search, FileText, DollarSign, CheckCircle2, Clock } from "lucide-react";
import { InvoiceRowActions } from "./invoice-row-actions";
import { BentoStats, type BentoStat } from "../bento-stats";
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
  onNavigateInvoiceAction: (id: string, action: "pdf" | "print" | "png") => void;
  onNewInvoice: () => void;
  onDeleteInvoice: (id: string) => void;
  statusVariant: (
    status: string,
  ) => "success" | "warning" | "destructive" | "secondary";
}

const statusBadgeStyles: Record<string, string> = {
  success: "bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))] border-[hsl(var(--color-success)/0.2)]",
  warning: "bg-[hsl(var(--color-warning)/0.12)] text-[hsl(var(--color-warning))] border-[hsl(var(--color-warning)/0.2)]",
  destructive: "bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))] border-[hsl(var(--color-destructive)/0.2)]",
  secondary: "bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-secondary))] border-[hsl(var(--border-default))]",
};

// ─── آمار (بنتو گرید) ───────────────────────────────────────────────────────

const PAID_STATUSES = new Set(["paid", "completed"]);

/** شماره‌ی ماه نسبی: 0 = ماه جاری، 1 = ماه قبل */
function monthOffset(value: string, now: Date): number | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
}

/** درصد تغییر؛ null یعنی داده‌ای برای مقایسه نیست */
function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? null : 100;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function useInvoiceStats(invoices: Invoice[], t: (key: string, fallback?: string) => string) {
  return useMemo<BentoStat[]>(() => {
    const now = new Date();
    const active = invoices.filter((inv) => inv.status !== "cancelled");
    const inMonth = (offset: number) =>
      active.filter((inv) => monthOffset(inv.isoDate, now) === offset);

    const sum = (list: Invoice[]) => list.reduce((acc, inv) => acc + (inv.total || 0), 0);
    const paid = (list: Invoice[]) => list.filter((inv) => PAID_STATUSES.has(inv.status));
    const pending = (list: Invoice[]) => list.filter((inv) => !PAID_STATUSES.has(inv.status));

    const cur = inMonth(0);
    const prev = inMonth(1);
    const currency = active[0]?.currency || "AFN";
    const monthly = t("common.vsLastMonth", "نسبت به ماه قبل");

    return [
      {
        id: "count",
        icon: FileText,
        label: t("invoices.totalCount", "تعداد فاکتورها"),
        amount: active.length,
        delta: percentChange(cur.length, prev.length),
        deltaLabel: monthly,
      },
      {
        id: "amount",
        icon: DollarSign,
        label: t("invoices.totalAmount", "مجموع مبلغ"),
        amount: sum(active),
        suffix: currency,
        delta: percentChange(sum(cur), sum(prev)),
        deltaLabel: monthly,
      },
      {
        id: "paid",
        icon: CheckCircle2,
        label: t("invoices.paidAmount", "تسویه‌شده"),
        amount: sum(paid(active)),
        suffix: currency,
        delta: percentChange(sum(paid(cur)), sum(paid(prev))),
        deltaLabel: monthly,
      },
      {
        id: "pending",
        icon: Clock,
        label: t("invoices.pendingAmount", "در انتظار پرداخت"),
        amount: sum(pending(active)),
        suffix: currency,
        delta: percentChange(sum(pending(cur)), sum(pending(prev))),
        deltaLabel: monthly,
        invertDelta: true,
      },
    ];
  }, [invoices, t]);
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
          {t("nav.getPaid_description", "چه کسی چقدر باید بپردازد")}
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
  onNavigateInvoiceAction,
  onNewInvoice,
  onDeleteInvoice,
  statusVariant,
}: InvoicesViewProps) {
  const totalPages = useMemo(
    () => Math.ceil(total / filters.limit),
    [total, filters.limit]
  );

  const stats = useInvoiceStats(invoices, t);

  if (isLoading) {
    return <InvoicesSkeleton />;
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <InvoicesHeader t={t} onNewInvoice={onNewInvoice} />
      <SearchBar t={t} onSearchChange={onSearchChange} onClearFilters={onClearFilters} />

      {invoices.length > 0 && <BentoStats t={t} stats={stats} />}

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
        <div className="overflow-x-auto rounded-2xl border border-[hsl(var(--border-default))]">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))] text-start">
                {[
                  ["invoices.status", "وضعیت"],
                  ["invoices.type", "نوع"],
                  ["invoices.invoiceNumber", "فاکتور"],
                  ["invoices.createdAt", "ثبت شده"],
                  ["invoices.customerName", "خریدار"],
                  ["invoices.company", "شرکت"],
                  ["invoices.total", "مجموع"],
                  ["invoices.paymentDate", "تاریخ تسویه"],
                  ["invoices.itemsSent", "ارسال‌شده"],
                  ["invoices.actions", "عملیات"],
                ].map(([key, fallback]) => (
                  <th key={key} className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold text-[hsl(var(--fg-tertiary))]">
                    {t(key!, fallback)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr
                  key={inv.id}
                  onClick={() => onNavigateInvoice(inv.id)}
                  className="cursor-pointer border-b border-[hsl(var(--border-default))] last:border-0 hover:bg-[hsl(var(--surface-muted)/0.5)] transition-colors duration-150"
                >
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border", statusBadgeStyles[statusVariant(inv.status)] ?? statusBadgeStyles.secondary)}>
                      {t(`invoices.${inv.status}`, inv.status)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-[hsl(var(--fg-secondary))]">{t(`invoices.type.${inv.type}`, inv.type)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-medium text-[hsl(var(--fg-primary))]">#{inv.invoiceNumber}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-[hsl(var(--fg-secondary))]">{inv.createdAt}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-[hsl(var(--fg-primary))]">{inv.customerName || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-[hsl(var(--fg-tertiary))]">{inv.company || ""}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums font-semibold text-[hsl(var(--fg-primary))]">{inv.total.toLocaleString()} {inv.currency}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-[hsl(var(--fg-secondary))]">{inv.paymentDate || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-[hsl(var(--fg-secondary))]">{inv.itemsSent}</td>
                  <td className="whitespace-nowrap px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <InvoiceRowActions inv={inv} t={t} onNavigate={onNavigateInvoice} onNavigateAction={onNavigateInvoiceAction} onDelete={onDeleteInvoice} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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