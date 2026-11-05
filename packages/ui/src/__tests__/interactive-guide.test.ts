// ============================================
// packages/ui/src/__tests__/interactive-guide.test.ts
// Unit Tests for Interactive Guide Component & Route Catalog
// ============================================

import { describe, expect, it } from 'vitest'
import { GUIDE_CATALOG } from '@hisabche/ui-contract'

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
})
