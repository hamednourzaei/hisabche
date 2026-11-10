// V54 5.3 / 5.8 (8 Nov 2026) — adaptive operating questions decide the DNA.
import { describe, expect, it } from 'vitest'
import {
  inferOperationalDna,
  operationalDnaSchema,
  operatingAnswersSchema,
  operatingQuestionsFor,
  resolveDnaCapabilities,
  suggestedOperatingAnswers,
} from '../schemas/operational-dna'
import { INDUSTRY_KEYS } from '../schemas/industry-profiles'

describe('the person answers, the trade only suggests', () => {
  it('a barber who says «no appointments» is not booked', () => {
    const dna = inferOperationalDna({ tradeKey: 'barber', takesAppointments: 'no' })
    expect(dna.intake).not.toContain('APPOINTMENT_BOOKING')
  })

  it('an unanswered question keeps the trade default', () => {
    const dna = inferOperationalDna({ tradeKey: 'barber', takesAppointments: 'unknown' })
    expect(dna.intake).toContain('APPOINTMENT_BOOKING')
  })

  it('the reference nail technician: booked service + consumables + retail + deposit, solo', () => {
    const dna = inferOperationalDna({
      tradeKey: 'beautySalon',
      holdsStock: 'yes',
      hasStaff: 'no',
      locations: 'single',
    })
    expect(dna.offering).toEqual(['TIME_SERVICE', 'PHYSICAL_GOODS'])
    expect(dna.intake).toContain('APPOINTMENT_BOOKING')
    expect(dna.inventory).toEqual(['SERVICE_CONSUMABLES', 'RETAIL_STOCK'])
    expect(dna.settlement).toContain('DEPOSIT_PREPAYMENT')
    expect(dna.workforce).toEqual(['SOLO_OWNER'])
    expect(dna.customer).toEqual(['CLIENT_CARE_PROFILE'])
  })

  it('the same salon after hiring and opening a branch (5.8 growth)', () => {
    const dna = inferOperationalDna({
      tradeKey: 'beautySalon',
      holdsStock: 'yes',
      hasStaff: 'yes',
      locations: 'multiple',
    })
    expect(dna.workforce).not.toContain('SOLO_OWNER')
    expect(dna.topology).toContain('MULTI_BRANCH')
  })

  it('a shop that sells on credit gets customer credit', () => {
    expect(inferOperationalDna({ tradeKey: 'grocery', sellsOnCredit: 'yes' }).settlement).toContain(
      'CUSTOMER_CREDIT',
    )
  })
})

describe('adaptive: which questions are shown', () => {
  it('no stock ⇒ no production or counter question', () => {
    const shown = operatingQuestionsFor({ holdsStock: 'no' })
    expect(shown).not.toContain('producesGoods')
    expect(shown).not.toContain('hasPointOfSale')
  })
  it('stock ⇒ both are asked', () => {
    const shown = operatingQuestionsFor({ holdsStock: 'yes' })
    expect(shown).toEqual(expect.arrayContaining(['producesGoods', 'hasPointOfSale']))
  })
})

describe('suggestions and the closed answer shape', () => {
  it('beautySalon is a selectable trade and suggests appointments', () => {
    expect(INDUSTRY_KEYS).toContain('beautySalon')
    expect(suggestedOperatingAnswers('beautySalon').takesAppointments).toBe('yes')
  })
  it('an unknown trade suggests nothing', () => {
    expect(suggestedOperatingAnswers('somethingNew')).toEqual({})
  })
  it('answers outside the closed list are refused', () => {
    expect(operatingAnswersSchema.safeParse({ hasStaff: 'maybe' }).success).toBe(false)
    expect(operatingAnswersSchema.safeParse({ salary: 'yes' }).success).toBe(false)
    expect(operatingAnswersSchema.safeParse({ locations: 'multiple' }).success).toBe(true)
  })
})

// ─── V55 P1: unit-level tracking questions ──────────────────────────────────

describe('unit tracking questions (V55 P1)', () => {
  it('a stock-keeping business is asked about serials and expiry dates', () => {
    const shown = operatingQuestionsFor({ holdsStock: 'yes' })
    expect(shown).toContain('tracksSerials')
    expect(shown).toContain('hasExpiryDates')
  })

  it('a service with no stock is asked neither', () => {
    const shown = operatingQuestionsFor({ holdsStock: 'no' })
    expect(shown).not.toContain('tracksSerials')
    expect(shown).not.toContain('hasExpiryDates')
  })

  it('a phone shop suggests serial tracking; a pharmacy suggests expiry dates', () => {
    expect(suggestedOperatingAnswers('mobilePhones').tracksSerials).toBe('yes')
    expect(suggestedOperatingAnswers('pharmacy').hasExpiryDates).toBe('yes')
    // Neither trade fabricates the other answer.
    expect(suggestedOperatingAnswers('mobilePhones').hasExpiryDates).toBeUndefined()
  })

  it('only what was SAID reaches the DNA axis — unanswered stays absent, never a fabricated tracker', () => {
    expect(inferOperationalDna({ holdsStock: 'yes' }).unitTracking).toBeUndefined()
    expect(
      inferOperationalDna({
        holdsStock: 'yes',
        tracksSerials: 'unknown',
        hasExpiryDates: 'unknown',
      }).unitTracking,
    ).toBeUndefined()
  })

  it('the answers decide the axis, not the trade', () => {
    // A pharmacy that says no expiry tracking (and says nothing about
    // serials) has NO resolved axis: «unknown serials» is not «no serials»,
    // and a half-known answer never becomes a fabricated NONE.
    expect(
      inferOperationalDna({ tradeKey: 'pharmacy', hasExpiryDates: 'no' }).unitTracking,
    ).toBeUndefined()
    // Both answers explicit «no» IS a resolved «no tracking».
    expect(
      inferOperationalDna({ tradeKey: 'pharmacy', hasExpiryDates: 'no', tracksSerials: 'no' })
        .unitTracking,
    ).toBe('NONE')
    expect(inferOperationalDna({ tradeKey: 'barber', tracksSerials: 'yes' }).unitTracking).toBe(
      'SERIAL_NUMBERS',
    )
    expect(inferOperationalDna({ tracksSerials: 'yes', hasExpiryDates: 'yes' }).unitTracking).toBe(
      'BOTH',
    )
  })

  it('the axis requests exactly the capabilities whose workflow exists', () => {
    // `resolveDnaCapabilities().capabilities` is the CapabilityResolution
    // object; the list that is ON is its own `.capabilities`.
    const serial = resolveDnaCapabilities(
      inferOperationalDna({ holdsStock: 'yes', tracksSerials: 'yes' }),
    ).capabilities
    expect(serial.capabilities).toContain('serialized_items')
    expect(serial.capabilities).not.toContain('batch_expiry')

    const expiry = resolveDnaCapabilities(
      inferOperationalDna({ holdsStock: 'yes', hasExpiryDates: 'yes' }),
    ).capabilities
    expect(expiry.capabilities).toContain('batch_expiry')
    expect(expiry.capabilities).not.toContain('serialized_items')
  })

  it('a DNA saved before the axis exists parses and requests nothing', () => {
    const legacy = {
      version: 1,
      offering: ['PHYSICAL_GOODS'],
      intake: ['COUNTER_POS'],
      inventory: ['RETAIL_STOCK'],
      settlement: ['IMMEDIATE_SETTLEMENT'],
      workforce: ['SOLO_OWNER'],
      customer: ['STANDARD_PARTY'],
      topology: ['SINGLE_LOCATION'],
    }
    expect(operationalDnaSchema.safeParse(legacy).success).toBe(true)
    expect(resolveDnaCapabilities(legacy as never).capabilities.capabilities).not.toContain(
      'serialized_items',
    )
  })
})
