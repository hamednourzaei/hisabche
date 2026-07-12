"use client";

import { useEffect, useRef, useState } from "react";

import {
  isSectionId,
  queueSetActiveSection,
  type NarrativeState,
  type SectionId,
} from "./use-scroll-narrative-store";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SceneState = "hidden" | "visible" | "animated";

interface UseSceneObserverOptions {
  threshold?: number;
  rootMargin?: string;
  narrativeState?: NarrativeState;
  cooldownMs?: number;
  mountDelayMs?: number;
}

interface UseSceneObserverReturn<T extends HTMLElement> {
  ref: React.RefObject<T>;
  state: SceneState;
}

// ─── Per-section cooldown tracker ────────────────────────────────────────────

const lastTriggerTime = new Map<SectionId, number>();

function canTrigger(section: SectionId, cooldownMs: number): boolean {
  const last = lastTriggerTime.get(section) ?? 0;
  return Date.now() - last > cooldownMs;
}

function recordTrigger(section: SectionId): void {
  lastTriggerTime.set(section, Date.now());
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSceneObserver<T extends HTMLElement = HTMLDivElement>(
  options: UseSceneObserverOptions = {}
): UseSceneObserverReturn<T> {
  const {
    threshold = 0.25,
    rootMargin = "0px 0px -60px 0px",
    narrativeState,
    cooldownMs = 500,
    mountDelayMs = 80,
  } = options;

  const ref = useRef<T>(null);
  const [state, setState] = useState<SceneState>("hidden");

  const optsRef = useRef({ threshold, rootMargin, narrativeState, cooldownMs, mountDelayMs });
  optsRef.current = { threshold, rootMargin, narrativeState, cooldownMs, mountDelayMs };

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const { threshold, rootMargin, narrativeState, cooldownMs, mountDelayMs } = optsRef.current;

    const rawId = element.id;

    if (!rawId) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[useSceneObserver] Element is missing an id.", element);
      }
      return;
    }

    if (!isSectionId(rawId)) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[useSceneObserver] Unknown section id "${rawId}".`);
      }
      return;
    }

    const sectionId: SectionId = rawId;

    if (narrativeState) {
      element.setAttribute("data-narrative", narrativeState);
    }

    // Reserve space immediately — prevent CLS from conditional animations
    element.style.opacity = "0";
    element.style.willChange = "opacity, transform";

    const mountTimer = setTimeout(() => {
      setState("visible");
      requestAnimationFrame(() => setState("animated"));
      // Restore opacity — now controlled by Tailwind classes
      element.style.opacity = "";
      element.style.willChange = "";
    }, mountDelayMs);

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;

        const { isIntersecting, intersectionRatio } = entry;

        element.setAttribute("data-scroll-active", isIntersecting ? "true" : "false");

        if (isIntersecting && intersectionRatio >= threshold) {
          if (canTrigger(sectionId, cooldownMs)) {
            recordTrigger(sectionId);
            queueSetActiveSection(sectionId);
          }
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(element);

    return () => {
      clearTimeout(mountTimer);
      observer.disconnect();
      // Cleanup inline styles
      element.style.opacity = "";
      element.style.willChange = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ref, state };
}

export type { NarrativeState, SectionId };