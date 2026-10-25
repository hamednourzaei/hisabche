'use client'

import { useCallback, useState, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui'
import { AdminHeader } from '@/components/admin-shell/admin-header'
import { AdminSidebar } from '@/components/admin-shell/admin-sidebar'
import { CommandPalette } from '@/components/admin-shell/command-palette'
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
 *
 * The mobile drawer is the shared `Sheet` (Radix Dialog), which supplies the
 * focus trap, Esc, scroll lock and `aria-modal` that the previous `<div>`
 * overlay did not. Its own close button is hidden because it carries a
 * hardcoded Persian label; the sidebar renders a translated one instead.
 */
export default function AdminDashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations()
  const { session } = useAdminSession()
  const { theme, toggle } = useAdminTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)

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
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-[var(--z-cmdk)] focus:rounded-[var(--radius-sm)] focus:bg-[hsl(var(--surface-elevated))] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-[hsl(var(--fg-primary))] focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {t('admin.shell.skipToContent')}
      </a>

      {/* Permanent rail from `lg` up. It sticks to the viewport the way the
          header does: the rail's own height is the viewport, so only its nav
          scrolls, and the brand and the operator block never leave the screen.
          `self-start` stops the flex container from stretching it. */}
      <div className="sticky top-0 z-sticky hidden h-dvh shrink-0 self-start lg:block">
        <AdminSidebar
          pathname={pathname}
          email={session?.email ?? null}
          theme={theme}
          onToggleTheme={toggle}
          onSignOut={handleSignOut}
        />
      </div>

      {/* Mobile drawer: mounted only while open, so its links stay out of the
          tab order when it is closed. Radix handles the trap and Esc. */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent
          id="admin-mobile-nav"
          side="start"
          showCloseButton={false}
          aria-describedby={undefined}
          className="w-72 max-w-[85vw] p-0"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{t('admin.shell.menuDialog')}</SheetTitle>
          </SheetHeader>
          <AdminSidebar
            pathname={pathname}
            email={session?.email ?? null}
            theme={theme}
            onToggleTheme={toggle}
            onSignOut={handleSignOut}
            onClose={() => setMenuOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <AdminHeader
          pathname={pathname}
          menuOpen={menuOpen}
          onOpenMenu={() => setMenuOpen(true)}
          onOpenCommand={() => setPaletteOpen(true)}
        />
        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
        <main
          id="admin-main"
          tabIndex={-1}
          className="min-w-0 flex-1 p-4 focus:outline-none sm:p-6 lg:p-8"
        >
          <div className="mx-auto w-full max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  )
}
