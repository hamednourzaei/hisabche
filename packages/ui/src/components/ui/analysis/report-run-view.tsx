'use client'

// ============================================
// One saved report, run against live data and shown as a table.
//
// The ONE renderer of a report run: the report builder shows the report a
// person picked with it, and a dashboard shows each of its tiles with it — so a
// figure cannot read one way in the builder and another on a dashboard.
//
// ⚠️ «Loading», «failed», «no rows» and «capped» are four different outputs.
// A capped result says how many groups there were.
// ============================================

import { useTranslations } from 'next-intl'
import { formatNumber } from '@hisabche/formatting'
import { apiErrorMessage, useReportRun } from '@hisabche/api'

import { cn } from '../../../lib/utils'
import { useIntlLocale } from '../../../hooks/use-intl-locale'

export const REPORT_DIMENSIONS = ['month', 'quarter', 'customer', 'currency'] as const
export const REPORT_MEASURES = ['count', 'outstanding', 'collected'] as const
export const REPORT_ERROR_CODES = [
  'REPORT_NOT_RUNNABLE',
  'REPORT_NAME_TAKEN',
  'REPORT_NO_MEASURES',
  'REPORT_TOO_MANY_DIMENSIONS',
  'REPORT_NON_ADDITIVE_IN_TIME',
  'REPORTS_MIGRATION_PENDING',
] as const

export const isKnown = <T extends string>(value: string, list: readonly T[]): value is T =>
  (list as readonly string[]).includes(value)

const card =
  'rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]'
const th = 'px-3 py-2.5 text-start text-xs font-medium text-[hsl(var(--fg-secondary))]'
const td = 'px-3 py-2.5 text-sm text-[hsl(var(--fg-primary))]'

export function ReportRunView({ reportId }: { reportId: string }) {
  const t = useTranslations('reportBuilder')
  const locale = useIntlLocale()
  const run = useReportRun(reportId)

  if (run.isLoading) {
    return (
      <div className="h-24 animate-pulse rounded-xl bg-[hsl(var(--surface-muted))] motion-reduce:animate-none" />
    )
  }
  if (run.error || !run.data) {
    const raw = apiErrorMessage(run.error, '')
    const code = REPORT_ERROR_CODES.find((known) => raw.includes(known))
    return (
      <p role="alert" className={cn(card, 'p-4 text-sm text-[hsl(var(--color-destructive))]')}>
        {code ? t(`errors.${code}`) : t('errors.general')}
      </p>
    )
  }
  if (run.data.rows.length === 0) {
    return (
      <p className={cn(card, 'p-6 text-center text-sm text-[hsl(var(--fg-secondary))]')}>
        {t('noRows')}
      </p>
    )
  }

  const { report, rows, totalRows } = run.data
  return (
    <section className="space-y-2">
      <div className={cn(card, 'overflow-x-auto')}>
        <table className="w-full">
          <thead>
            <tr className="border-b border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))]">
              {report.groupBy.map((dimension) => (
                <th key={dimension} className={th}>
                  {isKnown(dimension, REPORT_DIMENSIONS)
                    ? t(`dimensionNames.${dimension}`)
                    : dimension}
                </th>
              ))}
              {report.measures.map((measure) => (
                <th key={measure} className={th}>
                  {isKnown(measure, REPORT_MEASURES) ? t(`measureNames.${measure}`) : measure}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="border-b border-[hsl(var(--border-default))]">
                {report.groupBy.map((dimension) => (
                  <td
                    key={dimension}
                    className={cn(td, dimension !== 'customer' && 'tabular-nums')}
                  >
                    {dimension === 'customer'
                      ? (row.customerName ?? (row.dimensions.customer ? '—' : t('noCustomer')))
                      : (row.dimensions[dimension] ?? '—')}
                  </td>
                ))}
                {report.measures.map((measure) => (
                  <td key={measure} className={cn(td, 'tabular-nums')}>
                    {formatNumber(row.values[measure] ?? 0, locale, measure === 'count' ? 0 : 2)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalRows > rows.length ? (
        <p className="text-xs text-[hsl(var(--color-warning))]">
          {t('capped', {
            shown: formatNumber(rows.length, locale, 0),
            total: formatNumber(totalRows, locale, 0),
          })}
        </p>
      ) : null}
      <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('live')}</p>
    </section>
  )
}
