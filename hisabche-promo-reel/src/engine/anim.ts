// ============================================
// Time-driven animation.
//
// Every value on screen is a pure function of the clock, never of how long
// something has been mounted. That is what lets the timeline be scrubbed,
// jumped and recorded frame-exactly: the same time always draws the same
// frame. (framer-motion's own timers would keep running behind a scrub.)
// ============================================

import type { CSSProperties } from 'react'

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))

/** Progress of a window [at, at + dur] at time t, 0..1. */
export const progress = (t: number, at: number, dur: number) => clamp((t - at) / dur)

/** cubic-bezier(0.22, 1, 0.36, 1) — solved for x, then y. */
export function ease(p: number): number {
  if (p <= 0) return 0
  if (p >= 1) return 1
  const x1 = 0.22
  const y1 = 1
  const x2 = 0.36
  const y2 = 1
  const bx = (u: number) => 3 * x1 * u * (1 - u) ** 2 + 3 * x2 * u * u * (1 - u) + u ** 3
  const by = (u: number) => 3 * y1 * u * (1 - u) ** 2 + 3 * y2 * u * u * (1 - u) + u ** 3
  let lo = 0
  let hi = 1
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    if (bx(mid) < p) lo = mid
    else hi = mid
  }
  return by((lo + hi) / 2)
}

/**
 * A spring (stiffness 120, damping 18, mass 1) as a closed form: the value it
 * reaches `s` seconds after release, from 0 towards 1, overshooting a little.
 */
const W0 = Math.sqrt(120)
const ZETA = 18 / (2 * W0)
const WD = W0 * Math.sqrt(1 - ZETA * ZETA)
export function spring(s: number): number {
  if (s <= 0) return 0
  const decay = Math.exp(-ZETA * W0 * s)
  return 1 - decay * (Math.cos(WD * s) + ((ZETA * W0) / WD) * Math.sin(WD * s))
}

/** Pop in at `at`: opacity, a rise and a scale on the spring. */
export function enter(
  t: number,
  at: number,
  options: { y?: number; x?: number; scale?: number; fade?: number } = {},
): CSSProperties {
  const { y = 24, x = 0, scale = 0.92, fade = 0.35 } = options
  const s = spring(t - at)
  const o = progress(t, at, fade)
  return {
    opacity: o,
    transform: `translate(${(1 - s) * x}px, ${(1 - s) * y}px) scale(${scale + (1 - scale) * s})`,
  }
}

/**
 * Studio spring (stiffness 140, damping 18, mass 1) for fluid, Apple/Linear-grade SaaS motion.
 * Closed-form analytical solution: settling quickly with organic deceleration and zero jank.
 */
const WD_140 = Math.sqrt(59)
export function studioSpring(s: number): number {
  if (s <= 0) return 0
  const decay = Math.exp(-9 * s)
  return 1 - decay * (Math.cos(WD_140 * s) + (9 / WD_140) * Math.sin(WD_140 * s))
}

/**
 * Premium studio entrance: combines stiffness:140/damping:18 spring physics
 * with a soft Y-axis rise (+25px -> 0px) and scale entrance (0.94 -> 1.0).
 */
export function studioSpringEnter(
  t: number,
  at: number,
  options: { y?: number; x?: number; scale?: number; fade?: number } = {},
): CSSProperties {
  const { y = 25, x = 0, scale = 0.94, fade = 0.28 } = options
  const elapsed = t - at
  const s = studioSpring(elapsed)
  const o = clamp(progress(t, at, fade))
  return {
    opacity: o,
    transform: `translate(${mix(x, 0, s)}px, ${mix(y, 0, s)}px) scale(${mix(scale, 1, s)})`,
  }
}

/** Fade out over [at, at + dur]. Multiplies with an existing opacity. */
export const leave = (t: number, at: number, dur = 0.4) => 1 - ease(progress(t, at, dur))

/** A number between a and b at progress p. */
export const mix = (a: number, b: number, p: number) => a + (b - a) * p

/** A soft pulse 0..1, period seconds, only while t is inside [from, to]. */
export function pulse(t: number, from: number, to: number, period = 1.4): number {
  if (t < from || t > to) return 0
  return 0.5 - 0.5 * Math.cos(((t - from) / period) * Math.PI * 2)
}

/** Interpolates a value between fromVal and toVal across [fromT, toT] with easing. */
export function interpolate(
  t: number,
  fromT: number,
  toT: number,
  fromVal: number,
  toVal: number,
  easing: (p: number) => number = ease,
): number {
  const p = easing(progress(t, fromT, Math.max(0.001, toT - fromT)))
  return mix(fromVal, toVal, p)
}

/** SVG stroke drawing dashoffset helper. */
export function strokeDraw(t: number, at: number, dur = 1.0, length = 1000) {
  const p = ease(progress(t, at, dur))
  return {
    strokeDasharray: length,
    strokeDashoffset: length * (1 - p),
  }
}

/** Subtle cinematic camera zoom & pan. */
export function cinematicZoom(
  t: number,
  at: number,
  dur = 4,
  zoomFrom = 1,
  zoomTo = 1.06,
  panY = 0,
): CSSProperties {
  const p = ease(progress(t, at, dur))
  const scale = mix(zoomFrom, zoomTo, p)
  const y = mix(0, panY, p)
  return {
    transform: `scale(${scale}) translateY(${y}px)`,
    transformOrigin: 'center center',
  }
}

/** Pure deterministic pseudo-random hash (0..1) for procedural particle and geometry animation. */
export function deterministicHash(x: number, y: number): number {
  let n = (x * 374761393 + y * 668265263) | 0
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  return ((n ^ (n >>> 16)) & 0x7fffffff) / 0x7fffffff
}

/** Directional clip-path generator for wipes and shutters. */
export function maskWipe(
  p: number,
  direction: 'up' | 'down' | 'left' | 'right' | 'radial' = 'up',
): string {
  const clamped = clamp(p)
  switch (direction) {
    case 'up':
      return `inset(${(1 - clamped) * 100}% 0% 0% 0%)`
    case 'down':
      return `inset(0% 0% ${(1 - clamped) * 100}% 0%)`
    case 'left':
      return `inset(0% 0% 0% ${(1 - clamped) * 100}%)`
    case 'right':
      return `inset(0% ${(1 - clamped) * 100}% 0% 0%)`
    case 'radial':
      return `circle(${clamped * 100}% at 50% 50%)`
  }
}

/** Interpolates coordinates along an array of 2D waypoints with angle calculation. */
export function pathFollow(
  p: number,
  points: { x: number; y: number }[],
): { x: number; y: number; angle: number } {
  if (points.length === 0) return { x: 0, y: 0, angle: 0 }
  if (points.length === 1) return { x: points[0]!.x, y: points[0]!.y, angle: 0 }

  const clamped = clamp(p)
  const totalSegments = points.length - 1
  const rawIdx = clamped * totalSegments
  const segIdx = Math.min(totalSegments - 1, Math.floor(rawIdx))
  const segP = rawIdx - segIdx

  const p0 = points[segIdx]!
  const p1 = points[segIdx + 1]!

  const x = mix(p0.x, p1.x, segP)
  const y = mix(p0.y, p1.y, segP)
  const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x) * (180 / Math.PI)

  return { x, y, angle }
}

/** Camera motion operator for 3D perspective stages. */
export function cameraMove(
  t: number,
  at: number,
  dur: number,
  fromCam: { rx?: number; ry?: number; rz?: number; z?: number; y?: number },
  toCam: { rx?: number; ry?: number; rz?: number; z?: number; y?: number },
  easing: (p: number) => number = ease,
): CSSProperties {
  const p = easing(progress(t, at, dur))
  const rx = mix(fromCam.rx ?? 0, toCam.rx ?? 0, p)
  const ry = mix(fromCam.ry ?? 0, toCam.ry ?? 0, p)
  const rz = mix(fromCam.rz ?? 0, toCam.rz ?? 0, p)
  const z = mix(fromCam.z ?? 0, toCam.z ?? 0, p)
  const y = mix(fromCam.y ?? 0, toCam.y ?? 0, p)

  return {
    transform: `perspective(1000px) translateZ(${z}px) translateY(${y}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`,
    transformStyle: 'preserve-3d',
  }
}

/** Generates an array of start timings with optional decay. */
export function staggerTimings(
  count: number,
  startAt: number,
  interval: number,
  decay = 0,
): number[] {
  const out: number[] = []
  let curr = startAt
  let step = interval
  for (let i = 0; i < count; i++) {
    out.push(curr)
    curr += step
    step = Math.max(0.04, step - decay)
  }
  return out
}

export interface SpringConfig {
  stiffness: number
  damping: number
  mass: number
}

// Standard spring configuration for smooth SaaS motion
export const SAAS_SPRING: SpringConfig = {
  stiffness: 140,
  damping: 18,
  mass: 1,
}

// Linear interpolation: lerp(start, end, t) — identical to mix
export const lerp = (start: number, end: number, t: number): number => {
  return start + (end - start) * t
}

// Exponential Out easing for ultra-smooth entry without jank
export const easeOutExpo = (x: number): number => {
  return x === 1 ? 1 : 1 - Math.pow(2, -10 * x)
}

// Frame-based deterministic progress calculation
export const getFrameProgress = (
  currentFrame: number,
  startFrame: number,
  durationFrames: number,
): number => {
  if (currentFrame < startFrame) return 0
  if (currentFrame >= startFrame + durationFrames) return 1
  return (currentFrame - startFrame) / durationFrames
}
