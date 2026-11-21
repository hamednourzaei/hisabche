// ============================================
// packages/ui/src/__tests__/billing-expired-renewal.test.ts
//
// The owner's report: «اشتراک لولوخان الان کامل تموم شده اما …» and
// «هیچ گزینه ارتقایی در اینجا نیست». An expired enterprise workspace saw NO
// plan cards at all, because the block was hidden for enterprise and the
// current-plan card was disabled for everyone. This guard pins the two fixes:
//
//   1. expiry comes from the server (`access.expired`), never the browser clock;
//   2. the plans render when `expired`, even on enterprise;
//   3. the lapsed plan is a RENEWAL, not a disabled «current» card;
//   4. the strings exist in fa, af and en.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..', '..', '..', '..')
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8')
const code = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s+/g, ' ')

const container = code(
  read(
    'packages',
    'ui',
    'src',
    'components',
    'ui',
    'billing',
    'containers',
    'BillingContainer.tsx',
  ),
)
const pricing = code(
  read('packages', 'ui', 'src', 'components', 'ui', 'billing', 'PricingPage.tsx'),
)

describe('expired subscription renewal', () => {
  it('reads expiry from the server response', () => {
    expect(container).toContain('subscription.access?.expired === true')
  })

  it('keeps the plan cards reachable for an expired enterprise workspace', () => {
    expect(container).toContain(
      "subscription.plan !== 'enterprise' || subscription.isTrial || expired",
    )
    expect(container).toContain('expired={expired}')
    expect(container).toContain('data-subscription-expired')
  })

  it('turns the lapsed plan into a renewal instead of a current plan', () => {
    expect(pricing).toContain('const currentRank = expired ? 0 :')
    expect(pricing).toContain('const isRenewal = expired && currentPlan === plan.plan')
    expect(pricing).toContain('const isCurrent = currentPlan === plan.plan && !isTrial && !expired')
    expect(pricing).toContain("t('billing.renewPlan')")
    expect(pricing).toContain("t('billing.renewTitle'")
  })

  it('every new string exists in fa, af and en', () => {
    const keys = [
      'billing.expiredTitle',
      'billing.expiredDesc',
      'billing.expiredOn',
      'billing.renewPlan',
      'billing.renewTitle',
      'billing.renewHowItWorks',
    ]
    for (const locale of ['fa', 'af', 'en'] as const) {
      const bundle = JSON.parse(
        readFileSync(join(ROOT, 'packages', 'i18n', 'messages', locale, 'common.json'), 'utf8'),
      ) as Record<string, unknown>
      for (const key of keys) {
        let node: unknown = bundle
        for (const part of key.split('.')) {
          node =
            typeof node === 'object' && node !== null
              ? (node as Record<string, unknown>)[part]
              : undefined
        }
        expect(typeof node, `${locale}:${key}`).toBe('string')
      }
    }
  })
})
