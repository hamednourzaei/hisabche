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
  /** Fraction of element that must be visible to trigger. Default: 0.25 */
  threshold?: number;
  /** IntersectionObserver rootMargin. Default: "0px 0px -60px 0px" */
  rootMargin?: string;
  /** Narrative state written as a data-attribute for CSS targeting. */
  narrativeState?: NarrativeState;
  /** Minimum ms between repeated triggers for the same section. Default: 500 */
  cooldownMs?: number;
  /** Delay before initial "visible" state, in ms. Default: 80 */
  mountDelayMs?: number;
}

interface UseSceneObserverReturn<T extends HTMLElement> {
  ref:   React.RefObject<T>;
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
    threshold    = 0.25,
    rootMargin   = "0px 0px -60px 0px",
    narrativeState,
    cooldownMs   = 500,
    mountDelayMs = 80,
  } = options;

  const ref   = useRef<T>(null);
  const [state, setState] = useState<SceneState>("hidden");

  // Keep options in refs so the effect doesn't need to re-run when they change.
  // This prevents IntersectionObserver recreation on every render.
  const optsRef = useRef({ threshold, rootMargin, narrativeState, cooldownMs, mountDelayMs });
  optsRef.current = { threshold, rootMargin, narrativeState, cooldownMs, mountDelayMs };

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const { threshold, rootMargin, narrativeState, cooldownMs, mountDelayMs } = optsRef.current;

    // ── Resolve & validate section id ───────────────────────────────────────
    const rawId = element.id;

    if (!rawId) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[useSceneObserver] Element is missing an id. Observer skipped.", element);
      }
      return;
    }

    if (!isSectionId(rawId)) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[useSceneObserver] Unknown section id "${rawId}". Observer skipped.`);
      }
      return;
    }

    const sectionId: SectionId = rawId;

    // ── Data-attribute for CSS targeting ────────────────────────────────────
    if (narrativeState) {
      element.setAttribute("data-narrative", narrativeState);
    }

    // ── Initial visibility animation ────────────────────────────────────────
    const mountTimer = setTimeout(() => {
      setState("visible");
      requestAnimationFrame(() => setState("animated"));
    }, mountDelayMs);

    // ── IntersectionObserver ─────────────────────────────────────────────────
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;

        const { isIntersecting, intersectionRatio } = entry;

        element.setAttribute(
          "data-scroll-active",
          isIntersecting ? "true" : "false"
        );

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
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // stable reference – observer is tied to element, options via ref

  return { ref, state };
}

export type { NarrativeState, SectionId };