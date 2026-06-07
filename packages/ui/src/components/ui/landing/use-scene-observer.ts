"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type SceneState = "hidden" | "visible" | "animated";
export type NarrativeState = "frustration" | "confusion" | "clarity" | "confidence" | "trust" | "action";

interface UseSceneObserverOptions {
  threshold?: number;
  once?: boolean;
  rootMargin?: string;
  onVisibilityChange?: (isVisible: boolean) => void;
  narrativeState?: NarrativeState;
}

export function useSceneObserver<T extends HTMLElement = HTMLDivElement>({
  threshold = 0.3,
  once = true,
  rootMargin = "0px 0px -100px 0px",
  onVisibilityChange,
  narrativeState,
}: UseSceneObserverOptions = {}) {
  const ref = useRef<T>(null);
  const [state, setState] = useState<SceneState>("hidden");
  const hasAnimated = useRef(false);

  const handleVisibilityChange = useCallback(
    (isVisible: boolean) => {
      if (!isVisible) return;
      
      if (once && hasAnimated.current) return;
      
      setState("visible");
      onVisibilityChange?.(true);
      
      // Set narrative state attribute for CSS targeting
      if (narrativeState && ref.current) {
        ref.current.setAttribute('data-narrative', narrativeState);
        ref.current.setAttribute('data-scroll-active', 'true');
      }
      
      requestAnimationFrame(() => {
        setState("animated");
        hasAnimated.current = true;
      });
    },
    [once, onVisibilityChange, narrativeState]
  );

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        
        const isVisible = entry.isIntersecting;
        if (isVisible) {
          handleVisibilityChange(true);
        } else if (element) {
          element.setAttribute('data-scroll-active', 'false');
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [handleVisibilityChange, threshold, rootMargin]);

  return { ref, state };
}

// Global narrative state manager
let globalActiveSection: string = 'hero';
const narrativeListeners: Set<(section: string, progress: number) => void> = new Set();

export function updateGlobalNarrative(section: string, progress: number) {
  globalActiveSection = section;
  narrativeListeners.forEach(listener => listener(section, progress));
  document.body.setAttribute('data-active-section', section);
  document.body.setAttribute('data-scroll-progress', String(progress));
}

export function useGlobalNarrative() {
  const [activeSection, setActiveSection] = useState(globalActiveSection);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const listener = (section: string, progress: number) => {
      setActiveSection(section);
      setScrollProgress(progress);
    };
    narrativeListeners.add(listener);
    return () => {
      narrativeListeners.delete(listener);
    };
  }, []);

  return { activeSection, scrollProgress };
}