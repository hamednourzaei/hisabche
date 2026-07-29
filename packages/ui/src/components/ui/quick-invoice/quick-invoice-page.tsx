// packages/ui/src/components/ui/quick-invoice/quick-invoice-page.tsx
"use client";

import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Check,
  User,
  DollarSign,
  Package,
  CreditCard,
  Plus,
  Trash2,
  Eye,
  Pencil,
} from "lucide-react";
import { ProductPicker } from "../product-picker";
import { CustomerPicker } from "../customer-picker";
import { MoneyInput } from "../money-input";
import { memo, useMemo, useState } from "react";
import {
  InvoiceDocument,
  type InvoiceDocumentData,
  type InvoiceDocumentDisplaySettings,
} from "../invoice-detail/invoice-document";
import { InvoiceSidebar } from "../invoice-detail/invoice-sidebar";
import { useWorkspaces } from "@hisabche/api";

/* ═══════════════════════════════════════════════════════════════════════════
   QuickInvoicePage v4 — Memoized · Performance Optimized
   ✅ memo · useMemo · Row جدا شده
   ═══════════════════════════════════════════════════════════════════════════ */

interface ProductOption {
  id: string;
  name: string;
  sellPrice: number;
  unit: string;
}

interface CustomerOption {
  id: string;
  name: string;
  phone: string;
}

export interface InvoiceLineItem {
  key: string;
  product: ProductOption;
  quantity: string;
  price: string;
}

type Step = "product" | "customer" | "price" | "preview" | "done";
type PaymentType = "cash" | "credit";

const STEPS: Step[] = ["product", "customer", "price", "preview", "done"] as const;

export interface QuickInvoicePageProps {
  t: (key: string, fallback?: string) => string;
  elapsedFormatted: string;
  showSaved: boolean;
  showCelebration: boolean;
  step: Step;
  items: InvoiceLineItem[];
  selectedCustomer: CustomerOption | null;
  paymentType: PaymentType;
  paidNow: string;
  total: number;
  productName: string;
  paidAmount: number;
  createdInvoiceId: string | null;
  isPending: boolean;
  onAddItem: (p: ProductOption) => void;
  onRemoveItem: (key: string) => void;
  onUpdateItemQuantity: (key: string, quantity: string) => void;
  onUpdateItemPrice: (key: string, price: string) => void;
  onSelectCustomer: (c: CustomerOption | null) => void;
  onPaymentTypeChange: (t: PaymentType) => void;
  onPaidNowChange: (v: string) => void;
  onSetStep: (s: Step) => void;
  onConfirmCreate: () => void;
  onDismissCelebration: () => void;
  onViewInvoice: () => void;
  onViewAllInvoices: () => void;
}

// ─── Row ────────────────────────────────────────────────────────────────────

const Row = memo(function Row({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="mb-2 last:mb-0 flex justify-between">
      <span className="text-sm text-[hsl(var(--fg-secondary))]">{label}</span>
      <span className={cn("font-medium text-[hsl(var(--fg-primary))]", valueClass)}>
        {value}
      </span>
    </div>
  );
});
Row.displayName = "Row";

// ─── Step: Items (multi-product) ───────────────────────────────────────────

const ItemRow = memo(function ItemRow({
  item,
  onRemove,
  onUpdateQuantity,
  onUpdatePrice,
  t,
}: {
  item: InvoiceLineItem;
  onRemove: (key: string) => void;
  onUpdateQuantity: (key: string, quantity: string) => void;
  onUpdatePrice: (key: string, price: string) => void;
  t: (key: string, fallback?: string) => string;
}) {
  const lineTotal = (parseFloat(item.price) || 0) * (parseInt(item.quantity) || 0);
  return (
    <div className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-medium text-sm text-[hsl(var(--fg-primary))]">
          {item.product.name}
        </span>
        <button
          type="button"
          onClick={() => onRemove(item.key)}
          className="shrink-0 rounded-full p-1.5 text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--color-destructive)/0.1)] hover:text-[hsl(var(--color-destructive))]"
          aria-label={t("action.delete", "حذف")}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          value={item.quantity}
          onChange={(e) => onUpdateQuantity(item.key, e.target.value)}
          className="w-16 rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-2 py-1.5 text-sm text-center text-[hsl(var(--fg-primary))] focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)]"
        />
        <span className="text-xs text-[hsl(var(--fg-tertiary))]">×</span>
        <MoneyInput
          value={item.price}
          onChange={(raw) => onUpdatePrice(item.key, raw)}
          className="flex-1 h-auto rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-2 py-1.5 text-sm text-[hsl(var(--fg-primary))] focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)]"
        />
        <span className="shrink-0 text-sm font-bold tabular-nums text-[hsl(var(--color-primary))]">
          {lineTotal.toLocaleString()}
        </span>
      </div>
    </div>
  );
});
ItemRow.displayName = "ItemRow";

const ItemsStep = memo(function ItemsStep({
  items,
  onAddItem,
  onRemoveItem,
  onUpdateItemQuantity,
  onUpdateItemPrice,
  onNext,
  t,
}: {
  items: InvoiceLineItem[];
  onAddItem: (p: ProductOption) => void;
  onRemoveItem: (key: string) => void;
  onUpdateItemQuantity: (key: string, quantity: string) => void;
  onUpdateItemPrice: (key: string, price: string) => void;
  onNext: () => void;
  t: (key: string, fallback?: string) => string;
}) {
  return (
    <div className="rounded-2xl border border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-elevated))]">
      <div className="p-6 space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[hsl(var(--color-primary)/0.1)]">
            <Package className="size-8 text-[hsl(var(--color-primary))]" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))]">
            {t("quickInvoice.whatSold", "اجناس فاکتور")}
          </h1>
          <p className="mt-2 text-sm text-[hsl(var(--fg-secondary))]">
            {t("quickInvoice.whatSoldDesc", "یک یا چند جنس را انتخاب کنید")}
          </p>
        </div>

        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((item) => (
              <ItemRow
                key={item.key}
                item={item}
                onRemove={onRemoveItem}
                onUpdateQuantity={onUpdateItemQuantity}
                onUpdatePrice={onUpdateItemPrice}
                t={t}
              />
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Plus className="size-4 shrink-0 text-[hsl(var(--fg-tertiary))]" aria-hidden="true" />
          <ProductPicker
            value={null}
            onChange={(p) => p && onAddItem(p)}
            placeholder={t("warehouse.pickProduct", "افزودن جنس از گدام...")}
          />
        </div>

        <button
          type="button"
          disabled={items.length === 0}
          onClick={onNext}
          className={cn(
            "w-full inline-flex items-center justify-center gap-2 rounded-full px-6 py-3",
            "text-sm font-bold text-white",
            "bg-[hsl(var(--color-primary))]",
            "shadow-sm shadow-[hsl(var(--color-primary)/0.15)]",
            "transition-all duration-200 hover:brightness-110 active:scale-[0.98]",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            "motion-reduce:transition-none"
          )}
        >
          <ArrowRight className="size-4" aria-hidden="true" />
          {t("action.next", "ادامه")}
        </button>
      </div>
    </div>
  );
});
ItemsStep.displayName = "ItemsStep";

// ─── Step: Customer ────────────────────────────────────────────────────────

const CustomerStep = memo(function CustomerStep({
  selectedCustomer,
  onSelectCustomer,
  onBack,
  onNext,
  t,
}: {
  selectedCustomer: CustomerOption | null;
  onSelectCustomer: (c: CustomerOption | null) => void;
  onBack: () => void;
  onNext: () => void;
  t: (key: string, fallback?: string) => string;
}) {
  return (
    <div className="rounded-2xl border border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-elevated))]">
      <div className="p-6 space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[hsl(var(--surface-muted))]">
            <User className="size-8 text-[hsl(var(--fg-secondary))]" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))]">
            {t("invoices.customer", "مشتری")}
          </h1>
          <p className="mt-2 text-sm text-[hsl(var(--fg-secondary))]">
            {t("quickInvoice.toWhom", "نام مشتری را انتخاب کنید (اختیاری)")}
          </p>
        </div>

        <CustomerPicker
          value={selectedCustomer}
          onChange={onSelectCustomer}
          placeholder={t("customer.pickPlaceholder", "انتخاب مشتری...")}
        />

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onBack}
            className={cn(
              "w-full rounded-full px-4 py-2.5 text-sm font-medium",
              "border border-[hsl(var(--border-default))]",
              "text-[hsl(var(--fg-secondary))]",
              "hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]",
              "transition-colors duration-150",
              "motion-reduce:transition-none"
            )}
          >
            {t("action.back", "برگشت")}
          </button>
          <button
            type="button"
            onClick={onNext}
            className={cn(
              "w-full rounded-full px-4 py-2.5 text-sm font-bold text-white",
              "bg-[hsl(var(--color-primary))]",
              "transition-all duration-200 hover:brightness-110 active:scale-[0.98]",
              "motion-reduce:transition-none"
            )}
          >
            {t("action.next", "ادامه")}
          </button>
        </div>
      </div>
    </div>
  );
});
CustomerStep.displayName = "CustomerStep";

// ─── Step: Payment ──────────────────────────────────────────────────────────

const PriceStep = memo(function PriceStep({
  t,
  items,
  selectedCustomer,
  paymentType,
  paidNow,
  total,
  isPending,
  onPaymentTypeChange,
  onPaidNowChange,
  onBack,
  onNext,
}: {
  t: (key: string, fallback?: string) => string;
  items: InvoiceLineItem[];
  selectedCustomer: CustomerOption | null;
  paymentType: PaymentType;
  paidNow: string;
  total: number;
  isPending: boolean;
  onPaymentTypeChange: (t: PaymentType) => void;
  onPaidNowChange: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const hasItems = items.length > 0;

  return (
    <div className="rounded-2xl border border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-elevated))]">
      <div className="p-6 space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[hsl(var(--color-success)/0.1)]">
            <DollarSign className="size-8 text-[hsl(var(--color-success))]" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))]">
            {t("invoices.total", "مبلغ فاکتور")}
          </h1>
          <p className="mt-2 text-sm text-[hsl(var(--fg-secondary))]">
            {t("quickInvoice.howToPay", "نوع پرداخت را انتخاب کنید")}
          </p>
        </div>

        <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] p-4 text-start space-y-2">
          {items.map((item) => (
            <div key={item.key} className="flex items-center justify-between text-sm">
              <span className="text-[hsl(var(--fg-secondary))]">
                {item.product.name} × {item.quantity}
              </span>
              <span className="font-medium text-[hsl(var(--fg-primary))]">
                {((parseFloat(item.price) || 0) * (parseInt(item.quantity) || 0)).toLocaleString()}
              </span>
            </div>
          ))}
          {selectedCustomer && (
            <div className="flex items-center justify-between border-t border-[hsl(var(--border-default))] pt-2">
              <span className="text-sm text-[hsl(var(--fg-secondary))]">{t("invoices.customer", "مشتری")}</span>
              <span className="font-medium text-[hsl(var(--fg-primary))]">{selectedCustomer.name}</span>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {(["cash", "credit"] as PaymentType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onPaymentTypeChange(type)}
              className={cn(
                "flex-1 rounded-full px-4 py-2.5 text-sm font-bold transition-all duration-200 motion-reduce:transition-none",
                paymentType === type
                  ? "bg-[hsl(var(--color-primary))] text-white shadow-sm"
                  : "border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))]"
              )}
            >
              {type === "cash" ? "💵 " : "📝 "}
              {type === "cash" ? t("invoices.cash", "نقد") : t("invoices.credit", "نسیه")}
            </button>
          ))}
        </div>

        {paymentType === "credit" && (
          <div className="relative">
            <CreditCard className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--fg-tertiary))] pointer-events-none" aria-hidden="true" />
            <MoneyInput
              value={paidNow}
              onChange={(raw) => onPaidNowChange(raw)}
              placeholder={`${t("payment.record", "پیش‌پرداخت")} (کل: ${total.toLocaleString()} AFN)`}
              className={cn(
                "w-full h-auto rounded-xl ps-9 pe-3 py-3 text-sm",
                "border border-[hsl(var(--border-default))]",
                "bg-[hsl(var(--surface-base))]",
                "text-[hsl(var(--fg-primary))]",
                "placeholder:text-[hsl(var(--fg-tertiary))]",
                "focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)] focus:ring-1 focus:ring-[hsl(var(--color-primary)/0.3)]"
              )}
            />
          </div>
        )}

        {hasItems && (
          <div className="rounded-2xl bg-[hsl(var(--color-primary)/0.05)] p-5 text-center border border-[hsl(var(--border-default))]">
            <p className="mb-2 text-sm text-[hsl(var(--fg-secondary))]">{t("common.total", "مبلغ کل")}</p>
            <p className="text-4xl font-bold tabular-nums text-[hsl(var(--color-primary))]">
              {total.toLocaleString()}
            </p>
            <p className="mt-1 text-sm text-[hsl(var(--fg-secondary))]">
              {paymentType === "cash"
                ? t("invoices.paid", "پرداخت کامل")
                : paidNow
                  ? `${t("payment.record", "پیش‌پرداخت")}: ${parseFloat(paidNow).toLocaleString()} AFN — ${t("invoices.remaining", "باقی‌مانده")}: ${(total - parseFloat(paidNow || "0")).toLocaleString()} AFN`
                  : t("invoices.credit", "نسیه کامل")}
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onBack}
            className={cn(
              "w-full rounded-full px-4 py-2.5 text-sm font-medium",
              "border border-[hsl(var(--border-default))]",
              "text-[hsl(var(--fg-secondary))]",
              "hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]",
              "transition-colors duration-150",
              "motion-reduce:transition-none"
            )}
          >
            {t("action.back", "برگشت")}
          </button>
          <button
            type="button"
            disabled={!hasItems || isPending}
            onClick={onNext}
            className={cn(
              "w-full inline-flex items-center justify-center gap-2 rounded-full px-6 py-3",
              "text-sm font-bold text-white",
              "bg-[hsl(var(--color-primary))]",
              "shadow-sm shadow-[hsl(var(--color-primary)/0.15)]",
              "transition-all duration-200 hover:brightness-110 active:scale-[0.98]",
              "disabled:opacity-40 disabled:cursor-not-allowed",
              "motion-reduce:transition-none"
            )}
          >
            <Eye className="size-4" aria-hidden="true" />
            {t("action.previewInvoice", "پیش‌نمایش فاکتور")}
          </button>
        </div>
      </div>
    </div>
  );
});
PriceStep.displayName = "PriceStep";

// ─── Step: Preview / Confirm ────────────────────────────────────────────────

const DEFAULT_PREVIEW_DISPLAY: InvoiceDocumentDisplaySettings = {
  showSignature: true,
  showNotes: true,
  showBarcode: true,
};

const PreviewStep = memo(function PreviewStep({
  t,
  items,
  selectedCustomer,
  paymentType,
  paidNow,
  total,
  isPending,
  onBack,
  onConfirm,
}: {
  t: (key: string, fallback?: string) => string;
  items: InvoiceLineItem[];
  selectedCustomer: CustomerOption | null;
  paymentType: PaymentType;
  paidNow: string;
  total: number;
  isPending: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const [display, setDisplay] = useState<InvoiceDocumentDisplaySettings>(DEFAULT_PREVIEW_DISPLAY);
  const paidAmount = paymentType === "cash" ? total : parseFloat(paidNow) || 0;

  // ✅ فرض تک-workspace: اولین workspace کاربر — برای نمایش لوگو/مهر کسب‌وکار روی پیش‌نمایش فاکتور
  const { data: workspaces } = useWorkspaces();
  const currentWorkspace = Array.isArray(workspaces)
    ? (workspaces[0] as { name?: string; logo_url?: string | null; stamp_url?: string | null } | undefined)
    : undefined;

  const documentData: InvoiceDocumentData = useMemo(
    () => ({
      // ⚠️ فاکتور هنوز ثبت نشده — شماره فاکتور و تاریخ ثبت وجود ندارند
      // و عمداً fabricate نمی‌شوند؛ کامپوننت سند به‌جای آن «—» نشان می‌دهد.
      invoiceNumber: undefined,
      date: new Date().toISOString(),
      business: {
        name: currentWorkspace?.name || t("app.name", "Hisabche"),
        logoUrl: currentWorkspace?.logo_url ?? null,
        stampUrl: currentWorkspace?.stamp_url ?? null,
      },
      customer: selectedCustomer
        ? { name: selectedCustomer.name, phone: selectedCustomer.phone }
        : null,
      items: items.map((item) => ({
        id: item.key,
        productName: item.product.name,
        quantity: parseInt(item.quantity) || 0,
        unit: item.product.unit,
        unitPrice: parseFloat(item.price) || 0,
        totalPrice: (parseFloat(item.price) || 0) * (parseInt(item.quantity) || 0),
      })),
      currency: "AFN",
      subtotal: total,
      total,
      paidAmount,
    }),
    [items, selectedCustomer, total, paidAmount, t, currentWorkspace]
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-4">
        <div className="text-center lg:text-start">
          <h1 className="text-xl font-bold text-[hsl(var(--fg-primary))]">
            {t("quickInvoice.previewTitle", "پیش‌نمایش فاکتور")}
          </h1>
          <p className="mt-1 text-sm text-[hsl(var(--fg-secondary))]">
            {t("quickInvoice.previewDesc", "قبل از ثبت نهایی، فاکتور را بررسی کنید")}
          </p>
        </div>
        <InvoiceDocument t={t} data={documentData} display={display} />
      </div>

      <div className="space-y-4">
        <InvoiceSidebar
          t={t}
          summary={{ total, paidAmount, currency: "AFN" }}
          display={display}
          onDisplayChange={(key, value) => setDisplay((prev) => ({ ...prev, [key]: value }))}
        />

        <div className="flex flex-col gap-3">
          <button
            type="button"
            disabled={isPending}
            onClick={onConfirm}
            className={cn(
              "w-full inline-flex items-center justify-center gap-2 rounded-full px-6 py-3",
              "text-sm font-bold text-white",
              "bg-[hsl(var(--color-primary))]",
              "shadow-sm shadow-[hsl(var(--color-primary)/0.15)]",
              "transition-all duration-200 hover:brightness-110 active:scale-[0.98]",
              "disabled:opacity-40 disabled:cursor-not-allowed",
              "motion-reduce:transition-none"
            )}
          >
            <Check className="size-4" aria-hidden="true" />
            {t("action.confirmCreate", "تأیید و ساخت فاکتور")}
          </button>
          <button
            type="button"
            onClick={onBack}
            disabled={isPending}
            className={cn(
              "w-full inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium",
              "border border-[hsl(var(--border-default))]",
              "text-[hsl(var(--fg-secondary))]",
              "hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]",
              "transition-colors duration-150",
              "motion-reduce:transition-none",
              "disabled:opacity-40 disabled:cursor-not-allowed"
            )}
          >
            <Pencil className="size-4" aria-hidden="true" />
            {t("action.backToEdit", "بازگشت و ویرایش")}
          </button>
        </div>
      </div>
    </div>
  );
});
PreviewStep.displayName = "PreviewStep";

// ─── Step: Done ────────────────────────────────────────────────────────────

const DoneStep = memo(function DoneStep({
  t,
  productName,
  paymentType,
  total,
  paidAmount,
  elapsedFormatted,
  createdInvoiceId,
  onViewInvoice,
  onViewAllInvoices,
}: {
  t: (key: string, fallback?: string) => string;
  productName: string;
  paymentType: PaymentType;
  total: number;
  paidAmount: number;
  elapsedFormatted: string;
  createdInvoiceId: string | null;
  onViewInvoice: () => void;
  onViewAllInvoices: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-elevated))]">
      <div className="p-8 space-y-8 text-center">
        <div>
          <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-[hsl(var(--color-success)/0.1)]">
            <Check className="size-12 text-[hsl(var(--color-success))]" aria-hidden="true" />
          </div>
          <h1 className="mb-3 text-3xl font-bold text-[hsl(var(--fg-primary))]">
            {t("invoices.created", "فاکتور ثبت شد")} 🎉
          </h1>
          <p className="text-[hsl(var(--fg-secondary))]">
            {t("dashboard.ready", "فاکتور شما در")}{" "}
            <strong>{elapsedFormatted}</strong>{" "}
            {t("dashboard.ready", "ثبت شد.")}
          </p>
        </div>

        <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] p-5 text-start">
          <Row label={t("invoices.items", "اجناس")} value={productName} />
          <Row
            label={t("common.status", "نوع")}
            value={paymentType === "cash" ? `💵 ${t("invoices.cash", "نقد")}` : `📝 ${t("invoices.credit", "نسیه")}`}
          />
          <Row
            label={t("common.total", "مبلغ کل")}
            value={`${total.toLocaleString()} AFN`}
            valueClass="font-bold tabular-nums text-[hsl(var(--color-primary))]"
          />
          {paymentType === "credit" && (
            <>
              <Row
                label={t("invoices.paid", "پرداخت شده")}
                value={`${paidAmount.toLocaleString()} AFN`}
                valueClass="font-bold tabular-nums text-[hsl(var(--color-success))]"
              />
              <Row
                label={t("invoices.remaining", "باقی‌مانده")}
                value={`${(total - paidAmount).toLocaleString()} AFN`}
                valueClass="font-bold tabular-nums text-[hsl(var(--color-destructive))]"
              />
            </>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {createdInvoiceId && (
            <button
              type="button"
              onClick={onViewInvoice}
              className={cn(
                "w-full inline-flex items-center justify-center gap-2 rounded-full px-6 py-3",
                "text-sm font-bold text-white",
                "bg-[hsl(var(--color-primary))]",
                "transition-all duration-200 hover:brightness-110 active:scale-[0.98]",
                "motion-reduce:transition-none"
              )}
            >
              <ArrowRight className="size-5" aria-hidden="true" />
              {t("action.view", "مشاهده فاکتور")}
            </button>
          )}
          <button
            type="button"
            onClick={onViewAllInvoices}
            className={cn(
              "w-full rounded-full px-4 py-2.5 text-sm font-medium",
              "border border-[hsl(var(--border-default))]",
              "text-[hsl(var(--fg-secondary))]",
              "hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]",
              "transition-colors duration-150",
              "motion-reduce:transition-none"
            )}
          >
            {t("action.back", "بازگشت به فاکتورها")}
          </button>
        </div>
      </div>
    </div>
  );
});
DoneStep.displayName = "DoneStep";

// ─── Celebration ───────────────────────────────────────────────────────────

const Celebration = memo(function Celebration({
  onDismiss,
  t,
}: {
  onDismiss: () => void;
  t: (key: string, fallback?: string) => string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-[hsl(var(--surface-base)/0.6)] backdrop-blur-md"
      onClick={onDismiss}
    >
      <div className="text-center">
        <div className="mb-4 animate-bounce text-6xl motion-reduce:animate-none">🧾</div>
        <div className="rounded-2xl px-8 py-6 border border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-elevated))] shadow-xl">
          <p className="text-xl font-bold text-[hsl(var(--fg-primary))]">
            🎉 {t("invoices.created", "فاکتور با موفقیت ثبت شد")}
          </p>
          <p className="mt-2 text-sm text-[hsl(var(--fg-secondary))]">
            {t("invoices.clickToView", "کلیک کنید تا فاکتور را ببینید")}
          </p>
        </div>
      </div>
    </div>
  );
});
Celebration.displayName = "Celebration";

// ─── Main Component ─────────────────────────────────────────────────────────

export const QuickInvoicePage = memo(function QuickInvoicePage({
  t,
  elapsedFormatted,
  showSaved,
  showCelebration,
  step,
  items,
  selectedCustomer,
  paymentType,
  paidNow,
  total,
  productName,
  paidAmount,
  createdInvoiceId,
  isPending,
  onAddItem,
  onRemoveItem,
  onUpdateItemQuantity,
  onUpdateItemPrice,
  onSelectCustomer,
  onPaymentTypeChange,
  onPaidNowChange,
  onSetStep,
  onConfirmCreate,
  onDismissCelebration,
  onViewInvoice,
  onViewAllInvoices,
}: QuickInvoicePageProps) {
  return (
    <div className="px-4 py-10">
      {/* Celebration Pop-up */}
      {showCelebration && <Celebration onDismiss={onDismissCelebration} t={t} />}

      <div className={cn("mx-auto", step === "preview" ? "max-w-5xl" : "max-w-xl")}>
        {/* Timer + Step Indicators */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 animate-pulse rounded-full bg-[hsl(var(--color-success))]" />
            <span className="text-sm text-[hsl(var(--fg-secondary))]">{elapsedFormatted}</span>
          </div>
          <div className="flex gap-2">
            {STEPS.map((s, i) => (
              <div
                key={s}
                className={cn(
                  "h-2 w-14 rounded-full transition-all duration-300",
                  STEPS.indexOf(step) >= i
                    ? "bg-[hsl(var(--color-primary))]"
                    : "bg-[hsl(var(--surface-muted))]"
                )}
              />
            ))}
          </div>
        </div>

        {/* Step 1: Items */}
        {step === "product" && (
          <ItemsStep
            items={items}
            onAddItem={onAddItem}
            onRemoveItem={onRemoveItem}
            onUpdateItemQuantity={onUpdateItemQuantity}
            onUpdateItemPrice={onUpdateItemPrice}
            onNext={() => onSetStep("customer")}
            t={t}
          />
        )}

        {/* Step 2: Customer */}
        {step === "customer" && (
          <CustomerStep
            selectedCustomer={selectedCustomer}
            onSelectCustomer={onSelectCustomer}
            onBack={() => onSetStep("product")}
            onNext={() => onSetStep("price")}
            t={t}
          />
        )}

        {/* Step 3: Price */}
        {step === "price" && (
          <PriceStep
            t={t}
            items={items}
            selectedCustomer={selectedCustomer}
            paymentType={paymentType}
            paidNow={paidNow}
            total={total}
            isPending={isPending}
            onPaymentTypeChange={onPaymentTypeChange}
            onPaidNowChange={onPaidNowChange}
            onBack={() => onSetStep("customer")}
            onNext={() => onSetStep("preview")}
          />
        )}

        {/* Step 4: Preview & confirm */}
        {step === "preview" && (
          <PreviewStep
            t={t}
            items={items}
            selectedCustomer={selectedCustomer}
            paymentType={paymentType}
            paidNow={paidNow}
            total={total}
            isPending={isPending}
            onBack={() => onSetStep("price")}
            onConfirm={onConfirmCreate}
          />
        )}

        {/* Step 5: Done */}
        {step === "done" && (
          <DoneStep
            t={t}
            productName={productName}
            paymentType={paymentType}
            total={total}
            paidAmount={paidAmount}
            elapsedFormatted={elapsedFormatted}
            createdInvoiceId={createdInvoiceId}
            onViewInvoice={onViewInvoice}
            onViewAllInvoices={onViewAllInvoices}
          />
        )}
      </div>
    </div>
  );
});

QuickInvoicePage.displayName = "QuickInvoicePage";