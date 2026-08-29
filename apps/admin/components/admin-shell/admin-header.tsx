'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Bell, Menu, Search } from 'lucide-react'
import { Input } from '@/components/ui'
import { useAdminPastDue } from '@/hooks/use-admin-past-due'
import { activeNavItem, localeOf } from './admin-nav'

/**
 * The admin header: product name, page title, a search that actually searches,
 * and an alert bell backed by real data.
 *
 * The search box submits to the workspace list rather than pretending to be a
 * global index — `/admin/workspaces?search=` is the only text search this
 * backend exposes, and a box that silently searched nothing would be worse
 * than none. The label says so.
 */
export function AdminHeader({
  pathname,
  onOpenMenu,
}: {
  pathname: string
  onOpenMenu: () => void
}) {
  const t = useTranslations()
  const router = useRouter()
  const locale = localeOf(pathname)
  const active = activeNavItem(pathname)
  const [term, setTerm] = useState('')

  // A failed alert query must not blank the header. `data` simply stays
  // undefined and the bell renders with no badge.
  const { data } = useAdminPastDue()
  const alertCount = data?.subscriptions.length ?? 0

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const query = term.trim()
    router.push(`/${locale}/workspaces${query ? `?search=${encodeURIComponent(query)}` : ''}`)
  }

  return (
    <header className="sticky top-0 z-sticky flex h-16 shrink-0 items-center gap-3 border-b border-border bg-card/80 px-4 backdrop-blur-glass sm:px-6">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label={t('admin.shell.openMenu')}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 lg:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      {/* Page title. Sourced from ADMIN_NAV so the sidebar and the header can
          never disagree about what this screen is called. */}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-bold leading-tight sm:text-lg">
          {active ? t(active.titleKey) : t('app.name')}
        </h1>
        {active && (
          <p className="hidden truncate text-xs text-muted-foreground sm:block">
            {t(active.descriptionKey)}
          </p>
        )}
      </div>

      <form onSubmit={submit} role="search" className="hidden md:block">
        <label htmlFor="admin-header-search" className="sr-only">
          {t('admin.shell.searchLabel')}
        </label>
        <div className="relative">
          {/* `start-3` — the icon belongs on the reading-start edge, which is
              the RIGHT in Persian. `left-3` would put it under the text. */}
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="admin-header-search"
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder={t('admin.shell.searchPlaceholder')}
            className="h-11 w-56 rounded-xl ps-9 lg:w-72"
          />
        </div>
      </form>

      <button
        type="button"
        onClick={() => router.push(`/${locale}/subscriptions?status=past_due`)}
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-label={
          alertCount > 0
            ? t('admin.shell.alertsWithCount', { count: alertCount })
            : t('admin.shell.alertsNone')
        }
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {alertCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 end-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold tabular-nums text-destructive-foreground"
          >
            {/* Digits follow the reader's locale — a Persian console must not
                print Latin numerals. The overflow marker caps the badge at 99
                without hardcoding a digit glyph for any one language. */}
            {Math.min(alertCount, 99).toLocaleString()}
            {alertCount > 99 ? '+' : ''}
          </span>
        )}
      </button>
    </header>
  )
}
