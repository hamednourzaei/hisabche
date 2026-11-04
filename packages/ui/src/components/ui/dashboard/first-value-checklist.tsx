// ============================================
// packages/ui/src/components/ui/dashboard/first-value-checklist.tsx
//
// V54.0 Phase 5.7 — Archetype-Aware First Value Experience
// Derives setup progress directly from real business data.
// ============================================

import React, { memo, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Circle, ArrowRight, Sparkles } from 'lucide-react'
import { useOperationalDna } from '../../../hooks/use-operational-dna'
import { useLocalePush } from '../../../hooks/use-locale-push'
import { cn } from '../../../lib/utils'

export interface FirstValueChecklistProps {
  hasProducts: boolean
  hasCustomers: boolean
  hasInvoices: boolean
  hasSessions?: boolean
  className?: string
}

interface ChecklistItem {
  id: string
  titleKey: string
  descKey: string
  route: string
  completed: boolean
}

export const FirstValueChecklist = memo(function FirstValueChecklist({
  hasProducts,
  hasCustomers,
  hasInvoices,
  hasSessions = false,
  className,
}: FirstValueChecklistProps) {
  const t = useTranslations()
  const push = useLocalePush()
  const { resolution } = useOperationalDna()
  const archetype = resolution.dna.archetypeHint || 'RETAIL_STORE'

  const items: ChecklistItem[] = useMemo(() => {
    switch (archetype) {
      case 'NAIL_TECH_BEAUTY':
        return [
          {
            id: 'service',
            titleKey: 'firstValue.salon.step1Title',
            descKey: 'firstValue.salon.step1Desc',
            route: '/warehouse?tab=products&new=service',
            completed: hasProducts,
          },
          {
            id: 'client',
            titleKey: 'firstValue.salon.step2Title',
            descKey: 'firstValue.salon.step2Desc',
            route: '/customers?new=true',
            completed: hasCustomers,
          },
          {
            id: 'session',
            titleKey: 'firstValue.salon.step3Title',
            descKey: 'firstValue.salon.step3Desc',
            route: '/customers?tab=sessions',
            completed: hasSessions,
          },
          {
            id: 'invoice',
            titleKey: 'firstValue.salon.step4Title',
            descKey: 'firstValue.salon.step4Desc',
            route: '/invoices/new',
            completed: hasInvoices,
          },
        ]
      case 'LANGUAGE_TEACHER':
        return [
          {
            id: 'package',
            titleKey: 'firstValue.edu.step1Title',
            descKey: 'firstValue.edu.step1Desc',
            route: '/warehouse?tab=products&new=package',
            completed: hasProducts,
          },
          {
            id: 'student',
            titleKey: 'firstValue.edu.step2Title',
            descKey: 'firstValue.edu.step2Desc',
            route: '/customers?new=true',
            completed: hasCustomers,
          },
          {
            id: 'enroll',
            titleKey: 'firstValue.edu.step3Title',
            descKey: 'firstValue.edu.step3Desc',
            route: '/invoices/new',
            completed: hasInvoices,
          },
        ]
      case 'SERVICE_REPAIR':
        return [
          {
            id: 'parts',
            titleKey: 'firstValue.repair.step1Title',
            descKey: 'firstValue.repair.step1Desc',
            route: '/warehouse?tab=products',
            completed: hasProducts,
          },
          {
            id: 'customer',
            titleKey: 'firstValue.repair.step2Title',
            descKey: 'firstValue.repair.step2Desc',
            route: '/customers?new=true',
            completed: hasCustomers,
          },
          {
            id: 'order',
            titleKey: 'firstValue.repair.step3Title',
            descKey: 'firstValue.repair.step3Desc',
            route: '/invoices/new',
            completed: hasInvoices,
          },
        ]
      case 'RETAIL_STORE':
      default:
        return [
          {
            id: 'product',
            titleKey: 'firstValue.retail.step1Title',
            descKey: 'firstValue.retail.step1Desc',
            route: '/warehouse?tab=products&new=product',
            completed: hasProducts,
          },
          {
            id: 'customer',
            titleKey: 'firstValue.retail.step2Title',
            descKey: 'firstValue.retail.step2Desc',
            route: '/customers?new=true',
            completed: hasCustomers,
          },
          {
            id: 'sale',
            titleKey: 'firstValue.retail.step3Title',
            descKey: 'firstValue.retail.step3Desc',
            route: '/invoices/new',
            completed: hasInvoices,
          },
        ]
    }
  }, [archetype, hasProducts, hasCustomers, hasInvoices, hasSessions])

  const completedCount = items.filter((i) => i.completed).length
  const isAllComplete = completedCount === items.length

  if (isAllComplete) {
    return null
  }

  const safeT = (key: string, fallback: string): string => {
    try {
      const v = t(key as any)
      return v && v !== key ? v : fallback
    } catch {
      return fallback
    }
  }

  return (
    <div
      className={cn(
        'rounded-2xl border border-[hsl(var(--color-primary)/0.2)] bg-[hsl(var(--surface-elevated))] p-5 shadow-sm',
        className,
      )}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-[hsl(var(--color-primary))]" />
          <h3 className="font-bold text-[hsl(var(--fg-primary))]">
            {safeT('firstValue.title', 'راهنمای راه‌اندازی سریع')}
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
                <CheckCircle2 className="size-5 text-[hsl(var(--color-success))]" />
              ) : (
                <Circle className="size-5 text-[hsl(var(--fg-secondary))]" />
              )}
              <div>
                <p
                  className={cn(
                    'text-sm font-semibold text-[hsl(var(--fg-primary))]',
                    item.completed && 'line-through',
                  )}
                >
                  {safeT(item.titleKey, item.id)}
                </p>
              </div>
            </div>
            {!item.completed && (
              <ArrowRight className="size-4 text-[hsl(var(--color-primary))] ms-2" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
})
