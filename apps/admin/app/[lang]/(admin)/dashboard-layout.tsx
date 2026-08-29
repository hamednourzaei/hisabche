'use client'

import { useCallback, useState, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { AdminHeader } from '@/components/admin-shell/admin-header'
import { AdminSidebar } from '@/components/admin-shell/admin-sidebar'
import { localeOf } from '@/components/admin-shell/admin-nav'
import { useAdminTheme } from '@/components/admin-shell/use-admin-theme'
import { useAdminSession } from '@/hooks/use-admin-session'
import { createAdminSupabaseClient } from '@/lib/supabase-client'

/**
 * The admin console shell — one sidebar, one header, every screen.
 *
 * Replaces the shared `DashboardSidebar` / `DashboardHeader`, which are the
 * shopkeeper app's chrome: they render a sync pill, a workspace switcher and
 * an icon set keyed to the web app's nav ids (so `workspaces` and
 * `subscriptions` drew no icon), and their notification bell calls a
 * workspace-scoped endpoint that a platform admin gets 403 from.
 */
export default function AdminDashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations()
  const { session } = useAdminSession()
  const { theme, toggle } = useAdminTheme()
  const [menuOpen, setMenuOpen] = useState(false)

  const locale = localeOf(pathname)

  // The drawer closes on navigation because every nav Link inside it calls
  // `onClose` — not via an effect watching `pathname`. Same outcome, no
  // cascading render, and the close is tied to the action that causes it.
  const handleSignOut = useCallback(() => {
    // Actually END the session. The previous shell only pushed the login
    // route, so the Supabase session survived and any "sign out" was undone by
    // the next visit to /dashboard.
    void createAdminSupabaseClient()
      .auth.signOut()
      .finally(() => router.replace(`/${locale}/login`))
  }, [locale, router])

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Permanent rail from `lg` up. */}
      <div className="hidden lg:block">
        <AdminSidebar
          pathname={pathname}
          email={session?.email ?? null}
          theme={theme}
          onToggleTheme={toggle}
          onSignOut={handleSignOut}
        />
      </div>

      {/* Mobile drawer. Rendered only while open so its links stay out of the
          tab order when it is closed. */}
      {menuOpen && (
        <div className="fixed inset-0 z-modal lg:hidden">
          <button
            type="button"
            aria-label={t('admin.shell.closeMenu')}
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 h-full w-full bg-black/60"
          />
          <div className="absolute inset-y-0 start-0 h-full shadow-4">
            <AdminSidebar
              pathname={pathname}
              email={session?.email ?? null}
              theme={theme}
              onToggleTheme={toggle}
              onSignOut={handleSignOut}
              onClose={() => setMenuOpen(false)}
            />
          </div>
        </div>
      )}

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <AdminHeader pathname={pathname} onOpenMenu={() => setMenuOpen(true)} />
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  )
}
