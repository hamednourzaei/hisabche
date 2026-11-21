// ============================================
// backend/src/__tests__/core-export.domain.test.ts
//
// The downloadable core log, without a database:
//   - every core has a summary row, even one with no data at all;
//   - unknown stays an EMPTY cell, never 0;
//   - a reason containing a comma and a quote survives CSV quoting;
//   - a failed history read is a labelled row, not a silent gap;
//   - the filename is safe on Windows.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  CORE_EXPORT_SCHEMA,
  buildCoreExportCsv,
  coreExportFileName,
  type CoreExportBundle,
} from '../services/monitoring/core-export.domain'
import type { CorePressureRow, CoreSeriesPoint } from '../services/monitoring/monitoring.service'

const GENERATED_AT = '2026-11-21T12:34:56.789Z'

function core(overrides: Partial<CorePressureRow>): CorePressureRow {
  return {
    id: 'core',
    group: 'commerce',
    owner: 'services/core',
    slo: { p95TargetMs: 800, errorBudgetPercent: 1 },
    status: 'unknown',
    pressure: null,
    reason: null,
    coverage: 0,
    components: [
      { key: 'latency', value: null, weight: 0.35, note: null },
      { key: 'errors', value: null, weight: 0.25, note: null },
      { key: 'queue', value: null, weight: 0.15, note: null },
      { key: 'retryTimeout', value: null, weight: 0.1, note: null },
      { key: 'dependencyWait', value: null, weight: 0.15, note: null },
    ],
    operations: 0,
    windowMinutes: 1440,
    callsPerMin: null,
    successRate: null,
    errorRate: null,
    p50: null,
    p95: null,
    p99: null,
    maxMs: null,
    inflightMax: 0,
    concurrencyMax: 0,
    queueDepth: null,
    processingCount: null,
    stuckCount: null,
    retryCount: null,
    timeouts: 0,
    dependencyWaitAvgMs: null,
    lastSample: null,
    trend: null,
    ...overrides,
  }
}

const SALES = core({
  id: 'sales',
  status: 'critical',
  pressure: 87,
  reason: 'p95 above target, "sales" is slow',
  coverage: 1,
  operations: 100,
  windowMinutes: 5,
  callsPerMin: 20,
  successRate: 99,
  errorRate: 1,
  p50: { value: 40, atLeast: false },
  p95: { value: 1200, atLeast: true },
  p99: { value: 1200, atLeast: true },
  maxMs: 1400,
  inflightMax: 4,
  concurrencyMax: 6,
  timeouts: 2,
  dependencyWaitAvgMs: 12,
  lastSample: '2026-11-21T12:34:00.000Z',
  components: [
    { key: 'latency', value: 0.9, weight: 0.35, note: null },
    { key: 'errors', value: 0.1, weight: 0.25, note: null },
    { key: 'queue', value: null, weight: 0.15, note: null },
    { key: 'retryTimeout', value: 0.2, weight: 0.1, note: null },
    { key: 'dependencyWait', value: null, weight: 0.15, note: null },
  ],
})

const AI = core({
  id: 'ai',
  group: 'intelligence',
  owner: 'services/ai',
  reason: 'no operations in the last 24 hours',
})

const JOBS = core({
  id: 'jobs',
  group: 'operations',
  owner: 'services/jobs',
  reason: 'queue depth above target',
  queueDepth: 12,
})

const SERIES: CoreSeriesPoint[] = [
  {
    bucket: '2026-11-21T12:00:00.000Z',
    operations: 60,
    errors: 1,
    clientErrors: 0,
    errorPercent: 1.6666666666666667,
    avgMs: 42.5,
    p50: { value: 40, atLeast: false },
    p95: { value: 1200, atLeast: true },
    p99: { value: 1200, atLeast: true },
    timeouts: 1,
    inflightMax: 3,
    queueDepth: 2,
    dependencyWaitAvgMs: 8,
  },
  {
    bucket: '2026-11-21T13:00:00.000Z',
    operations: 40,
    errors: 0,
    clientErrors: 2,
    errorPercent: 0,
    avgMs: 38,
    p50: { value: 35, atLeast: false },
    p95: { value: 700, atLeast: false },
    p99: { value: 900, atLeast: false },
    timeouts: 0,
    inflightMax: 2,
    queueDepth: null,
    dependencyWaitAvgMs: null,
  },
]

function bundle(): CoreExportBundle {
  return {
    schema: CORE_EXPORT_SCHEMA,
    generatedAt: GENERATED_AT,
    range: '24h',
    unit: 'hour',
    since: '2026-11-20T12:34:56.789Z',
    windowMinutes: 5,
    counts: { healthy: 0, warning: 0, critical: 1, unknown: 2 },
    cores: [SALES, AI, JOBS],
    series: { sales: SERIES },
    seriesErrors: { jobs: 'history timeout' },
    instances: [],
    db: null,
    alertEvents: [],
    alertEventsError: null,
  }
}

describe('buildCoreExportCsv', () => {
  it('starts with a BOM and the full header', () => {
    const csv = buildCoreExportCsv(bundle())
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('row_type,generated_at,range,unit,bucket,core_id')
    expect(csv).toContain('component_dependency_wait_ratio')
    expect(csv).toContain('series_error')
  })

  it('writes one summary row per core and one row per history bucket', () => {
    const lines = buildCoreExportCsv(bundle()).trimEnd().split('\r\n')
    // header + 3 summary rows + 2 sales buckets
    expect(lines).toHaveLength(6)
  })

  it('quotes a reason that contains a comma and a quote', () => {
    expect(buildCoreExportCsv(bundle())).toContain('"p95 above target, ""sales"" is slow"')
  })

  it('leaves an unknown pressure empty, never zero', () => {
    const line = buildCoreExportCsv(bundle())
      .split('\r\n')
      .find((row) => row.startsWith('snapshot,') && row.includes(',ai,'))
    expect(line).toBeTruthy()
    const cells = line!.split(',')
    expect(cells[8]).toBe('unknown')
    expect(cells[9]).toBe('')
    expect(cells[10]).toBe('no operations in the last 24 hours')
  })

  it('labels a failed history read instead of dropping the core', () => {
    const line = buildCoreExportCsv(bundle())
      .split('\r\n')
      .find((row) => row.startsWith('snapshot,') && row.includes(',jobs,'))
    expect(line).toContain('history timeout')
    expect(line?.endsWith('history timeout')).toBe(true)
  })

  it('carries the pressure components on the summary row', () => {
    const line = buildCoreExportCsv(bundle())
      .split('\r\n')
      .find((row) => row.startsWith('snapshot,') && row.includes(',sales,'))
    expect(line).toContain(',0.9,0.1,,0.2,,')
  })
})

describe('coreExportFileName', () => {
  it('removes Windows-illegal characters from the ISO stamp', () => {
    expect(coreExportFileName('90d', GENERATED_AT, 'csv')).toBe(
      'hisabche-cores-90d-2026-11-21T12-34-56-789Z.csv',
    )
  })
})
