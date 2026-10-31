// ============================================
// «Today» on a document is the BUSINESS's day, not UTC's.
//
// At 20:00 UTC it is already tomorrow in Kabul (UTC+4:30). A report, a journal
// entry, a promotion window or an expiry check that took the UTC date used the
// wrong day for every shop east of Greenwich for the evening hours — and the
// wrong day for every shop west of it in the early morning.
//
// Two checks: the conversion itself at the boundaries that matter, and a scan
// proving the accounting-facing files no longer reach for the UTC date.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { businessDayOf } from '../utils/local-day'

const at = (iso: string) => new Date(iso)

describe('businessDayOf — the business day of an instant', () => {
  it('Kabul (UTC+4:30): 20:00 UTC is already the next day', () => {
    expect(businessDayOf(at('2026-10-31T20:00:00Z'), 'Asia/Kabul')).toBe('2026-11-01')
    expect(businessDayOf(at('2026-10-31T19:29:59Z'), 'Asia/Kabul')).toBe('2026-10-31')
    expect(businessDayOf(at('2026-10-31T19:30:00Z'), 'Asia/Kabul')).toBe('2026-11-01')
  })

  it('a UTC-negative zone (Los Angeles): 03:00 UTC is still the previous day', () => {
    expect(businessDayOf(at('2026-11-01T03:00:00Z'), 'America/Los_Angeles')).toBe('2026-10-31')
  })

  it('the midnight boundary is the zone’s midnight, not UTC’s', () => {
    expect(businessDayOf(at('2026-10-31T23:59:59Z'), 'UTC')).toBe('2026-10-31')
    expect(businessDayOf(at('2026-11-01T00:00:00Z'), 'UTC')).toBe('2026-11-01')
    expect(businessDayOf(at('2026-10-31T23:59:59Z'), 'Asia/Tokyo')).toBe('2026-11-01')
  })

  it('a daylight-saving zone changes its offset on the transition day', () => {
    // US clocks go back on 1 Nov 2026: 06:30 UTC is 23:30 the day before in LA both sides of it.
    expect(businessDayOf(at('2026-11-01T06:30:00Z'), 'America/Los_Angeles')).toBe('2026-10-31')
    expect(businessDayOf(at('2026-11-01T08:00:00Z'), 'America/Los_Angeles')).toBe('2026-11-01')
  })
})

const UTC_DAY = 'new Date().toISOString().slice(0, 10)'

/** Files whose «today» lands on a document, a report or a price window. */
const MUST_USE_BUSINESS_DAY = [
  'routes/accounting.routes.ts',
  'routes/finance-ops.routes.ts',
  'routes/operations.routes.ts',
  'services/analysis/analysis.service.ts',
  'services/assets/assets.service.ts',
  'services/commerce/promotion.service.ts',
  'services/customer-profile/customer-profile.service.ts',
  'services/financing/financing.service.ts',
  'services/inventory-costing/costing.service.ts',
  'services/manufacturing.service.ts',
  'services/orders/orders.service.ts',
  'services/reporting/report.service.ts',
]

describe('the accounting-facing files do not take the UTC date', () => {
  for (const file of MUST_USE_BUSINESS_DAY) {
    it(file, () => {
      const source = readFileSync(join(__dirname, '..', file), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
      expect(source).not.toContain(UTC_DAY)
      expect(source).toContain('businessDayOf')
    })
  }
})
