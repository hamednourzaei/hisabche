// ============================================
// packages/ui/src/lib/fit-row.ts
//
// ⚠️ A ROW OF TABS OR PILLS NEVER SCROLLS SIDEWAYS (owner, 8 Nov 2026).
// «In no URL and no language may this row need a scroll — make the font
// smaller or change the word.» A CSS clamp guesses from the viewport; it cannot
// know that Dari labels are longer than English ones, or that a hub has four
// tabs. This measures the row itself and steps down — first the icons go,
// then the padding, then the type size — until it fits. Wrapping is still
// never allowed (one line per tab).
//
// The steps are CSS variables on the row; the items read them with their own
// defaults (`text-[length:var(--fit-font,…)]`), so a row that fits is drawn
// exactly as before.
// ============================================

import { useLayoutEffect, type RefObject } from 'react'

const KEYS = ['--fit-icon', '--fit-px', '--fit-font'] as const

export const FIT_LEVELS: readonly Partial<Record<(typeof KEYS)[number], string>>[] = [
  {},
  { '--fit-icon': 'none' },
  { '--fit-icon': 'none', '--fit-px': '0.375rem' },
  { '--fit-icon': 'none', '--fit-px': '0.3125rem', '--fit-font': '0.6875rem' },
  { '--fit-icon': 'none', '--fit-px': '0.25rem', '--fit-font': '0.625rem' },
  { '--fit-icon': 'none', '--fit-px': '0.1875rem', '--fit-font': '0.5625rem' },
]

/** Apply the first level at which `row` is no wider than the room it has. */
export function fitRow(row: HTMLElement): number {
  for (let level = 0; level < FIT_LEVELS.length; level++) {
    for (const key of KEYS) row.style.removeProperty(key)
    for (const [key, value] of Object.entries(FIT_LEVELS[level]!)) row.style.setProperty(key, value)
    if (row.scrollWidth <= row.clientWidth + 0.5) {
      row.dataset.fit = String(level)
      return level
    }
  }
  row.dataset.fit = String(FIT_LEVELS.length - 1)
  return FIT_LEVELS.length - 1
}

/**
 * Keep `ref`'s row fitted. `contentKey` changes when the labels do (another
 * language, another set of tabs), which re-measures.
 */
export function useFitRow(ref: RefObject<HTMLElement | null>, contentKey: string): void {
  useLayoutEffect(() => {
    const row = ref.current
    if (!row) return
    fitRow(row)
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => fitRow(row))
    observer.observe(row.parentElement ?? row)
    return () => observer.disconnect()
  }, [ref, contentKey])
}
