'use client'

// ============================================
// A hub page, whole — ONE component for every hub that is «tabs on top, one
// switch under them, one screen at a time».
//
// /warehouse, /customers and /accounting each wrote this by hand; the pages
// that came after them describe themselves instead:
//
//   tabs       the few tabs across the top (the shared `HubTabs`, in `?tab=`)
//   sections   what a tab holds, behind the shared `SegmentedControl` (`?view=`)
//   source     the address a section used to live at — the key of its lock in
//              `NAV_MODULE`; a section locked for this person is not offered,
//              and a tab left with no section is not a tab
//   render     the container that owns that screen (usually `lazy`)
//
// ⚠️ A HUB FETCHES NOTHING. It mounts containers; it never re-implements one.
// ============================================

import { Suspense, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { useMyCapabilities } from '@hisabche/api'
import { useTranslations } from 'next-intl'
import { isNavLocked } from '@hisabche/ui-contract'

import { usePageLook } from '../../lib/page-look'
import { HubTabs, useHubSection, useHubTab } from './hub-tabs'
import { PageCustomizer } from './page-customizer'
import { SegmentedControl } from './segmented-control'

export interface PageHubSection {
  id: string
  label: string
  /** The page this section came from, for its module lock. */
  source?: string | undefined
  render: () => ReactNode
}

export interface PageHubTab {
  id: string
  label: string
  icon?: LucideIcon | undefined
  sections: readonly PageHubSection[]
}

export interface PageHubProps {
  /** Names the tab bar and the switch for assistive technology. */
  label: string
  sectionsLabel: string
  loadingLabel: string
  tabs: readonly PageHubTab[]
  /**
   * A stable name for this hub. With it, the hub shows the wrench and the
   * person may hide sections for themselves (lib/page-look): a hidden section
   * is not offered and its container is never mounted.
   */
  lookId?: string | undefined
}

/** The tabs this person may open, each with only the sections they may open. */
export function offeredHubTabs(
  tabs: readonly PageHubTab[],
  blockedModules: readonly string[],
): PageHubTab[] {
  return tabs
    .map((tab) => ({
      ...tab,
      sections: tab.sections.filter(
        (section) => !section.source || !isNavLocked(section.source, blockedModules),
      ),
    }))
    .filter((tab) => tab.sections.length > 0)
}

/** A section's id in the look: unique across the hub's tabs. */
export const hubLookId = (tabId: string, sectionId: string) => `${tabId}/${sectionId}`

export function PageHub({ label, sectionsLabel, loadingLabel, tabs, lookId }: PageHubProps) {
  const t = useTranslations()
  const blocked = useMyCapabilities().data?.blockedModules ?? []
  // Permission first: only what the person MAY open…
  const allowed = offeredHubTabs(tabs, blocked)
  const look = usePageLook(`hub:${lookId ?? 'none'}`)
  // …then their own choice among it. Never the other way round.
  const offered = lookId
    ? allowed
        .map((tab) => ({
          ...tab,
          sections: tab.sections.filter((section) => look.shows(hubLookId(tab.id, section.id))),
        }))
        .filter((tab) => tab.sections.length > 0)
    : allowed
  const [activeId, select] = useHubTab(offered.map((tab) => tab.id))
  const active = offered.find((tab) => tab.id === activeId) ?? offered[0]
  const sections = active?.sections ?? []
  const [sectionId, selectSection] = useHubSection(sections.map((section) => section.id))
  const section = sections.find((candidate) => candidate.id === sectionId) ?? sections[0]

  return (
    <div className="relative space-y-4">
      {lookId ? (
        <PageCustomizer
          className="absolute end-0 top-0.5 z-10"
          t={(key) => t(key)}
          groups={[
            {
              look,
              keepOne: true,
              items: allowed.flatMap((tab) =>
                tab.sections.map((section) => ({
                  id: hubLookId(tab.id, section.id),
                  label: tab.sections.length > 1 ? `${tab.label} — ${section.label}` : tab.label,
                })),
              ),
            },
          ]}
        />
      ) : null}
      <HubTabs
        label={label}
        items={offered.map((tab) => ({ id: tab.id, label: tab.label, icon: tab.icon }))}
        active={active?.id ?? ''}
        onSelect={select}
      />

      {/* A tab with one screen needs no switch. */}
      {sections.length > 1 && section ? (
        <SegmentedControl
          branch
          label={sectionsLabel}
          options={sections.map((candidate) => ({ value: candidate.id, label: candidate.label }))}
          value={section.id}
          onChange={selectSection}
        />
      ) : null}

      <div role="tabpanel">
        <Suspense
          fallback={
            <p role="status" className="p-4 text-sm text-[hsl(var(--fg-secondary))]">
              {loadingLabel}
            </p>
          }
        >
          {section ? section.render() : null}
        </Suspense>
      </div>
    </div>
  )
}
