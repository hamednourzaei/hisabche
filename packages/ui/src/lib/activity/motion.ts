// packages/ui/src/lib/activity/motion.ts
"use client";

import { useReducedMotion } from "../../hooks/activity/useAccessibility";

// ─── Motion Tokens ──────────────────────────────────────────────────────────

export const motionTokens = {
  duration: {
    instant: 0,
    fast: 150,
    normal: 200,
    slow: 300,
    slower: 500,
  },
  easing: {
    ease: [0.25, 0.1, 0.25, 1],
    easeIn: [0.4, 0, 1, 1],
    easeOut: [0, 0, 0.2, 1],
    easeInOut: [0.4, 0, 0.2, 1],
    spring: [0.34, 1.56, 0.64, 1],
  },
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useMotionDuration(duration: keyof typeof motionTokens.duration) {
  const prefersReducedMotion = useReducedMotion();
  if (prefersReducedMotion) return 0;
  return motionTokens.duration[duration];
}

export function useMotionEasing(easing: keyof typeof motionTokens.easing) {
  const prefersReducedMotion = useReducedMotion();
  if (prefersReducedMotion) return "linear";
  return motionTokens.easing[easing];
}

// ─── CSS Classes ────────────────────────────────────────────────────────────

export const motionClassNames = {
  fadeIn: "animate-in fade-in duration-200",
  fadeOut: "animate-out fade-out duration-200",
  slideIn: "animate-in slide-in-from-top-2 duration-200",
  slideOut: "animate-out slide-out-to-top-2 duration-200",
  scaleIn: "animate-in zoom-in-95 duration-200",
  scaleOut: "animate-out zoom-out-95 duration-200",
  springIn: "animate-in zoom-in-95 duration-300 ease-spring",
  pulse: "animate-pulse duration-1000",
  spin: "animate-spin duration-1000",
  shimmer: "animate-shimmer duration-1500",
};