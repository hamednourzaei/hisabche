"use client"

import { Button, Card, CardContent } from "@hisabche/ui"
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
} from "lucide-react"

export interface OnboardingPageProps {
  step: number
  businessType: string | null
  storeSize: string | null
  defaultCurrency: string
  isLangFa: boolean
  businessTypeLabel: string
  storeSizeLabel: string
  currencyLabel: string
  onSetStep: (step: number) => void
  onSetBusinessType: (type: string) => void
  onSetStoreSize: (size: string) => void
  onSetCurrency: (currency: string) => void
  onComplete: () => void
}

const businessTypes = [
  { id: "retail", icon: Store, labelFa: "خرده فروشی", labelEn: "Retail" },
  { id: "wholesale", icon: Building2, labelFa: "عمده فروشی", labelEn: "Wholesale" },
  { id: "restaurant", icon: Utensils, labelFa: "رستوران", labelEn: "Restaurant" },
  { id: "service", icon: Wrench, labelFa: "خدماتی", labelEn: "Service" },
  { id: "other", icon: MoreHorizontal, labelFa: "سایر", labelEn: "Other" },
]

const storeSizes = [
  { id: "small", icon: StoreIcon, labelFa: "دکان کوچک", descFa: "۱ تا ۲ کارمند" },
  { id: "medium", icon: BuildingIcon, labelFa: "فروشگاه متوسط", descFa: "۳ تا ۱۰ کارمند" },
  { id: "large", icon: ShoppingBag, labelFa: "تجارت بزرگ", descFa: "۱۰+ کارمند" },
]

const currencies = [
  { code: "AFN", label: "افغانی (AFN)", flag: "🇦🇫" },
  { code: "USD", label: "دالر (USD)", flag: "🇺🇸" },
  { code: "PKR", label: "کلدار (PKR)", flag: "🇵🇰" },
  { code: "IRR", label: "تومان (IRR)", flag: "🇮🇷" },
]

const SELECTED = "border-[var(--hisab-primary)] bg-[var(--hisab-primary)]/10 shadow-[0_0_0_2px_var(--hisab-primary)]"
const UNSELECTED = "border-[var(--hisab-border)] bg-[var(--hisab-card)] hover:border-[var(--hisab-primary)]/50"

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
    <div className="min-h-screen bg-[var(--hisab-background)]">
      <div className="mx-auto flex max-w-5xl flex-col px-4 py-8">

        <div className="mb-10 flex items-center justify-center gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className={`h-2 w-20 rounded-full transition-all ${s <= step ? "bg-[var(--hisab-primary)]" : "bg-[var(--hisab-muted)]"}`} />
          ))}
        </div>

        {step === 0 && (
          <div className="mx-auto max-w-xl text-center">
            <div className="mb-6 flex justify-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-[var(--hisab-primary)] shadow-lg">
                <span className="text-4xl font-bold text-[var(--hisab-primary-fg)]">ح</span>
              </div>
            </div>
            <h2 className="mb-4 text-4xl font-bold text-[var(--hisab-foreground)]">
              {isLangFa ? "به حسابچه خوش آمدید" : "Welcome to Hisabche"}
            </h2>
            <p className="mb-10 text-lg text-[var(--hisab-muted-fg)]">
              {isLangFa ? "در چند مرحله کوتاه حسابچه را برای کسب و کار شما آماده می‌کنیم." : "Let's configure your workspace in a few simple steps."}
            </p>
            <Button size="lg" onClick={() => onSetStep(1)} icon={<ArrowRight className="size-5" />}>
              {isLangFa ? "شروع" : "Get Started"}
            </Button>
          </div>
        )}

        {step === 1 && (
          <div className="mx-auto w-full max-w-3xl">
            <h2 className="mb-8 text-center text-2xl font-bold text-[var(--hisab-foreground)]">
              {isLangFa ? "نوع کسب و کار" : "Business Type"}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {businessTypes.map((item) => (
                <button key={item.id} onClick={() => onSetBusinessType(item.id)}
                  className={`rounded-2xl border-2 p-6 transition-all ${businessType === item.id ? SELECTED : UNSELECTED}`}>
                  <item.icon className="mb-4 size-10 text-[var(--hisab-primary)]" aria-hidden />
                  <h3 className="font-semibold text-[var(--hisab-foreground)]">{isLangFa ? item.labelFa : item.labelEn}</h3>
                </button>
              ))}
            </div>
            <div className="mt-8 flex justify-between">
              <Button variant="ghost" onClick={() => onSetStep(0)} icon={<ArrowLeft className="size-4" />}>برگشت</Button>
              <Button onClick={() => onSetStep(2)} disabled={!businessType}
                className={businessType ? "ring-2 ring-[var(--hisab-primary)] ring-offset-2" : ""}>ادامه</Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="mx-auto w-full max-w-3xl">
            <h2 className="mb-8 text-center text-2xl font-bold text-[var(--hisab-foreground)]">اندازه کسب و کار</h2>
            <div className="space-y-4">
              {storeSizes.map((item) => (
                <button key={item.id} onClick={() => onSetStoreSize(item.id)}
                  className={`flex w-full items-center gap-4 rounded-2xl border-2 p-5 transition-all text-start ${storeSize === item.id ? SELECTED : UNSELECTED}`}>
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
              <Button variant="ghost" onClick={() => onSetStep(1)}>برگشت</Button>
              <Button onClick={() => onSetStep(3)} disabled={!storeSize}
                className={storeSize ? "ring-2 ring-[var(--hisab-primary)] ring-offset-2" : ""}>ادامه</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="mx-auto w-full max-w-3xl">
            <h2 className="mb-8 text-center text-2xl font-bold text-[var(--hisab-foreground)]">ارز پیشفرض</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {currencies.map((cur) => (
                <button key={cur.code} onClick={() => onSetCurrency(cur.code)}
                  className={`rounded-2xl border-2 p-5 transition-all ${defaultCurrency === cur.code ? SELECTED : UNSELECTED}`}>
                  <div className="mb-2 text-3xl">{cur.flag}</div>
                  <div className="font-medium text-[var(--hisab-foreground)]">{cur.label}</div>
                </button>
              ))}
            </div>
            <div className="mt-8 flex justify-between">
              <Button variant="ghost" onClick={() => onSetStep(2)}>برگشت</Button>
              <Button onClick={() => onSetStep(4)} disabled={!defaultCurrency}
                className={defaultCurrency ? "ring-2 ring-[var(--hisab-primary)] ring-offset-2" : ""}>ادامه</Button>
            </div>
          </div>
        )}

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
                  <span className="font-medium text-[var(--hisab-foreground)]">{businessTypeLabel}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--hisab-muted-fg)]">اندازه</span>
                  <span className="font-medium text-[var(--hisab-foreground)]">{storeSizeLabel}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--hisab-muted-fg)]">ارز</span>
                  <span className="font-medium text-[var(--hisab-foreground)]">{currencyLabel}</span>
                </div>
              </CardContent>
            </Card>
            <div className="mt-8">
              <Button size="lg" fullWidth onClick={onComplete} icon={<ArrowRight className="size-5" />}>
                ورود به حسابچه
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}