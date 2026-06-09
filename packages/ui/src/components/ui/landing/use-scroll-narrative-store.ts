"use client";

import { useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SectionId =
  | "hero"
  | "pain"
  | "transform"
  | "features"
  | "testimonials"
  | "cta";

export type NarrativeState =
  | "frustration"
  | "confusion"
  | "clarity"
  | "confidence"
  | "trust"
  | "action";

interface SectionMeta {
  readonly y: number;
  readonly narrative: NarrativeState;
}

interface ScrollState {
  readonly progress: number;
  readonly activeSection: SectionId;
  readonly narrativeState: NarrativeState;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SECTION_MAP = {
  hero:         { y: 0.05, narrative: "frustration" },
  pain:         { y: 0.2,  narrative: "confusion"   },
  transform:    { y: 0.4,  narrative: "clarity"     },
  features:     { y: 0.55, narrative: "confidence"  },
  testimonials: { y: 0.75, narrative: "trust"       },
  cta:          { y: 0.9,  narrative: "action"      },
} as const satisfies Record<SectionId, SectionMeta>;

export const VALID_SECTION_IDS = Object.keys(SECTION_MAP) as SectionId[];

export const NARRATIVE_COLORS: Record<NarrativeState, string> = {
  frustration: "#A855F7",
  confusion:   "#EF4444",
  clarity:     "#10B981",
  confidence:  "#06B6D4",
  trust:       "#8B5CF6",
  action:      "#EC4899",
};

const INITIAL_STATE: ScrollState = {
  progress:       0,
  activeSection:  "hero",
  narrativeState: "frustration",
};

// ─── Type Guards ──────────────────────────────────────────────────────────────

export function isSectionId(value: string): value is SectionId {
  return (VALID_SECTION_IDS as string[]).includes(value);
}

// ─── Singleton Store ──────────────────────────────────────────────────────────

let scrollState: ScrollState = INITIAL_STATE;

// Listeners split by concern: section listeners only fire on section change,
// progress listeners fire on scroll — keeps re-renders minimal.
const sectionListeners  = new Set<(state: ScrollState) => void>();
const progressListeners = new Set<(progress: number) => void>();

function notifySection(): void {
  sectionListeners.forEach((l) => l(scrollState));
}

function notifyProgress(p: number): void {
  progressListeners.forEach((l) => l(p));
}

function applySection(section: SectionId): void {
  if (scrollState.activeSection === section) return;

  const meta = SECTION_MAP[section];

  // Reuse the same progress value — no unnecessary spread on every call
  scrollState = {
    progress:       scrollState.progress,
    activeSection:  section,
    narrativeState: meta.narrative,
  };

  if (typeof document !== "undefined") {
    document.body.setAttribute("data-active-section", section);
    document.body.setAttribute("data-narrative-state", meta.narrative);
  }

  notifySection();
}

// ─── Queue (RAF-aligned, no setTimeout) ──────────────────────────────────────

interface QueueState {
  pending:     SectionId | null;
  isScheduled: boolean;
  lastSection: SectionId | null;
  lastTime:    number;
}

const queue: QueueState = {
  pending:     null,
  isScheduled: false,
  lastSection: null,
  lastTime:    0,
};

// Flush is now RAF-aligned instead of setTimeout — avoids timer pile-up
// during fast scroll bursts.
function scheduleFlush(): void {
  if (queue.isScheduled) return;
  queue.isScheduled = true;

  requestAnimationFrame(() => {
    queue.isScheduled = false;

    const target = queue.pending;
    if (target === null) return;

    queue.pending     = null;
    queue.lastSection = target;
    queue.lastTime    = Date.now();

    applySection(target);
  });
}

const SECTION_COOLDOWN_MS = 150; // min ms between same-section triggers

/**
 * Debounced section update — used by IntersectionObserver callbacks.
 * Collapses rapid-fire calls into one RAF-aligned state transition.
 */
export function queueSetActiveSection(section: SectionId): void {
  if (
    queue.lastSection === section &&
    Date.now() - queue.lastTime < SECTION_COOLDOWN_MS
  ) {
    return;
  }

  // Always overwrite with the latest — only the last one matters
  queue.pending = section;
  scheduleFlush();
}

/**
 * Immediate section update — used for navbar clicks / programmatic navigation.
 * Cancels any pending queued update.
 */
export function setActiveSection(section: SectionId): void {
  queue.pending     = null;
  queue.isScheduled = false;

  applySection(section);
}

// ─── RAF scroll-progress loop ─────────────────────────────────────────────────
// Runs on a SINGLE shared RAF loop — not one per listener.
// Progress updates are throttled to meaningful deltas only.

let rafId:          number | null = null;
let lastProgress:   number        = -1;
let frameCount:     number        = 0;

// Throttle: only broadcast progress every N frames.
// At 60fps → every 3 frames = ~50ms updates. Smooth but not overwhelming.
const PROGRESS_FRAME_SKIP   = 3;
const PROGRESS_MIN_DELTA    = 0.002; // 0.2% of page height

function scrollLoop(): void {
  frameCount++;

  if (frameCount % PROGRESS_FRAME_SKIP === 0) {
    const maxScroll = document.body.scrollHeight - window.innerHeight;
    const raw       = maxScroll > 0 ? window.scrollY / maxScroll : 0;
    const progress  = Math.min(1, Math.max(0, raw));

    if (Math.abs(progress - lastProgress) > PROGRESS_MIN_DELTA) {
      lastProgress = progress;
      // Update state object in-place — only progress changed
      scrollState  = { ...scrollState, progress };
      notifyProgress(progress);
    }
  }

  rafId = requestAnimationFrame(scrollLoop);
}

function startScrollLoop(): void {
  if (rafId !== null || typeof window === "undefined") return;
  frameCount = 0;
  rafId = requestAnimationFrame(scrollLoop);
}

function stopScrollLoop(): void {
  if (rafId === null) return;
  cancelAnimationFrame(rafId);
  rafId = null;
}

// ─── React Hooks ──────────────────────────────────────────────────────────────

/**
 * Full scroll state — activeSection + narrativeState + progress.
 * Re-renders on BOTH section changes AND progress changes.
 * Use only when you need the progress value.
 */
export function useScrollNarrative(): ScrollState {
  const [state, setState] = useState<ScrollState>(scrollState);

  useEffect(() => {
    // Sync in case state changed between render and mount
    setState(scrollState);

    const onSection  = (s: ScrollState) => setState(s);
    const onProgress = (p: number) =>
      setState((prev) => (prev.progress === p ? prev : { ...prev, progress: p }));

    sectionListeners.add(onSection);
    progressListeners.add(onProgress);
    startScrollLoop();

    return () => {
      sectionListeners.delete(onSection);
      progressListeners.delete(onProgress);
      if (sectionListeners.size === 0 && progressListeners.size === 0) {
        stopScrollLoop();
      }
    };
  }, []);

  return state;
}

/**
 * Section-only state — does NOT re-render on scroll progress.
 * Prefer this for navbar, indicators, and anything that only cares about
 * which section is active.
 */
export function useActiveSection(): Pick<ScrollState, "activeSection" | "narrativeState"> {
  const [section,  setSection]  = useState(scrollState.activeSection);
  const [narrative, setNarrative] = useState(scrollState.narrativeState);

  // Use refs to avoid stale-closure issues in the listener
  const sectionRef  = useRef(section);
  const narrativeRef = useRef(narrative);

  useEffect(() => {
    const onSection = (s: ScrollState) => {
      if (s.activeSection !== sectionRef.current) {
        sectionRef.current  = s.activeSection;
        narrativeRef.current = s.narrativeState;
        setSection(s.activeSection);
        setNarrative(s.narrativeState);
      }
    };

    sectionListeners.add(onSection);
    startScrollLoop();

    return () => {
      sectionListeners.delete(onSection);
      if (sectionListeners.size === 0 && progressListeners.size === 0) {
        stopScrollLoop();
      }
    };
  }, []);

  return { activeSection: section, narrativeState: narrative };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export function getActiveNodeColor(state: NarrativeState): string {
  return NARRATIVE_COLORS[state];
}