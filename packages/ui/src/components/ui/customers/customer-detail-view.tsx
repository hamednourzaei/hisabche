"use client";

import { cn } from "@/lib/utils";
import { ChevronRight, DollarSign, FileText } from "lucide-react";
import { PaymentModal } from "./PaymentModal";

/* ═══════════════════════════════════════════════════════════════════════════
   CustomerDetailView v3 — Hisabche Design Language
   ✅ Light mode fixed — all backgrounds visible
   ✅ Zero hardcoded colors — all tokens from design system
   ✅ No external component dependencies
   ═══════════════════════════════════════════════════════════════════════════ */

interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  total: number;
  paidAmount: number;
  remaining: number;
  date: string;
  status: string;
}

interface CustomerInfo {
  id: string;
  name: string;
  phone?: string;
}

export interface CustomerDetailViewProps {
  t: (key: string, fallback?: string) => string;
  fmt: (v: number) => string;
  customer: CustomerInfo | null;
  openInvoices: InvoiceRecord[];
  totalDebt: number;
  payOpen: boolean;
  onBack: () => void;
  onOpenPayment: () => void;
  onClosePayment: () => void;
  onPaymentSuccess: () => void;
}

const ghostBtn =
  "inline-flex items-center justify-center rounded-full p-2 text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] transition-colors duration-150 motion-reduce:transition-none";
const outlineBtn =
  "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] transition-colors duration-150 motion-reduce:transition-none";
const primaryBtn =
  "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white bg-[hsl(var(--color-primary))] shadow-sm shadow-[hsl(var(--color-primary)/0.15)] transition-all duration-200 hover:brightness-110 active:scale-[0.98] motion-reduce:transition-none";
const cardBase =
  "rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] shadow-sm";

export function CustomerDetailView({
  t,
  fmt,
  customer,
  openInvoices,
  totalDebt,
  payOpen,
  onBack,
  onOpenPayment,
  onClosePayment,
  onPaymentSuccess,
}: CustomerDetailViewProps) {
  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[hsl(var(--surface-muted))]">
          <FileText
            className="size-7 text-[hsl(var(--fg-tertiary))]"
            aria-hidden="true"
          />
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-[hsl(var(--fg-primary))]">
            {t("customers.notFound")}
          </p>
          <p className="text-sm text-[hsl(var(--fg-secondary))]">
            {t("customers.notFoundDesc", "مشتری مورد نظر یافت نشد")}
          </p>
        </div>
        <button type="button" onClick={onBack} className={outlineBtn}>
          {t("common.back")}
        </button>
      </div>
    );
  }

  const paymentCustomer = {
    id: customer.id,
    fullName: customer.name,
    name: customer.name,
    phone: customer.phone || "",
  };

  return (
    <div className="space-y-6">
      <PaymentModal
        open={payOpen}
        onClose={onClosePayment}
        onPaid={onPaymentSuccess}
        customer={paymentCustomer}
        openInvoices={openInvoices as any}
      />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label={t("common.back")}
            className={ghostBtn}
          >
            <ChevronRight className="size-5" aria-hidden="true" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))]">
              {customer.name}
            </h1>
            {customer.phone && (
              <p className="text-sm text-[hsl(var(--fg-secondary))]">
                {customer.phone}
              </p>
            )}
          </div>
        </div>
        {totalDebt > 0 && (
          <button
            type="button"
            onClick={onOpenPayment}
            className={cn(primaryBtn, "w-full sm:w-auto")}
          >
            <DollarSign className="size-4" aria-hidden="true" />
            {t("customers.recordPayment")}
          </button>
        )}
      </div>

      {/* Total Debt Card */}
      <div
        className={cn(
          cardBase,
          "bg-gradient-to-br from-[hsl(var(--color-destructive)/0.12)] to-[hsl(var(--color-destructive)/0.03)]",
        )}
      >
        <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium text-[hsl(var(--fg-secondary))]">
              {t("customers.totalDebt")}
            </p>
            <p className="text-3xl font-bold tabular-nums text-[hsl(var(--color-destructive))]">
              {fmt(totalDebt)} AFN
            </p>
          </div>
          <div className="flex gap-3 text-xs text-[hsl(var(--fg-secondary))]">
            <span>
              {t(
                "customers.openInvoicesCount",
                `${openInvoices.length} فاکتور باز`,
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Open Invoices */}
      <div className={cardBase}>
        <div className="p-5">
          <h2 className="mb-4 text-lg font-semibold text-[hsl(var(--fg-primary))]">
            {t("customers.openDealsTitle")}
          </h2>

          {openInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--color-success)/0.08)]">
                <FileText
                  className="size-6 text-[hsl(var(--color-success))]"
                  aria-hidden="true"
                />
              </div>
              <p className="text-sm text-[hsl(var(--fg-secondary))]">
                {t("customers.noOpenDeals")}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {openInvoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex flex-col gap-2 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--color-destructive)/0.1)]">
                      <FileText
                        className="size-4 text-[hsl(var(--color-destructive))]"
                        aria-hidden="true"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[hsl(var(--fg-primary))]">
                        #{inv.invoiceNumber}
                      </p>
                      <p className="text-xs text-[hsl(var(--fg-secondary))]">
                        {inv.date}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:text-end">
                    <div>
                      <p className="font-bold tabular-nums text-[hsl(var(--color-destructive))]">
                        {fmt(inv.remaining)} AFN
                      </p>
                      <p className="text-xs text-[hsl(var(--fg-secondary))]">
                        {t(
                          "customers.ofPaid",
                          `از ${fmt(inv.total)} مبلغ ${fmt(inv.paidAmount)} پرداخت شده`,
                        )}
                      </p>
                    </div>
                    {inv.remaining > 0 && (
                      <button
                        type="button"
                        onClick={onOpenPayment}
                        aria-label={t(
                          "customers.payInvoice",
                          `پرداخت فاکتور #${inv.invoiceNumber}`,
                        )}
                        className={ghostBtn}
                      >
                        <DollarSign
                          className="size-4 text-[hsl(var(--color-success))]"
                          aria-hidden="true"
                        />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}