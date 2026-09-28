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
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[hsl(var(--fg-tertiary))]">
              <th className="text-start font-normal">{t('developer.usageDay')}</th>
              <th className="text-end font-normal">{t('developer.usageRequests')}</th>
              <th className="text-end font-normal">{t('developer.usageClientErrors')}</th>
              <th className="text-end font-normal">{t('developer.usageServerErrors')}</th>
              <th className="text-end font-normal">{t('developer.usageAvgMs')}</th>
            </tr>
          </thead>
          <tbody>
            {usage.daily.map((d) => (
              <tr key={d.day}>
                <td>{formatDate(d.day)}</td>
                <td className="text-end tabular-nums" dir="ltr">
                  {d.requests}
                </td>
                <td className="text-end tabular-nums" dir="ltr">
                  {d.client_errors}
                </td>
                <td className="text-end tabular-nums" dir="ltr">
                  {d.server_errors}
                </td>
                <td className="text-end tabular-nums" dir="ltr">
                  {d.avg_ms ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
