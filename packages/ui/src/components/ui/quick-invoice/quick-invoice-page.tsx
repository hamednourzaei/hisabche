"use client";

import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Check,
  User,
  DollarSign,
  Package,
  ShoppingCart,
  CreditCard,
} from "lucide-react";
import { ProductPicker } from "../product-picker";
import { CustomerPicker } from "../customer-picker";

/* ═══════════════════════════════════════════════════════════════════════════
   QuickInvoicePage v3 — Hisabche Design Language
   ✅ Only Celebration Pop-up (no toast)
   ✅ Blurred backdrop on celebration
   ✅ Zero hardcoded colors — all tokens from design system
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

type Step = "product" | "customer" | "price" | "done";
type PaymentType = "cash" | "credit";

const STEPS: Step[] = ["product", "customer", "price", "done"] as const;
const QUANTITIES = ["1", "2", "3", "5", "10"] as const;

export interface QuickInvoicePageProps {
  t: (key: string, fallback?: string) => string;
  elapsedFormatted: string;
  showSaved: boolean;
  showCelebration: boolean;
  step: Step;
  selectedProduct: ProductOption | null;
  selectedCustomer: CustomerOption | null;
  price: string;
  quantity: string;
  paymentType: PaymentType;
  paidNow: string;
  total: number;
  productName: string;
  paidAmount: number;
  createdInvoiceId: string | null;
  isPending: boolean;
  inputRef: React.Ref<HTMLInputElement>;
  onSelectProduct: (p: ProductOption | null) => void;
  onSelectCustomer: (c: CustomerOption | null) => void;
  onPriceChange: (v: string) => void;
  onQuantityChange: (q: string) => void;
  onPaymentTypeChange: (t: PaymentType) => void;
  onPaidNowChange: (v: string) => void;
  onSetStep: (s: Step) => void;
  onCreate: () => void;
  onDismissCelebration: () => void;
  onViewInvoice: () => void;
  onViewAllInvoices: () => void;
}

export function QuickInvoicePage({
  t,
  elapsedFormatted,
  showSaved,
  showCelebration,
  step,
  selectedProduct,
  selectedCustomer,
  price,
  quantity,
  paymentType,
  paidNow,
  total,
  productName,
  paidAmount,
  createdInvoiceId,
  isPending,
  inputRef,
  onSelectProduct,
  onSelectCustomer,
  onPriceChange,
  onQuantityChange,
  onPaymentTypeChange,
  onPaidNowChange,
  onSetStep,
  onCreate,
  onDismissCelebration,
  onViewInvoice,
  onViewAllInvoices,
}: QuickInvoicePageProps) {
  return (
    <div className="px-4 py-10">
      {/* Celebration Pop-up — only */}
      {showCelebration && (
        <div
          className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-[hsl(var(--surface-base)/0.6)] backdrop-blur-md"
          onClick={onDismissCelebration}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="pointer-events-none text-center"
          >
            <div className="mb-4 animate-bounce text-6xl motion-reduce:animate-none">🧾</div>
            <div className="rounded-2xl px-8 py-6 border border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-elevated))] shadow-xl">
              <p className="text-xl font-bold text-[hsl(var(--fg-primary))]">
                🎉 {t("faktoor.created", "فاکتور با موفقیت ثبت شد")}
              </p>
              <p className="mt-2 text-sm text-[hsl(var(--fg-secondary))]">
                {t("faktoor.clickToView", "کلیک کنید تا فاکتور را ببینید")}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-xl">
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
                    : "bg-[hsl(var(--surface-muted))]",
                )}
              />
            ))}
          </div>
        </div>

        {/* Step 1: Product */}
        {step === "product" && (
          <div className="rounded-2xl border border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-elevated))]">
            <div className="p-6 space-y-6">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[hsl(var(--color-primary)/0.1)]">
                  <Package className="size-8 text-[hsl(var(--color-primary))]" aria-hidden="true" />
                </div>
                <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))]">
                  {t("quickInvoice.whatSold", "نام محصول")}
                </h1>
                <p className="mt-2 text-sm text-[hsl(var(--fg-secondary))]">
                  {t("quickInvoice.whatSoldDesc", "چه چیزی فروختید؟")}
                </p>
              </div>

              <ProductPicker
                value={selectedProduct}
                onChange={onSelectProduct}
                placeholder={t("godam.pickProduct", "انتخاب محصول از گدام...")}
              />

              <button
                type="button"
                disabled={!selectedProduct}
                onClick={() => onSetStep("customer")}
                className={cn(
                  "w-full inline-flex items-center justify-center gap-2 rounded-full px-6 py-3",
                  "text-sm font-bold text-white",
                  "bg-[hsl(var(--color-primary))]",
                  "shadow-sm shadow-[hsl(var(--color-primary)/0.15)]",
                  "transition-all duration-200 hover:brightness-110 active:scale-[0.98]",
                  "disabled:opacity-40 disabled:cursor-not-allowed",
                  "motion-reduce:transition-none",
                )}
              >
                <ArrowRight className="size-4" aria-hidden="true" />
                {t("action.next", "ادامه")}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Customer */}
        {step === "customer" && (
          <div className="rounded-2xl border border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-elevated))]">
            <div className="p-6 space-y-6">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[hsl(var(--surface-muted))]">
                  <User className="size-8 text-[hsl(var(--fg-secondary))]" aria-hidden="true" />
                </div>
                <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))]">
                  {t("faktoor.customer", "مشتری")}
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
                  onClick={() => onSetStep("product")}
                  className={cn(
                    "w-full rounded-full px-4 py-2.5 text-sm font-medium",
                    "border border-[hsl(var(--border-default))]",
                    "text-[hsl(var(--fg-secondary))]",
                    "hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]",
                    "transition-colors duration-150",
                    "motion-reduce:transition-none",
                  )}
                >
                  {t("action.back", "برگشت")}
                </button>
                <button
                  type="button"
                  onClick={() => onSetStep("price")}
                  className={cn(
                    "w-full rounded-full px-4 py-2.5 text-sm font-bold text-white",
                    "bg-[hsl(var(--color-primary))]",
                    "transition-all duration-200 hover:brightness-110 active:scale-[0.98]",
                    "motion-reduce:transition-none",
                  )}
                >
                  {t("action.next", "ادامه")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Price */}
        {step === "price" && (
          <div className="rounded-2xl border border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-elevated))]">
            <div className="p-6 space-y-6">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[hsl(var(--color-success)/0.1)]">
                  <DollarSign className="size-8 text-[hsl(var(--color-success))]" aria-hidden="true" />
                </div>
                <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))]">
                  {t("faktoor.total", "مبلغ فاکتور")}
                </h1>
                <p className="mt-2 text-sm text-[hsl(var(--fg-secondary))]">
                  {t("quickInvoice.howMuch", "مبلغ فروش را وارد کنید")}
                </p>
              </div>

              <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] p-4 text-start">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm text-[hsl(var(--fg-secondary))]">{t("faktoor.items", "محصول")}</span>
                  <span className="font-medium text-[hsl(var(--fg-primary))]">{productName}</span>
                </div>
                {selectedCustomer && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[hsl(var(--fg-secondary))]">{t("faktoor.customer", "مشتری")}</span>
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
                        : "border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))]",
                    )}
                  >
                    {type === "cash" ? "💵 " : "📝 "}
                    {type === "cash" ? t("faktoor.cash", "نقد") : t("faktoor.credit", "نسیه")}
                  </button>
                ))}
              </div>

              {paymentType === "credit" && (
                <div className="relative">
                  <CreditCard className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--fg-tertiary))] pointer-events-none" aria-hidden="true" />
                  <input
                    type="number"
                    value={paidNow}
                    onChange={(e) => onPaidNowChange(e.target.value)}
                    placeholder={`${t("payment.record", "پیش‌پرداخت")} (کل: ${total.toLocaleString()} AFN)`}
                    className={cn(
                      "w-full rounded-xl ps-9 pe-3 py-3 text-sm",
                      "border border-[hsl(var(--border-default))]",
                      "bg-[hsl(var(--surface-base))]",
                      "text-[hsl(var(--fg-primary))]",
                      "placeholder:text-[hsl(var(--fg-tertiary))]",
                      "focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)] focus:ring-1 focus:ring-[hsl(var(--color-primary)/0.3)]",
                    )}
                  />
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-medium text-[hsl(var(--fg-primary))]">
                  {t("faktoor.quantity", "تعداد")}
                </label>
                <div className="flex gap-2">
                  {QUANTITIES.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => onQuantityChange(q)}
                      className={cn(
                        "h-10 w-10 rounded-full text-sm font-bold transition-all duration-200 motion-reduce:transition-none",
                        quantity === q
                          ? "bg-[hsl(var(--color-primary))] text-white shadow-sm"
                          : "border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))]",
                      )}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[hsl(var(--fg-primary))]">
                  {t("faktoor.unitPrice", "قیمت")} (AFN)
                </label>
                <div className="relative">
                  <DollarSign className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--fg-tertiary))] pointer-events-none" aria-hidden="true" />
                  <input
                    ref={inputRef}
                    type="number"
                    value={price}
                    onChange={(e) => onPriceChange(e.target.value)}
                    placeholder={t("quickInvoice.pricePlaceholder", "مثلاً 500")}
                    className={cn(
                      "w-full rounded-xl ps-9 pe-3 py-3 text-sm",
                      "border border-[hsl(var(--border-default))]",
                      "bg-[hsl(var(--surface-base))]",
                      "text-[hsl(var(--fg-primary))]",
                      "placeholder:text-[hsl(var(--fg-tertiary))]",
                      "focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)] focus:ring-1 focus:ring-[hsl(var(--color-primary)/0.3)]",
                    )}
                  />
                </div>
              </div>

              {price && (
                <div className="rounded-2xl bg-[hsl(var(--color-primary)/0.05)] p-5 text-center border border-[hsl(var(--border-default))]">
                  <p className="mb-2 text-sm text-[hsl(var(--fg-secondary))]">{t("common.total", "مبلغ کل")}</p>
                  <p className="text-4xl font-bold tabular-nums text-[hsl(var(--color-primary))]">{total.toLocaleString()}</p>
                  <p className="mt-1 text-sm text-[hsl(var(--fg-secondary))]">
                    {paymentType === "cash"
                      ? t("faktoor.paid", "پرداخت کامل")
                      : paidNow
                        ? `${t("payment.record", "پیش‌پرداخت")}: ${parseFloat(paidNow).toLocaleString()} AFN — ${t("faktoor.remaining", "باقی‌مانده")}: ${(total - parseFloat(paidNow || "0")).toLocaleString()} AFN`
                        : t("faktoor.credit", "نسیه کامل")}
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => onSetStep("customer")}
                  className={cn(
                    "w-full rounded-full px-4 py-2.5 text-sm font-medium",
                    "border border-[hsl(var(--border-default))]",
                    "text-[hsl(var(--fg-secondary))]",
                    "hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]",
                    "transition-colors duration-150",
                    "motion-reduce:transition-none",
                  )}
                >
                  {t("action.back", "برگشت")}
                </button>
                <button
                  type="button"
                  disabled={!price || parseFloat(price) <= 0 || isPending}
                  onClick={onCreate}
                  className={cn(
                    "w-full inline-flex items-center justify-center gap-2 rounded-full px-6 py-3",
                    "text-sm font-bold text-white",
                    "bg-[hsl(var(--color-primary))]",
                    "shadow-sm shadow-[hsl(var(--color-primary)/0.15)]",
                    "transition-all duration-200 hover:brightness-110 active:scale-[0.98]",
                    "disabled:opacity-40 disabled:cursor-not-allowed",
                    "motion-reduce:transition-none",
                  )}
                >
                  <ShoppingCart className="size-4" aria-hidden="true" />
                  {t("action.submit", "ثبت فاکتور")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Done */}
        {step === "done" && (
          <div className="rounded-2xl border border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-elevated))]">
            <div className="p-8 space-y-8 text-center">
              <div>
                <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-[hsl(var(--color-success)/0.1)]">
                  <Check className="size-12 text-[hsl(var(--color-success))]" aria-hidden="true" />
                </div>
                <h1 className="mb-3 text-3xl font-bold text-[hsl(var(--fg-primary))]">
                  {t("faktoor.created", "فاکتور ثبت شد")} 🎉
                </h1>
                <p className="text-[hsl(var(--fg-secondary))]">
                  {t("dashboard.ready", "فاکتور شما در")}{" "}
                  <strong>{elapsedFormatted}</strong>{" "}
                  {t("dashboard.ready", "ثبت شد.")}
                </p>
              </div>

              <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] p-5 text-start">
                <Row label={t("faktoor.items", "محصول")} value={productName} />
                <Row label={t("faktoor.quantity", "تعداد")} value={quantity} />
                <Row label={t("common.status", "نوع")} value={paymentType === "cash" ? `💵 ${t("faktoor.cash", "نقد")}` : `📝 ${t("faktoor.credit", "نسیه")}`} />
                <Row label={t("common.total", "مبلغ کل")} value={`${total.toLocaleString()} AFN`} valueClass="font-bold tabular-nums text-[hsl(var(--color-primary))]" />
                {paymentType === "credit" && (
                  <>
                    <Row label={t("faktoor.paid", "پرداخت شده")} value={`${paidAmount.toLocaleString()} AFN`} valueClass="font-bold tabular-nums text-[hsl(var(--color-success))]" />
                    <Row label={t("faktoor.remaining", "باقی‌مانده")} value={`${(total - paidAmount).toLocaleString()} AFN`} valueClass="font-bold tabular-nums text-[hsl(var(--color-destructive))]" />
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
                      "motion-reduce:transition-none",
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
                    "motion-reduce:transition-none",
                  )}
                >
                  {t("action.back", "بازگشت به فاکتورها")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({
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
      <span className={cn("font-medium text-[hsl(var(--fg-primary))]", valueClass)}>{value}</span>
    </div>
  );
}