// Owner, 18 Oct 2026: /invoices showed 440M of sales and the dashboard still
// had the old figure. Every dashboard read uses the same live settings, and
// they must not drift back to a long stale window resting on Realtime alone.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { DASHBOARD_LIVE } from '../hooks/dashboard'

const src = readFileSync(join(__dirname, '..', 'hooks', 'dashboard.ts'), 'utf8')

describe('the dashboard is almost live', () => {
  it('stale within seconds, re-read on focus and on mount, polled only while visible', () => {
    expect(DASHBOARD_LIVE.staleTime).toBeLessThanOrEqual(10_000)
    expect(DASHBOARD_LIVE.refetchOnWindowFocus).toBe(true)
    expect(DASHBOARD_LIVE.refetchOnMount).toBe('always')
    expect(DASHBOARD_LIVE.refetchInterval).toBeLessThanOrEqual(30_000)
    expect(DASHBOARD_LIVE.refetchIntervalInBackground).toBe(false)
  })

  it('KPIs, insights and the sales chart all use it — none has its own staleTime', () => {
    expect(src.split('...DASHBOARD_LIVE,').length - 1).toBe(3)
    expect(src).not.toMatch(/staleTime: 1?[0-9]{2}_000/)
  })
})
