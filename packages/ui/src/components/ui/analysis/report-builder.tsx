'use client'

// ============================================
// «گزارش‌ساز» — a question kept under a name (#145).
//
// Pick what to count and how to group it, save it, run it. The choices come
// from the server's catalog — exactly what it can compute — so nothing can be
// built here that fails when it is run.
//
// ⚠️ Money is always shown per currency; the note under the form says the
// grouping is added for you.
// ⚠️ A capped result says so: «۵۰۰ ردیف از ۱٬۲۰۵».
// ⚠️ A report holds no results. Every run reads live data.
// ============================================

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { formatNumber } from '@hisabche/formatting'
import {
  apiErrorMessage,
  useReportCatalog,
  useReportRun,
  useRetireReport,
  useSaveReport,
  useSavedReports,
  type ReportDimension,
  type ReportMeasure,
} from '@hisabche/api'

import { cn } from '../../../lib/utils'
import { useIntlLocale } from '../../../hooks/use-intl-locale'
import { Button } from '../button'

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

const card =
  'rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]'
const th = 'px-3 py-2.5 text-start text-xs font-medium text-[hsl(var(--fg-secondary))]'
const td = 'px-3 py-2.5 text-sm text-[hsl(var(--fg-primary))]'

export function ReportBuilder() {
  const t = useTranslations('reportBuilder')
  const locale = useIntlLocale()
  const catalog = useReportCatalog()
  const reports = useSavedReports()
  const save = useSaveReport()
  const retire = useRetireReport()

  const [name, setName] = useState('')
  const [groupBy, setGroupBy] = useState<ReportDimension[]>([])
  const [measures, setMeasures] = useState<ReportMeasure[]>(['count'])
  const [selected, setSelected] = useState<string | null>(null)
  const run = useReportRun(selected)

  const message = (error: unknown): string => {
    const raw = apiErrorMessage(error, '')
    const code = REPORT_ERROR_CODES.find((known) => raw.includes(known))
    return code ? t(`errors.${code}`) : t('errors.general')
  }
  const toggle = <T,>(list: T[], item: T): T[] =>
    list.includes(item) ? list.filter((other) => other !== item) : [...list, item]
  const known = <T extends string>(value: string, list: readonly T[]): value is T =>
    (list as readonly string[]).includes(value)

  const dimensions = (catalog.data?.dimensions ?? []).filter((key) => known(key, REPORT_DIMENSIONS))
  const offered = (catalog.data?.measures ?? []).filter((measure) =>
    known(measure.key, REPORT_MEASURES),
  )

  return (
    <div className="space-y-5">
      <section className={cn(card, 'space-y-3 p-4')}>
        <h2 className="font-semibold text-[hsl(var(--fg-primary))]">{t('newTitle')}</h2>
        {catalog.isLoading ? (
          <div className="h-11 animate-pulse rounded-xl bg-[hsl(var(--surface-muted))]" />
        ) : catalog.error || !catalog.data ? (
          <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
            {message(catalog.error)}
          </p>
        ) : (
          <>
            <label className="block space-y-1">
              <span className="block text-xs text-[hsl(var(--fg-secondary))]">{t('name')}</span>
              <input
                name="name"
                value={name}
                maxLength={80}
                onChange={(event) => setName(event.target.value)}
                className="h-10 w-full max-w-sm rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-3 text-sm outline-none focus:border-[hsl(var(--color-primary))]"
              />
            </label>
            <fieldset className="space-y-1.5">
              <legend className="text-xs text-[hsl(var(--fg-secondary))]">{t('measures')}</legend>
              <div className="flex flex-wrap gap-3">
                {offered.map((measure) => (
                  <label key={measure.key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="measures"
                      checked={measures.includes(measure.key)}
                      onChange={() => setMeasures((current) => toggle(current, measure.key))}
                    />
                    {t(`measureNames.${measure.key}`)}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="space-y-1.5">
              <legend className="text-xs text-[hsl(var(--fg-secondary))]">{t('groupBy')}</legend>
              <div className="flex flex-wrap gap-3">
                {dimensions.map((dimension) => (
                  <label key={dimension} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="groupBy"
                      checked={groupBy.includes(dimension)}
                      onChange={() => setGroupBy((current) => toggle(current, dimension))}
                    />
                    {t(`dimensionNames.${dimension}`)}
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('hint')}</p>
            {save.error ? (
              <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
                {message(save.error)}
              </p>
            ) : null}
            <Button
              size="sm"
              disabled={save.isPending || name.trim() === '' || measures.length === 0}
              onClick={() =>
                save.mutate(
                  { name, groupBy, measures },
                  {
                    onSuccess: (report) => {
                      setName('')
                      setSelected(report.id)
                    },
                  },
                )
              }
            >
              {t('save')}
            </Button>
          </>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-[hsl(var(--fg-primary))]">{t('savedTitle')}</h2>
        {reports.isLoading ? (
          <div className="h-11 animate-pulse rounded-xl bg-[hsl(var(--surface-muted))]" />
        ) : reports.error || !reports.data ? (
          <p role="alert" className={cn(card, 'p-4 text-sm text-[hsl(var(--color-destructive))]')}>
            {message(reports.error)}
          </p>
        ) : reports.data.length === 0 ? (
          <p className={cn(card, 'p-4 text-sm text-[hsl(var(--fg-secondary))]')}>{t('empty')}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {reports.data.map((report) => (
              <li key={report.id} className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant={selected === report.id ? 'default' : 'outline'}
                  onClick={() => setSelected(report.id)}
                >
                  {report.name}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`${t('retire')}: ${report.name}`}
                  disabled={retire.isPending && retire.variables === report.id}
                  onClick={() =>
                    retire.mutate(report.id, {
                      onSuccess: () =>
                        setSelected((current) => (current === report.id ? null : current)),
                    })
                  }
                >
                  ×
                </Button>
              </li>
            ))}
          </ul>
        )}
        {retire.error ? (
          <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
            {message(retire.error)}
          </p>
        ) : null}
      </section>

      {selected ? (
        run.isLoading ? (
          <div className="h-24 animate-pulse rounded-xl bg-[hsl(var(--surface-muted))]" />
        ) : run.error || !run.data ? (
          <p role="alert" className={cn(card, 'p-4 text-sm text-[hsl(var(--color-destructive))]')}>
            {message(run.error)}
          </p>
        ) : run.data.rows.length === 0 ? (
          <p className={cn(card, 'p-6 text-center text-sm text-[hsl(var(--fg-secondary))]')}>
            {t('noRows')}
          </p>
        ) : (
          <section className="space-y-2">
            <div className={cn(card, 'overflow-x-auto')}>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))]">
                    {run.data.report.groupBy.map((dimension) => (
                      <th key={dimension} className={th}>
                        {known(dimension, REPORT_DIMENSIONS)
                          ? t(`dimensionNames.${dimension}`)
                          : dimension}
                      </th>
                    ))}
                    {run.data.report.measures.map((measure) => (
                      <th key={measure} className={th}>
                        {known(measure, REPORT_MEASURES) ? t(`measureNames.${measure}`) : measure}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {run.data.rows.map((row, index) => (
                    <tr key={index} className="border-b border-[hsl(var(--border-default))]">
                      {run.data.report.groupBy.map((dimension) => (
                        <td
                          key={dimension}
                          className={cn(td, dimension !== 'customer' && 'tabular-nums')}
                        >
                          {dimension === 'customer'
                            ? (row.customerName ??
                              (row.dimensions.customer ? '—' : t('noCustomer')))
                            : (row.dimensions[dimension] ?? '—')}
                        </td>
                      ))}
                      {run.data.report.measures.map((measure) => (
                        <td key={measure} className={cn(td, 'tabular-nums')}>
                          {formatNumber(
                            row.values[measure] ?? 0,
                            locale,
                            measure === 'count' ? 0 : 2,
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {run.data.totalRows > run.data.rows.length ? (
              <p className="text-xs text-[hsl(var(--color-warning))]">
                {t('capped', {
                  shown: formatNumber(run.data.rows.length, locale, 0),
                  total: formatNumber(run.data.totalRows, locale, 0),
                })}
              </p>
            ) : null}
            <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('live')}</p>
          </section>
        )
      ) : null}
    </div>
  )
}
