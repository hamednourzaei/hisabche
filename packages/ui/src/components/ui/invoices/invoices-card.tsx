// packages/ui/src/components/ui/invoices/invoices-card.tsx
"use client";

import { cn } from "@/lib/utils";
import { Eye, Trash2, FileText } from "lucide-react";
import type { Invoice } from "../../../lib/invoices/invoices-types";

/* ═══════════════════════════════════════════════════════════════════════════
   InvoiceCard v2 — Hisabche Design Language
   Zero hardcoded colors — all tokens from design system
   No external component dependencies (Card, Button, Badge removed)
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
      className={cn(
        "cursor-pointer rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]",
        "transition-all duration-200 hover:shadow-lg hover:border-[hsl(var(--color-primary)/0.3)]",
      )}
    >
      <div className="space-y-4 p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 text-start min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--color-primary)/0.1)]">
              <FileText
                className="size-5 text-[hsl(var(--color-primary))]"
                aria-hidden="true"
              />
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-[hsl(var(--fg-primary))]">
                #{inv.invoiceNumber}
              </p>
              <p className="text-xs text-[hsl(var(--fg-tertiary))]">{inv.date}</p>
            </div>
          </div>

          {/* Status badge */}
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border shrink-0",
              badgeStyle,
            )}
          >
            {t(`faktoor.${inv.status}`, inv.status)}
          </span>
        </div>

        {/* Total */}
        <div>
          <p className="text-xs text-[hsl(var(--fg-tertiary))]">
            {t("faktoor.total", "مجموع")}
          </p>
          <p className="text-2xl font-bold tabular-nums text-[hsl(var(--fg-primary))]">
            {inv.total.toLocaleString()} {inv.currency}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate(inv.id);
            }}
            aria-label={t("action.view", "مشاهده")}
            className={cn(
              "inline-flex items-center justify-center rounded-full p-2",
              "text-[hsl(var(--fg-secondary))]",
              "hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]",
              "transition-colors duration-150",
              "motion-reduce:transition-none",
            )}
          >
            <Eye className="size-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(inv.id);
            }}
            aria-label={t("action.delete", "حذف")}
            className={cn(
              "inline-flex items-center justify-center rounded-full p-2",
              "text-[hsl(var(--fg-secondary))]",
              "hover:bg-[hsl(var(--color-destructive)/0.1)] hover:text-[hsl(var(--color-destructive))]",
              "transition-colors duration-150",
              "motion-reduce:transition-none",
            )}
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}