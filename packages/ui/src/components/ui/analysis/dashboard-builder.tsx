'use client'

// ============================================
// «داشبوردها» — saved reports arranged on one screen (#146).
//
// A dashboard defines nothing: each tile is a saved report, run live by the
// same component the report builder uses (`ReportRunView`). So there is no
// figure here that the report builder would show differently.
//
// ⚠️ A tile whose report was retired SAYS SO — it is not dropped, which would
// make a dashboard quietly show less than it was built to.
// ⚠️ A dashboard is retired, never edited: a changed arrangement is a new one.
// ⚠️ «Not set up», «failed» and «none yet» are three different sentences.
// ============================================

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  apiErrorMessage,
  useReportDashboards,
  useRetireReportDashboard,
  useSaveReportDashboard,
  type SavedReport,
} from '@hisabche/api'

import { cn } from '../../../lib/utils'
import { Button } from '../button'
import { SelectField } from '../select-field'
import { ReportRunView } from './report-run-view'

export const DASHBOARD_ERROR_CODES = [
  'DASHBOARD_EMPTY',
  'DASHBOARD_UNKNOWN_REPORT',
  'DASHBOARD_DUPLICATE_REPORT',
  'DASHBOARD_POSITION_CLASH',
  'DASHBOARD_NAME_TAKEN',
  'DASHBOARDS_MIGRATION_PENDING',
] as const

/** The server's limit: each tile is a live query when the dashboard is opened. */
export const MAX_DASHBOARD_TILES = 6
export const DASHBOARD_SPANS = [1, 2, 3] as const
type Span = (typeof DASHBOARD_SPANS)[number]

const card =
  'rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]'
const field =
  'h-10 rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-3 text-sm text-[hsl(var(--fg-primary))] outline-none focus:border-[hsl(var(--color-primary))]'
const danger = 'text-sm text-[hsl(var(--color-destructive))]'
const SPAN_CLASS: Record<Span, string> = {
  1: 'lg:col-span-1',
  2: 'lg:col-span-2',
  3: 'lg:col-span-3',
}

export function DashboardBuilder({ reports }: { reports: readonly SavedReport[] }) {
  const t = useTranslations('dashboardBuilder')
  const dashboards = useReportDashboards()
  const save = useSaveReportDashboard()
  const retire = useRetireReportDashboard()

  const [name, setName] = useState('')
  const [tiles, setTiles] = useState<Array<{ reportId: string; span: Span }>>([])
  const [selected, setSelected] = useState<string | null>(null)

  const message = (error: unknown): string => {
    const raw = apiErrorMessage(error, '')
    const code = DASHBOARD_ERROR_CODES.find((known) => raw.includes(known))
    return code ? t(`errors.${code}`) : t('errors.general')
  }
  const picked = (reportId: string) => tiles.some((tile) => tile.reportId === reportId)
  const toggle = (reportId: string) =>
    setTiles((current) =>
      current.some((tile) => tile.reportId === reportId)
        ? current.filter((tile) => tile.reportId !== reportId)
        : current.length >= MAX_DASHBOARD_TILES
          ? current
          : [...current, { reportId, span: 1 }],
    )
  const nameOf = (reportId: string) => reports.find((report) => report.id === reportId)?.name ?? ''
  const open = (dashboards.data ?? []).find((dashboard) => dashboard.id === selected) ?? null

  return (
    <div className="space-y-5">
      <section className={cn(card, 'space-y-3 p-4')}>
        <h2 className="font-semibold text-[hsl(var(--fg-primary))]">{t('newTitle')}</h2>
        {reports.length === 0 ? (
          <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('needReports')}</p>
        ) : (
          <>
            <label className="block space-y-1">
              <span className="block text-xs text-[hsl(var(--fg-secondary))]">{t('name')}</span>
              <input
                name="name"
                value={name}
                maxLength={80}
                onChange={(event) => setName(event.target.value)}
                className={cn(field, 'w-full max-w-sm')}
              />
            </label>
            <fieldset className="space-y-1.5">
              <legend className="text-xs text-[hsl(var(--fg-secondary))]">
                {t('pickReports')}
              </legend>
              <div className="flex flex-wrap gap-3">
                {reports.map((report) => (
                  <label key={report.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="tiles"
                      checked={picked(report.id)}
                      disabled={!picked(report.id) && tiles.length >= MAX_DASHBOARD_TILES}
                      onChange={() => toggle(report.id)}
                    />
                    {report.name}
                  </label>
                ))}
              </div>
            </fieldset>

            {tiles.length > 0 ? (
              <ol className="space-y-2">
                {tiles.map((tile, index) => (
                  <li key={tile.reportId} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="tabular-nums text-[hsl(var(--fg-tertiary))]">
                      {index + 1}.
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[hsl(var(--fg-primary))]">
                      {nameOf(tile.reportId)}
                    </span>
                    <SelectField
                      name="span"
                      data-field="span"
                      aria-label={t('width')}
                      value={String(tile.span)}
                      onChange={(value) =>
                        setTiles((current) =>
                          current.map((other) =>
                            other.reportId === tile.reportId
                              ? { ...other, span: Number(value) as Span }
                              : other,
                          ),
                        )
                      }
                      options={DASHBOARD_SPANS.map((span) => ({
                        value: String(span),
                        label: t(`widths.${span}`),
                      }))}
                      className={cn(field, 'w-36')}
                    />
                  </li>
                ))}
              </ol>
            ) : null}
            <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('hint')}</p>

            {save.error ? (
              <p role="alert" className={danger}>
                {message(save.error)}
              </p>
            ) : null}
            <Button
              size="sm"
              disabled={save.isPending || name.trim() === '' || tiles.length === 0}
              onClick={() =>
                save.mutate(
                  { name, tiles },
                  {
                    onSuccess: (dashboard) => {
                      setName('')
                      setTiles([])
                      setSelected(dashboard.id)
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
        {dashboards.isLoading ? (
          <div className="h-11 animate-pulse rounded-xl bg-[hsl(var(--surface-muted))] motion-reduce:animate-none" />
        ) : dashboards.error || !dashboards.data ? (
          <p role="alert" className={cn(card, 'p-4', danger)}>
            {message(dashboards.error)}
          </p>
        ) : dashboards.data.length === 0 ? (
          <p className={cn(card, 'p-4 text-sm text-[hsl(var(--fg-secondary))]')}>{t('empty')}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {dashboards.data.map((dashboard) => (
              <li key={dashboard.id} className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant={selected === dashboard.id ? 'default' : 'outline'}
                  onClick={() => setSelected(dashboard.id)}
                >
                  {dashboard.name}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`${t('retire')}: ${dashboard.name}`}
                  disabled={retire.isPending && retire.variables === dashboard.id}
                  onClick={() =>
                    retire.mutate(dashboard.id, {
                      onSuccess: () =>
                        setSelected((current) => (current === dashboard.id ? null : current)),
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
          <p role="alert" className={danger}>
            {message(retire.error)}
          </p>
        ) : null}
      </section>

      {open ? (
        <section className="grid gap-4 lg:grid-cols-3" aria-label={open.name}>
          {open.tiles.map((tile) => (
            <article
              key={tile.reportId}
              className={cn('min-w-0 space-y-2', SPAN_CLASS[tile.span] ?? SPAN_CLASS[1])}
            >
              <h3 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
                {tile.reportName ?? t('retiredReport')}
              </h3>
              {tile.reportName === null ? (
                <p className={cn(card, 'p-4 text-sm text-[hsl(var(--fg-secondary))]')}>
                  {t('retiredReportHint')}
                </p>
              ) : (
                <ReportRunView reportId={tile.reportId} />
              )}
            </article>
          ))}
        </section>
      ) : null}
    </div>
  )
}
