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
//
// The run itself is shown by `ReportRunView`, which a dashboard tile uses too.
// ============================================

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  apiErrorMessage,
  useReportCatalog,
  useRetireReport,
  useSaveReport,
  useSavedReports,
  type ReportDimension,
  type ReportMeasure,
} from '@hisabche/api'

import { cn } from '../../../lib/utils'
import { Button } from '../button'
import { DashboardBuilder } from './dashboard-builder'
import {
  REPORT_DIMENSIONS,
  REPORT_ERROR_CODES,
  REPORT_MEASURES,
  ReportRunView,
  isKnown as known,
} from './report-run-view'

export { REPORT_DIMENSIONS, REPORT_ERROR_CODES, REPORT_MEASURES }

const card =
  'rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]'

export function ReportBuilder() {
  const t = useTranslations('reportBuilder')
  const catalog = useReportCatalog()
  const reports = useSavedReports()
  const save = useSaveReport()
  const retire = useRetireReport()

  const [name, setName] = useState('')
  const [groupBy, setGroupBy] = useState<ReportDimension[]>([])
  const [measures, setMeasures] = useState<ReportMeasure[]>(['count'])
  const [selected, setSelected] = useState<string | null>(null)

  const message = (error: unknown): string => {
    const raw = apiErrorMessage(error, '')
    const code = REPORT_ERROR_CODES.find((known) => raw.includes(known))
    return code ? t(`errors.${code}`) : t('errors.general')
  }
  const toggle = <T,>(list: T[], item: T): T[] =>
    list.includes(item) ? list.filter((other) => other !== item) : [...list, item]

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

      {selected ? <ReportRunView reportId={selected} /> : null}

      {/* Saved reports arranged on one screen (#146). */}
      <DashboardBuilder reports={reports.data ?? []} />
    </div>
  )
}
