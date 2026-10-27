// ============================================
// The derived industry profile — pure rules and evidence.
//
// These are the rules the whole personalisation rests on. They are tested as
// data (no React, no network), so the same answers must hold on the server,
// the local engine and both clients.
// ============================================

import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  AVAILABLE_CAPABILITIES,
  CAPABILITIES,
  CAPABILITY_KEYS,
  type CapabilityKey,
} from '../schemas/business-capabilities'
import {
  DASHBOARD_PART_IDS,
  INDUSTRY_KEYS,
  LEGACY_INDUSTRY_KEYS,
  PROFILES,
  canonicalIndustryTypes,
  resolveBusinessProfile,
  operatingCharacteristicsSchema,
  DEFAULT_OPERATING_CHARACTERISTICS,
} from '../schemas/industry-profiles'
import { INVOICE_UNIT_CHOICES } from '../schemas/measurement.domain'

const REPO_ROOT = resolve(__dirname, '../../../..')

describe('industry registry', () => {
  it('every canonical key has a complete profile', () => {
    for (const key of INDUSTRY_KEYS) {
      const profile = PROFILES[key]
      expect(profile.key, key).toBe(key)
      expect(['specialized', 'generic'], key).toContain(profile.kind)
      expect(profile.dashboard.length, key).toBe(DASHBOARD_PART_IDS.length)
      expect(new Set(profile.dashboard).size, key).toBe(profile.dashboard.length)
      for (const part of profile.dashboard) expect(DASHBOARD_PART_IDS, key).toContain(part)
      expect(INVOICE_UNIT_CHOICES, key).toContain(profile.productDefaults.unit)
      for (const capability of profile.capabilities) {
        expect(CAPABILITY_KEYS, `${key} → ${capability}`).toContain(capability)
      }
    }
  })

  it('only available capabilities are attached to a profile', () => {
    for (const key of INDUSTRY_KEYS) {
      for (const capability of PROFILES[key].capabilities) {
        expect(CAPABILITIES[capability].status, `${key} → ${capability}`).toBe('available')
      }
    }
  })

  it('every available capability resolves its evidence on disk', () => {
    for (const key of AVAILABLE_CAPABILITIES) {
      const definition = CAPABILITIES[key]
      expect(definition.evidence.sources.length, key).toBeGreaterThan(0)
      expect(definition.evidence.tests.length, key).toBeGreaterThan(0)
      for (const path of [...definition.evidence.sources, ...definition.evidence.tests]) {
        expect(existsSync(resolve(REPO_ROOT, path)), `${key}: ${path}`).toBe(true)
      }
    }
  })

  it('a planned capability carries no evidence and no profile', () => {
    for (const key of CAPABILITY_KEYS) {
      if (CAPABILITIES[key].status !== 'planned') continue
      expect(CAPABILITIES[key].evidence.sources, key).toEqual([])
      expect(CAPABILITIES[key].evidence.tests, key).toEqual([])
      for (const industry of INDUSTRY_KEYS) {
        expect(PROFILES[industry].capabilities, `${industry} → ${key}`).not.toContain(key)
      }
    }
  })
})

describe('canonicalIndustryTypes', () => {
  it('accepts the array the profile row stores and the comma string the wizard drafts', () => {
    expect(canonicalIndustryTypes(['jewellery', 'retail']).known).toEqual(['retail', 'jewellery'])
    expect(canonicalIndustryTypes('jewellery, retail').known).toEqual(['retail', 'jewellery'])
  })

  it('trims, folds case, drops empties and de-duplicates', () => {
    const result = canonicalIndustryTypes(' Jewellery , , JEWELLERY, retail ')
    expect(result.known).toEqual(['retail', 'jewellery'])
    expect(result.unknown).toEqual([])
  })

  it('reports legacy and unknown values instead of misclassifying them', () => {
    const result = canonicalIndustryTypes(['service', 'spaceship', 'jewellery'])
    expect(result.known).toEqual(['jewellery'])
    expect(result.legacy).toEqual(['service'])
    expect(result.unknown).toEqual(['spaceship'])
  })

  it('never crashes on empty or absent input', () => {
    expect(canonicalIndustryTypes(undefined).known).toEqual([])
    expect(canonicalIndustryTypes(null).known).toEqual([])
    expect(canonicalIndustryTypes('').known).toEqual([])
  })
})

describe('resolveBusinessProfile', () => {
  it('empty input is the generic profile', () => {
    const profile = resolveBusinessProfile([])
    expect(profile.primary).toBeNull()
    expect(profile.isGeneric).toBe(true)
    expect(profile.capabilities).toEqual([])
    expect(profile.unknownTypes).toEqual([])
  })

  it('unknown input is generic and reported, never guessed', () => {
    const profile = resolveBusinessProfile(['spaceship'])
    expect(profile.primary).toBeNull()
    expect(profile.unknownTypes).toEqual(['spaceship'])
    expect(profile.capabilities).toEqual([])
  })

  it('legacy input is recognised but stays generic', () => {
    const profile = resolveBusinessProfile(['service'])
    expect(profile.legacyTypes).toEqual(['service'])
    expect(profile.primary).toBeNull()
    expect(profile.isGeneric).toBe(true)
  })

  it('primary ignores insertion order and follows registry order', () => {
    expect(resolveBusinessProfile(['jewellery', 'grocery']).primary).toBe('grocery')
    expect(resolveBusinessProfile(['grocery', 'jewellery']).primary).toBe('grocery')
    expect(resolveBusinessProfile('jewellery,retail').primary).toBe('jewellery')
  })

  it('honours an explicit primary when the caller has one', () => {
    const profile = resolveBusinessProfile(['grocery', 'jewellery'], 'jewellery')
    expect(profile.primary).toBe('jewellery')
    expect(profile.productDefaults.unit).toBe('gram')
  })

  it('capabilities union is permutation invariant, idempotent and monotonic', () => {
    const base = ['jewellery', 'fabric']
    const union = resolveBusinessProfile(base).capabilities
    expect(resolveBusinessProfile([...base].reverse()).capabilities).toEqual(union)
    expect(resolveBusinessProfile([...base, ...base]).capabilities).toEqual(union)
    const added = resolveBusinessProfile([...base, 'grocery']).capabilities
    for (const capability of union) expect(added).toContain(capability)
  })

  it('is deterministic for the same input', () => {
    const a = resolveBusinessProfile(['pharmacy', 'jewellery'])
    const b = resolveBusinessProfile(['jewellery', 'pharmacy'])
    expect(a).toEqual(b)
  })

  it('multi-industry dashboard keeps every existing part exactly once', () => {
    const profile = resolveBusinessProfile(['jewellery', 'manufacturing'])
    expect([...profile.dashboard].sort()).toEqual([...DASHBOARD_PART_IDS].sort())
  })

  it('unions the extra invoice columns without duplicates', () => {
    const profile = resolveBusinessProfile(['jewellery', 'jewellery'])
    expect(profile.invoiceDefaults.extraVisibleColumns).toEqual(['weightGrams'])
  })

  it('a specialised profile only claims capabilities that are available', () => {
    const jewellery = resolveBusinessProfile(['jewellery'])
    expect(jewellery.capabilities).toContain<CapabilityKey>('measurement')
    expect(jewellery.capabilities).toContain<CapabilityKey>('weight_pricing')
    expect(jewellery.capabilities).not.toContain<CapabilityKey>('gold_purity')
  })

  it('the legacy list is not part of the canonical keys', () => {
    for (const legacy of LEGACY_INDUSTRY_KEYS) {
      expect(INDUSTRY_KEYS as readonly string[]).not.toContain(legacy)
    }
  })

  it('operating characteristics schema parses valid choices and rejects unknown or contradictory keys', () => {
    const valid = operatingCharacteristicsSchema.parse({
      holdsStock: 'yes',
      locations: 'single',
      producesGoods: 'no',
      sellsOnCredit: 'yes',
      hasPointOfSale: 'yes',
      hasStaff: 'yes',
    })
    expect(valid.holdsStock).toBe('yes')

    // Defaults when empty
    const def = operatingCharacteristicsSchema.parse({})
    expect(def).toEqual(DEFAULT_OPERATING_CHARACTERISTICS)

    // Rejects unknown keys
    expect(() => operatingCharacteristicsSchema.parse({ extraField: 'invalid' })).toThrow()

    // Rejects contradictory combination: producing goods without stock
    expect(() =>
      operatingCharacteristicsSchema.parse({
        holdsStock: 'no',
        producesGoods: 'yes',
      }),
    ).toThrow(/CANNOT_PRODUCE_WITHOUT_STOCK/)
  })

  it('resolver derives policy, recommended modules, and inventory relevance from characteristics', () => {
    // Pure service business with holdsStock: 'no'
    const serviceProfile = resolveBusinessProfile(['other'], null, {
      holdsStock: 'no',
      hasPointOfSale: 'no',
      hasStaff: 'yes',
    })
    expect(serviceProfile.inventoryRelevant).toBe(false)
    expect(serviceProfile.recommendedModules).not.toContain('stock')
    expect(serviceProfile.recommendedModules).toContain('coworkers')
    expect(serviceProfile.notes).toContain('industry.supportNote.generic')

    // Manufacturing retail with POS
    const retailMfg = resolveBusinessProfile(['jewellery'], null, {
      holdsStock: 'yes',
      producesGoods: 'yes',
      hasPointOfSale: 'yes',
    })
    expect(retailMfg.inventoryRelevant).toBe(true)
    expect(retailMfg.recommendedModules).toContain('stock')
    expect(retailMfg.recommendedModules).toContain('till')
    expect(retailMfg.recommendedModules).toContain('production')

    // Determinism test with characteristics
    const p1 = resolveBusinessProfile(['jewellery', 'retail'], null, { holdsStock: 'yes' })
    const p2 = resolveBusinessProfile(['retail', 'jewellery'], null, { holdsStock: 'yes' })
    expect(p1).toEqual(p2)
  })
})
