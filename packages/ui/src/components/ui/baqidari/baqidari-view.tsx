// packages/ui/src/components/ui/baqidari/baqidari-view.tsx
"use client";

import { cn } from "@/lib/utils";
import { EmptyState } from "../empty-state";
import { Plus, ShoppingCart, Search } from "lucide-react";
import { BaqidariStats } from "./baqidari-stats";
import { BaqidariCustomerList } from "./baqidari-customer-list";
import { AddCustomerModal } from "./AddCustomerModal";
import { PaymentModal } from "./PaymentModal";
import { CustomerDetailContainer } from "./containers/customer-detail-container";
import type { CustomerWithDebt, InvoiceForDebt } from "../../../lib/baqidari/baqidari-types";

/* ═══════════════════════════════════════════════════════════════════════════
   BaqidariView v2 — Hisabche Design Language
   Zero hardcoded colors — all tokens from design system
   No external component dependencies (Button, Input removed)
   ═══════════════════════════════════════════════════════════════════════════ */

interface BaqidariViewProps {
  t: (key: string, fallback?: string) => string;
  fmt: (v: number) => string;
  search: string;
  onSearchChange: (value: string) => void;
  customersWithDebt: CustomerWithDebt[];
  debtorCount: number;
  totalDebt: number;
  openDealsCount: number;
  isLoading: boolean;
  selectedCustomerId: string | null;
  onSelectCustomer: (id: string) => void;
  onClearSelection: () => void;
  showAddModal: boolean;
  onOpenAddModal: () => void;
  onCloseAddModal: () => void;
  showPaymentModal: boolean;
  paymentCustomer: CustomerWithDebt | null;
  paymentInvoices: InvoiceForDebt[];
  onOpenPayment: (customer: CustomerWithDebt) => void;
  onClosePayment: () => void;
  onPaymentSuccess: () => void;
  onNewCreditInvoice: () => void;
}

const primaryBtn =
  "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white bg-[hsl(var(--color-primary))] shadow-sm shadow-[hsl(var(--color-primary)/0.15)] transition-all duration-200 hover:brightness-110 active:scale-[0.98] motion-reduce:transition-none";
const outlineBtn =
  "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] transition-all duration-200 motion-reduce:transition-none";

export function BaqidariView({
  t,
  fmt,
  search,
  onSearchChange,
  customersWithDebt,
  debtorCount,
  totalDebt,
  openDealsCount,
  isLoading,
  selectedCustomerId,
  onSelectCustomer,
  onClearSelection,
  showAddModal,
  onOpenAddModal,
  onCloseAddModal,
  showPaymentModal,
  paymentCustomer,
  paymentInvoices,
  onOpenPayment,
  onClosePayment,
  onPaymentSuccess,
  onNewCreditInvoice,
}: BaqidariViewProps) {
  if (selectedCustomerId) {
    return (
      <CustomerDetailContainer
        customerId={selectedCustomerId}
        onBack={onClearSelection}
      />
    );
  }

  return (
    <div className="space-y-6">
      <AddCustomerModal
        open={showAddModal}
        onClose={onCloseAddModal}
        onCreated={() => {}}
      />

      <PaymentModal
        open={showPaymentModal}
        onClose={onClosePayment}
        onPaid={onPaymentSuccess}
        customer={paymentCustomer}
        openInvoices={paymentInvoices}
      />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold sm:text-3xl text-[hsl(var(--fg-primary))]">
            {t("baqidari.title", "باقیداری")}
          </h1>
          <p className="text-sm text-[hsl(var(--fg-secondary))]">
            {t("baqidari.subtitle", "مدیریت بدهی‌ها و پرداخت‌ها")}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onNewCreditInvoice} className={primaryBtn}>
            <ShoppingCart className="size-4" aria-hidden="true" />
            {t("baqidari.creditInvoice", "فاکتور نسیه")}
          </button>
          <button type="button" onClick={onOpenAddModal} className={outlineBtn}>
            <Plus className="size-4" aria-hidden="true" />
            {t("baqidari.addCustomer", "افزودن مشتری")}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="max-w-sm relative">
        <Search
          className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--fg-tertiary))] pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="text"
          placeholder={t("baqidari.searchPlaceholder", "جستجوی مشتری...")}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className={cn(
            "w-full rounded-xl ps-9 pe-4 py-3 text-sm",
            "border border-[hsl(var(--border-default))]",
            "bg-[hsl(var(--surface-base))]",
            "text-[hsl(var(--fg-primary))]",
            "placeholder:text-[hsl(var(--fg-tertiary))]",
            "focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)] focus:ring-1 focus:ring-[hsl(var(--color-primary)/0.3)]",
            "transition-all duration-200",
            "motion-reduce:transition-none",
          )}
        />
      </div>

      {/* Stats */}
      <BaqidariStats
        t={t}
        debtorCount={debtorCount}
        totalDebt={totalDebt}
        openDealsCount={openDealsCount}
        fmt={fmt}
      />

      {/* Customer List or Empty State */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-24 rounded-xl bg-[hsl(var(--surface-muted))] animate-pulse"
            />
          ))}
        </div>
      ) : customersWithDebt.length === 0 ? (
        <EmptyState
          icon="users"
          title={t("baqidari.empty.title", "هیچ مشتری‌ای یافت نشد")}
          description={t("baqidari.empty.subtitle", "با افزودن مشتری جدید شروع کنید")}
          action={{
            label: t("baqidari.addCustomer", "افزودن مشتری"),
            onClick: onOpenAddModal,
          }}
        />
      ) : (
        <BaqidariCustomerList
          t={t}
          fmt={fmt}
          customers={customersWithDebt}
          onSelectCustomer={onSelectCustomer}
          onPaymentClick={(customer, e) => {
            e.stopPropagation();
            onOpenPayment(customer);
          }}
        />
      )}
    </div>
  );
}