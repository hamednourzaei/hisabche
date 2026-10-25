'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { LogOut, Moon, Sun, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ADMIN_NAV, ADMIN_NAV_GROUPS, activeNavItem, localeOf } from './admin-nav'
import type { AdminTheme } from './use-admin-theme'

/**
 * The admin sidebar for the 8 control plane hubs.
 * Design tokens only (hsl(var(--...))), RTL logical properties.
 *
 * The eight links are grouped so the relationship between the hubs is visible
 * (customers + revenue, platform, governance) without hiding any of them: a
 * collapsible rail would cost a click for every navigation. Ids and order are
 * the guard-tested contract in `admin-nav.ts`.
 */
export function AdminSidebar({
  pathname,
  email,
  theme,
  onToggleTheme,
  onSignOut,
  /** Mobile drawer state. `undefined` on desktop, where the rail is permanent. */
  onClose,
}: {
  pathname: string
  email: string | null
  theme: AdminTheme
  onToggleTheme: () => void
  onSignOut: () => void
  onClose?: () => void
}) {
  const t = useTranslations()
  const locale = localeOf(pathname)
  const active = activeNavItem(pathname)

  return (
    <div className="flex h-full w-72 shrink-0 flex-col border-e border-border bg-card">
      {/* ── Brand ─────────────────────────────────────────────────────── */}
      <div className="flex h-16 items-center gap-3 border-b border-border px-5">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[hsl(var(--color-primary))] text-base font-bold text-[hsl(var(--color-primary-fg))]"
        >
          ح
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold leading-tight">{t('app.name')}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {t('admin.shell.consoleLabel')}
          </span>
        </span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t('admin.shell.closeMenu')}
            className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* ── Navigation ────────────────────────────────────────────────── */}
      <nav
        aria-label={t('admin.shell.mainNav')}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3"
      >
        {ADMIN_NAV_GROUPS.map((group) => {
          const items = ADMIN_NAV.filter((item) => item.group === group.id)
          if (items.length === 0) return null
          const headingId = `admin-nav-group-${group.id}`
          return (
            <div key={group.id} role="group" aria-labelledby={headingId} className="pb-2 last:pb-0">
              <p
                id={headingId}
                className="px-3 pb-1 pt-2 text-xs font-semibold text-muted-foreground"
              >
                {t(group.labelKey)}
              </p>
              <ul className="space-y-1">
                {items.map((item) => {
                  const Icon = item.icon
                  const isActive = active?.id === item.id
                  return (
                    <li key={item.id}>
                      <Link
                        href={`/${locale}${item.path}`}
                        onClick={onClose}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                          'flex min-h-[44px] items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card',
                          isActive
                            ? 'bg-[hsl(var(--color-primary)/0.12)] font-semibold text-[hsl(var(--color-primary))]'
                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                        )}
                      >
                        <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate">{t(item.titleKey)}</span>
                        {isActive && (
                          <span
                            aria-hidden="true"
                            className="ms-auto h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(var(--color-primary))]"
                          />
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </nav>

      {/* ── Operator ──────────────────────────────────────────────────── */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 rounded-[var(--radius-md)] bg-accent/60 p-2.5">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--color-primary)/0.2)] text-sm font-bold text-[hsl(var(--color-primary))]"
          >
            {initialOf(email)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold leading-tight">
              {t('admin.shell.superAdmin')}
            </span>
            {email && (
              <span dir="ltr" className="block truncate text-start text-xs text-muted-foreground">
                {email}
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={onToggleTheme}
            aria-pressed={theme === 'dark'}
            aria-label={t(theme === 'dark' ? 'admin.shell.lightMode' : 'admin.shell.darkMode')}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {theme === 'dark' ? (
              <Sun className="h-[18px] w-[18px]" aria-hidden="true" />
            ) : (
              <Moon className="h-[18px] w-[18px]" aria-hidden="true" />
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={onSignOut}
          className="mt-2 flex min-h-[44px] w-full items-center gap-3 rounded-[var(--radius-md)] px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <LogOut className="h-[18px] w-[18px] shrink-0 rtl:-scale-x-100" aria-hidden="true" />
          {t('auth.signOut')}
        </button>
      </div>
    </div>
  )
}

function initialOf(email: string | null): string {
  const first = email?.trim().charAt(0)
  return first ? first.toUpperCase() : '—'
}
