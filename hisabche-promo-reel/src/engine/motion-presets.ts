// ============================================
// Motion presets — rebuilt on the 100 motion rules.
// All signatures frozen. Changes: one studio ease, restrained scales
// (≤1.05), transform/opacity only, no gradient sweeps or layout properties.
// Rules: 31, 33, 37, 41-43, 98.
// ============================================

import type { CSSProperties } from 'react'
import { clamp, ease, mix, progress, studioSpring } from './anim'

export interface EnterOptions {
  y?: number
  x?: number
  scale?: number
  fade?: number
}

/** Standard upward entrance with studio spring physics. */
export function enterUp(t: number, at: number, options: EnterOptions = {}): CSSProperties {
  const { y = 24, x = 0, scale = 0.95, fade = 0.28 } = options
  const s = clamp(studioSpring(Math.max(0, t - at)))
  const o = clamp(progress(t, at, fade))
  return {
    opacity: o,
    transform: `translate(${mix(x, 0, s)}px, ${mix(y, 0, s)}px) scale(${mix(scale, 1, s)})`,
  }
}

/** Downward entrance for banners and headlines. */
export function enterDown(t: number, at: number, options: EnterOptions = {}): CSSProperties {
  return enterUp(t, at, { ...options, y: -(options.y ?? 24) })
}

/** Scale-centered reveal with a restrained depth pop. */
export function scaleReveal(
  t: number,
  at: number,
  options: { scale?: number; fade?: number } = {},
): CSSProperties {
  const { scale = 0.95, fade = 0.25 } = options
  const s = clamp(studioSpring(Math.max(0, t - at)))
  const o = clamp(progress(t, at, fade))
  return {
    opacity: o,
    transform: `scale(${mix(scale, 1, s)})`,
  }
}

/** Directional clip-path wipe reveal. */
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
  return { clipPath: clip, WebkitClipPath: clip }
}

/** Staggered entrance inside a list — 50–120ms default step. */
export function staggerEnter(
  t: number,
  baseAt: number,
  index: number,
  options: EnterOptions & { step?: number } = {},
): CSSProperties {
  const { step = 0.08, ...enterOpts } = options
  return enterUp(t, baseAt + index * step, enterOpts)
}

/**
 * Highlight sweep. The old version painted a moving linear-gradient (a
 * website effect). Now it is a translate + opacity pass of a thin rule —
 * transform/opacity only, fully scrub-safe.
 */
export function highlightSweep(t: number, at: number, duration = 0.65): CSSProperties {
  const p = ease(progress(t, at, duration))
  const x = mix(-40, 40, p)
  return {
    opacity: Math.sin(p * Math.PI),
    transform: `translate3d(${x}%, 0, 0)`,
    pointerEvents: 'none',
  }
}
