// packages/ui/src/components/ui/landing/scene-gait.ts
//
// Walking, as numbers. A figure's legs must move it exactly as far as the floor
// moves under it: the swing is a function of distance travelled, never of the
// clock. That is the difference between walking and moonwalking, and on a page
// where the robot walks only while the reader scrolls it is the difference
// between a walk and a slide.
//
// All lengths in metres, all times in seconds.

/** One full step: heel to heel. */
export const STEP_LENGTH = 0.84

/** How far the hall's walkers patrol, either side of their post. */
export const WALK_REACH = 4

/** How fast that patrol runs, radians of phase per second. */
export const WALK_RATE = 0.22

/** Below this speed a figure pivots instead of marching on the spot. */
const PIVOT_SPEED = 0.35

const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t)

export interface Gait {
  /** -1..1, the legs' swing. */
  stride: number
  /** Metres the body rises, always ≥ 0. */
  bob: number
}

/**
 * The gait at a distance travelled. Two steps per cycle, so the phase advances
 * π per step and the figure is back on the same foot every `2 × STEP_LENGTH`.
 */
export function gaitAt(distance: number): Gait {
  const phase = (distance / STEP_LENGTH) * Math.PI
  const stride = Math.sin(phase)
  return { stride, bob: Math.abs(stride) * 0.035 }
}

export interface Walker {
  /** Where along its patrol the figure is. */
  z: number
  /** Metres per second, always ≥ 0. */
  speed: number
  /** Which way it faces (radians about y; the models face -z at 0). */
  heading: number
  /** -1..1, damped to zero while it pivots. */
  stride: number
  bob: number
}

/**
 * A walker on its patrol at wall-clock `time` (seconds). The patrol is a
 * smooth in-and-out, so the speed falls to zero at each end; the gait is
 * damped with it, because a figure turning round is not marching.
 */
export function walkerAt(time: number, home: number, index = 0): Walker {
  const phase = time * WALK_RATE + index * 1.7
  const z = home + Math.sin(phase) * WALK_REACH
  const speed = Math.abs(Math.cos(phase)) * WALK_REACH * WALK_RATE
  const damping = clamp01(speed / PIVOT_SPEED)
  const gait = gaitAt(z - home)
  return {
    z,
    speed,
    // The models face -z at heading 0, so walking toward +z is a half turn.
    heading: Math.cos(phase) >= 0 ? Math.PI : 0,
    stride: gait.stride * damping,
    bob: gait.bob * damping,
  }
}

/** The shortest way round from one heading to another, in radians. */
export function turnToward(from: number, to: number): number {
  let difference = (to - from) % (Math.PI * 2)
  if (difference > Math.PI) difference -= Math.PI * 2
  if (difference < -Math.PI) difference += Math.PI * 2
  return difference
}
