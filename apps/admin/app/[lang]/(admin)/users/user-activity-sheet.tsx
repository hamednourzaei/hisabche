'use client'

// ============================================
// Customers › users › activity timeline (V63 #89).
//
// What one person did, newest first, from `audit_logs` (`user_id` says WHO
// acted — it is never a security filter in the product; here it is exactly
// the question). Fifty rows a page, «older» walks back by time.
// ============================================

import { useState } from 'react'
import { useTranslations } from 'next-intl'

import {
  Button,
  DataTable,
  EmptyState,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Skeleton,
  type TableColumn,
} from '@/components/ui'
import { ErrorState, useAdminTableT } from '@/components/admin-shell/admin-ui'
import { useAdminUserActivity, type UserActivityItem } from '@/hooks/use-admin-insights'
import { useAdminLocale } from '@/hooks/use-admin-locale'
import { adminDateTime, UNKNOWN_VALUE } from '@/lib/admin-format'

export function UserActivitySheet({
  user,
  onClose,
}: {
  user: { id: string; label: string } | null
  onClose: () => void
}) {
  return (
    <Sheet open={Boolean(user)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="end" className="w-full overflow-y-auto sm:max-w-2xl">
        {/* Keyed by the person: a new person starts at their newest page. */}
        {user ? <ActivityBody key={user.id} user={user} /> : null}
      </SheetContent>
    </Sheet>
  )
}

function ActivityBody({ user }: { user: { id: string; label: string } }) {
  const t = useTranslations()
  const locale = useAdminLocale()
  const tableT = useAdminTableT()
  const [pages, setPages] = useState<Array<string | null>>([null])
  const before = pages[pages.length - 1] ?? null
  const { data, isLoading, isError, refetch } = useAdminUserActivity(user.id, before)

  const columns: TableColumn<UserActivityItem>[] = [
    {
      id: 'when',
      labelKey: 'admin.insights.activity.when',
      labelFallback: 'When',
      locked: true,
      render: (row) => (
        <span className="text-xs tabular-nums text-muted-foreground">
          {adminDateTime(row.createdAt, locale)}
        </span>
      ),
      sortValue: (row) => row.createdAt,
    },
    {
      id: 'action',
      labelKey: 'admin.insights.activity.action',
      labelFallback: 'Action',
      render: (row) => (
        <span dir="ltr" className="font-mono text-xs text-foreground">
          {row.action} · {row.entityType}
        </span>
      ),
      sortValue: (row) => row.action,
    },
    {
      id: 'workspace',
      labelKey: 'admin.insights.activity.workspace',
      labelFallback: 'Business',
      showFrom: 'md',
      render: (row) => (
        <span dir="ltr" className="font-mono text-xs text-muted-foreground">
          {row.workspaceId ? `${row.workspaceId.slice(0, 8)}…` : UNKNOWN_VALUE}
        </span>
      ),
    },
    {
      id: 'ip',
      labelKey: 'admin.insights.activity.ip',
      labelFallback: 'IP',
      showFrom: 'lg',
      render: (row) => (
        <span dir="ltr" className="font-mono text-xs text-muted-foreground">
          {row.ipAddress ?? UNKNOWN_VALUE}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <SheetHeader className="border-b border-border pb-4 text-start">
        <SheetTitle className="text-base font-bold">
          {t('admin.insights.activity.title', { user: user.label })}
        </SheetTitle>
      </SheetHeader>

      {isLoading && <Skeleton className="h-48 w-full rounded-xl" />}

      {isError && !isLoading && (
        <ErrorState message={t('admin.insights.loadError')} onRetry={() => void refetch()} />
      )}

      {!isLoading && !isError && data && (
        <>
          <DataTable
            tableId="admin-user-activity"
            t={tableT}
            rows={data.items}
            columns={columns}
            rowKey={(row) => row.id}
            caption={t('admin.insights.activity.caption')}
            paginate={false}
            emptyState={
              <EmptyState
                title={t('admin.insights.activity.empty')}
                description={t('admin.insights.activity.emptyHint')}
              />
            }
          />
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pages.length <= 1}
              onClick={() => setPages((current) => current.slice(0, -1))}
            >
              {t('admin.insights.activity.newer')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!data.nextBefore}
              onClick={() => {
                const next = data.nextBefore
                if (next) setPages((current) => [...current, next])
              }}
            >
              {t('admin.insights.activity.older')}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
