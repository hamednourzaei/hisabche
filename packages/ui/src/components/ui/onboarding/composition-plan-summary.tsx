'use client'

// ============================================
// The composed plan under the operating questions (onboarding + settings).
//
// 12 Nov 2026 (owner's screenshot): the screen showed raw keys — `capabilities.x.label`,
// `…limitation.0`, `…questions.x.title`, `…gaps.REGULATED_DOMAIN_COMPLIANCE`, `nav.overview`.
// It built keys the catalogs never had instead of reading what the registry names:
//   label       → CAPABILITIES[key].labelKey
//   limitation  → capabilities.limitations.<CODE> (the code the registry records)
//   question    → onboarding.operating.questions.<q> (a string, no `.title`)
//   gap         → setupGapMessageKey(gap)
//   menu        → the real primary menu minus what this DNA hides (suggestedHiddenMenuPaths),
//                 not a fixed list of five group names
// «Open questions» are only those still unanswered.
// ============================================

import { useMemo } from 'react'
import {
  CAPABILITIES,
  FEATURE_PACKS,
  composeBusinessSolution,
  inferOperationalDna,
  packsForPlan,
  primaryIndustryKeyOf,
  setupGapMessageKey,
  setupGapsOf,
  type CapabilityKey,
  type CompositionPlan,
  type OperatingAnswers,
} from '@hisabche/validation'
import { suggestedHiddenMenuPaths } from '../../../lib/menu/dna-menu-suggestion'
import { PRIMARY_ITEMS } from '../../../lib/menu/nav-items'

/** A question is open until it has a real answer — «unknown» is not one. */
function isOpen(answer: unknown): boolean {
  return answer === undefined || answer === null || answer === 'unknown'
}

function limitationsText(capKey: CapabilityKey, t: (key: string) => string): string {
  return (CAPABILITIES[capKey]?.limitations ?? [])
    .map((code) => t(`capabilities.limitations.${code}`))
    .join(' · ')
}

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
  const menuItems = useMemo(() => {
    const hidden = new Set(suggestedHiddenMenuPaths(dna))
    return PRIMARY_ITEMS.filter((item) => !hidden.has(item.path))
  }, [dna])
  const openQuestions = composition.nextQuestions.filter((q) =>
    isOpen((answers as Record<string, unknown>)[q]),
  )
  const suggestedPacks = useMemo(() => packsForPlan(composition), [composition])
  const labelOf = (capKey: CapabilityKey) => t(CAPABILITIES[capKey]?.labelKey ?? capKey)
  const none = (
    <li className="text-[hsl(var(--fg-tertiary))]">{t('onboarding.composition.none')}</li>
  )

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
            {available.length === 0
              ? none
              : available.map((capKey: CapabilityKey) => <li key={capKey}>{labelOf(capKey)}</li>)}
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
            {partial.length === 0 ? none : null}
            {partial.map((capKey: CapabilityKey) => {
              const limText = limitationsText(capKey, t)
              return (
                <li key={capKey}>
                  <span className="font-medium text-[hsl(var(--fg-primary))]">
                    {labelOf(capKey)}
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
            {planned.length === 0 ? none : null}
            {planned.map((capKey: CapabilityKey) => {
              const limText = limitationsText(capKey, t)
              return (
                <li key={capKey}>
                  <span>{labelOf(capKey)}</span>
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
          {menuItems.map((item) => (
            <span
              key={item.id}
              data-composition-menu-item={item.id}
              className="rounded-lg border border-[hsl(var(--border-default))] px-2 py-0.5 text-xs text-[hsl(var(--fg-primary))]"
            >
              {t(item.labelKey)}
            </span>
          ))}
        </div>
      </div>

      {(openQuestions.length > 0 || gaps.length > 0) && (
        <div data-composition-questions="" className="space-y-1">
          <div className="text-xs font-semibold text-[hsl(var(--fg-secondary))]">
            {t('onboarding.composition.nextQuestionsTitle')}
          </div>
          <ul className="list-disc space-y-0.5 ps-4 text-xs text-[hsl(var(--fg-secondary))]">
            {openQuestions.map((q) => (
              <li key={q}>{t(`onboarding.operating.questions.${q}`)}</li>
            ))}
            {gaps.map((g) => (
              <li key={g}>{t(setupGapMessageKey(g))}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
