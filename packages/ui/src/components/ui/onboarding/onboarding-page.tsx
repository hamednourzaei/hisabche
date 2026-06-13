"use client";

import { cn } from "@/lib/utils";
import {
  Store,
  Building2,
  Utensils,
  Wrench,
  MoreHorizontal,
  ArrowRight,
  ArrowLeft,
  Check,
  Store as StoreIcon,
  Building2 as BuildingIcon,
  ShoppingBag,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   OnboardingPage v2 — Hisabche Design Language
   Zero hardcoded colors — all tokens from design system
   No external component dependencies
   ═══════════════════════════════════════════════════════════════════════════ */

export interface OnboardingPageProps {
  step: number;
  businessType: string | null;
  storeSize: string | null;
  defaultCurrency: string;
  isLangFa: boolean;
  businessTypeLabel: string;
  storeSizeLabel: string;
  currencyLabel: string;
  onSetStep: (step: number) => void;
  onSetBusinessType: (type: string) => void;
  onSetStoreSize: (size: string) => void;
  onSetCurrency: (currency: string) => void;
  onComplete: () => void;
}

const businessTypes = [
  { id: "retail", icon: Store, labelFa: "خرده فروشی", labelEn: "Retail" },
  { id: "wholesale", icon: Building2, labelFa: "عمده فروشی", labelEn: "Wholesale" },
  { id: "restaurant", icon: Utensils, labelFa: "رستوران", labelEn: "Restaurant" },
  { id: "service", icon: Wrench, labelFa: "خدماتی", labelEn: "Service" },
  { id: "other", icon: MoreHorizontal, labelFa: "سایر", labelEn: "Other" },
];

const storeSizes = [
  { id: "small", icon: StoreIcon, labelFa: "دکان کوچک", descFa: "۱ تا ۲ کارمند" },
  { id: "medium", icon: BuildingIcon, labelFa: "فروشگاه متوسط", descFa: "۳ تا ۱۰ کارمند" },
  { id: "large", icon: ShoppingBag, labelFa: "تجارت بزرگ", descFa: "۱۰+ کارمند" },
];

const currencies = [
  { code: "AFN", label: "افغانی (AFN)", flag: "🇦🇫" },
  { code: "USD", label: "دالر (USD)", flag: "🇺🇸" },
  { code: "PKR", label: "کلدار (PKR)", flag: "🇵🇰" },
  { code: "IRR", label: "تومان (IRR)", flag: "🇮🇷" },
];

// Shared selected/unselected styles
const selectedClasses =
  "border-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary)/0.08)] shadow-[0_0_0_2px_hsl(var(--color-primary)/0.3)]";
const unselectedClasses =
  "border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] hover:border-[hsl(var(--color-primary)/0.4)]";

export function OnboardingPage({
  step,
  businessType,
  storeSize,
  defaultCurrency,
  isLangFa,
  businessTypeLabel,
  storeSizeLabel,
  currencyLabel,
  onSetStep,
  onSetBusinessType,
  onSetStoreSize,
  onSetCurrency,
  onComplete,
}: OnboardingPageProps) {
  return (
    <div className="min-h-screen bg-[hsl(var(--surface-base))]">
      <div className="mx-auto flex max-w-5xl flex-col px-4 py-8">
        {/* Step indicators */}
        <div className="mb-10 flex items-center justify-center gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={cn(
                "h-2 w-20 rounded-full transition-all duration-300",
                s <= step
                  ? "bg-[hsl(var(--color-primary))]"
                  : "bg-[hsl(var(--surface-muted))]",
              )}
            />
          ))}
        </div>

        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className="mx-auto max-w-xl text-center">
            <div className="mb-6 flex justify-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-[var(--gradient-brand)] shadow-lg shadow-[hsl(var(--color-primary)/0.2)]">
                <span className="text-4xl font-bold text-white">ح</span>
              </div>
            </div>
            <h2 className="mb-4 text-4xl font-bold text-[hsl(var(--fg-primary))]">
              {isLangFa ? "به حسابچه خوش آمدید" : "Welcome to Hisabche"}
            </h2>
            <p className="mb-10 text-lg text-[hsl(var(--fg-secondary))]">
              {isLangFa
                ? "در چند مرحله کوتاه حسابچه را برای کسب و کار شما آماده می‌کنیم."
                : "Let's configure your workspace in a few simple steps."}
            </p>
            <button
              type="button"
              onClick={() => onSetStep(1)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-8 py-3.5",
                "text-base font-bold text-white",
                "bg-[var(--gradient-brand)]",
                "shadow-md shadow-[hsl(var(--color-primary)/0.15)]",
                "transition-all duration-200 hover:brightness-110 active:scale-[0.98]",
                "motion-reduce:transition-none",
              )}
            >
              <ArrowRight className="size-5" aria-hidden="true" />
              {isLangFa ? "شروع" : "Get Started"}
            </button>
          </div>
        )}

        {/* Step 1: Business Type */}
        {step === 1 && (
          <div className="mx-auto w-full max-w-3xl">
            <h2 className="mb-8 text-center text-2xl font-bold text-[hsl(var(--fg-primary))]">
              {isLangFa ? "نوع کسب و کار" : "Business Type"}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {businessTypes.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSetBusinessType(item.id)}
                  className={cn(
                    "rounded-2xl border-2 p-6 transition-all duration-200",
                    "motion-reduce:transition-none",
                    businessType === item.id ? selectedClasses : unselectedClasses,
                  )}
                >
                  <item.icon
                    className="mb-4 size-10 text-[hsl(var(--color-primary))]"
                    aria-hidden="true"
                  />
                  <h3 className="font-semibold text-[hsl(var(--fg-primary))]">
                    {isLangFa ? item.labelFa : item.labelEn}
                  </h3>
                </button>
              ))}
            </div>
            <div className="mt-8 flex justify-between">
              <button
                type="button"
                onClick={() => onSetStep(0)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium",
                  "text-[hsl(var(--fg-secondary))]",
                  "hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]",
                  "transition-colors duration-150",
                  "motion-reduce:transition-none",
                )}
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                برگشت
              </button>
              <button
                type="button"
                disabled={!businessType}
                onClick={() => onSetStep(2)}
                className={cn(
                  "inline-flex items-center justify-center rounded-full px-6 py-2.5",
                  "text-sm font-bold text-white",
                  "bg-[var(--gradient-brand)]",
                  "transition-all duration-200 hover:brightness-110 active:scale-[0.98]",
                  "disabled:opacity-40 disabled:cursor-not-allowed",
                  "motion-reduce:transition-none",
                )}
              >
                ادامه
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Store Size */}
        {step === 2 && (
          <div className="mx-auto w-full max-w-3xl">
            <h2 className="mb-8 text-center text-2xl font-bold text-[hsl(var(--fg-primary))]">
              اندازه کسب و کار
            </h2>
            <div className="space-y-4">
              {storeSizes.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSetStoreSize(item.id)}
                  className={cn(
                    "flex w-full items-center gap-4 rounded-2xl border-2 p-5 transition-all duration-200 text-start",
                    "motion-reduce:transition-none",
                    storeSize === item.id ? selectedClasses : unselectedClasses,
                  )}
                >
                  <item.icon
                    className="size-10 text-[hsl(var(--color-primary))]"
                    aria-hidden="true"
                  />
                  <div>
                    <h3 className="font-semibold text-[hsl(var(--fg-primary))]">
                      {item.labelFa}
                    </h3>
                    <p className="text-sm text-[hsl(var(--fg-secondary))]">{item.descFa}</p>
                  </div>
                  {storeSize === item.id && (
                    <Check
                      className="ms-auto size-5 text-[hsl(var(--color-primary))]"
                      aria-hidden="true"
                    />
                  )}
                </button>
              ))}
            </div>
            <div className="mt-8 flex justify-between">
              <button
                type="button"
                onClick={() => onSetStep(1)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium",
                  "text-[hsl(var(--fg-secondary))]",
                  "hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]",
                  "transition-colors duration-150",
                  "motion-reduce:transition-none",
                )}
              >
                برگشت
              </button>
              <button
                type="button"
                disabled={!storeSize}
                onClick={() => onSetStep(3)}
                className={cn(
                  "inline-flex items-center justify-center rounded-full px-6 py-2.5",
                  "text-sm font-bold text-white",
                  "bg-[var(--gradient-brand)]",
                  "transition-all duration-200 hover:brightness-110 active:scale-[0.98]",
                  "disabled:opacity-40 disabled:cursor-not-allowed",
                  "motion-reduce:transition-none",
                )}
              >
                ادامه
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Currency */}
        {step === 3 && (
          <div className="mx-auto w-full max-w-3xl">
            <h2 className="mb-8 text-center text-2xl font-bold text-[hsl(var(--fg-primary))]">
              ارز پیشفرض
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {currencies.map((cur) => (
                <button
                  key={cur.code}
                  type="button"
                  onClick={() => onSetCurrency(cur.code)}
                  className={cn(
                    "rounded-2xl border-2 p-5 transition-all duration-200",
                    "motion-reduce:transition-none",
                    defaultCurrency === cur.code ? selectedClasses : unselectedClasses,
                  )}
                >
                  <div className="mb-2 text-3xl">{cur.flag}</div>
                  <div className="font-medium text-[hsl(var(--fg-primary))]">{cur.label}</div>
                </button>
              ))}
            </div>
            <div className="mt-8 flex justify-between">
              <button
                type="button"
                onClick={() => onSetStep(2)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium",
                  "text-[hsl(var(--fg-secondary))]",
                  "hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]",
                  "transition-colors duration-150",
                  "motion-reduce:transition-none",
                )}
              >
                برگشت
              </button>
              <button
                type="button"
                disabled={!defaultCurrency}
                onClick={() => onSetStep(4)}
                className={cn(
                  "inline-flex items-center justify-center rounded-full px-6 py-2.5",
                  "text-sm font-bold text-white",
                  "bg-[var(--gradient-brand)]",
                  "transition-all duration-200 hover:brightness-110 active:scale-[0.98]",
                  "disabled:opacity-40 disabled:cursor-not-allowed",
                  "motion-reduce:transition-none",
                )}
              >
                ادامه
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Summary */}
        {step === 4 && (
          <div className="mx-auto max-w-xl text-center">
            <div className="mb-6 flex justify-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[hsl(var(--color-success)/0.1)]">
                <Check className="size-12 text-[hsl(var(--color-success))]" aria-hidden="true" />
              </div>
            </div>
            <h2 className="mb-4 text-3xl font-bold text-[hsl(var(--fg-primary))]">
              همه چیز آماده است
            </h2>
            <p className="mb-8 text-[hsl(var(--fg-secondary))]">
              حسابچه با موفقیت پیکربندی شد.
            </p>

            {/* Summary card */}
            <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] mb-8">
              <div className="p-6 space-y-4 text-start">
                <Row label="نوع کسب و کار" value={businessTypeLabel} />
                <Row label="اندازه" value={storeSizeLabel} />
                <Row label="ارز" value={currencyLabel} />
              </div>
            </div>

            <button
              type="button"
              onClick={onComplete}
              className={cn(
                "w-full inline-flex items-center justify-center gap-2 rounded-full px-8 py-3.5",
                "text-base font-bold text-white",
                "bg-[var(--gradient-brand)]",
                "shadow-md shadow-[hsl(var(--color-primary)/0.15)]",
                "transition-all duration-200 hover:brightness-110 active:scale-[0.98]",
                "motion-reduce:transition-none",
              )}
            >
              <ArrowRight className="size-5" aria-hidden="true" />
              ورود به حسابچه
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helper ────────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-[hsl(var(--fg-secondary))]">{label}</span>
      <span className="font-medium text-[hsl(var(--fg-primary))]">{value}</span>
    </div>
  );
}