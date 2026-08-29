'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { LogOut, Moon, Sun, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ADMIN_NAV, activeNavItem, localeOf } from './admin-nav'
import type { AdminTheme } from './use-admin-theme'

/**
 * The admin sidebar.
 *
 * NOT `@hisabche/ui`'s `DashboardSidebar`. That component is the shopkeeper
 * app's navigation: it reads `useAuthStore`, renders a workspace switcher, and
 * resolves its icons from a fixed `ICON_PATHS` map keyed by the web app's own
 * nav ids — `workspaces` and `subscriptions` are not in it, so admin items
 * rendered with NO icon at all. The admin console is a different information
 * architecture in a different security domain, so it gets its own chrome.
 *
 * What is deliberately NOT duplicated is the design *system*: every button,
 * badge and surface below is a token or a `@hisabche/ui` primitive. The
 * historical drift in this app was a local copy of `Button`, not a local
 * layout.
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
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 text-base font-bold text-white"
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
            className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 lg:hidden"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* ── Navigation ────────────────────────────────────────────────── */}
      <nav aria-label={t('admin.shell.mainNav')} className="min-h-0 flex-1 overflow-y-auto p-3">
        <ul className="space-y-1">
          {ADMIN_NAV.map((item) => {
            const Icon = item.icon
            const isActive = active?.id === item.id
            return (
              <li key={item.id}>
                <Link
                  href={`/${locale}${item.path}`}
                  onClick={onClose}
                  // `aria-current` is what a screen reader announces; the blue
                  // fill is only the sighted half of the same statement.
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-card',
                    isActive
                      ? 'bg-blue-500/15 text-blue-400'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{t(item.titleKey)}</span>
                  {/* The indicator sits on the inline-END edge — `ms-auto`, not
                      `ml-auto`, so it stays beside the label in RTL. */}
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="ms-auto h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500"
                    />
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* ── Operator ──────────────────────────────────────────────────── */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 rounded-xl bg-accent/60 p-2.5">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-blue-500 text-sm font-bold text-white"
          >
            {initialOf(email)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold leading-tight">
              {t('admin.shell.superAdmin')}
            </span>
            {/* The real signed-in identity, never a placeholder name. If the
                session has no email the line is omitted rather than invented. */}
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
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
          className="mt-2 flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
