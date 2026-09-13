// ============================================
// The expired-subscription lock notice.
//
// The server refuses writes (402 SUBSCRIPTION_EXPIRED); the UI explains. These
// pin the explanation: which routes stay open, that the way out keeps the
// reader's locale, that both shells gate with the same notice, that the
// strings exist in all three locales (t() throws on a missing key), and that
// the invoice detail withholds its write controls.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { billingHref, isRouteAllowedWhenExpired } from '../components/ui/billing/subscription-lock'

const ROOT = join(__dirname, '..', '..', '..', '..')

function code(relative: string): string {
  return readFileSync(join(ROOT, relative), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

describe('routes open while expired', () => {
  it.each([
    '/fa/dashboard',
    '/en/invoices',
    '/af/invoices/abc-123',
    '/fa/billing',
    '/',
    '/invoices/42',
  ])('%s stays open', (path) => expect(isRouteAllowedWhenExpired(path)).toBe(true))

  it.each([
    '/fa/invoices/new',
    '/fa/invoices/new/preview',
    '/en/customers',
    '/af/settings',
    '/warehouse',
    '/fa/billingx',
  ])('%s is locked', (path) => expect(isRouteAllowedWhenExpired(path)).toBe(false))
})

describe('the way out keeps the locale', () => {
  it.each(['fa', 'af', 'en'])('%s → /%s/billing', (lang) => {
    expect(billingHref(lang)).toBe(`/${lang}/billing`)
  })

  it('the notice links through billingHref with the current locale, never a bare /billing', () => {
    const src = code('packages/ui/src/components/ui/billing/subscription-lock.tsx')
    expect(src).toContain('href={billingHref(locale, Boolean(hashRouter))}')
    expect(src).not.toContain('href="/billing"')
    expect(src).toContain('<Lock')
  })
})

describe('both shells gate with the one notice', () => {
  it.each([
    'apps/web/app/[lang]/(dashboard)/dashboard-layout.tsx',
    'apps/desktop/src/components/layout/app-shell.tsx',
  ])('%s', (file) => {
    const src = code(file)
    expect(src).toContain('isRouteAllowedWhenExpired(')
    expect(src).toContain('<SubscriptionLockNotice')
    expect(src).toContain('<SubscriptionLockDialog')
  })
})

describe('invoice detail withholds write controls when locked', () => {
  it('payments and workflow actions depend on subscriptionLocked', () => {
    const src = code(
      'packages/ui/src/components/ui/invoice-detail/containers/invoice-detail-container.tsx',
    )
    expect(src).toContain('onRecordPayment={')
    expect(src).toMatch(/onRecordPayment=\{\s*subscriptionLocked\s*\?\s*undefined/)
    expect(src).toMatch(/onCancelPayment=\{\s*subscriptionLocked\s*\?\s*undefined/)
    expect(src).toMatch(/workflowActions=\{\s*subscriptionLocked\s*\?\s*\[\]/)
  })
})

describe('strings exist in every locale', () => {
  it.each(['fa', 'af', 'en'])('%s', (lang) => {
    const messages = JSON.parse(
      readFileSync(join(ROOT, 'packages', 'i18n', 'messages', lang, 'common.json'), 'utf8'),
    ) as { subscriptionLock?: Record<string, unknown> }
    for (const key of ['title', 'description', 'cta']) {
      const value = messages.subscriptionLock?.[key]
      expect(typeof value === 'string' && value.trim().length > 0).toBe(true)
    }
  })
})
