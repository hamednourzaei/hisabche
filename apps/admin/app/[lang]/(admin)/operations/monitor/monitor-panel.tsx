'use client'

// ============================================
// apps/admin/app/[lang]/(admin)/operations/monitor/monitor-panel.tsx
//
// V63 · M-3 … M-7 + Unified Core Observability (21 Nov 2026).
// The `monitor` tab of the operations hub — ONE page for the whole system:
// system overview · core pressure ranking · core detail · history ·
// instances (online AND offline) · database · alerts + event history · wall.
//
// Rules this screen keeps:
//   - a value that could not be read is «—», never 0; a core without data is
//     UNKNOWN with its reason, never «healthy at zero»;
//   - percentiles in the open histogram bucket render «≥ 1000», not a fake
//     exact number;
//   - the live stream is the source while connected; polling is the declared
//     fallback and the badge says which one is active;
//   - every chart is the shared TrendChart (recharts), every KPI the shared
//     KpiCard, every list the shared DataTable, bytes the shared formatter;
//   - the wall token is shown exactly once, when it is created.
// ============================================

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { formatBytes } from '@hisabche/formatting'
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  Database,
  Minus,
  Server,
  Users,
} from 'lucide-react'
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
  KpiCard,
  KpiGrid,
  Label,
  SegmentedControl,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Skeleton,
  TableFilterSelect,
  TrendChart,
  type TableColumn,
  type TrendSeries,
} from '@/components/ui'
import { ErrorState, useAdminTableT } from '@/components/admin-shell/admin-ui'
import type { AdminLocale } from '@/components/admin-shell/admin-nav'
import { StepUpDialog } from '@/components/admin-shell/step-up-dialog'
import { useAdminLocale } from '@/hooks/use-admin-locale'
import { adminDateTime, adminNumber, UNKNOWN_VALUE } from '@/lib/admin-format'
import {
  useAdminAlertEvents,
  useAdminCoreSeries,
  useAdminMonitor,
  useAdminMonitorCores,
  useAdminMonitorSeries,
  useAdminMonitorStream,
  useAdminWallTokens,
  useCreateWallToken,
  useRevokeWallToken,
  useUpdateMonitorAlert,
  type AlertEventItem,
  type CoreInstanceItem,
  type CorePressureItem,
  type CoreStatus,
  type MonitorAlertEvaluationItem,
  type MonitorAlertRuleItem,
  type MonitorRange,
  type MonitorRouteItem,
  type MonitorStatementItem,
  type PercentileEstimate,
  type WallTokenItem,
} from '@/hooks/use-admin-monitor'

const RANGES: readonly MonitorRange[] = ['1h', '24h', '7d', '30d', '90d']
const CORE_GROUPS = [
  'identity',
  'commerce',
  'finance',
  'operations',
  'people',
  'industry',
  'sync',
  'intelligence',
  'platform',
] as const

type PendingAction =
  | { kind: 'alert'; rule: MonitorAlertRuleItem }
  | { kind: 'create-token' }
  | { kind: 'revoke-token'; token: WallTokenItem }
  | null

/** Shared formatter; null stays UNKNOWN — the formatter itself never sees null. */
function bytes(value: number | null, locale: string): string {
  return value === null || !Number.isFinite(value) ? UNKNOWN_VALUE : formatBytes(value, locale)
}

function percent(value: number, total: number): string {
  if (total <= 0) return UNKNOWN_VALUE
  return `${((value / total) * 100).toFixed(2)}%`
}

function percentileText(estimate: PercentileEstimate | null, locale: AdminLocale): string {
  if (!estimate) return UNKNOWN_VALUE
  const value = adminNumber(estimate.value, locale)
  return estimate.atLeast ? `≥ ${value}` : value
}

const STATUS_VARIANT: Record<CoreStatus, 'default' | 'outline' | 'destructive' | 'secondary'> = {
  healthy: 'default',
  warning: 'outline',
  critical: 'destructive',
  unknown: 'secondary',
}

function CoreStatusBadge({ status }: { status: CoreStatus }) {
  const t = useTranslations()
  return (
    <Badge variant={STATUS_VARIANT[status]} className="text-xs">
      {t(`admin.operations.monitor.status.${status}`)}
    </Badge>
  )
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

function TrendMark({ trend }: { trend: number | null }) {
  if (trend === null) return <Minus className="size-3.5 text-muted-foreground" aria-hidden="true" />
  if (trend > 0)
    return (
      <ArrowUpRight className="size-3.5 text-[hsl(var(--color-destructive))]" aria-hidden="true" />
    )
  if (trend < 0)
    return (
      <ArrowDownRight className="size-3.5 text-[hsl(var(--color-success))]" aria-hidden="true" />
    )
  return <Minus className="size-3.5 text-muted-foreground" aria-hidden="true" />
}

export function MonitorPanel() {
  const t = useTranslations()
  const locale = useAdminLocale()
  const tableT = useAdminTableT()
  const stream = useAdminMonitorStream()
  const { data, isLoading, isError, refetch } = useAdminMonitor({ paused: stream.paused })
  const {
    data: coreData,
    isLoading: coresLoading,
    isError: coresError,
    refetch: refetchCores,
  } = useAdminMonitorCores({ paused: stream.paused })
  const [range, setRange] = useState<MonitorRange>('1h')
  const {
    data: series,
    isError: seriesError,
    refetch: refetchSeries,
  } = useAdminMonitorSeries(range)
  const { data: alertEvents } = useAdminAlertEvents()
  const { data: tokens, isLoading: tokensLoading, refetch: refetchTokens } = useAdminWallTokens()
  const { mutateAsync: updateAlert } = useUpdateMonitorAlert()
  const { mutateAsync: createToken } = useCreateWallToken()
  const { mutateAsync: revokeToken } = useRevokeWallToken()

  const [pending, setPending] = useState<PendingAction>(null)
  const [draft, setDraft] = useState({ label: '', expiresAt: '', ipCidr: '' })
  const [thresholdDraft, setThresholdDraft] = useState('')
  const [createdToken, setCreatedToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [coreSearch, setCoreSearch] = useState('')
  const [coreGroup, setCoreGroup] = useState('all')
  const [openCoreId, setOpenCoreId] = useState<string | null>(null)

  const overview = data?.overview
  const vitals = data?.vitals
  const alerts = data?.alerts ?? []
  const cores = useMemo(() => coreData?.cores ?? [], [coreData])
  const counts = coreData?.counts
  const instances = coreData?.instances ?? []
  const onlineInstances = instances.filter((instance) => instance.online)
  const workers = onlineInstances.filter((instance) => instance.processRole !== 'api')

  // Highest pressure first; UNKNOWN cores sink to the bottom but stay visible.
  const rankedCores = useMemo(() => {
    const query = coreSearch.trim().toLowerCase()
    return cores
      .filter((core) => coreGroup === 'all' || core.group === coreGroup)
      .filter(
        (core) =>
          query === '' ||
          core.id.toLowerCase().includes(query) ||
          core.owner.toLowerCase().includes(query),
      )
      .slice()
      .sort((a, b) => (b.pressure ?? -1) - (a.pressure ?? -1))
  }, [cores, coreSearch, coreGroup])

  const openCore = cores.find((core) => core.id === openCoreId) ?? null

  const seriesPoints = useMemo(() => series?.points ?? [], [series])
  const historySeries: TrendSeries[] = [
    {
      key: 'requests',
      label: t('admin.operations.monitor.requests'),
      color: 'hsl(var(--color-primary))',
      kind: 'area',
    },
    {
      key: 'errors',
      label: t('admin.operations.monitor.errors'),
      color: 'hsl(var(--color-destructive))',
      kind: 'line',
    },
  ]

  const coreColumns: TableColumn<CorePressureItem>[] = [
    {
      id: 'core',
      labelKey: 'admin.operations.monitor.core',
      labelFallback: 'هسته',
      locked: true,
      render: (row) => (
        <div className="space-y-0.5">
          <span dir="ltr" className="block font-mono text-xs font-semibold text-foreground">
            {row.id}
          </span>
          <span className="block text-xs text-muted-foreground">
            {t(`admin.operations.monitor.groups.${row.group}`)}
          </span>
        </div>
      ),
      sortValue: (row) => row.id,
    },
    {
      id: 'status',
      labelKey: 'admin.operations.monitor.coreStatus',
      labelFallback: 'وضعیت',
      render: (row) => <CoreStatusBadge status={row.status} />,
      sortValue: (row) => row.status,
    },
    {
      id: 'pressure',
      labelKey: 'admin.operations.monitor.pressure',
      labelFallback: 'فشار',
      render: (row) => (
        <span className="inline-flex items-center gap-1 tabular-nums">
          {row.pressure === null ? UNKNOWN_VALUE : adminNumber(row.pressure, locale)}
          <TrendMark trend={row.trend} />
        </span>
      ),
      sortValue: (row) => row.pressure ?? -1,
    },
    {
      id: 'calls',
      labelKey: 'admin.operations.monitor.callsPerMin',
      labelFallback: 'عملیات/دقیقه',
      showFrom: 'md',
      render: (row) => (
        <span className="tabular-nums">
          {row.callsPerMin === null ? UNKNOWN_VALUE : adminNumber(row.callsPerMin, locale, 1)}
        </span>
      ),
      sortValue: (row) => row.callsPerMin ?? -1,
    },
    {
      id: 'success',
      labelKey: 'admin.operations.monitor.successRate',
      labelFallback: 'موفق',
      showFrom: 'lg',
      render: (row) => (
        <span className="tabular-nums">
          {row.successRate === null ? UNKNOWN_VALUE : `${adminNumber(row.successRate, locale, 1)}%`}
        </span>
      ),
      sortValue: (row) => row.successRate ?? -1,
    },
    {
      id: 'errorRate',
      labelKey: 'admin.operations.monitor.coreErrorRate',
      labelFallback: 'خطا',
      render: (row) => (
        <span className="tabular-nums">
          {row.errorRate === null ? UNKNOWN_VALUE : `${adminNumber(row.errorRate, locale, 2)}%`}
        </span>
      ),
      sortValue: (row) => row.errorRate ?? -1,
    },
    {
      id: 'p50',
      labelKey: 'admin.operations.monitor.p50',
      labelFallback: 'P50',
      showFrom: 'lg',
      render: (row) => <span className="tabular-nums">{percentileText(row.p50, locale)}</span>,
      sortValue: (row) => row.p50?.value ?? -1,
    },
    {
      id: 'p95',
      labelKey: 'admin.operations.monitor.p95',
      labelFallback: 'P95',
      showFrom: 'md',
      render: (row) => <span className="tabular-nums">{percentileText(row.p95, locale)}</span>,
      sortValue: (row) => row.p95?.value ?? -1,
    },
    {
      id: 'p99',
      labelKey: 'admin.operations.monitor.p99',
      labelFallback: 'P99',
      showFrom: 'lg',
      render: (row) => <span className="tabular-nums">{percentileText(row.p99, locale)}</span>,
      sortValue: (row) => row.p99?.value ?? -1,
    },
    {
      id: 'inflight',
      labelKey: 'admin.operations.monitor.inFlight',
      labelFallback: 'در حال اجرا',
      showFrom: 'lg',
      render: (row) => <span className="tabular-nums">{adminNumber(row.inflightMax, locale)}</span>,
      sortValue: (row) => row.inflightMax,
    },
    {
      id: 'queue',
      labelKey: 'admin.operations.monitor.queue',
      labelFallback: 'صف',
      render: (row) => (
        <span className="tabular-nums">
          {row.queueDepth === null ? UNKNOWN_VALUE : adminNumber(row.queueDepth, locale)}
        </span>
      ),
      sortValue: (row) => row.queueDepth ?? -1,
    },
    {
      id: 'retry',
      labelKey: 'admin.operations.monitor.retry',
      labelFallback: 'تلاش مجدد',
      showFrom: 'lg',
      render: (row) => (
        <span className="tabular-nums">
          {row.retryCount === null ? UNKNOWN_VALUE : adminNumber(row.retryCount, locale)}
        </span>
      ),
      sortValue: (row) => row.retryCount ?? -1,
    },
    {
      id: 'depWait',
      labelKey: 'admin.operations.monitor.depWait',
      labelFallback: 'انتظار وابستگی',
      showFrom: 'lg',
      render: (row) => (
        <span className="tabular-nums">
          {row.dependencyWaitAvgMs === null
            ? UNKNOWN_VALUE
            : `${adminNumber(row.dependencyWaitAvgMs, locale, 1)} ms`}
        </span>
      ),
      sortValue: (row) => row.dependencyWaitAvgMs ?? -1,
    },
    {
      id: 'lastSample',
      labelKey: 'admin.operations.monitor.lastSample',
      labelFallback: 'آخرین نمونه',
      showFrom: 'md',
      render: (row) => (
        <span className="whitespace-nowrap tabular-nums text-muted-foreground">
          {row.lastSample ? adminDateTime(row.lastSample, locale) : UNKNOWN_VALUE}
        </span>
      ),
      sortValue: (row) => row.lastSample ?? '',
    },
  ]

  const instanceColumns: TableColumn<CoreInstanceItem>[] = [
    {
      id: 'instance',
      labelKey: 'admin.operations.monitor.instance',
      labelFallback: 'سرور',
      locked: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <span
            className={
              row.online
                ? 'size-2 shrink-0 rounded-full bg-[hsl(var(--color-success))]'
                : 'size-2 shrink-0 rounded-full bg-[hsl(var(--color-destructive))]'
            }
            aria-hidden="true"
          />
          <span dir="ltr" className="font-mono text-xs text-foreground">
            {row.instanceId}
          </span>
        </div>
      ),
      sortValue: (row) => row.instanceId,
    },
    {
      id: 'state',
      labelKey: 'admin.operations.monitor.coreStatus',
      labelFallback: 'وضعیت',
      render: (row) => (
        <Badge variant={row.online ? 'default' : 'destructive'} className="text-xs">
          {row.online
            ? t('admin.operations.monitor.online')
            : t('admin.operations.monitor.offline')}
        </Badge>
      ),
      sortValue: (row) => (row.online ? 0 : 1),
    },
    {
      id: 'role',
      labelKey: 'admin.operations.monitor.processRole',
      labelFallback: 'نقش',
      render: (row) => (
        <span dir="ltr" className="font-mono text-xs">
          {row.processRole}
        </span>
      ),
      sortValue: (row) => row.processRole,
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
      id: 'rss',
      labelKey: 'admin.operations.monitor.rss',
      labelFallback: 'RSS',
      showFrom: 'lg',
      render: (row) => <span className="tabular-nums">{bytes(row.rssBytes, locale)}</span>,
      sortValue: (row) => row.rssBytes ?? -1,
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
      labelKey: 'admin.operations.monitor.lastSeen',
      labelFallback: 'آخرین دیده‌شدن',
      showFrom: 'md',
      render: (row) => (
        <span className="whitespace-nowrap tabular-nums text-muted-foreground">
          {adminDateTime(row.lastSeen, locale)}
        </span>
      ),
      sortValue: (row) => row.lastSeen,
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
          <span className="tabular-nums">{bytes(row.bytes ?? null, locale)}</span>
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

  const eventColumns: TableColumn<AlertEventItem>[] = [
    {
      id: 'core',
      labelKey: 'admin.operations.monitor.alertEventCore',
      labelFallback: 'هسته',
      locked: true,
      render: (row) => (
        <span dir="ltr" className="font-mono text-xs">
          {row.coreId || t('admin.operations.monitor.dbTitle')}
        </span>
      ),
      sortValue: (row) => row.coreId,
    },
    {
      id: 'metric',
      labelKey: 'admin.operations.monitor.alertEventMetric',
      labelFallback: 'متریک',
      render: (row) => (
        <span dir="ltr" className="font-mono text-xs">
          {row.metric}
        </span>
      ),
      sortValue: (row) => row.metric,
    },
    {
      id: 'value',
      labelKey: 'admin.operations.monitor.alertEventValue',
      labelFallback: 'مقدار',
      render: (row) => (
        <span className="tabular-nums">
          {row.value === null ? UNKNOWN_VALUE : adminNumber(row.value, locale, 2)}
        </span>
      ),
      sortValue: (row) => row.value ?? -1,
    },
    {
      id: 'state',
      labelKey: 'admin.operations.monitor.coreStatus',
      labelFallback: 'وضعیت',
      render: (row) => (
        <Badge variant={row.resolvedAt ? 'secondary' : 'destructive'} className="text-xs">
          {row.resolvedAt
            ? t('admin.operations.monitor.eventResolved')
            : t('admin.operations.monitor.eventOpen')}
        </Badge>
      ),
      sortValue: (row) => (row.resolvedAt ? 1 : 0),
    },
    {
      id: 'raised',
      labelKey: 'admin.operations.monitor.raisedAt',
      labelFallback: 'ثبت',
      showFrom: 'md',
      render: (row) => (
        <span className="whitespace-nowrap tabular-nums text-muted-foreground">
          {adminDateTime(row.raisedAt, locale)}
        </span>
      ),
      sortValue: (row) => row.raisedAt,
    },
    {
      id: 'resolved',
      labelKey: 'admin.operations.monitor.resolvedAt',
      labelFallback: 'رفع',
      showFrom: 'lg',
      render: (row) => (
        <span className="whitespace-nowrap tabular-nums text-muted-foreground">
          {row.resolvedAt ? adminDateTime(row.resolvedAt, locale) : UNKNOWN_VALUE}
        </span>
      ),
      sortValue: (row) => row.resolvedAt ?? '',
    },
  ]

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

  const connectionVariant =
    stream.state === 'connected'
      ? 'default'
      : stream.state === 'fallback' || stream.state === 'reconnecting'
        ? 'outline'
        : 'secondary'

  return (
    <div className="space-y-6">
      {/* ── System overview ─────────────────────────────────────── */}
      <Card>
        <CardHeader className="text-start">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>{t('admin.operations.monitor.title')}</CardTitle>
              <CardDescription>{t('admin.operations.monitor.description')}</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={connectionVariant} className="text-xs">
                {t(`admin.operations.monitor.connection.${stream.state}`)}
              </Badge>
              <span className="text-xs tabular-nums text-muted-foreground">
                {t('admin.operations.monitor.lastEvent')}:{' '}
                {stream.lastEventAt
                  ? adminDateTime(new Date(stream.lastEventAt).toISOString(), locale)
                  : UNKNOWN_VALUE}
              </span>
              <Button variant="outline" size="sm" onClick={() => void refetch()}>
                {t('admin.operations.monitor.refresh')}
              </Button>
            </div>
          </div>
          {stream.state === 'fallback' && (
            <p className="text-xs text-muted-foreground">
              {t('admin.operations.monitor.fallbackHint')}
            </p>
          )}
        </CardHeader>
        <CardContent>
          {isLoading || !overview ? (
            <KpiGrid className="lg:grid-cols-6">
              {Array.from({ length: 12 }, (_, index) => (
                <KpiCard key={index} label="" value="" isLoading />
              ))}
            </KpiGrid>
          ) : (
            <KpiGrid className="lg:grid-cols-6">
              <KpiCard
                label={t('admin.operations.monitor.onlineUsers')}
                value={overview.onlineUsers}
                icon={Users}
              />
              <KpiCard
                label={t('admin.operations.monitor.onlineWorkspaces')}
                value={overview.onlineWorkspaces}
                icon={Building2}
              />
              <KpiCard
                label={t('admin.operations.monitor.requests')}
                value={overview.requests}
                icon={Activity}
              />
              <KpiCard
                label={t('admin.operations.monitor.errorRate')}
                value={percent(overview.errors5xx, overview.requests)}
                icon={AlertTriangle}
                hint={`${adminNumber(overview.errors5xx, locale)} / ${adminNumber(overview.requests, locale)}`}
              />
              <KpiCard
                label={t('admin.operations.monitor.bandwidth')}
                value={bytes(overview.bytesOut, locale)}
                hint={
                  overview.bytesUnknownRows > 0
                    ? t('admin.operations.monitor.bandwidthUnknown', {
                        count: overview.bytesUnknownRows,
                      })
                    : undefined
                }
              />
              <KpiCard
                label={t('admin.operations.monitor.instancesOnline')}
                value={onlineInstances.length}
                icon={Server}
                hint={`${t('admin.operations.monitor.workersOnline')}: ${adminNumber(workers.length, locale)}`}
              />
              <KpiCard
                label={t('admin.operations.monitor.coresHealthy')}
                value={counts ? counts.healthy : UNKNOWN_VALUE}
                tone="success"
              />
              <KpiCard
                label={t('admin.operations.monitor.coresWarning')}
                value={counts ? counts.warning : UNKNOWN_VALUE}
                tone="warning"
              />
              <KpiCard
                label={t('admin.operations.monitor.coresCritical')}
                value={counts ? counts.critical : UNKNOWN_VALUE}
                tone="destructive"
              />
              <KpiCard
                label={t('admin.operations.monitor.coresUnknown')}
                value={counts ? counts.unknown : UNKNOWN_VALUE}
              />
              <KpiCard
                label={t('admin.operations.monitor.dbTitle')}
                value={
                  vitals?.available
                    ? t('admin.operations.monitor.state.ok')
                    : t('admin.operations.monitor.dbUnavailable')
                }
                icon={Database}
              />
              <KpiCard
                label={t('admin.operations.monitor.waitingLocks')}
                value={
                  vitals?.waitingLocks === null || vitals?.waitingLocks === undefined
                    ? UNKNOWN_VALUE
                    : adminNumber(vitals.waitingLocks, locale)
                }
              />
            </KpiGrid>
          )}
        </CardContent>
      </Card>

      {/* ── Core pressure ranking ───────────────────────────────── */}
      <Card>
        <CardHeader className="text-start">
          <CardTitle>{t('admin.operations.monitor.coresTitle')}</CardTitle>
          <CardDescription>{t('admin.operations.monitor.coresDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-56 flex-1">
              <Label htmlFor="core-search" className="sr-only">
                {t('admin.operations.monitor.coreSearch')}
              </Label>
              <Input
                id="core-search"
                value={coreSearch}
                placeholder={t('admin.operations.monitor.coreSearchPlaceholder')}
                onChange={(event) => setCoreSearch(event.target.value)}
              />
            </div>
            <TableFilterSelect
              label={t('admin.operations.monitor.coreGroup')}
              value={coreGroup}
              onChange={setCoreGroup}
              options={[
                { value: 'all', label: t('admin.operations.monitor.allGroups') },
                ...CORE_GROUPS.map((group) => ({
                  value: group,
                  label: t(`admin.operations.monitor.groups.${group}`),
                })),
              ]}
            />
          </div>
          {coresError ? (
            <ErrorState
              message={t('admin.operations.monitor.coresError')}
              onRetry={() => void refetchCores()}
            />
          ) : coresLoading ? (
            <Skeleton className="h-48 rounded-xl" />
          ) : (
            <DataTable
              tableId="admin-monitor-cores"
              t={tableT}
              rows={rankedCores}
              columns={coreColumns}
              rowKey={(row) => row.id}
              onRowClick={(row) => setOpenCoreId(row.id)}
              caption={t('admin.operations.monitor.coresTitle')}
              minWidthClass="min-w-[960px]"
              cardTone={(row) =>
                row.status === 'critical'
                  ? 'destructive'
                  : row.status === 'warning'
                    ? 'warning'
                    : undefined
              }
              emptyState={<EmptyState title={t('admin.operations.monitor.noCores')} />}
            />
          )}
        </CardContent>
      </Card>

      {/* ── History (shared TrendChart; error ≠ empty) ──────────── */}
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
          {seriesError ? (
            <ErrorState
              message={t('admin.operations.monitor.seriesError')}
              onRetry={() => void refetchSeries()}
            />
          ) : seriesPoints.length === 0 ? (
            <EmptyState
              title={t('admin.operations.monitor.noHistory')}
              description={t('admin.operations.monitor.noHistoryHint')}
            />
          ) : (
            <div className="space-y-3">
              <TrendChart
                data={seriesPoints.map((point) => ({
                  bucket: point.bucket,
                  requests: point.requests,
                  errors: point.errors,
                }))}
                xKey="bucket"
                series={historySeries}
                height={220}
                ariaLabel={t('admin.operations.monitor.history')}
                formatX={(value) => adminDateTime(value, locale)}
                formatValue={(value) => adminNumber(value, locale)}
              />
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

      {/* ── Instances (online AND offline, with role + lastSeen) ── */}
      <Card>
        <CardHeader className="text-start">
          <CardTitle>{t('admin.operations.monitor.instances')}</CardTitle>
          <CardDescription>{t('admin.operations.monitor.instancesDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            tableId="admin-monitor-instances"
            t={tableT}
            rows={instances}
            columns={instanceColumns}
            rowKey={(row) => row.instanceId}
            caption={t('admin.operations.monitor.instances')}
            minWidthClass="min-w-[860px]"
            cardTone={(row) => (row.online ? undefined : 'destructive')}
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
            <KpiGrid className="lg:grid-cols-6">
              <KpiCard
                label={t('admin.operations.monitor.dbSize')}
                value={bytes(vitals.databaseSizeBytes, locale)}
              />
              <KpiCard
                label={t('admin.operations.monitor.connections')}
                value={
                  vitals.connections
                    ? `${adminNumber(vitals.connections.total, locale)} / ${adminNumber(vitals.connections.max, locale)}`
                    : UNKNOWN_VALUE
                }
              />
              <KpiCard
                label={t('admin.operations.monitor.cacheHit')}
                value={
                  vitals.cacheHitRatio === null
                    ? UNKNOWN_VALUE
                    : `${(vitals.cacheHitRatio * 100).toFixed(2)}%`
                }
              />
              <KpiCard
                label={t('admin.operations.monitor.replicationLag')}
                value={
                  vitals.replicationLagSeconds === null
                    ? t('admin.operations.monitor.noReplica')
                    : `${adminNumber(vitals.replicationLagSeconds, locale, 1)} s`
                }
              />
              <KpiCard
                label={t('admin.operations.monitor.waitingLocks')}
                value={
                  vitals.waitingLocks === null
                    ? UNKNOWN_VALUE
                    : adminNumber(vitals.waitingLocks, locale)
                }
              />
              <KpiCard
                label={t('admin.operations.monitor.longestTransaction')}
                value={
                  vitals.longestTransactionSeconds === null
                    ? UNKNOWN_VALUE
                    : `${adminNumber(vitals.longestTransactionSeconds, locale, 1)} s`
                }
              />
            </KpiGrid>
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
                key={`${evaluation.rule.id}:${evaluation.coreId}`}
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

      {/* ── Alert event history ─────────────────────────────────── */}
      <Card>
        <CardHeader className="text-start">
          <CardTitle>{t('admin.operations.monitor.alertEvents')}</CardTitle>
          <CardDescription>{t('admin.operations.monitor.alertEventsDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            tableId="admin-monitor-alert-events"
            t={tableT}
            rows={alertEvents?.events ?? []}
            columns={eventColumns}
            rowKey={(row) => row.id}
            caption={t('admin.operations.monitor.alertEvents')}
            minWidthClass="min-w-[720px]"
            emptyState={<EmptyState title={t('admin.operations.monitor.noAlertEvents')} />}
          />
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

      {/* ── Core detail sheet ───────────────────────────────────── */}
      <Sheet open={openCore !== null} onOpenChange={(open) => !open && setOpenCoreId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>
              {openCore ? `${t('admin.operations.monitor.coreDetail')} — ${openCore.id}` : ''}
            </SheetTitle>
          </SheetHeader>
          {openCore && (
            <CoreDetail
              core={openCore}
              alerts={alerts.filter(
                (evaluation) =>
                  evaluation.coreId === openCore.id && evaluation.state === 'breaching',
              )}
            />
          )}
        </SheetContent>
      </Sheet>

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

/** The drill-down: who owns this core, what is measured, and its history. */
function CoreDetail({
  core,
  alerts,
}: {
  core: CorePressureItem
  alerts: MonitorAlertEvaluationItem[]
}) {
  const t = useTranslations()
  const locale = useAdminLocale()
  const [range, setRange] = useState<MonitorRange>('24h')
  const { data, isError, refetch } = useAdminCoreSeries(core.id, range)

  const points = data?.points ?? []
  const chartSeries: TrendSeries[] = [
    {
      key: 'operations',
      label: t('admin.operations.monitor.operations'),
      color: 'hsl(var(--color-primary))',
      kind: 'area',
    },
    {
      key: 'errors',
      label: t('admin.operations.monitor.errors'),
      color: 'hsl(var(--color-destructive))',
      kind: 'line',
    },
    {
      key: 'p95',
      label: t('admin.operations.monitor.p95'),
      color: 'hsl(var(--color-warning))',
      kind: 'line',
    },
  ]

  return (
    <div className="space-y-5 px-1">
      <div className="flex flex-wrap items-center gap-2">
        <CoreStatusBadge status={core.status} />
        <span className="text-sm tabular-nums text-foreground">
          {t('admin.operations.monitor.pressure')}:{' '}
          {core.pressure === null ? UNKNOWN_VALUE : adminNumber(core.pressure, locale)}
        </span>
        <TrendMark trend={core.trend} />
      </div>

      <div className="space-y-1 text-sm">
        <p className="text-muted-foreground">
          {t('admin.operations.monitor.coreOwner')}:{' '}
          <span dir="ltr" className="font-mono text-xs text-foreground">
            {core.owner}
          </span>
        </p>
        <p className="text-muted-foreground">
          {t('admin.operations.monitor.coreSlo')}:{' '}
          <span dir="ltr" className="tabular-nums text-foreground">
            P95 ≤ {adminNumber(core.slo.p95TargetMs, locale)} ms · errors ≤{' '}
            {adminNumber(core.slo.errorBudgetPercent, locale, 1)}%
          </span>
        </p>
        {core.status === 'unknown' && core.reason && (
          <p className="text-xs text-muted-foreground">{core.reason}</p>
        )}
      </div>

      {/* Pressure breakdown — measured components vs the composite score. */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">
          {t('admin.operations.monitor.pressureBreakdown')}
        </p>
        <p className="text-xs text-muted-foreground">
          {t('admin.operations.monitor.coverage')}: {adminNumber(core.coverage * 100, locale, 0)}% ·
          pressure-v1 {t('admin.operations.monitor.composite')}
        </p>
        <div className="space-y-1.5">
          {core.components.map((component) => (
            <div
              key={component.key}
              className="flex items-center justify-between gap-2 rounded-lg border border-border p-2 text-xs"
            >
              <span className="text-foreground">
                {t(`admin.operations.monitor.components.${component.key}`)}
                <span className="ms-1 text-muted-foreground">
                  ({t('admin.operations.monitor.componentWeight')}{' '}
                  {adminNumber(component.weight * 100, locale, 0)}%)
                </span>
              </span>
              <span className="tabular-nums text-muted-foreground">
                {component.value === null
                  ? UNKNOWN_VALUE
                  : `${adminNumber(component.value * 100, locale, 0)}% ${t('admin.operations.monitor.measured')}`}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* History */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">
          {t('admin.operations.monitor.coreHistory')}
        </p>
        <SegmentedControl
          label={t('admin.operations.monitor.coreHistory')}
          options={RANGES.map((value) => ({
            value,
            label: t(`admin.operations.monitor.range.${value}`),
          }))}
          value={range}
          onChange={setRange}
        />
        {isError ? (
          <ErrorState
            message={t('admin.operations.monitor.coreHistoryError')}
            onRetry={() => void refetch()}
          />
        ) : points.length === 0 ? (
          <EmptyState
            title={t('admin.operations.monitor.noHistory')}
            description={t('admin.operations.monitor.noHistoryHint')}
          />
        ) : (
          <TrendChart
            data={points.map((point) => ({
              bucket: point.bucket,
              operations: point.operations,
              errors: point.errors,
              p95: point.p95?.value ?? null,
            }))}
            xKey="bucket"
            series={chartSeries}
            height={200}
            ariaLabel={t('admin.operations.monitor.coreHistory')}
            formatX={(value) => adminDateTime(value, locale)}
            formatValue={(value) => adminNumber(value, locale)}
          />
        )}
      </div>

      {/* Active alerts for this core */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">
          {t('admin.operations.monitor.activeAlerts')}
        </p>
        {alerts.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {t('admin.operations.monitor.noActiveAlerts')}
          </p>
        ) : (
          alerts.map((evaluation) => (
            <div key={evaluation.rule.id} className="rounded-lg border border-border p-2 text-xs">
              <span dir="ltr" className="font-mono">
                {evaluation.rule.metric}
              </span>{' '}
              <StateBadge state={evaluation.state} />
            </div>
          ))
        )}
      </div>
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
  const { rule, coreId, currentValue, state, breachedForMinutes } = evaluation
  const [threshold, setThreshold] = useState(String(rule.threshold))
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span dir="ltr" className="font-mono text-xs font-semibold text-foreground">
            {rule.metric}
          </span>
          {coreId && (
            <span dir="ltr" className="font-mono text-xs text-muted-foreground">
              {coreId}
            </span>
          )}
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
        <Label htmlFor={`alert-threshold-${rule.id}-${coreId}`} className="sr-only">
          {t('admin.operations.monitor.threshold')}
        </Label>
        <Input
          id={`alert-threshold-${rule.id}-${coreId}`}
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
