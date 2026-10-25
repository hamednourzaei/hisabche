'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'
import { Info, Search } from 'lucide-react'
import { Button, Card, EmptyState, Input, PaginationBar, Skeleton } from '@/components/ui'
import { ErrorState } from '@/components/admin-shell/admin-ui'
import { useAdminListState } from '@/hooks/use-admin-list-state'
import { useAdminSession } from '@/hooks/use-admin-session'
import { useAdminUsers } from '@/hooks/use-admin-users'
import { useManageUser } from '@/hooks/use-admin-customers'
import { StepUpDialog } from '@/components/admin-shell/step-up-dialog'

const PAGE_SIZE = 20

export function UsersClient() {
  const t = useTranslations()
  const router = useRouter()
  const pathname = usePathname()
  const { loading: authLoading, error: authError } = useAdminSession()
  const { mutateAsync: manageUser } = useManageUser()

  const { query, page: pageParam, setQuery, setPage: setPageParam } = useAdminListState()
  const page = pageParam - 1
  const [search, setSearch] = useState(query)
  const [lastQuery, setLastQuery] = useState(query)
  const [targetAction, setTargetAction] = useState<{
    userId: string
    action: 'suspend' | 'reactivate' | 'revoke_sessions' | 'reset_mfa' | 'force_signout'
  } | null>(null)

  const localePrefix = pathname.split('/').filter(Boolean)[0] || 'fa'

  // The URL is the source of truth: a link, a refresh or the back button all
  // restore the same search. Typing updates it through the debounce below.
  if (lastQuery !== query) {
    setLastQuery(query)
    setSearch(query)
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== query) setQuery(search)
    }, 300)
    return () => clearTimeout(timer)
  }, [search, query, setQuery])

  const { data, isLoading, isError, isFetching, refetch } = useAdminUsers({
    ...(query ? { search: query } : {}),
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  })

  const handleStepUpConfirm = async ({ stepUpTimestamp }: { stepUpTimestamp: string }) => {
    if (!targetAction) return
    await manageUser({
      userId: targetAction.userId,
      action: targetAction.action,
      stepUpTimestamp,
    })
    setTargetAction(null)
    void refetch()
  }

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

  const users = data?.users ?? []
  const total = data?.total ?? 0

  const from = total === 0 ? 0 : page * PAGE_SIZE + 1
  const to = Math.min((page + 1) * PAGE_SIZE, total)

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-2xl border border-border bg-accent/50 p-4 text-sm">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-400" aria-hidden="true" />
        <p className="min-w-0 text-muted-foreground">{t('admin.users.searchScopeNotice')}</p>
      </div>

      <div className="relative w-full lg:max-w-sm">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('admin.users.search')}
          aria-label={t('admin.users.search')}
          className="h-11 w-full rounded-xl ps-9"
        />
      </div>

      {(authLoading || isLoading) && (
        <div className="space-y-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {isError && !isLoading && (
        <ErrorState message={t('admin.users.loadError')} onRetry={() => void refetch()} />
      )}

      {!isLoading && !isError && users.length === 0 && (
        <EmptyState
          title={query ? t('admin.empty.noResults', { search: query }) : t('admin.users.empty')}
          description={query ? t('admin.users.searchScopeNotice') : undefined}
        />
      )}

      {users.length > 0 && (
        <Card className="overflow-hidden">
          <div
            className="hidden grid-cols-[1.2fr_1.2fr_auto] gap-4 border-b border-border bg-accent/40 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:grid"
            aria-hidden="true"
          >
            <span>{t('admin.member.name')}</span>
            <span>{t('admin.member.email')}</span>
            <span className="text-end">{t('admin.customers.actions')}</span>
          </div>

          <ul className="divide-y divide-border">
            {users.map((user) => (
              <li
                key={user.id}
                className="flex flex-col gap-2 px-5 py-4 sm:grid sm:grid-cols-[1.2fr_1.2fr_auto] sm:items-center sm:gap-4"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/25 to-violet-500/25 text-xs font-bold text-blue-400"
                  >
                    {initialOf(user.full_name ?? user.email)}
                  </span>
                  <span className="min-w-0 truncate font-medium">
                    {user.full_name ?? t('admin.member.noProfile')}
                  </span>
                </span>
                <span
                  dir="ltr"
                  className="min-w-0 truncate text-start text-sm text-muted-foreground"
                >
                  {user.email ?? '—'}
                </span>

                <div className="flex items-center gap-1.5 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setTargetAction({ userId: user.id, action: 'revoke_sessions' })}
                  >
                    {t('admin.customers.revokeSessions')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setTargetAction({ userId: user.id, action: 'reset_mfa' })}
                  >
                    {t('admin.customers.resetMfa')}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setTargetAction({ userId: user.id, action: 'suspend' })}
                  >
                    {t('admin.customers.suspendUser')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* StepUp Dialog for User Actions */}
      <StepUpDialog
        open={Boolean(targetAction)}
        onOpenChange={(open) => !open && setTargetAction(null)}
        title={t('admin.customers.userActionTitle')}
        description={t('admin.customers.userActionDesc', { action: targetAction?.action ?? '' })}
        destructive={targetAction?.action === 'suspend'}
        onConfirm={handleStepUpConfirm}
      />

      <PaginationBar
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        busy={isFetching}
        onPage={(next) => setPageParam(next + 1)}
        showingLabel={t('admin.pagination.showing', { from, to, total })}
        previousLabel={t('admin.pagination.previous')}
        nextLabel={t('admin.pagination.next')}
      />
    </div>
  )
}

function initialOf(value: string | null): string {
  const first = value?.trim().charAt(0)
  return first ? first.toUpperCase() : '—'
}
