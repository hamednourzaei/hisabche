// ============================================
// backend/src/__tests__/admin-insights.test.ts
//
// V63 — the admin items that were ⛔ in the 113 table (#10 #12 #49 #58 #69 #79
// #84 #89 #94 #103 #113). Pure rules first, then the wiring that makes them
// reachable: the routes, the guard chain, the migration catalogue and the
// sign-in route that writes the events #49 reads.
// ============================================

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  FAILED_LOGIN_FLAG_THRESHOLD,
  accountFingerprint,
  aggregateFailedLogins,
  certificateState,
  httpsHosts,
  maskEmail,
  migrationStateFromProbe,
  paymentOutcomeRate,
  signupFunnel,
  summarizeApiUsage,
  type FailedLoginRow,
} from '../services/admin/admin-insights.domain'
import { MIGRATION_CATALOG } from '../services/admin/migration-catalog'
import {
  MIN_FORECAST_HISTORY_SAMPLES,
  forecastMonthlyRevenue,
  zeroFilledMonths,
} from '../services/intelligence/forecast.domain'
import { analyzeAdminRoutes, auditAdminRouteChain } from '../utils/admin-route-audit'

const ROOT = join(__dirname, '..', '..', '..')
const read = (relative: string) => readFileSync(join(ROOT, relative), 'utf8')
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

function attempts(count: number, ip: string | null, account: string | null): FailedLoginRow[] {
  return Array.from({ length: count }, (_, i) => ({
    ipAddress: ip,
    account,
    createdAt: new Date(Date.UTC(2026, 10, 12, 10, i)).toISOString(),
  }))
}

describe('#49 failed-login aggregation', () => {
  it('flags a source AT the threshold, not one below it', () => {
    const summary = aggregateFailedLogins([
      ...attempts(FAILED_LOGIN_FLAG_THRESHOLD, '203.0.113.9', 'acct-a'),
      ...attempts(FAILED_LOGIN_FLAG_THRESHOLD - 1, '198.51.100.4', 'acct-b'),
    ])
    expect(summary.total).toBe(FAILED_LOGIN_FLAG_THRESHOLD * 2 - 1)
    expect(summary.byIp.map((row) => [row.key, row.flagged])).toEqual([
      ['203.0.113.9', true],
      ['198.51.100.4', false],
    ])
    expect(summary.flaggedIps).toBe(1)
  })

  it('sees a distributed attack on one account through the account view', () => {
    const rows = Array.from({ length: 12 }, (_, i) => attempts(1, `10.0.0.${i}`, 'target')).flat()
    const summary = aggregateFailedLogins(rows)
    expect(summary.flaggedIps).toBe(0)
    expect(summary.byAccount[0]).toMatchObject({
      key: 'target',
      attempts: 12,
      spread: 12,
      flagged: true,
    })
  })

  it('counts a row without an address in the total, never under a made-up key', () => {
    const summary = aggregateFailedLogins(attempts(3, null, null))
    expect(summary.total).toBe(3)
    expect(summary.byIp).toEqual([])
    expect(summary.byAccount).toEqual([])
  })

  it('a fingerprint groups one account and does not contain the address', () => {
    const one = accountFingerprint('Owner@Example.com ')
    expect(one).toBe(accountFingerprint('owner@example.com'))
    expect(one).toMatch(/^[0-9a-f]{16}$/)
    expect(one).not.toContain('owner')
  })

  it('the product sign-in route writes the event the screen reads', () => {
    const source = stripComments(read('backend/src/routes/auth.routes.ts'))
    const login = source.slice(
      source.indexOf("'/api/auth/login'"),
      source.indexOf("'/api/auth/logout'"),
    )
    expect(login).toContain('eventType: LOGIN_FAILED_EVENT')
    expect(login).toContain('accountFingerprint(body.email)')
    // The address itself never reaches the event.
    expect(login).not.toMatch(/details:\s*\{[^}]*body\.email[^)]/)
    expect(login).toContain('.catch(() => undefined)')
  })
})

describe('#10 payment success rate', () => {
  it('no events is no rate — never 0 %', () => {
    expect(paymentOutcomeRate(0, 0)).toEqual({
      succeeded: 0,
      failed: 0,
      ratePercent: null,
      status: 'no_events',
    })
  })

  it('is succeeded over all outcomes, one decimal', () => {
    expect(paymentOutcomeRate(2, 1).ratePercent).toBe(66.7)
    expect(paymentOutcomeRate(0, 4).ratePercent).toBe(0)
  })
})

describe('#58 certificate expiry', () => {
  const now = new Date('2026-11-12T00:00:00Z')
  const inDays = (days: number) => new Date(now.getTime() + days * 86_400_000)

  it('names each band, with the boundary inside the more urgent one', () => {
    expect(certificateState(inDays(31), now).state).toBe('ok')
    expect(certificateState(inDays(30), now).state).toBe('warning')
    expect(certificateState(inDays(7), now).state).toBe('critical')
    expect(certificateState(inDays(-1), now).state).toBe('expired')
    expect(certificateState(null, now)).toEqual({ state: 'unreachable', daysLeft: null })
  })

  it('checks only https hosts, each once', () => {
    expect(
      httpsHosts([
        'https://a.example',
        'https://a.example',
        'http://localhost:3000',
        'nonsense',
        'https://b.example/x',
      ]),
    ).toEqual(['a.example', 'b.example'])
  })
})

describe('#79 email masking', () => {
  it('keeps the domain and the first letter only', () => {
    expect(maskEmail('owner@example.com')).toBe('o***@example.com')
    expect(maskEmail('broken')).toBe('***')
  })
})

describe('#113 API usage', () => {
  it('groups by key and by route, separates 4xx from 5xx, nearest-rank p95', () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({
      keyId: i < 15 ? 'k1' : 'k2',
      workspaceId: i < 15 ? 'w1' : 'w2',
      method: 'GET',
      route: '/api/v1/invoices',
      status: i === 0 ? 500 : i === 1 ? 404 : 200,
      durationMs: (i + 1) * 10,
    }))
    const summary = summarizeApiUsage(rows)
    expect(summary.total).toBe(20)
    expect(summary.byKey.map((row) => [row.key, row.requests, row.workspaceId])).toEqual([
      ['k1', 15, 'w1'],
      ['k2', 5, 'w2'],
    ])
    expect(summary.byRoute[0]).toMatchObject({
      key: 'GET /api/v1/invoices',
      requests: 20,
      clientErrors: 1,
      serverErrors: 1,
      p95Ms: 190,
    })
  })
})

describe('#94 signup funnel', () => {
  it('each step is a share of the first and of the one before', () => {
    expect(signupFunnel({ signedUp: 40, createdBusiness: 20, paid: 5 })).toEqual([
      { id: 'signed_up', count: 40, ofFirstPercent: 100, ofPreviousPercent: null },
      { id: 'created_business', count: 20, ofFirstPercent: 50, ofPreviousPercent: 50 },
      { id: 'paid', count: 5, ofFirstPercent: 12.5, ofPreviousPercent: 25 },
    ])
  })

  it('an empty window has no percentages, and nothing can exceed 100', () => {
    expect(
      signupFunnel({ signedUp: 0, createdBusiness: 0, paid: 0 }).map((s) => s.ofFirstPercent),
    ).toEqual([null, null, null])
    const capped = signupFunnel({ signedUp: 3, createdBusiness: 9, paid: 9 })
    expect(capped.every((step) => (step.ofPreviousPercent ?? 0) <= 100)).toBe(true)
  })
})

describe('#103 revenue forecast (forecast.domain)', () => {
  const asOf = new Date('2026-11-12T00:00:00Z')

  it('zero-fills empty months from the first entry, not before it', () => {
    const series = zeroFilledMonths(
      [
        { at: '2026-07-03T00:00:00Z', signedMinor: 100 },
        { at: '2026-09-10T00:00:00Z', signedMinor: 300 },
        { at: '2026-09-11T00:00:00Z', signedMinor: -50 },
      ],
      asOf,
    )
    expect(series).toEqual([
      { month: '2026-07', netMinor: 100 },
      { month: '2026-08', netMinor: 0 },
      { month: '2026-09', netMinor: 250 },
      { month: '2026-10', netMinor: 0 },
      { month: '2026-11', netMinor: 0 },
    ])
  })

  it('fewer complete months than the threshold is insufficient_data with null figures', () => {
    const forecast = forecastMonthlyRevenue({
      asOf,
      series: [
        { month: '2026-09', netMinor: 900 },
        { month: '2026-10', netMinor: 900 },
        { month: '2026-11', netMinor: 900 },
      ],
    })
    expect(MIN_FORECAST_HISTORY_SAMPLES).toBe(3)
    expect(forecast.status).toBe('insufficient_data')
    expect(forecast.basisMonths).toBe(2)
    expect(forecast.averageMinor).toBeNull()
    expect(forecast.next.every((m) => m.projectedMinor === null)).toBe(true)
  })

  it('averages the last complete months and never the current one', () => {
    const forecast = forecastMonthlyRevenue({
      asOf,
      series: [
        { month: '2026-07', netMinor: 9_999 },
        { month: '2026-08', netMinor: 300 },
        { month: '2026-09', netMinor: 600 },
        { month: '2026-10', netMinor: 900 },
        { month: '2026-11', netMinor: 1 },
      ],
    })
    expect(forecast.status).toBe('ok')
    expect(forecast.averageMinor).toBe(600)
    expect(forecast.next.map((m) => m.month)).toEqual(['2026-11', '2026-12', '2027-01'])
    // Scale check: the average is between the smallest and largest basis month.
    expect(forecast.averageMinor).toBeGreaterThanOrEqual(300)
    expect(forecast.averageMinor).toBeLessThanOrEqual(900)
  })
})

describe('#69 migration status catalogue', () => {
  it('a missing table or column is not_applied; any other error is unknown, never applied', () => {
    expect(migrationStateFromProbe(null)).toBe('applied')
    expect(migrationStateFromProbe({ code: 'PGRST205' })).toBe('not_applied')
    expect(migrationStateFromProbe({ code: '42703' })).toBe('not_applied')
    expect(migrationStateFromProbe({ code: '57014' })).toBe('unknown')
  })

  it.each(MIGRATION_CATALOG.map((entry) => [entry.file, entry] as const))(
    '%s exists, has its VERIFY, and creates its own probe',
    (_file, entry) => {
      expect(existsSync(join(ROOT, 'docs', entry.file))).toBe(true)
      expect(existsSync(join(ROOT, 'docs', entry.verify))).toBe(true)
      if (!entry.probe) return
      const sql = read(`docs/${entry.file}`).toLowerCase()
      if (entry.probe.column) {
        expect(sql).toContain(`add column if not exists ${entry.probe.column}`)
      } else {
        expect(sql).toMatch(
          new RegExp(`create table if not exists (public\\.)?${entry.probe.table}\\b`),
        )
      }
    },
  )
})

describe('the admin-insights routes', () => {
  const file = 'admin-insights.routes.ts'
  const source = read(`backend/src/routes/${file}`)
  const records = analyzeAdminRoutes(file, source)

  it('declares every item, each behind the full admin chain', () => {
    expect(records.map((record) => `${record.method} ${record.path}`).sort()).toEqual(
      [
        'GET /api/admin/developers/api-usage',
        'GET /api/admin/gateways/analytics',
        'GET /api/admin/ops/email-delivery',
        'GET /api/admin/ops/maintenance',
        'GET /api/admin/ops/migrations',
        'GET /api/admin/reports/revenue-forecast',
        'GET /api/admin/reports/signup-funnel',
        'GET /api/admin/security/certificates',
        'GET /api/admin/security/failed-logins',
        'GET /api/admin/users/:id/activity',
        'GET /api/admin/workspaces/:id/usage',
        'PUT /api/admin/ops/maintenance',
      ].sort(),
    )
    expect(auditAdminRouteChain(records)).toEqual([])
    expect(records.every((record) => record.hasPermission && record.hasPlatformGuard)).toBe(true)
  })

  it('the only write — the maintenance switch — needs a fresh second factor and is audited', () => {
    const write = records.find((record) => record.method === 'PUT')
    expect(write?.hasStepUp).toBe(true)
    expect(source).toContain("adminRoute('operations.maintenance.write', { stepUp: true })")
    expect(source).toContain('MAINTENANCE_MODE_ENABLED')
    expect(source).toContain('MAINTENANCE_MODE_DISABLED')
  })

  it('is registered on the server', () => {
    const index = read('backend/src/index.ts')
    expect(index).toContain("import adminInsightsRoutes from './routes/admin-insights.routes'")
    expect(index).toContain('await server.register(adminInsightsRoutes)')
  })

  it('the generic flag editor cannot reach the maintenance row', () => {
    const ops = stripComments(read('backend/src/routes/admin-ops.routes.ts'))
    expect(ops).toContain('isReservedFlagKey(body.key)')
    expect(ops).toContain("code: 'FLAG_KEY_RESERVED'")
    const service = stripComments(read('backend/src/services/admin/admin-ops.service.ts'))
    expect(service).toContain(".neq('key', MAINTENANCE_FLAG_KEY)")
  })
})
