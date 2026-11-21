// ============================================
// apps/admin/src/__tests__/monitor-wiring.test.ts
//
// Wiring guards for the unified core monitor (mission §14, F-19):
//   1. every hook path has a declared backend route (no orphan fetch);
//   2. the panel uses the SHARED primitives — KpiCard/KpiGrid, TrendChart,
//      DataTable, @hisabche/formatting — and keeps no local copies;
//   3. error and empty are separate branches (F-11); UNKNOWN is rendered,
//      never zero-filled;
//   4. the stream has a real consumer and polling is paused while connected;
//   5. history refetches beside the live totals (F-05); 30d is a real range;
//   6. every new i18n key exists in fa, af AND en.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '../../../..')
const read = (relative: string) => readFileSync(join(ROOT, relative), 'utf-8')

const panel = read('apps/admin/app/[lang]/(admin)/operations/monitor/monitor-panel.tsx')
const hooks = read('apps/admin/hooks/use-admin-monitor.ts')
const streamClient = read('apps/admin/lib/monitor-stream.ts')
const routes = read('backend/src/routes/admin-monitor.routes.ts')

describe('hook paths ↔ backend routes', () => {
  const hookPaths = [...hooks.matchAll(/apiClient\.(get|put|post|delete)\(\s*[`']([^`'$]+)/g)].map(
    (match) => match[2]!,
  )

  it('finds the monitor hook paths', () => {
    expect(hookPaths.length).toBeGreaterThanOrEqual(6)
  })

  it('every static hook path is declared on the backend', () => {
    for (const path of hookPaths) {
      // Template tails (`/cores/${coreId}/series`) are checked by their prefix.
      const staticPrefix = path.split('${')[0]!
      const declared = routes.includes(`/api${staticPrefix}`)
      expect(declared, `missing backend route for ${path}`).toBe(true)
    }
  })

  it('the stream endpoint is declared and guarded by the read permission', () => {
    expect(routes).toContain("fastify.get('/api/admin/monitor/stream', { preHandler: read }")
  })
})

describe('shared primitives, no local copies', () => {
  it('uses KpiCard/KpiGrid and keeps no local Kpi div', () => {
    expect(panel).toContain('KpiCard')
    expect(panel).toContain('KpiGrid')
    expect(panel).not.toMatch(/function Kpi\(/)
  })

  it('uses the shared TrendChart, not a div-bar chart', () => {
    expect(panel).toContain('TrendChart')
    expect(panel).not.toContain('items-end gap-1')
  })

  it('uses the shared formatBytes, not a local unit table', () => {
    expect(panel).toContain("import { formatBytes } from '@hisabche/formatting'")
    expect(panel).not.toMatch(/function formatBytes\(/)
    expect(panel).not.toContain("const units = ['B', 'KB'")
  })

  it('null bytes render UNKNOWN before the formatter ever sees them', () => {
    expect(panel).toMatch(
      /value === null \|\| !Number\.isFinite\(value\) \? UNKNOWN_VALUE : formatBytes/,
    )
  })

  it('the core ranking is the shared DataTable with search and group filter', () => {
    expect(panel).toContain('tableId="admin-monitor-cores"')
    expect(panel).toContain('TableFilterSelect')
    expect(panel).toContain('coreSearch')
    expect(panel).toContain('onRowClick={(row) => setOpenCoreId(row.id)}')
  })
})

describe('honest states', () => {
  it('series error and empty are separate branches (F-11)', () => {
    expect(panel).toContain('seriesError ?')
    expect(panel).toContain('coresError ?')
    expect(panel).toContain('admin.operations.monitor.seriesError')
    expect(panel).toContain('admin.operations.monitor.coresError')
  })

  it('UNKNOWN cores stay in the ranking with a reason, never healthy-at-zero', () => {
    expect(panel).toContain('CoreStatusBadge')
    expect(panel).toContain('core.reason')
    expect(panel).toContain('(b.pressure ?? -1) - (a.pressure ?? -1)')
  })

  it('open-bucket percentiles render with the at-least sign', () => {
    expect(panel).toContain('estimate.atLeast ? `≥ ${value}` : value')
  })

  it('offline instances are shown with lastSeen and role', () => {
    expect(panel).toContain('admin.operations.monitor.offline')
    expect(panel).toContain('row.lastSeen')
    expect(panel).toContain('row.processRole')
  })
})

describe('real-time wiring', () => {
  it('the panel consumes the stream and pauses polling while connected', () => {
    expect(panel).toContain('useAdminMonitorStream()')
    expect(panel).toContain('useAdminMonitor({ paused: stream.paused })')
    expect(panel).toContain('useAdminMonitorCores({ paused: stream.paused })')
    expect(hooks).toContain('refetchInterval: options.paused ? false : 10_000')
  })

  it('the stream client sends Authorization, never a token in the URL', () => {
    expect(streamClient).toContain('Authorization: `Bearer ${token}`')
    expect(streamClient).not.toContain('?token=')
    expect(streamClient).not.toContain('new EventSource')
  })

  it('the client reconnects with backoff and declares fallback', () => {
    expect(streamClient).toContain('scheduleReconnect')
    expect(streamClient).toContain("'fallback'")
    expect(streamClient).toContain('heartbeatTimeoutMs')
    expect(streamClient).toContain('stop()')
  })

  it('history refetches beside the live totals (F-05) and 30d exists', () => {
    expect(hooks).toContain('refetchInterval: 60_000')
    expect(hooks).toContain("'30d'")
    expect(panel).toContain("['1h', '24h', '7d', '30d', '90d']")
  })

  it('stream events land in the React Query cache, not a parallel state', () => {
    expect(hooks).toContain("queryClient.setQueryData(['admin', 'monitor', 'overview']")
    expect(hooks).toContain("['admin', 'monitor', 'cores']")
    expect(hooks).toContain("event === 'alert.raised' || event === 'alert.resolved'")
  })
})

describe('i18n completeness', () => {
  const locales = ['fa', 'af', 'en'] as const
  const monitorOf = (locale: string) => {
    const json = JSON.parse(read(`packages/i18n/messages/${locale}/common.json`)) as {
      admin: { operations: { monitor: Record<string, unknown> } }
    }
    return json.admin.operations.monitor
  }

  const newKeys = [
    'coresTitle',
    'coresDesc',
    'coresError',
    'coreSearch',
    'coreGroup',
    'allGroups',
    'pressure',
    'callsPerMin',
    'p50',
    'p95',
    'p99',
    'inFlight',
    'queue',
    'retry',
    'depWait',
    'trend',
    'coreDetail',
    'coreOwner',
    'pressureBreakdown',
    'coverage',
    'coreHistory',
    'coreHistoryError',
    'activeAlerts',
    'noActiveAlerts',
    'coresHealthy',
    'coresWarning',
    'coresCritical',
    'coresUnknown',
    'workersOnline',
    'processRole',
    'online',
    'offline',
    'lastSeen',
    'alertEvents',
    'alertEventsDesc',
    'raisedAt',
    'resolvedAt',
    'eventOpen',
    'eventResolved',
    'noAlertEvents',
    'seriesError',
    'lastEvent',
    'fallbackHint',
  ]

  it('every new key exists in fa, af and en', () => {
    for (const locale of locales) {
      const monitor = monitorOf(locale)
      for (const key of newKeys) {
        expect(monitor[key], `${locale}:${key}`).toBeTruthy()
      }
    }
  })

  it('nested enums are complete in every locale', () => {
    for (const locale of locales) {
      const monitor = monitorOf(locale) as Record<string, Record<string, string>>
      for (const status of ['healthy', 'warning', 'critical', 'unknown']) {
        expect(monitor.status![status], `${locale}:status.${status}`).toBeTruthy()
      }
      for (const state of ['connected', 'connecting', 'reconnecting', 'fallback', 'disconnected']) {
        expect(monitor.connection![state], `${locale}:connection.${state}`).toBeTruthy()
      }
      for (const group of [
        'identity',
        'commerce',
        'finance',
        'operations',
        'people',
        'industry',
        'sync',
        'intelligence',
        'platform',
      ]) {
        expect(monitor.groups![group], `${locale}:groups.${group}`).toBeTruthy()
      }
      for (const component of ['latency', 'errors', 'queue', 'retryTimeout', 'dependencyWait']) {
        expect(monitor.components![component], `${locale}:components.${component}`).toBeTruthy()
      }
      expect(monitor.range!['30d'], `${locale}:range.30d`).toBeTruthy()
    }
  })

  it('the three locales carry the same monitor key count', () => {
    const counts = locales.map((locale) => Object.keys(monitorOf(locale)).length)
    expect(counts[0]).toBe(counts[1])
    expect(counts[1]).toBe(counts[2])
  })
})
