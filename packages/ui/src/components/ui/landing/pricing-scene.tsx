// packages/ui/src/components/ui/landing/pricing-scene.tsx
'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { cn } from '../../../lib/utils'
import { LANDING_CONTAINER, LANDING_SECTION, SectionHeader } from './landing-primitives'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../tabs'
import { useIntlLocale } from '../../../hooks/use-intl-locale'
import { formatNumber } from '@hisabche/formatting'
import { usePlans } from '@hisabche/api'
import { Check, Minus, ChevronDown } from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════════════════
   PricingScene v8 — Fully self-contained · Zero external dependencies
   ═══════════════════════════════════════════════════════════════════════════ */

const POPULAR_BG = 'bg-[hsl(var(--color-primary)/0.04)]'
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
  values: CellValue[]
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
        values: [{ count: 50, perMonth: true }, 'unlimited', 'unlimited'],
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
      {
        labelKey: 'users',
        fallback: 'تعداد کاربران',
        values: [{ count: 5 }, { count: 5 }, 'unlimited'],
      },
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

/**
 * A comparison value. Counts are numbers, not pre-formatted Persian strings —
 * «۵۰ در ماه» used to render on /en exactly as written.
 */
type CellValue = 'check' | 'dash' | 'unlimited' | { count: number; perMonth?: true }

function Cell({
  value,
  locale,
  st,
}: {
  value: CellValue
  locale: string
  st: (key: string, fallback?: string) => string
}) {
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
  const text =
    value === 'unlimited'
      ? st('landing.pricing.unlimited', 'نامحدود')
      : value.perMonth
        ? `${formatNumber(value.count, locale)} ${st('landing.pricing.perMonthSuffix', 'در ماه')}`
        : formatNumber(value.count, locale)
  return <span className="text-sm tabular-nums text-[hsl(var(--fg-secondary))]">{text}</span>
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
      <span className="mb-0.5 text-xs text-[hsl(var(--fg-tertiary))]">
        {perMonth(price.currency)}
      </span>
    </>
  )
}

export default function PricingScene() {
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

  const [featuresOpen, setFeaturesOpen] = useState(false)
  const activeLocale = useLocale()
  const routePrefix = activeLocale ? `/${activeLocale}` : ''

  const renderPlan = (plan: Plan, i: number) => {
    // Quoted plans go to the real contact page — there is no contact form on
    // the landing page, and signup is not how to ask for a quote.
    const ctaHref =
      plan.billingPlan === 'enterprise' ? `${routePrefix}/contact` : `${routePrefix}/signup`
    return (
      <>
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-[hsl(var(--fg-primary))]">
              {st(`landing.pricing.${plan.key}.name`, plan.fallbackName)}
            </h3>
            {plan.popular && (
              <span className="rounded-full bg-[hsl(var(--color-primary)/0.12)] px-2.5 py-0.5 text-xs font-semibold text-[hsl(var(--color-primary))]">
                {st('landing.pricingPopular', 'محبوب‌ترین')}
              </span>
            )}
          </div>
          <p className="text-sm text-[hsl(var(--fg-tertiary))]">
            {st('landing.pricing.bestIfLabel', 'مناسب اگر')}:{' '}
            {st(`landing.pricing.${plan.key}.bestIf`, plan.fallbackBestIf)}
          </p>
          {/* `who` carries the enterprise offer — "tell us what to add, remove
              or change" — the whole pitch for a plan with no listed price. */}
          <p className="mt-1 text-sm leading-snug text-[hsl(var(--fg-secondary))]">
            {st(`landing.pricing.${plan.key}.who`, plan.fallbackWho)}
          </p>
        </div>

        <div className="flex min-h-10 items-end gap-1.5">
          <PlanPrice
            price={priceOf(plan)}
            locale={locale}
            st={st}
            perMonth={perMonth}
            amountClassName="text-3xl font-bold tabular-nums text-[hsl(var(--fg-primary))] lg:text-4xl"
            contactClassName="text-2xl font-bold text-[hsl(var(--fg-primary))]"
          />
        </div>

        <Link
          prefetch={false}
          href={ctaHref}
          className={cn(
            'inline-flex min-h-12 w-full items-center justify-center rounded-xl px-4 text-sm font-semibold',
            plan.popular ? 'btn-primary' : 'btn-secondary',
          )}
        >
          {st(`landing.pricing.${plan.key}.cta`, plan.ctaFallback)}
        </Link>
      </>
    )
  }

  return (
    <section id="pricing" className={cn(LANDING_SECTION, 'bg-[hsl(var(--surface-muted)/0.3)]')}>
      <div className={cn(LANDING_CONTAINER, 'max-w-5xl')}>
        <SectionHeader
          label={st('landing.pricingLabel', 'تعرفه‌ها')}
          title={st('landing.pricingTitle', 'از رایگان شروع کنید، هر زمان خواستید ارتقا دهید')}
        />

        {/* PHONES AND TABLETS — one plan at a time behind the project's Tabs.
            Three full cards stacked were 1021px at 360px, and the comparison
            table needs 800px; below `lg` each tab carries its own column of it. */}
        <Tabs defaultValue="pro" className="lg:hidden" onValueChange={() => setFeaturesOpen(false)}>
          <TabsList className="mb-4 grid w-full grid-cols-3 overflow-visible">
            {PLANS.map((plan) => (
              <TabsTrigger key={plan.key} value={plan.key} className="min-h-10 w-full text-sm">
                {st(`landing.pricing.${plan.key}.name`, plan.fallbackName)}
              </TabsTrigger>
            ))}
          </TabsList>
          {PLANS.map((plan, i) => (
            <TabsContent key={plan.key} value={plan.key}>
              <div
                className={cn(
                  'flex flex-col gap-5 rounded-2xl border p-5 sm:p-8',
                  plan.popular
                    ? 'border-[hsl(var(--color-primary)/0.35)] bg-[hsl(var(--surface-elevated))] shadow-xl'
                    : 'border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base)/0.5)]',
                )}
              >
                {renderPlan(plan, i)}

                <div className="border-t border-[hsl(var(--border-default))] pt-4">
                  <button
                    type="button"
                    onClick={() => setFeaturesOpen((open) => !open)}
                    aria-expanded={featuresOpen}
                    className="flex min-h-10 w-full items-center justify-between gap-2 text-sm font-medium text-[hsl(var(--fg-secondary))]"
                  >
                    {st('landing.pricing.seeFeatures', 'مشاهده امکانات')}
                    <ChevronDown
                      className={cn('size-4 transition-transform', featuresOpen && 'rotate-180')}
                      aria-hidden="true"
                    />
                  </button>
                  {featuresOpen && (
                    <div className="mt-2 space-y-4">
                      {FEATURE_GROUPS.map((group) => (
                        <div key={group.groupKey}>
                          <p className="mb-1.5 text-xs font-semibold text-[hsl(var(--fg-tertiary))]">
                            {st(`landing.pricing.group.${group.groupKey}`, group.fallbackGroup)}
                          </p>
                          <ul className="space-y-2">
                            {group.rows.map((row) => (
                              <li
                                key={row.labelKey}
                                className="flex items-center justify-between gap-3 text-sm text-[hsl(var(--fg-secondary))]"
                              >
                                <span>
                                  {st(`landing.pricing.row.${row.labelKey}`, row.fallback)}
                                </span>
                                <span className="shrink-0">
                                  <Cell value={row.values[i]!} locale={locale} st={st} />
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>

        {/* DESKTOP — the template's frame with the popular plan raised (MIT). */}
        <div className="hidden rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base)/0.5)] lg:block">
          <ul className="grid grid-cols-3">
            {PLANS.map((plan, i) => (
              <li
                key={plan.key}
                className={cn(
                  'relative flex flex-col gap-6 p-8',
                  plan.popular &&
                    'm-2 rounded-xl bg-[hsl(var(--surface-elevated))] shadow-xl ring-1 ring-[hsl(var(--color-primary)/0.35)]',
                )}
              >
                {renderPlan(plan, i)}
              </li>
            ))}
          </ul>
        </div>

        {/* Desktop table */}
        <div
          className={cn(
            'mt-10 hidden lg:block rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] shadow-sm',
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
                        <span className="inline-block px-2.5 sm:px-3 py-1 rounded-full text-xs font-semibold text-white bg-[image:var(--gradient-brand)] mb-1.5">
                          {st('landing.pricingPopular', 'محبوب‌ترین')}
                        </span>
                      )}
                      <p className="text-base sm:text-lg font-bold text-[hsl(var(--fg-primary))]">
                        {st(`landing.pricing.${plan.key}.name`, plan.fallbackName)}
                      </p>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {FEATURE_GROUPS.map((group) => (
                  <React.Fragment key={`group-${group.groupKey}`}>
                    <tr className="border-b border-[hsl(var(--border-default))]">
                      <td
                        colSpan={4}
                        className="px-4 sm:px-6 py-2.5 sm:py-3 text-xs font-semibold uppercase tracking-[0.15em] text-[hsl(var(--fg-tertiary))]"
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
                          className="px-4 sm:px-6 py-2.5 sm:py-3 text-sm font-normal text-[hsl(var(--fg-secondary))] text-start"
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
                            <Cell value={val} locale={locale} st={st} />
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
