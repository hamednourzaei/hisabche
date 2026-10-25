'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Button,
  DataTable,
  EmptyState,
  Skeleton,
  HubTabs,
  type TableColumn,
  useHubTab,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui'
import { copyText } from '@hisabche/ui'
import {
  useAdminOfflineLicences,
  useRevokeOfflineLicence,
  useIssueOfflineLicence,
  useAdminOfflineDevices,
  useReleaseOfflineDevice,
  useAdminOfflineLogs,
  useAdminOfflineBans,
  useLiftOfflineBan,
  useAdminOfflineReviews,
  useDecideOfflineReview,
  useAdminOfflineFleetHealth,
  type OfflineLicenceRecord,
  type OfflineDeviceRecord,
  type OfflineLogRecord,
  type OfflineReviewRecord,
} from '@/hooks/use-admin-offline'
import { StepUpDialog } from '@/components/admin-shell/step-up-dialog'
import { ErrorState, useAdminTableT } from '@/components/admin-shell/admin-ui'
import { useAdminLocale } from '@/hooks/use-admin-locale'
import { adminDate, adminDateTime, UNKNOWN_VALUE } from '@/lib/admin-format'

const OFFLINE_TABS = [
  'licences',
  'devices',
  'log',
  'bans',
  'reviews',
  'fleet',
  'migration',
  'reconciliation',
] as const
type OfflineTab = (typeof OFFLINE_TABS)[number]

export function OfflineClient() {
  const t = useTranslations()
  const [tab, setTab] = useHubTab<OfflineTab>(OFFLINE_TABS)

  return (
    <div className="space-y-6">
      <HubTabs
        label={t('admin.hubs.offline.title')}
        items={[
          { id: 'licences', label: t('admin.hubs.offline.licences') },
          { id: 'devices', label: t('admin.hubs.offline.devices') },
          { id: 'log', label: t('admin.hubs.offline.log') },
          { id: 'bans', label: t('admin.hubs.offline.bans') },
          { id: 'reviews', label: t('admin.hubs.offline.reviews') },
          { id: 'fleet', label: t('admin.hubs.offline.fleet') },
          { id: 'migration', label: t('admin.hubs.offline.migration') },
          { id: 'reconciliation', label: t('admin.hubs.offline.reconciliation') },
        ]}
        active={tab}
        onSelect={setTab}
      />

      {tab === 'licences' && <LicencesTabContent />}
      {tab === 'devices' && <DevicesTabContent />}
      {tab === 'log' && <LicenseLogTabContent />}
      {tab === 'bans' && <AutomaticBansTabContent />}
      {tab === 'reviews' && <ReviewQueueTabContent />}
      {tab === 'fleet' && <FleetHealthTabContent />}
      {tab === 'migration' && <MigrationCenterTabContent />}
      {tab === 'reconciliation' && <ReconciliationTabContent />}
    </div>
  )
}

// ─── Issue a licence for one device ─────────────────────────────────
//
// The offline edition's sale (owner, 21 Oct 2026): the admin types the ID the
// device shows, the server signs a licence for that device, and the code is
// shown ONCE in a dialog to be pasted on the device.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function IssueLicenceCard() {
  const t = useTranslations()
  const { mutateAsync: issue } = useIssueOfflineLicence()
  const [deviceId, setDeviceId] = useState('')
  const [label, setLabel] = useState('')
  const [periodDays, setPeriodDays] = useState('365')
  const [confirming, setConfirming] = useState(false)
  const [issued, setIssued] = useState<{ code: string; expiresAt: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

  const id = deviceId.trim()
  const days = Number(periodDays)
  const valid = UUID_RE.test(id) && Number.isInteger(days) && days >= 1 && days <= 3650

  const handleConfirm = async ({ stepUpTimestamp }: { stepUpTimestamp: string }) => {
    setError(null)
    try {
      const result = await issue({
        deviceId: id,
        periodDays: days,
        ...(label.trim() ? { label: label.trim() } : {}),
        stepUpTimestamp,
      })
      setIssued(result)
      setCopyState('idle')
      setDeviceId('')
      setLabel('')
    } catch (err) {
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code
      setError(
        code === 'LICENSE_SIGNING_NOT_CONFIGURED'
          ? t('admin.offline.signingNotConfigured')
          : t('admin.offline.issueFailed'),
      )
    } finally {
      setConfirming(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.offline.issueTitle')}</CardTitle>
        <CardDescription>{t('admin.offline.issueDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-[2fr_1fr_8rem_auto] md:items-end">
          <label className="flex flex-col gap-1.5 text-xs">
            <span className="text-muted-foreground">{t('admin.offline.deviceId')}</span>
            <Input
              dir="ltr"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              aria-invalid={id !== '' && !UUID_RE.test(id)}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs">
            <span className="text-muted-foreground">{t('admin.offline.label')}</span>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} />
          </label>
          <label className="flex flex-col gap-1.5 text-xs">
            <span className="text-muted-foreground">{t('admin.offline.periodDays')}</span>
            <Input
              dir="ltr"
              inputMode="numeric"
              value={periodDays}
              onChange={(e) => setPeriodDays(e.target.value.replace(/[^0-9]/g, ''))}
            />
          </label>
          <Button disabled={!valid} onClick={() => setConfirming(true)}>
            {t('admin.offline.issueAction')}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {id !== '' && !UUID_RE.test(id)
            ? t('admin.offline.invalidDeviceId')
            : t('admin.offline.deviceIdHint')}
        </p>
        {error ? (
          <p role="alert" className="text-xs font-medium text-destructive">
            {error}
          </p>
        ) : null}
      </CardContent>

      <StepUpDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('admin.offline.issueTitle')}
        description={t('admin.offline.issueNotice')}
        confirmLabel={t('admin.offline.confirmIssue')}
        onConfirm={handleConfirm}
      />

      {/* The one place the code is shown — a dialog, never a card that stays
          on the page (CLAUDE.md: one-time values). */}
      <Dialog open={issued !== null} onOpenChange={(open) => !open && setIssued(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.offline.codeTitle')}</DialogTitle>
            <DialogDescription>{t('admin.offline.codeNotice')}</DialogDescription>
          </DialogHeader>
          <textarea
            readOnly
            dir="ltr"
            value={issued?.code ?? ''}
            onFocus={(e) => e.currentTarget.select()}
            rows={5}
            className="w-full break-all rounded-lg border border-border bg-muted/40 p-3 font-mono text-xs"
          />
          <div className="flex items-center justify-end gap-3">
            {copyState !== 'idle' ? (
              <span className="text-xs text-muted-foreground">
                {copyState === 'copied' ? t('admin.offline.copied') : t('admin.offline.copyFailed')}
              </span>
            ) : null}
            <Button
              onClick={async () => {
                const ok = await copyText(issued?.code ?? '')
                setCopyState(ok ? 'copied' : 'failed')
              }}
            >
              {t('admin.offline.copyCode')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

// ─── TAB 1: LICENCES LIST & MANAGEMENT ──────────────────────────────

function LicencesTabContent() {
  const t = useTranslations()
  const { data, isLoading, isError, refetch } = useAdminOfflineLicences()
  const { mutateAsync: revokeLicence } = useRevokeOfflineLicence()
  const [targetLicence, setTargetLicence] = useState<OfflineLicenceRecord | null>(null)

  const licences = data?.licences ?? []
  const locale = useAdminLocale()
  const tableT = useAdminTableT()
  const columns: TableColumn<OfflineLicenceRecord>[] = [
    {
      id: 'licenseId',
      labelKey: 'admin.offline.licenseId',
      labelFallback: 'شناسه لایسنس',
      locked: true,
      render: (lic) => (
        <span dir="ltr" className="font-mono text-xs font-semibold text-foreground">
          {lic.license_id.slice(0, 13)}…
        </span>
      ),
      sortValue: (lic) => lic.license_id,
    },
    {
      id: 'workspace',
      labelKey: 'admin.offline.workspace',
      labelFallback: 'کسب‌وکار',
      showFrom: 'md',
      render: (lic) => (
        <span
          dir="ltr"
          className="block max-w-[140px] truncate font-mono text-xs text-muted-foreground"
        >
          {lic.workspace_id}
        </span>
      ),
      sortValue: (lic) => lic.workspace_id,
    },
    {
      id: 'plan',
      labelKey: 'admin.offline.plan',
      labelFallback: 'پلن',
      render: (lic) => (
        <Badge variant="outline" className="font-mono text-xs">
          {lic.plan}
        </Badge>
      ),
      sortValue: (lic) => lic.plan,
    },
    {
      id: 'status',
      labelKey: 'admin.offline.status',
      labelFallback: 'وضعیت',
      render: (lic) => <LicenseStatusBadge status={lic.status} />,
      sortValue: (lic) => lic.status,
    },
    {
      id: 'issuedAt',
      labelKey: 'admin.offline.issuedAt',
      labelFallback: 'تاریخ صدور',
      showFrom: 'md',
      render: (lic) => (
        <span className="tabular-nums text-muted-foreground">
          {adminDate(lic.issued_at, locale)}
        </span>
      ),
      sortValue: (lic) => lic.issued_at,
    },
    {
      id: 'expiresAt',
      labelKey: 'admin.offline.expiresAt',
      labelFallback: 'تاریخ انقضا',
      showFrom: 'lg',
      render: (lic) => (
        <span className="tabular-nums text-muted-foreground">
          {adminDate(lic.expires_at, locale)}
        </span>
      ),
      sortValue: (lic) => lic.expires_at,
    },
    {
      id: 'actions',
      labelKey: 'admin.offline.actions',
      labelFallback: 'عملیات',
      align: 'end',
      locked: true,
      render: (lic) =>
        lic.status === 'active' ? (
          <Button
            variant="destructive"
            size="sm"
            aria-label={`${t('admin.offline.revokeAction')} — ${lic.license_id.slice(0, 13)}…`}
            onClick={() => setTargetLicence(lic)}
          >
            {t('admin.offline.revokeAction')}
          </Button>
        ) : (
          <span className="text-muted-foreground">{UNKNOWN_VALUE}</span>
        ),
    },
  ]

  const handleRevokeConfirm = async ({ stepUpTimestamp }: { stepUpTimestamp: string }) => {
    if (!targetLicence) return
    await revokeLicence({
      licenseId: targetLicence.license_id,
      workspaceId: targetLicence.workspace_id,
      stepUpTimestamp,
    })
    setTargetLicence(null)
  }

  return (
    <div className="space-y-4">
      <IssueLicenceCard />

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      )}

      {isError && !isLoading && (
        <ErrorState message={t('admin.offline.loadError')} onRetry={() => void refetch()} />
      )}

      {!isLoading && !isError && (
        <DataTable
          tableId="admin-offline-licences"
          t={tableT}
          rows={licences}
          columns={columns}
          rowKey={(lic) => lic.id}
          caption={t('admin.hubs.offline.licences')}
          minWidthClass="min-w-[880px]"
          emptyState={
            <EmptyState
              title={t('admin.offline.noLicences')}
              description={t('admin.offline.noLicencesHint')}
            />
          }
        />
      )}

      {/* StepUp Dialog for Revocation */}
      <StepUpDialog
        open={Boolean(targetLicence)}
        onOpenChange={(open) => !open && setTargetLicence(null)}
        title={t('admin.offline.revokeTitle')}
        description={t('admin.offline.revokeNotice')}
        destructive
        requireReason
        reasonLabel={t('admin.offline.revokeReason')}
        confirmLabel={t('admin.offline.confirmRevoke')}
        onConfirm={handleRevokeConfirm}
      />
    </div>
  )
}

function LicenseStatusBadge({ status }: { status: string }) {
  let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'secondary'
  if (status === 'active') variant = 'default'
  if (status === 'banned' || status === 'revoked') variant = 'destructive'
  return (
    <Badge variant={variant} className="text-xs">
      {status}
    </Badge>
  )
}

// ─── TAB 2: DEVICES (COMPUTER / MOBILE SEATS) ───────────────────────

function DevicesTabContent() {
  const t = useTranslations()
  const { data, isLoading, isError, refetch } = useAdminOfflineDevices()
  const { mutateAsync: releaseDevice } = useReleaseOfflineDevice()
  const [targetDevice, setTargetDevice] = useState<OfflineDeviceRecord | null>(null)

  const devices = data?.devices ?? []
  const locale = useAdminLocale()
  const tableT = useAdminTableT()
  const columns: TableColumn<OfflineDeviceRecord>[] = [
    {
      id: 'seat',
      labelKey: 'admin.offline.seatType',
      labelFallback: 'نوع صندلی',
      render: (d) => (
        <Badge variant="outline" className="text-xs">
          {d.device_seat === 'computer'
            ? t('admin.offline.seatComputer')
            : t('admin.offline.seatMobile')}
        </Badge>
      ),
      sortValue: (d) => d.device_seat,
    },
    {
      id: 'deviceId',
      labelKey: 'admin.offline.deviceId',
      labelFallback: 'شناسه دستگاه',
      locked: true,
      render: (d) => (
        <span dir="ltr" className="font-mono text-xs text-foreground">
          {d.device_id.slice(0, 16)}…
        </span>
      ),
      sortValue: (d) => d.device_id,
    },
    {
      id: 'workspace',
      labelKey: 'admin.offline.workspace',
      labelFallback: 'کسب‌وکار',
      showFrom: 'md',
      render: (d) => (
        <span
          dir="ltr"
          className="block max-w-[140px] truncate font-mono text-xs text-muted-foreground"
        >
          {d.workspace_id}
        </span>
      ),
      sortValue: (d) => d.workspace_id,
    },
    {
      id: 'label',
      labelKey: 'admin.offline.label',
      labelFallback: 'برچسب',
      showFrom: 'lg',
      render: (d) => <span className="text-foreground">{d.label ?? UNKNOWN_VALUE}</span>,
    },
    {
      id: 'status',
      labelKey: 'admin.offline.status',
      labelFallback: 'وضعیت',
      render: (d) => (
        <Badge variant={d.is_active ? 'default' : 'secondary'} className="text-xs">
          {d.is_active ? t('admin.offline.deviceActive') : t('admin.offline.deviceReleased')}
        </Badge>
      ),
      sortValue: (d) => (d.is_active ? 1 : 0),
    },
    {
      id: 'lastSeen',
      labelKey: 'admin.offline.lastSeen',
      labelFallback: 'آخرین بازدید',
      showFrom: 'md',
      render: (d) => (
        <span className="tabular-nums text-muted-foreground">
          {adminDateTime(d.last_seen_at, locale)}
        </span>
      ),
      sortValue: (d) => d.last_seen_at,
    },
    {
      id: 'actions',
      labelKey: 'admin.offline.actions',
      labelFallback: 'عملیات',
      align: 'end',
      locked: true,
      render: (d) =>
        d.is_active ? (
          <Button
            variant="outline"
            size="sm"
            aria-label={`${t('admin.offline.releaseSeat')} — ${d.device_id.slice(0, 16)}…`}
            onClick={() => setTargetDevice(d)}
          >
            {t('admin.offline.releaseSeat')}
          </Button>
        ) : (
          <span className="text-muted-foreground">{UNKNOWN_VALUE}</span>
        ),
    },
  ]

  const handleReleaseConfirm = async ({ stepUpTimestamp }: { stepUpTimestamp: string }) => {
    if (!targetDevice) return
    await releaseDevice({
      deviceId: targetDevice.device_id,
      workspaceId: targetDevice.workspace_id,
      stepUpTimestamp,
    })
    setTargetDevice(null)
  }

  return (
    <div className="space-y-4">
      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      )}

      {isError && !isLoading && (
        <ErrorState message={t('admin.offline.devicesError')} onRetry={() => void refetch()} />
      )}

      {!isLoading && !isError && (
        <DataTable
          tableId="admin-offline-devices"
          t={tableT}
          rows={devices}
          columns={columns}
          rowKey={(d) => d.id}
          caption={t('admin.hubs.offline.devices')}
          minWidthClass="min-w-[880px]"
          emptyState={
            <EmptyState
              title={t('admin.offline.noDevices')}
              description={t('admin.offline.noDevicesHint')}
            />
          }
        />
      )}

      {/* StepUp Dialog for Releasing Device */}
      <StepUpDialog
        open={Boolean(targetDevice)}
        onOpenChange={(open) => !open && setTargetDevice(null)}
        title={t('admin.offline.releaseTitle')}
        description={t('admin.offline.releaseDesc')}
        confirmLabel={t('admin.offline.confirmRelease')}
        onConfirm={handleReleaseConfirm}
      />
    </div>
  )
}

// ─── TAB 3: LICENCE LOG (APPEND-ONLY) ───────────────────────────────

function LicenseLogTabContent() {
  const t = useTranslations()
  const [selectedLog, setSelectedLog] = useState<OfflineLogRecord | null>(null)
  const { data, isLoading, isError, refetch } = useAdminOfflineLogs()
  const logs = data?.logs ?? []
  const locale = useAdminLocale()
  const tableT = useAdminTableT()
  const columns: TableColumn<OfflineLogRecord>[] = [
    {
      id: 'when',
      labelKey: 'admin.offline.when',
      labelFallback: 'زمان',
      render: (l) => (
        <span className="whitespace-nowrap tabular-nums text-muted-foreground">
          {adminDateTime(l.created_at, locale)}
        </span>
      ),
      sortValue: (l) => l.created_at,
    },
    {
      id: 'event',
      labelKey: 'admin.offline.event',
      labelFallback: 'رویداد',
      render: (l) => <LogEventBadge event={l.event} />,
      sortValue: (l) => l.event,
    },
    {
      id: 'licenseId',
      labelKey: 'admin.offline.licenseId',
      labelFallback: 'شناسه لایسنس',
      showFrom: 'md',
      render: (l) => (
        <span
          dir="ltr"
          className="block max-w-[120px] truncate font-mono text-xs text-muted-foreground"
        >
          {l.license_id.slice(0, 13)}…
        </span>
      ),
    },
    {
      id: 'reason',
      labelKey: 'admin.offline.reason',
      labelFallback: 'دلیل',
      showFrom: 'md',
      render: (l) => (
        <span className="block max-w-[180px] truncate text-muted-foreground">
          {l.reason ?? UNKNOWN_VALUE}
        </span>
      ),
    },
    {
      id: 'ip',
      labelKey: 'admin.offline.ip',
      labelFallback: 'IP',
      showFrom: 'lg',
      render: (l) => (
        <span className="tabular-nums font-mono text-muted-foreground">
          {l.ip_address ?? UNKNOWN_VALUE}
        </span>
      ),
    },
    {
      id: 'evidence',
      labelKey: 'admin.offline.evidence',
      labelFallback: 'شواهد',
      align: 'end',
      locked: true,
      render: (l) =>
        l.evidence ? (
          <Button
            variant="ghost"
            size="sm"
            aria-label={`${t('admin.offline.viewEvidence')} — ${l.license_id.slice(0, 13)}…`}
            onClick={() => setSelectedLog(l)}
          >
            {t('admin.offline.viewEvidence')}
          </Button>
        ) : (
          <span className="text-muted-foreground">{UNKNOWN_VALUE}</span>
        ),
    },
  ]

  return (
    <div className="space-y-4">
      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      )}

      {isError && !isLoading && (
        <ErrorState message={t('admin.offline.logsError')} onRetry={() => void refetch()} />
      )}

      {!isLoading && !isError && (
        <DataTable
          tableId="admin-offline-log"
          t={tableT}
          rows={logs}
          columns={columns}
          rowKey={(l) => l.id}
          caption={t('admin.hubs.offline.log')}
          minWidthClass="min-w-[860px]"
          emptyState={
            <EmptyState
              title={t('admin.offline.emptyLogs')}
              description={t('admin.offline.emptyLogsHint')}
            />
          }
        />
      )}

      {/* Evidence Sheet */}
      <Sheet open={Boolean(selectedLog)} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <SheetContent side="end" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="text-start">
            <SheetTitle>{t('admin.offline.evidenceTitle')}</SheetTitle>
          </SheetHeader>
          {selectedLog && (
            <div className="mt-4 space-y-3 text-xs">
              <div className="p-3 bg-muted/40 rounded-lg space-y-1">
                <div>
                  <span className="text-muted-foreground">{t('admin.offline.event')}:</span>{' '}
                  <span className="font-semibold">{selectedLog.event}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('admin.offline.reason')}:</span>{' '}
                  <span>{selectedLog.reason ?? '—'}</span>
                </div>
              </div>
              <pre
                dir="ltr"
                className="p-3 rounded-lg bg-muted font-mono text-xs overflow-x-auto text-start"
              >
                {JSON.stringify(selectedLog.evidence, null, 2)}
              </pre>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function LogEventBadge({ event }: { event: string }) {
  let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'secondary'
  if (event === 'ban' || event === 'revoke') variant = 'destructive'
  if (event === 'issue' || event === 'activate') variant = 'default'
  if (event === 'unban') variant = 'outline'
  return (
    <Badge variant={variant} className="text-xs font-mono">
      {event}
    </Badge>
  )
}

// ─── TAB 4: AUTOMATIC BANS (TIER-1 WITH EVIDENCE) ───────────────────

function AutomaticBansTabContent() {
  const t = useTranslations()
  const { data, isLoading, isError, refetch } = useAdminOfflineBans()
  const { mutateAsync: liftBan } = useLiftOfflineBan()
  const [targetBan, setTargetBan] = useState<OfflineLicenceRecord | null>(null)

  const bans = data?.bans ?? []
  const locale = useAdminLocale()
  const tableT = useAdminTableT()
  const columns: TableColumn<OfflineLicenceRecord>[] = [
    {
      id: 'licenseId',
      labelKey: 'admin.offline.licenseId',
      labelFallback: 'شناسه لایسنس',
      locked: true,
      render: (b) => (
        <span dir="ltr" className="font-mono text-xs font-semibold text-foreground">
          {b.license_id.slice(0, 14)}…
        </span>
      ),
      sortValue: (b) => b.license_id,
    },
    {
      id: 'workspace',
      labelKey: 'admin.offline.workspace',
      labelFallback: 'کسب‌وکار',
      showFrom: 'md',
      render: (b) => (
        <span
          dir="ltr"
          className="block max-w-[140px] truncate font-mono text-xs text-muted-foreground"
        >
          {b.workspace_id}
        </span>
      ),
      sortValue: (b) => b.workspace_id,
    },
    {
      id: 'banReason',
      labelKey: 'admin.offline.banReason',
      labelFallback: 'دلیل مسدودی',
      render: (b) => (
        <span className="block max-w-[200px] truncate font-mono text-xs font-medium text-destructive">
          {b.ban_reason ?? UNKNOWN_VALUE}
        </span>
      ),
      sortValue: (b) => b.ban_reason,
    },
    {
      id: 'bannedAt',
      labelKey: 'admin.offline.bannedAt',
      labelFallback: 'زمان مسدودی',
      showFrom: 'md',
      render: (b) => (
        <span className="tabular-nums text-muted-foreground">
          {adminDateTime(b.banned_at, locale)}
        </span>
      ),
      sortValue: (b) => b.banned_at,
    },
    {
      id: 'actions',
      labelKey: 'admin.offline.actions',
      labelFallback: 'عملیات',
      align: 'end',
      locked: true,
      render: (b) => (
        <Button
          size="sm"
          aria-label={`${t('admin.offline.liftBanAction')} — ${b.license_id.slice(0, 14)}…`}
          onClick={() => setTargetBan(b)}
        >
          {t('admin.offline.liftBanAction')}
        </Button>
      ),
    },
  ]

  const handleLiftConfirm = async ({
    stepUpTimestamp,
    reason,
  }: {
    stepUpTimestamp: string
    reason?: string
  }) => {
    if (!targetBan || !reason) return
    await liftBan({
      licenseId: targetBan.license_id,
      workspaceId: targetBan.workspace_id,
      reason,
      stepUpTimestamp,
    })
    setTargetBan(null)
    void refetch()
  }

  return (
    <div className="space-y-4">
      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      )}

      {isError && !isLoading && (
        <ErrorState message={t('admin.offline.bansError')} onRetry={() => void refetch()} />
      )}

      {!isLoading && !isError && (
        <DataTable
          tableId="admin-offline-bans"
          t={tableT}
          rows={bans}
          columns={columns}
          rowKey={(b) => b.id}
          caption={t('admin.hubs.offline.bans')}
          minWidthClass="min-w-[800px]"
          emptyState={
            <EmptyState
              title={t('admin.offline.noBans')}
              description={t('admin.offline.noBansHint')}
            />
          }
        />
      )}

      {/* Lift Ban StepUp Dialog with MANDATORY Reason + TOTP */}
      <StepUpDialog
        open={Boolean(targetBan)}
        onOpenChange={(open) => !open && setTargetBan(null)}
        title={t('admin.offline.liftBanTitle')}
        description={t('admin.offline.liftBanDesc')}
        requireReason
        reasonLabel={t('admin.offline.liftBanReasonLabel')}
        confirmLabel={t('admin.offline.confirmLiftBan')}
        onConfirm={handleLiftConfirm}
      />
    </div>
  )
}

// ─── TAB 5: REVIEW QUEUE (TIER-2 SIGNALS) ───────────────────────────

function ReviewQueueTabContent() {
  const t = useTranslations()
  const { data, isLoading, isError, refetch } = useAdminOfflineReviews()
  const { mutateAsync: decideReview } = useDecideOfflineReview()
  const [selectedReview, setSelectedReview] = useState<OfflineReviewRecord | null>(null)
  const [reviewMode, setReviewMode] = useState<'ban' | 'not_abuse' | null>(null)

  const reviews = data?.reviews ?? []
  const locale = useAdminLocale()
  const tableT = useAdminTableT()
  const columns: TableColumn<OfflineReviewRecord>[] = [
    {
      id: 'when',
      labelKey: 'admin.offline.when',
      labelFallback: 'زمان',
      render: (r) => (
        <span className="whitespace-nowrap tabular-nums text-muted-foreground">
          {adminDateTime(r.created_at, locale)}
        </span>
      ),
      sortValue: (r) => r.created_at,
    },
    {
      id: 'signal',
      labelKey: 'admin.offline.signalType',
      labelFallback: 'نوع سیگنال',
      render: (r) => <span className="font-mono font-semibold text-warning">{r.signal_type}</span>,
      sortValue: (r) => r.signal_type,
    },
    {
      id: 'licenseId',
      labelKey: 'admin.offline.licenseId',
      labelFallback: 'شناسه لایسنس',
      showFrom: 'md',
      render: (r) => (
        <span dir="ltr" className="font-mono text-xs text-muted-foreground">
          {r.license_id.slice(0, 14)}…
        </span>
      ),
    },
    {
      id: 'details',
      labelKey: 'admin.offline.details',
      labelFallback: 'جزئیات',
      showFrom: 'lg',
      render: (r) => (
        <span
          dir="ltr"
          className="block max-w-[200px] truncate font-mono text-xs text-muted-foreground"
        >
          {JSON.stringify(r.details)}
        </span>
      ),
    },
    {
      id: 'actions',
      labelKey: 'admin.offline.actions',
      labelFallback: 'عملیات',
      align: 'end',
      locked: true,
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="destructive"
            size="sm"
            aria-label={`${t('admin.offline.banAction')} — ${r.license_id.slice(0, 14)}…`}
            onClick={() => {
              setSelectedReview(r)
              setReviewMode('ban')
            }}
          >
            {t('admin.offline.banAction')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-label={`${t('admin.offline.notAbuseAction')} — ${r.license_id.slice(0, 14)}…`}
            onClick={() => {
              setSelectedReview(r)
              setReviewMode('not_abuse')
            }}
          >
            {t('admin.offline.notAbuseAction')}
          </Button>
        </div>
      ),
    },
  ]

  const handleReviewConfirm = async ({
    stepUpTimestamp,
    reason,
  }: {
    stepUpTimestamp: string
    reason?: string
  }) => {
    if (!selectedReview || !reviewMode || !reason) return
    await decideReview({
      reviewId: selectedReview.id,
      verdict: reviewMode,
      reason,
      workspaceId: selectedReview.workspace_id,
      licenseId: selectedReview.license_id,
      stepUpTimestamp,
    })
    setSelectedReview(null)
    setReviewMode(null)
    void refetch()
  }

  return (
    <div className="space-y-4">
      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      )}

      {isError && !isLoading && (
        <ErrorState message={t('admin.offline.reviewError')} onRetry={() => void refetch()} />
      )}

      {!isLoading && !isError && (
        <DataTable
          tableId="admin-offline-reviews"
          t={tableT}
          rows={reviews}
          columns={columns}
          rowKey={(r) => r.id}
          caption={t('admin.hubs.offline.reviews')}
          minWidthClass="min-w-[820px]"
          emptyState={
            <EmptyState
              title={t('admin.offline.emptyReviewQueue')}
              description={t('admin.offline.emptyReviewQueueHint')}
            />
          }
        />
      )}

      {/* Review Decision StepUp Dialog */}
      <StepUpDialog
        open={Boolean(selectedReview && reviewMode)}
        onOpenChange={(open) => !open && setSelectedReview(null)}
        title={
          reviewMode === 'ban'
            ? t('admin.offline.confirmReviewBan')
            : t('admin.offline.confirmReviewNotAbuse')
        }
        description={
          reviewMode === 'ban'
            ? t('admin.offline.reviewBanDesc')
            : t('admin.offline.reviewNotAbuseDesc')
        }
        destructive={reviewMode === 'ban'}
        requireReason
        reasonLabel={t('admin.offline.decisionReasonLabel')}
        confirmLabel={t('admin.offline.confirmDecision')}
        onConfirm={handleReviewConfirm}
      />
    </div>
  )
}

// ─── TAB 6: FLEET HEALTH & SIGNING KEY ──────────────────────────────

function FleetHealthTabContent() {
  const t = useTranslations()
  const { data, isLoading } = useAdminOfflineFleetHealth()
  const health = data?.health

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="text-start">
          <CardTitle>{t('admin.offline.fleetHealthTitle')}</CardTitle>
          <CardDescription>{t('admin.offline.fleetHealthDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border border-border bg-card space-y-1">
                <div className="text-xs text-muted-foreground">
                  {t('admin.offline.activeLicences')}
                </div>
                <div className="text-2xl font-bold text-foreground tabular-nums">
                  {health?.activeLicences ?? 0}
                </div>
              </div>
              <div className="p-4 rounded-xl border border-border bg-card space-y-1">
                <div className="text-xs text-muted-foreground">
                  {t('admin.offline.bannedLicences')}
                </div>
                <div className="text-2xl font-bold text-destructive tabular-nums">
                  {health?.bannedLicences ?? 0}
                </div>
              </div>
              <div className="p-4 rounded-xl border border-border bg-card space-y-1">
                <div className="text-xs text-muted-foreground">
                  {t('admin.offline.activeDevices')}
                </div>
                <div className="text-2xl font-bold text-foreground tabular-nums">
                  {health?.activeDevices ?? 0}
                </div>
              </div>
              <div className="p-4 rounded-xl border border-border bg-card space-y-1">
                <div className="text-xs text-muted-foreground">{t('admin.offline.signingKey')}</div>
                <div className="text-sm font-mono font-bold text-foreground">{health?.keyId}</div>
                <Badge
                  variant={health?.signingConfigured ? 'default' : 'destructive'}
                  className="text-xs"
                >
                  {health?.signingConfigured ? 'پیکربندی شده' : 'فاقد کلید'}
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── TAB 7: MIGRATION CENTER ────────────────────────────────────────

function MigrationCenterTabContent() {
  const t = useTranslations()
  return (
    <Card className="p-8">
      <EmptyState
        title={t('admin.hubs.offline.migration')}
        description={t('admin.offline.migrationNotice')}
      />
    </Card>
  )
}

// ─── TAB 8: RECONCILIATION ──────────────────────────────────────────

function ReconciliationTabContent() {
  const t = useTranslations()
  return (
    <Card className="p-8">
      <EmptyState
        title={t('admin.hubs.offline.reconciliation')}
        description={t('admin.offline.reconciliationNotice')}
      />
    </Card>
  )
}
