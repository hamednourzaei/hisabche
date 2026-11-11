'use client'

// ============================================
// packages/ui/src/hooks/use-terminology.ts
//
// W1 — Single UI terminology resolver.
// Resolution chain: DNA / Presentation Profile → Industry Profile → Generic → Locale default.
// Unknown / UNRESOLVED businesses NEVER inherit retail wording.
// ============================================

import { useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useOperationalProfile } from '@hisabche/api'
import {
  GENERIC_TERMINOLOGY,
  resolveTerminologyProfile,
  type TerminologyProfile,
} from '@hisabche/validation'
import { useBusinessProfile } from './use-business-profile'

export type TerminologySlot = keyof TerminologyProfile

export interface TerminologyContext {
  readonly profile: TerminologyProfile
  /** True when the workspace has an unresolved axis and must keep neutral generic copy. */
  readonly isUnresolved: boolean
  /** Translate a canonical terminology slot safely with fallback to generic then slot fallback. */
  readonly term: (slot: TerminologySlot, fallback?: string) => string
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
    if (!dna) {
      if (businessProfile.primary && businessProfile.vocabulary.productKey) {
        return {
          ...GENERIC_TERMINOLOGY,
          itemLabelKey: businessProfile.vocabulary.productKey,
        }
      }
      return GENERIC_TERMINOLOGY
    }
    return resolveTerminologyProfile(dna, businessProfile.primary)
  }, [dna, businessProfile])

  const term = useCallback(
    (slot: TerminologySlot, fallback?: string): string => {
      const primaryKey = resolved[slot]
      const genericKey = GENERIC_TERMINOLOGY[slot]
      const candidates = [primaryKey, genericKey].filter(
        (key): key is string => typeof key === 'string' && key.length > 0,
      )
      for (const key of candidates) {
        try {
          const value = t(key as Parameters<typeof t>[0])
          if (value && value !== key) return value
        } catch {
          // Next key in fallback chain
        }
      }
      return fallback ?? genericKey ?? slot
    },
    [resolved, t],
  )

  return useMemo(() => ({ profile: resolved, isUnresolved, term }), [resolved, isUnresolved, term])
}
