'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'
import { Button, Input } from '@/components/ui'
import {
  EmptyState,
  ErrorState,
  FilterPill,
  ListSkeleton,
  Pagination,
} from '@/components/admin-shell/admin-ui'

import { WorkspaceRow } from '@/components/workspaces/workspace-row'
import { useAdminSession } from '@/hooks/use-admin-session'
import { useAdminWorkspaces } from '@/hooks/use-admin-workspaces'

const PAGE_SIZE = 20

/** Client-side view filter over the loaded page — NOT a server filter. */
type ActivityFilter = 'all' | 'active' | 'inactive'

/**
 * Workspace management — the main admin surface.
 *
 * Server-side paging and search: `listWorkspaces` supports `search`, `limit`
 * and `offset`, so the browser never holds more than one page. Members are NOT
 * fetched here — each row requests its own on first expand, so the initial
 * render costs exactly one request no matter how many workspaces exist.
 */
export function WorkspacesClient() {
  const t = useTranslations()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { loading: authLoading, error: authError } = useAdminSession()

  // Seeded from `?search=` so the header's search box lands somewhere real.
  const initialSearch = searchParams.get('search') ?? ''
  const [search, setSearch] = useState(initialSearch)
  const [debounced, setDebounced] = useState(initialSearch)
  const [page, setPage] = useState(0)
  const [activity, setActivity] = useState<ActivityFilter>('all')

  const localePrefix = pathname.split('/').filter(Boolean)[0] || 'fa'

  // Debounced so typing does not fire a request per keystroke.
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

  // `is_active` has no server-side filter on `/admin/workspaces`, so this
  // narrows only what is already on screen. The count beside each pill says so
  // — it is the count IN THIS PAGE, never a claim about the platform. A pill
  // that silently filtered one page of twenty while looking global would
  // under-report, which on an admin console reads as "there are none".
  const visible =
    activity === 'all'
      ? workspaces
      : workspaces.filter((w) => w.is_active === (activity === 'active'))

  const activeCount = workspaces.filter((w) => w.is_active).length

  const filters: {
    id: ActivityFilter
    label: string
    count: number
    tone: 'positive' | 'negative' | 'neutral'
  }[] = [
    { id: 'all', label: t('admin.filters.all'), count: workspaces.length, tone: 'neutral' },
    { id: 'active', label: t('admin.workspaces.active'), count: activeCount, tone: 'positive' },
    {
      id: 'inactive',
      label: t('admin.workspaces.inactive'),
      count: workspaces.length - activeCount,
      tone: 'negative',
    },
  ]

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
            <FilterPill
              key={filter.id}
              selected={activity === filter.id}
              onClick={() => setActivity(filter.id)}
              tone={filter.tone}
            >
              {filter.label}
              <span className="tabular-nums opacity-70">{filter.count.toLocaleString()}</span>
            </FilterPill>
          ))}
          {/* Fetching, not loading: keepPreviousData keeps the current page on
              screen while the next one arrives, so this is the only signal that
              anything is in flight. */}
          {isFetching && !isLoading && (
            <span role="status" className="text-sm text-muted-foreground">
              {t('app.loading')}
            </span>
          )}
        </div>
      </div>

      {(authLoading || isLoading) && <ListSkeleton rows={6} />}

      {isError && !isLoading && (
        <ErrorState message={t('admin.error.loadWorkspaces')} onRetry={() => void refetch()} />
      )}

      {!isLoading && !isError && workspaces.length === 0 && (
        // An empty result is not an error and must not look like one.
        <EmptyState
          title={
            debounced
              ? t('admin.empty.noResults', { search: debounced })
              : t('admin.empty.noWorkspaces')
          }
          {...(debounced ? {} : { hint: t('admin.empty.noWorkspacesHint') })}
        />
      )}

      {!isLoading && !isError && workspaces.length > 0 && visible.length === 0 && (
        <EmptyState title={t('admin.empty.noneOnPage')} hint={t('admin.empty.noneOnPageHint')} />
      )}

      {visible.length > 0 && (
        <ul className="space-y-3">
          {visible.map((workspace) => (
            <WorkspaceRow key={workspace.id} workspace={workspace} />
          ))}
        </ul>
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
