'use client'

// ============================================
// The tab bar of a hub page — ONE component for every hub.
//
// A hub is a page that holds several screens of one job behind tabs
// («فروش و خرید»، «انبار»، …). Each hub used to draw its own bar; they drifted.
// This is the bar: as wide as its items, centred, soft-square corners.
//
// `useHubTab` keeps the tab in the address (`?tab=`), so a tab can be linked,
// bookmarked and reached with the back button. The first tab is the page
// itself and carries no parameter.
//
// Use both for any new hub. Do not draw another tab bar.
// ============================================

import { useCallback, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'

import { cn } from '../../lib/utils'
import { HubBranchStrip } from './hub-branch'

export interface HubTabItem<T extends string> {
  id: T
  label: string
  icon?: LucideIcon | undefined
}

export interface HubTabsProps<T extends string> {
  /** What the group of tabs is, for a screen reader. */
  label: string
  items: readonly HubTabItem<T>[]
  active: T
  onSelect: (id: T) => void
}

export function HubTabs<T extends string>({ label, items, active, onSelect }: HubTabsProps<T>) {
  const bar = useRef<HTMLDivElement>(null)
  // One tab is not a choice.
  if (items.length < 2) return null

  return (
    <div data-hub-tabs="">
      // Centred, and only as wide as its items; it scrolls sideways on a narrow // screen instead
      of wrapping.
      <nav aria-label={label} className="flex justify-center overflow-x-auto">
        <div
          ref={bar}
          role="tablist"
          className="flex w-fit gap-1 rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted)/0.5)] p-1"
        >
          {items.map((item) => {
            const Icon = item.icon
            const selected = item.id === active
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => onSelect(item.id)}
                className={cn(
                  'inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-sm)] px-[clamp(0.625rem,3vw,1rem)] text-[clamp(0.75rem,3.2vw,0.875rem)]',
                  'transition-colors motion-reduce:transition-none',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary)/0.5)]',
                  selected
                    ? 'bg-[hsl(var(--surface-elevated))] font-medium text-[hsl(var(--fg-primary))] shadow-sm'
                    : 'text-[hsl(var(--fg-secondary))] hover:text-[hsl(var(--fg-primary))]',
                )}
              >
                {Icon ? <Icon className="size-4 shrink-0" aria-hidden="true" /> : null}
                {item.label}
              </button>
            )
          })}
        </div>
      </nav>
      {/* The selected tab's own switch is drawn here, joined to it by lines
          (`<SegmentedControl branch />`). Nothing is drawn when there is none. */}
      <HubBranchStrip tabs={bar} />
    </div>
  )
}

/**
 * One choice kept in the address: read from `?<param>=`, written back on select.
 *
 * `offered` is what this person may open — a value named in the address but not
 * offered (unknown, or locked for them) falls back to the first one. The first
 * one is the page itself and carries no parameter. `clears` are parameters that
 * only meant something under the previous choice and go with it.
 */
function useAddressChoice<T extends string>(
  param: string,
  offered: readonly T[],
  clears: readonly string[],
): [T, (value: T) => void] {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const asked = searchParams.get(param)
  const first = offered[0] as T
  const active = offered.find((value) => value === asked) ?? first

  const select = useCallback(
    (value: T) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const stale of clears) params.delete(stale)
      if (value === first) params.delete(param)
      else params.set(param, value)
      const query = params.toString()
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [clears, first, param, pathname, router, searchParams],
  )

  return [active, select]
}

/** A section belongs to its tab: leaving the tab leaves the section. */
const TAB_CLEARS = ['view'] as const
const NO_CLEARS: readonly string[] = []

/** The active tab of a hub, in `?tab=`. */
export function useHubTab<T extends string>(offered: readonly T[]): [T, (tab: T) => void] {
  return useAddressChoice('tab', offered, TAB_CLEARS)
}

/**
 * The section shown inside a tab, in `?view=` — the address half of a
 * `SegmentedControl` that swaps one part of a page for another. Pass `clears`
 * (a module-level constant) for parameters that only one section understands.
 */
export function useHubSection<T extends string>(
  offered: readonly T[],
  clears: readonly string[] = NO_CLEARS,
): [T, (section: T) => void] {
  return useAddressChoice('view', offered, clears)
}
