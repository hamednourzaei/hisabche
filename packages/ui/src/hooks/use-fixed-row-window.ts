'use client'

import { useCallback, useState, type UIEvent } from 'react'

export interface RowWindowItem {
  index: number
  /** Offset from the top of the scrolled body, in px. */
  start: number
  size: number
}

export interface RowWindow {
  /** Put on the scrolling element. */
  onScroll: (event: UIEvent<HTMLElement>) => void
  /** Height of the full list, for the inner spacer. */
  totalSize: number
  /** The rows to draw: the visible ones plus `overscan` either side. */
  items: RowWindowItem[]
}

/**
 * Windowing for a list of FIXED-height rows inside a scroller no taller than
 * `viewportHeight` (13 Nov 2026). Replaces TanStack's `useVirtualizer` in the data
 * grid: that hook returns functions the React Compiler cannot memoize, so the whole
 * component was skipped. With fixed rows the window is plain arithmetic on the
 * scroll offset, kept in state by the scroll event — computed during render, with
 * no ref read and no measurement.
 *
 * A scroller shorter than `viewportHeight` only draws a few extra rows.
 */
export function useFixedRowWindow(
  count: number,
  rowHeight: number,
  viewportHeight: number,
  overscan = 10,
): RowWindow {
  const [scrollTop, setScrollTop] = useState(0)
  const onScroll = useCallback((event: UIEvent<HTMLElement>) => {
    setScrollTop(event.currentTarget.scrollTop)
  }, [])

  const first = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
  const last = Math.min(count - 1, Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan)
  const items: RowWindowItem[] = []
  for (let index = first; index <= last; index += 1) {
    items.push({ index, start: index * rowHeight, size: rowHeight })
  }
  return { onScroll, totalSize: count * rowHeight, items }
}
