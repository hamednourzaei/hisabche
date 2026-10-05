'use client'

// ============================================
// packages/ui/src/components/ui/developers/key-usage-panel.tsx
//
// One API key's usage: exact per-day counts, then the latest requests.
// Props only.
//
// The per-day figures are counted by the database (api_key_usage, count(*));
// the request list underneath is the latest 50 and says so — a sample to
// read, never a total to decide on (راهنمای سشن §۷٫۴).
// ============================================

import { memo } from 'react'
import { SearchableTable } from '../data-table'
import type { ApiKeyUsage } from '@hisabche/api'

import { Badge } from '../badge'
import type { SectionState } from './developers-view'

export interface KeyUsagePanelProps {
  t: (key: string, fallback?: string) => string
  formatDate: (iso: string) => string
  state: SectionState
  usage: ApiKeyUsage | null
}

function statusVariant(status: number): 'success' | 'warning' | 'destructive' {
  if (status >= 500) return 'destructive'
  if (status >= 400) return 'warning'
  return 'success'
}

export const KeyUsagePanel = memo(function KeyUsagePanel({
  t,
  formatDate,
  state,
  usage,
}: KeyUsagePanelProps) {
  if (state === 'loading')
    return <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('developer.loading')}</p>
  // 503 here means migration 02 has not run: the keys work, the log does not exist yet.
  if (state === 'not-configured') {
    return (
      <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('developer.usageNotConfigured')}</p>
    )
  }
  if (state !== 'ready' || !usage) {
    return (
      <p className="text-sm text-[hsl(var(--color-destructive))]">{t('developer.loadError')}</p>
    )
  }

  return (
    <div className="w-full space-y-3 rounded-xl bg-[hsl(var(--surface-muted))] p-3 text-sm">
      <p className="font-medium text-[hsl(var(--fg-primary))]">{t('developer.usageTitle')}</p>
      {usage.daily.length === 0 ? (
        <p className="text-[hsl(var(--fg-secondary))]">{t('developer.usageEmpty')}</p>
      ) : (
        <SearchableTable
          tableId="developer-key-usage"
          rows={usage.daily}
          rowKey={(day) => day.day}
          words={(day) => [formatDate(day.day)]}
          empty={t('developer.usageEmpty')}
          columns={[
            {
              id: 'day',
              labelKey: 'developer.usageDay',
              labelFallback: t('developer.usageDay'),
              locked: true,
              sortValue: (day) => day.day,
              render: (day) => formatDate(day.day),
            },
            {
              id: 'requests',
              labelKey: 'developer.usageRequests',
              labelFallback: t('developer.usageRequests'),
              align: 'end',
              sortValue: (day) => day.requests,
              render: (day) => (
                <span className="tabular-nums" dir="ltr">
                  {day.requests}
                </span>
              ),
            },
            {
              id: 'clientErrors',
              labelKey: 'developer.usageClientErrors',
              labelFallback: t('developer.usageClientErrors'),
              align: 'end',
              sortValue: (day) => day.client_errors,
              render: (day) => (
                <span className="tabular-nums" dir="ltr">
                  {day.client_errors}
                </span>
              ),
            },
            {
              id: 'serverErrors',
              labelKey: 'developer.usageServerErrors',
              labelFallback: t('developer.usageServerErrors'),
              align: 'end',
              sortValue: (day) => day.server_errors,
              render: (day) => (
                <span className="tabular-nums" dir="ltr">
                  {day.server_errors}
                </span>
              ),
            },
            {
              id: 'avgMs',
              labelKey: 'developer.usageAvgMs',
              labelFallback: t('developer.usageAvgMs'),
              align: 'end',
              sortValue: (day) => day.avg_ms ?? null,
              render: (day) => (
                <span className="tabular-nums" dir="ltr">
                  {day.avg_ms ?? '—'}
                </span>
              ),
            },
          ]}
        />
      )}

      {usage.recent.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('developer.recentRequests')}</p>
          <ul className="space-y-1">
            {usage.recent.map((r, i) => (
              <li
                key={`${r.created_at}-${i}`}
                className="flex flex-wrap items-center gap-2 text-xs"
              >
                <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                <code dir="ltr">
                  {r.method} {r.route}
                </code>
                <span className="text-[hsl(var(--fg-tertiary))]" dir="ltr">
                  {r.duration_ms} ms
                </span>
                <span className="text-[hsl(var(--fg-tertiary))]">{formatDate(r.created_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
})

KeyUsagePanel.displayName = 'KeyUsagePanel'
