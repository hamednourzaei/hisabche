// ============================================
// BUG-087 — «today» on the dashboard was cut at UTC midnight.
//
// Reported 27 Sep 2026: two sales on the same local day (125,000,000 and
// 3,000,000); the dashboard showed 3,000,000 for today and counted the other
// as yesterday's. UTC midnight is 03:30 in Tehran and 04:30 in Kabul, so
// everything sold between local midnight and then fell on the wrong day.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { DEFAULT_BUSINESS_TIME_ZONE, resolveTimeZone, startOfLocalDayISO } from '../utils/local-day'

describe('where the local day starts', () => {
  it('Tehran (+03:30): at 01:00 on the 27th the day began on the 26th at 20:30Z', () => {
    const oneAm = new Date('2026-09-26T21:30:00Z') // 01:00 on the 27th in Tehran
    expect(startOfLocalDayISO('Asia/Tehran', oneAm)).toBe('2026-09-26T20:30:00.000Z')
  })

  it('the reported case: a sale at 23:00 and one at 01:00 are on different local days', () => {
    const now = new Date('2026-09-26T22:00:00Z') // 01:30 on the 27th in Tehran
    const start = startOfLocalDayISO('Asia/Tehran', now)
    const lateEvening = '2026-09-26T19:30:00.000Z' // 23:00 on the 26th — yesterday
    const afterMidnight = '2026-09-26T21:30:00.000Z' // 01:00 on the 27th — today
    expect(lateEvening >= start).toBe(false)
    expect(afterMidnight >= start).toBe(true)
    // The old boundary (UTC midnight of the 26th) called BOTH of them today.
    expect(lateEvening >= '2026-09-26T00:00:00.000Z').toBe(true)
  })

  it('Kabul (+04:30) and UTC', () => {
    const instant = new Date('2026-09-27T10:00:00Z')
    expect(startOfLocalDayISO('Asia/Kabul', instant)).toBe('2026-09-26T19:30:00.000Z')
    expect(startOfLocalDayISO('UTC', instant)).toBe('2026-09-27T00:00:00.000Z')
  })

  it('a zone with daylight saving: the day of the change still starts at local midnight', () => {
    // Berlin leaves DST on 25 Oct 2026 at 03:00 local. At 12:00Z that day the
    // offset is +01:00, but midnight was still +02:00.
    expect(startOfLocalDayISO('Europe/Berlin', new Date('2026-10-25T12:00:00Z'))).toBe(
      '2026-10-24T22:00:00.000Z',
    )
  })
})

describe('the zone is validated, with an explicit default', () => {
  it('a known IANA zone is kept', () => {
    expect(resolveTimeZone('Asia/Kabul')).toBe('Asia/Kabul')
  })

  it.each([undefined, '', 'Mars/Olympus', 42, 'x'.repeat(100), "Asia/Tehran'; DROP"])(
    '%s → the default',
    (input) => {
      expect(resolveTimeZone(input)).toBe(DEFAULT_BUSINESS_TIME_ZONE)
    },
  )

  it('the default is stated, and is not the server zone', () => {
    expect(DEFAULT_BUSINESS_TIME_ZONE).toBe('Asia/Tehran')
  })
})

describe('the dashboard uses it', () => {
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const read = (...p: string[]) => strip(readFileSync(join(__dirname, '..', ...p), 'utf8'))

  it('the service has no UTC-midnight «today» left, and keys its cache by zone', () => {
    const service = read('services', 'analytics.service.ts')
    expect(service).not.toContain('startOfTodayISO')
    expect(service).toContain('startOfLocalDayISO(timeZone)')
    expect(service).toContain('`dashboard:v3:${workspaceId}:${timeZone}`')
  })

  it('the route validates the zone before the service sees it', () => {
    const route = read('routes', 'analytics.routes.ts')
    expect(route).toContain('resolveTimeZone(')
    expect(route).toContain('analyticsService.getDashboardKpis(request.tenancy, timeZone)')
  })

  it('the client sends its zone', () => {
    const hook = strip(
      readFileSync(
        join(__dirname, '..', '..', '..', 'packages', 'api', 'src', 'hooks', 'dashboard.ts'),
        'utf8',
      ),
    )
    expect(hook).toContain('Intl.DateTimeFormat().resolvedOptions().timeZone')
    expect(hook).toContain("apiClient.get('/analytics/dashboard', { params: tz ? { tz } : {} })")
  })
})
