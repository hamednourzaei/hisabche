// packages/ui/src/components/ui/onboarding/onboarding-page.tsx
"use client";

import { cn } from "@/lib/utils";
import { Store, Building2, Utensils, Wrench, MoreHorizontal, ArrowRight, ArrowLeft, Check, Store as StoreIcon, Building2 as BuildingIcon, ShoppingBag } from "lucide-react";
import { memo, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   OnboardingPage v4 — Memoized · Performance Optimized
   ✅ memo · useCallback · Row جدا شده
   ═══════════════════════════════════════════════════════════════════════════ */

export interface OnboardingPageProps {
  step: number;
  businessType: string | null;
  storeSize: string | null;
  defaultCurrency: string;
  t: (key: string, fallback?: string) => string;
  businessTypeLabel: string;
  storeSizeLabel: string;
  currencyLabel: string;
  onSetStep: (step: number) => void;
  onSetBusinessType: (type: string) => void;
  onSetStoreSize: (size: string) => void;
  onSetCurrency: (currency: string) => void;
  onComplete: () => void;
}

const selectedClasses =
  "border-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary)/0.08)] shadow-[0_0_0_2px_hsl(var(--color-primary)/0.3)]";
const unselectedClasses =
  "border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] hover:border-[hsl(var(--color-primary)/0.4)]";

// ─── Row ────────────────────────────────────────────────────────────────────

const Row = memo(function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-[hsl(var(--fg-secondary))]">{label}</span>
      <span className="font-medium text-[hsl(var(--fg-primary))]">{value}</span>
    </div>
  );
});
Row.displayName = "Row";

// ─── Step 0: Welcome ──────────────────────────────────────────────────────

const WelcomeStep = memo(function WelcomeStep({
  onStart,
  t,
}: {
  onStart: () => void;
  t: (key: string, fallback?: string) => string;
}) {
  return (
    <div className="mx-auto max-w-xl text-center">
      <div className="mb-6 flex justify-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-[var(--gradient-brand)] shadow-lg shadow-[hsl(var(--color-primary)/0.2)]">
          <span className="text-4xl font-bold text-white">ح</span>
        </div>
      </div>
      <h2 className="mb-4 text-4xl font-bold text-[hsl(var(--fg-primary))]">
        {t("onboarding.welcome", "به حسابچه خوش آمدید")}
      </h2>
      <p className="mb-10 text-lg text-[hsl(var(--fg-secondary))]">
        {t("onboarding.welcomeDesc", "در چند مرحله کوتاه حسابچه را برای کسب و کار شما آماده می‌کنیم.")}
      </p>
      <button
        type="button"
        onClick={onStart}
        className={cn(
          "inline-flex items-center gap-2 rounded-full px-8 py-3.5",
          "text-base font-bold text-white",
          "bg-[var(--gradient-brand)]",
          "shadow-md shadow-[hsl(var(--color-primary)/0.15)]",
          "transition-all duration-200 hover:brightness-110 active:scale-[0.98]",
          "motion-reduce:transition-none"
        )}
      >
        <ArrowRight className="size-5" aria-hidden="true" />
        {t("onboarding.start", "شروع")}
      </button>
    </div>
  );
});
WelcomeStep.displayName = "WelcomeStep";

// ─── Step 1: Business Type ────────────────────────────────────────────────

const BusinessTypeStep = memo(function BusinessTypeStep({
  businessType,
  onSetBusinessType,
  onBack,
  onNext,
  t,
}: {
  businessType: string | null;
  onSetBusinessType: (type: string) => void;
  onBack: () => void;
  onNext: () => void;
  t: (key: string, fallback?: string) => string;
}) {
  const businessTypes = [
    { id: "retail", icon: Store, labelKey: "onboarding.retail" },
    { id: "wholesale", icon: Building2, labelKey: "onboarding.wholesale" },
    { id: "restaurant", icon: Utensils, labelKey: "onboarding.restaurant" },
    { id: "service", icon: Wrench, labelKey: "onboarding.service" },
    { id: "other", icon: MoreHorizontal, labelKey: "onboarding.other" },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h2 className="mb-8 text-center text-2xl font-bold text-[hsl(var(--fg-primary))]">
        {t("onboarding.businessType", "نوع کسب و کار")}
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
              businessType === item.id ? selectedClasses : unselectedClasses
            )}
          >
            <item.icon className="mb-4 size-10 text-[hsl(var(--color-primary))]" aria-hidden="true" />
            <h3 className="font-semibold text-[hsl(var(--fg-primary))]">{t(item.labelKey, item.id)}</h3>
          </button>
        ))}
      </div>
      <div className="mt-8 flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium",
            "text-[hsl(var(--fg-secondary))]",
            "hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]",
            "transition-colors duration-150",
            "motion-reduce:transition-none"
          )}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t("action.back", "برگشت")}
        </button>
        <button
          type="button"
          disabled={!businessType}
          onClick={onNext}
          className={cn(
            "inline-flex items-center justify-center rounded-full px-6 py-2.5",
            "text-sm font-bold text-white",
            "bg-[var(--gradient-brand)]",
            "transition-all duration-200 hover:brightness-110 active:scale-[0.98]",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            "motion-reduce:transition-none"
          )}
        >
          {t("action.next", "ادامه")}
        </button>
      </div>
    </div>
  );
});
BusinessTypeStep.displayName = "BusinessTypeStep";

// ─── Step 2: Store Size ───────────────────────────────────────────────────

const StoreSizeStep = memo(function StoreSizeStep({
  storeSize,
  onSetStoreSize,
  onBack,
  onNext,
  t,
}: {
  storeSize: string | null;
  onSetStoreSize: (size: string) => void;
  onBack: () => void;
  onNext: () => void;
  t: (key: string, fallback?: string) => string;
}) {
  const storeSizes = [
    { id: "small", icon: StoreIcon, labelKey: "onboarding.smallStore", descKey: "onboarding.smallStoreDesc" },
    { id: "medium", icon: BuildingIcon, labelKey: "onboarding.mediumStore", descKey: "onboarding.mediumStoreDesc" },
    { id: "large", icon: ShoppingBag, labelKey: "onboarding.largeStore", descKey: "onboarding.largeStoreDesc" },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h2 className="mb-8 text-center text-2xl font-bold text-[hsl(var(--fg-primary))]">
        {t("onboarding.storeSize", "اندازه کسب و کار")}
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
              storeSize === item.id ? selectedClasses : unselectedClasses
            )}
          >
            <item.icon className="size-10 text-[hsl(var(--color-primary))]" aria-hidden="true" />
            <div>
              <h3 className="font-semibold text-[hsl(var(--fg-primary))]">{t(item.labelKey, item.id)}</h3>
              <p className="text-sm text-[hsl(var(--fg-secondary))]">{t(item.descKey, "")}</p>
            </div>
            {storeSize === item.id && <Check className="ms-auto size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />}
          </button>
        ))}
      </div>
      <div className="mt-8 flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium",
            "text-[hsl(var(--fg-secondary))]",
            "hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]",
            "transition-colors duration-150",
            "motion-reduce:transition-none"
          )}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t("action.back", "برگشت")}
        </button>
        <button
          type="button"
          disabled={!storeSize}
          onClick={onNext}
          className={cn(
            "inline-flex items-center justify-center rounded-full px-6 py-2.5",
            "text-sm font-bold text-white",
            "bg-[var(--gradient-brand)]",
            "transition-all duration-200 hover:brightness-110 active:scale-[0.98]",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            "motion-reduce:transition-none"
          )}
        >
          {t("action.next", "ادامه")}
        </button>
      </div>
    </div>
  );
});
StoreSizeStep.displayName = "StoreSizeStep";

// ─── Step 3: Currency ─────────────────────────────────────────────────────

const CurrencyStep = memo(function CurrencyStep({
  defaultCurrency,
  onSetCurrency,
  onBack,
  onNext,
  t,
}: {
  defaultCurrency: string;
  onSetCurrency: (currency: string) => void;
  onBack: () => void;
  onNext: () => void;
  t: (key: string, fallback?: string) => string;
}) {
  const currencies = [
    { code: "AFN", labelKey: "currency.afn", flag: "🇦🇫" },
    { code: "USD", labelKey: "currency.usd", flag: "🇺🇸" },
    { code: "PKR", labelKey: "currency.pkr", flag: "🇵🇰" },
    { code: "IRR", labelKey: "currency.irr", flag: "🇮🇷" },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h2 className="mb-8 text-center text-2xl font-bold text-[hsl(var(--fg-primary))]">
        {t("onboarding.defaultCurrency", "ارز پیشفرض")}
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
              defaultCurrency === cur.code ? selectedClasses : unselectedClasses
            )}
          >
            <div className="mb-2 text-3xl">{cur.flag}</div>
            <div className="font-medium text-[hsl(var(--fg-primary))]">{t(cur.labelKey, cur.code)}</div>
          </button>
        ))}
      </div>
      <div className="mt-8 flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium",
            "text-[hsl(var(--fg-secondary))]",
            "hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]",
            "transition-colors duration-150",
            "motion-reduce:transition-none"
          )}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t("action.back", "برگشت")}
        </button>
        <button
          type="button"
          disabled={!defaultCurrency}
          onClick={onNext}
          className={cn(
            "inline-flex items-center justify-center rounded-full px-6 py-2.5",
            "text-sm font-bold text-white",
            "bg-[var(--gradient-brand)]",
            "transition-all duration-200 hover:brightness-110 active:scale-[0.98]",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            "motion-reduce:transition-none"
          )}
        >
          {t("action.next", "ادامه")}
        </button>
      </div>
    </div>
  );
});
CurrencyStep.displayName = "CurrencyStep";

// ─── Step 4: Complete ─────────────────────────────────────────────────────

const CompleteStep = memo(function CompleteStep({
  businessTypeLabel,
  storeSizeLabel,
  currencyLabel,
  onComplete,
  t,
}: {
  businessTypeLabel: string;
  storeSizeLabel: string;
  currencyLabel: string;
  onComplete: () => void;
  t: (key: string, fallback?: string) => string;
}) {
  return (
    <div className="mx-auto max-w-xl text-center">
      <div className="mb-6 flex justify-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[hsl(var(--color-success)/0.1)]">
          <Check className="size-12 text-[hsl(var(--color-success))]" aria-hidden="true" />
        </div>
      </div>
      <h2 className="mb-4 text-3xl font-bold text-[hsl(var(--fg-primary))]">
        {t("onboarding.ready", "همه چیز آماده است")}
      </h2>
      <p className="mb-8 text-[hsl(var(--fg-secondary))]">
        {t("onboarding.readyDesc", "حسابچه با موفقیت پیکربندی شد.")}
      </p>
      <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] mb-8">
        <div className="p-6 space-y-4 text-start">
          <Row label={t("onboarding.businessType", "نوع کسب و کار")} value={businessTypeLabel} />
          <Row label={t("onboarding.size", "اندازه")} value={storeSizeLabel} />
          <Row label={t("onboarding.currency", "ارز")} value={currencyLabel} />
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
          "motion-reduce:transition-none"
        )}
      >
        <ArrowRight className="size-5" aria-hidden="true" />
        {t("onboarding.enter", "ورود به حسابچه")}
      </button>
    </div>
  );
});
CompleteStep.displayName = "CompleteStep";

// ─── Main Component ─────────────────────────────────────────────────────────

export const OnboardingPage = memo(function OnboardingPage({
  step,
  businessType,
  storeSize,
  defaultCurrency,
  t,
  businessTypeLabel,
  storeSizeLabel,
  currencyLabel,
  onSetStep,
  onSetBusinessType,
  onSetStoreSize,
  onSetCurrency,
  onComplete,
}: OnboardingPageProps) {
  const handleStart = useCallback(() => onSetStep(1), [onSetStep]);
  const handleBack1 = useCallback(() => onSetStep(0), [onSetStep]);
  const handleNext1 = useCallback(() => onSetStep(2), [onSetStep]);
  const handleBack2 = useCallback(() => onSetStep(1), [onSetStep]);
  const handleNext2 = useCallback(() => onSetStep(3), [onSetStep]);
  const handleBack3 = useCallback(() => onSetStep(2), [onSetStep]);
  const handleNext3 = useCallback(() => onSetStep(4), [onSetStep]);

  return (
    <div className="min-h-screen bg-[hsl(var(--surface-base))]">
      <div className="mx-auto flex max-w-5xl flex-col px-4 py-8">
        <div className="mb-10 flex items-center justify-center gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={cn(
                "h-2 w-20 rounded-full transition-all duration-300",
                s <= step ? "bg-[hsl(var(--color-primary))]" : "bg-[hsl(var(--surface-muted))]"
              )}
            />
          ))}
        </div>

        {step === 0 && <WelcomeStep onStart={handleStart} t={t} />}
        {step === 1 && (
          <BusinessTypeStep
            businessType={businessType}
            onSetBusinessType={onSetBusinessType}
            onBack={handleBack1}
            onNext={handleNext1}
            t={t}
          />
        )}
        {step === 2 && (
          <StoreSizeStep
            storeSize={storeSize}
            onSetStoreSize={onSetStoreSize}
            onBack={handleBack2}
            onNext={handleNext2}
            t={t}
          />
        )}
        {step === 3 && (
          <CurrencyStep
            defaultCurrency={defaultCurrency}
            onSetCurrency={onSetCurrency}
            onBack={handleBack3}
            onNext={handleNext3}
            t={t}
          />
        )}
        {step === 4 && (
          <CompleteStep
            businessTypeLabel={businessTypeLabel}
            storeSizeLabel={storeSizeLabel}
            currencyLabel={currencyLabel}
            onComplete={onComplete}
            t={t}
          />
        )}
      </div>
    </div>
  );
});

OnboardingPage.displayName = "OnboardingPage";