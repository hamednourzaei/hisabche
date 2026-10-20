'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'
import { Button, EmptyState, Input, PaginationBar, Skeleton } from '@/components/ui'
import { ErrorState } from '@/components/admin-shell/admin-ui'

import { WorkspaceRow } from '@/components/workspaces/workspace-row'
import { useAdminSession } from '@/hooks/use-admin-session'
import { useAdminWorkspaces } from '@/hooks/use-admin-workspaces'

const PAGE_SIZE = 20

type ActivityFilter = 'all' | 'active' | 'inactive'

export function WorkspacesClient({ onOpen360 }: { onOpen360?: (id: string) => void } = {}) {
  const t = useTranslations()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { loading: authLoading, error: authError } = useAdminSession()

  const initialSearch = searchParams.get('search') ?? ''
  const [search, setSearch] = useState(initialSearch)
  const [debounced, setDebounced] = useState(initialSearch)
  const [page, setPage] = useState(0)
  const [activity, setActivity] = useState<ActivityFilter>('all')

  const localePrefix = pathname.split('/').filter(Boolean)[0] || 'fa'

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search)
      setPage(0)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data, isLoading, isError, isFetching, refetch } = useAdminWorkspaces({
    ...(debounced ? { search: debounced } : {}),
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

  const workspaces = data?.workspaces ?? []
  const total = data?.total ?? 0

  const visible =
    activity === 'all'
      ? workspaces
      : workspaces.filter((w) => w.is_active === (activity === 'active'))

  const activeCount = workspaces.filter((w) => w.is_active).length

  const filters: {
    id: ActivityFilter
    label: string
    count: number
  }[] = [
    { id: 'all', label: t('admin.filters.all'), count: workspaces.length },
    { id: 'active', label: t('admin.workspaces.active'), count: activeCount },
    {
      id: 'inactive',
      label: t('admin.workspaces.inactive'),
      count: workspaces.length - activeCount,
    },
  ]

  const from = total === 0 ? 0 : page * PAGE_SIZE + 1
  const to = Math.min((page + 1) * PAGE_SIZE, total)

  return (
    <div className="space-y-6">
      {/* ── Filter row ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('admin.workspaces.search')}
            aria-label={t('admin.workspaces.search')}
            className="h-11 w-full rounded-xl ps-9"
          />
        </div>

        <div
          role="group"
          aria-label={t('admin.filters.groupLabel')}
          className="flex flex-wrap items-center gap-2"
        >
          {filters.map((filter) => (
            <Button
              key={filter.id}
              size="sm"
              variant={activity === filter.id ? 'default' : 'outline'}
              onClick={() => setActivity(filter.id)}
            >
              {filter.label}
              <span className="ms-1.5 tabular-nums opacity-70">
                {filter.count.toLocaleString()}
              </span>
            </Button>
          ))}
          {isFetching && !isLoading && (
            <span role="status" className="text-sm text-muted-foreground">
              {t('app.loading')}
            </span>
          )}
        </div>
      </div>

      {(authLoading || isLoading) && (
        <div className="space-y-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {isError && !isLoading && (
        <ErrorState message={t('admin.error.loadWorkspaces')} onRetry={() => void refetch()} />
      )}

      {!isLoading && !isError && workspaces.length === 0 && (
        <EmptyState
          title={
            debounced
              ? t('admin.empty.noResults', { search: debounced })
              : t('admin.empty.noWorkspaces')
          }
          description={debounced ? undefined : t('admin.empty.noWorkspacesHint')}
        />
      )}

      {!isLoading && !isError && workspaces.length > 0 && visible.length === 0 && (
        <EmptyState
          title={t('admin.empty.noneOnPage')}
          description={t('admin.empty.noneOnPageHint')}
        />
      )}

      {visible.length > 0 && (
        <ul className="space-y-3">
          {visible.map((workspace) => (
            <WorkspaceRow key={workspace.id} workspace={workspace} onOpen360={onOpen360} />
          ))}
        </ul>
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
