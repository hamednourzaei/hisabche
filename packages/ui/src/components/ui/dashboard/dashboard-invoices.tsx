// packages/ui/src/components/ui/dashboard/dashboard-invoices.tsx
"use client";

import { memo, useCallback } from "react";
import { Button } from "../button";
import { Skeleton } from "../skeleton";
import { Receipt, PlusCircle, User } from "lucide-react";
import { useCurrency } from "../../../hooks/dashboard/use-currency";

// ─── Types ────────────────────────────────────────────────────────────────

type Translate = (key: string, fallback?: string) => string;

interface RecentInvoice {
  id: string;
  customer: string;
  total: number;
  date: string;
}

interface DashboardInvoicesProps {
  t: Translate;
  invLoading: boolean;
  recentInvoices: RecentInvoice[];
  onNavigateInvoice: (id: string) => void;
  onNavigateQuickInvoice: () => void;
  onViewAllInvoices: () => void;
}

// ─── Skeleton ──────────────────────────────────────────────────────────────

const InvoiceRowSkeleton = memo(function InvoiceRowSkeleton() {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated)/0.5)] p-4">
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-32 rounded-md" />
        <Skeleton className="h-3 w-20 rounded-md" />
      </div>
      <Skeleton className="h-4 w-24 rounded-md" />
    </div>
  );
});
InvoiceRowSkeleton.displayName = "InvoiceRowSkeleton";

// ─── Recent Invoice Row ───────────────────────────────────────────────────

const RecentInvoiceRow = memo(function RecentInvoiceRow({
  inv,
  onNavigateInvoice,
  t,
  format,
}: {
  inv: RecentInvoice;
  onNavigateInvoice: (id: string) => void;
  t: Translate;
  format: (v: number) => string;
}) {
  const displayName = inv.customer?.trim() || t("common.noCustomer");

  const handleClick = useCallback(() => {
    onNavigateInvoice(inv.id);
  }, [inv.id, onNavigateInvoice]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className="interactive-card group flex w-full items-center justify-between rounded-xl p-4 text-start motion-safe:transition-all hover:bg-[hsl(var(--surface-muted)/0.5)] focus-visible:ring-4 focus-visible:ring-[hsl(var(--status-info)/0.3)] focus-visible:outline-none"
      aria-label={t("invoice.open") + " " + displayName} // ✅ ترمیم شده
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[hsl(var(--color-primary)/0.15)] to-[hsl(var(--status-info)/0.15)] text-[hsl(var(--color-primary))]">
          <User className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[hsl(var(--fg-primary))]">
            {displayName}
          </p>
          <p className="text-xs text-[hsl(var(--fg-secondary))]">{inv.date}</p>
        </div>
      </div>
      <div className="ms-3 shrink-0 font-bold tabular-nums text-[hsl(var(--fg-primary))]">
        {format(inv.total)}
      </div>
    </button>
  );
});
RecentInvoiceRow.displayName = "RecentInvoiceRow";

// ─── Empty State ───────────────────────────────────────────────────────────

const EmptyInvoices = memo(function EmptyInvoices({
  onCreate,
  t,
}: {
  onCreate: () => void;
  t: Translate;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-[hsl(var(--color-primary)/0.2)] blur-2xl" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-[hsl(var(--border-default))] bg-gradient-to-br from-[hsl(var(--color-primary)/0.15)] to-[hsl(var(--status-info)/0.15)]">
          <Receipt className="size-7 text-[hsl(var(--color-primary))]" aria-hidden="true" />
        </div>
      </div>
      <div className="space-y-1">
        <p className="font-semibold text-[hsl(var(--fg-primary))]">
          {t("dashboard.empty.title")}
        </p>
        <p className="text-sm text-[hsl(var(--fg-secondary))]">
          {t("dashboard.empty.subtitle")}
        </p>
      </div>
      <Button
        type="button"
        onClick={onCreate}
        className="shimmer-btn mt-2 inline-flex items-center gap-2 rounded-xl"
      >
        <PlusCircle className="size-4" aria-hidden="true" />
        {t("invoices.newinvoices")}
      </Button>
    </div>
  );
});
EmptyInvoices.displayName = "EmptyInvoices";

// ─── Main Component ──────────────────────────────────────────────────────

export const DashboardInvoices = memo(function DashboardInvoices({
  t,
  invLoading,
  recentInvoices,
  onNavigateInvoice,
  onNavigateQuickInvoice,
  onViewAllInvoices,
}: DashboardInvoicesProps) {
  const { format } = useCurrency();

  if (invLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <InvoiceRowSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (recentInvoices.length === 0) {
    return <EmptyInvoices onCreate={onNavigateQuickInvoice} t={t} />;
  }

  return (
    <div className="space-y-3">
      {recentInvoices.map((inv) => (
        <RecentInvoiceRow
          key={inv.id}
          inv={inv}
          onNavigateInvoice={onNavigateInvoice}
          t={t}
          format={format}
        />
      ))}
      
      <Button
        type="button"
        variant="outline"
        onClick={onViewAllInvoices}
        className="mt-2 w-full rounded-xl border-dashed"
        aria-label={t("dashboard.viewAllInvoices")}
      >
        {t("dashboard.viewAllInvoices")}
      </Button>
    </div>
  );
});

DashboardInvoices.displayName = "DashboardInvoices";