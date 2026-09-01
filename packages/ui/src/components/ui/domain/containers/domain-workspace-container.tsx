'use client'

// ============================================
// packages/ui/src/components/ui/domain/containers/domain-workspace-container.tsx
//
// Resolves a domain into the destinations this actor can actually reach.
//
// ⚠️ The visibility filter here is a COURTESY, not authorization. §1.8 — the
// routes behind each destination enforce their own capabilities server-side.
// All this avoids is offering somebody a door that will refuse to open.
// ============================================

import { memo, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { DOMAINS, NAV_CONTRACT, domainFor, type DomainId, type NavId } from '@hisabche/ui-contract'

import { DomainWorkspaceView, type DomainDestination } from '../domain-workspace-view'
import { WorkQueueContainer } from '../../work-queue/containers/work-queue-container'

export interface DomainWorkspaceContainerProps {
  /**
   * A raw string, not a `DomainId`.
   *
   * It arrives from a URL segment, and a URL is user input — a typo or a stale
   * bookmark must not be a crash. Validating HERE rather than in each app's
   * page means the two shells cannot disagree about what an unknown domain
   * does, and it keeps `@hisabche/ui-contract` off the desktop package's
   * dependency list, which does not carry it.
   */
  domain: string
  /**
   * Destinations this actor may see. Omit to show all of the domain's — the
   * honest default while no endpoint reports per-actor navigation rights,
   * since hiding a page nobody asked to hide would be a guess.
   */
  authorized?: readonly NavId[]
  onNavigate: (path: string) => void
}

export const DomainWorkspaceContainer = memo(function DomainWorkspaceContainer({
  domain,
  authorized,
  onNavigate,
}: DomainWorkspaceContainerProps) {
  const translate = useTranslations()
  const t = useCallback(
    (key: string, fallback?: string): string => {
      const value = translate(key as Parameters<typeof translate>[0])
      return value && value !== key ? value : (fallback ?? key)
    },
    [translate],
  )

  const isKnown = (DOMAINS as readonly string[]).includes(domain)
  const spec = isKnown ? domainFor(domain as DomainId) : null

  const destinations = useMemo<DomainDestination[]>(() => {
    if (!spec) return []
    return (
      spec.destinations
        .filter((nav) => authorized === undefined || authorized.includes(nav))
        .map((nav) => {
          const entry = NAV_CONTRACT.find((item) => item.id === nav)
          if (!entry) return null
          return {
            id: nav,
            labelKey: entry.labelKey,
            descriptionKey: entry.descriptionKey,
            path: entry.path,
            emoji: entry.emoji,
            isPrimary: spec.primaryActions.includes(nav),
          }
        })
        // A destination the contract no longer has is dropped rather than
        // rendered as a blank card. `shell.test.ts` fails first if that ever
        // happens, so this is the belt to that test's braces.
        .filter((destination): destination is DomainDestination => destination !== null)
    )
  }, [spec, authorized])

  // An unknown domain renders nothing rather than an error page: the sidebar
  // cannot produce one, so reaching this means a hand-edited URL.
  if (!spec) return null

  return (
    <DomainWorkspaceView
      t={t}
      domain={spec.id}
      titleKey={spec.labelKey}
      destinations={destinations}
      workQueue={<WorkQueueContainer capabilities={[]} onNavigate={onNavigate} />}
      onNavigate={onNavigate}
    />
  )
})

DomainWorkspaceContainer.displayName = 'DomainWorkspaceContainer'
