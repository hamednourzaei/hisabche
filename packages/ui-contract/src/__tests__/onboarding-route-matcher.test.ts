// packages/ui-contract/src/__tests__/onboarding-route-matcher.test.ts
import { describe, expect, it } from 'vitest'
import { isOnboardingRoute } from '../navigation'

describe('isOnboardingRoute matcher', () => {
  it.each([
    '/onboarding',
    '/onboarding/',
    '/onboarding/step-2',
    '/fa/onboarding',
    '/af/onboarding',
    '/en/onboarding',
    '/fa/onboarding/',
    '/en/onboarding/business-type',
    '/fa/onboarding?step=1',
    '/af/onboarding#currency',
  ])('matches %s as onboarding route', (path) => {
    expect(isOnboardingRoute(path)).toBe(true)
  })

  it.each([
    '/dashboard',
    '/fa/dashboard',
    '/invoices',
    '/fa/invoices/new',
    '/billing',
    '/settings',
    '/warehouse',
    '/onboarding-fake',
    '/fa/onboarding-extra',
    '',
    null,
    undefined,
  ])('does not match %s as onboarding route', (path) => {
    expect(isOnboardingRoute(path)).toBe(false)
  })
})
