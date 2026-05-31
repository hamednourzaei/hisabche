"use client"

import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { Button, Card, CardContent } from "@hisabche/ui"
import { useOnboardingStore, useThemeStore } from "@hisabche/store"
import { changeLanguage, SupportedLanguage } from "@hisabche/i18n"
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
  Languages,
  Sun,
  Moon,
} from "lucide-react"
import type { BusinessType, StoreSize } from "@hisabche/store"

const businessTypes: {
  id: BusinessType
  icon: React.ElementType
  labelFa: string
  labelEn: string
}[] = [
  { id: "retail", icon: Store, labelFa: "خرده فروشی", labelEn: "Retail" },
  { id: "wholesale", icon: Building2, labelFa: "عمده فروشی", labelEn: "Wholesale" },
  { id: "restaurant", icon: Utensils, labelFa: "رستوران", labelEn: "Restaurant" },
  { id: "service", icon: Wrench, labelFa: "خدماتی", labelEn: "Service" },
  { id: "other", icon: MoreHorizontal, labelFa: "سایر", labelEn: "Other" },
]

const storeSizes: {
  id: StoreSize
  icon: React.ElementType
  labelFa: string
  labelEn: string
  descFa: string
}[] = [
  { id: "small", icon: StoreIcon, labelFa: "دکان کوچک", labelEn: "Small Shop", descFa: "۱ تا ۲ کارمند" },
  { id: "medium", icon: BuildingIcon, labelFa: "فروشگاه متوسط", labelEn: "Medium Store", descFa: "۳ تا ۱۰ کارمند" },
  { id: "large", icon: ShoppingBag, labelFa: "تجارت بزرگ", labelEn: "Large Business", descFa: "۱۰+ کارمند" },
]

const currencies = [
  { code: "AFN", label: "افغانی (AFN)", flag: "🇦🇫" },
  { code: "USD", label: "دالر (USD)", flag: "🇺🇸" },
  { code: "PKR", label: "کلدار (PKR)", flag: "🇵🇰" },
  { code: "IRR", label: "تومان (IRR)", flag: "🇮🇷" },
]

export default function OnboardingPage() {
  const { i18n } = useTranslation()
  const router = useRouter()
  const { isDark, toggle } = useThemeStore()
  const {
    step,
    businessType,
    storeSize,
    defaultCurrency,
    setStep,
    setBusinessType,
    setStoreSize,
    setDefaultCurrency,
    setLanguage,
    completeOnboarding,
  } = useOnboardingStore()

  const isLangFa = i18n.language === "fa-AF" || i18n.language === "fa-IR"

  const handleComplete = () => {
    completeOnboarding()
    router.push("/")
  }

  const toggleLang = () => {
    const nextLang = i18n.language === "fa-AF" ? "fa-IR" : "fa-AF"
    setLanguage(nextLang as Parameters<typeof setLanguage>[0])
    changeLanguage(nextLang as SupportedLanguage)
  }

  return (
    <div className="min-h-screen bg-[var(--hisab-background)]">
      {/* Header */}
      <div className="border-b border-[var(--hisab-border)] bg-[var(--hisab-card)]">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--hisab-primary)]">
              <span className="text-lg font-bold text-white">ح</span>
            </div>
            <div>
              <h1 className="font-bold text-[var(--hisab-foreground)]">حسابچه</h1>
              <p className="text-xs text-[var(--hisab-muted-fg)]">Setup</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon-sm" onClick={toggleLang} aria-label="تغییر زبان">
              <Languages className="size-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={toggle} aria-label={isDark ? "حالت روشن" : "حالت تاریک"}>
              {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto flex max-w-5xl flex-col px-4 py-8">
        {/* Progress */}
        <div className="mb-10 flex items-center justify-center gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className={`h-2 w-20 rounded-full transition-all ${s <= step ? "bg-[var(--hisab-primary)]" : "bg-[var(--hisab-muted)]"}`} />
          ))}
        </div>

        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className="mx-auto max-w-xl text-center">
            <div className="mb-6 flex justify-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-[var(--hisab-primary)] shadow-lg">
                <span className="text-4xl font-bold text-white">ح</span>
              </div>
            </div>
            <h2 className="mb-4 text-4xl font-bold text-[var(--hisab-foreground)]">
              {isLangFa ? "به حسابچه خوش آمدید" : "Welcome to Hisabche"}
            </h2>
            <p className="mb-10 text-lg text-[var(--hisab-muted-fg)]">
              {isLangFa ? "در چند مرحله کوتاه حسابچه را برای کسب و کار شما آماده می‌کنیم." : "Let's configure your workspace in a few simple steps."}
            </p>
            <Button size="lg" onClick={() => setStep(1)} icon={<ArrowRight className="size-5" />}>
              {isLangFa ? "شروع" : "Get Started"}
            </Button>
          </div>
        )}

        {/* Step 1: Business Type */}
        {step === 1 && (
          <div className="mx-auto w-full max-w-3xl">
            <h2 className="mb-8 text-center text-2xl font-bold text-[var(--hisab-foreground)]">
              {isLangFa ? "نوع کسب و کار" : "Business Type"}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {businessTypes.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setBusinessType(item.id)}
                  className={`rounded-2xl border-2 p-6 transition-all hover:border-[var(--hisab-primary)] ${
                    businessType === item.id ? "border-[var(--hisab-primary)] bg-[var(--hisab-primary)]/10" : "border-[var(--hisab-border)] bg-[var(--hisab-card)]"
                  }`}
                >
                  <item.icon className="mb-4 size-10 text-[var(--hisab-primary)]" aria-hidden />
                  <h3 className="font-semibold text-[var(--hisab-foreground)]">{isLangFa ? item.labelFa : item.labelEn}</h3>
                </button>
              ))}
            </div>
            <div className="mt-8 flex justify-between">
              <Button variant="ghost" onClick={() => setStep(0)} icon={<ArrowLeft className="size-4" />}>برگشت</Button>
              <Button onClick={() => setStep(2)} disabled={!businessType}>ادامه</Button>
            </div>
          </div>
        )}

        {/* Step 2: Store Size */}
        {step === 2 && (
          <div className="mx-auto w-full max-w-3xl">
            <h2 className="mb-8 text-center text-2xl font-bold text-[var(--hisab-foreground)]">اندازه کسب و کار</h2>
            <div className="space-y-4">
              {storeSizes.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setStoreSize(item.id)}
                  className={`flex w-full items-center gap-4 rounded-2xl border-2 p-5 transition-all text-start ${
                    storeSize === item.id ? "border-[var(--hisab-primary)] bg-[var(--hisab-primary)]/10" : "border-[var(--hisab-border)] bg-[var(--hisab-card)]"
                  }`}
                >
                  <item.icon className="size-10 text-[var(--hisab-primary)]" aria-hidden />
                  <div>
                    <h3 className="font-semibold text-[var(--hisab-foreground)]">{item.labelFa}</h3>
                    <p className="text-sm text-[var(--hisab-muted-fg)]">{item.descFa}</p>
                  </div>
                  {storeSize === item.id && <Check className="ms-auto size-5 text-[var(--hisab-primary)]" aria-hidden />}
                </button>
              ))}
            </div>
            <div className="mt-8 flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>برگشت</Button>
              <Button onClick={() => setStep(3)} disabled={!storeSize}>ادامه</Button>
            </div>
          </div>
        )}

        {/* Step 3: Currency */}
        {step === 3 && (
          <div className="mx-auto w-full max-w-3xl">
            <h2 className="mb-8 text-center text-2xl font-bold text-[var(--hisab-foreground)]">ارز پیشفرض</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {currencies.map((cur) => (
                <button
                  key={cur.code}
                  onClick={() => setDefaultCurrency(cur.code as "AFN" | "USD" | "PKR" | "IRR")}
                  className={`rounded-2xl border-2 p-5 transition-all ${
                    defaultCurrency === cur.code ? "border-[var(--hisab-primary)] bg-[var(--hisab-primary)]/10" : "border-[var(--hisab-border)] bg-[var(--hisab-card)]"
                  }`}
                >
                  <div className="mb-2 text-3xl">{cur.flag}</div>
                  <div className="font-medium text-[var(--hisab-foreground)]">{cur.label}</div>
                </button>
              ))}
            </div>
            <div className="mt-8 flex justify-between">
              <Button variant="ghost" onClick={() => setStep(2)}>برگشت</Button>
              <Button onClick={() => setStep(4)}>ادامه</Button>
            </div>
          </div>
        )}

        {/* Step 4: Done */}
        {step === 4 && (
          <div className="mx-auto max-w-xl text-center">
            <div className="mb-6 flex justify-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[var(--hisab-success)]/10">
                <Check className="size-12 text-[var(--hisab-success)]" aria-hidden />
              </div>
            </div>
            <h2 className="mb-4 text-3xl font-bold text-[var(--hisab-foreground)]">همه چیز آماده است</h2>
            <p className="mb-8 text-[var(--hisab-muted-fg)]">حسابچه با موفقیت پیکربندی شد.</p>
            <Card>
              <CardContent className="space-y-4 p-6 text-start">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--hisab-muted-fg)]">نوع کسب و کار</span>
                  <span className="font-medium text-[var(--hisab-foreground)]">{businessTypes.find((b) => b.id === businessType)?.labelFa}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--hisab-muted-fg)]">اندازه</span>
                  <span className="font-medium text-[var(--hisab-foreground)]">{storeSizes.find((s) => s.id === storeSize)?.labelFa}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--hisab-muted-fg)]">ارز</span>
                  <span className="font-medium text-[var(--hisab-foreground)]">{defaultCurrency}</span>
                </div>
              </CardContent>
            </Card>
            <div className="mt-8">
              <Button size="lg" fullWidth onClick={handleComplete} icon={<ArrowRight className="size-5" />}>
                ورود به حسابچه
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}