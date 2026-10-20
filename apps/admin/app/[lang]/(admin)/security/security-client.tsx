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
  Input,
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
  useAdminAuditLogs,
  useAdminRoles,
  useAdminAccounts,
  useAdminSessions,
  useRevokeAdminSession,
  useAdminSecurityEvents,
  type AdminAuditLogItem,
  type AdminSessionItem,
} from '@/hooks/use-admin-security'
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

  const { data, isLoading, isError } = useAdminAuditLogs({
    search: search.trim() || undefined,
    limit: 50,
  })

  const logs = data?.logs ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder={t('admin.auditLogs.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="text-xs text-muted-foreground">
          {t('admin.auditLogs.totalCount', { count: data?.total ?? 0 })}
        </div>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      )}

      {isError && !isLoading && (
        <Card className="p-8">
          <EmptyState
            title={t('admin.auditLogs.loadError')}
            description={t('admin.auditLogs.loadErrorHint')}
          />
        </Card>
      )}

      {!isLoading && !isError && logs.length === 0 && (
        <Card className="p-8">
          <EmptyState
            title={t('admin.auditLogs.empty')}
            description={t('admin.auditLogs.emptyHint')}
          />
        </Card>
      )}

      {!isLoading && !isError && logs.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-start">{t('admin.auditLogs.when')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.auditLogs.action')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.auditLogs.entity')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.auditLogs.reason')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.auditLogs.ip')}</th>
                  <th className="px-4 py-3 text-end">{t('admin.auditLogs.details')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <ActionBadge action={log.action} />
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="font-medium text-foreground">{log.entity_type}</div>
                      {log.entity_id && (
                        <div
                          dir="ltr"
                          className="font-mono text-muted-foreground truncate max-w-[140px]"
                        >
                          {log.entity_id}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate">
                      {log.reason ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground tabular-nums whitespace-nowrap">
                      {log.ip_address ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)}>
                        {t('admin.auditLogs.viewDiff')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
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
                  className="p-3 rounded-lg bg-muted font-mono text-[11px] overflow-x-auto text-start"
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
                  className="p-3 rounded-lg bg-muted font-mono text-[11px] overflow-x-auto text-start"
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
    <Badge variant={variant} className="font-mono text-[11px]">
      {action}
    </Badge>
  )
}

// ─── TAB 2: ROLES & ACCOUNTS ────────────────────────────────────────

function RolesTabContent() {
  const t = useTranslations()
  const { data: rolesData, isLoading: rolesLoading } = useAdminRoles()
  const { data: accountsData, isLoading: accountsLoading } = useAdminAccounts()

  const roles = rolesData?.roles ?? []
  const accounts = accountsData?.accounts ?? []

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
                      <div
                        key={p}
                        className="font-mono text-[10px] bg-muted/50 rounded px-1.5 py-0.5"
                      >
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
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))}
            </div>
          ) : accounts.length === 0 ? (
            <EmptyState
              title={t('admin.security.noAccounts')}
              description={t('admin.security.noAccountsHint')}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-start text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs font-medium text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-start">{t('admin.security.email')}</th>
                    <th className="px-4 py-3 text-start">{t('admin.security.role')}</th>
                    <th className="px-4 py-3 text-start">{t('admin.security.status')}</th>
                    <th className="px-4 py-3 text-start">{t('admin.security.created')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {accounts.map((acc) => (
                    <tr key={acc.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{acc.email}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="font-mono text-xs">
                          {acc.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={acc.isActive ? 'default' : 'secondary'} className="text-xs">
                          {acc.isActive ? t('admin.security.active') : t('admin.security.inactive')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs tabular-nums text-muted-foreground">
                        {new Date(acc.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
        <Card className="p-8">
          <EmptyState
            title={t('admin.security.sessionsError')}
            description={t('admin.security.sessionsErrorHint')}
          />
        </Card>
      )}

      {!isLoading && !isError && sessions.length === 0 && (
        <Card className="p-8">
          <EmptyState
            title={t('admin.security.noSessions')}
            description={t('admin.security.noSessionsHint')}
          />
        </Card>
      )}

      {!isLoading && !isError && sessions.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-start">{t('admin.security.adminUser')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.security.sessionId')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.security.lastSignIn')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.security.createdAt')}</th>
                  <th className="px-4 py-3 text-end">{t('admin.security.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sessions.map((sess) => (
                  <tr key={sess.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{sess.adminEmail}</td>
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{sess.id}</td>
                    <td className="px-4 py-3 text-xs tabular-nums text-muted-foreground">
                      {sess.lastSignInAt ? new Date(sess.lastSignInAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums text-muted-foreground">
                      {new Date(sess.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setTargetSession(sess)}
                      >
                        {t('admin.security.revokeSession')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
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
  const { data, isLoading, isError } = useAdminSecurityEvents({ limit: 50 })
  const events = data?.events ?? []

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
        <Card className="p-8">
          <EmptyState
            title={t('admin.security.eventsError')}
            description={t('admin.security.eventsErrorHint')}
          />
        </Card>
      )}

      {!isLoading && !isError && events.length === 0 && (
        <Card className="p-8">
          <EmptyState
            title={t('admin.security.noEvents')}
            description={t('admin.security.noEventsHint')}
          />
        </Card>
      )}

      {!isLoading && !isError && events.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-start">{t('admin.security.when')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.security.eventType')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.security.actor')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.security.ip')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.security.details')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {events.map((ev) => (
                  <tr key={ev.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                      {new Date(ev.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <EventBadge eventType={ev.eventType} />
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-foreground">
                      {ev.adminEmail ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground tabular-nums whitespace-nowrap">
                      {ev.ipAddress ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                      <pre
                        className="text-[10px] bg-muted/50 rounded p-1 max-w-[240px] truncate"
                        dir="ltr"
                      >
                        {JSON.stringify(ev.details)}
                      </pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
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
    <Badge variant={variant} className="font-mono text-[11px]">
      {eventType}
    </Badge>
  )
}
