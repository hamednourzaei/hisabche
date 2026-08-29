'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'
import { Info, Search } from 'lucide-react'
import { Button, Input } from '@/components/ui'
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
  Pagination,
  Panel,
} from '@/components/admin-shell/admin-ui'
import { useAdminSession } from '@/hooks/use-admin-session'
import { useAdminUsers } from '@/hooks/use-admin-users'

const PAGE_SIZE = 20

/**
 * The platform user directory.
 *
 * Read-only by design. This backend exposes no user mutation an admin console
 * may perform: there is no endpoint to create, suspend or delete an account,
 * and the membership capability explicitly never touches `auth.users`. So this
 * screen lists and it searches — it offers no action it cannot carry out.
 *
 * Membership editing lives on the workspace screen, which is where the
 * endpoints actually are.
 */
export function UsersClient() {
  const t = useTranslations()
  const router = useRouter()
  const pathname = usePathname()
  const { loading: authLoading, error: authError } = useAdminSession()

  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [page, setPage] = useState(0)

  const localePrefix = pathname.split('/').filter(Boolean)[0] || 'fa'

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search)
      setPage(0)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data, isLoading, isError, isFetching, refetch } = useAdminUsers({
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

  const users = data?.users ?? []
  const total = data?.total ?? 0

  return (
    <div className="space-y-6">
      {/* The one thing an operator must know before typing. See the hook. */}
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

      {(authLoading || isLoading) && <ListSkeleton rows={6} height="h-16" />}

      {isError && !isLoading && (
        <ErrorState message={t('admin.users.loadError')} onRetry={() => void refetch()} />
      )}

      {!isLoading && !isError && users.length === 0 && (
        <EmptyState
          title={
            debounced ? t('admin.empty.noResults', { search: debounced }) : t('admin.users.empty')
          }
          {...(debounced ? { hint: t('admin.users.searchScopeNotice') } : {})}
        />
      )}

      {users.length > 0 && (
        <Panel className="overflow-hidden">
          {/* Desktop: a real table with a header row.
              Mobile: the same <li> content reflowed to a card. The table
              header is hidden below `sm` rather than horizontally scrolled,
              because a two-column identity list has nothing worth scrolling. */}
          <div
            className="hidden grid-cols-[1fr_1fr] gap-4 border-b border-border bg-accent/40 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:grid"
            aria-hidden="true"
          >
            <span>{t('admin.member.name')}</span>
            <span>{t('admin.member.email')}</span>
          </div>

          <ul className="divide-y divide-border">
            {users.map((user) => (
              <li
                key={user.id}
                className="flex flex-col gap-1 px-5 py-4 sm:grid sm:grid-cols-[1fr_1fr] sm:items-center sm:gap-4"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/25 to-violet-500/25 text-xs font-bold text-blue-400"
                  >
                    {initialOf(user.full_name ?? user.email)}
                  </span>
                  <span className="min-w-0 truncate font-medium">
                    {/* No placeholder name and no truncated uuid: a user with
                        no profile row is a real state, and saying so is more
                        useful than inventing an identity. */}
                    {user.full_name ?? t('admin.member.noProfile')}
                  </span>
                </span>
                {/* `dir="ltr"` + `text-start`: an email is Latin text and must
                    not be bidi-reordered inside a Persian page. */}
                <span
                  dir="ltr"
                  className="min-w-0 truncate text-start text-sm text-muted-foreground"
                >
                  {user.email ?? '—'}
                </span>
              </li>
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

function initialOf(value: string | null): string {
  const first = value?.trim().charAt(0)
  return first ? first.toUpperCase() : '—'
}
