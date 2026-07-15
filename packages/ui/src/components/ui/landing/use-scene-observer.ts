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
    threshold = 0.2, // ✅ کاهش از 0.25 به 0.2 برای تشخیص بهتر در موبایل
    rootMargin = "0px 0px -40px 0px", // ✅ کاهش از -60px به -40px
    narrativeState,
    cooldownMs = 300, // ✅ کاهش از 500 به 300
    mountDelayMs = 120, // ✅ افزایش از 80 به 120 برای موبایل
  } = options;

  const ref = useRef<T>(null);
  const [state, setState] = useState<SceneState>("hidden");
  const mounted = useRef(false);

  const optsRef = useRef({ threshold, rootMargin, narrativeState, cooldownMs, mountDelayMs });
  optsRef.current = { threshold, rootMargin, narrativeState, cooldownMs, mountDelayMs };

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // جلوگیری از اجرای دوباره
    if (mounted.current) return;
    mounted.current = true;

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
      requestAnimationFrame(() => {
        setState("animated");
        // Restore opacity — now controlled by Tailwind classes
        element.style.opacity = "";
        element.style.willChange = "";
      });
    }, mountDelayMs);

    // ✅ استفاده از IntersectionObserver با rootMargin بهبودیافته
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;

        const { isIntersecting, intersectionRatio } = entry;

        element.setAttribute("data-scroll-active", isIntersecting ? "true" : "false");

        // ✅ فقط زمانی که کاملاً قابل مشاهده است (با margin منفی کمتر)
        if (isIntersecting && intersectionRatio >= threshold) {
          if (canTrigger(sectionId, cooldownMs)) {
            recordTrigger(sectionId);
            queueSetActiveSection(sectionId);
          }
        }
      },
      { 
        threshold: typeof threshold === 'number' ? threshold : 0.2,
        rootMargin: rootMargin || "0px 0px -40px 0px",
      }
    );

    observer.observe(element);

    return () => {
      clearTimeout(mountTimer);
      observer.disconnect();
      // Cleanup inline styles
      element.style.opacity = "";
      element.style.willChange = "";
      mounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ref, state };
}

export type { NarrativeState, SectionId };