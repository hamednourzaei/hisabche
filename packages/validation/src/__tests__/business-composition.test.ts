// ============================================
// packages/validation/src/__tests__/business-composition.test.ts
//
// V60 Slice 4 — Deterministic problem profile (P1–P10) and composition tests
// across all 25 business families + "film-equipment rental" (unseen case) + `other`.
// Plain deterministic fixtures only (no fast-check).
// ============================================

import { describe, expect, it } from 'vitest'
import {
  BUSINESS_PROBLEMS,
  composeBusinessSolution,
  problemsOf,
  requirementsOf,
  type BusinessProblem,
} from '../schemas/business-problems'
import {
  AVAILABLE_CAPABILITIES,
  CAPABILITIES,
  type CapabilityKey,
} from '../schemas/business-capabilities'
import { inferOperationalDna, type OperationalInferenceInput } from '../schemas/operational-dna'
import { primaryIndustryKeyOf, resolveBusinessProfile } from '../schemas/industry-profiles'

interface FamilyFixture {
  readonly family: string
  readonly input: OperationalInferenceInput
  readonly expectedApplies: readonly BusinessProblem[]
  readonly expectedNeeds?: readonly CapabilityKey[]
  readonly regulated?: boolean
}

const AVAILABLE_SET = new Set<string>(AVAILABLE_CAPABILITIES)

const FAMILY_FIXTURES: readonly FamilyFixture[] = [
  {
    family: 'supermarket',
    input: {
      tradeKey: 'grocery',
      holdsStock: 'yes',
      hasPointOfSale: 'yes',
      hasExpiryDates: 'yes',
      hasStaff: 'yes',
      staffArrangement: 'shift',
      pricingBasis: ['UNIT', 'WEIGHT'],
    },
    expectedApplies: [
      'P1_customer_revenue_visibility',
      'P2_pricing_and_true_cost',
      'P4_stock_and_resource_location',
      'P5_procurement',
      'P6_workforce_productivity',
      'P9_quality_warranty_obligations',
    ],
    expectedNeeds: ['weight_pricing', 'batch_expiry', 'variants'],
  },
  {
    family: 'wholesale/distribution',
    input: {
      tradeKey: 'wholesale',
      holdsStock: 'yes',
      sellsOnCredit: 'yes',
      hasStaff: 'yes',
      staffArrangement: 'fixed_salary',
      locations: 'multiple',
      needsApprovals: 'yes',
      worksAtCustomerSite: 'yes',
      pricingBasis: ['UNIT', 'TIERED'],
    },
    expectedApplies: [
      'P2_pricing_and_true_cost',
      'P4_stock_and_resource_location',
      'P5_procurement',
      'P6_workforce_productivity',
      'P7_cash_debt_settlement',
      'P10_owner_control',
    ],
    expectedNeeds: ['tiered_pricing', 'delivery_pod', 'approval_workflow'],
  },
  {
    family: 'clothing/fabric roll',
    input: {
      tradeKey: 'clothing',
      holdsStock: 'yes',
      hasPointOfSale: 'yes',
      pricingBasis: ['UNIT', 'LENGTH', 'AREA'],
    },
    expectedApplies: [
      'P2_pricing_and_true_cost',
      'P4_stock_and_resource_location',
      'P5_procurement',
    ],
    expectedNeeds: ['length_pricing', 'area_pricing', 'variants'],
  },
  {
    family: 'electronics',
    input: {
      tradeKey: 'mobilePhones',
      holdsStock: 'yes',
      tracksSerials: 'yes',
      hasPointOfSale: 'yes',
    },
    expectedApplies: [
      'P4_stock_and_resource_location',
      'P5_procurement',
      'P9_quality_warranty_obligations',
    ],
    expectedNeeds: ['serialized_items', 'warranty_claims'],
  },
  {
    family: 'hardware/timber',
    input: {
      tradeKey: 'hardware',
      holdsStock: 'yes',
      pricingBasis: ['UNIT', 'LENGTH', 'AREA', 'WEIGHT'],
    },
    expectedApplies: [
      'P2_pricing_and_true_cost',
      'P4_stock_and_resource_location',
      'P5_procurement',
    ],
    expectedNeeds: ['weight_pricing', 'length_pricing', 'area_pricing'],
  },
  {
    family: 'restaurant',
    input: {
      tradeKey: 'restaurant',
      holdsStock: 'yes',
      producesGoods: 'yes',
      hasPointOfSale: 'yes',
      hasExpiryDates: 'yes',
      hasStaff: 'yes',
      staffArrangement: 'shift',
    },
    expectedApplies: [
      'P2_pricing_and_true_cost',
      'P4_stock_and_resource_location',
      'P5_procurement',
      'P9_quality_warranty_obligations',
    ],
    expectedNeeds: ['recipe_bom', 'batch_expiry', 'quality_inspection'],
    regulated: true,
  },
  {
    family: 'bakery',
    input: {
      tradeKey: 'bakery',
      holdsStock: 'yes',
      producesGoods: 'yes',
      hasExpiryDates: 'yes',
    },
    expectedApplies: [
      'P2_pricing_and_true_cost',
      'P5_procurement',
      'P9_quality_warranty_obligations',
    ],
    expectedNeeds: ['recipe_bom', 'batch_expiry', 'quality_inspection'],
    regulated: true,
  },
  {
    family: 'hotel',
    input: {
      tradeKey: 'hotel',
      holdsStock: 'yes',
      takesAppointments: 'yes',
      billsRecurring: 'no',
      pricingBasis: ['TIME'],
    },
    expectedApplies: [
      'P1_customer_revenue_visibility',
      'P3_order_queue_and_capacity',
      'P7_cash_debt_settlement',
      'P9_quality_warranty_obligations',
    ],
    expectedNeeds: ['resource_capacity', 'deposits_liability'],
    regulated: true,
  },
  {
    family: 'cafe',
    input: {
      tradeKey: 'cafe',
      holdsStock: 'yes',
      hasPointOfSale: 'yes',
      hasExpiryDates: 'yes',
    },
    expectedApplies: [
      'P4_stock_and_resource_location',
      'P5_procurement',
      'P9_quality_warranty_obligations',
    ],
    regulated: true,
  },
  {
    family: 'salon',
    input: {
      tradeKey: 'beautySalon',
      takesAppointments: 'yes',
      holdsStock: 'yes',
      hasStaff: 'yes',
      staffArrangement: 'commission',
    },
    expectedApplies: [
      'P3_order_queue_and_capacity',
      'P6_workforce_productivity',
      'P7_cash_debt_settlement',
    ],
    expectedNeeds: ['resource_capacity', 'deposits_liability'],
  },
  {
    family: 'clinic',
    input: {
      tradeKey: 'clinic',
      takesAppointments: 'yes',
      holdsStock: 'no',
      hasStaff: 'yes',
      staffArrangement: 'fixed_salary',
      regulatedDomain: 'HEALTH_RECORDS',
    },
    expectedApplies: [
      'P3_order_queue_and_capacity',
      'P6_workforce_productivity',
      'P9_quality_warranty_obligations',
    ],
    expectedNeeds: ['resource_capacity', 'deposits_liability'],
    regulated: true,
  },
  {
    family: 'pharmacy',
    input: {
      tradeKey: 'pharmacy',
      holdsStock: 'yes',
      hasExpiryDates: 'yes',
      hasPointOfSale: 'yes',
      regulatedDomain: 'PRESCRIPTION',
    },
    expectedApplies: [
      'P4_stock_and_resource_location',
      'P5_procurement',
      'P9_quality_warranty_obligations',
    ],
    expectedNeeds: ['batch_expiry'],
    regulated: true,
  },
  {
    family: 'education',
    input: {
      tradeKey: 'education',
      deliversCoursesOrPackages: 'yes',
      holdsStock: 'no',
      hasStaff: 'yes',
      staffArrangement: 'fixed_salary',
    },
    expectedApplies: [
      'P3_order_queue_and_capacity',
      'P6_workforce_productivity',
      'P7_cash_debt_settlement',
    ],
    expectedNeeds: ['resource_capacity', 'package_credits'],
  },
  {
    family: 'professional services',
    input: {
      holdsStock: 'no',
      takesAppointments: 'no',
      hasStaff: 'yes',
      staffArrangement: 'hourly',
      billsRecurring: 'yes',
      pricingBasis: ['TIME', 'CONTRACT'],
    },
    expectedApplies: [
      'P1_customer_revenue_visibility',
      'P6_workforce_productivity',
      'P7_cash_debt_settlement',
      'P8_true_profit',
    ],
    expectedNeeds: ['timesheet_billing', 'contracts_recurring', 'cost_allocation'],
  },
  {
    family: 'manufacturing',
    input: {
      tradeKey: 'manufacturing',
      holdsStock: 'yes',
      producesGoods: 'yes',
      hasStaff: 'yes',
      staffArrangement: 'fixed_salary',
    },
    expectedApplies: [
      'P2_pricing_and_true_cost',
      'P4_stock_and_resource_location',
      'P5_procurement',
      'P9_quality_warranty_obligations',
    ],
    expectedNeeds: ['recipe_bom', 'quality_inspection'],
  },
  {
    family: 'construction',
    input: {
      holdsStock: 'yes',
      takesJobTicketsOrRepairs: 'yes',
      worksAtCustomerSite: 'yes',
      hasStaff: 'yes',
      staffArrangement: 'hourly',
      needsApprovals: 'yes',
    },
    expectedApplies: [
      'P3_order_queue_and_capacity',
      'P4_stock_and_resource_location',
      'P6_workforce_productivity',
      'P10_owner_control',
    ],
    expectedNeeds: ['work_queue_sla', 'delivery_pod', 'approval_workflow'],
  },
  {
    family: 'auto repair',
    input: {
      tradeKey: 'repairs',
      takesJobTicketsOrRepairs: 'yes',
      holdsCustomerAssets: 'yes',
      holdsStock: 'yes',
      tracksSerials: 'yes',
    },
    expectedApplies: [
      'P3_order_queue_and_capacity',
      'P4_stock_and_resource_location',
      'P9_quality_warranty_obligations',
    ],
    expectedNeeds: ['work_queue_sla', 'serialized_items', 'warranty_claims'],
  },
  {
    family: 'farm/livestock',
    input: {
      holdsStock: 'yes',
      producesGoods: 'yes',
      hasExpiryDates: 'yes',
      worksAtCustomerSite: 'no',
      pricingBasis: ['WEIGHT', 'UNIT'],
    },
    expectedApplies: [
      'P2_pricing_and_true_cost',
      'P4_stock_and_resource_location',
      'P5_procurement',
      'P9_quality_warranty_obligations',
    ],
    expectedNeeds: ['weight_pricing', 'recipe_bom', 'batch_expiry'],
  },
  {
    family: 'courier/logistics',
    input: {
      tradeKey: 'courier',
      holdsStock: 'no',
      worksAtCustomerSite: 'yes',
      sellsOnCredit: 'yes',
      hasStaff: 'yes',
      staffArrangement: 'shift',
      executionSite: 'MOBILE_ROUTE',
    },
    expectedApplies: [
      'P4_stock_and_resource_location',
      'P6_workforce_productivity',
      'P7_cash_debt_settlement',
    ],
    expectedNeeds: ['delivery_pod', 'fleet_dispatch'],
  },
  {
    family: 'real estate',
    input: {
      holdsStock: 'no',
      takesAppointments: 'no',
      billsRecurring: 'yes',
      hasStaff: 'yes',
      staffArrangement: 'commission',
      recurrence: 'LEASE',
      pricingBasis: ['CONTRACT'],
    },
    expectedApplies: [
      'P1_customer_revenue_visibility',
      'P6_workforce_productivity',
      'P7_cash_debt_settlement',
    ],
    expectedNeeds: ['contracts_recurring', 'cost_allocation'],
  },
  {
    family: 'gold',
    input: {
      tradeKey: 'jewellery',
      holdsStock: 'yes',
      hasPointOfSale: 'yes',
      pricingBasis: ['WEIGHT', 'RATE_BOARD'],
    },
    expectedApplies: [
      'P2_pricing_and_true_cost',
      'P4_stock_and_resource_location',
      'P5_procurement',
    ],
    expectedNeeds: ['weight_pricing', 'variants'],
  },
  {
    family: 'exchange',
    input: {
      tradeKey: 'currencyExchange',
      holdsStock: 'no',
      pricingBasis: ['RATE_BOARD'],
      regulatedDomain: 'FINANCIAL_KYC',
    },
    expectedApplies: [
      'P1_customer_revenue_visibility',
      'P8_true_profit',
      'P9_quality_warranty_obligations',
    ],
    expectedNeeds: ['cost_allocation', 'owner_forecast'],
    regulated: true,
  },
  {
    family: 'travel agency',
    input: {
      holdsStock: 'no',
      takesAppointments: 'yes',
      sellsOnCredit: 'yes',
      pricingBasis: ['CONTRACT'],
    },
    expectedApplies: ['P3_order_queue_and_capacity', 'P7_cash_debt_settlement', 'P8_true_profit'],
    expectedNeeds: ['resource_capacity', 'deposits_liability'],
  },
  {
    family: 'events venue',
    input: {
      holdsStock: 'no',
      takesAppointments: 'yes',
      rentsOutAssets: 'yes',
      pricingBasis: ['TIME', 'CONTRACT'],
    },
    expectedApplies: ['P3_order_queue_and_capacity', 'P7_cash_debt_settlement'],
    expectedNeeds: ['resource_capacity', 'deposits_liability'],
  },
  {
    family: 'cleaning/security',
    input: {
      holdsStock: 'no',
      worksAtCustomerSite: 'yes',
      billsRecurring: 'yes',
      hasStaff: 'yes',
      staffArrangement: 'shift',
      executionSite: 'CUSTOMER_SITE',
      recurrence: 'RECURRING_SERVICE',
    },
    expectedApplies: [
      'P4_stock_and_resource_location',
      'P6_workforce_productivity',
      'P7_cash_debt_settlement',
    ],
    expectedNeeds: ['delivery_pod', 'contracts_recurring'],
  },
]

describe('V60 Slice 4: Problem Profile P1–P10 & Composition Engine', () => {
  it('composes all 25 reference families deterministically with honest capability statuses', () => {
    expect(FAMILY_FIXTURES).toHaveLength(25)

    for (const fixture of FAMILY_FIXTURES) {
      const composed = composeBusinessSolution(fixture.input)
      const problemMap = new Map(composed.problems.map((p) => [p.problem, p.status]))

      for (const expectedProblem of fixture.expectedApplies) {
        expect(problemMap.get(expectedProblem), `${fixture.family} → ${expectedProblem}`).toBe(
          'applies',
        )
      }

      const requiredSet = new Set(composed.requirements.map((r) => r.capability))
      for (const expectedCap of fixture.expectedNeeds ?? []) {
        expect(requiredSet.has(expectedCap), `${fixture.family} → needs ${expectedCap}`).toBe(true)
      }

      // Honesty check: only true AVAILABLE_CAPABILITIES are ever labeled 'available'.
      for (const entry of composed.plan.statuses) {
        if (entry.status === 'available') {
          expect(AVAILABLE_SET.has(entry.capability), `${fixture.family}:${entry.capability}`).toBe(
            true,
          )
        }
        if (entry.status === 'partial') {
          expect(entry.limitations.length, `${fixture.family}:${entry.capability}`).toBeGreaterThan(
            0,
          )
        }
        // Planned capabilities never leak into presentation quickActions
        if (entry.status === 'planned' || entry.status === 'unsupported') {
          expect(composed.presentation.quickActions).not.toContain(entry.capability)
        }
      }

      // No silent retail fallback when stock is explicitly 'no' or trade is non-retail
      if (fixture.input.holdsStock === 'no') {
        expect(composed.dna.archetypeHint).not.toBe('RETAIL_STORE')
      }

      if (fixture.regulated) {
        expect(composed.gaps).toContain('REGULATED_DOMAIN_COMPLIANCE')
        for (const cap of composed.plan.capabilities.capabilities) {
          expect(AVAILABLE_SET.has(cap) || CAPABILITIES[cap].status === 'partial').toBe(true)
        }
      }
    }
  })

  it('handles unseen "film-equipment rental" cleanly without inventing livestock or falling back to retail', () => {
    const filmRental = composeBusinessSolution({
      holdsStock: 'no',
      takesAppointments: 'no',
      rentsOutAssets: 'yes',
      billsRecurring: 'yes',
      hasStaff: 'yes',
      staffArrangement: 'fixed_salary',
      pricingBasis: ['TIME'],
    })

    const applies = new Set(
      filmRental.problems.filter((p) => p.status === 'applies').map((p) => p.problem),
    )
    expect(applies).toEqual(
      new Set<BusinessProblem>([
        'P1_customer_revenue_visibility',
        'P2_pricing_and_true_cost',
        'P3_order_queue_and_capacity',
        'P6_workforce_productivity',
        'P7_cash_debt_settlement',
        'P8_true_profit',
        'P10_owner_control',
      ]),
    )
    expect(filmRental.dna.assetCustody).toBe('RENTED_OUT_ASSET')
    expect(filmRental.dna.recurrence).toBe('LEASE')
    expect(filmRental.dna.archetypeHint).not.toBe('RETAIL_STORE')
    expect(filmRental.requirements.map((r) => r.capability)).toEqual(
      expect.arrayContaining(['asset_rental', 'resource_capacity', 'contracts_recurring']),
    )
    expect(filmRental.nextQuestions.join(',')).not.toContain('livestock')
  })

  it('keeps "other" and unknown operational answers UNRESOLVED with zero retail fallback', () => {
    expect(primaryIndustryKeyOf(['other'])).toBe('other')
    const profile = resolveBusinessProfile(['other'])
    expect(profile.isGeneric).toBe(true)
    expect(profile.capabilities).toEqual([])
    expect(profile.recommendedModules).not.toContain('stock')
    expect(profile.recommendedModules).not.toContain('till')

    const unknownDna = inferOperationalDna({ tradeKey: 'other', holdsStock: 'unknown' })
    expect(unknownDna.offering).toEqual(['UNRESOLVED'])
    expect(unknownDna.inventory).toEqual(['UNRESOLVED'])
    expect(unknownDna.archetypeHint).not.toBe('RETAIL_STORE')

    const composed = composeBusinessSolution(unknownDna)
    expect(composed.gaps).toEqual(
      expect.arrayContaining([
        'OFFERING_UNRESOLVED',
        'INVENTORY_UNRESOLVED',
        'WORKFORCE_UNRESOLVED',
      ]),
    )
    expect(composed.nextQuestions.length).toBeGreaterThan(0)
    expect(composed.plan.activeModules).toEqual(
      expect.arrayContaining(['accounting', 'invoices', 'customers']),
    )
    expect(composed.plan.activeModules).not.toContain('inventory')
  })

  it('pure pipeline steps (problemsOf and requirementsOf) stay deterministic', () => {
    const dna = inferOperationalDna({
      tradeKey: 'pharmacy',
      holdsStock: 'yes',
      hasExpiryDates: 'yes',
    })
    const problems = problemsOf(dna)
    expect(problems).toHaveLength(BUSINESS_PROBLEMS.length)
    expect(problemsOf(dna)).toEqual(problems)

    const reqs = requirementsOf(dna, problems)
    expect(reqs.some((r) => r.capability === 'batch_expiry')).toBe(true)
    expect(requirementsOf(dna)).toEqual(reqs)
  })
})
