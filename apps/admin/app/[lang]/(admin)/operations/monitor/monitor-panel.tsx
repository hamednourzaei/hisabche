'use client'

// ============================================
// apps/admin/app/[lang]/(admin)/operations/monitor/monitor-panel.tsx
//
// V63 · M-3 … M-7 — the `monitor` tab of the operations hub.
//
// Three rules this screen keeps:
//   - a value that could not be read is «—», never 0;
//   - every gauge states whether its limit is known, and a limit that is not
//     configured says so instead of inventing a denominator;
//   - the wall token is shown exactly once, when it is created. It cannot be
//     read back, here or anywhere.
// ============================================

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DataTable,
  EmptyState,
  Input,
  Label,
  SegmentedControl,
  Skeleton,
  type TableColumn,
} from '@/components/ui'
import { ErrorState, useAdminTableT } from '@/components/admin-shell/admin-ui'
import { StepUpDialog } from '@/components/admin-shell/step-up-dialog'
import { useAdminLocale } from '@/hooks/use-admin-locale'
import { adminDateTime, adminNumber, UNKNOWN_VALUE } from '@/lib/admin-format'
import {
  useAdminMonitor,
  useAdminMonitorSeries,
  useAdminWallTokens,
  useCreateWallToken,
  useRevokeWallToken,
  useUpdateMonitorAlert,
  type MonitorAlertEvaluationItem,
  type MonitorAlertRuleItem,
  type MonitorInstanceItem,
  type MonitorRange,
  type MonitorRouteItem,
  type MonitorStatementItem,
  type WallTokenItem,
} from '@/hooks/use-admin-monitor'

const RANGES: readonly MonitorRange[] = ['1h', '24h', '7d', '90d']

type PendingAction =
  | { kind: 'alert'; rule: MonitorAlertRuleItem }
  | { kind: 'create-token' }
  | { kind: 'revoke-token'; token: WallTokenItem }
  | null

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

function percent(value: number, total: number): string {
  if (total <= 0) return UNKNOWN_VALUE
  return `${((value / total) * 100).toFixed(2)}%`
}

function StateBadge({ state }: { state: string }) {
  const t = useTranslations()
  const variant =
    state === 'breaching'
      ? 'destructive'
      : state === 'pending'
        ? 'outline'
        : state === 'ok'
          ? 'default'
          : 'secondary'
  return (
    <Badge variant={variant} className="text-xs">
      {t(`admin.operations.monitor.state.${state}`)}
    </Badge>
  )
}

export function MonitorPanel() {
  const t = useTranslations()
  const locale = useAdminLocale()
  const tableT = useAdminTableT()
  const { data, isLoading, isError, refetch } = useAdminMonitor()
  const [range, setRange] = useState<MonitorRange>('1h')
  const { data: series } = useAdminMonitorSeries(range)
  const { data: tokens, isLoading: tokensLoading, refetch: refetchTokens } = useAdminWallTokens()
  const { mutateAsync: updateAlert } = useUpdateMonitorAlert()
  const { mutateAsync: createToken } = useCreateWallToken()
  const { mutateAsync: revokeToken } = useRevokeWallToken()

  const [pending, setPending] = useState<PendingAction>(null)
  const [draft, setDraft] = useState({ label: '', expiresAt: '', ipCidr: '' })
  const [thresholdDraft, setThresholdDraft] = useState('')
  const [createdToken, setCreatedToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const overview = data?.overview
  const vitals = data?.vitals
  const alerts = data?.alerts ?? []

  const instanceColumns: TableColumn<MonitorInstanceItem>[] = [
    {
      id: 'instance',
      labelKey: 'admin.operations.monitor.instance',
      labelFallback: 'سرور',
      locked: true,
      render: (row) => (
        <span dir="ltr" className="font-mono text-xs text-foreground">
          {row.instanceId}
        </span>
      ),
      sortValue: (row) => row.instanceId,
    },
    {
      id: 'cpu',
      labelKey: 'admin.operations.monitor.cpu',
      labelFallback: 'CPU',
      render: (row) => (
        <span className="tabular-nums">{adminNumber(row.cpuPercent, locale, 1)}%</span>
      ),
      sortValue: (row) => row.cpuPercent,
    },
    {
      id: 'memory',
      labelKey: 'admin.operations.monitor.memory',
      labelFallback: 'RAM',
      render: (row) => (
        <span className="tabular-nums">{adminNumber(row.memoryPercent, locale, 1)}%</span>
      ),
      sortValue: (row) => row.memoryPercent,
    },
    {
      id: 'eventLoop',
      labelKey: 'admin.operations.monitor.eventLoop',
      labelFallback: 'تأخیر حلقه',
      showFrom: 'md',
      render: (row) => (
        <span className="tabular-nums">{adminNumber(row.eventLoopP99Ms, locale, 1)} ms</span>
      ),
      sortValue: (row) => row.eventLoopP99Ms,
    },
    {
      id: 'inflight',
      labelKey: 'admin.operations.monitor.inflight',
      labelFallback: 'درخواست باز',
      showFrom: 'md',
      render: (row) => (
        <span className="tabular-nums">{adminNumber(row.inflightRequests, locale)}</span>
      ),
      sortValue: (row) => row.inflightRequests,
    },
    {
      id: 'sockets',
      labelKey: 'admin.operations.monitor.syncSockets',
      labelFallback: 'دستگاه متصل',
      showFrom: 'lg',
      render: (row) => <span className="tabular-nums">{adminNumber(row.syncSockets, locale)}</span>,
      sortValue: (row) => row.syncSockets,
    },
    {
      id: 'seen',
      labelKey: 'admin.operations.monitor.lastSample',
      labelFallback: 'آخرین نمونه',
      showFrom: 'lg',
      render: (row) => (
        <span className="whitespace-nowrap tabular-nums text-muted-foreground">
          {adminDateTime(row.minute, locale)}
        </span>
      ),
      sortValue: (row) => row.minute,
    },
  ]

  const routeColumns = (kind: 'time' | 'bytes'): TableColumn<MonitorRouteItem>[] => [
    {
      id: 'route',
      labelKey: 'admin.operations.monitor.route',
      labelFallback: 'مسیر',
      locked: true,
      render: (row) => (
        <span dir="ltr" className="block max-w-[260px] truncate font-mono text-xs text-foreground">
          {row.route}
        </span>
      ),
      sortValue: (row) => row.route,
    },
    {
      id: 'method',
      labelKey: 'admin.operations.monitor.method',
      labelFallback: 'متد',
      render: (row) => <span className="font-mono text-xs">{row.method}</span>,
      sortValue: (row) => row.method,
    },
    {
      id: 'count',
      labelKey: 'admin.operations.monitor.count',
      labelFallback: 'تعداد',
      render: (row) => <span className="tabular-nums">{adminNumber(row.count, locale)}</span>,
      sortValue: (row) => row.count,
    },
    {
      id: 'measure',
      labelKey:
        kind === 'time' ? 'admin.operations.monitor.totalMs' : 'admin.operations.monitor.bytes',
      labelFallback: kind === 'time' ? 'زمان کل' : 'حجم',
      align: 'end',
      render: (row) =>
        kind === 'time' ? (
          <span className="tabular-nums">
            {row.totalMs === null || row.totalMs === undefined
              ? UNKNOWN_VALUE
              : `${adminNumber(row.totalMs, locale)} ms`}
          </span>
        ) : (
          <span className="tabular-nums">{formatBytes(row.bytes ?? null)}</span>
        ),
      sortValue: (row) => (kind === 'time' ? (row.totalMs ?? 0) : (row.bytes ?? 0)),
    },
  ]

  const tokenColumns: TableColumn<WallTokenItem>[] = [
    {
      id: 'label',
      labelKey: 'admin.operations.monitor.tokenLabel',
      labelFallback: 'برچسب',
      locked: true,
      render: (row) => <span className="font-medium text-foreground">{row.label}</span>,
      sortValue: (row) => row.label,
    },
    {
      id: 'state',
      labelKey: 'admin.operations.monitor.tokenState',
      labelFallback: 'وضعیت',
      render: (row) => (
        <Badge
          variant={
            row.state === 'active' ? 'default' : row.state === 'revoked' ? 'destructive' : 'outline'
          }
        >
          {t(`admin.operations.monitor.token.${row.state}`)}
        </Badge>
      ),
      sortValue: (row) => row.state,
    },
    {
      id: 'expires',
      labelKey: 'admin.operations.monitor.tokenExpires',
      labelFallback: 'انقضا',
      showFrom: 'md',
      render: (row) => (
        <span className="whitespace-nowrap tabular-nums text-muted-foreground">
          {adminDateTime(row.expiresAt, locale)}
        </span>
      ),
      sortValue: (row) => row.expiresAt,
    },
    {
      id: 'lastUsed',
      labelKey: 'admin.operations.monitor.tokenLastUsed',
      labelFallback: 'آخرین استفاده',
      showFrom: 'lg',
      render: (row) => (
        <span className="whitespace-nowrap tabular-nums text-muted-foreground">
          {row.lastUsedAt ? adminDateTime(row.lastUsedAt, locale) : UNKNOWN_VALUE}
        </span>
      ),
      sortValue: (row) => row.lastUsedAt ?? '',
    },
    {
      id: 'actions',
      labelKey: 'admin.operations.monitor.actions',
      labelFallback: 'عملیات',
      align: 'end',
      locked: true,
      render: (row) =>
        row.state === 'active' ? (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setPending({ kind: 'revoke-token', token: row })}
          >
            {t('admin.operations.monitor.revoke')}
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">{UNKNOWN_VALUE}</span>
        ),
    },
  ]

  const statementColumns: TableColumn<MonitorStatementItem>[] = [
    {
      id: 'query',
      labelKey: 'admin.operations.monitor.query',
      labelFallback: 'پرس‌وجو',
      locked: true,
      render: (row) => (
        <span dir="ltr" className="block max-w-[420px] truncate font-mono text-xs text-foreground">
          {row.query}
        </span>
      ),
      sortValue: (row) => row.query,
    },
    {
      id: 'calls',
      labelKey: 'admin.operations.monitor.calls',
      labelFallback: 'فراخوانی',
      align: 'end',
      render: (row) => <span className="tabular-nums">{adminNumber(row.calls, locale)}</span>,
      sortValue: (row) => row.calls,
    },
    {
      id: 'totalMs',
      labelKey: 'admin.operations.monitor.totalMs',
      labelFallback: 'زمان کل',
      align: 'end',
      render: (row) => <span className="tabular-nums">{adminNumber(row.total_ms, locale, 1)}</span>,
      sortValue: (row) => row.total_ms,
    },
    {
      id: 'meanMs',
      labelKey: 'admin.operations.monitor.meanMs',
      labelFallback: 'میانگین',
      align: 'end',
      render: (row) => <span className="tabular-nums">{adminNumber(row.mean_ms, locale, 2)}</span>,
      sortValue: (row) => row.mean_ms,
    },
  ]

  // The history the chart draws; an empty window is an empty list, never undefined.
  const seriesPoints = useMemo(() => series?.points ?? [], [series])
  const maxRequests = useMemo(
    () => seriesPoints.reduce((max, point) => Math.max(max, point.requests), 0),
    [seriesPoints],
  )

  const handleConfirm = async ({
    stepUpTimestamp,
  }: {
    stepUpTimestamp: string
    reason?: string
  }) => {
    if (!pending) return
    if (pending.kind === 'alert') {
      await updateAlert({
        id: pending.rule.id,
        threshold: Number(thresholdDraft),
        durationMinutes: pending.rule.durationMinutes,
        isEnabled: pending.rule.isEnabled,
        severity: pending.rule.severity,
        stepUpTimestamp,
      })
    } else if (pending.kind === 'create-token') {
      // An empty field means "thirty days from now". Computed in the handler,
      // never during render: a clock read while rendering is not a pure render.
      const expiresAt = draft.expiresAt === '' ? defaultExpiry() : draft.expiresAt
      const created = await createToken({
        label: draft.label,
        expiresAt: new Date(expiresAt).toISOString(),
        ipCidr: draft.ipCidr.trim() === '' ? undefined : draft.ipCidr.trim(),
        stepUpTimestamp,
      })
      setCreatedToken(created.token)
      setDraft({ label: '', expiresAt: '', ipCidr: '' })
      void refetchTokens()
    } else {
      await revokeToken({ id: pending.token.id, stepUpTimestamp })
      void refetchTokens()
    }
    setPending(null)
  }

  const defaultExpiry = (): string =>
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)

  if (isError) {
    return (
      <ErrorState message={t('admin.operations.monitor.error')} onRetry={() => void refetch()} />
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Live totals ─────────────────────────────────────────── */}
      <Card>
        <CardHeader className="text-start">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>{t('admin.operations.monitor.title')}</CardTitle>
              <CardDescription>{t('admin.operations.monitor.description')}</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              {t('admin.operations.monitor.refresh')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading || !overview ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
              {Array.from({ length: 6 }, (_, index) => (
                <Skeleton key={index} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
              <Kpi
                label={t('admin.operations.monitor.onlineUsers')}
                value={adminNumber(overview.onlineUsers, locale)}
              />
              <Kpi
                label={t('admin.operations.monitor.onlineWorkspaces')}
                value={adminNumber(overview.onlineWorkspaces, locale)}
              />
              <Kpi
                label={t('admin.operations.monitor.requests')}
                value={adminNumber(overview.requests, locale)}
              />
              <Kpi
                label={t('admin.operations.monitor.errorRate')}
                value={percent(overview.errors5xx, overview.requests)}
                hint={`${adminNumber(overview.errors5xx, locale)} / ${adminNumber(overview.requests, locale)}`}
              />
              <Kpi
                label={t('admin.operations.monitor.bandwidth')}
                value={formatBytes(overview.bytesOut)}
                hint={
                  overview.bytesUnknownRows > 0
                    ? t('admin.operations.monitor.bandwidthUnknown', {
                        count: overview.bytesUnknownRows,
                      })
                    : undefined
                }
              />
              <Kpi
                label={t('admin.operations.monitor.instancesOnline')}
                value={adminNumber(overview.instances.length, locale)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── History ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="text-start">
          <CardTitle>{t('admin.operations.monitor.history')}</CardTitle>
          <CardDescription>{t('admin.operations.monitor.historyDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SegmentedControl
            label={t('admin.operations.monitor.history')}
            options={RANGES.map((value) => ({
              value,
              label: t(`admin.operations.monitor.range.${value}`),
            }))}
            value={range}
            onChange={setRange}
          />
          {seriesPoints.length === 0 ? (
            <EmptyState
              title={t('admin.operations.monitor.noHistory')}
              description={t('admin.operations.monitor.noHistoryHint')}
            />
          ) : (
            <div className="space-y-3">
              <div
                dir="ltr"
                className="flex h-24 items-end gap-1 overflow-hidden rounded-xl border border-border bg-muted/40 p-2"
                role="img"
                aria-label={t('admin.operations.monitor.history')}
              >
                {seriesPoints.slice(-120).map((point) => (
                  <div
                    key={point.bucket}
                    title={`${point.bucket} — ${point.requests}`}
                    className="min-w-[2px] flex-1 rounded-t bg-[hsl(var(--color-primary))]"
                    style={{
                      height: `${maxRequests > 0 ? Math.max(2, (point.requests / maxRequests) * 100) : 2}%`,
                    }}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {t('admin.operations.monitor.historySummary', {
                  points: seriesPoints.length,
                  unit: series?.unit ?? '',
                })}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Instances ───────────────────────────────────────────── */}
      <Card>
        <CardHeader className="text-start">
          <CardTitle>{t('admin.operations.monitor.instances')}</CardTitle>
          <CardDescription>{t('admin.operations.monitor.instancesDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            tableId="admin-monitor-instances"
            t={tableT}
            rows={overview?.instances ?? []}
            columns={instanceColumns}
            rowKey={(row) => row.instanceId}
            caption={t('admin.operations.monitor.instances')}
            minWidthClass="min-w-[720px]"
            emptyState={<EmptyState title={t('admin.operations.monitor.noInstances')} />}
          />
        </CardContent>
      </Card>

      {/* ── Database ────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="text-start">
          <CardTitle>{t('admin.operations.monitor.dbTitle')}</CardTitle>
          <CardDescription>{t('admin.operations.monitor.dbDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {!vitals ? (
            <Skeleton className="h-24 rounded-xl" />
          ) : !vitals.available ? (
            <EmptyState
              title={t('admin.operations.monitor.dbUnavailable')}
              description={vitals.reason ?? UNKNOWN_VALUE}
            />
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
              <Kpi
                label={t('admin.operations.monitor.dbSize')}
                value={formatBytes(vitals.databaseSizeBytes)}
              />
              <Kpi
                label={t('admin.operations.monitor.connections')}
                value={
                  vitals.connections
                    ? `${adminNumber(vitals.connections.total, locale)} / ${adminNumber(vitals.connections.max, locale)}`
                    : UNKNOWN_VALUE
                }
              />
              <Kpi
                label={t('admin.operations.monitor.cacheHit')}
                value={
                  vitals.cacheHitRatio === null
                    ? UNKNOWN_VALUE
                    : `${(vitals.cacheHitRatio * 100).toFixed(2)}%`
                }
              />
              <Kpi
                label={t('admin.operations.monitor.replicationLag')}
                value={
                  vitals.replicationLagSeconds === null
                    ? t('admin.operations.monitor.noReplica')
                    : `${adminNumber(vitals.replicationLagSeconds, locale, 1)} s`
                }
              />
              <Kpi
                label={t('admin.operations.monitor.waitingLocks')}
                value={
                  vitals.waitingLocks === null
                    ? UNKNOWN_VALUE
                    : adminNumber(vitals.waitingLocks, locale)
                }
              />
              <Kpi
                label={t('admin.operations.monitor.longestTransaction')}
                value={
                  vitals.longestTransactionSeconds === null
                    ? UNKNOWN_VALUE
                    : `${adminNumber(vitals.longestTransactionSeconds, locale, 1)} s`
                }
              />
            </div>
          )}

          {vitals?.statementsUnavailableReason && (
            <p className="mt-4 text-xs text-muted-foreground">
              {t('admin.operations.monitor.statementsUnavailable')}:{' '}
              {vitals.statementsUnavailableReason}
            </p>
          )}

          {vitals?.statements && vitals.statements.length > 0 && (
            <div className="mt-4">
              <DataTable
                tableId="admin-monitor-statements"
                t={tableT}
                rows={vitals.statements}
                columns={statementColumns}
                rowKey={(row, index) => `${index}-${row.calls}`}
                caption={t('admin.operations.monitor.topStatements')}
                minWidthClass="min-w-[640px]"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Top routes ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader className="text-start">
            <CardTitle>{t('admin.operations.monitor.topByTime')}</CardTitle>
            <CardDescription>{t('admin.operations.monitor.topByTimeDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              tableId="admin-monitor-top-time"
              t={tableT}
              rows={overview?.topRoutesByTime ?? []}
              columns={routeColumns('time')}
              rowKey={(row) => `${row.method}-${row.route}`}
              caption={t('admin.operations.monitor.topByTime')}
              minWidthClass="min-w-[560px]"
              emptyState={<EmptyState title={t('admin.operations.monitor.noTraffic')} />}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="text-start">
            <CardTitle>{t('admin.operations.monitor.topByBytes')}</CardTitle>
            <CardDescription>{t('admin.operations.monitor.topByBytesDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              tableId="admin-monitor-top-bytes"
              t={tableT}
              rows={overview?.topRoutesByBytes ?? []}
              columns={routeColumns('bytes')}
              rowKey={(row) => `${row.method}-${row.route}`}
              caption={t('admin.operations.monitor.topByBytes')}
              minWidthClass="min-w-[560px]"
              emptyState={<EmptyState title={t('admin.operations.monitor.noTraffic')} />}
            />
          </CardContent>
        </Card>
      </div>

      {/* ── Alerts ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="text-start">
          <CardTitle>{t('admin.operations.monitor.alerts')}</CardTitle>
          <CardDescription>{t('admin.operations.monitor.alertsDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {alerts.length === 0 ? (
            <EmptyState title={t('admin.operations.monitor.noAlerts')} />
          ) : (
            alerts.map((evaluation) => (
              <AlertRow
                key={evaluation.rule.id}
                evaluation={evaluation}
                onEdit={(rule, threshold) => {
                  setThresholdDraft(String(threshold))
                  setPending({ kind: 'alert', rule })
                }}
              />
            ))
          )}
        </CardContent>
      </Card>

      {/* ── Wall tokens ─────────────────────────────────────────── */}
      <Card>
        <CardHeader className="text-start">
          <CardTitle>{t('admin.operations.monitor.wallTokens')}</CardTitle>
          <CardDescription>{t('admin.operations.monitor.wallTokensDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {createdToken && (
            <div className="space-y-2 rounded-xl border border-border p-3">
              <p className="text-sm font-medium text-foreground">
                {t('admin.operations.monitor.tokenOnce')}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <code
                  dir="ltr"
                  className="max-w-full overflow-x-auto rounded bg-muted px-2 py-1 text-xs"
                >
                  {createdToken}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(createdToken).then(() => setCopied(true))
                  }}
                >
                  {copied
                    ? t('admin.operations.monitor.copied')
                    : t('admin.operations.monitor.copyToken')}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('admin.operations.monitor.wallHint')}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="wall-token-label">{t('admin.operations.monitor.tokenLabel')}</Label>
              <Input
                id="wall-token-label"
                value={draft.label}
                maxLength={80}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, label: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="wall-token-expiry">
                {t('admin.operations.monitor.tokenExpires')}
              </Label>
              <Input
                id="wall-token-expiry"
                type="datetime-local"
                dir="ltr"
                value={draft.expiresAt}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, expiresAt: event.target.value }))
                }
              />
              <p className="text-xs text-[hsl(var(--fg-tertiary))]">
                {t('admin.operations.monitor.tokenExpiryHint')}
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="wall-token-cidr">{t('admin.operations.monitor.tokenIp')}</Label>
              <Input
                id="wall-token-cidr"
                dir="ltr"
                placeholder="203.0.113.0/24"
                value={draft.ipCidr}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, ipCidr: event.target.value }))
                }
              />
            </div>
          </div>

          <Button
            size="sm"
            disabled={draft.label.trim() === ''}
            onClick={() => setPending({ kind: 'create-token' })}
          >
            {t('admin.operations.monitor.createToken')}
          </Button>

          {tokensLoading ? (
            <Skeleton className="h-24 rounded-xl" />
          ) : (
            <DataTable
              tableId="admin-wall-tokens"
              t={tableT}
              rows={tokens?.tokens ?? []}
              columns={tokenColumns}
              rowKey={(row) => row.id}
              caption={t('admin.operations.monitor.wallTokens')}
              minWidthClass="min-w-[640px]"
              emptyState={<EmptyState title={t('admin.operations.monitor.noTokens')} />}
            />
          )}
        </CardContent>
      </Card>

      <StepUpDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={
          pending?.kind === 'alert'
            ? t('admin.operations.monitor.alertConfirmTitle')
            : pending?.kind === 'create-token'
              ? t('admin.operations.monitor.tokenConfirmTitle')
              : t('admin.operations.monitor.tokenRevokeTitle')
        }
        description={
          pending?.kind === 'alert'
            ? t('admin.operations.monitor.alertConfirmDesc', {
                metric: pending.rule.metric,
                threshold: thresholdDraft,
              })
            : pending?.kind === 'create-token'
              ? t('admin.operations.monitor.tokenConfirmDesc')
              : t('admin.operations.monitor.tokenRevokeDesc')
        }
        destructive={pending?.kind === 'revoke-token'}
        confirmLabel={t('admin.operations.monitor.confirm')}
        onConfirm={handleConfirm}
      />
    </div>
  )
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string | undefined }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-foreground" dir="ltr">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function AlertRow({
  evaluation,
  onEdit,
}: {
  evaluation: MonitorAlertEvaluationItem
  onEdit: (rule: MonitorAlertRuleItem, threshold: number) => void
}) {
  const t = useTranslations()
  const locale = useAdminLocale()
  const { rule, currentValue, state, breachedForMinutes } = evaluation
  const [threshold, setThreshold] = useState(String(rule.threshold))
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span dir="ltr" className="font-mono text-xs font-semibold text-foreground">
            {rule.metric}
          </span>
          <Badge
            variant={rule.severity === 'critical' ? 'destructive' : 'outline'}
            className="text-xs"
          >
            {t(`admin.operations.monitor.severity.${rule.severity}`)}
          </Badge>
          <StateBadge state={state} />
        </div>
        <p className="text-xs text-muted-foreground" dir="ltr">
          {rule.comparator} {rule.threshold} · {rule.durationMinutes} min ·{' '}
          {currentValue === null ? UNKNOWN_VALUE : adminNumber(currentValue, locale, 2)}
          {state === 'pending' || state === 'breaching'
            ? ` · ${adminNumber(breachedForMinutes, locale)} min`
            : ''}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Label htmlFor={`alert-threshold-${rule.id}`} className="sr-only">
          {t('admin.operations.monitor.threshold')}
        </Label>
        <Input
          id={`alert-threshold-${rule.id}`}
          type="number"
          dir="ltr"
          className="w-28"
          value={threshold}
          onChange={(event) => setThreshold(event.target.value)}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={threshold.trim() === '' || !Number.isFinite(Number(threshold))}
          onClick={() => onEdit(rule, Number(threshold))}
        >
          {t('admin.operations.monitor.editThreshold')}
        </Button>
      </div>
    </div>
  )
}
