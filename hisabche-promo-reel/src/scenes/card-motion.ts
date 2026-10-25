// src/scenes/card-motion.ts
//
// Motion for the cards of Reel 100: how a card ARRIVES, how it hangs on the
// page afterwards, and what the cues do to it (a shake on an alert, a punch of
// zoom-in-and-out on a result). Every function is a pure function of `t`.
//
// ⚠️ NOTHING MAY LEAVE THE FRAME (Hard Rule 17). The amplitudes below are the
// ones `node scripts/check-frame-bounds.mjs 100` accepts with the layouts of
// `tech-explainer.tsx`; raise one and run it again.

import type { CSSProperties } from 'react'

export type Entrance = 'rise' | 'flip' | 'from-left' | 'from-right' | 'drop'

export interface CardFx {
  /** Second the card begins to arrive. */
  at: number
  /** Position in the list: staggers the arrival and offsets the float. */
  i?: number
  enter?: Entrance
  /** Pixels the card drifts up and down once it has arrived. */
  float?: number
  /** Seconds at which the card shakes. */
  shakes?: readonly number[]
  /** Seconds at which the card zooms in and back out. */
  punches?: readonly number[]
  /** After this second the card trembles, a little more every moment. */
  tremorFrom?: number
}

const ARRIVE = 0.62
const TAU = Math.PI * 2

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

/** Overshoots past 1 and settles, like a card thrown onto a desk. */
function backOut(x: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  const k = clamp01(x) - 1
  return 1 + c3 * k ** 3 + c1 * k ** 2
}

/** Seconds since `at`, as 0–1 over `dur`, or null outside the window. */
function within(t: number, at: number, dur: number): number | null {
  const x = (t - at) / dur
  return x >= 0 && x <= 1 ? x : null
}

export function cardFx(t: number, fx: CardFx): CSSProperties {
  const i = fx.i ?? 0
  const start = fx.at + i * 0.15
  const x = clamp01((t - start) / ARRIVE)
  const p = backOut(x)
  const parts: string[] = []

  // 1 · Arrival
  switch (fx.enter ?? 'rise') {
    case 'flip':
      parts.push(
        `perspective(700px) rotateX(${((1 - p) * -78).toFixed(2)}deg) translateY(${((1 - p) * 34).toFixed(1)}px)`,
      )
      break
    case 'from-left':
      parts.push(
        `translateX(${((1 - p) * -14).toFixed(1)}px) rotate(${((1 - p) * -5).toFixed(2)}deg)`,
      )
      break
    case 'from-right':
      parts.push(
        `translateX(${((1 - p) * 14).toFixed(1)}px) rotate(${((1 - p) * 5).toFixed(2)}deg)`,
      )
      break
    case 'drop':
      parts.push(
        `translateY(${((1 - p) * -40).toFixed(1)}px) rotate(${((1 - p) * -6).toFixed(2)}deg)`,
      )
      break
    default:
      parts.push(`translateY(${((1 - p) * 26).toFixed(1)}px)`)
  }
  parts.push(`scale(${(0.78 + 0.22 * p).toFixed(3)})`)

  // 2 · Hanging on the page: a slow drift and a faint lean, each card out of step.
  if (fx.float && x >= 1) {
    const since = t - start - ARRIVE
    parts.push(`translateY(${(Math.sin((since * TAU) / 2.7 + i * 1.3) * fx.float).toFixed(2)}px)`)
    parts.push(`rotate(${(Math.sin((since * TAU) / 3.9 + i * 0.9) * 0.35).toFixed(3)}deg)`)
  }

  // 3 · A shake on an alert: sideways, dying away.
  for (const at of fx.shakes ?? []) {
    const k = within(t, at, 0.5)
    if (k === null) continue
    const decay = (1 - k) ** 2
    parts.push(
      `translateX(${(Math.sin(k * 70) * 5 * decay).toFixed(2)}px) rotate(${(Math.sin(k * 55) * 0.9 * decay).toFixed(3)}deg)`,
    )
  }

  // 4 · A punch: the card swells and comes back — zoom in, zoom out.
  for (const at of fx.punches ?? []) {
    const k = within(t, at, 0.55)
    if (k === null) continue
    parts.push(`scale(${(1 + 0.085 * Math.sin(Math.PI * k) ** 1.5).toFixed(4)})`)
  }

  // 5 · A tremor that builds while things go wrong.
  if (fx.tremorFrom !== undefined && t > fx.tremorFrom) {
    const grow = clamp01((t - fx.tremorFrom) / 2.4)
    parts.push(
      `translate(${(Math.sin(t * 47 + i * 2.1) * 1.4 * grow).toFixed(2)}px, ${(Math.cos(t * 53 + i * 1.7) * 1.1 * grow).toFixed(2)}px)`,
    )
  }

  return {
    opacity: clamp01(x * 3),
    transform: parts.join(' '),
  }
}

/** The whole stage shaking at a cue: a few pixels, dying away. */
export function stageShake(
  t: number,
  shakes: readonly number[] | undefined,
): { x: number; y: number } {
  let x = 0
  let y = 0
  for (const at of shakes ?? []) {
    const k = within(t, at, 0.45)
    if (k === null) continue
    const decay = (1 - k) ** 2
    x += Math.sin(k * 80) * 4 * decay
    y += Math.cos(k * 67) * 3 * decay
  }
  return { x, y }
}

/** The whole stage breathing in and out at a cue: a small zoom, never a cut. */
export function stagePunch(t: number, punches: readonly number[] | undefined): number {
  let scale = 1
  for (const at of punches ?? []) {
    const k = within(t, at, 0.6)
    if (k === null) continue
    scale += 0.018 * Math.sin(Math.PI * k)
  }
  return scale
}
