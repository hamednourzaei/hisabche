// packages/ui/src/components/ui/onboarding/containers/onboarding-container.tsx
"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useOnboardingStore, type BusinessType, type StoreSize, type Currency } from "@hisabche/store";
import { OnboardingPage } from "../onboarding-page";
import { useCallback, useMemo, memo } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   OnboardingContainer v3 — Memoized · Type-Safe · Persist Fix
   ✅ memo · useCallback · useMemo · safeT · type-safe
   ═══════════════════════════════════════════════════════════════════════════ */

const businessTypes: { id: BusinessType; labelFa: string }[] = [
  { id: "retail", labelFa: "خرده فروشی" },
  { id: "wholesale", labelFa: "عمده فروشی" },
  { id: "restaurant", labelFa: "رستوران" },
  { id: "service", labelFa: "خدماتی" },
  { id: "other", labelFa: "سایر" },
];

const storeSizes: { id: StoreSize; labelFa: string }[] = [
  { id: "small", labelFa: "دکان کوچک" },
  { id: "medium", labelFa: "فروشگاه متوسط" },
  { id: "large", labelFa: "تجارت بزرگ" },
];

export const OnboardingContainer = memo(function OnboardingContainer() {
  const { t: tOriginal } = useTranslation();
  const router = useRouter();

  // ✅ safeT wrapper
  const safeT = useCallback(
    (key: string, fallback?: string): string => {
      const result = tOriginal(key);
      return result && result !== key ? result : (fallback ?? key);
    },
    [tOriginal]
  );

  const {
    step,
    businessType,
    storeSize,
    defaultCurrency,
    setStep,
    setBusinessType,
    setStoreSize,
    setDefaultCurrency,
    completeOnboarding,
  } = useOnboardingStore();

  // ✅ useMemo برای labels
  const businessTypeLabel = useMemo(
    () => businessTypes.find((b) => b.id === businessType)?.labelFa || "",
    [businessType]
  );

  const storeSizeLabel = useMemo(
    () => storeSizes.find((s) => s.id === storeSize)?.labelFa || "",
    [storeSize]
  );

  const currencyLabel = useMemo(() => defaultCurrency, [defaultCurrency]);

  const handleComplete = useCallback(() => {
    completeOnboarding();
    router.push("/dashboard");
  }, [completeOnboarding, router]);

  // ✅ type-safe wrapper برای setterها
  const handleSetBusinessType = useCallback(
    (type: string) => {
      setBusinessType(type as BusinessType);
    },
    [setBusinessType]
  );

  const handleSetStoreSize = useCallback(
    (size: string) => {
      setStoreSize(size as StoreSize);
    },
    [setStoreSize]
  );

  const handleSetCurrency = useCallback(
    (currency: string) => {
      setDefaultCurrency(currency as Currency);
    },
    [setDefaultCurrency]
  );

  return (
    <OnboardingPage
      step={step}
      businessType={businessType}
      storeSize={storeSize}
      defaultCurrency={defaultCurrency}
      t={safeT}
      businessTypeLabel={businessTypeLabel}
      storeSizeLabel={storeSizeLabel}
      currencyLabel={currencyLabel}
      onSetStep={setStep}
      onSetBusinessType={handleSetBusinessType}
      onSetStoreSize={handleSetStoreSize}
      onSetCurrency={handleSetCurrency}
      onComplete={handleComplete}
    />
  );
});

OnboardingContainer.displayName = "OnboardingContainer";