// V54 5.3 / 5.8 (8 Nov 2026) — adaptive operating questions decide the DNA.
import { describe, expect, it } from 'vitest'
import {
  inferOperationalDna,
  operatingAnswersSchema,
  operatingQuestionsFor,
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
