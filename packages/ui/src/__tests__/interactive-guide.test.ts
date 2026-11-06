// ============================================
// packages/ui/src/__tests__/interactive-guide.test.ts
// Unit Tests for Interactive Guide Component & Route Catalog
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GUIDE_CATALOG, guidePageAnchor } from '@hisabche/ui-contract'

const LOCALES = ['fa', 'af', 'en'] as const
const ROOT = join(__dirname, '../../../..')

const catalogs = Object.fromEntries(
  LOCALES.map((locale) => [
    locale,
    JSON.parse(
      readFileSync(join(ROOT, 'packages/i18n/messages', locale, 'common.json'), 'utf8'),
    ) as { guide?: Record<string, unknown> },
  ]),
)

const resolve = (catalog: unknown, key: string): unknown =>
  key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], catalog)

const allSteps = Object.entries(GUIDE_CATALOG).flatMap(([route, steps]) =>
  steps.map((step) => ({ route, step })),
)

describe('GUIDE_CATALOG route inventory coverage', () => {
  const mandatoryRoutes = [
    'dashboard',
    'invoices',
    'customers',
    'warehouse',
    'accounting',
    'billing',
  ]

  it('covers all major business routes with ordered guide steps', () => {
    for (const route of mandatoryRoutes) {
      expect(GUIDE_CATALOG[route]).toBeDefined()
      expect(GUIDE_CATALOG[route]?.length).toBeGreaterThan(0)

      const steps = GUIDE_CATALOG[route]!
      steps.forEach((step, idx) => {
        expect(step.order).toBe(idx + 1)
        expect(step.id).toBeTruthy()
        expect(step.titleKey).toContain('guide.')
        expect(step.descriptionKey).toContain('guide.')
      })
    }
  })

  it('points every step at a section on its own screen', () => {
    for (const route of Object.keys(GUIDE_CATALOG)) {
      const anchors = GUIDE_CATALOG[route]!.map((step) => step.sectionId)
      // A step with no anchor would fall back to the corner of the page — the
      // placement this guide exists to stop.
      for (const anchor of anchors) expect(anchor).toBeTruthy()
      // The page-level anchor is the designed fallback of its own route only.
      for (const anchor of anchors) {
        if (anchor.endsWith('-page')) {
          expect(anchor).toBe(guidePageAnchor(route))
        }
      }
    }
  })

  it('gives every step a distinct id', () => {
    const ids = allSteps.map(({ step }) => step.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('guide copy exists in every language', () => {
  it.each(LOCALES)('every step title and description is written in %s', (locale) => {
    const missing = allSteps.flatMap(({ step }) =>
      [step.titleKey, step.descriptionKey].filter(
        (key) => typeof resolve(catalogs[locale], key) !== 'string',
      ),
    )
    expect(missing).toEqual([])
  })

  it.each(LOCALES)('the card chrome is written in %s', (locale) => {
    const missing = [
      'guide.badge',
      'guide.next',
      'guide.finish',
      'guide.persistentTip',
      'guide.regionLabel',
      'guide.short',
      'common.close',
    ].filter((key) => typeof resolve(catalogs[locale], key) !== 'string')
    expect(missing).toEqual([])
  })

  it('writes the copy, rather than leaving a key or a placeholder behind', () => {
    for (const locale of LOCALES) {
      for (const { step } of allSteps) {
        for (const key of [step.titleKey, step.descriptionKey]) {
          const text = resolve(catalogs[locale], key) as string
          expect(text.trim().length).toBeGreaterThan(3)
          // A raw key on screen is what the first version shipped.
          expect(text).not.toBe(key)
          expect(text).not.toMatch(/^guide\./)
        }
      }
    }
  })
})
