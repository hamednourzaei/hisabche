// ============================================
// packages/ui/src/components/ui/dashboard/first-value-checklist.tsx
//
// V54.0 Phase 5.7 — First Value Experience.
// V65 · V64 §7: the STEPS come from the domain (`firstValueSteps`), never from
// an industry switch here. This component used to key on `archetypeHint` and
// fall through to RETAIL, so a consultant or a clinic was told to add a product
// and open the warehouse. It now renders whatever the DNA + capability plan say.
//
// ⚠️ A read that FAILED is said, not shown as «not done»: pass `unavailable`
// and the card reports that it could not read the business instead of quietly
// claiming nothing has been created.
// ============================================

import React, { memo, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Circle, ArrowRight, Sparkles, AlertCircle } from 'lucide-react'
import { firstValueSteps, type FirstValueCompletion } from '@hisabche/validation'
import { useOperationalDna } from '../../../hooks/use-operational-dna'
import { useLocalePush } from '../../../hooks/use-locale-push'
import { cn } from '../../../lib/utils'

export interface FirstValueChecklistProps {
  hasProducts: boolean
  hasCustomers: boolean
  hasInvoices: boolean
  hasSessions?: boolean
  /** At least one core read failed: do not present the steps as pending. */
  unavailable?: boolean
  className?: string
}

type TranslationKey = Parameters<ReturnType<typeof useTranslations>>[0]

export const FirstValueChecklist = memo(function FirstValueChecklist({
  hasProducts,
  hasCustomers,
  hasInvoices,
  hasSessions = false,
  unavailable = false,
  className,
}: FirstValueChecklistProps) {
  const t = useTranslations()
  const push = useLocalePush()
  const { resolution } = useOperationalDna()

  const items = useMemo(() => {
    const done: Record<FirstValueCompletion, boolean> = {
      products: hasProducts,
      customers: hasCustomers,
      invoices: hasInvoices,
      sessions: hasSessions,
    }
    return firstValueSteps(resolution.dna, resolution.activeModules).map((step) => ({
      ...step,
      completed: done[step.completesOn],
    }))
  }, [
    resolution.dna,
    resolution.activeModules,
    hasProducts,
    hasCustomers,
    hasInvoices,
    hasSessions,
  ])

  const completedCount = items.filter((item) => item.completed).length
  const isAllComplete = items.length > 0 && completedCount === items.length

  if (unavailable) {
    return (
      <div
        role="alert"
        className={cn(
          'flex items-center gap-2 rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4 text-sm text-[hsl(var(--fg-secondary))]',
          className,
        )}
      >
        <AlertCircle className="size-4 shrink-0 text-[hsl(var(--color-warning))]" />
        {t('firstValue.unavailable' as TranslationKey)}
      </div>
    )
  }

  if (isAllComplete) {
    return null
  }

  return (
    <div
      data-first-value-checklist={resolution.dna.archetypeHint ?? 'GENERIC_BUSINESS'}
      className={cn(
        'rounded-2xl border border-[hsl(var(--color-primary)/0.2)] bg-[hsl(var(--surface-elevated))] p-5 shadow-sm',
        className,
      )}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-[hsl(var(--color-primary))]" />
          <h3 className="font-bold text-[hsl(var(--fg-primary))]">
            {t('firstValue.title' as TranslationKey)}
          </h3>
        </div>
        <span className="rounded-full bg-[hsl(var(--color-primary)/0.1)] px-3 py-1 text-xs font-semibold text-[hsl(var(--color-primary))]">
          {completedCount} / {items.length}
        </span>
      </div>

      <div className="space-y-2.5">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => push(item.route)}
            className={cn(
              'flex w-full items-center justify-between rounded-xl p-3 text-start transition-all',
              item.completed
                ? 'bg-[hsl(var(--surface-muted)/0.3)] opacity-70'
                : 'bg-[hsl(var(--surface-muted))] hover:bg-[hsl(var(--color-primary)/0.08)]',
            )}
          >
            <div className="flex items-center gap-3">
              {item.completed ? (
                <CheckCircle2 className="size-5 shrink-0 text-[hsl(var(--color-success))]" />
              ) : (
                <Circle className="size-5 shrink-0 text-[hsl(var(--fg-secondary))]" />
              )}
              <div>
                <p
                  className={cn(
                    'text-sm font-semibold text-[hsl(var(--fg-primary))]',
                    item.completed && 'line-through',
                  )}
                >
                  {t(item.titleKey as TranslationKey)}
                </p>
                {!item.completed && (
                  <p className="text-xs text-[hsl(var(--fg-secondary))]">
                    {t(item.descKey as TranslationKey)}
                  </p>
                )}
              </div>
            </div>
            {!item.completed && (
              <ArrowRight className="size-4 shrink-0 text-[hsl(var(--color-primary))] ms-2 rtl:rotate-180" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
})
