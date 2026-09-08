'use client'

// ============================================
// apps/web/app/[lang]/docs/docs-shell.tsx
//
// The chrome around the documentation.
//
// ⚠️ THE DOCS HAD NO HEADER AND NO FOOTER AT ALL.
//
// This route sits outside both the (dashboard) group and the marketing layout,
// so it inherited neither. A reader who arrived from a search result landed on
// a page with no way back to anything — no logo, no navigation, no footer, and
// no browser history to go back to either.
//
// Which chrome depends on who is reading:
//
//   signed out  the header's `landing` variant and `SiteFooter` — the same
//               frame as every other public page, so the docs read as part of
//               the site rather than an orphan
//   signed in   the dashboard header, so a person who opened the docs from the
//               «؟» beside a page title keeps their search, language and theme
//               controls exactly where they were
//
// ⚠️ THE AUTH CHECK RUNS AFTER MOUNT, ON PURPOSE. The session lives in
// `localStorage`, which the server cannot read: deciding on the server would
// render one header and hydrate another, and React would throw away the tree.
// Until it is known, neither header renders and the space they occupy is held
// open — see `HEADER_HEIGHT`.
// ============================================

import { useEffect, useState } from 'react'

import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'

import { DashboardHeader, SiteFooter } from '@hisabche/ui'
import { useAuthStore, useThemeStore } from '@hisabche/store'

/** Matches the header both variants render, so nothing jumps when one arrives. */
const HEADER_HEIGHT = 'h-16'

export function DocsShell({ children }: { children: React.ReactNode }) {
  const translate = useTranslations()

  /**
   * ⚠️ NON-THROWING, AND IT TAKES A FALLBACK.
   *
   * `next-intl`'s `t()` throws on a missing key, and `SiteFooter` calls it as
   * `t(key, fallback)` — passing `translate` straight in would both mistype
   * the second argument (next-intl reads it as interpolation values) and turn
   * one absent footer string into a 500 on every documentation page.
   */
  const t = (key: string, fallback?: string): string => {
    try {
      const value = translate(key as Parameters<typeof translate>[0])
      return value && value !== key ? value : (fallback ?? key)
    } catch {
      return fallback ?? key
    }
  }
  const locale = useLocale()
  const router = useRouter()

  const user = useAuthStore((s) => s.user)
  const isDark = useThemeStore((s) => s.isDark)
  const toggleTheme = useThemeStore((s) => s.toggle)

  // `undefined` = not known yet. Distinct from «signed out», because the two
  // render different things and guessing produces a hydration mismatch.
  const [signedIn, setSignedIn] = useState<boolean | undefined>(undefined)
  useEffect(() => setSignedIn(Boolean(useAuthStore.getState().user)), [user])

  function toggleLang(next: string) {
    if (next === locale) return
    const path = window.location.pathname.replace(/^\/(fa|af|en)(?=\/|$)/, '') || '/'
    document.cookie = `NEXT_LOCALE=${next};path=/;max-age=31536000;samesite=lax`
    router.push(`/${next}${path}`)
  }

  return (
    <div className="flex min-h-screen flex-col bg-[hsl(var(--surface-base))]">
      {signedIn === undefined ? (
        // Reserved space, not a spinner. A spinner in a header bar is more
        // distracting than the bar simply arriving.
        <div className={`${HEADER_HEIGHT} border-b border-[hsl(var(--border-default))]`} />
      ) : signedIn ? (
        <DashboardHeader
          variant="dashboard"
          appName={t('app.name')}
          currentLang={locale}
          isDark={isDark}
          signInLabel={t('auth.signIn')}
          signOutLabel={t('auth.signOut')}
          onToggleTheme={toggleTheme}
          onToggleLang={toggleLang}
          onLogout={() => {
            useAuthStore.getState().logout()
            router.replace(`/${locale}/login`)
          }}
          onNavigateLogin={() => router.push(`/${locale}/login`)}
        />
      ) : (
        /* ⚠️ NOT `TopNav`.
           `TopNav` is the LANDING PAGE's header: it calls `useNavigation()`
           and throws «must be used within NavigationProvider» outside it,
           which crashed this entire route to a blank page — the error boundary
           caught it and rendered nothing. The provider only exists inside
           `landing-page.tsx`, and its links are `#anchors` into landing
           sections that do not exist here, so wrapping the docs in it would
           have produced a header full of links to nowhere.

           `DashboardHeader`'s own `landing` variant needs no provider and is
           what a signed-out visitor should see: the mark, language, theme and
           a way to sign in. */
        <DashboardHeader
          variant="landing"
          appName={t('app.name')}
          currentLang={locale}
          isDark={isDark}
          signInLabel={t('auth.signIn')}
          signOutLabel={t('auth.signOut')}
          onToggleTheme={toggleTheme}
          onToggleLang={toggleLang}
          onNavigateLogin={() => router.push(`/${locale}/login`)}
        />
      )}

      {/* ── Back ──
          ⚠️ `router.back()` ONLY IF THERE IS SOMEWHERE TO GO BACK TO. Opening
          a docs link in a new tab, or arriving from Google, leaves a history
          of length 1 — `back()` there does nothing at all and the button reads
          as broken. The fallback is the app for a signed-in reader and the
          home page for a visitor, which is where «back» meant for each. */}
      <div className="border-b border-[hsl(var(--border-default))]">
        <div className="mx-auto flex w-full max-w-6xl px-4 py-2.5 sm:px-6">
          <button
            type="button"
            onClick={() => {
              if (window.history.length > 1) router.back()
              else router.push(signedIn ? `/${locale}/dashboard` : `/${locale}`)
            }}
            className={[
              'inline-flex min-h-[40px] items-center gap-2 rounded-lg px-3 text-sm',
              'text-[hsl(var(--fg-secondary))] transition-colors',
              'hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]',
            ].join(' ')}
          >
            {/* `rtl:rotate-180` — an arrow that means «back» points the way the
                reader came from, which is the opposite way in each direction. */}
            <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
            {t('action.back')}
          </button>
        </div>
      </div>

      <div className="flex-1">{children}</div>

      {/* The footer is the marketing one, and only for a visitor: inside the
          app the footer links (pricing, signup) point at pages a signed-in
          person has already passed through. */}
      {signedIn === false ? <SiteFooter t={t} localePrefix={locale} /> : null}
    </div>
  )
}
