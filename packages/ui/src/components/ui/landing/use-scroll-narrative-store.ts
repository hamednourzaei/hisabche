"use client";

import { useEffect, useState } from "react";

export type SectionId = 'hero' | 'pain' | 'transform' | 'features' | 'testimonials' | 'cta';
export type NarrativeState = 'frustration' | 'confusion' | 'clarity' | 'confidence' | 'trust' | 'action';

const SECTION_LAYOUT: { id: SectionId; y: number; narrative: NarrativeState }[] = [
  { id: 'hero',         y: 0.05, narrative: 'frustration' },
  { id: 'pain',         y: 0.2,  narrative: 'confusion'   },
  { id: 'transform',    y: 0.4,  narrative: 'clarity'     },
  { id: 'features',     y: 0.55, narrative: 'confidence'  },
  { id: 'testimonials', y: 0.75, narrative: 'trust'       },
  { id: 'cta',          y: 0.9,  narrative: 'action'      },
];

interface ScrollState {
  progress: number;
  activeSection: SectionId;
  narrativeState: NarrativeState;
}

let scrollState: ScrollState = {
  progress: 0,
  activeSection: 'hero',
  narrativeState: 'frustration',
};

const listeners = new Set<(state: ScrollState) => void>();

function updateScrollState(progress: number) {
  let activeSection: SectionId = 'hero';
  let narrativeState: NarrativeState = 'frustration';

  for (let i = SECTION_LAYOUT.length - 1; i >= 0; i--) {
    const section = SECTION_LAYOUT[i];
    if (section && progress >= section.y) {
      activeSection = section.id;
      narrativeState = section.narrative;
      break;
    }
  }

  // فقط وقتی section عوض شده body attrs رو آپدیت کن
  const changed = scrollState.activeSection !== activeSection;
  scrollState = { progress, activeSection, narrativeState };

  if (changed && typeof document !== 'undefined') {
    document.body.setAttribute('data-active-section', activeSection);
    document.body.setAttribute('data-narrative-state', narrativeState);
  }

  listeners.forEach(l => l(scrollState));
}

let rafId: number | null = null;
let lastProgress = -1;

function startScrollLoop() {
  if (rafId !== null) return;

  const loop = () => {
    if (typeof window !== 'undefined') {
      const maxScroll = document.body.scrollHeight - window.innerHeight;
      const progress = maxScroll > 0
        ? Math.min(1, Math.max(0, window.scrollY / maxScroll))
        : 0;

      // فقط وقتی تغییر معنادار داشت آپدیت کن
      if (Math.abs(progress - lastProgress) > 0.001) {
        lastProgress = progress;
        updateScrollState(progress);
      }
    }
    rafId = requestAnimationFrame(loop);
  };

  rafId = requestAnimationFrame(loop);
}

function stopScrollLoop() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

export function useScrollNarrative() {
  const [state, setState] = useState<ScrollState>(scrollState);

  useEffect(() => {
    const listener = (s: ScrollState) => setState(s);
    listeners.add(listener);
    startScrollLoop();
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) stopScrollLoop();
    };
  }, []);

  return state;
}

export function getActiveNodeColor(narrativeState: NarrativeState): string {
  switch (narrativeState) {
    case 'frustration': return '#A855F7';
    case 'confusion':   return '#EF4444';
    case 'clarity':     return '#10B981';
    case 'confidence':  return '#06B6D4';
    case 'trust':       return '#8B5CF6';
    case 'action':      return '#EC4899';
    default:            return '#A855F7';
  }
}

export const getSectionLayout = () => SECTION_LAYOUT;