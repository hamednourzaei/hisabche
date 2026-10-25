'use client'

import { useState } from 'react'
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
  HubTabs,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Skeleton,
  type TableColumn,
  useHubTab,
} from '@/components/ui'
import {
  useAdminAccounts,
  useAdminAuditLogs,
  useAdminRoles,
  useAdminSecurityEvents,
  useAdminSessions,
  useRevokeAdminSession,
  type AdminAccountItem,
  type AdminAuditLogItem,
  type AdminSecurityEventItem,
  type AdminSessionItem,
} from '@/hooks/use-admin-security'
import { useAdminLocale } from '@/hooks/use-admin-locale'
import { adminDate, adminDateTime, UNKNOWN_VALUE } from '@/lib/admin-format'
import { ErrorState, useAdminTableT } from '@/components/admin-shell/admin-ui'
import { StepUpDialog } from '@/components/admin-shell/step-up-dialog'

const SECURITY_TABS = ['audit', 'roles', 'sessions', 'events'] as const
type SecurityTab = (typeof SECURITY_TABS)[number]

export function SecurityClient() {
  const t = useTranslations()
  const [tab, setTab] = useHubTab<SecurityTab>(SECURITY_TABS)

  return (
    <div className="space-y-6">
      <HubTabs
        label={t('admin.hubs.security.title')}
        items={[
          { id: 'audit', label: t('admin.hubs.security.audit') },
          { id: 'roles', label: t('admin.hubs.security.roles') },
          { id: 'sessions', label: t('admin.hubs.security.sessions') },
          { id: 'events', label: t('admin.hubs.security.events') },
        ]}
        active={tab}
        onSelect={setTab}
      />

      {tab === 'audit' && <AuditTabContent />}
      {tab === 'roles' && <RolesTabContent />}
      {tab === 'sessions' && <SessionsTabContent />}
      {tab === 'events' && <EventsTabContent />}
    </div>
  )
}

// ─── TAB 1: AUDIT LOGS ──────────────────────────────────────────────

function AuditTabContent() {
  const t = useTranslations()
  const [search, setSearch] = useState('')
  const [selectedLog, setSelectedLog] = useState<AdminAuditLogItem | null>(null)

  const { data, isLoading, isError, refetch } = useAdminAuditLogs({
    search: search.trim() || undefined,
    limit: 50,
  })

  const logs = data?.logs ?? []
  const locale = useAdminLocale()
  const tableT = useAdminTableT()
  const columns: TableColumn<AdminAuditLogItem>[] = [
    {
      id: 'when',
      labelKey: 'admin.auditLogs.when',
      labelFallback: 'زمان',
      render: (log) => (
        <span className="text-xs tabular-nums text-muted-foreground">
          {adminDateTime(log.created_at, locale)}
        </span>
      ),
      sortValue: (log) => log.created_at,
    },
    {
      id: 'action',
      labelKey: 'admin.auditLogs.action',
      labelFallback: 'عملیات',
      render: (log) => <ActionBadge action={log.action} />,
      sortValue: (log) => log.action,
    },
    {
      id: 'entity',
      labelKey: 'admin.auditLogs.entity',
      labelFallback: 'موضوع',
      render: (log) => (
        <div className="text-xs">
          <div className="font-medium text-foreground">{log.entity_type}</div>
          {log.entity_id && (
            <div dir="ltr" className="max-w-[140px] truncate font-mono text-muted-foreground">
              {log.entity_id}
            </div>
          )}
        </div>
      ),
      sortValue: (log) => log.entity_type,
    },
    {
      id: 'reason',
      labelKey: 'admin.auditLogs.reason',
      labelFallback: 'دلیل',
      render: (log) => (
        <span className="block max-w-[200px] truncate text-xs text-muted-foreground">
          {log.reason ?? UNKNOWN_VALUE}
        </span>
      ),
    },
    {
      id: 'ip',
      labelKey: 'admin.auditLogs.ip',
      labelFallback: 'IP',
      showFrom: 'md',
      render: (log) => (
        <span className="text-xs tabular-nums text-muted-foreground">
          {log.ip_address ?? UNKNOWN_VALUE}
        </span>
      ),
    },
    {
      id: 'details',
      labelKey: 'admin.auditLogs.details',
      labelFallback: 'جزئیات',
      align: 'end',
      locked: true,
      render: (log) => (
        <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)}>
          {t('admin.auditLogs.viewDiff')}
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground">
        {t('admin.auditLogs.totalCount', { count: data?.total ?? 0 })}
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      )}

      {isError && !isLoading && (
        <ErrorState message={t('admin.auditLogs.loadError')} onRetry={() => void refetch()} />
      )}

      {!isLoading && !isError && (
        <DataTable
          tableId="admin-audit-logs"
          t={tableT}
          rows={logs}
          columns={columns}
          rowKey={(log) => log.id}
          searchValue={search}
          onSearchChange={setSearch}
          caption={t('admin.auditLogs.title')}
          emptyState={
            <EmptyState
              title={search.trim() ? t('admin.empty.noneOnPage') : t('admin.auditLogs.empty')}
              description={
                search.trim() ? t('admin.empty.noneOnPageHint') : t('admin.auditLogs.emptyHint')
              }
            />
          }
        />
      )}

      {/* Before / After Diff Sheet */}
      <Sheet open={Boolean(selectedLog)} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <SheetContent side="end" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader className="text-start">
            <SheetTitle>{t('admin.auditLogs.diffTitle')}</SheetTitle>
          </SheetHeader>
          {selectedLog && (
            <div className="mt-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-muted/40">
                <div>
                  <span className="text-muted-foreground">{t('admin.auditLogs.action')}: </span>
                  <span className="font-semibold text-foreground">{selectedLog.action}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">ID: </span>
                  <span dir="ltr" className="font-mono">
                    {selectedLog.id}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('admin.auditLogs.requestId')}: </span>
                  <span dir="ltr" className="font-mono">
                    {selectedLog.request_id ?? '—'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">
                    {t('admin.auditLogs.correlationId')}:{' '}
                  </span>
                  <span dir="ltr" className="font-mono">
                    {selectedLog.correlation_id ?? '—'}
                  </span>
                </div>
              </div>

              {selectedLog.reason && (
                <div className="p-3 rounded-lg border border-border">
                  <div className="font-semibold text-foreground mb-1">
                    {t('admin.auditLogs.reason')}:
                  </div>
                  <div className="text-muted-foreground">{selectedLog.reason}</div>
                </div>
              )}

              <div className="space-y-2">
                <div className="font-semibold text-foreground">
                  {t('admin.auditLogs.beforeData')}:
                </div>
                <pre
                  dir="ltr"
                  className="p-3 rounded-lg bg-muted font-mono text-xs overflow-x-auto text-start"
                >
                  {selectedLog.old_data ? JSON.stringify(selectedLog.old_data, null, 2) : 'null'}
                </pre>
              </div>

              <div className="space-y-2">
                <div className="font-semibold text-foreground">
                  {t('admin.auditLogs.afterData')}:
                </div>
                <pre
                  dir="ltr"
                  className="p-3 rounded-lg bg-muted font-mono text-xs overflow-x-auto text-start"
                >
                  {selectedLog.new_data ? JSON.stringify(selectedLog.new_data, null, 2) : 'null'}
                </pre>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function ActionBadge({ action }: { action: string }) {
  const lower = action.toLowerCase()
  let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'secondary'
  if (lower.includes('delete') || lower.includes('revoke') || lower.includes('ban')) {
    variant = 'destructive'
  } else if (lower.includes('create') || lower.includes('insert')) {
    variant = 'default'
  }
  return (
    <Badge variant={variant} className="font-mono text-xs">
      {action}
    </Badge>
  )
}

// ─── TAB 2: ROLES & ACCOUNTS ────────────────────────────────────────

function RolesTabContent() {
  const t = useTranslations()
  const { data: rolesData, isLoading: rolesLoading } = useAdminRoles()
  const {
    data: accountsData,
    isLoading: accountsLoading,
    isError: accountsError,
    refetch: refetchAccounts,
  } = useAdminAccounts()

  const roles = rolesData?.roles ?? []
  const accounts = accountsData?.accounts ?? []
  const locale = useAdminLocale()
  const tableT = useAdminTableT()
  const accountColumns: TableColumn<AdminAccountItem>[] = [
    {
      id: 'email',
      labelKey: 'admin.security.email',
      labelFallback: 'ایمیل',
      locked: true,
      render: (acc) => <span className="font-medium text-foreground">{acc.email}</span>,
      sortValue: (acc) => acc.email,
    },
    {
      id: 'role',
      labelKey: 'admin.security.role',
      labelFallback: 'نقش',
      render: (acc) => (
        <Badge variant="outline" className="font-mono text-xs">
          {acc.role}
        </Badge>
      ),
      sortValue: (acc) => acc.role,
    },
    {
      id: 'status',
      labelKey: 'admin.security.status',
      labelFallback: 'وضعیت',
      render: (acc) => (
        <Badge variant={acc.isActive ? 'default' : 'secondary'} className="text-xs">
          {acc.isActive ? t('admin.security.active') : t('admin.security.inactive')}
        </Badge>
      ),
      sortValue: (acc) => (acc.isActive ? 1 : 0),
    },
    {
      id: 'created',
      labelKey: 'admin.security.created',
      labelFallback: 'تاریخ ایجاد',
      render: (acc) => (
        <span className="text-xs tabular-nums text-muted-foreground">
          {adminDate(acc.createdAt, locale)}
        </span>
      ),
      sortValue: (acc) => acc.createdAt,
    },
  ]

  return (
    <div className="space-y-6">
      {/* 7 Fixed Roles Matrix */}
      <Card>
        <CardHeader className="text-start">
          <CardTitle>{t('admin.security.fixedRolesTitle')}</CardTitle>
          <CardDescription>{t('admin.security.fixedRolesDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {rolesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {roles.map((r) => (
                <div key={r.role} className="p-4 rounded-xl border border-border bg-card space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground text-sm">{r.role}</span>
                    <Badge variant="outline" className="text-xs">
                      {r.permissions.length} {t('admin.security.permissionsCount')}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground max-h-24 overflow-y-auto space-y-1">
                    {r.permissions.map((p) => (
                      <div key={p} className="font-mono text-xs bg-muted/50 rounded px-1.5 py-0.5">
                        {p}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Admin Accounts Table */}
      <Card>
        <CardHeader className="text-start">
          <CardTitle>{t('admin.security.adminAccountsTitle')}</CardTitle>
          <CardDescription>{t('admin.security.adminAccountsDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {accountsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-14 rounded-[var(--radius-md)]" />
              ))}
            </div>
          ) : accountsError ? (
            <ErrorState
              message={t('admin.security.accountsLoadError')}
              onRetry={() => void refetchAccounts()}
            />
          ) : (
            <DataTable
              tableId="admin-accounts"
              t={tableT}
              rows={accounts}
              columns={accountColumns}
              rowKey={(acc) => acc.id}
              caption={t('admin.security.adminAccountsTitle')}
              minWidthClass="min-w-[560px]"
              emptyState={
                <EmptyState
                  title={t('admin.security.noAccounts')}
                  description={t('admin.security.noAccountsHint')}
                />
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── TAB 3: ACTIVE SESSIONS ─────────────────────────────────────────

function SessionsTabContent() {
  const t = useTranslations()
  const { data, isLoading, isError, refetch } = useAdminSessions()
  const { mutateAsync: revokeSession } = useRevokeAdminSession()
  const [targetSession, setTargetSession] = useState<AdminSessionItem | null>(null)

  const sessions = data?.sessions ?? []
  const locale = useAdminLocale()
  const tableT = useAdminTableT()
  const columns: TableColumn<AdminSessionItem>[] = [
    {
      id: 'admin',
      labelKey: 'admin.security.adminUser',
      labelFallback: 'مدیر',
      locked: true,
      render: (sess) => <span className="font-medium text-foreground">{sess.adminEmail}</span>,
      sortValue: (sess) => sess.adminEmail,
    },
    {
      id: 'session',
      labelKey: 'admin.security.sessionId',
      labelFallback: 'شناسه نشست',
      render: (sess) => <span className="font-mono text-xs text-muted-foreground">{sess.id}</span>,
    },
    {
      id: 'signIn',
      labelKey: 'admin.security.lastSignIn',
      labelFallback: 'آخرین ورود',
      showFrom: 'md',
      render: (sess) => (
        <span className="text-xs tabular-nums text-muted-foreground">
          {adminDateTime(sess.lastSignInAt, locale)}
        </span>
      ),
      sortValue: (sess) => sess.lastSignInAt,
    },
    {
      id: 'created',
      labelKey: 'admin.security.createdAt',
      labelFallback: 'تاریخ ایجاد',
      showFrom: 'md',
      render: (sess) => (
        <span className="text-xs tabular-nums text-muted-foreground">
          {adminDateTime(sess.createdAt, locale)}
        </span>
      ),
      sortValue: (sess) => sess.createdAt,
    },
    {
      id: 'actions',
      labelKey: 'admin.security.actions',
      labelFallback: 'عملیات',
      align: 'end',
      locked: true,
      render: (sess) => (
        <Button
          variant="destructive"
          size="sm"
          aria-label={t('admin.security.revokeSessionFor', { email: sess.adminEmail })}
          onClick={() => setTargetSession(sess)}
        >
          {t('admin.security.revokeSession')}
        </Button>
      ),
    },
  ]

  const handleRevokeConfirm = async ({
    stepUpTimestamp,
  }: {
    stepUpTimestamp: string
    reason?: string
  }) => {
    if (!targetSession) return
    await revokeSession({
      userId: targetSession.userId,
      stepUpTimestamp,
    })
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
        <ErrorState message={t('admin.security.sessionsError')} onRetry={() => void refetch()} />
      )}

      {!isLoading && !isError && (
        <DataTable
          tableId="admin-sessions"
          t={tableT}
          rows={sessions}
          columns={columns}
          rowKey={(sess) => sess.id}
          caption={t('admin.hubs.security.sessions')}
          minWidthClass="min-w-[720px]"
          emptyState={
            <EmptyState
              title={t('admin.security.noSessions')}
              description={t('admin.security.noSessionsHint')}
            />
          }
        />
      )}

      {/* Step-up Dialog for Revocation */}
      <StepUpDialog
        open={Boolean(targetSession)}
        onOpenChange={(open) => !open && setTargetSession(null)}
        title={t('admin.security.revokeConfirmTitle')}
        description={t('admin.security.revokeConfirmDesc', {
          email: targetSession?.adminEmail ?? '',
        })}
        destructive
        requireReason
        reasonLabel={t('admin.security.revokeReason')}
        confirmLabel={t('admin.security.confirmRevoke')}
        onConfirm={handleRevokeConfirm}
      />
    </div>
  )
}

// ─── TAB 4: SECURITY EVENTS ─────────────────────────────────────────

function EventsTabContent() {
  const t = useTranslations()
  const { data, isLoading, isError, refetch } = useAdminSecurityEvents({ limit: 50 })
  const events = data?.events ?? []
  const locale = useAdminLocale()
  const tableT = useAdminTableT()
  const columns: TableColumn<AdminSecurityEventItem>[] = [
    {
      id: 'when',
      labelKey: 'admin.security.when',
      labelFallback: 'زمان',
      render: (ev) => (
        <span className="text-xs tabular-nums text-muted-foreground">
          {adminDateTime(ev.createdAt, locale)}
        </span>
      ),
      sortValue: (ev) => ev.createdAt,
    },
    {
      id: 'type',
      labelKey: 'admin.security.eventType',
      labelFallback: 'نوع رویداد',
      render: (ev) => <EventBadge eventType={ev.eventType} />,
      sortValue: (ev) => ev.eventType,
    },
    {
      id: 'actor',
      labelKey: 'admin.security.actor',
      labelFallback: 'کاربر',
      render: (ev) => (
        <span className="text-xs font-medium text-foreground">
          {ev.adminEmail ?? UNKNOWN_VALUE}
        </span>
      ),
      sortValue: (ev) => ev.adminEmail,
    },
    {
      id: 'ip',
      labelKey: 'admin.security.ip',
      labelFallback: 'IP',
      showFrom: 'md',
      render: (ev) => (
        <span className="text-xs tabular-nums text-muted-foreground">
          {ev.ipAddress ?? UNKNOWN_VALUE}
        </span>
      ),
    },
    {
      id: 'details',
      labelKey: 'admin.security.details',
      labelFallback: 'جزئیات',
      showFrom: 'lg',
      render: (ev) => (
        <pre dir="ltr" className="max-w-[240px] truncate rounded bg-muted/40 p-1 text-xs">
          {JSON.stringify(ev.details)}
        </pre>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      )}

      {isError && !isLoading && (
        <ErrorState message={t('admin.security.eventsError')} onRetry={() => void refetch()} />
      )}

      {!isLoading && !isError && (
        <DataTable
          tableId="admin-security-events"
          t={tableT}
          rows={events}
          columns={columns}
          rowKey={(ev) => ev.id}
          caption={t('admin.hubs.security.events')}
          emptyState={
            <EmptyState
              title={t('admin.security.noEvents')}
              description={t('admin.security.noEventsHint')}
            />
          }
        />
      )}
    </div>
  )
}

function EventBadge({ eventType }: { eventType: string }) {
  let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'secondary'
  if (eventType === 'UNAUTHORIZED_ACCESS' || eventType.includes('FAIL')) {
    variant = 'destructive'
  } else if (eventType === 'STEP_UP_PASSED') {
    variant = 'default'
  } else if (eventType === 'STEP_UP_REQUIRED') {
    variant = 'outline'
  }
  return (
    <Badge variant={variant} className="font-mono text-xs">
      {eventType}
    </Badge>
  )
}
