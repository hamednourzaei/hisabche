// ============================================
// packages/ui/src/components/ui/guide/interactive-guide.tsx
// Persistent, Non-Blocking, Interactive Step Guide
// ============================================

'use client'

import React, { useMemo, useCallback } from 'react'
import { Sparkles, X, ChevronRight, Check } from 'lucide-react'
import { useGuideStore } from '@hisabche/store'
import { GUIDE_CATALOG, type GuideStepDefinition } from '@hisabche/ui-contract'
import { Button } from '../button'

export interface InteractiveGuideProps {
  currentRoute: string
  t: (key: string, fallback?: string) => string
}

export function InteractiveGuide({ currentRoute, t }: InteractiveGuideProps) {
  const completedSteps = useGuideStore((s) => s.completedSteps)
  const dismissedForSession = useGuideStore((s) => s.dismissedForSession)
  const markStepSeen = useGuideStore((s) => s.markStepSeen)
  const dismissSession = useGuideStore((s) => s.dismissSession)

  // Normalize route string (remove leading / and locale)
  const cleanRoute = useMemo(() => {
    return (
      currentRoute
        .replace(/^\/(fa|af|en)(?=\/|$)/, '')
        .replace(/^\//, '')
        .split('/')[0] || 'dashboard'
    )
  }, [currentRoute])

  const routeSteps = useMemo(() => {
    return GUIDE_CATALOG[cleanRoute] || []
  }, [cleanRoute])

  // Active step is the earliest unseen step in this route
  const currentStep = useMemo<GuideStepDefinition | null>(() => {
    if (dismissedForSession || routeSteps.length === 0) return null
    return routeSteps.find((step) => !completedSteps[step.id]?.seen) ?? null
  }, [dismissedForSession, routeSteps, completedSteps])

  const totalSteps = routeSteps.length
  const currentStepIndex = currentStep
    ? routeSteps.findIndex((s) => s.id === currentStep.id) + 1
    : 0

  const handleNext = useCallback(() => {
    if (!currentStep) return
    markStepSeen(currentStep.id, cleanRoute)
  }, [currentStep, markStepSeen, cleanRoute])

  if (!currentStep) return null

  return (
    <div
      role="region"
      aria-label="راهنمای تعاملی"
      className="fixed bottom-6 end-6 z-50 max-w-sm rounded-xl border border-primary/30 bg-neutral-900/95 p-4 text-neutral-100 shadow-2xl backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-primary">
          <Sparkles className="h-5 w-5 animate-pulse text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            {t('guide.badge', 'راهنمای هوشمند')} ({currentStepIndex}/{totalSteps})
          </span>
        </div>
        <button
          onClick={dismissSession}
          aria-label={t('common.close', 'بستن')}
          className="rounded p-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-2 space-y-1">
        <h4 className="text-sm font-bold text-neutral-50">{t(currentStep.titleKey, 'راهنما')}</h4>
        <p className="text-xs leading-relaxed text-neutral-300">
          {t(currentStep.descriptionKey, 'توضیحات راهنما برای این بخش')}
        </p>
      </div>

      <div className="mt-4 flex items-center justify-between pt-2 border-t border-neutral-800">
        <span className="text-[11px] text-neutral-400">
          {t('guide.persistentTip', 'پیشرفت شما خودکار ذخیره می‌شود')}
        </span>
        <Button
          size="sm"
          variant="default"
          onClick={handleNext}
          className="flex items-center gap-1.5 text-xs font-medium"
        >
          {currentStepIndex === totalSteps ? (
            <>
              <span>{t('guide.finish', 'متوجه شدم')}</span>
              <Check className="h-3.5 w-3.5" />
            </>
          ) : (
            <>
              <span>{t('guide.next', 'گام بعدی')}</span>
              <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
