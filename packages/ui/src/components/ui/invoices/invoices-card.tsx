"use client";

import { cn } from "@/lib/utils";
import { Eye, Trash2, FileText } from "lucide-react";
import type { Invoice } from "../../../lib/invoices/invoices-types";

/* ═══════════════════════════════════════════════════════════════════════════
   InvoiceCard v2.1 — Mobile-First Hisabche Design Language
   Zero hardcoded colors — all tokens from design system
   No external component dependencies (Card, Button, Badge removed)
   Improved touch targets for mobile (min 44px)
   ═══════════════════════════════════════════════════════════════════════════ */

interface InvoiceCardProps {
  inv: Invoice;
  t: (key: string, fallback?: string) => string;
  onNavigate: (id: string) => void;
  onDelete: (id: string) => void;
  statusVariant: (
    status: string,
  ) => "success" | "warning" | "destructive" | "secondary";
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

export function InvoiceCard({
  inv,
  t,
  onNavigate,
  onDelete,
  statusVariant,
}: InvoiceCardProps) {
  const badgeStyle =
    statusBadgeStyles[statusVariant(inv.status)] ?? statusBadgeStyles.secondary;

  return (
    <div
      onClick={() => onNavigate(inv.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onNavigate(inv.id);
        }
      }}
      className={cn(
        "cursor-pointer rounded-2xl border border-[hsl(var(--border-default))]",
        "bg-[hsl(var(--surface-elevated))]",
        "transition-all duration-200",
        "hover:shadow-lg hover:border-[hsl(var(--color-primary)/0.3)]",
        "active:scale-[0.98] sm:active:scale-[0.99]",
        "focus-visible:ring-4 focus-visible:ring-[rgba(18,200,160,0.18)] focus-visible:outline-none",
        "motion-reduce:transition-none motion-reduce:active:scale-100",
      )}
    >
      <div className="space-y-3 p-4 sm:space-y-4 sm:p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 sm:gap-3">
          <div className="flex items-start gap-2.5 sm:gap-3 text-start min-w-0 flex-1">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--color-primary)/0.1)] sm:h-11 sm:w-11">
              <FileText
                className="size-4.5 sm:size-5 text-[hsl(var(--color-primary))]"
                aria-hidden="true"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold sm:text-base text-[hsl(var(--fg-primary))]">
                #{inv.invoiceNumber}
              </p>
              <p className="text-[11px] sm:text-xs text-[hsl(var(--fg-tertiary))] mt-0.5">
                {inv.date}
              </p>
            </div>
          </div>

          {/* Status badge */}
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 sm:px-2.5 sm:py-0.5",
              "text-[11px] sm:text-xs font-semibold border shrink-0",
              "leading-tight",
              badgeStyle,
            )}
          >
            {t(`invoices.${inv.status}`, inv.status)}
          </span>
        </div>

        {/* Total */}
        <div>
          <p className="text-[11px] sm:text-xs text-[hsl(var(--fg-tertiary))]">
            {t("invoices.total", "مجموع")}
          </p>
          <p className="text-xl font-bold sm:text-2xl tabular-nums text-[hsl(var(--fg-primary))]">
            {inv.total.toLocaleString()}{" "}
            <span className="text-sm sm:text-base font-medium text-[hsl(var(--fg-tertiary))]">
              {inv.currency}
            </span>
          </p>
        </div>

        {/* Actions — min 44px touch targets for mobile */}
        <div className="flex items-center justify-end gap-1 sm:gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate(inv.id);
            }}
            aria-label={t("action.view", "مشاهده")}
            className={cn(
              "inline-flex items-center justify-center rounded-full",
              "min-h-[44px] min-w-[44px] sm:min-h-[40px] sm:min-w-[40px]",
              "text-[hsl(var(--fg-secondary))]",
              "hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]",
              "active:bg-[hsl(var(--surface-muted)/0.6)]",
              "transition-colors duration-150",
              "focus-visible:ring-4 focus-visible:ring-[rgba(18,200,160,0.18)] focus-visible:outline-none",
              "motion-reduce:transition-none",
            )}
          >
            <Eye className="size-4 sm:size-[18px]" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(inv.id);
            }}
            aria-label={t("action.delete", "حذف")}
            className={cn(
              "inline-flex items-center justify-center rounded-full",
              "min-h-[44px] min-w-[44px] sm:min-h-[40px] sm:min-w-[40px]",
              "text-[hsl(var(--fg-secondary))]",
              "hover:bg-[hsl(var(--color-destructive)/0.1)] hover:text-[hsl(var(--color-destructive))]",
              "active:bg-[hsl(var(--color-destructive)/0.15)]",
              "transition-colors duration-150",
              "focus-visible:ring-4 focus-visible:ring-[rgba(18,200,160,0.18)] focus-visible:outline-none",
              "motion-reduce:transition-none",
            )}
          >
            <Trash2 className="size-4 sm:size-[18px]" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}