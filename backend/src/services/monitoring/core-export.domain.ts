// ============================================
// backend/src/services/monitoring/core-export.domain.ts
//
// The downloadable core log. The owner asked for «قابلیت دانلود …
// بتونیم لاگ کامل استخراج بکنیم ایرادات هسته هارو بگیریم» — the monitor screen
// shows one live verdict per core, but an intermittent issue is only visible in
// the history. This bundle carries BOTH:
//
//   - a snapshot row per registered core — status, pressure, reason, coverage
//     and every pressure component, including cores with no data at all;
//   - one row per history bucket for that core over the chosen range;
//   - the recent alert events, instances and database history.
//
// ⚠️ Unknown stays empty in CSV, never 0. «The metric could not be read» and
// «the metric was zero» are different facts (AGENTS.md §3).
// ============================================

import type {
  AlertEventRow,
  CoreInstanceRow,
  CorePressureRow,
  CoreSeriesPoint,
  CoreSnapshot,
  DbHistoryRow,
  MonitorRange,
} from './monitoring.service'
import type { PressureComponent } from './core-pressure.domain'

export const CORE_EXPORT_SCHEMA = 'hisabche.core-export.v1'

export interface CoreExportBundle {
  schema: typeof CORE_EXPORT_SCHEMA
  generatedAt: string
  range: MonitorRange
  unit: 'minute' | 'hour'
  since: string
  windowMinutes: number
  counts: CoreSnapshot['counts']
  cores: CorePressureRow[]
  series: Record<string, CoreSeriesPoint[]>
  seriesErrors: Record<string, string>
  instances: CoreInstanceRow[]
  db: DbHistoryRow | null
  alertEvents: AlertEventRow[]
  /** A failed alert-history read is a reason, never a silently empty list. */
  alertEventsError: string | null
}

type CsvValue = string | number | boolean | null | undefined

const CSV_COLUMNS = [
  'row_type',
  'generated_at',
  'range',
  'unit',
  'bucket',
  'core_id',
  'group',
  'owner',
  'status',
  'pressure',
  'reason',
  'window_minutes',
  'operations',
  'calls_per_min',
  'success_rate',
  'errors',
  'client_errors',
  'error_percent',
  'avg_ms',
  'p50_ms',
  'p50_at_least',
  'p95_ms',
  'p95_at_least',
  'p99_ms',
  'p99_at_least',
  'max_ms',
  'timeouts',
  'inflight_max',
  'queue_depth',
  'dependency_wait_avg_ms',
  'last_sample',
  'component_latency_ratio',
  'component_errors_ratio',
  'component_queue_ratio',
  'component_retry_timeout_ratio',
  'component_dependency_wait_ratio',
  'series_error',
] as const

const COMPONENT_ORDER: ReadonlyArray<PressureComponent['key']> = [
  'latency',
  'errors',
  'queue',
  'retryTimeout',
  'dependencyWait',
]

function cell(value: CsvValue): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  const raw = String(value)
  // A reason or owner can contain a comma, a quote or a newline; quoting is
  // what keeps one row on one line.
  return /[",\r\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw
}

function componentRatio(core: CorePressureRow, key: PressureComponent['key']): number | null {
  return core.components.find((component) => component.key === key)?.value ?? null
}

/**
 * The summary row that exists for EVERY core — measured, unknown or with a
 * failed history read. It is also the only row carrying the pressure
 * breakdown, because components describe the live snapshot, not one bucket.
 */
function snapshotRow(bundle: CoreExportBundle, core: CorePressureRow): CsvValue[] {
  return [
    'snapshot',
    bundle.generatedAt,
    bundle.range,
    bundle.unit,
    '',
    core.id,
    core.group,
    core.owner,
    core.status,
    core.pressure,
    core.reason,
    core.windowMinutes,
    core.operations,
    core.callsPerMin,
    core.successRate,
    // The aggregate row does not expose an error COUNT (only the rate), so the
    // cell stays empty rather than being derived into a fabricated number.
    null,
    null,
    core.errorRate,
    null,
    core.p50?.value ?? null,
    core.p50 === null ? null : core.p50.atLeast,
    core.p95?.value ?? null,
    core.p95 === null ? null : core.p95.atLeast,
    core.p99?.value ?? null,
    core.p99 === null ? null : core.p99.atLeast,
    core.maxMs,
    core.timeouts,
    core.inflightMax,
    core.queueDepth,
    core.dependencyWaitAvgMs,
    core.lastSample,
    ...COMPONENT_ORDER.map((key) => componentRatio(core, key)),
    bundle.seriesErrors[core.id] ?? null,
  ]
}

/** One history bucket. Components and the aggregate-only cells stay empty. */
function seriesRow(
  bundle: CoreExportBundle,
  core: CorePressureRow,
  point: CoreSeriesPoint,
): CsvValue[] {
  const perMinute = bundle.unit === 'minute' ? point.operations : point.operations / 60
  return [
    'series',
    bundle.generatedAt,
    bundle.range,
    bundle.unit,
    point.bucket,
    core.id,
    core.group,
    core.owner,
    core.status,
    core.pressure,
    core.reason,
    core.windowMinutes,
    point.operations,
    perMinute,
    null,
    point.errors,
    point.clientErrors,
    point.errorPercent,
    point.avgMs,
    point.p50?.value ?? null,
    point.p50 === null ? null : point.p50.atLeast,
    point.p95?.value ?? null,
    point.p95 === null ? null : point.p95.atLeast,
    point.p99?.value ?? null,
    point.p99 === null ? null : point.p99.atLeast,
    null,
    point.timeouts,
    point.inflightMax,
    point.queueDepth,
    point.dependencyWaitAvgMs,
    core.lastSample,
    null,
    null,
    null,
    null,
    null,
    null,
  ]
}

/**
 * UTF-8 CSV with a BOM (Excel needs it to read Persian) and CRLF rows. Every
 * core contributes its snapshot row first; then its history rows.
 */
export function buildCoreExportCsv(bundle: CoreExportBundle): string {
  const lines: string[] = [CSV_COLUMNS.join(',')]
  for (const core of bundle.cores) {
    lines.push(snapshotRow(bundle, core).map(cell).join(','))
    for (const point of bundle.series[core.id] ?? []) {
      lines.push(seriesRow(bundle, core, point).map(cell).join(','))
    }
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`
}

/** A filename safe on Windows: the ISO stamp's separators become dashes. */
export function coreExportFileName(
  range: MonitorRange,
  generatedAt: string,
  extension: 'csv' | 'json',
): string {
  const stamp = generatedAt.replace(/[^0-9A-Za-z]+/g, '-').replace(/^-+|-+$/g, '')
  return `hisabche-cores-${range}-${stamp}.${extension}`
}
