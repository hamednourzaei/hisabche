// ============================================
// packages/validation/src/__tests__/dna-multi-industry.test.ts
//
// V65 · V64 §5 — a business may run several activities, and EVERY selected one
// must reach the capability plan, the dashboard and the first-value guidance.
//
// The failure this suite exists for: capabilities were unioned across selected
// trades while the DNA silently took only the primary trade, so a shop that
// also repairs was shown a menu it had no workflow for — or the reverse.
//
// ⚠️ A composed DNA is still NOT an authorisation. The last group proves that
// naming a regulated domain (pharmacy → prescription) yields a compliance GAP
// and not one extra active module.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  inferOperationalDna,
  operatingAnswersSchema,
  operatingQuestionsFor,
  operationalDnaSchema,
  resolveDnaCapabilities,
  suggestedOperatingAnswersFor,
  type OperationalDna,
  type OperationalInferenceInput,
} from '../schemas/operational-dna'
import { INDUSTRY_KEYS, resolveBusinessProfile } from '../schemas/industry-profiles'

const AXES: readonly { name: string; read: (dna: OperationalDna) => readonly string[] }[] = [
  { name: 'offering', read: (dna) => dna.offering },
  { name: 'intake', read: (dna) => dna.intake },
  { name: 'inventory', read: (dna) => dna.inventory },
  { name: 'settlement', read: (dna) => dna.settlement },
  { name: 'workforce', read: (dna) => dna.workforce },
]

/** Every value an activity contributes that the composed DNA must still carry. */
function missingValues(part: OperationalDna, composed: OperationalDna): string[] {
  const missing: string[] = []
  for (const axis of AXES) {
    const composedValues = axis.read(composed)
    for (const value of axis.read(part)) {
      if (value === 'UNRESOLVED') continue
      if (!composedValues.includes(value)) missing.push(`${axis.name}:${value}`)
    }
  }
  for (const value of part.topology) {
    // SINGLE_LOCATION contradicts a branch/resource/warehouse topology; the
    // composed plan keeps the more specific one. Nothing else is droppable.
    if (value === 'SINGLE_LOCATION') continue
    if (!composed.topology.includes(value)) missing.push(`topology:${value}`)
  }
  if (part.customer.length > 0 && !composed.customer.includes('MIXED_PROFILE')) {
    for (const value of part.customer) {
      if (!composed.customer.includes(value)) missing.push(`customer:${value}`)
    }
  }
  return missing
}

const COMBINATIONS: readonly { trades: readonly string[]; why: string }[] = [
  { trades: ['retail', 'wholesale'], why: 'a shop that also distributes' },
  { trades: ['retail', 'repairs'], why: 'a shop with a repair bench' },
  { trades: ['cafe', 'bakery'], why: 'a cafe that bakes its own goods' },
  { trades: ['mobilePhones', 'repairs'], why: 'a phone shop with a workshop' },
  { trades: ['clothing', 'tailoring'], why: 'a clothing shop that alters' },
  { trades: ['restaurant', 'courier'], why: 'a restaurant that delivers itself' },
  { trades: ['manufacturing', 'wholesale'], why: 'a workshop selling to traders' },
  { trades: ['beautySalon', 'retail'], why: 'a salon selling product' },
  { trades: ['consulting', 'itServices'], why: 'an advisory + delivery office' },
  { trades: ['realEstate', 'security'], why: 'property + contracted guarding' },
]

describe('multi-activity Operational DNA', () => {
  it('every combination keeps every selected activity and is a valid DNA', () => {
    for (const { trades, why } of COMBINATIONS) {
      for (const trade of trades) expect(INDUSTRY_KEYS).toContain(trade)

      const composed = inferOperationalDna({ tradeKeys: trades, primaryTradeKey: trades[0] })
      const parsed = operationalDnaSchema.safeParse(composed)
      expect(parsed.success, `${why}: composed DNA must validate`).toBe(true)

      for (const trade of trades) {
        const alone = inferOperationalDna({ tradeKey: trade })
        expect(
          missingValues(alone, composed),
          `${why}: ${trade} disappeared from the composed DNA`,
        ).toEqual([])
      }
    }
  })

  it('the capability plan is the union, never the primary activity alone', () => {
    for (const { trades, why } of COMBINATIONS) {
      const composed = resolveDnaCapabilities(
        inferOperationalDna({ tradeKeys: trades, primaryTradeKey: trades[0] }),
      )
      for (const trade of trades) {
        const alone = resolveDnaCapabilities(inferOperationalDna({ tradeKey: trade }))
        for (const module of alone.activeModules) {
          expect(composed.activeModules, `${why}: ${trade} lost the «${module}» module`).toContain(
            module,
          )
        }
      }
    }
  })

  it('the primary activity keeps its vocabulary, and flipping it flips the vocabulary', () => {
    const shopFirst = inferOperationalDna({
      tradeKeys: ['retail', 'repairs'],
      primaryTradeKey: 'retail',
    })
    const benchFirst = inferOperationalDna({
      tradeKeys: ['retail', 'repairs'],
      primaryTradeKey: 'repairs',
    })

    expect(shopFirst.terminology).toEqual(inferOperationalDna({ tradeKey: 'retail' }).terminology)
    expect(benchFirst.terminology).toEqual(inferOperationalDna({ tradeKey: 'repairs' }).terminology)
    // Same activities, same plan: vocabulary is the only thing the primary owns.
    expect([...shopFirst.inventory].sort()).toEqual([...benchFirst.inventory].sort())
    expect([...shopFirst.intake].sort()).toEqual([...benchFirst.intake].sort())
  })

  it('the dashboard and capability profile cover every selected activity', () => {
    for (const { trades, why } of COMBINATIONS) {
      const merged = resolveBusinessProfile(trades, trades[0])
      for (const trade of trades) {
        const alone = resolveBusinessProfile([trade], trade)
        for (const capability of alone.capabilities) {
          expect(merged.capabilities, `${why}: ${trade} lost «${capability}»`).toContain(capability)
        }
        for (const part of alone.dashboard) {
          expect(merged.dashboard, `${why}: ${trade} lost the «${part}» dashboard part`).toContain(
            part,
          )
        }
      }
    }
  })

  it('two different party kinds become the existing MIXED_PROFILE, not the first one', () => {
    const salonAndShop = inferOperationalDna({
      tradeKeys: ['beautySalon', 'retail'],
      primaryTradeKey: 'beautySalon',
    })
    expect(salonAndShop.customer).toEqual(['MIXED_PROFILE'])

    const shopAndShop = inferOperationalDna({
      tradeKeys: ['retail', 'grocery'],
      primaryTradeKey: 'retail',
    })
    expect(shopAndShop.customer).toEqual(['STANDARD_PARTY'])
  })

  it('a regulated domain is a compliance gap, never an extra module', () => {
    const pharmacyAndShop = inferOperationalDna({
      tradeKeys: ['pharmacy', 'retail'],
      primaryTradeKey: 'retail',
    })
    expect(pharmacyAndShop.regulatedDomain).toBe('PRESCRIPTION')

    const withDomain = resolveDnaCapabilities(pharmacyAndShop)
    expect(withDomain.setupGaps).toContain('REGULATED_DOMAIN_COMPLIANCE')

    // Removing the domain changes no module: DNA grants nothing by itself.
    const withoutDomain = resolveDnaCapabilities({ ...pharmacyAndShop, regulatedDomain: undefined })
    expect([...withDomain.activeModules].sort()).toEqual([...withoutDomain.activeModules].sort())
  })

  it('warehouses and branches are independent, and the legacy answer still counts', () => {
    const twoWarehouses = inferOperationalDna({ tradeKey: 'retail', warehouses: 'multiple' })
    expect(twoWarehouses.topology).toContain('WAREHOUSE_NETWORK')
    expect(twoWarehouses.topology).not.toContain('MULTI_BRANCH')

    const twoBranches = inferOperationalDna({ tradeKey: 'retail', branches: 'multiple' })
    expect(twoBranches.topology).toContain('MULTI_BRANCH')
    expect(twoBranches.topology).not.toContain('WAREHOUSE_NETWORK')

    // Stored before V65: the question was called `locations`.
    const legacy = inferOperationalDna({ tradeKey: 'retail', locations: 'multiple' })
    expect(legacy.topology).toContain('MULTI_BRANCH')

    const noWarehouse = inferOperationalDna({
      tradeKey: 'consulting',
      holdsStock: 'no',
      warehouses: 'none',
    })
    expect(noWarehouse.inventory).toEqual(['NONE'])
    expect(noWarehouse.topology).not.toContain('WAREHOUSE_NETWORK')
  })
})

describe('single-activity behaviour is unchanged', () => {
  it('tradeKey and a one-element tradeKeys produce byte-identical DNA', () => {
    const shapes: readonly OperationalInferenceInput[] = [
      {},
      { holdsStock: 'yes' },
      { takesAppointments: 'no' },
      { sellsOnCredit: 'yes', hasStaff: 'yes', staffArrangement: 'commission' },
    ]
    for (const tradeKey of ['barber', 'repairs', 'consulting']) {
      for (const answers of shapes) {
        expect(inferOperationalDna({ tradeKey, ...answers })).toEqual(
          inferOperationalDna({
            tradeKeys: [tradeKey],
            primaryTradeKey: tradeKey,
            ...answers,
          }),
        )
      }
    }
  })
})

describe('a composed DNA still fits the column it is stored in', () => {
  // `workspaces.operational_dna` carries
  // `CHECK (jsonb_typeof(...) = 'object' AND pg_column_size(...) < 4096)`
  // (docs/operational-profile-01-migration.sql:38-41). A union of activities is
  // bigger than one, so «no migration needed» has to be measured, not assumed.
  const bytesOf = (dna: OperationalDna) => Buffer.byteLength(JSON.stringify(dna), 'utf8')

  it('the worst case — every registry activity at once — stays under 4096 bytes', () => {
    const all = [...INDUSTRY_KEYS]
    const composed = inferOperationalDna({ tradeKeys: all, primaryTradeKey: all[0] })
    expect(operationalDnaSchema.safeParse(composed).success).toBe(true)
    expect(bytesOf(composed)).toBeLessThan(4096)
  })

  it('a realistic multi-activity business stays far under it', () => {
    for (const { trades } of COMBINATIONS) {
      const composed = inferOperationalDna({ tradeKeys: trades, primaryTradeKey: trades[0] })
      expect(bytesOf(composed), trades.join('+')).toBeLessThan(2048)
    }
  })
})

describe('answers saved before V65 still read', () => {
  it('accepts a legacy payload with `locations` and no new keys', () => {
    const parsed = operatingAnswersSchema.safeParse({
      holdsStock: 'yes',
      locations: 'multiple',
      staffArrangement: 'solo',
    })
    expect(parsed.success).toBe(true)
  })

  it('accepts the new answers and refuses an unknown one', () => {
    expect(
      operatingAnswersSchema.safeParse({ branches: 'multiple', warehouses: 'none' }).success,
    ).toBe(true)
    expect(operatingAnswersSchema.safeParse({ warehouses: 'three' }).success).toBe(false)
  })

  it('asks branches and warehouses once instead of the old `locations`', () => {
    const questions = operatingQuestionsFor({})
    expect(questions).toContain('branches')
    expect(questions).toContain('warehouses')
    expect(questions).not.toContain('locations')
  })

  it('pre-fills a «yes» from any activity rather than hiding a needed module', () => {
    const suggestion = suggestedOperatingAnswersFor(['retail', 'consulting'])
    expect(suggestion.holdsStock).toBe('yes')
    expect(suggestion.sellsOnCredit).toBe('yes')
    expect(suggestion.hasPointOfSale).toBe('yes')
  })
})
