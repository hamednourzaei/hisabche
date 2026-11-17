'use client'

// ============================================
// packages/ui/src/hooks/use-terminology.ts
//
// W1 — Single UI terminology resolver.
// Resolution chain (16 Nov 2026):
//   1. the trade's own word — DNA trade namespace / explicit presentation vocabulary,
//      then the trade profile's nouns (`applyProfileVocabulary`, one vocabulary);
//   2. the label the screen ALREADY shows (`fallback`) — a trade without its own word
//      keeps today's text exactly («کالا» stays «کالا», never «آیتم / خدمت»);
//   3. the neutral generic word, only when the screen gave no label of its own.
// Unknown / UNRESOLVED businesses NEVER inherit retail wording.
// ============================================

import { useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useOperationalProfile } from '@hisabche/api'
import {
  GENERIC_TERMINOLOGY,
  applyProfileVocabulary,
  isSpecificTerm,
  resolveTerminologyProfile,
  type TerminologyProfile,
} from '@hisabche/validation'
import { useBusinessProfile } from './use-business-profile'

export type TerminologySlot = keyof TerminologyProfile

export interface TerminologyContext {
  readonly profile: TerminologyProfile
  /** True when the workspace has an unresolved axis and must keep neutral generic copy. */
  readonly isUnresolved: boolean
  /** The trade's word for a slot; else `fallback` (the screen's current label); else the generic word. */
  readonly term: (slot: TerminologySlot, fallback?: string) => string
  /**
   * The trade's OWN word for a slot, or null when the trade has none. A screen that builds a
   * sentence around the noun uses its `{party}` / `{item}` message only when this is not null,
   * and keeps its existing sentence otherwise — so a trade without vocabulary sees no change at all.
   */
  readonly specific: (slot: TerminologySlot) => string | null
}

export function useTerminology(): TerminologyContext {
  const t = useTranslations()
  const operational = useOperationalProfile().data
  const { profile: businessProfile } = useBusinessProfile()

  const dna = operational?.dna ?? null
  const isUnresolved = Boolean(
    !dna || dna.offering.includes('UNRESOLVED') || dna.inventory.includes('UNRESOLVED'),
  )

  const resolved = useMemo<TerminologyProfile>(() => {
    const fromDna = dna
      ? resolveTerminologyProfile(dna, businessProfile.primary)
      : GENERIC_TERMINOLOGY
    // Only a STATED trade lends its nouns; an unknown business stays neutral.
    return businessProfile.primary
      ? applyProfileVocabulary(fromDna, businessProfile.vocabulary)
      : fromDna
  }, [dna, businessProfile])

  const translate = useCallback(
    (key: string): string | null => {
      try {
        const value = t(key as Parameters<typeof t>[0])
        return value && value !== key ? value : null
      } catch {
        return null
      }
    },
    [t],
  )

  const specific = useCallback(
    (slot: TerminologySlot): string | null =>
      isSpecificTerm(resolved, slot) ? translate(String(resolved[slot])) : null,
    [resolved, translate],
  )

  const term = useCallback(
    (slot: TerminologySlot, fallback?: string): string =>
      specific(slot) ?? fallback ?? translate(GENERIC_TERMINOLOGY[slot] ?? '') ?? slot,
    [specific, translate],
  )

  return useMemo(
    () => ({ profile: resolved, isUnresolved, term, specific }),
    [resolved, isUnresolved, term, specific],
  )
}
