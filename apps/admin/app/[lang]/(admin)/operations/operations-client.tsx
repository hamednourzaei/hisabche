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
  useHubTab,
  type TableColumn,
} from '@/components/ui'
import { ServersClient } from '../servers/servers-client'
import {
  useAdminSystemHealth,
  useAdminBackgroundJobs,
  useRetryBackgroundJob,
  useAdminAnnouncements,
  type BackgroundJobItem,
} from '@/hooks/use-admin-ops'
import { StepUpDialog } from '@/components/admin-shell/step-up-dialog'
import { ErrorState, useAdminTableT } from '@/components/admin-shell/admin-ui'
import { useAdminLocale } from '@/hooks/use-admin-locale'
import { adminDateTime, UNKNOWN_VALUE } from '@/lib/admin-format'

const OPERATIONS_TABS = ['health', 'servers', 'jobs', 'announcements'] as const
type OperationsTab = (typeof OPERATIONS_TABS)[number]

export function OperationsClient() {
  const t = useTranslations()
  const [tab, setTab] = useHubTab<OperationsTab>(OPERATIONS_TABS)

  return (
    <div className="space-y-6">
      <HubTabs
        label={t('admin.hubs.operations.title')}
        items={[
          { id: 'health', label: t('admin.hubs.operations.health') },
          { id: 'servers', label: t('admin.hubs.operations.servers') },
          { id: 'jobs', label: t('admin.hubs.operations.jobs') },
          { id: 'announcements', label: t('admin.hubs.operations.announcements') },
        ]}
        active={tab}
        onSelect={setTab}
      />

      {tab === 'health' && <SystemHealthTabContent />}
      {tab === 'servers' && <ServersClient />}
      {tab === 'jobs' && <BackgroundJobsTabContent />}
      {tab === 'announcements' && <AnnouncementsTabContent />}
    </div>
  )
}

// ─── TAB 1: SYSTEM HEALTH (REAL PROBES) ─────────────────────────────

function SystemHealthTabContent() {
  const t = useTranslations()
  const { data, isLoading, isError, refetch } = useAdminSystemHealth()
  const probes = data?.probes ?? []

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="text-start">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>{t('admin.operations.healthProbesTitle')}</CardTitle>
              <CardDescription>{t('admin.operations.healthProbesDesc')}</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              {t('admin.operations.refreshProbes')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : isError ? (
            <EmptyState title={t('admin.operations.healthError')} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {probes.map((p) => (
                <div
                  key={p.component}
                  className="p-4 rounded-xl border border-border bg-card space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground text-sm">{p.component}</span>
                    <ProbeStatusBadge status={p.status} />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {p.latencyMs !== null ? (
                      <span className="font-mono tabular-nums">{p.latencyMs} ms</span>
                    ) : (
                      <span>—</span>
                    )}
                  </div>
                  {p.details && (
                    <div className="text-xs text-muted-foreground truncate">{p.details}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ProbeStatusBadge({ status }: { status: string }) {
  let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'secondary'
  if (status === 'HEALTHY') variant = 'default'
  if (status === 'DOWN') variant = 'destructive'
  if (status === 'DEGRADED') variant = 'outline'
  return (
    <Badge variant={variant} className="text-xs">
      {status}
    </Badge>
  )
}

// ─── TAB 3: BACKGROUND JOBS ─────────────────────────────────────────

function BackgroundJobsTabContent() {
  const t = useTranslations()
  const { data, isLoading, isError, refetch } = useAdminBackgroundJobs()
  const { mutateAsync: retryJob } = useRetryBackgroundJob()
  const [targetJob, setTargetJob] = useState<BackgroundJobItem | null>(null)

  const jobs = data?.jobs ?? []
  const locale = useAdminLocale()
  const tableT = useAdminTableT()
  const columns: TableColumn<BackgroundJobItem>[] = [
    {
      id: 'jobType',
      labelKey: 'admin.operations.jobType',
      labelFallback: 'نوع کار',
      locked: true,
      render: (j) => (
        <span className="font-mono text-xs font-semibold text-foreground">{j.job_type}</span>
      ),
      sortValue: (j) => j.job_type,
    },
    {
      id: 'jobId',
      labelKey: 'admin.operations.jobId',
      labelFallback: 'شناسه کار',
      showFrom: 'md',
      render: (j) => (
        <span dir="ltr" className="font-mono text-xs text-muted-foreground">
          {j.id.slice(0, 14)}…
        </span>
      ),
      sortValue: (j) => j.id,
    },
    {
      id: 'status',
      labelKey: 'admin.operations.status',
      labelFallback: 'وضعیت',
      render: (j) => <JobStatusBadge status={j.status} />,
      sortValue: (j) => j.status,
    },
    {
      id: 'createdAt',
      labelKey: 'admin.operations.createdAt',
      labelFallback: 'زمان ایجاد',
      showFrom: 'md',
      render: (j) => (
        <span className="whitespace-nowrap tabular-nums text-muted-foreground">
          {adminDateTime(j.created_at, locale)}
        </span>
      ),
      sortValue: (j) => j.created_at,
    },
    {
      id: 'errorMessage',
      labelKey: 'admin.operations.errorMessage',
      labelFallback: 'پیام خطا',
      showFrom: 'lg',
      render: (j) => (
        <span className="block max-w-[220px] truncate font-mono text-xs text-destructive">
          {j.error_message ?? UNKNOWN_VALUE}
        </span>
      ),
    },
    {
      id: 'actions',
      labelKey: 'admin.operations.actions',
      labelFallback: 'عملیات',
      align: 'end',
      locked: true,
      render: (j) =>
        j.status === 'FAILED' ? (
          <Button
            variant="outline"
            size="sm"
            aria-label={`${t('admin.operations.retry')} — ${j.id.slice(0, 14)}…`}
            onClick={() => setTargetJob(j)}
          >
            {t('admin.operations.retry')}
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">{UNKNOWN_VALUE}</span>
        ),
    },
  ]

  const handleRetryConfirm = async ({ stepUpTimestamp }: { stepUpTimestamp: string }) => {
    if (!targetJob) return
    await retryJob({
      jobId: targetJob.id,
      stepUpTimestamp,
    })
    setTargetJob(null)
    void refetch()
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
        <ErrorState message={t('admin.operations.jobsError')} onRetry={() => void refetch()} />
      )}

      {!isLoading && !isError && (
        <DataTable
          tableId="admin-background-jobs"
          t={tableT}
          rows={jobs}
          columns={columns}
          rowKey={(j) => j.id}
          minWidthClass="min-w-[900px]"
          emptyState={
            <EmptyState
              title={t('admin.operations.noJobs')}
              description={t('admin.operations.noJobsHint')}
            />
          }
        />
      )}

      {/* StepUp Dialog for Job Retry */}
      <StepUpDialog
        open={Boolean(targetJob)}
        onOpenChange={(open) => !open && setTargetJob(null)}
        title={t('admin.operations.retryJobTitle')}
        description={t('admin.operations.retryJobDesc', {
          jobType: targetJob?.job_type ?? '',
          jobId: targetJob?.id ?? '',
        })}
        confirmLabel={t('admin.operations.confirmRetry')}
        onConfirm={handleRetryConfirm}
      />
    </div>
  )
}

function JobStatusBadge({ status }: { status: string }) {
  let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'secondary'
  if (status === 'COMPLETED') variant = 'default'
  if (status === 'FAILED') variant = 'destructive'
  if (status === 'RUNNING') variant = 'outline'
  return (
    <Badge variant={variant} className="text-xs">
      {status}
    </Badge>
  )
}

// ─── TAB 4: ANNOUNCEMENTS & MAINTENANCE ──────────────────────────────

function AnnouncementsTabContent() {
  const dateLocale = useAdminLocale()
  const t = useTranslations()
  const { data, isLoading, isError } = useAdminAnnouncements()
  const announcements = data?.announcements ?? []

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
          <EmptyState title={t('admin.operations.announcementsError')} />
        </Card>
      )}

      {!isLoading && !isError && announcements.length === 0 && (
        <Card className="p-8">
          <EmptyState
            title={t('admin.operations.noAnnouncements')}
            description={t('admin.operations.noAnnouncementsHint')}
          />
        </Card>
      )}

      {!isLoading && !isError && announcements.length > 0 && (
        <div className="space-y-3">
          {announcements.map((a) => (
            <Card key={a.id} className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-foreground text-sm">{a.title}</div>
                <Badge
                  variant={
                    a.level === 'MAINTENANCE' || a.level === 'CRITICAL' ? 'destructive' : 'default'
                  }
                  className="text-xs"
                >
                  {a.level}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{a.message}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t border-border">
                <span>
                  {t('admin.operations.startsAt')} {adminDateTime(a.starts_at, dateLocale)}
                </span>
                {a.ends_at && (
                  <span>
                    | {t('admin.operations.endsAt')} {adminDateTime(a.ends_at, dateLocale)}
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
