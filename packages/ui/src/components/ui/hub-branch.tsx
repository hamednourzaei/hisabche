'use client'

// ============================================
// The switch that belongs to a hub's selected tab, and the lines that join
// them — ONE mechanism for every hub.
//
//        [ فاکتورها ]   قیمت و تخفیف
//           ╱  │  ╲
//      [ همه | فروش | خرید ]
//
// The switch sits in the middle of the page, directly under the tabs, and a
// line runs from the SELECTED tab to each of its choices. Select the other tab
// and the lines start from it instead, ending on that tab's own switch.
//
// How a screen takes part — one word:
//
//     <SegmentedControl branch … />
//
// `HubTabs` draws the strip and the slot under itself (`HubBranchStrip`), so
// every hub has them without wrapping anything. A `branch` switch finds the
// nearest slot above it and is drawn there (a portal): the component stays
// where its screen wrote it in the React tree — its state, its handlers and
// its translations do not move. With no tab bar above it, it renders in place.
//
// The lines are measured from the DOM, not computed from counts: the tab bar
// and the switch are each as wide as their words, in three languages and two
// directions, so nothing else knows where their centres are.
// ============================================

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

const SLOT = '[data-hub-branch-slot]'

/** Height of the strip the lines are drawn in. */
const STRIP = 28

interface Line {
  /** Centre of the selected tab, on the strip's top edge. */
  from: number
  /** Centre of one choice, on the strip's bottom edge. */
  to: number
  selected: boolean
}

function sameLines(a: readonly Line[], b: readonly Line[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (line, index) =>
        Math.abs(line.from - (b[index]?.from ?? NaN)) < 0.5 &&
        Math.abs(line.to - (b[index]?.to ?? NaN)) < 0.5 &&
        line.selected === b[index]?.selected,
    )
  )
}

/** A soft S from the tab down to the choice: leaves and arrives vertically. */
export function branchPath(from: number, to: number, height: number = STRIP): string {
  const bend = Math.round(height * 0.55)
  return `M ${from} 0 C ${from} ${bend} ${to} ${height - bend} ${to} ${height}`
}

/** One line per choice in the slot, from the bar's selected tab. */
function measureLines(bar: HTMLElement, canvas: SVGSVGElement, slot: HTMLElement): Line[] {
  const tab = bar.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
  const choices = [...slot.querySelectorAll<HTMLElement>('[role="radio"]')]
  if (!tab || choices.length === 0) return []
  const origin = canvas.getBoundingClientRect().left
  const centre = (element: HTMLElement) => {
    const box = element.getBoundingClientRect()
    return box.left + box.width / 2 - origin
  }
  const from = centre(tab)
  return choices.map((choice) => ({
    from,
    to: centre(choice),
    selected: choice.getAttribute('aria-checked') === 'true',
  }))
}

const LINE_MOTION = '[transition:d_200ms_ease,stroke_200ms_ease] motion-reduce:[transition:none]'

/**
 * The strip of lines and the slot for the switch — drawn by `HubTabs` under its
 * own bar. `tabs` is that bar: the line starts at ITS selected tab, so a tab
 * bar further down the page (a screen's own) is never mistaken for it.
 */
export function HubBranchStrip({ tabs }: { tabs: RefObject<HTMLElement | null> }) {
  const strip = useRef<SVGSVGElement>(null)
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  const [lines, setLines] = useState<readonly Line[]>([])

  useEffect(() => {
    const bar = tabs.current
    if (!bar || !slot) return
    // Everything that moves a centre: the page resizing, a word changing
    // length, another tab or choice being selected, the switch arriving.
    const measure = () => {
      const canvas = strip.current
      if (!canvas) return
      const next = measureLines(bar, canvas, slot)
      setLines((current) => (sameLines(current, next) ? current : next))
    }
    let frame = 0
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }
    const resize = new ResizeObserver(schedule)
    resize.observe(bar)
    resize.observe(slot)
    const mutation = new MutationObserver(schedule)
    const watch = {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['aria-selected', 'aria-checked'],
    }
    mutation.observe(bar, watch)
    mutation.observe(slot, watch)
    window.addEventListener('resize', schedule)
    schedule()
    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      mutation.disconnect()
      window.removeEventListener('resize', schedule)
    }
  }, [slot, tabs])

  return (
    <>
      {/* The strip keeps its height only while there are lines to draw: a tab
          with no switch of its own leaves no gap under the tabs. */}
      <svg
        ref={strip}
        aria-hidden="true"
        width="100%"
        height={lines.length > 0 ? STRIP : 0}
        className="block overflow-visible"
        data-hub-branch-lines={lines.length}
      >
        {/* The selected line is drawn last, so it lies over the others where
            they leave the tab together. */}
        {lines
          .map((line, index) => ({ line, index }))
          .sort((a, b) => Number(a.line.selected) - Number(b.line.selected))
          .map(({ line, index }) => (
            <path
              key={index}
              d={branchPath(line.from, line.to)}
              fill="none"
              strokeLinecap="round"
              strokeWidth={line.selected ? 2 : 1.5}
              className={
                line.selected
                  ? `stroke-[hsl(var(--color-primary))] ${LINE_MOTION}`
                  : `stroke-[hsl(var(--fg-tertiary)/0.45)] ${LINE_MOTION}`
              }
            />
          ))}
        {lines[0] ? (
          <circle
            cx={lines[0].from}
            cy={0}
            r={3}
            className="fill-[hsl(var(--color-primary))] [transition:cx_200ms_ease] motion-reduce:[transition:none]"
          />
        ) : null}
      </svg>
      {/* The middle of the page, whatever the width. */}
      <div ref={setSlot} className="flex justify-center empty:hidden" data-hub-branch-slot="" />
    </>
  )
}

/**
 * Where a `branch` switch is drawn.
 *
 * Give `anchor` to an element rendered where the switch was written; the slot
 * is the nearest one above it in the page — the tab bar that screen is under.
 *
 *   `null`       not looked for yet: render only the anchor. The server renders
 *                the same, so hydration agrees.
 *   `undefined`  there is no tab bar above (or `branch` is off): render in place.
 *   an element   draw the switch there.
 */
export function useNearestBranchSlot(enabled: boolean): {
  anchor: (node: HTMLElement | null) => void
  slot: HTMLElement | null | undefined
} {
  const [slot, setSlot] = useState<HTMLElement | null | undefined>(enabled ? null : undefined)

  const anchor = useCallback((node: HTMLElement | null) => {
    // Unmounting the anchor is not news about the slot.
    if (!node) return
    let found: HTMLElement | undefined
    for (let above = node.parentElement; above && !found; above = above.parentElement) {
      found = above.querySelector<HTMLElement>(SLOT) ?? undefined
    }
    setSlot(found)
  }, [])

  return { anchor, slot: enabled ? slot : undefined }
}
