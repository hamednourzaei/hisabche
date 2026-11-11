import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ARCHETYPE_PRESETS,
  evaluateFeatureAccess,
  GENERIC_TERMINOLOGY,
  inferOperationalDna,
  operationalDnaSchema,
  resolveCapabilities,
  resolveCapabilityPlan,
  resolveDnaCapabilities,
  resolvePresentationProfile,
  resolveTerminologyProfile,
  type StaffArrangement,
} from '../index'

const ROOT = path.resolve(__dirname, '../../../../')

describe('W1: Terminology & Locale Parity', () => {
  it('resolves specialized trade wording while keeping UNRESOLVED strictly generic', () => {
    const jeweller = inferOperationalDna({
      tradeKey: 'jewellery',
      holdsStock: 'yes',
      hasStaff: 'no',
    })
    const jewellerTerms = resolveTerminologyProfile(jeweller, 'jewellery')
    expect(jewellerTerms.itemLabelKey).toBe('terminology.trades.jewellery.offering')
    expect(jewellerTerms.storageLabelKey).toBe('terminology.trades.jewellery.storageLocation')

    const unresolved = inferOperationalDna({ holdsStock: 'unknown' })
    const unresolvedTerms = resolveTerminologyProfile(unresolved, 'clothing')
    expect(unresolvedTerms.itemLabelKey).toBe(GENERIC_TERMINOLOGY.itemLabelKey)
    expect(unresolvedTerms.storageLabelKey).toBe(GENERIC_TERMINOLOGY.storageLabelKey)
  })

  it('has complete parity across fa, af, and en for all new W1/W2/W4 i18n keys', () => {
    const load = (lang: string) =>
      JSON.parse(
        fs.readFileSync(path.join(ROOT, `packages/i18n/messages/${lang}/common.json`), 'utf8'),
      ) as Record<string, unknown>

    const getAt = (obj: Record<string, unknown>, dotKey: string): unknown =>
      dotKey
        .split('.')
        .reduce<unknown>(
          (acc, k) =>
            acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined,
          obj,
        )

    const fa = load('fa')
    const af = load('af')
    const en = load('en')

    const keys = [
      ...Object.values(GENERIC_TERMINOLOGY).filter((v): v is string => typeof v === 'string'),
      'terminology.generic.noDocuments',
      'terminology.generic.noStock',
      'onboarding.operating.questions.staffArrangement',
      'onboarding.operating.answers.fixed_salary',
      'onboarding.operating.answers.hourly',
      'onboarding.operating.answers.commission',
      'onboarding.operating.answers.shift',
      'onboarding.operating.answers.mixed',
      'dashboard.setupGapsPrompt',
      'dashboard.completeSetupAction',
      'dashboard.cards.receivables',
      'dashboard.roles.salonCalendar',
      'dashboard.roles.fxRates',
      'dashboard.roles.repairAssigned',
    ]

    for (const key of keys) {
      expect(typeof getAt(fa, key), `fa missing ${key}`).toBe('string')
      expect(typeof getAt(af, key), `af missing ${key}`).toBe('string')
      expect(typeof getAt(en, key), `en missing ${key}`).toBe('string')
    }
  })
})

describe('W2: Workforce Arrangements, Presentation Profile & Single Resolver', () => {
  it('supports every workforce arrangement without inferring pay from headcount', () => {
    const expectations: Array<[StaffArrangement, string]> = [
      ['solo', 'SOLO_OWNER'],
      ['fixed_salary', 'SALARIED_STAFF'],
      ['hourly', 'HOURLY_STAFF'],
      ['commission', 'COMMISSION_PROVIDERS'],
      ['shift', 'SHIFT_BASED_STAFF'],
      ['mixed', 'MIXED_WORKFORCE'],
      ['unknown', 'UNRESOLVED'],
    ]

    for (const [arrangement, expectedModel] of expectations) {
      const dna = inferOperationalDna({
        tradeKey: 'beautySalon',
        hasStaff: arrangement === 'solo' ? 'no' : 'yes',
        staffArrangement: arrangement,
      })
      expect(dna.workforce).toEqual([expectedModel])
    }
  })

  it('keeps NAIL_TECH_BEAUTY solo while supporting SALON_MULTI_STAFF for a 6-7 person salon', () => {
    expect(ARCHETYPE_PRESETS.NAIL_TECH_BEAUTY?.workforce).toEqual(['SOLO_OWNER'])
    const salonPreset = ARCHETYPE_PRESETS.SALON_MULTI_STAFF!
    expect(operationalDnaSchema.safeParse(salonPreset).success).toBe(true)
    const resolved = resolveDnaCapabilities(salonPreset)
    expect(resolved.activeModules).toEqual(
      expect.arrayContaining(['appointments', 'consumables', 'team', 'payroll']),
    )
    expect(resolved.isSetupComplete).toBe(true)
  })

  it('delegates DNA resolution to the single resolveCapabilityPlan engine', () => {
    const dna = inferOperationalDna({
      holdsStock: 'yes',
      tracksSerials: 'yes',
      hasStaff: 'yes',
      staffArrangement: 'commission',
    })
    const viaDna = resolveDnaCapabilities(dna)
    const direct = resolveCapabilityPlan({
      offering: dna.offering,
      intake: dna.intake,
      inventory: dna.inventory,
      settlement: dna.settlement,
      workforce: dna.workforce,
      topology: dna.topology,
      unitTracking: dna.unitTracking,
    })
    expect(viaDna.capabilities).toEqual(direct.capabilities)
    expect(viaDna.activeModules).toEqual(direct.activeModules)
  })

  it('parses declarative presentation profile safely without code execution', () => {
    const base = ARCHETYPE_PRESETS.RETAIL_STORE!
    const withPresentation = operationalDnaSchema.parse({
      ...base,
      presentation: {
        navigation: { hiddenPaths: ['/manufacturing'], pinnedPaths: ['/invoices'] },
        dashboard: { partOrder: ['workQueue', 'kpis'] },
      },
    })
    const pres = resolvePresentationProfile(withPresentation)
    expect(pres.navigation.hiddenPaths).toEqual(['/manufacturing'])
    expect(pres.dashboard.partOrder).toEqual(['workQueue', 'kpis'])
  })
})

describe('W3: Capability vs Entitlement vs Permission Independence', () => {
  it('evaluates all three axes independently and never promotes planned/partial capabilities', () => {
    const enabled = resolveCapabilities(['variants', 'serialized_items']).capabilities

    // 1. Business has variants, plan ok, permission ok -> allowed (honestly marked partial)
    const ok = evaluateFeatureAccess({
      enabledCapabilities: enabled,
      capabilityKey: 'variants',
      entitlementKind: 'AVAILABLE',
      grantedPermissions: ['product.write'],
      requiredPermission: 'product.write',
    })
    expect(ok.allowed).toBe(true)
    expect(ok.partial).toBe(true)
    expect(ok.limitations).toContain('COST_LAYERS_ARE_PRODUCT_KEYED')

    // 2. Plan & permission ok, but planned capability requested -> blocked by capability
    const planned = evaluateFeatureAccess({
      enabledCapabilities: enabled,
      capabilityKey: 'recipe_bom',
      entitlementKind: 'AVAILABLE',
      grantedPermissions: ['product.write'],
      requiredPermission: 'product.write',
    })
    expect(planned.allowed).toBe(false)
    expect(planned.blockedBy).toBe('capability')

    // 3. Capability & permission ok, entitlement expired -> blocked by entitlement
    const expired = evaluateFeatureAccess({
      enabledCapabilities: enabled,
      capabilityKey: 'variants',
      entitlementKind: 'EXPIRED',
      grantedPermissions: ['product.write'],
      requiredPermission: 'product.write',
    })
    expect(expired.allowed).toBe(false)
    expect(expired.blockedBy).toBe('entitlement')

    // 4. Capability & plan ok, salon reception lacks payroll.write -> blocked by permission
    const denied = evaluateFeatureAccess({
      enabledCapabilities: enabled,
      capabilityKey: 'serialized_items',
      entitlementKind: 'AVAILABLE',
      grantedPermissions: ['invoice.create', 'customer.read'],
      requiredPermission: 'payroll.write',
    })
    expect(denied.allowed).toBe(false)
    expect(denied.blockedBy).toBe('permission')
  })
})
