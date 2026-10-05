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
import { isNavLocked } from '@hisabche/ui-contract'

import { HubTabs, useHubSection, useHubTab } from './hub-tabs'
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

export function PageHub({ label, sectionsLabel, loadingLabel, tabs }: PageHubProps) {
  const blocked = useMyCapabilities().data?.blockedModules ?? []
  const offered = offeredHubTabs(tabs, blocked)
  const [activeId, select] = useHubTab(offered.map((tab) => tab.id))
  const active = offered.find((tab) => tab.id === activeId) ?? offered[0]
  const sections = active?.sections ?? []
  const [sectionId, selectSection] = useHubSection(sections.map((section) => section.id))
  const section = sections.find((candidate) => candidate.id === sectionId) ?? sections[0]

  return (
    <div className="space-y-4">
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
