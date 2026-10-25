// packages/ui/src/components/ui/landing/scene-clearance.ts
//
// The invoice's path past a station, as pure numbers — the render loop and the
// physical test ask this file the same question, so a picture that looks right
// and a measurement that says "clear" cannot drift apart.
//
// The sheet is a vertical plane 1.5 m wide and 2.06 m tall in the hall's own
// scale. It is never pushed into a machine and never hidden with a clipping
// plane. The robot walks it to the station, turns it upright in front of the
// intake (0.62 m clear of the solid), holds it at the corner where the scanner
// can read it, lifts it clear again, and steps back.
//
// "Clearance" is the distance from the sheet's rectangle to the station's solid
// box, in the station's own frame — both are modelled here, not guessed from
// mesh positions at run time.

/** Where a station stands and which way its face turns (radians about y). */
export interface StationFace {
  x: number
  z: number
  turn: number
}

/** Where the sheet is, and how it is turned. */
export interface SheetPose {
  x: number
  y: number
  z: number
  turn: number
  lean: number
}

export interface HandoffPose {
  /** Where the robot stands at this moment. */
  robot: { x: number; z: number }
  /** Where the sheet is, held at the robot's hands. */
  sheet: SheetPose
  /** The robot is walking or turning. */
  walking: boolean
  /** 0 → 1 while the sheet is lowered for the scan. */
  presenting: number
}

/** The sheet, in metres. */
export const SHEET = { halfWidth: 0.75, halfHeight: 1.03 } as const

/**
 * A station's solid intake: the counter every machine shares, measured with a
 * little margin over the geometry so the test is not kinder than the picture.
 */
export const STATION_SOLID = { halfWidth: 1.35, halfHeight: 1.1, halfDepth: 0.9 } as const

/** Never closer than this to a solid, in metres. */
export const MIN_CLEARANCE = 0.15

/** The robot's arm reach: the sheet sits this far from its shoulder. */
export const ARM_REACH = 0.58

/** How far in front of the intake face the sheet is presented. */
export const PRESENT_GAP = 0.62

/** How far along the intake the sheet is read: at its corner, not its middle. */
export const PRESENT_ALONG = 1.08

/** Carried high enough to clear every intake even while the robot turns. */
export const CARRY_Y = STATION_SOLID.halfHeight + SHEET.halfHeight + MIN_CLEARANCE + 0.04

/** Reading height of the sheet while it is being scanned. */
export const PRESENT_Y = 1.98

const smooth = (t: number) => t * t * (3 - 2 * t)
const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t)
const mix = (from: number, to: number, t: number) => from + (to - from) * t

/** The station's face, in world x/z. */
export function stationFront(turn: number): { x: number; z: number } {
  return { x: Math.sin(turn), z: Math.cos(turn) }
}

/** A point in a station's own frame, in world x/z. */
function toWorld(place: StationFace, x: number, z: number): { x: number; z: number } {
  const c = Math.cos(place.turn)
  const s = Math.sin(place.turn)
  return { x: place.x + c * x + s * z, z: place.z - s * x + c * z }
}

/** Which side of the intake the robot works from: the road side of the hall. */
function workingSide(place: StationFace): number {
  return -Math.sign(place.x) || -1
}

/** Where the sheet is read, in world x/z. */
export function presentPoint(place: StationFace): { x: number; z: number } {
  return toWorld(place, workingSide(place) * PRESENT_ALONG, STATION_SOLID.halfDepth + PRESENT_GAP)
}

/** Where the robot stands while the sheet is read. */
export function stationStand(place: StationFace): { x: number; z: number } {
  return toWorld(
    place,
    workingSide(place) * (PRESENT_ALONG + ARM_REACH),
    STATION_SOLID.halfDepth + PRESENT_GAP,
  )
}

/**
 * The robot's step in, the scan, and its step back — as a function of how far
 * through the handoff the story is (0 at ENTER_AT, 1 at the end of the beat).
 * The sheet rides at `CARRY_Y` until the robot is in place, turns upright while
 * it is still above the intake, and is only lowered once it is in front of it.
 */
export function handoff(
  from: { x: number; z: number },
  travel: { x: number; z: number },
  place: StationFace,
  along: number,
): HandoffPose {
  const t = clamp01(along)
  const stand = stationStand(place)
  const present = presentPoint(place)
  const step = Math.hypot(travel.x, travel.z) || 1
  const walk = { x: travel.x / step, z: travel.z / step }
  const start = { x: from.x + walk.x * ARM_REACH, z: from.z + walk.z * ARM_REACH }
  const rest = (() => {
    const dx = place.x - from.x
    const dz = place.z - from.z
    const far = Math.hypot(dx, dz) || 1
    return { x: from.x + (dx / far) * ARM_REACH, z: from.z + (dz / far) * ARM_REACH }
  })()
  const startTurn = Math.atan2(-walk.x, -walk.z)

  const STEP_IN = 0.2
  const LOWER = 0.24
  const RAISE = 0.5
  const STEP_OUT = 0.8

  let robot = stand
  let sheet = present
  let turn = place.turn
  if (t < STEP_IN) {
    const go = smooth(t / STEP_IN)
    robot = { x: mix(from.x, stand.x, go), z: mix(from.z, stand.z, go) }
    sheet = { x: mix(start.x, present.x, go), z: mix(start.z, present.z, go) }
    turn = mix(startTurn, place.turn, go)
  } else if (t > STEP_OUT) {
    const back = smooth((t - STEP_OUT) / (1 - STEP_OUT))
    robot = { x: mix(stand.x, from.x, back), z: mix(stand.z, from.z, back) }
    sheet = { x: mix(present.x, rest.x, back), z: mix(present.z, rest.z, back) }
  }

  const lowered =
    t <= LOWER
      ? smooth(clamp01((t - (LOWER - 0.12)) / 0.12))
      : 1 - smooth(clamp01((t - RAISE) / 0.12))
  const height = mix(CARRY_Y, PRESENT_Y, clamp01(lowered))

  return {
    robot,
    sheet: { x: sheet.x, y: height, z: sheet.z, turn, lean: -0.06 * clamp01(lowered) },
    walking: t < STEP_IN || t > STEP_OUT,
    presenting: clamp01(lowered),
  }
}

/** Where the sheet comes to rest at the end of a station, in the robot's hands. */
export function restPoint(
  from: { x: number; z: number },
  place: StationFace,
): { x: number; z: number } {
  const dx = place.x - from.x
  const dz = place.z - from.z
  const far = Math.hypot(dx, dz) || 1
  return { x: from.x + (dx / far) * ARM_REACH, z: from.z + (dz / far) * ARM_REACH }
}

interface Point {
  x: number
  z: number
}

/** The sheet's centre in the station's frame. */
function toStationFrame(pose: SheetPose, place: StationFace): Point {
  const dx = pose.x - place.x
  const dz = pose.z - place.z
  const c = Math.cos(place.turn)
  const s = Math.sin(place.turn)
  return { x: c * dx - s * dz, z: s * dx + c * dz }
}

function pointToBox(point: Point): number {
  const dx = Math.max(0, Math.abs(point.x) - STATION_SOLID.halfWidth)
  const dz = Math.max(0, Math.abs(point.z) - STATION_SOLID.halfDepth)
  return Math.hypot(dx, dz)
}

function pointToSegment(point: Point, a: Point, b: Point): number {
  const vx = b.x - a.x
  const vz = b.z - a.z
  const length = vx * vx + vz * vz
  const t = length > 0 ? clamp01(((point.x - a.x) * vx + (point.z - a.z) * vz) / length) : 0
  return Math.hypot(point.x - (a.x + vx * t), point.z - (a.z + vz * t))
}

/**
 * Distance from the sheet to the station's solid box, in metres. `Infinity`
 * when the sheet is entirely above the box, where nothing can be touched.
 * Zero means they intersect.
 */
export function clearanceToStation(pose: SheetPose, place: StationFace): number {
  const bottom = pose.y - SHEET.halfHeight
  const top = pose.y + SHEET.halfHeight
  if (bottom >= STATION_SOLID.halfHeight || top <= 0) return Infinity

  const centre = toStationFrame(pose, place)
  const angle = pose.turn - place.turn
  const hx = Math.cos(angle) * SHEET.halfWidth
  const hz = -Math.sin(angle) * SHEET.halfWidth
  const a: Point = { x: centre.x - hx, z: centre.z - hz }
  const b: Point = { x: centre.x + hx, z: centre.z + hz }

  const w = STATION_SOLID.halfWidth
  const d = STATION_SOLID.halfDepth
  const corners: Point[] = [
    { x: -w, z: -d },
    { x: w, z: -d },
    { x: w, z: d },
    { x: -w, z: d },
  ]

  let near = Math.min(pointToBox(a), pointToBox(b))
  for (const corner of corners) near = Math.min(near, pointToSegment(corner, a, b))
  return near
}
