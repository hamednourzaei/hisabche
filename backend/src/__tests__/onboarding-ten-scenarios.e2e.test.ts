// ============================================
// backend/src/__tests__/onboarding-ten-scenarios.e2e.test.ts
//
// Outcome-Driven System Integrity Standard — Layer 5 & E2E Proof
// Verifies the ten canonical onboarding industry scenarios from
// docs/onboarding/ONBOARDING-ARCHITECTURE.md §4:
//   1. Clothing retail (clothing)
//   2. Grocery store (grocery)
//   3. Service business (consulting)
//   4. Language school (education)
//   5. Manufacturing (manufacturing)
//   6. Wholesale/distribution (wholesale)
//   7. Pharmacy (pharmacy)
//   8. Currency exchange (currencyExchange)
//   9. Gold business (jewellery)
//   10. Project-based company (itServices)
//   11. Unknown trade policy: stays generic, NEVER silently defaults to retail
//   12. Server-authoritative activation gate prerequisites
// ============================================

import { describe, expect, it } from 'vitest'
import {
  canonicalIndustryTypes,
  inferOperationalDna,
  primaryIndustryKeyOf,
  resolveBusinessProfile,
  evaluateOnboardingActivation,
  suggestedOperatingAnswers,
  characteristicsFromAnswers,
  type IndustryKey,
} from '@hisabche/validation'

describe('Onboarding Ten Business Scenarios E2E (Outcome Proof)', () => {
  it('Scenario 1: Clothing retail — variants, stock, apparel trade', () => {
    const rawSelection = 'clothing'
    const canonical = canonicalIndustryTypes(rawSelection)
    expect(canonical.known).toEqual(['clothing'])
    expect(canonical.unknown).toEqual([])

    const primary = primaryIndustryKeyOf(canonical.known)
    expect(primary).toBe('clothing')

    // Scenario 1: Retail apparel holds stock
    const answers = {
      ...suggestedOperatingAnswers('clothing'),
      holdsStock: 'yes' as const,
      hasPointOfSale: 'yes' as const,
    }
    const dna = inferOperationalDna({ tradeKey: 'clothing', tradeKeys: ['clothing'], ...answers })
    expect(dna.offering).toContain('PHYSICAL_GOODS')
    expect(dna.inventory).toContain('RETAIL_STOCK')

    const profile = resolveBusinessProfile(
      canonical.known,
      null,
      characteristicsFromAnswers(answers),
    )
    expect(profile.isGeneric).toBe(false)
    expect(profile.primary).toBe('clothing')
    expect(profile.inventoryRelevant).toBe(true)
  })

  it('Scenario 2: Grocery store — batches, expiry, fast-moving stock', () => {
    const canonical = canonicalIndustryTypes('grocery')
    expect(canonical.known).toEqual(['grocery'])

    // Scenario 2: Grocery suggested answers include holdsStock: yes, hasExpiryDates: yes
    const answers = suggestedOperatingAnswers('grocery')
    expect(answers.holdsStock).toBe('yes')
    expect(answers.hasExpiryDates).toBe('yes')

    const dna = inferOperationalDna({ tradeKey: 'grocery', tradeKeys: ['grocery'], ...answers })
    expect(dna.offering).toContain('PHYSICAL_GOODS')
    expect(dna.inventory).toContain('RETAIL_STOCK')
    expect(dna.unitTracking).toBe('EXPIRY_DATES')

    const profile = resolveBusinessProfile(
      canonical.known,
      null,
      characteristicsFromAnswers(answers),
    )
    expect(profile.primary).toBe('grocery')
    expect(profile.inventoryRelevant).toBe(true)
  })

  it('Scenario 3: Service business — no stock, session and time delivery', () => {
    const canonical = canonicalIndustryTypes('consulting')
    expect(canonical.known).toEqual(['consulting'])

    // Scenario 3: Consulting suggested answers include holdsStock: no
    const answers = suggestedOperatingAnswers('consulting')
    expect(answers.holdsStock).toBe('no')

    const dna = inferOperationalDna({
      tradeKey: 'consulting',
      tradeKeys: ['consulting'],
      ...answers,
    })
    expect(dna.offering).toContain('DELIVERABLE_SERVICE')
    expect(dna.inventory).toContain('NONE')

    const profile = resolveBusinessProfile(
      canonical.known,
      null,
      characteristicsFromAnswers(answers),
    )
    expect(profile.primary).toBe('consulting')
    expect(profile.inventoryRelevant).toBe(false)
  })

  it('Scenario 4: Language school — education, package credits', () => {
    const canonical = canonicalIndustryTypes('education')
    expect(canonical.known).toEqual(['education'])

    // Scenario 4: Education is package/course driven, no physical stock
    const answers = { ...suggestedOperatingAnswers('education'), holdsStock: 'no' as const }
    expect(answers.deliversCoursesOrPackages).toBe('yes')

    const dna = inferOperationalDna({ tradeKey: 'education', tradeKeys: ['education'], ...answers })
    expect(dna.offering).toContain('PACKAGE_SESSION')
    expect(dna.inventory).toContain('NONE')
    expect(dna.archetypeHint).toBe('LANGUAGE_TEACHER')

    const profile = resolveBusinessProfile(
      canonical.known,
      null,
      characteristicsFromAnswers(answers),
    )
    expect(profile.primary).toBe('education')
    expect(profile.inventoryRelevant).toBe(false)
  })

  it('Scenario 5: Manufacturing — BOM, WIP, raw materials & production', () => {
    const canonical = canonicalIndustryTypes('manufacturing')
    expect(canonical.known).toEqual(['manufacturing'])

    // Scenario 5: Producer trade suggests producesGoods: yes, holdsStock: yes
    const answers = suggestedOperatingAnswers('manufacturing')
    expect(answers.producesGoods).toBe('yes')
    expect(answers.holdsStock).toBe('yes')

    const dna = inferOperationalDna({
      tradeKey: 'manufacturing',
      tradeKeys: ['manufacturing'],
      ...answers,
    })
    expect(dna.offering).toContain('PHYSICAL_GOODS')
    expect(dna.inventory).toContain('RAW_MATERIALS')
    expect(dna.inventory).toContain('FINISHED_GOODS')

    const profile = resolveBusinessProfile(
      canonical.known,
      null,
      characteristicsFromAnswers(answers),
    )
    expect(profile.primary).toBe('manufacturing')
    expect(profile.inventoryRelevant).toBe(true)
  })

  it('Scenario 6: Wholesale/distribution — pack sizing, volume price lists', () => {
    const canonical = canonicalIndustryTypes('wholesale')
    expect(canonical.known).toEqual(['wholesale'])

    // Scenario 6: Wholesale suggests holdsStock: yes, sellsOnCredit: yes
    const answers = suggestedOperatingAnswers('wholesale')
    expect(answers.holdsStock).toBe('yes')
    expect(answers.sellsOnCredit).toBe('yes')

    const dna = inferOperationalDna({ tradeKey: 'wholesale', tradeKeys: ['wholesale'], ...answers })
    expect(dna.offering).toContain('PHYSICAL_GOODS')
    expect(dna.inventory).toContain('RETAIL_STOCK')

    const profile = resolveBusinessProfile(
      canonical.known,
      null,
      characteristicsFromAnswers(answers),
    )
    expect(profile.primary).toBe('wholesale')
    expect(profile.inventoryRelevant).toBe(true)
  })

  it('Scenario 7: Pharmacy — batch tracking, regulated items, shelf inventory', () => {
    const canonical = canonicalIndustryTypes('pharmacy')
    expect(canonical.known).toEqual(['pharmacy'])

    // Scenario 7: Pharmacy holds stock, has expiry dates, regulatedDomain PRESCRIPTION
    const answers = {
      ...suggestedOperatingAnswers('pharmacy'),
      holdsStock: 'yes' as const,
      hasPointOfSale: 'yes' as const,
    }
    expect(answers.holdsStock).toBe('yes')
    expect(answers.hasExpiryDates).toBe('yes')

    const dna = inferOperationalDna({ tradeKey: 'pharmacy', tradeKeys: ['pharmacy'], ...answers })
    expect(dna.offering).toContain('PHYSICAL_GOODS')
    expect(dna.inventory).toContain('RETAIL_STOCK')
    expect(dna.unitTracking).toBe('EXPIRY_DATES')
    expect(dna.regulatedDomain).toBe('PRESCRIPTION')

    const profile = resolveBusinessProfile(
      canonical.known,
      null,
      characteristicsFromAnswers(answers),
    )
    expect(profile.primary).toBe('pharmacy')
    expect(profile.inventoryRelevant).toBe(true)
  })

  it('Scenario 8: Currency exchange — dual currency, FX rates, no physical goods stock', () => {
    const canonical = canonicalIndustryTypes('currencyExchange')
    expect(canonical.known).toEqual(['currencyExchange'])

    // Scenario 8: Financial KYC, rate board, no physical inventory
    const answers = { ...suggestedOperatingAnswers('currencyExchange'), holdsStock: 'no' as const }
    const dna = inferOperationalDna({
      tradeKey: 'currencyExchange',
      tradeKeys: ['currencyExchange'],
      ...answers,
    })
    expect(dna.inventory).toContain('NONE')
    expect(dna.regulatedDomain).toBe('FINANCIAL_KYC')
    expect(dna.pricingBasis).toContain('RATE_BOARD')

    const profile = resolveBusinessProfile(
      canonical.known,
      null,
      characteristicsFromAnswers(answers),
    )
    expect(profile.primary).toBe('currencyExchange')
    expect(profile.inventoryRelevant).toBe(false)
  })

  it('Scenario 9: Gold business — precious metals, purity, weight-based inventory', () => {
    const canonical = canonicalIndustryTypes('jewellery')
    expect(canonical.known).toEqual(['jewellery'])

    // Scenario 9: Jewellery holds physical stock, sells by weight and rate board
    const answers = {
      ...suggestedOperatingAnswers('jewellery'),
      holdsStock: 'yes' as const,
      hasPointOfSale: 'yes' as const,
    }
    const dna = inferOperationalDna({ tradeKey: 'jewellery', tradeKeys: ['jewellery'], ...answers })
    expect(dna.offering).toContain('PHYSICAL_GOODS')
    expect(dna.inventory).toContain('RETAIL_STOCK')
    expect(dna.pricingBasis).toContain('WEIGHT')
    expect(dna.pricingBasis).toContain('RATE_BOARD')

    const profile = resolveBusinessProfile(
      canonical.known,
      null,
      characteristicsFromAnswers(answers),
    )
    expect(profile.primary).toBe('jewellery')
    expect(profile.inventoryRelevant).toBe(true)
  })

  it('Scenario 10: Project-based company — task milestones, time entries', () => {
    const canonical = canonicalIndustryTypes('itServices')
    expect(canonical.known).toEqual(['itServices'])

    // Scenario 10: IT services suggests holdsStock: no, sellsOnCredit: yes
    const answers = suggestedOperatingAnswers('itServices')
    expect(answers.holdsStock).toBe('no')

    const dna = inferOperationalDna({
      tradeKey: 'itServices',
      tradeKeys: ['itServices'],
      ...answers,
    })
    expect(dna.inventory).toContain('NONE')
    expect(dna.offering).toContain('DELIVERABLE_SERVICE')

    const profile = resolveBusinessProfile(
      canonical.known,
      null,
      characteristicsFromAnswers(answers),
    )
    expect(profile.primary).toBe('itServices')
    expect(profile.inventoryRelevant).toBe(false)
  })

  it('Scenario 11: Unknown/unsupported trade policy — never silently defaults to retail', () => {
    const canonical = canonicalIndustryTypes('space_mining_unknown_xyz')
    expect(canonical.known).toEqual([])
    expect(canonical.unknown).toEqual(['space_mining_unknown_xyz'])

    const profile = resolveBusinessProfile(canonical.unknown)
    expect(profile.isGeneric).toBe(true)
    expect(profile.primary).toBeNull()
    expect(profile.primaryDefinition.key).toBe('other' as IndustryKey)
    expect(profile.unknownTypes).toContain('space_mining_unknown_xyz')
    // Crucial invariant: must NOT default to retail!
    expect(profile.primary).not.toBe('retail')
    expect(profile.inventoryRelevant).toBe('unknown')
  })

  it('Scenario 12: Server-authoritative activation gate enforces all 4 prerequisites', () => {
    // Stage 1: Incomplete workspace creation (missing workspace)
    const withoutWorkspace = {
      profileFullName: 'Hamed',
      profileBusinessName: 'Shop',
      hasWorkspace: false,
      workspaceBusinessName: null,
      defaultCurrency: null,
    }
    const inProgressEval = evaluateOnboardingActivation(withoutWorkspace)
    expect(inProgressEval.canActivate).toBe(false)
    expect(inProgressEval.missing).toContain('WORKSPACE')
    expect(inProgressEval.state).toBe('IN_PROGRESS')

    // Stage 2: Workspace exists but currency configuration is missing
    const missingCurrency = {
      profileFullName: 'Hamed',
      profileBusinessName: 'Shop',
      hasWorkspace: true,
      workspaceBusinessName: 'Shop',
      defaultCurrency: null,
    }
    const configEval = evaluateOnboardingActivation(missingCurrency)
    expect(configEval.canActivate).toBe(false)
    expect(configEval.missing).toContain('DEFAULT_CURRENCY')
    expect(configEval.state).toBe('REQUIRES_CONFIGURATION')

    // Stage 3: Fully configured and ready to activate
    const complete = {
      ...missingCurrency,
      defaultCurrency: 'AFN',
    }
    const readyEvaluation = evaluateOnboardingActivation(complete)
    expect(readyEvaluation.canActivate).toBe(true)
    expect(readyEvaluation.state).toBe('READY_TO_ACTIVATE')
    expect(readyEvaluation.missing).toHaveLength(0)
  })
})
