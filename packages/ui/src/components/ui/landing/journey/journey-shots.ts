// packages/ui/src/components/ui/landing/journey/journey-shots.ts
//
// Where the camera stands, as data.
//
// Each station has one authored shot: a way of arriving (the move) and the
// framing it settles into. No two neighbouring stations arrive the same way.
// Angles are relative to the station, not to the screen: a positive yaw is
// toward the ROAD side of the machine, so when the hall is mirrored for a
// right-to-left page every shot mirrors with it and nothing here says left or
// right.
//
// Pure numbers, no Three.js: the scene turns a pose into a camera position, and
// the tests sweep every pose to prove the camera stays inside the hall.

import type { JourneyStationId } from './journey-machine'

export type ShotMove = 'craneDown' | 'trackSide' | 'lowPush' | 'arc' | 'pullBackReveal'

export interface Shot {
  move: ShotMove
  /** Degrees toward the road side of the station (negative: from the wall side). */
  yaw: number
  /** Degrees above the subject; the owner wants eye level, so these stay small. */
  pitch: number
  /** How far back, before the frame is fitted to the screen. */
  distance: number
}

export const OPENING_SHOT: Shot = { move: 'craneDown', yaw: 10, pitch: 6, distance: 9 }

export const STATION_SHOTS: Record<JourneyStationId, Shot> = {
  pay: { move: 'trackSide', yaw: 34, pitch: 3, distance: 9.5 },
  cash: { move: 'lowPush', yaw: 18, pitch: -3, distance: 9 },
  stock: { move: 'arc', yaw: 30, pitch: 2, distance: 10 },
  post: { move: 'craneDown', yaw: 26, pitch: 4, distance: 9.5 },
  report: { move: 'pullBackReveal', yaw: 12, pitch: 0, distance: 9.5 },
}

/** On a tall, narrow screen a wide sideways track would lose the subject. */
export const PORTRAIT_YAW_LIMIT = 15

/** A crane move starts this many degrees above the subject — a look down, never a top view. */
export const CRANE_FROM = 15

export interface CameraPose {
  yaw: number
  pitch: number
  distance: number
}

const smooth = (t: number) => t * t * (3 - 2 * t)
const mix = (from: number, to: number, t: number) => from + (to - from) * t

/**
 * The pose `along` the move (0: arriving, 1: settled), written into `out`.
 * Under reduced motion the scene asks only for `along = 1`.
 */
export function shotPose(
  shot: Shot,
  along: number,
  portrait: boolean,
  out: CameraPose,
): CameraPose {
  const t = smooth(Math.min(1, Math.max(0, along)))
  let yaw = shot.yaw
  let pitch = shot.pitch
  let distance = shot.distance
  if (shot.move === 'craneDown') pitch = mix(CRANE_FROM, shot.pitch, t)
  else if (shot.move === 'trackSide') yaw = mix(shot.yaw * 0.3, shot.yaw, t)
  else if (shot.move === 'lowPush') distance = mix(shot.distance * 1.3, shot.distance, t)
  else if (shot.move === 'arc') yaw = mix(shot.yaw - 25, shot.yaw, t)
  else distance = mix(shot.distance * 0.75, shot.distance * 1.12, t)

  out.yaw = portrait ? Math.min(PORTRAIT_YAW_LIMIT, Math.max(-PORTRAIT_YAW_LIMIT, yaw)) : yaw
  out.pitch = pitch
  out.distance = distance
  return out
}

/**
 * How far back the camera must be for a subject `width` × `height` to fit the
 * part of the screen that is free (`free`, 0 → 1 of its height), with a margin.
 */
export function fitDistance(
  width: number,
  height: number,
  fovDegrees: number,
  aspect: number,
  free: number,
  margin = 0.86,
): number {
  const half = Math.tan((fovDegrees * Math.PI) / 360)
  const room = Math.min(1, Math.max(0.25, free))
  return Math.max(height / (2 * half * room * margin), width / (2 * half * aspect * margin))
}

export interface Offset {
  x: number
  y: number
  z: number
}

/**
 * Where the camera is, measured from what it looks at. `roadSide` is +1 or −1:
 * which way along x the road lies from this station.
 */
export function eyeOffset(
  pose: CameraPose,
  distance: number,
  roadSide: number,
  out: Offset,
): Offset {
  const yaw = (pose.yaw * roadSide * Math.PI) / 180
  const pitch = (pose.pitch * Math.PI) / 180
  out.x = Math.sin(yaw) * Math.cos(pitch) * distance
  out.y = Math.sin(pitch) * distance
  out.z = Math.cos(yaw) * Math.cos(pitch) * distance
  return out
}

/** How far apart the stations stand along the hall. */
export const STATION_GAP = 18
/** The furthest back any shot is allowed to stand. */
export const MAX_DISTANCE = 15.5

export interface Hall {
  halfWidth: number
  height: number
  /** z of the wall behind the opening shot. */
  front: number
  /** z of the wall behind the core. */
  back: number
}

/** The room, sized from the stations so that every shot fits inside it. */
export function hallSize(stations: number, side: number): Hall {
  return {
    halfWidth: side + 11.5,
    height: 10.5,
    front: MAX_DISTANCE + 6,
    back: -(stations + 1) * STATION_GAP - 16,
  }
}
