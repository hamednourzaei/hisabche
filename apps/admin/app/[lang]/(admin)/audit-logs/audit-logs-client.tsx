'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui'
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
  Pagination,
  Panel,
  StatusDot,
  type StatusTone,
} from '@/components/admin-shell/admin-ui'
import { useAdminSession } from '@/hooks/use-admin-session'
import { useAdminAuditLogs, type AdminAuditLog } from '@/hooks/use-admin-audit-logs'

const PAGE_SIZE = 25

/**
 * The platform audit trail — what changed, who changed it, and when.
 *
 * This is the counterpart to every mutation in this console: role changes,
 * membership removals, plan and status changes all append here, and the
 * capability contract is explicit that a REFUSED mutation writes nothing. So
 * an empty screen means nothing happened, not that logging failed.
 *
 * No filters are offered because the route accepts none — it parses only
 * limit/offset (`admin.routes.ts:366`). Filter controls that quietly narrowed
 * one page would be worse than paging honestly.
 */
export function AuditLogsClient() {
  const t = useTranslations()
  const router = useRouter()
  const pathname = usePathname()
  const { loading: authLoading, error: authError } = useAdminSession()
  const [page, setPage] = useState(0)

  const localePrefix = pathname.split('/').filter(Boolean)[0] || 'fa'

  const { data, isLoading, isError, isFetching, refetch } = useAdminAuditLogs({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  })

  if (authError) {
    return (
      <div className="space-y-4">
        <ErrorState
          message={authError === 'NO_SESSION' ? t('auth.sessionExpired') : t('app.error')}
          onRetry={() => router.replace(`/${localePrefix}/login`)}
        />
        <Button variant="outline" onClick={() => router.replace(`/${localePrefix}/login`)}>
          {t('auth.signIn')}
        </Button>
      </div>
    )
  }

  const logs = data?.logs ?? []
  const total = data?.total ?? 0

  return (
    <div className="space-y-6">
      {(authLoading || isLoading) && <ListSkeleton rows={8} height="h-20" />}

      {isError && !isLoading && (
        <ErrorState message={t('admin.auditLogs.loadError')} onRetry={() => void refetch()} />
      )}

      {!isLoading && !isError && logs.length === 0 && (
        <EmptyState title={t('admin.auditLogs.empty')} hint={t('admin.auditLogs.emptyHint')} />
      )}

      {logs.length > 0 && (
        <Panel className="overflow-hidden">
          <div
            className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(0,1fr)] gap-4 border-b border-border bg-accent/40 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:grid"
            aria-hidden="true"
          >
            <span>{t('admin.auditLogs.action')}</span>
            <span>{t('admin.auditLogs.entity')}</span>
            <span>{t('admin.auditLogs.when')}</span>
          </div>

          <ul className="divide-y divide-border">
            {logs.map((log) => (
              <AuditRow key={log.id} log={log} />
            ))}
          </ul>
        </Panel>
      )}

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        busy={isFetching}
        onPage={setPage}
      />
    </div>
  )
}

/**
 * Tone by verb, derived from the action string rather than a hardcoded list —
 * new audited actions get sensible colour without a code change, and an
 * unrecognised one falls back to neutral instead of guessing "safe".
 */
function toneOf(action: string): StatusTone {
  const value = action.toLowerCase()
  if (value.includes('delete') || value.includes('remove')) return 'negative'
  if (value.includes('update') || value.includes('change')) return 'attention'
  if (value.includes('create') || value.includes('add')) return 'positive'
  return 'neutral'
}

function AuditRow({ log }: { log: AdminAuditLog }) {
  const t = useTranslations()

  return (
    <li className="flex flex-col gap-2 px-5 py-4 lg:grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(0,1fr)] lg:items-center lg:gap-4">
      <span className="flex min-w-0 items-center gap-2">
        <StatusDot tone={toneOf(log.action)} />
        {/* The raw action string. It is an identifier the backend writes, not
            a translated phrase — inventing a Persian label per action would
            drift the moment a new action is added server-side. */}
        <code dir="ltr" className="min-w-0 truncate rounded-md bg-accent px-2 py-1 text-xs">
          {log.action}
        </code>
      </span>

      <span className="min-w-0 text-sm text-muted-foreground">
        {log.entity_type ? (
          <>
            <span className="font-medium text-foreground">{log.entity_type}</span>
            {log.entity_id && (
              <span
                dir="ltr"
                className="ms-2 inline-block max-w-full truncate align-bottom text-xs"
              >
                {log.entity_id}
              </span>
            )}
          </>
        ) : (
          t('admin.auditLogs.noEntity')
        )}
      </span>

      <time
        dateTime={log.created_at}
        suppressHydrationWarning
        className="text-sm tabular-nums text-muted-foreground"
      >
        {new Date(log.created_at).toLocaleString()}
      </time>
    </li>
  )
}
