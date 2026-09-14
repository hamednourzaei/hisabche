// packages/ui/src/components/ui/landing/pricing-scene.tsx
'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { cn } from '../../../lib/utils'
import { LANDING_CONTAINER, LANDING_SECTION, SectionHeader } from './landing-primitives'
import { useIntlLocale } from '../../../hooks/use-intl-locale'
import { formatNumber } from '@hisabche/formatting'
import { usePlans } from '@hisabche/api'
import { Check, Minus, ChevronDown } from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════════════════
   PricingScene v8 — Fully self-contained · Zero external dependencies
   ═══════════════════════════════════════════════════════════════════════════ */

// پراپز کاملاً آپشنال — کامپوننت خودش همه چی رو handle میکنه
export interface PricingSceneProps {
  t?: (key: string, fallback?: string) => string
  onNavigateLogin?: () => void
}

const POPULAR_BG = 'bg-[hsl(var(--color-primary)/0.04)]'
const POPULAR_BORDER = 'border-[hsl(var(--color-primary)/0.25)]'
const STRIPE_ROW = 'bg-[hsl(var(--surface-muted)/0.2)]'

interface Plan {
  key: string
  fallbackName: string
  fallbackWho: string
  fallbackBestIf: string
  /**
   * The plan this row is priced from, in `GET /api/billing/plans`.
   *
   * ⚠️ THIS TABLE NO LONGER CARRIES A PRICE, AND THAT IS THE POINT.
   *
   * It used to say `price: 499` next to the label «افغانی / ماه». The billing
   * API charges 12 USD for the same plan. So the public page advertised a
   * figure that was wrong in the amount AND in the currency, and nothing
   * connected the two — changing the real price would have left the landing
   * page quoting the old one forever.
   *
   * Same class of defect as the fabricated testimonials removed in T5.3: the
   * page was stating something as fact that no source backed.
   *
   * The marketing COPY still lives here — names, who it is for, the feature
   * matrix. Only the number comes from the server.
   */
  billingPlan: 'free' | 'pro' | 'enterprise'
  ctaFallback: string
  popular?: boolean
}

const PLANS: Plan[] = [
  {
    key: 'free',
    fallbackName: 'رایگان',
    fallbackWho: 'برای شروع',
    fallbackBestIf: 'تازه‌کار',
    billingPlan: 'free',
    ctaFallback: 'شروع رایگان',
  },
  {
    key: 'pro',
    fallbackName: 'حرفه‌ای',
    fallbackWho: 'برای اکثر کسب‌وکارها',
    fallbackBestIf: 'فروش روزانه',
    billingPlan: 'pro',
    ctaFallback: 'ارتقا به حرفه‌ای',
    popular: true,
  },
  {
    key: 'business',
    fallbackName: 'تجاری',
    // Enterprise is quoted, not listed: the plan is assembled per customer, so
    // the invitation to ask for items added, removed or changed IS the offer.
    fallbackWho: 'اگر درخواست افزودن، کم کردن یا اصلاح موردی دارید، بگویید',
    fallbackBestIf: 'چند شعبه',
    // The landing calls this «تجاری»; billing calls it `enterprise`. The names
    // are allowed to differ — the mapping is what stops them drifting apart.
    billingPlan: 'enterprise',
    ctaFallback: 'تماس با فروش',
  },
]

interface FeatureRow {
  labelKey: string
  fallback: string
  values: ('check' | 'dash' | string)[]
}

interface FeatureGroup {
  groupKey: string
  fallbackGroup: string
  rows: FeatureRow[]
}

const FEATURE_GROUPS: FeatureGroup[] = [
  {
    groupKey: 'sales',
    fallbackGroup: 'فروش',
    rows: [
      {
        labelKey: 'invoices',
        fallback: 'فاکتور فروش',
        values: ['۵۰ در ماه', 'نامحدود', 'نامحدود'],
      },
      { labelKey: 'pos', fallback: 'ثبت سریع فروش', values: ['check', 'check', 'check'] },
      { labelKey: 'debt', fallback: 'مدیریت بدهی', values: ['check', 'check', 'check'] },
    ],
  },
  {
    groupKey: 'inventory',
    fallbackGroup: 'انبار',
    rows: [
      { labelKey: 'stock', fallback: 'موجودی کالا', values: ['check', 'check', 'check'] },
      { labelKey: 'lowStockAlert', fallback: 'هشدار کمبود', values: ['check', 'check', 'check'] },
      { labelKey: 'multiWarehouse', fallback: 'چند انبار', values: ['dash', 'dash', 'check'] },
    ],
  },
  {
    groupKey: 'reports',
    fallbackGroup: 'گزارش‌ها',
    rows: [
      {
        labelKey: 'basicReports',
        fallback: 'گزارش فروش و سود',
        values: ['check', 'check', 'check'],
      },
      {
        labelKey: 'advancedReports',
        fallback: 'گزارش‌های پیشرفته',
        values: ['check', 'check', 'check'],
      },
      { labelKey: 'export', fallback: 'خروجی Excel و PDF', values: ['check', 'check', 'check'] },
    ],
  },
  {
    groupKey: 'platform',
    fallbackGroup: 'پلتفرم',
    rows: [
      { labelKey: 'offline', fallback: 'آفلاین کامل', values: ['check', 'check', 'check'] },
      { labelKey: 'backup', fallback: 'بک‌آپ خودکار', values: ['check', 'check', 'check'] },
      { labelKey: 'users', fallback: 'تعداد کاربران', values: ['۵', '۵', 'نامحدود'] },
      { labelKey: 'branches', fallback: 'چند شعبه', values: ['dash', 'dash', 'check'] },
      { labelKey: 'api', fallback: 'دسترسی API', values: ['check', 'check', 'check'] },
    ],
  },
  {
    groupKey: 'support',
    fallbackGroup: 'پشتیبانی',
    rows: [
      { labelKey: 'emailSupport', fallback: 'پشتیبانی ایمیل', values: ['check', 'check', 'check'] },
      {
        labelKey: 'prioritySupport',
        fallback: 'پشتیبانی اولویت‌دار',
        values: ['check', 'check', 'check'],
      },
      {
        labelKey: 'dedicatedManager',
        fallback: 'مدیر حساب اختصاصی',
        values: ['dash', 'dash', 'check'],
      },
    ],
  },
]

function Cell({ value }: { value: 'check' | 'dash' | string }) {
  if (value === 'check')
    return (
      <Check
        className="size-3.5 sm:size-4 text-[hsl(var(--color-success))] mx-auto"
        aria-hidden="true"
      />
    )
  if (value === 'dash')
    return (
      <Minus
        className="size-3.5 sm:size-4 text-[hsl(var(--fg-tertiary))] mx-auto"
        aria-hidden="true"
      />
    )
  return (
    <span className="text-[10px] sm:text-xs lg:text-sm tabular-nums text-[hsl(var(--fg-secondary))]">
      {value}
    </span>
  )
}

/**
 * One plan's price, in the three states it can actually be in.
 *
 * Written once and used by both the card grid and the comparison table: the
 * two used to carry their own copy of the ternary, so a fix to one silently
 * left the other quoting differently on the same page.
 */
function PlanPrice({
  price,
  locale,
  st,
  perMonth,
  amountClassName,
  contactClassName,
}: {
  price: { amount: number; currency?: string } | null | undefined
  locale: string
  st: (key: string, fallback?: string) => string
  perMonth: (currency?: string) => string
  amountClassName: string
  contactClassName: string
}) {
  // Not loaded. A placeholder holds the height so the card does not jump, and
  // — critically — no number is shown. Showing a remembered price while the
  // real one loads is exactly how the wrong figure got onto this page.
  if (price === undefined) {
    return (
      <span
        className="inline-block h-7 w-20 animate-pulse rounded bg-[hsl(var(--surface-muted))]"
        aria-hidden="true"
      />
    )
  }

  // Quoted per customer.
  if (price === null) {
    return (
      <span className={contactClassName}>{st('landing.pricing.contactUs', 'تماس بگیرید')}</span>
    )
  }

  if (price.amount === 0) {
    return <span className={amountClassName}>{st('landing.pricing.free', 'رایگان')}</span>
  }

  return (
    <>
      <span className={amountClassName}>{formatNumber(price.amount, locale)}</span>
      <span className="mb-0.5 text-[10px] text-[hsl(var(--fg-tertiary))]">
        {perMonth(price.currency)}
      </span>
    </>
  )
}

export default function PricingScene(props: PricingSceneProps) {
  const router = useRouter()
  const t = useTranslations()
  // Plan prices used to render through `toLocaleString('fa-AF')`, so an
  // English visitor was shown Persian digits. The digits follow the reader's
  // language; the CURRENCY does not — see BILLING_CURRENCY. Plan prices are
  // quoted in one currency the business sets and are deliberately never
  // converted: there is no exchange-rate source, and a converted number would
  // be a price nobody agreed to.
  const locale = useIntlLocale()

  // ─── T5.3 — the price comes from billing, or it is not stated ─────────
  //
  // `usePlans()` is deliberately not auth-gated (see the hook), so the public
  // landing page can read the same list `/billing` shows a signed-in customer.
  // One source, so the two can never quote different figures.
  const { data: apiPlans } = usePlans()

  const priceOf = (plan: Plan): { amount: number; currency?: string } | null | undefined => {
    // `undefined` = not known yet (or the request failed). `null` = this plan
    // genuinely has no list price and is quoted per customer. The difference
    // matters: one means «wait», the other means «ask us», and rendering the
    // first as the second would tell a visitor to phone about the free plan.
    if (!apiPlans) return undefined
    const match = apiPlans.find((candidate) => candidate.plan === plan.billingPlan)
    if (!match) return null
    if (match.priceMonthly === null) return null
    return match.currency
      ? { amount: match.priceMonthly, currency: match.currency }
      : { amount: match.priceMonthly }
  }

  /**
   * The unit under the amount — «USD / ماه», not a hardcoded «افغانی / ماه».
   *
   * The old label named a currency the product does not bill in. Naming the
   * wrong currency beside a number is worse than naming none, so when the
   * server does not declare one this says only «/ ماه».
   */
  const perMonth = (currency?: string): string =>
    currency
      ? `${currency} / ${st('landing.pricing.month', 'ماه')}`
      : `/ ${st('landing.pricing.month', 'ماه')}`

  const st = (key: string, fallback?: string): string => {
    if (typeof t === 'function') {
      const result = t(key)
      if (typeof result === 'string' && result !== key) return result
    }
    return fallback ?? key
  }

  const onNavigateLogin = () => {
    if (typeof props.onNavigateLogin === 'function') {
      props.onNavigateLogin()
    } else {
      router.push('/login')
    }
  }

  const [mobilePlan, setMobilePlan] = useState(1)
  const [mobileFeaturesOpen, setMobileFeaturesOpen] = useState(false)

  const allMobileFeatures = useMemo(() => FEATURE_GROUPS.flatMap((g) => g.rows), [])

  return (
    <section id="pricing" className={cn(LANDING_SECTION, 'bg-[hsl(var(--surface-muted)/0.3)]')}>
      <div className={cn(LANDING_CONTAINER, 'max-w-5xl')}>
        <SectionHeader
          label={st('landing.pricingLabel', 'تعرفه‌ها')}
          title={st('landing.pricingTitle', 'از رایگان شروع کنید، هر زمان خواستید ارتقا دهید')}
        />

        {/* Mobile */}
        <div className="sm:hidden">
          <div className="flex bg-[hsl(var(--surface-muted))] rounded-xl p-1 mb-5">
            {PLANS.map((plan, i) => (
              <button
                key={plan.key}
                type="button"
                onClick={() => {
                  setMobilePlan(i)
                  setMobileFeaturesOpen(false)
                }}
                className={cn(
                  'flex-1 py-2 rounded-lg text-xs font-semibold transition-all',
                  mobilePlan === i
                    ? 'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--fg-primary))] shadow-sm'
                    : 'text-[hsl(var(--fg-tertiary))]',
                )}
              >
                {st(`landing.pricing.${plan.key}.name`, plan.fallbackName)}
              </button>
            ))}
          </div>

          {PLANS.map(
            (plan, i) =>
              mobilePlan === i && (
                <div
                  key={plan.key}
                  className={cn(
                    'relative rounded-[var(--radius-xl)] border p-5 space-y-3.5',
                    plan.popular
                      ? `${POPULAR_BORDER} ${POPULAR_BG} shadow-[var(--shadow-premium)]`
                      : 'border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]',
                  )}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold text-white bg-[var(--gradient-brand)] shadow-sm">
                        {st('landing.pricingPopular', 'محبوب‌ترین')}
                      </span>
                    </div>
                  )}
                  <div>
                    <h3 className="text-base font-bold text-[hsl(var(--fg-primary))]">
                      {st(`landing.pricing.${plan.key}.name`, plan.fallbackName)}
                    </h3>
                    <p className="text-xs text-[hsl(var(--fg-tertiary))]">
                      {st(`landing.pricing.${plan.key}.bestIf`, plan.fallbackBestIf)}
                    </p>
                    {/* `who` was declared on every plan but never rendered. It
                        carries the enterprise offer — "tell us what to add,
                        remove or change" — which is the whole pitch for a plan
                        that has no listed price. */}
                    <p className="mt-1 text-[11px] leading-snug text-[hsl(var(--fg-secondary))]">
                      {st(`landing.pricing.${plan.key}.who`, plan.fallbackWho)}
                    </p>
                  </div>

                  <div className="min-h-[2rem] flex items-end gap-1">
                    <PlanPrice
                      price={priceOf(plan)}
                      locale={locale}
                      st={st}
                      perMonth={perMonth}
                      amountClassName="text-2xl font-extrabold tabular-nums"
                      contactClassName="text-lg font-bold"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={onNavigateLogin}
                    className={cn(
                      'w-full rounded-xl py-2.5 text-xs font-semibold min-h-[40px] transition-all duration-200',
                      plan.popular
                        ? 'text-white bg-[var(--gradient-brand)] hover:opacity-90'
                        : 'border border-[hsl(var(--border-default))] text-[hsl(var(--fg-primary))] hover:bg-[hsl(var(--surface-muted))]',
                    )}
                  >
                    {st(`landing.pricing.${plan.key}.cta`, plan.ctaFallback)}
                  </button>

                  <button
                    type="button"
                    onClick={() => setMobileFeaturesOpen(!mobileFeaturesOpen)}
                    className="flex items-center gap-1 text-xs text-[hsl(var(--fg-secondary))]"
                  >
                    {st('landing.pricing.seeFeatures', 'مشاهده امکانات')}
                    <ChevronDown
                      className={cn(
                        'size-3.5 transition-transform',
                        mobileFeaturesOpen && 'rotate-180',
                      )}
                    />
                  </button>

                  {mobileFeaturesOpen && (
                    <ul className="space-y-1.5">
                      {allMobileFeatures.map((row) => (
                        <li
                          key={row.labelKey}
                          className="flex items-center gap-2 text-[11px] text-[hsl(var(--fg-secondary))]"
                        >
                          <Cell value={row.values[i]!} />
                          <span>{st(`landing.pricing.row.${row.labelKey}`, row.fallback)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ),
          )}
        </div>

        {/* Desktop table */}
        <div
          className={cn(
            'hidden sm:block rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] shadow-sm',
          )}
        >
          <div className="overflow-x-auto">
            <table className="min-w-[800px] w-full border-collapse">
              <thead>
                <tr className="border-b border-[hsl(var(--border-default))]">
                  <th className="px-4 sm:px-6 py-4 sm:py-5" />
                  {PLANS.map((plan) => (
                    <th
                      key={plan.key}
                      scope="col"
                      className={cn(
                        'px-4 sm:px-6 py-4 sm:py-5 text-center relative',
                        plan.popular && POPULAR_BG,
                      )}
                    >
                      {plan.popular && (
                        <span className="inline-block px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-[11px] font-semibold text-white bg-[var(--gradient-brand)] mb-1.5">
                          {st('landing.pricingPopular', 'محبوب‌ترین')}
                        </span>
                      )}
                      <p className="text-base sm:text-lg font-bold text-[hsl(var(--fg-primary))]">
                        {st(`landing.pricing.${plan.key}.name`, plan.fallbackName)}
                      </p>
                    </th>
                  ))}
                </tr>

                <tr className="border-b border-[hsl(var(--border-default))]">
                  <th
                    scope="row"
                    className="px-4 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-normal text-[hsl(var(--fg-secondary))] text-start"
                  >
                    {st('landing.pricing.bestIfLabel', 'مناسب اگر')}
                  </th>
                  {PLANS.map((plan) => (
                    <td
                      key={plan.key}
                      className={cn(
                        'px-4 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm text-[hsl(var(--fg-secondary))] text-center',
                        plan.popular && POPULAR_BG,
                      )}
                    >
                      {st(`landing.pricing.${plan.key}.bestIf`, plan.fallbackBestIf)}
                    </td>
                  ))}
                </tr>

                <tr className="border-b border-[hsl(var(--border-default))]">
                  <th
                    scope="row"
                    className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-normal text-[hsl(var(--fg-secondary))] text-start"
                  >
                    {st('landing.pricing.priceHeader', 'قیمت')}
                  </th>
                  {PLANS.map((plan) => (
                    <td
                      key={plan.key}
                      className={cn(
                        'px-4 sm:px-6 py-3 sm:py-4 text-center',
                        plan.popular && POPULAR_BG,
                      )}
                    >
                      <PlanPrice
                        price={priceOf(plan)}
                        locale={locale}
                        st={st}
                        perMonth={perMonth}
                        amountClassName="text-xl font-extrabold tabular-nums"
                        contactClassName="text-base font-bold"
                      />
                    </td>
                  ))}
                </tr>

                <tr className="border-b border-[hsl(var(--border-default))]">
                  <td />
                  {PLANS.map((plan) => (
                    <td
                      key={plan.key}
                      className={cn(
                        'px-4 sm:px-6 py-3 sm:py-4 text-center',
                        plan.popular && POPULAR_BG,
                      )}
                    >
                      <button
                        type="button"
                        onClick={onNavigateLogin}
                        className={cn(
                          'w-full rounded-xl py-2 sm:py-2.5 text-xs sm:text-sm font-semibold min-h-[40px] sm:min-h-[44px] transition-all duration-200',
                          plan.popular
                            ? 'text-white bg-[var(--gradient-brand)] hover:opacity-90'
                            : 'border border-[hsl(var(--border-default))] text-[hsl(var(--fg-primary))] hover:bg-[hsl(var(--surface-muted))]',
                        )}
                      >
                        {st(`landing.pricing.${plan.key}.cta`, plan.ctaFallback)}
                      </button>
                    </td>
                  ))}
                </tr>
              </thead>

              <tbody>
                {FEATURE_GROUPS.map((group) => (
                  <React.Fragment key={`group-${group.groupKey}`}>
                    <tr className="border-b border-[hsl(var(--border-default))]">
                      <td
                        colSpan={4}
                        className="px-4 sm:px-6 py-2.5 sm:py-3 text-[10px] sm:text-xs font-semibold uppercase tracking-[0.15em] text-[hsl(var(--fg-tertiary))]"
                      >
                        {st(`landing.pricing.group.${group.groupKey}`, group.fallbackGroup)}
                      </td>
                    </tr>

                    {group.rows.map((row, ri) => (
                      <tr
                        key={row.labelKey}
                        className={cn(
                          'border-b border-[hsl(var(--border-default))] last:border-0',
                          ri % 2 === 0 ? 'bg-transparent' : STRIPE_ROW,
                        )}
                      >
                        <th
                          scope="row"
                          className="px-4 sm:px-6 py-2.5 sm:py-3 text-[10px] sm:text-xs lg:text-sm font-normal text-[hsl(var(--fg-secondary))] text-start"
                        >
                          {st(`landing.pricing.row.${row.labelKey}`, row.fallback)}
                        </th>
                        {row.values.map((val, j) => (
                          <td
                            key={j}
                            className={cn(
                              'px-4 sm:px-6 py-2.5 sm:py-3 text-center',
                              PLANS[j]?.popular && POPULAR_BG,
                            )}
                          >
                            <Cell value={val} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-[hsl(var(--fg-tertiary))] sm:text-sm">
          {st('landing.pricingFooter', 'بدون قرارداد · لغو هر زمان · بدون کارت بانکی')}
        </p>
      </div>
    </section>
  )
}
