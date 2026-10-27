// ============================================
// The onboarding catalogue and the profile registry are the SAME list.
//
// Labels live in `@hisabche/ui-contract` (which cannot import validation
// without a new dependency edge), so this guard is what keeps the two from
// drifting. Add a trade to one side only and this test goes red — the profile
// for it would otherwise be unreachable, or a selectable trade would fall into
// the generic fallback without anyone noticing.
// ============================================

import { describe, expect, it } from 'vitest'
import { BUSINESS_MODELS, BUSINESS_TYPES, BUSINESS_TYPE_OTHER } from '@hisabche/ui-contract'
import { INDUSTRY_KEYS } from '@hisabche/validation'

describe('industry profile registry ↔ onboarding catalogue', () => {
  it('has exactly the same keys on both sides', () => {
    const catalogue = [...BUSINESS_MODELS, ...BUSINESS_TYPES, BUSINESS_TYPE_OTHER]
      .map((option) => option.id)
      .sort()
    expect([...INDUSTRY_KEYS].sort()).toEqual(catalogue)
  })

  it('has no duplicate ids in the catalogue', () => {
    const catalogue = [...BUSINESS_MODELS, ...BUSINESS_TYPES, BUSINESS_TYPE_OTHER].map(
      (option) => option.id,
    )
    expect(new Set(catalogue).size).toBe(catalogue.length)
  })

  it('gives every option a translation key', () => {
    for (const option of [...BUSINESS_MODELS, ...BUSINESS_TYPES, BUSINESS_TYPE_OTHER]) {
      expect(option.labelKey, option.id).toMatch(/^(businessType|onboarding)\./)
    }
  })
})
