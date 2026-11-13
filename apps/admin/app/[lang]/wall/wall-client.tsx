'use client'

// ============================================
// apps/admin/app/[lang]/wall/wall-client.tsx
//
// V63 · M-6 — the television. A TV has no admin session and cannot hold MFA,
// so this page's only credential is a wall token: read-only, expiring,
// revocable, bound to aggregate counts. It reaches nothing else.
//
// The token arrives once in the address, is kept in memory here, and is sent
// as `x-wall-token` on every poll. It is never written to localStorage.
// ============================================

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button, Card, CardContent, Input, Label } from '@/components/ui'
import { useAdminLocale } from '@/hooks/use-admin-locale'
import { adminNumber, UNKNOWN_VALUE } from '@/lib/admin-format'
import type { MonitorSnapshot } from '@/hooks/use-admin-monitor'

const POLL_MS = 10_000

function formatBytes(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return UNKNOWN_VALUE
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = value
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit += 1
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}

export function WallClient() {
  const t = useTranslations()
  const locale = useAdminLocale()
  const [token, setToken] = useState('')
  const [entry, setEntry] = useState('')
  const [snapshot, setSnapshot] = useState<MonitorSnapshot | null>(null)
  const [invalid, setInvalid] = useState(false)

  // The address carries the token once. Read it after mount so this page needs
  // no Suspense boundary and never renders a token into the HTML.
  //
  // ⚠️ Then it is removed from the address at once (`replaceState`): a token
  // left in the URL stays in the browser history, in a screenshot of the TV
  // and in any proxy log of the next navigation (V63 audit, 12 Nov 2026).
  useEffect(() => {
    const url = new URL(window.location.href)
    const fromUrl = url.searchParams.get('token')
    if (fromUrl === null) return
    url.searchParams.delete('token')
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
    if (fromUrl.length >= 20) setToken(fromUrl)
  }, [])

  useEffect(() => {
    if (token === '') return
    let cancelled = false

    const load = async () => {
      const base = process.env.NEXT_PUBLIC_API_URL ?? ''
      try {
        const response = await fetch(`${base}/api/wall/overview`, {
          headers: { 'x-wall-token': token },
          cache: 'no-store',
        })
        if (cancelled) return
        if (!response.ok) {
          setInvalid(true)
          setSnapshot(null)
          return
        }
        setInvalid(false)
        setSnapshot((await response.json()) as MonitorSnapshot)
      } catch {
        if (!cancelled) setInvalid(true)
      }
    }

    void load()
    const timer = setInterval(() => void load(), POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [token])

  if (token === '') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md">
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-1 text-start">
              <h1 className="text-lg font-semibold text-foreground">
                {t('admin.operations.monitor.wallTitle')}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t('admin.operations.monitor.wallTokenPrompt')}
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="wall-token">{t('admin.operations.monitor.tokenLabel')}</Label>
              <Input
                id="wall-token"
                dir="ltr"
                autoComplete="off"
                value={entry}
                onChange={(event) => setEntry(event.target.value)}
              />
            </div>
            <Button
              className="w-full"
              disabled={entry.trim().length < 20}
              onClick={() => setToken(entry.trim())}
            >
              {t('admin.operations.monitor.wallOpen')}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (invalid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md">
          <CardContent className="space-y-3 pt-6 text-center">
            <h1 className="text-lg font-semibold text-foreground">
              {t('admin.operations.monitor.wallTokenInvalid')}
            </h1>
            <Button
              variant="outline"
              onClick={() => {
                setToken('')
                setEntry('')
                setInvalid(false)
              }}
            >
              {t('admin.operations.monitor.tokenLabel')}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const overview = snapshot?.overview
  const vitals = snapshot?.vitals
  const alerts = snapshot?.alerts ?? []

  return (
    <div className="min-h-screen bg-background p-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {t('admin.operations.monitor.wallTitle')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('admin.operations.monitor.wallSubtitle')}
          </p>
        </div>
        {overview && (
          <p className="font-mono text-xs text-muted-foreground" dir="ltr">
            {overview.generatedAt}
          </p>
        )}
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <Big
          label={t('admin.operations.monitor.onlineUsers')}
          value={overview ? adminNumber(overview.onlineUsers, locale) : UNKNOWN_VALUE}
        />
        <Big
          label={t('admin.operations.monitor.onlineWorkspaces')}
          value={overview ? adminNumber(overview.onlineWorkspaces, locale) : UNKNOWN_VALUE}
        />
        <Big
          label={t('admin.operations.monitor.requests')}
          value={overview ? adminNumber(overview.requests, locale) : UNKNOWN_VALUE}
        />
        <Big
          label={t('admin.operations.monitor.errorRate')}
          value={
            overview && overview.requests > 0
              ? `${((overview.errors5xx / overview.requests) * 100).toFixed(2)}%`
              : UNKNOWN_VALUE
          }
        />
        <Big
          label={t('admin.operations.monitor.bandwidth')}
          value={overview ? formatBytes(overview.bytesOut) : UNKNOWN_VALUE}
        />
        <Big
          label={t('admin.operations.monitor.instancesOnline')}
          value={overview ? adminNumber(overview.instances.length, locale) : UNKNOWN_VALUE}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <h2 className="mb-3 text-sm font-semibold text-foreground">
              {t('admin.operations.monitor.instances')}
            </h2>
            <ul className="space-y-2">
              {(overview?.instances ?? []).map((instance) => (
                <li key={instance.instanceId} className="rounded-lg border border-border p-2">
                  <p dir="ltr" className="font-mono text-xs text-foreground">
                    {instance.instanceId}
                  </p>
                  <p dir="ltr" className="mt-1 font-mono text-xs text-muted-foreground">
                    CPU {instance.cpuPercent.toFixed(1)}% · RAM {instance.memoryPercent.toFixed(1)}%
                    · loop {instance.eventLoopP99Ms.toFixed(0)} ms
                  </p>
                </li>
              ))}
              {(overview?.instances ?? []).length === 0 && (
                <li className="text-sm text-muted-foreground">
                  {t('admin.operations.monitor.noInstances')}
                </li>
              )}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h2 className="mb-3 text-sm font-semibold text-foreground">
              {t('admin.operations.monitor.dbTitle')}
            </h2>
            {vitals?.available ? (
              <dl className="space-y-2 text-sm">
                <Row
                  label={t('admin.operations.monitor.dbSize')}
                  value={formatBytes(vitals.databaseSizeBytes)}
                />
                <Row
                  label={t('admin.operations.monitor.connections')}
                  value={
                    vitals.connections
                      ? `${vitals.connections.total} / ${vitals.connections.max}`
                      : UNKNOWN_VALUE
                  }
                />
                <Row
                  label={t('admin.operations.monitor.cacheHit')}
                  value={
                    vitals.cacheHitRatio === null
                      ? UNKNOWN_VALUE
                      : `${(vitals.cacheHitRatio * 100).toFixed(2)}%`
                  }
                />
                <Row
                  label={t('admin.operations.monitor.replicationLag')}
                  value={
                    vitals.replicationLagSeconds === null
                      ? t('admin.operations.monitor.noReplica')
                      : `${vitals.replicationLagSeconds} s`
                  }
                />
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">
                {vitals?.reason ?? t('admin.operations.monitor.dbUnavailable')}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h2 className="mb-3 text-sm font-semibold text-foreground">
              {t('admin.operations.monitor.alerts')}
            </h2>
            <ul className="space-y-2">
              {alerts
                .filter((row) => row.state !== 'ok' && row.state !== 'disabled')
                .map((row) => (
                  <li key={row.rule.id} className="rounded-lg border border-border p-2 text-sm">
                    <span dir="ltr" className="font-mono text-xs text-foreground">
                      {row.rule.metric}
                    </span>{' '}
                    — {row.state}
                  </li>
                ))}
              {alerts.filter((row) => row.state !== 'ok' && row.state !== 'disabled').length ===
                0 && (
                <li className="text-sm text-muted-foreground">
                  {t('admin.operations.monitor.noAlerts')}
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <TopList
          title={t('admin.operations.monitor.topByTime')}
          rows={(overview?.topRoutesByTime ?? []).map((row) => ({
            key: `${row.method}-${row.route}`,
            label: `${row.method} ${row.route}`,
            value: `${adminNumber(row.totalMs ?? 0, locale)} ms`,
          }))}
          empty={t('admin.operations.monitor.noTraffic')}
        />
        <TopList
          title={t('admin.operations.monitor.topByBytes')}
          rows={(overview?.topRoutesByBytes ?? []).map((row) => ({
            key: `${row.method}-${row.route}`,
            label: `${row.method} ${row.route}`,
            value: formatBytes(row.bytes ?? null),
          }))}
          empty={t('admin.operations.monitor.noTraffic')}
        />
      </div>
    </div>
  )
}

function Big({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p dir="ltr" className="mt-1 font-mono text-3xl font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd dir="ltr" className="font-mono tabular-nums text-foreground">
        {value}
      </dd>
    </div>
  )
}

function TopList({
  title,
  rows,
  empty,
}: {
  title: string
  rows: Array<{ key: string; label: string; value: string }>
  empty: string
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="mb-3 text-sm font-semibold text-foreground">{title}</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={row.key} className="flex items-center justify-between gap-3 text-sm">
                <span dir="ltr" className="truncate font-mono text-xs text-foreground">
                  {row.label}
                </span>
                <span dir="ltr" className="font-mono text-xs tabular-nums text-muted-foreground">
                  {row.value}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
