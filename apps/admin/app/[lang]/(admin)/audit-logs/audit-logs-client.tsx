'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'
import { Button, Card, EmptyState, PaginationBar, Skeleton } from '@/components/ui'
import { ErrorState } from '@/components/admin-shell/admin-ui'
import { useAdminSession } from '@/hooks/use-admin-session'
import { useAdminAuditLogs, type AdminAuditLog } from '@/hooks/use-admin-audit-logs'
import { cn } from '@/lib/utils'
import { useAdminLocale } from '@/hooks/use-admin-locale'
import { adminDateTime } from '@/lib/admin-format'

const PAGE_SIZE = 25

const toneClasses: Record<string, string> = {
  positive: 'bg-[hsl(var(--color-success))]',
  attention: 'bg-[hsl(var(--color-warning))]',
  negative: 'bg-[hsl(var(--color-destructive))]',
  neutral: 'bg-[hsl(var(--fg-tertiary))]',
}

/**
 * The platform audit trail — what changed, who changed it, and when.
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

  const from = total === 0 ? 0 : page * PAGE_SIZE + 1
  const to = Math.min((page + 1) * PAGE_SIZE, total)

  return (
    <div className="space-y-6">
      {(authLoading || isLoading) && (
        <div className="space-y-3" aria-hidden="true">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {isError && !isLoading && (
        <ErrorState message={t('admin.auditLogs.loadError')} onRetry={() => void refetch()} />
      )}

      {!isLoading && !isError && logs.length === 0 && (
        <EmptyState
          title={t('admin.auditLogs.empty')}
          description={t('admin.auditLogs.emptyHint')}
        />
      )}

      {logs.length > 0 && (
        <Card className="overflow-hidden">
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
        </Card>
      )}

      <PaginationBar
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        busy={isFetching}
        onPage={setPage}
        showingLabel={t('admin.pagination.showing', { from, to, total })}
        previousLabel={t('admin.pagination.previous')}
        nextLabel={t('admin.pagination.next')}
      />
    </div>
  )
}

function toneOf(action: string): string {
  const value = action.toLowerCase()
  if (value.includes('delete') || value.includes('remove')) return 'negative'
  if (value.includes('update') || value.includes('change')) return 'attention'
  if (value.includes('create') || value.includes('add')) return 'positive'
  return 'neutral'
}

function AuditRow({ log }: { log: AdminAuditLog }) {
  const dateLocale = useAdminLocale()
  const t = useTranslations()

  return (
    <li className="flex flex-col gap-2 px-5 py-4 lg:grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(0,1fr)] lg:items-center lg:gap-4">
      <span className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden="true"
          className={cn('h-2 w-2 shrink-0 rounded-full', toneClasses[toneOf(log.action)])}
        />
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
        {adminDateTime(log.created_at, dateLocale)}
      </time>
    </li>
  )
}
