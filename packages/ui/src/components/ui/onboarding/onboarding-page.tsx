"use client"

import { Button } from "../button"
import { Card, CardContent } from "../card"
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

const SELECTED = "border-primary bg-primary/10 shadow-[0_0_0_2px_hsl(var(--primary))]"
const UNSELECTED = "border-border bg-card hover:border-primary/50"

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
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-5xl flex-col px-4 py-8">

        <div className="mb-10 flex items-center justify-center gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className={`h-2 w-20 rounded-full transition-all ${s <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>

        {step === 0 && (
          <div className="mx-auto max-w-xl text-center">
            <div className="mb-6 flex justify-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-primary shadow-lg">
                <span className="text-4xl font-bold text-primary-foreground">ح</span>
              </div>
            </div>
            <h2 className="mb-4 text-4xl font-bold text-foreground">
              {isLangFa ? "به حسابچه خوش آمدید" : "Welcome to Hisabche"}
            </h2>
            <p className="mb-10 text-lg text-muted-foreground">
              {isLangFa ? "در چند مرحله کوتاه حسابچه را برای کسب و کار شما آماده می‌کنیم." : "Let's configure your workspace in a few simple steps."}
            </p>
            <Button size="lg" onClick={() => onSetStep(1)} className="gap-2">
              <ArrowRight className="size-5" aria-hidden />
              {isLangFa ? "شروع" : "Get Started"}
            </Button>
          </div>
        )}

        {step === 1 && (
          <div className="mx-auto w-full max-w-3xl">
            <h2 className="mb-8 text-center text-2xl font-bold text-foreground">
              {isLangFa ? "نوع کسب و کار" : "Business Type"}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {businessTypes.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSetBusinessType(item.id)}
                  className={`rounded-2xl border-2 p-6 transition-all ${businessType === item.id ? SELECTED : UNSELECTED}`}
                >
                  <item.icon className="mb-4 size-10 text-primary" aria-hidden />
                  <h3 className="font-semibold text-foreground">{isLangFa ? item.labelFa : item.labelEn}</h3>
                </button>
              ))}
            </div>
            <div className="mt-8 flex justify-between">
              <Button variant="ghost" onClick={() => onSetStep(0)} className="gap-2">
                <ArrowLeft className="size-4" aria-hidden />
                برگشت
              </Button>
              <Button onClick={() => onSetStep(2)} disabled={!businessType}>
                ادامه
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="mx-auto w-full max-w-3xl">
            <h2 className="mb-8 text-center text-2xl font-bold text-foreground">اندازه کسب و کار</h2>
            <div className="space-y-4">
              {storeSizes.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSetStoreSize(item.id)}
                  className={`flex w-full items-center gap-4 rounded-2xl border-2 p-5 transition-all text-start ${storeSize === item.id ? SELECTED : UNSELECTED}`}
                >
                  <item.icon className="size-10 text-primary" aria-hidden />
                  <div>
                    <h3 className="font-semibold text-foreground">{item.labelFa}</h3>
                    <p className="text-sm text-muted-foreground">{item.descFa}</p>
                  </div>
                  {storeSize === item.id && <Check className="ms-auto size-5 text-primary" aria-hidden />}
                </button>
              ))}
            </div>
            <div className="mt-8 flex justify-between">
              <Button variant="ghost" onClick={() => onSetStep(1)}>برگشت</Button>
              <Button onClick={() => onSetStep(3)} disabled={!storeSize}>ادامه</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="mx-auto w-full max-w-3xl">
            <h2 className="mb-8 text-center text-2xl font-bold text-foreground">ارز پیشفرض</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {currencies.map((cur) => (
                <button
                  key={cur.code}
                  onClick={() => onSetCurrency(cur.code)}
                  className={`rounded-2xl border-2 p-5 transition-all ${defaultCurrency === cur.code ? SELECTED : UNSELECTED}`}
                >
                  <div className="mb-2 text-3xl">{cur.flag}</div>
                  <div className="font-medium text-foreground">{cur.label}</div>
                </button>
              ))}
            </div>
            <div className="mt-8 flex justify-between">
              <Button variant="ghost" onClick={() => onSetStep(2)}>برگشت</Button>
              <Button onClick={() => onSetStep(4)} disabled={!defaultCurrency}>ادامه</Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="mx-auto max-w-xl text-center">
            <div className="mb-6 flex justify-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-success/10">
                <Check className="size-12 text-success" aria-hidden />
              </div>
            </div>
            <h2 className="mb-4 text-3xl font-bold text-foreground">همه چیز آماده است</h2>
            <p className="mb-8 text-muted-foreground">حسابچه با موفقیت پیکربندی شد.</p>
            <Card className="border-border">
              <CardContent className="space-y-4 p-6 text-start">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">نوع کسب و کار</span>
                  <span className="font-medium text-foreground">{businessTypeLabel}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">اندازه</span>
                  <span className="font-medium text-foreground">{storeSizeLabel}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">ارز</span>
                  <span className="font-medium text-foreground">{currencyLabel}</span>
                </div>
              </CardContent>
            </Card>
            <div className="mt-8">
              <Button size="lg" fullWidth onClick={onComplete} className="gap-2">
                <ArrowRight className="size-5" aria-hidden />
                ورود به حسابچه
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}