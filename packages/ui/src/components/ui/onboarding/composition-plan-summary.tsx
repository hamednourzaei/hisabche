'use client'

import { useMemo } from 'react'
import {
  CAPABILITIES,
  FEATURE_PACKS,
  composeBusinessSolution,
  inferOperationalDna,
  packsForPlan,
  primaryIndustryKeyOf,
  setupGapsOf,
  type CapabilityKey,
  type CompositionPlan,
  type OperatingAnswers,
} from '@hisabche/validation'

export interface CompositionPlanSummaryProps {
  answers: OperatingAnswers
  businessType?: string | null | undefined
  composition?: CompositionPlan | null | undefined
  t: (key: string, fallback?: string) => string
}

export function CompositionPlanSummary({
  answers,
  businessType,
  composition: precomputed,
  t,
}: CompositionPlanSummaryProps) {
  const tradeKey = primaryIndustryKeyOf(businessType ?? undefined) ?? undefined

  const { dna, composition } = useMemo(() => {
    const inferred = inferOperationalDna({ tradeKey, ...answers })
    return {
      dna: inferred,
      composition: precomputed ?? composeBusinessSolution(inferred),
    }
  }, [tradeKey, answers, precomputed])

  const gaps = useMemo(() => setupGapsOf(dna), [dna])
  const activeProblems = composition.problems.filter((p) => p.status === 'applies')
  const statusMap = new Map<CapabilityKey, string>(
    composition.plan.statuses.map((s) => [s.capability, s.status]),
  )
  for (const cap of composition.plan.capabilities.capabilities) {
    if (!statusMap.has(cap)) {
      const st = CAPABILITIES[cap]?.status
      if (st) statusMap.set(cap, st)
    }
  }
  const available = Array.from(statusMap.entries())
    .filter(([, st]) => st === 'available')
    .map(([cap]) => cap)
  const partial = Array.from(statusMap.entries())
    .filter(([, st]) => st === 'partial')
    .map(([cap]) => cap)
  const planned = Array.from(statusMap.entries())
    .filter(([, st]) => st === 'planned' || st === 'unsupported')
    .map(([cap]) => cap)
  const menuGroups =
    composition.presentation.navigation.groupOrder.length > 0
      ? composition.presentation.navigation.groupOrder
      : ['overview', 'sell', 'money', 'team', 'settings']
  const suggestedPacks = useMemo(() => packsForPlan(composition), [composition])

  return (
    <section
      data-composition-plan=""
      className="mt-4 space-y-3 rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4 text-start"
    >
      <div className="space-y-1">
        <h3 className="text-sm font-bold text-[hsl(var(--fg-primary))]">
          {t('onboarding.composition.title')}
        </h3>
        <p className="text-xs text-[hsl(var(--fg-secondary))]">
          {t('onboarding.composition.subtitle')}
        </p>
      </div>

      {activeProblems.length > 0 && (
        <div data-composition-problems="" className="space-y-1">
          <div className="text-xs font-semibold text-[hsl(var(--fg-secondary))]">
            {t('onboarding.composition.problemsTitle')}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {activeProblems.map((item) => (
              <span
                key={item.problem}
                className="rounded-full bg-[hsl(var(--surface-muted))] px-2.5 py-1 text-xs text-[hsl(var(--fg-primary))]"
              >
                {t(`onboarding.composition.problems.${item.problem}`)}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div
          data-composition-available=""
          className="rounded-xl border border-[hsl(var(--border-default))] p-3"
        >
          <div className="mb-1.5 text-xs font-semibold text-[hsl(var(--color-primary))]">
            {t('onboarding.composition.availableTitle')} ({available.length})
          </div>
          <ul className="space-y-1 text-xs text-[hsl(var(--fg-primary))]">
            {available.map((capKey: CapabilityKey) => (
              <li key={capKey}>{t(`capabilities.${capKey}.label`)}</li>
            ))}
          </ul>
        </div>

        <div
          data-composition-partial=""
          className="rounded-xl border border-[hsl(var(--border-default))] p-3"
        >
          <div className="mb-1.5 text-xs font-semibold text-[hsl(var(--fg-primary))]">
            {t('onboarding.composition.partialTitle')} ({partial.length})
          </div>
          <ul className="space-y-1.5 text-xs text-[hsl(var(--fg-secondary))]">
            {partial.map((capKey: CapabilityKey) => {
              const def = CAPABILITIES[capKey]
              const limText = def?.limitations
                .map((_, idx: number) => t(`capabilities.${capKey}.limitation.${idx}`))
                .filter(Boolean)
                .join(' · ')
              return (
                <li key={capKey}>
                  <span className="font-medium text-[hsl(var(--fg-primary))]">
                    {t(`capabilities.${capKey}.label`)}
                  </span>
                  {limText ? <p className="text-[11px]">{limText}</p> : null}
                </li>
              )
            })}
          </ul>
        </div>

        <div
          data-composition-planned=""
          className="rounded-xl border border-[hsl(var(--border-default))] p-3"
        >
          <div className="mb-1.5 text-xs font-semibold text-[hsl(var(--fg-tertiary))]">
            {t('onboarding.composition.plannedTitle')} ({planned.length})
          </div>
          <ul className="space-y-1.5 text-xs text-[hsl(var(--fg-tertiary))]">
            {planned.map((capKey: CapabilityKey) => {
              const def = CAPABILITIES[capKey]
              const limText = def?.limitations
                .map((_, idx: number) => t(`capabilities.${capKey}.limitation.${idx}`))
                .filter(Boolean)
                .join(' · ')
              return (
                <li key={capKey}>
                  <span>{t(`capabilities.${capKey}.label`)}</span>
                  {limText ? <p className="text-[11px]">{limText}</p> : null}
                </li>
              )
            })}
          </ul>
        </div>
      </div>

      <div data-composition-packs="" className="space-y-1">
        <div className="text-xs font-semibold text-[hsl(var(--fg-secondary))]">
          {t('packs.onboarding.title')}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {suggestedPacks.map((packId) => (
            <span
              key={packId}
              data-composition-pack={packId}
              className="rounded-lg border border-[hsl(var(--border-default))] px-2 py-0.5 text-xs text-[hsl(var(--fg-primary))]"
            >
              {t(`packs.${packId}.label`)} ({FEATURE_PACKS[packId].budgetKb} KB)
            </span>
          ))}
        </div>
      </div>

      <div data-composition-menu="" className="space-y-1">
        <div className="text-xs font-semibold text-[hsl(var(--fg-secondary))]">
          {t('onboarding.composition.menuTitle')}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {menuGroups.map((groupId: string) => (
            <span
              key={groupId}
              data-composition-menu-item={groupId}
              className="rounded-lg border border-[hsl(var(--border-default))] px-2 py-0.5 text-xs text-[hsl(var(--fg-primary))]"
            >
              {t(`nav.${groupId}`)}
            </span>
          ))}
        </div>
      </div>

      {(composition.nextQuestions.length > 0 || gaps.length > 0) && (
        <div data-composition-questions="" className="space-y-1">
          <div className="text-xs font-semibold text-[hsl(var(--fg-secondary))]">
            {t('onboarding.composition.nextQuestionsTitle')}
          </div>
          <ul className="list-disc space-y-0.5 ps-4 text-xs text-[hsl(var(--fg-secondary))]">
            {composition.nextQuestions.map((q) => (
              <li key={q}>{t(`onboarding.operating.questions.${q}.title`)}</li>
            ))}
            {gaps.map((g) => (
              <li key={g}>{t(`onboarding.operating.gaps.${g}`)}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
