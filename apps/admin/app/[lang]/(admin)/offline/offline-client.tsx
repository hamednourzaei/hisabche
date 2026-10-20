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
  EmptyState,
  Skeleton,
  HubTabs,
  useHubTab,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui'
import {
  useAdminOfflineLicences,
  useRevokeOfflineLicence,
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

// ─── TAB 1: LICENCES LIST & MANAGEMENT ──────────────────────────────

function LicencesTabContent() {
  const t = useTranslations()
  const { data, isLoading, isError } = useAdminOfflineLicences()
  const { mutateAsync: revokeLicence } = useRevokeOfflineLicence()
  const [targetLicence, setTargetLicence] = useState<OfflineLicenceRecord | null>(null)

  const licences = data?.licences ?? []

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
      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      )}

      {isError && !isLoading && (
        <Card className="p-8">
          <EmptyState title={t('admin.offline.loadError')} />
        </Card>
      )}

      {!isLoading && !isError && licences.length === 0 && (
        <Card className="p-8">
          <EmptyState
            title={t('admin.offline.noLicences')}
            description={t('admin.offline.noLicencesHint')}
          />
        </Card>
      )}

      {!isLoading && !isError && licences.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="border-b border-border bg-muted/40 font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-start">{t('admin.offline.licenseId')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.offline.workspace')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.offline.plan')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.offline.status')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.offline.issuedAt')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.offline.expiresAt')}</th>
                  <th className="px-4 py-3 text-end">{t('admin.offline.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {licences.map((lic) => (
                  <tr key={lic.id} className="hover:bg-muted/30">
                    <td
                      className="px-4 py-3 font-mono text-[11px] font-semibold text-foreground"
                      dir="ltr"
                    >
                      {lic.license_id.slice(0, 13)}...
                    </td>
                    <td
                      className="px-4 py-3 font-mono text-[11px] text-muted-foreground truncate max-w-[120px]"
                      dir="ltr"
                    >
                      {lic.workspace_id}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {lic.plan}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <LicenseStatusBadge status={lic.status} />
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {new Date(lic.issued_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {new Date(lic.expires_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-end">
                      {lic.status === 'active' ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setTargetLicence(lic)}
                        >
                          {t('admin.offline.revokeAction')}
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
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
    <Badge variant={variant} className="text-[10px]">
      {status}
    </Badge>
  )
}

// ─── TAB 2: DEVICES (COMPUTER / MOBILE SEATS) ───────────────────────

function DevicesTabContent() {
  const t = useTranslations()
  const { data, isLoading, isError } = useAdminOfflineDevices()
  const { mutateAsync: releaseDevice } = useReleaseOfflineDevice()
  const [targetDevice, setTargetDevice] = useState<OfflineDeviceRecord | null>(null)

  const devices = data?.devices ?? []

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
        <Card className="p-8">
          <EmptyState title={t('admin.offline.devicesError')} />
        </Card>
      )}

      {!isLoading && !isError && devices.length === 0 && (
        <Card className="p-8">
          <EmptyState
            title={t('admin.offline.noDevices')}
            description={t('admin.offline.noDevicesHint')}
          />
        </Card>
      )}

      {!isLoading && !isError && devices.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="border-b border-border bg-muted/40 font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-start">{t('admin.offline.seatType')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.offline.deviceId')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.offline.workspace')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.offline.label')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.offline.status')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.offline.lastSeen')}</th>
                  <th className="px-4 py-3 text-end">{t('admin.offline.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {devices.map((d) => (
                  <tr key={d.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {d.device_seat === 'computer' ? '🖥️ رایانه' : '📱 موبایل'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-foreground" dir="ltr">
                      {d.device_id.slice(0, 16)}...
                    </td>
                    <td
                      className="px-4 py-3 font-mono text-[11px] text-muted-foreground truncate max-w-[120px]"
                      dir="ltr"
                    >
                      {d.workspace_id}
                    </td>
                    <td className="px-4 py-3 text-foreground">{d.label ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={d.is_active ? 'default' : 'secondary'}
                        className="text-[10px]"
                      >
                        {d.is_active ? 'فعال' : 'آزادشده'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-end">
                      {d.is_active ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setTargetDevice(d)}
                        >
                          {t('admin.offline.releaseSeat')}
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
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
  const { data, isLoading, isError } = useAdminOfflineLogs()
  const logs = data?.logs ?? []

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
        <Card className="p-8">
          <EmptyState title={t('admin.offline.logsError')} />
        </Card>
      )}

      {!isLoading && !isError && logs.length === 0 && (
        <Card className="p-8">
          <EmptyState
            title={t('admin.offline.emptyLogs')}
            description={t('admin.offline.emptyLogsHint')}
          />
        </Card>
      )}

      {!isLoading && !isError && logs.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="border-b border-border bg-muted/40 font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-start">{t('admin.offline.when')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.offline.event')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.offline.licenseId')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.offline.reason')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.offline.ip')}</th>
                  <th className="px-4 py-3 text-end">{t('admin.offline.evidence')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((l) => (
                  <tr key={l.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 tabular-nums text-muted-foreground whitespace-nowrap">
                      {new Date(l.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <LogEventBadge event={l.event} />
                    </td>
                    <td
                      className="px-4 py-3 font-mono text-[11px] text-muted-foreground truncate max-w-[120px]"
                      dir="ltr"
                    >
                      {l.license_id.slice(0, 13)}...
                    </td>
                    <td className="px-4 py-3 text-muted-foreground truncate max-w-[180px]">
                      {l.reason ?? '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-muted-foreground tabular-nums">
                      {l.ip_address ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-end">
                      {l.evidence ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[11px]"
                          onClick={() => setSelectedLog(l)}
                        >
                          {t('admin.offline.viewEvidence')}
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
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
                  <span className="text-muted-foreground">رویداد:</span>{' '}
                  <span className="font-semibold">{selectedLog.event}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">علت:</span>{' '}
                  <span>{selectedLog.reason ?? '—'}</span>
                </div>
              </div>
              <pre
                dir="ltr"
                className="p-3 rounded-lg bg-muted font-mono text-[11px] overflow-x-auto text-start"
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
    <Badge variant={variant} className="text-[10px] font-mono">
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
        <Card className="p-8">
          <EmptyState title={t('admin.offline.bansError')} />
        </Card>
      )}

      {!isLoading && !isError && bans.length === 0 && (
        <Card className="p-8">
          <EmptyState
            title={t('admin.offline.noBans')}
            description={t('admin.offline.noBansHint')}
          />
        </Card>
      )}

      {!isLoading && !isError && bans.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="border-b border-border bg-muted/40 font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-start">{t('admin.offline.licenseId')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.offline.workspace')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.offline.banReason')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.offline.bannedAt')}</th>
                  <th className="px-4 py-3 text-end">{t('admin.offline.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bans.map((b) => (
                  <tr key={b.id} className="hover:bg-muted/30">
                    <td
                      className="px-4 py-3 font-mono text-[11px] font-semibold text-foreground"
                      dir="ltr"
                    >
                      {b.license_id.slice(0, 14)}...
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground" dir="ltr">
                      {b.workspace_id}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-destructive font-medium">
                      {b.ban_reason ?? 'tier1_violation'}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {b.banned_at ? new Date(b.banned_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <Button size="sm" className="h-7 text-xs" onClick={() => setTargetBan(b)}>
                        {t('admin.offline.liftBanAction')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
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
        <Card className="p-8">
          <EmptyState title={t('admin.offline.reviewError')} />
        </Card>
      )}

      {!isLoading && !isError && reviews.length === 0 && (
        <Card className="p-8">
          <EmptyState
            title={t('admin.offline.emptyReviewQueue')}
            description={t('admin.offline.emptyReviewQueueHint')}
          />
        </Card>
      )}

      {!isLoading && !isError && reviews.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="border-b border-border bg-muted/40 font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-start">{t('admin.offline.when')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.offline.signalType')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.offline.licenseId')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.offline.details')}</th>
                  <th className="px-4 py-3 text-end">{t('admin.offline.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reviews.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 tabular-nums text-muted-foreground whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-semibold text-warning font-mono">
                      {r.signal_type}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground" dir="ltr">
                      {r.license_id.slice(0, 14)}...
                    </td>
                    <td
                      className="px-4 py-3 font-mono text-[10px] text-muted-foreground max-w-[200px] truncate"
                      dir="ltr"
                    >
                      {JSON.stringify(r.details)}
                    </td>
                    <td className="px-4 py-3 text-end space-x-1 rtl:space-x-reverse">
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-7 text-xs"
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
                        className="h-7 text-xs"
                        onClick={() => {
                          setSelectedReview(r)
                          setReviewMode('not_abuse')
                        }}
                      >
                        {t('admin.offline.notAbuseAction')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
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
                  className="text-[10px]"
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
