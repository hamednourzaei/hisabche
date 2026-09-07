'use client'

// ============================================
// packages/ui/src/components/ui/billing/PricingPage.tsx
//
// T6 — «/billing هیچ گزینه ارتقایی در اینجا نیست».
//
// ---------------------------------------------------------------------------
// WHY THERE WAS NO UPGRADE OPTION
//
// Three separate reasons, and none of them was a missing feature:
//
//   1. `BillingContainer` rendered its upgrade button behind
//      `subscription.plan === 'free' && !subscription.isTrial`.
//      So a person ON THE TRIAL — the one most likely to be looking at this
//      page precisely because they want to buy — saw no upgrade control at
//      all. The button existed and was unreachable for the audience it was
//      for.
//
//   2. Where it did appear it called
//      `upgrade.mutate({ plan: 'pro', interval: 'month' })` — one hardcoded
//      plan, one hardcoded interval. `usePlans()` existed and had no caller
//      on this page, and `priceYearly` was returned by the server, typed in
//      the client, and rendered nowhere. Annual billing was fully built and
//      unreachable.
//
//   3. This component and `containers/PricingContainer.tsx` were two
//      near-identical copies of the same screen, and NEITHER had a route.
//
// ---------------------------------------------------------------------------
// ⚠️ THE CURRENCY IS THE SERVER'S TO STATE
//
// The old markup wrote `${plan.priceMonthly}` — a dollar sign hardcoded in
// JSX. The plans endpoint returned bare numbers with no currency field, so
// nothing anywhere actually declared what the product charges in. The server
// now says so and this renders what it says. If it says nothing, this renders
// the amount without inventing a symbol: a wrong currency on a price is worse
// than a missing one.
// ============================================

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, Loader2 } from 'lucide-react'

import { usePlans, useUpgrade, type BillingPlan } from '@hisabche/api'

import { Badge } from '../badge'
import { Button } from '../button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../card'
import { cn } from '../../../lib/utils'

type Interval = 'month' | 'year'

export interface PricingPageProps {
  /** The plan the workspace is on, so its card reads «فعلی» instead of «ارتقا». */
  currentPlan?: string | undefined
  /** True while the trial is running — a trial user may still upgrade. */
  isTrial?: boolean | undefined
}

/** The amount, with whatever currency the SERVER declared. Never a guess. */
function priceLabel(amount: number, currency: string | undefined): string {
  if (!currency) return String(amount)
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
  } catch {
    // An unknown code reaches here. Showing «12 XYZ» is honest; falling back
    // to a dollar sign would assert a currency nobody stated.
    return `${amount} ${currency}`
  }
}

function priceFor(plan: BillingPlan, interval: Interval): number | null {
  return interval === 'year' ? plan.priceYearly : plan.priceMonthly
}

/**
 * Months saved by paying yearly, or null when there is nothing to compare.
 *
 * Computed rather than written as a claim: «۲ ماه رایگان» on a badge that does
 * not follow the actual prices is the kind of copy that stops being true after
 * one pricing change and nobody notices.
 */
function yearlySaving(plan: BillingPlan): number | null {
  if (!plan.priceMonthly || !plan.priceYearly) return null
  const full = plan.priceMonthly * 12
  if (plan.priceYearly >= full) return null
  return Math.round(((full - plan.priceYearly) / full) * 100)
}

export function PricingPage({ currentPlan, isTrial }: PricingPageProps = {}) {
  const t = useTranslations()
  const { data: plans, isLoading } = usePlans()
  const upgrade = useUpgrade()
  const [interval, setInterval] = useState<Interval>('month')

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2
          className="size-6 animate-spin text-[hsl(var(--fg-tertiary))]"
          aria-hidden="true"
        />
      </div>
    )
  }

  if (!plans || plans.length === 0) return null

  // Offered only when a plan actually has a yearly price. A toggle that
  // switches between two identical columns is worse than no toggle.
  const hasYearly = plans.some((plan) => plan.priceYearly !== null)

  return (
    <div className="space-y-4">
      {hasYearly ? (
        <div className="flex justify-center">
          <div
            role="tablist"
            aria-label={t('billing.interval')}
            className="inline-flex rounded-full border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))] p-1"
          >
            {(['month', 'year'] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={interval === option}
                onClick={() => setInterval(option)}
                className={cn(
                  'rounded-full px-4 py-1.5 text-sm transition-colors',
                  interval === option
                    ? 'bg-[hsl(var(--surface-elevated))] font-medium text-[hsl(var(--fg-primary))] shadow-sm'
                    : 'text-[hsl(var(--fg-secondary))]',
                )}
              >
                {option === 'month' ? t('billing.monthly') : t('billing.yearly')}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = currentPlan === plan.plan && !isTrial
          const isPopular = plan.plan === 'pro'
          const amount = priceFor(plan, interval)
          const saving = interval === 'year' ? yearlySaving(plan) : null

          return (
            <Card
              key={plan.plan}
              className={cn(
                'relative flex flex-col',
                isPopular && 'border-[hsl(var(--color-primary))] shadow-[var(--shadow-premium)]',
              )}
            >
              {isPopular ? (
                <Badge className="absolute -top-2 end-4">{t('billing.popular')}</Badge>
              ) : null}

              <CardHeader>
                {/* `billing.plans.<plan>` is an OBJECT holding `name` and
                    `features`; reading the object node itself rendered the raw
                    key path on screen. */}
                <CardTitle>{t(`billing.plans.${plan.plan}.name`)}</CardTitle>
                <CardDescription>
                  {amount === null ? (
                    <span className="text-2xl font-bold text-[hsl(var(--fg-primary))]">
                      {plan.plan === 'free' ? t('billing.free') : t('billing.contactUs')}
                    </span>
                  ) : (
                    <>
                      <span className="text-3xl font-bold tabular-nums text-[hsl(var(--fg-primary))]">
                        {priceLabel(amount, plan.currency)}
                      </span>
                      <span className="text-sm text-[hsl(var(--fg-tertiary))]">
                        {' / '}
                        {interval === 'month' ? t('billing.month') : t('billing.year')}
                      </span>
                    </>
                  )}
                  {saving !== null ? (
                    <span className="ms-2 text-xs text-[hsl(var(--color-success))]">
                      {t('billing.savePercent', { percent: saving })}
                    </span>
                  ) : null}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-1">
                <ul className="space-y-2">
                  {plan.featureKeys.map((key) => (
                    <li key={key} className="flex items-start gap-2 text-sm">
                      <Check
                        className="mt-0.5 size-4 shrink-0 text-[hsl(var(--color-success))]"
                        aria-hidden="true"
                      />
                      <span className="text-[hsl(var(--fg-secondary))]">{t(key)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter>
                <Button
                  className="w-full"
                  variant={isPopular ? 'default' : 'outline'}
                  // The free plan is where you already are if you have not
                  // paid; there is nothing to buy.
                  disabled={isCurrent || plan.plan === 'free' || upgrade.isPending}
                  onClick={() => upgrade.mutate({ plan: plan.plan, interval })}
                >
                  {upgrade.isPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : isCurrent ? (
                    t('billing.currentPlanLabel')
                  ) : plan.priceMonthly === null && plan.plan !== 'free' ? (
                    t('billing.contactUs')
                  ) : (
                    t('billing.upgradeNow')
                  )}
                </Button>
              </CardFooter>
            </Card>
          )
        })}
      </div>

      {upgrade.isError ? (
        <p className="text-center text-sm text-[hsl(var(--color-destructive))]" role="alert">
          {(upgrade.error as Error).message}
        </p>
      ) : null}
    </div>
  )
}

/**
 * ⚠️ `PricingContainer` was a second, near-identical copy of this screen.
 *
 * Neither had a route, so the duplication was invisible — and they had already
 * drifted: one carried a fix for the plan-name key path that the other did
 * not. The name is kept as an alias so the public export keeps working.
 */
export { PricingPage as PricingContainer }
