// ============================================
// Hisabche Promo Reel — Motion Presets (Hard Rule 10)
// Deterministic, studio-grade motion primitives for SaaS product reels.
// Zero jank, frame-exact, and guaranteed numeric & state continuity.
// ============================================

import type { CSSProperties } from 'react'
import { clamp, ease, mix, progress, studioSpring } from './anim'

export interface EnterOptions {
  y?: number
  x?: number
  scale?: number
  fade?: number
}

/**
 * Standard upward card/dialog entrance with stiffness:140/damping:18 spring physics.
 */
export function enterUp(t: number, at: number, options: EnterOptions = {}): CSSProperties {
  const { y = 25, x = 0, scale = 0.94, fade = 0.28 } = options
  const elapsed = Math.max(0, t - at)
  const s = clamp(studioSpring(elapsed))
  const o = clamp(progress(t, at, fade))
  return {
    opacity: o,
    transform: `translate(${mix(x, 0, s)}px, ${mix(y, 0, s)}px) scale(${mix(scale, 1, s)})`,
  }
}

/**
 * Downward entrance for top banners, status badges, and headlines.
 */
export function enterDown(t: number, at: number, options: EnterOptions = {}): CSSProperties {
  return enterUp(t, at, { ...options, y: -(options.y ?? 25) })
}

/**
 * Scale-centered reveal with subtle depth pop.
 */
export function scaleReveal(
  t: number,
  at: number,
  options: { scale?: number; fade?: number } = {},
): CSSProperties {
  const { scale = 0.88, fade = 0.25 } = options
  const elapsed = Math.max(0, t - at)
  const s = clamp(studioSpring(elapsed))
  const o = clamp(progress(t, at, fade))
  return {
    opacity: o,
    transform: `scale(${mix(scale, 1, s)})`,
  }
}

/**
 * Directional CSS clip-path wipe reveal (e.g. for charts, barcodes, invoices).
 */
export function clipReveal(
  t: number,
  at: number,
  options: { direction?: 'up' | 'down' | 'left' | 'right'; duration?: number } = {},
): CSSProperties {
  const { direction = 'up', duration = 0.45 } = options
  const p = ease(progress(t, at, duration))
  let clip = `inset(0% 0% 0% 0%)`
  switch (direction) {
    case 'up':
      clip = `inset(${(1 - p) * 100}% 0% 0% 0%)`
      break
    case 'down':
      clip = `inset(0% 0% ${(1 - p) * 100}% 0%)`
      break
    case 'left':
      clip = `inset(0% 0% 0% ${(1 - p) * 100}%)`
      break
    case 'right':
      clip = `inset(0% ${(1 - p) * 100}% 0% 0%)`
      break
  }
  return {
    clipPath: clip,
    WebkitClipPath: clip,
  }
}

/**
 * Staggered element entrance inside a list or grid.
 */
export function staggerEnter(
  t: number,
  baseAt: number,
  index: number,
  options: EnterOptions & { step?: number } = {},
): CSSProperties {
  const { step = 0.08, ...enterOpts } = options
  const itemAt = baseAt + index * step
  return enterUp(t, itemAt, enterOpts)
}

/**
 * Highlight sweep gradient overlay over [at, at + duration].
 */
export function highlightSweep(t: number, at: number, duration = 0.65): CSSProperties {
  const p = ease(progress(t, at, duration))
  const x = mix(-100, 200, p)
  return {
    background: `linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.18) 50%, transparent 100%)`,
    transform: `translateX(${x}%)`,
    pointerEvents: 'none',
  }
}
