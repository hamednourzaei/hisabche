"use client"

import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { useOnboardingStore } from "@hisabche/store"
import { OnboardingPage } from "../onboarding-page"

const businessTypes = [
  { id: "retail", labelFa: "خرده فروشی" },
  { id: "wholesale", labelFa: "عمده فروشی" },
  { id: "restaurant", labelFa: "رستوران" },
  { id: "service", labelFa: "خدماتی" },
  { id: "other", labelFa: "سایر" },
]

const storeSizes = [
  { id: "small", labelFa: "دکان کوچک" },
  { id: "medium", labelFa: "فروشگاه متوسط" },
  { id: "large", labelFa: "تجارت بزرگ" },
]

export function OnboardingContainer() {
  const { i18n } = useTranslation()
  const router = useRouter()
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
  } = useOnboardingStore()

  const isLangFa = i18n.language === "fa-AF" || i18n.language === "fa-IR"

  return (
    <OnboardingPage
      step={step}
      businessType={businessType}
      storeSize={storeSize}
      defaultCurrency={defaultCurrency}
      isLangFa={isLangFa}
      businessTypeLabel={businessTypes.find((b) => b.id === businessType)?.labelFa || ""}
      storeSizeLabel={storeSizes.find((s) => s.id === storeSize)?.labelFa || ""}
      currencyLabel={defaultCurrency}
      onSetStep={setStep}
      onSetBusinessType={setBusinessType as any}
onSetStoreSize={setStoreSize as any}
onSetCurrency={setDefaultCurrency as any}
      onComplete={() => {
        completeOnboarding()
        router.push("/dashboard")
      }}
    />
  )
}