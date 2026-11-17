// ============================================
// packages/validation/src/__tests__/operational-dna.test.ts
//
// V54.0 Phase 5.2 & 5.3 Tests
// Validates 8-axis Operational DNA, Archetype Presets & Inference Resolver
// ============================================

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ARCHETYPE_PRESETS,
  GENERIC_TERMINOLOGY,
  TERMINOLOGY_TRADE_NAMESPACES,
  effectiveDnaAxes,
  operationalDnaSchema,
  operatingQuestionsFor,
  resolveDnaCapabilities,
  resolveTerminologyProfile,
  inferOperationalDna,
  setupGapsOf,
} from '../schemas/operational-dna'

describe('Operational DNA (8 Axes) & Resolver', () => {
  it('validates canonical archetype presets against operationalDnaSchema', () => {
    for (const [key, preset] of Object.entries(ARCHETYPE_PRESETS)) {
      const parsed = operationalDnaSchema.parse(preset)
      expect(parsed.version).toBe(1)
      expect(parsed.offering.length).toBeGreaterThan(0)
      expect(parsed.archetypeHint).toBe(key)
    }
  })

  it('resolves NAIL_TECH_BEAUTY DNA without checking industry string in financial core', () => {
    const preset = ARCHETYPE_PRESETS.NAIL_TECH_BEAUTY!
    const resolved = resolveDnaCapabilities(preset)

    // Intake: APPOINTMENT_BOOKING + WALK_IN
    expect(resolved.activeModules).toContain('appointments')

    // Settlement: DEPOSIT_PREPAYMENT
    expect(resolved.activeModules).toContain('order_deposits')

    // Inventory: SERVICE_CONSUMABLES + RETAIL_STOCK
    expect(resolved.activeModules).toContain('consumables')
    expect(resolved.activeModules).toContain('inventory')

    // Terminology: client, service, appointment
    expect(resolved.terminology.partyLabelKey).toBe('common.client')
    expect(resolved.terminology.itemLabelKey).toBe('common.service')
  })

  it('resolves LANGUAGE_TEACHER DNA into package_credits and class attendance', () => {
    const preset = ARCHETYPE_PRESETS.LANGUAGE_TEACHER!
    const resolved = resolveDnaCapabilities(preset)

    expect(resolved.activeModules).toContain('attendance')
    expect(resolved.activeModules).toContain('package_credits')
    expect(resolved.activeModules).not.toContain('inventory')
    expect(resolved.terminology.partyLabelKey).toBe('common.student')
  })

  it('resolves SERVICE_REPAIR DNA into job tickets and spare parts', () => {
    const preset = ARCHETYPE_PRESETS.SERVICE_REPAIR!
    const resolved = resolveDnaCapabilities(preset)

    expect(resolved.activeModules).toContain('job_tickets')
    expect(resolved.activeModules).toContain('order_deposits')
    expect(resolved.activeModules).toContain('warehouse')
    expect(resolved.capabilities.capabilities).toContain('auto_fitments')
  })

  it('infers DNA dynamically from operational characteristics instead of trade name alone', () => {
    // 1. A service salon that takes appointments, uses consumables, and explicitly sets hourly pay
    const salonDna = inferOperationalDna({
      takesAppointments: 'yes',
      holdsStock: 'yes',
      hasStaff: 'yes',
      staffArrangement: 'hourly',
    })
    expect(salonDna.offering).toContain('TIME_SERVICE')
    expect(salonDna.intake).toContain('APPOINTMENT_BOOKING')
    expect(salonDna.inventory).toContain('SERVICE_CONSUMABLES')
    expect(salonDna.workforce).toContain('HOURLY_STAFF')
    expect(salonDna.archetypeHint).toBe('SALON_MULTI_STAFF')

    // 1b. Saying hasStaff=yes without compensation model MUST stay UNRESOLVED (no guessed hourly pay)
    const unknownPayDna = inferOperationalDna({
      takesAppointments: 'yes',
      holdsStock: 'yes',
      hasStaff: 'yes',
    })
    expect(unknownPayDna.workforce).toEqual(['UNRESOLVED'])

    // 2. An education center that teaches courses with packages
    const eduDna = inferOperationalDna({
      deliversCoursesOrPackages: 'yes',
      holdsStock: 'no',
    })
    expect(eduDna.offering).toContain('PACKAGE_SESSION')
    expect(eduDna.intake).toContain('CLASS_ATTENDANCE')
    expect(eduDna.inventory).toContain('NONE')
    expect(eduDna.settlement).toContain('PACKAGE_CREDITS')
    expect(eduDna.archetypeHint).toBe('LANGUAGE_TEACHER')

    // 3. A pure generic/unknown service business with NO stock and NO appointments
    const genericDna = inferOperationalDna({
      holdsStock: 'no',
      takesAppointments: 'no',
    })
    expect(genericDna.inventory).toContain('NONE')
    expect(genericDna.intake).toContain('WALK_IN')
    expect(genericDna.archetypeHint).toBe('GENERIC_BUSINESS')
    expect(genericDna.archetypeHint).not.toBe('RETAIL_STORE')
  })
})

// ─── V55 mandatory regressions (mission §15.2) — Unknown is not a guess ────
describe('V55: unknown answers never fabricate a business', () => {
  it('an unknown stock answer never becomes PHYSICAL_GOODS', () => {
    const dna = inferOperationalDna({ holdsStock: 'unknown' })
    expect(dna.offering).not.toContain('PHYSICAL_GOODS')
    expect(dna.offering).toContain('UNRESOLVED')
  })

  it('an unknown stock answer never becomes RETAIL_STOCK', () => {
    const dna = inferOperationalDna({ holdsStock: 'unknown' })
    expect(dna.inventory).not.toContain('RETAIL_STOCK')
    expect(dna.inventory).toContain('UNRESOLVED')
  })

  it('a service business with no inventory never becomes a retail shop', () => {
    const dna = inferOperationalDna({ holdsStock: 'no', hasPointOfSale: 'no' })
    expect(dna.inventory).toEqual(['NONE'])
    expect(dna.offering).toEqual(['DELIVERABLE_SERVICE'])
    expect(dna.archetypeHint).toBe('GENERIC_BUSINESS')
  })

  it('an explicit «no appointments» overrides the trade suggestion', () => {
    const dna = inferOperationalDna({ tradeKey: 'barber', takesAppointments: 'no' })
    expect(dna.intake).not.toContain('APPOINTMENT_BOOKING')
    expect(dna.settlement).not.toContain('DEPOSIT_PREPAYMENT')
  })

  it('an unanswered question keeps the trade suggestion — unknown is not no', () => {
    const dna = inferOperationalDna({ tradeKey: 'barber', takesAppointments: 'unknown' })
    expect(dna.intake).toContain('APPOINTMENT_BOOKING')
  })

  it("an explicit «no stock» overrides a repair trade's spare-parts suggestion", () => {
    const dna = inferOperationalDna({ tradeKey: 'repairs', holdsStock: 'no' })
    expect(dna.inventory).toEqual(['NONE'])
    expect(dna.offering).not.toContain('PHYSICAL_GOODS')
  })

  it('UNRESOLVED DNA activates no inventory, warehouse or products module', () => {
    const resolved = resolveDnaCapabilities(inferOperationalDna({ holdsStock: 'unknown' }))
    expect(resolved.activeModules).not.toContain('inventory')
    expect(resolved.activeModules).not.toContain('warehouse')
    expect(resolved.activeModules).not.toContain('products')
    // Core money modules are never dropped by an unknown answer.
    expect(resolved.activeModules).toEqual(
      expect.arrayContaining(['accounting', 'invoices', 'customers']),
    )
  })

  it('UNRESOLVED parses against the persisted DNA schema (backward compatible)', () => {
    const parsed = operationalDnaSchema.safeParse(inferOperationalDna({ holdsStock: 'unknown' }))
    expect(parsed.success).toBe(true)
  })
})

describe('V60 Slice 2: 15-axis DNA, backward compatibility & adaptive questions', () => {
  it('legacy DNA fixtures without axes 10–15 parse and resolve identically', () => {
    const legacy = { ...ARCHETYPE_PRESETS.RETAIL_STORE }
    const parsed = operationalDnaSchema.parse(legacy)
    expect(parsed.pricingBasis).toBeUndefined()
    const resolved = resolveDnaCapabilities(parsed)
    expect(resolved.activeModules).toEqual(
      expect.arrayContaining([
        'accounting',
        'invoices',
        'customers',
        'products',
        'pos',
        'inventory',
        'warehouse',
      ]),
    )
    expect(resolved.capabilities.capabilities).toContain('multi_unit')
  })

  it('maps each new optional axis to its modules/capabilities and emits setup gaps for UNRESOLVED', () => {
    const weighted = resolveDnaCapabilities(
      operationalDnaSchema.parse({
        ...ARCHETYPE_PRESETS.RETAIL_STORE,
        pricingBasis: ['WEIGHT', 'LENGTH', 'TIERED'],
        assetCustody: 'CUSTOMER_ASSET_IN_CUSTODY',
        executionSite: 'CUSTOMER_SITE',
        recurrence: 'RECURRING_SERVICE',
        approvalDepth: 'MULTI_STEP',
      }),
    )
    expect(weighted.capabilities.capabilities).toEqual(
      expect.arrayContaining([
        'weight_pricing',
        'length_pricing',
        'tiered_pricing',
        'serialized_items',
      ]),
    )
    expect(weighted.activeModules).toEqual(
      expect.arrayContaining(['job_tickets', 'delivery', 'contracts', 'approvals']),
    )

    const missingAxesDna = operationalDnaSchema.parse(ARCHETYPE_PRESETS.RETAIL_STORE)
    expect(effectiveDnaAxes(missingAxesDna).regulatedDomain).toBe('UNRESOLVED')

    const unresolved = operationalDnaSchema.parse({
      ...ARCHETYPE_PRESETS.RETAIL_STORE,
      pricingBasis: ['UNRESOLVED'],
      assetCustody: 'UNRESOLVED',
      executionSite: 'UNRESOLVED',
      recurrence: 'UNRESOLVED',
      approvalDepth: 'UNRESOLVED',
      regulatedDomain: 'UNRESOLVED',
    })
    expect(setupGapsOf(unresolved)).toEqual(
      expect.arrayContaining([
        'PRICING_BASIS_UNRESOLVED',
        'ASSET_CUSTODY_UNRESOLVED',
        'EXECUTION_SITE_UNRESOLVED',
        'RECURRENCE_UNRESOLVED',
        'APPROVAL_DEPTH_UNRESOLVED',
        'REGULATED_DOMAIN_UNRESOLVED',
      ]),
    )
  })

  it('regulatedDomain emits compliance gap only and NEVER grants an available capability', () => {
    const base = operationalDnaSchema.parse(ARCHETYPE_PRESETS.RETAIL_STORE)
    const clinicDna = operationalDnaSchema.parse({
      ...base,
      regulatedDomain: 'HEALTH_RECORDS',
    })
    const basePlan = resolveDnaCapabilities(base)
    const clinicPlan = resolveDnaCapabilities(clinicDna)
    expect(clinicPlan.capabilities.capabilities).toEqual(basePlan.capabilities.capabilities)
    expect(clinicPlan.activeModules).toEqual(basePlan.activeModules)
    expect(clinicPlan.setupGaps).toContain('REGULATED_DOMAIN_COMPLIANCE')
  })

  it('builds tailored adaptive operatingQuestionsFor sets across 8 families without irrelevant questions', () => {
    const barber = operatingQuestionsFor({ takesAppointments: 'yes', holdsStock: 'no' })
    expect(barber).not.toContain('producesGoods')
    expect(barber).not.toContain('rentsOutAssets')
    expect(barber).not.toContain('holdsCustomerAssets')
    expect(barber.join(',')).not.toContain('livestock')

    const rental = operatingQuestionsFor({
      takesAppointments: 'no',
      holdsStock: 'yes',
      rentsOutAssets: 'yes',
    })
    expect(rental).toContain('rentsOutAssets')
    expect(rental).toContain('billsRecurring')

    const clinic = operatingQuestionsFor({
      takesAppointments: 'yes',
      holdsStock: 'yes',
      hasStaff: 'yes',
    })
    expect(clinic).toContain('staffArrangement')
    expect(clinic).toContain('needsApprovals')

    const contractor = operatingQuestionsFor({
      takesJobTicketsOrRepairs: 'yes',
      holdsStock: 'yes',
      worksAtCustomerSite: 'yes',
    })
    expect(contractor).toContain('holdsCustomerAssets')
    expect(contractor).toContain('worksAtCustomerSite')

    const courier = operatingQuestionsFor({
      holdsStock: 'no',
      takesAppointments: 'no',
      worksAtCustomerSite: 'yes',
    })
    expect(courier).not.toContain('tracksSerials')
    expect(courier).toContain('worksAtCustomerSite')

    const farm = operatingQuestionsFor({ holdsStock: 'yes', producesGoods: 'yes' })
    expect(farm).toContain('hasExpiryDates')
    expect(farm).not.toContain('rentsOutAssets')

    const wholesaler = operatingQuestionsFor({
      holdsStock: 'yes',
      sellsOnCredit: 'yes',
      hasStaff: 'yes',
    })
    expect(wholesaler).toContain('needsApprovals')
    expect(wholesaler).toContain('hasPointOfSale')

    const restaurant = operatingQuestionsFor({
      holdsStock: 'yes',
      producesGoods: 'yes',
      hasPointOfSale: 'yes',
    })
    expect(restaurant).toContain('hasExpiryDates')
    expect(restaurant).not.toContain('holdsCustomerAssets')
    expect(restaurant).not.toContain('rentsOutAssets')
  })
})

// ─── Terminology catalog contract ─────────────────────────────────────
//
// `resolveTerminologyProfile` turns DNA labels into i18n keys. A key that no
// catalog defines makes `t(key)` throw, and the screen loses its own word. This
// guard compares the keys this schema can emit with the three live catalogs
// (fa-IR, fa-AF, en), so a new preset or trade namespace cannot land half
// translated.
const ROOT = resolve(__dirname, '../../../..')
const LOCALE_CODES = ['fa', 'af', 'en'] as const
const TRADE_SLOTS = ['offering', 'document', 'storageLocation', 'operator', 'order'] as const

/** Flattens a message tree into dotted keys (`common.customer`). */
function flattenCatalogKeys(value: unknown, prefix: string, out: Set<string>): Set<string> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    if (prefix) out.add(prefix)
    return out
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    flattenCatalogKeys(child, prefix ? `${prefix}.${key}` : key, out)
  }
  return out
}

const CATALOG_KEYS = new Map(
  LOCALE_CODES.map((locale) => {
    const file = resolve(ROOT, `packages/i18n/messages/${locale}/common.json`)
    return [
      locale,
      flattenCatalogKeys(JSON.parse(readFileSync(file, 'utf8')), '', new Set<string>()),
    ]
  }),
)

/** Comment-stripped source, so a key quoted in a comment is not asserted. */
const DNA_SOURCE = readFileSync(
  resolve(ROOT, 'packages/validation/src/schemas/operational-dna.ts'),
  'utf8',
)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

function emittedLabelKeys(): string[] {
  const fromPresets = [...DNA_SOURCE.matchAll(/'(common\.[A-Za-z0-9_.]+)'/g)].flatMap((match) =>
    typeof match[1] === 'string' ? [match[1]] : [],
  )
  const fromGeneric = Object.values(GENERIC_TERMINOLOGY).filter(
    (key): key is string => typeof key === 'string',
  )
  return [...new Set([...fromPresets, ...fromGeneric])].sort()
}

function missingIn(locale: (typeof LOCALE_CODES)[number], keys: readonly string[]): string[] {
  const catalog = CATALOG_KEYS.get(locale)
  if (!catalog) throw new Error(`no catalog loaded for ${locale}`)
  return keys.filter((key) => !catalog.has(key))
}

describe('Terminology keys resolve in all three live catalogs', () => {
  it('every common.* and generic key the DNA schema emits exists in fa, af and en', () => {
    const keys = emittedLabelKeys()
    expect(keys.length).toBeGreaterThan(20)
    for (const locale of LOCALE_CODES) {
      expect(missingIn(locale, keys), `missing in ${locale}`).toEqual([])
    }
  })

  it('every trade namespace the resolver can emit defines its five slots in every locale', () => {
    expect(TERMINOLOGY_TRADE_NAMESPACES.length).toBeGreaterThan(0)
    for (const locale of LOCALE_CODES) {
      for (const namespace of TERMINOLOGY_TRADE_NAMESPACES) {
        const keys = TRADE_SLOTS.map((slot) => `terminology.trades.${namespace}.${slot}`)
        expect(missingIn(locale, keys), `${namespace} in ${locale}`).toEqual([])
      }
    }
  })

  it('a resolved trade emits only existing keys, and an unknown trade keeps the generic word', () => {
    const retailDna = ARCHETYPE_PRESETS.RETAIL_STORE
    if (!retailDna) throw new Error('RETAIL_STORE preset is missing')
    for (const namespace of TERMINOLOGY_TRADE_NAMESPACES) {
      const profile = resolveTerminologyProfile(retailDna, namespace)
      const keys = [
        profile.itemLabelKey,
        profile.transactionLabelKey,
        profile.storageLabelKey,
        profile.operatorLabelKey,
        profile.orderLabelKey,
      ].filter((key): key is string => typeof key === 'string')
      expect(keys, `${namespace} does not emit all five trade slots`).toHaveLength(5)
      for (const locale of LOCALE_CODES) {
        expect(missingIn(locale, keys), `${namespace} in ${locale}`).toEqual([])
      }
    }

    // An unknown trade never inherits another trade's word: the DNA's own label
    // stays (`common.product`), and when the DNA carries no label the key stays
    // generic, so `useTerminology` keeps the text the screen already shows.
    const unowned = resolveTerminologyProfile(retailDna, 'notARegisteredTrade')
    expect(unowned.itemLabelKey).toBe('common.product')
    expect(unowned.transactionLabelKey).toBe('common.sale')

    const noLabels = operationalDnaSchema.parse({ ...retailDna, terminology: undefined })
    const bare = resolveTerminologyProfile(noLabels, 'notARegisteredTrade')
    expect(bare.itemLabelKey).toBe(GENERIC_TERMINOLOGY.itemLabelKey)
    expect(bare.transactionLabelKey).toBe(GENERIC_TERMINOLOGY.transactionLabelKey)
  })
})
