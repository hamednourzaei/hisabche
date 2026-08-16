// ============================================
// Toolbar — the canonical web header, mounted in Electron.
//
// This was a 247-line reimplementation whose own header comment read "Matches
// Web header": it redrew the sync pill, the language selector, the theme toggle
// and the sign-out control that `DashboardHeader` already contains. Two
// renderings of one header, kept in step by hand.
//
// `DashboardHeader` takes all of that through props, so desktop passes its own
// state and renders the same component the browser does. What remains here is
// platform wiring only:
//
//   * the Electron drag region — a window affordance, not product UI, so it
//     wraps the header rather than being pushed into the canonical component
//   * react-router for sign-out navigation
//   * the desktop language store, which persists across Electron restarts
//   * the IPC-backed sync status
// ============================================

import React, { memo, useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { Search } from 'lucide-react'
import { DashboardHeader } from '@hisabche/ui'

import { useAuthStore, useCurrentUser } from '@/features/auth/auth.store'
import { useSyncStatus } from '@/features/sync/use-sync'
import { i18n, setDesktopLanguage, supportedLanguages, type SupportedLanguage } from '@/shared/i18n'
import { useUiStore } from '@/shared/stores/ui.store'

/**
 * Search entry point.
 *
 * Web opens a global search overlay; desktop opens its command palette, which
 * is the same intent through the desktop idiom. Passed as the header's
 * `searchSlot` so the button sits exactly where web puts it.
 */
const SearchTrigger = memo(function SearchTrigger() {
  const t = useTranslations()
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen)

  return (
    <button
      type="button"
      onClick={() => setPaletteOpen(true)}
      aria-label={t('search.placeholder' as never)}
      className="inline-flex size-9 items-center justify-center rounded-xl border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))] transition-colors hover:text-[hsl(var(--fg-primary))]"
    >
      <Search className="size-4" aria-hidden="true" />
    </button>
  )
})

export const Toolbar = memo(function Toolbar({ title }: { title: string }) {
  const t = useTranslations()
  const navigate = useNavigate()

  const { pendingCount, isOffline, isSyncing } = useSyncStatus()
  const user = useCurrentUser()
  const logout = useAuthStore((s) => s.logout)

  const { theme, setTheme } = useTheme()
  const isDark = theme === 'dark'
  const toggleTheme = useCallback(() => setTheme(isDark ? 'light' : 'dark'), [isDark, setTheme])

  const [lang, setLang] = useState<SupportedLanguage>(() => {
    // Read the active language on mount so the selector shows the value
    // initDesktopI18n() restored, before any user interaction.
    const initial = i18n.language as SupportedLanguage
    return initial && supportedLanguages.some((l) => l.code === initial) ? initial : 'fa-IR'
  })

  const handleLangChange = useCallback((next: string) => {
    const code = next as SupportedLanguage
    setLang(code)
    void setDesktopLanguage(code)
  }, [])

  const handleLogout = useCallback(() => {
    logout()
    navigate('/login')
  }, [logout, navigate])

  return (
    // The drag region is window chrome, so it wraps the canonical header
    // instead of leaking `WebkitAppRegion` into shared UI. Children re-enable
    // pointer interaction via `no-drag`, or every control would be unclickable.
    <div
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      className="shrink-0 [&_button]:![-webkit-app-region:no-drag] [&_a]:![-webkit-app-region:no-drag]"
    >
      <DashboardHeader
        variant="dashboard"
        appName={title}
        businessName={user?.businessName ?? ''}
        isOnline={!isOffline}
        isSyncing={isSyncing}
        pendingCount={pendingCount}
        currentLang={lang}
        isDark={isDark}
        signInLabel={t('auth.signIn' as never)}
        signOutLabel={t('auth.signOut' as never)}
        onToggleTheme={toggleTheme}
        onToggleLang={handleLangChange}
        onLogout={handleLogout}
        onNavigateLogin={() => navigate('/login')}
        searchSlot={<SearchTrigger />}
      />
    </div>
  )
})
