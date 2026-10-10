'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

// ⚠️ MUST MATCH the menu in landing-shell.tsx. The section observer ignores any
// id not listed here — after the landing was restructured the list still named
// pain/transform/testimonials, so «حسابداری», «آفلاین» and «امنیت» never lit up
// (guard: landing-i18n-keys.test.ts › landing section menu).
export type SectionId = 'hero' | 'features' | 'offline' | 'security'

export type NarrativeState =
  'frustration' | 'confusion' | 'clarity' | 'confidence' | 'trust' | 'action'

interface SectionMeta {
  readonly y: number
  readonly narrative: NarrativeState
}

interface ScrollState {
  readonly progress: number
  readonly activeSection: SectionId
  readonly narrativeState: NarrativeState
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SECTION_MAP = {
  hero: { y: 0.05, narrative: 'frustration' },
  features: { y: 0.2, narrative: 'confusion' },
  offline: { y: 0.6, narrative: 'clarity' },
  security: { y: 0.8, narrative: 'trust' },
} as const satisfies Record<SectionId, SectionMeta>

export const VALID_SECTION_IDS = Object.keys(SECTION_MAP) as SectionId[]

/**
 * The six moods, as CSS custom properties rather than literals.
 *
 * These were six raw hex values (frustration #A855F7 … action #EC4899) and the
 * colour guard carried a standing exemption for this file, because the
 * stylesheet had no token to put them in and `--color-purple` is an alias of
 * `--color-primary` — mapping them onto what existed would have collapsed four
 * of the six to the same teal and flattened the arc. `--narrative-*` now
 * exists in globals.css for both themes, so the exemption is gone.
 *
 * The value is a Tailwind arbitrary class, not an hsl() string: callers
 * already write `bg-[...]`, and interpolating a colour string there is what
 * put hex into className in the first place.
 */
export const NARRATIVE_COLOR_CLASS: Record<NarrativeState, string> = {
  frustration: 'hsl(var(--narrative-frustration))',
  confusion: 'hsl(var(--narrative-confusion))',
  clarity: 'hsl(var(--narrative-clarity))',
  confidence: 'hsl(var(--narrative-confidence))',
  trust: 'hsl(var(--narrative-trust))',
  action: 'hsl(var(--narrative-action))',
}

const INITIAL_STATE: ScrollState = {
  progress: 0,
  activeSection: 'hero',
  narrativeState: 'frustration',
}

// ─── Type Guards ──────────────────────────────────────────────────────────────

export function isSectionId(value: string): value is SectionId {
  return (VALID_SECTION_IDS as string[]).includes(value)
}

// ─── Singleton Store ──────────────────────────────────────────────────────────

let scrollState: ScrollState = INITIAL_STATE
let lastProgress = -1

const PROGRESS_MIN_DELTA = 0.003 // افزایش از 0.002 به 0.003
const SECTION_COOLDOWN_MS = 200 // افزایش از 150 به 200

const sectionListeners = new Set<(state: ScrollState) => void>()
const progressListeners = new Set<(progress: number) => void>()

function notifySection(): void {
  sectionListeners.forEach((l) => l(scrollState))
}

function notifyProgress(p: number): void {
  progressListeners.forEach((l) => l(p))
}

function applySection(section: SectionId): void {
  if (scrollState.activeSection === section) return

  const meta = SECTION_MAP[section]

  scrollState = {
    progress: scrollState.progress,
    activeSection: section,
    narrativeState: meta.narrative,
  }

  if (typeof document !== 'undefined') {
    document.body.setAttribute('data-active-section', section)
    document.body.setAttribute('data-narrative-state', meta.narrative)
  }

  notifySection()
}

// ─── Queue (RAF-aligned) ─────────────────────────────────────────────────────

interface QueueState {
  pending: SectionId | null
  isScheduled: boolean
  lastSection: SectionId | null
  lastTime: number
}

const queue: QueueState = {
  pending: null,
  isScheduled: false,
  lastSection: null,
  lastTime: 0,
}

function scheduleFlush(): void {
  if (queue.isScheduled) return
  queue.isScheduled = true

  requestAnimationFrame(() => {
    queue.isScheduled = false

    const target = queue.pending
    if (target === null) return

    queue.pending = null
    queue.lastSection = target
    queue.lastTime = Date.now()

    applySection(target)
  })
}

export function queueSetActiveSection(section: SectionId): void {
  if (queue.lastSection === section && Date.now() - queue.lastTime < SECTION_COOLDOWN_MS) {
    return
  }

  queue.pending = section
  scheduleFlush()
}

export function setActiveSection(section: SectionId): void {
  queue.pending = null
  queue.isScheduled = false
  applySection(section)
}

// ─── Scroll progress: one read per scroll, nothing when idle ─────────────────
//
// ⚠️ THIS WAS A requestAnimationFrame LOOP STARTED ON MOUNT. Both hooks called
// `startScrollLoop()` in their effect, and the stop timer was only armed by a
// scroll event — so on a page nobody scrolled the loop ran forever, and every
// 4th frame read `document.body.scrollHeight`. Reading a layout property while
// styles are dirty forces a synchronous layout: a headless Chrome profile at
// PageSpeed-like CPU speed attributed a 108 ms long frame (107 ms of it forced
// layout) to this callback, and PageSpeed reported "Forced reflow".
//
// Now: a passive scroll listener schedules at most ONE frame per burst; the
// page height comes from a ResizeObserver (delivered after layout, so reading
// it forces nothing); no work at all while the page is still.

let maxScroll = 0
let frameScheduled = false
let resizeObserver: ResizeObserver | null = null
let consumers = 0

function measureMaxScroll(): void {
  maxScroll = document.documentElement.scrollHeight - window.innerHeight
}

function publishProgress(): void {
  frameScheduled = false
  const raw = maxScroll > 0 ? window.scrollY / maxScroll : 0
  const progress = Math.min(1, Math.max(0, raw))
  if (Math.abs(progress - lastProgress) > PROGRESS_MIN_DELTA) {
    lastProgress = progress
    scrollState = { ...scrollState, progress }
    notifyProgress(progress)
  }
}

function onPassiveScroll(): void {
  if (frameScheduled) return
  frameScheduled = true
  requestAnimationFrame(publishProgress)
}

function attachScrollTracking(): void {
  consumers++
  if (consumers > 1 || typeof window === 'undefined') return
  window.addEventListener('scroll', onPassiveScroll, { passive: true })
  resizeObserver = new ResizeObserver(() => {
    // Layout is already done when this fires — the read is free.
    measureMaxScroll()
  })
  resizeObserver.observe(document.documentElement)
}

function detachScrollTracking(): void {
  consumers = Math.max(0, consumers - 1)
  if (consumers > 0) return
  window.removeEventListener('scroll', onPassiveScroll)
  resizeObserver?.disconnect()
  resizeObserver = null
}

// ─── React Hooks ──────────────────────────────────────────────────────────────

export function useScrollNarrative(): ScrollState {
  const [state, setState] = useState<ScrollState>(scrollState)

  useEffect(() => {
    setState(scrollState)

    const onSection = (s: ScrollState) => setState(s)
    const onProgress = (p: number) => {
      setState((prev) => ({ ...prev, progress: p }))
    }

    sectionListeners.add(onSection)
    progressListeners.add(onProgress)

    attachScrollTracking()

    return () => {
      sectionListeners.delete(onSection)
      progressListeners.delete(onProgress)
      detachScrollTracking()
    }
  }, [])

  return state
}

export function useActiveSection(): Pick<ScrollState, 'activeSection' | 'narrativeState'> {
  const [section, setSection] = useState(scrollState.activeSection)
  const [narrative, setNarrative] = useState(scrollState.narrativeState)

  useEffect(() => {
    const onSection = (s: ScrollState) => {
      setSection(s.activeSection)
      setNarrative(s.narrativeState)
    }

    sectionListeners.add(onSection)

    return () => {
      sectionListeners.delete(onSection)
    }
  }, [])

  return { activeSection: section, narrativeState: narrative }
}
