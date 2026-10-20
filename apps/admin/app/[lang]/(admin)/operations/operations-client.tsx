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
                    <div className="text-[11px] text-muted-foreground truncate">{p.details}</div>
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
    <Badge variant={variant} className="text-[10px]">
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
        <Card className="p-8">
          <EmptyState title={t('admin.operations.jobsError')} />
        </Card>
      )}

      {!isLoading && !isError && jobs.length === 0 && (
        <Card className="p-8">
          <EmptyState
            title={t('admin.operations.noJobs')}
            description={t('admin.operations.noJobsHint')}
          />
        </Card>
      )}

      {!isLoading && !isError && jobs.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="border-b border-border bg-muted/40 font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-start">{t('admin.operations.jobType')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.operations.jobId')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.operations.status')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.operations.createdAt')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.operations.errorMessage')}</th>
                  <th className="px-4 py-3 text-end">{t('admin.operations.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {jobs.map((j) => (
                  <tr key={j.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-semibold text-foreground font-mono">
                      {j.job_type}
                    </td>
                    <td className="px-4 py-3 font-mono text-muted-foreground text-[11px]" dir="ltr">
                      {j.id.slice(0, 14)}...
                    </td>
                    <td className="px-4 py-3">
                      <JobStatusBadge status={j.status} />
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground whitespace-nowrap">
                      {new Date(j.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-destructive font-mono text-[11px] truncate max-w-[200px]">
                      {j.error_message ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-end">
                      {j.status === 'FAILED' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setTargetJob(j)}
                        >
                          {t('admin.operations.retry')}
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
    <Badge variant={variant} className="text-[10px]">
      {status}
    </Badge>
  )
}

// ─── TAB 4: ANNOUNCEMENTS & MAINTENANCE ──────────────────────────────

function AnnouncementsTabContent() {
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
                  className="text-[10px]"
                >
                  {a.level}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{a.message}</p>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-1 border-t border-border">
                <span>
                  {t('admin.operations.startsAt')} {new Date(a.starts_at).toLocaleString()}
                </span>
                {a.ends_at && (
                  <span>
                    | {t('admin.operations.endsAt')} {new Date(a.ends_at).toLocaleString()}
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
