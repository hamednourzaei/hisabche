// packages/ui/src/components/ui/landing/landing-shell.tsx
'use client'

import { useCallback, useMemo } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { NavigationProvider } from '../../../hooks/menu/use-navigation-state'
import { TopNav } from '../navigation/top-nav'

// ─── Main LandingPage ──────────────────────────────────────────────────────

/**
 * Client shell of the landing: the section menu (NavigationProvider + TopNav) and
 * the page wrapper. The sections themselves arrive as `children` from the server
 * composition in landing-page.tsx, so they are never hydrated.
 *
 * «شروع کنید» (the CTA section) is not in the menu: the header already has the
 * «شروع رایگان» button, and the item duplicated it.
 */
export interface LandingShellProps {
  children: React.ReactNode
  backgroundClassName?: string
  className?: string
  hideNav?: boolean
  sections?: Array<{ id: string; label: string; narrative?: any }>
  customNav?: React.ReactNode
}

export function LandingShell({
  children,
  backgroundClassName,
  className,
  hideNav = false,
  sections,
  customNav,
}: LandingShellProps) {
  const t = useTranslations()
  const locale = useLocale()

  const safeT = useCallback(
    (key: string, fallback?: string) => {
      const result = t(key as Parameters<typeof t>[0])
      return result && result !== key ? result : (fallback ?? key)
    },
    [t],
  )

  const defaultSections = useMemo(
    () => [
      {
        id: 'hero' as const,
        label: safeT('landing.navHero', 'Home'),
        narrative: 'frustration' as const,
      },
      {
        id: 'features' as const,
        label: safeT('landing.navSystem', 'System'),
        narrative: 'confusion' as const,
      },
      {
        id: 'offline' as const,
        label: safeT('landing.navOffline', 'Offline'),
        narrative: 'confidence' as const,
      },
      {
        id: 'security' as const,
        label: safeT('landing.navTrust', 'Trust'),
        narrative: 'trust' as const,
      },
    ],
    [safeT],
  )

  const activeSections = sections ?? defaultSections

  return (
    <NavigationProvider sections={activeSections as any}>
      <div
        className={`min-h-screen overflow-x-clip ${
          backgroundClassName ?? 'bg-[hsl(var(--surface-base))]'
        } ${className ?? ''}`}
      >
        {!hideNav && (customNav ?? <TopNav variant="landing" localePrefix={locale} />)}

        <main>{children}</main>
      </div>
    </NavigationProvider>
  )
}
