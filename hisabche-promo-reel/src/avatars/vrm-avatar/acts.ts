// src/avatars/vrm-avatar/acts.ts
//
// What the avatar DOES, as a list of beats on the scene clock.
//
// A beat is «from this second, do this gesture with this feeling, standing,
// floating or hopping». The beat before it blends into it over ACT_BLEND
// seconds, so a change of act is a movement and not a cut. Everything here is
// a pure function of `t`: the exporter seeks to a frame and renders it once, so
// a pose that depends on the frame before it (a lerp, a spring) would come out
// different on every export.

import type { Emotion, Gesture } from '../founder-rig/types'

/** How she holds herself on the page. */
export type Presence = 'stand' | 'float' | 'hop'

export interface ActBeat {
  /** Seconds since the scene began. */
  at: number
  gesture: Gesture
  emotion: Emotion
  /** The mouth moves. Defaults to true; set false for a held, silent beat. */
  speaking?: boolean
  /** Defaults to standing on the ground. */
  presence?: Presence
}

export interface ActState {
  gesture: Gesture
  emotion: Emotion
  speaking: boolean
  presence: Presence
  /** Seconds since this act began (the phase of a float or a hop). */
  since: number
  /** The act this one is easing out of. Equal to the current once settled. */
  previousGesture: Gesture
  previousEmotion: Emotion
  previousPresence: Presence
  previousSince: number
  /** 0 = still the previous act, 1 = fully this one. */
  blend: number
}

/** How long one act takes to become the next. */
export const ACT_BLEND = 0.4

const smooth = (x: number): number => {
  const k = Math.min(1, Math.max(0, x))
  return k * k * (3 - 2 * k)
}

/** The act at `t`. Beats must be in order of `at`; the first one is the opening pose. */
export function actAt(beats: readonly ActBeat[], t: number): ActState {
  const first = beats[0]
  if (!first) {
    return {
      gesture: 'idle',
      emotion: 'neutral',
      speaking: false,
      presence: 'stand',
      since: 0,
      previousGesture: 'idle',
      previousEmotion: 'neutral',
      previousPresence: 'stand',
      previousSince: 0,
      blend: 1,
    }
  }

  let index = 0
  for (let i = 0; i < beats.length; i += 1) {
    const beat = beats[i]
    if (beat && beat.at <= t) index = i
  }

  const current = beats[index] ?? first
  const before = index > 0 ? (beats[index - 1] ?? current) : current

  return {
    gesture: current.gesture,
    emotion: current.emotion,
    speaking: current.speaking ?? true,
    presence: current.presence ?? 'stand',
    since: Math.max(0, t - current.at),
    previousGesture: before.gesture,
    previousEmotion: before.emotion,
    previousPresence: before.presence ?? 'stand',
    previousSince: Math.max(0, t - before.at),
    blend: index > 0 ? smooth((t - current.at) / ACT_BLEND) : 1,
  }
}

/* -------------------------------------------------------------------------- */
/* Where she is on the page                                                    */
/* -------------------------------------------------------------------------- */

export interface Lift {
  /** Pixels above where she stands. */
  up: number
  /** Radians of lean. */
  tilt: number
  /** Vertical squash on landing, 1 = none. */
  squash: number
  /** 0–1: how far the knees are drawn up. */
  tuck: number
}

const TAU = Math.PI * 2
/** One jump: crouch, rise, land. It happens ONCE at the moment of the beat, then she stands. */
const HOP_DURATION = 0.7
const HOP_HEIGHT = 26

/** One presence at `since` seconds into it. */
export function liftOf(presence: Presence, since: number): Lift {
  if (presence === 'float') {
    // Hovering a little clear of the ground: she rises into it, then drifts very slowly.
    const rise = Math.min(1, since / 0.8)
    const eased = rise * rise * (3 - 2 * rise)
    return {
      up: eased * (12 + Math.sin((since * TAU) / 3.6) * 3.5),
      tilt: Math.sin((since * TAU) / 4.8) * 0.018,
      squash: 1,
      tuck: eased * 0.22,
    }
  }
  if (presence === 'hop' && since < HOP_DURATION) {
    // A single jump with a short crouch before it and a soft landing after it.
    const x = since / HOP_DURATION
    const crouch = x < 0.14 ? Math.sin((x / 0.14) * Math.PI) * 0.045 : 0
    const flight = x < 0.14 ? 0 : (x - 0.14) / 0.86
    const air = 1 - (2 * flight - 1) ** 2
    const landing = x > 0.9 ? Math.sin(((x - 0.9) / 0.1) * Math.PI) * 0.04 : 0
    return {
      up: HOP_HEIGHT * air,
      tilt: 0,
      squash: 1 - crouch - landing,
      tuck: Math.min(1, air * 1.2) * 0.8,
    }
  }
  return { up: 0, tilt: 0, squash: 1, tuck: 0 }
}

/** Where she is now: the previous presence easing into the current one. */
export function liftAt(state: ActState): Lift {
  const now = liftOf(state.presence, state.since)
  if (state.blend >= 1) return now
  const was = liftOf(state.previousPresence, state.previousSince)
  const mixOf = (a: number, b: number) => a + (b - a) * state.blend
  return {
    up: mixOf(was.up, now.up),
    tilt: mixOf(was.tilt, now.tilt),
    squash: mixOf(was.squash, now.squash),
    tuck: mixOf(was.tuck, now.tuck),
  }
}
