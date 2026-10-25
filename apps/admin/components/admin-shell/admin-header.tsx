'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Bell, Command as CommandIcon, Menu, Search } from 'lucide-react'
import { formatNumber, resolveIntlLocale } from '@hisabche/formatting'
import { Input, useLocalePush } from '@/components/ui'
import { useAdminPastDue } from '@/hooks/use-admin-past-due'
import { activeNavItem, localeOf } from './admin-nav'

/**
 * The admin header: hub title, workspace search, quick search and past-due alerts.
 * Design tokens only, RTL logical properties.
 */
export function AdminHeader({
  pathname,
  menuOpen,
  onOpenMenu,
  onOpenCommand,
}: {
  pathname: string
  menuOpen: boolean
  onOpenMenu: () => void
  onOpenCommand: () => void
}) {
  const t = useTranslations()
  const push = useLocalePush()
  const locale = localeOf(pathname)
  const intlLocale = resolveIntlLocale(locale)
  const active = activeNavItem(pathname)
  const [term, setTerm] = useState('')

  const { data } = useAdminPastDue()
  const alertCount = data?.subscriptions.length ?? 0

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const query = term.trim()
    push(`/customers?tab=workspaces${query ? `&search=${encodeURIComponent(query)}` : ''}`)
  }

  return (
    <header className="sticky top-0 z-sticky flex h-16 shrink-0 items-center gap-2 border-b border-border bg-card/80 px-4 backdrop-blur-glass sm:gap-3 sm:px-6">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label={t('admin.shell.openMenu')}
        aria-haspopup="dialog"
        aria-expanded={menuOpen}
        aria-controls="admin-mobile-nav"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      {/* Hub title sourced from ADMIN_NAV */}
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
            className="h-11 w-56 rounded-[var(--radius-md)] ps-9 lg:w-72"
          />
        </div>
      </form>

      <button
        type="button"
        onClick={onOpenCommand}
        aria-label={t('admin.command.open')}
        aria-haspopup="dialog"
        aria-keyshortcuts="Control+K Meta+K"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <CommandIcon className="h-5 w-5" aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={() => push('/revenue?tab=subscriptions&status=past_due')}
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={
          alertCount > 0
            ? t('admin.shell.alertsWithCount', { count: formatNumber(alertCount, intlLocale) })
            : t('admin.shell.alertsNone')
        }
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {alertCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 end-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-bold tabular-nums text-destructive-foreground"
          >
            {formatNumber(Math.min(alertCount, 99), intlLocale)}
            {alertCount > 99 ? '+' : ''}
          </span>
        )}
      </button>
    </header>
  )
}
