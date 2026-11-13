// ============================================
// packages/validation/src/__tests__/first-value.test.ts
//
// V65 · V64 §7 — the First Value Checklist is DERIVED, not switched per industry,
// and every route it offers must be a real destination.
//
// The defect: the component keyed on `archetypeHint` and fell through to RETAIL,
// so a consultant was told to add a product. A consultant keeps no stock.
// ============================================

import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { firstValueSteps } from '../schemas/first-value'
import { inferOperationalDna, resolveDnaCapabilities } from '../schemas/operational-dna'

const REPO_ROOT = resolve(__dirname, '../../../..')

const stepsFor = (tradeKey: string, answers: Record<string, string> = {}) => {
  const dna = inferOperationalDna({ tradeKey, ...answers })
  return { dna, steps: firstValueSteps(dna, resolveDnaCapabilities(dna).activeModules) }
}

function messageAt(lang: string, key: string): string | undefined {
  const catalogue = JSON.parse(
    readFileSync(resolve(REPO_ROOT, 'packages/i18n/messages', lang, 'common.json'), 'utf8'),
  ) as Record<string, unknown>
  let node: unknown = catalogue
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined
    node = (node as Record<string, unknown>)[part]
  }
  return typeof node === 'string' ? node : undefined
}

describe('firstValueSteps — the domain decides', () => {
  it('a shop gets a product step and a sale, never an appointment', () => {
    const { steps } = stepsFor('retail')
    expect(steps.map((step) => step.id)).toEqual(['catalogue', 'party', 'document'])
    expect(steps[0]?.route).toBe('/warehouse?add=true')
    expect(steps.at(-1)?.titleKey).toBe('firstValue.document.saleTitle')
  })

  it('a consultant is never sent to a warehouse', () => {
    const { dna, steps } = stepsFor('consulting')
    expect(dna.inventory).toEqual(['NONE'])
    expect(steps.some((step) => step.route.startsWith('/warehouse'))).toBe(false)
    expect(steps.map((step) => step.id)).toEqual(['party', 'document'])
  })

  it('a salon gets a service, an appointment and the invoice', () => {
    const { steps } = stepsFor('barber')
    expect(steps.map((step) => step.id)).toEqual(['catalogue', 'party', 'appointment', 'document'])
    expect(steps[0]?.titleKey).toBe('firstValue.catalogue.serviceTitle')
    expect(steps[2]?.completesOn).toBe('sessions')
  })

  it('a workshop records a repair order, not a sale', () => {
    const { steps } = stepsFor('repairs')
    expect(steps.at(-1)?.titleKey).toBe('firstValue.document.jobTitle')
  })

  it('«other» with nothing answered gets the universal core only — no Retail default', () => {
    const { steps } = stepsFor('other')
    expect(steps.map((step) => step.id)).toEqual(['party', 'document'])
    expect(steps.some((step) => step.titleKey.includes('goods'))).toBe(false)
  })

  it('a corporate sale gets the mixed catalogue step, never two catalogue steps', () => {
    const { steps } = stepsFor('beautySalon', { holdsStock: 'yes' })
    const catalogue = steps.filter((step) => step.id === 'catalogue')
    expect(catalogue).toHaveLength(1)
    expect(catalogue[0]?.titleKey).toBe('firstValue.catalogue.mixedTitle')
  })

  it('a step whose module is not active is not offered', () => {
    const dna = inferOperationalDna({ tradeKey: 'retail' })
    expect(firstValueSteps(dna, []).some((step) => step.id === 'catalogue')).toBe(false)
    expect(firstValueSteps(dna, ['products']).some((step) => step.id === 'catalogue')).toBe(true)
  })

  it('every destination is one of the verified addresses, and every key is translated', () => {
    const allowedRoutes = new Set([
      '/warehouse?add=true',
      '/warehouse?view=products',
      '/customers?add=true',
      '/customers?tab=sessions',
      '/invoices/new',
    ])
    const trades = ['retail', 'wholesale', 'consulting', 'barber', 'repairs', 'other', 'pharmacy']
    for (const tradeKey of trades) {
      const { steps } = stepsFor(tradeKey)
      expect(steps.length).toBeGreaterThan(0)
      for (const step of steps) {
        expect(allowedRoutes.has(step.route), `${tradeKey}: ${step.route}`).toBe(true)
        for (const lang of ['fa', 'af', 'en']) {
          expect(
            messageAt(lang, step.titleKey),
            `${lang} is missing ${step.titleKey} (${tradeKey})`,
          ).toBeTruthy()
          expect(messageAt(lang, step.descKey), `${lang} is missing ${step.descKey}`).toBeTruthy()
        }
      }
    }
  })
})
