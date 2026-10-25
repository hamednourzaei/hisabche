// packages/ui/src/components/ui/landing/scene-gates.ts
//
// The barrier before every station, as numbers. A gate is two pedestals, two
// glass leaves hinged at the pedestals' inner faces, and a light. The leaves
// swing forward — the way the robot is going — and they are already open by
// the time it is close enough to touch them.
//
// The opening is a pure function of the robot's distance to the gate, not a
// timer: the same scroll position always shows the same angle, and the test
// can sweep every distance and prove the robot never meets a leaf.
//
// Local frame: the gate stands at its own origin, the leaves span x, the road
// runs along -z (the direction of travel). All lengths in metres.

export const PEDESTAL_X = 1.34
export const PEDESTAL_HALF_WIDTH = 0.16
export const PEDESTAL_DEPTH = 1.5
export const PEDESTAL_HEIGHT = 1.15

/** The hinge is inside the pedestal's inner face, so the leaf folds past it. */
export const HINGE_X = 1.1
/** One leaf, from the hinge to the meeting line. */
export const LEAF_LENGTH = 1
export const LEAF_HEIGHT = 0.78
export const LEAF_THICKNESS = 0.04
/** Where the leaf starts: its lower edge, at the hinge height. */
export const LEAF_BOTTOM = 0.33

/** The robot's shoulders, plus the clearance its arms need. */
export const ROBOT_RADIUS = 0.46

/** Fully open by this distance from the gate; shut again beyond the far one. */
export const GATE_OPEN_AT = 1.55
export const GATE_SHUT_AT = 3.1

/** The leaves never quite meet: a real pair of glass doors keeps a gap. */
export const LEAF_TIP = HINGE_X - LEAF_LENGTH

const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t)
const smooth = (t: number) => t * t * (3 - 2 * t)

/** How far a leaf has swung, 0..1, from the robot's distance to the gate. */
export function gateOpening(distance: number): number {
  const far = Math.max(0, distance)
  return 1 - smooth(clamp01((far - GATE_OPEN_AT) / (GATE_SHUT_AT - GATE_OPEN_AT)))
}

/** The angle a leaf has turned, radians (0 shut, π/2 fully open). */
export function gateAngle(open: number): number {
  return clamp01(open) * (Math.PI / 2)
}

export interface Point {
  x: number
  z: number
}

/**
 * A leaf's line, hinge to tip, in the gate's own frame. `half` is -1 for the
 * leaf on the negative x side, +1 for the other.
 */
export function leafSegment(half: -1 | 1, open: number): { hinge: Point; tip: Point } {
  const angle = gateAngle(open)
  const hinge: Point = { x: half * HINGE_X, z: 0 }
  return {
    hinge,
    tip: {
      x: hinge.x - half * LEAF_LENGTH * Math.cos(angle),
      z: hinge.z - LEAF_LENGTH * Math.sin(angle),
    },
  }
}

/** The width a body can walk through, at a given opening. */
export function passageWidth(open: number): number {
  const right = leafSegment(1, open).tip
  const left = leafSegment(-1, open).tip
  return Math.hypot(right.x - left.x, right.z - left.z)
}

function distanceToSegment(point: Point, a: Point, b: Point): number {
  const vx = b.x - a.x
  const vz = b.z - a.z
  const length = vx * vx + vz * vz
  const t = length > 0 ? clamp01(((point.x - a.x) * vx + (point.z - a.z) * vz) / length) : 0
  return Math.hypot(point.x - (a.x + vx * t), point.z - (a.z + vz * t))
}

/**
 * The gap between the robot's body and the nearest leaf, at a given opening.
 * Negative means the leaf is inside the robot.
 */
export function robotGateClearance(open: number, at: Point): number {
  let near = Number.POSITIVE_INFINITY
  for (const half of [-1, 1] as const) {
    const leaf = leafSegment(half, open)
    near = Math.min(near, distanceToSegment(at, leaf.hinge, leaf.tip))
  }
  return near - ROBOT_RADIUS
}

/** The gap between a leaf's outer face and the pedestal it folds against. */
export function leafToPedestal(open: number): number {
  const leaf = leafSegment(1, open)
  const inner = PEDESTAL_X - PEDESTAL_HALF_WIDTH
  return inner - (leaf.hinge.x + LEAF_THICKNESS / 2)
}
