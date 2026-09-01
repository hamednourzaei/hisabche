'use client'

// ============================================
// packages/ui/src/components/ui/domain/domain-workspace-view.tsx
//
// PHASE 7 — a predictable way into each business domain.
//
// ---------------------------------------------------------------------------
// AN ENTRY POINT, NOT A SIXTH DASHBOARD
//
// §11 asks each domain for an overview, quick actions, a work queue and
// reports. The trap is reading that as "build four dashboards full of charts".
// A shopkeeper does not open Accounting to look at a donut; they open it
// because they know roughly what they want and cannot remember which page it
// is on.
//
// So this page is a MAP plus the real work queue. It invents no figures, adds
// no chart, and every card leads somewhere that already exists. What makes it
// worth having is that the same four destinations appear in the same order for
// everyone, which is what turns "somewhere in the menu" into muscle memory.
// ============================================

import { memo } from 'react'
import type { DomainId, NavId } from '@hisabche/ui-contract'

import {
  ActionButton,
  CapabilityHeader,
  CapabilityPage,
  EmptyState,
  Panel,
} from '../capability/capability-kit'

export interface DomainDestination {
  id: NavId
  labelKey: string
  descriptionKey: string
  path: string
  emoji: string
  isPrimary: boolean
}

export interface DomainWorkspaceViewProps {
  t: (key: string, fallback?: string) => string
  domain: DomainId
  titleKey: string
  destinations: readonly DomainDestination[]
  /** The real work queue, injected so this view stays free of data hooks. */
  workQueue?: React.ReactNode
  onNavigate: (path: string) => void
}

export const DomainWorkspaceView = memo(function DomainWorkspaceView({
  t,
  titleKey,
  destinations,
  workQueue,
  onNavigate,
}: DomainWorkspaceViewProps) {
  const primary = destinations.filter((destination) => destination.isPrimary)

  return (
    <CapabilityPage>
      <CapabilityHeader
        title={t(titleKey)}
        description={t(`${titleKey}_description`, '')}
        action={
          primary.length > 0 ? (
            <ActionButton onClick={() => onNavigate(primary[0]!.path)}>
              {t(primary[0]!.labelKey)}
            </ActionButton>
          ) : undefined
        }
      />

      {/* What needs doing comes before what exists. A person who opened this
          domain because something is wrong should not have to hunt for it. */}
      {workQueue}

      {destinations.length === 0 ? (
        // Not "this domain is empty" — the domain is fine; this person cannot
        // reach any of it. Saying so plainly beats an encouraging blank page
        // that implies the feature is missing.
        <EmptyState
          title={t('domain.no_access', 'دسترسی به این بخش ندارید')}
          description={t(
            'domain.no_access_hint',
            'از مالک کارگاه بخواهید دسترسی این بخش را برای شما باز کند.',
          )}
        />
      ) : (
        <Panel title={t('domain.destinations', 'بخش‌ها')}>
          <ul className="grid gap-2 sm:grid-cols-2">
            {destinations.map((destination) => (
              <li key={destination.id}>
                <button
                  type="button"
                  onClick={() => onNavigate(destination.path)}
                  className="flex w-full items-start gap-3 rounded-xl border border-[hsl(var(--border-default))] p-3 text-start transition-colors hover:bg-[hsl(var(--surface-muted))]"
                >
                  <span aria-hidden="true" className="text-lg leading-none">
                    {destination.emoji}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-[hsl(var(--fg-primary))]">
                      {t(destination.labelKey)}
                    </span>
                    <span className="block truncate text-xs text-[hsl(var(--fg-tertiary))]">
                      {t(destination.descriptionKey, '')}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </CapabilityPage>
  )
})

DomainWorkspaceView.displayName = 'DomainWorkspaceView'
