'use client'

// ============================================
// apps/admin/components/admin-shell/tab-sections.tsx
//
// One switch under a hub tab, one section on the page (CLAUDE.md §0.6: tabs
// on top, ONE SegmentedControl under them, the section in `?view=`). Used
// where V63 added a second list to a tab — two lists stacked on one page is
// the shape the owner asked us not to draw.
//
// Composition only: the switch is `@hisabche/ui`'s SegmentedControl and the
// address is `useHubSection`. The first section is the tab's original view,
// so an old link without `?view=` lands where it always did.
// ============================================

import type { ReactNode } from 'react'

import { SegmentedControl, useHubSection } from '@/components/ui'

export interface TabSection<T extends string> {
  id: T
  label: string
  render: () => ReactNode
}

export function TabSections<T extends string>({
  label,
  sections,
}: {
  label: string
  sections: ReadonlyArray<TabSection<T>>
}) {
  const ids = sections.map((section) => section.id)
  const [active, setActive] = useHubSection<T>(ids)
  const current = sections.find((section) => section.id === active) ?? sections[0]

  return (
    <div className="space-y-5">
      <SegmentedControl
        label={label}
        value={current?.id ?? active}
        onChange={setActive}
        options={sections.map((section) => ({ value: section.id, label: section.label }))}
      />
      {current ? current.render() : null}
    </div>
  )
}
