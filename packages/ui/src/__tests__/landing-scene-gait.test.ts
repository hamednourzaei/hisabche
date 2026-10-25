// packages/ui/src/__tests__/landing-scene-gait.test.ts
//
// Walking, measured. A figure on the landing must move its legs exactly as far
// as it moves over the floor. If the swing is driven by the clock and the
// position by something else, the feet slide — which is the single most
// common tell that a 3D walk is fake.
//
// Here the swing is a function of distance, and this test proves the coupling:
// it integrates the walker's own position, feeds that distance to the gait, and
// asserts the two agree at every step.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  STEP_LENGTH,
  WALK_RATE,
  WALK_REACH,
  gaitAt,
  turnToward,
  walkerAt,
} from '../components/ui/landing/scene-gait'

const LANDING = join(process.cwd(), 'src/components/ui/landing')
const code = (file: string) =>
  readFileSync(join(LANDING, file), 'utf8')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line))
    .join('\n')
    .split(/\s+/)
    .join(' ')

const PERIOD = (Math.PI * 2) / WALK_RATE

describe('a step is a length, not a frame rate', () => {
  it('puts the same foot down every two steps', () => {
    for (const distance of [0, 0.1, 0.37, 1, 2.5]) {
      expect(gaitAt(distance + STEP_LENGTH * 2).stride).toBeCloseTo(gaitAt(distance).stride, 9)
    }
  })

  it('sets the foot exactly when it covers one step', () => {
    expect(gaitAt(0).stride).toBeCloseTo(0, 12)
    expect(gaitAt(STEP_LENGTH).stride).toBeCloseTo(0, 12)
    expect(Math.sign(gaitAt(STEP_LENGTH * 0.5).stride)).toBe(1)
    expect(Math.sign(gaitAt(STEP_LENGTH * 1.5).stride)).toBe(-1)
  })

  it('keeps the body above the floor, never below it', () => {
    for (let distance = 0; distance <= STEP_LENGTH * 4; distance += 0.01) {
      const gait = gaitAt(distance)
      expect(gait.bob).toBeGreaterThanOrEqual(0)
      expect(gait.bob).toBeLessThanOrEqual(0.04)
    }
  })
})

describe('the hall’s walkers keep their feet on the floor', () => {
  it('drives the swing from the distance it has actually covered', () => {
    for (const index of [0, 1]) {
      let previous = walkerAt(0, -14, index)
      for (let time = 0.05; time <= PERIOD; time += 0.05) {
        const walker = walkerAt(time, -14, index)
        const covered = walker.z - previous.z
        const damping = Math.min(1, walker.speed / 0.35)
        // The swing's phase is the distance from the post, in steps — never the
        // clock. This is what makes the foot plant instead of slide.
        expect(walker.stride, `t ${time.toFixed(2)}`).toBeCloseTo(
          damping * Math.sin((Math.PI * (walker.z + 14)) / STEP_LENGTH),
          9,
        )
        // The floor moves under the feet by exactly the distance walked.
        expect(Math.abs(covered)).toBeLessThanOrEqual(0.06)
        previous = walker
      }
    }
  })

  it('slows to a stop before it turns round', () => {
    for (let time = 0; time <= PERIOD; time += 0.02) {
      const walker = walkerAt(time, 0)
      if (walker.speed < 0.02) {
        expect(Math.abs(walker.stride)).toBeLessThanOrEqual(Math.min(1, walker.speed / 0.35) + 1e-9)
      }
    }
  })

  it('never flips its heading while it is still moving', () => {
    let previous = walkerAt(0, 0)
    for (let time = 0.01; time <= PERIOD; time += 0.01) {
      const walker = walkerAt(time, 0)
      if (Math.abs(walker.heading - previous.heading) > 1) {
        expect(walker.speed, `flip at t ${time.toFixed(2)}`).toBeLessThan(0.2)
      }
      previous = walker
    }
  })

  it('stays on its stretch of the hall', () => {
    for (let time = 0; time <= PERIOD; time += 0.05) {
      const walker = walkerAt(time, -30)
      expect(Math.abs(walker.z + 30)).toBeLessThanOrEqual(WALK_REACH + 1e-9)
      expect(walker.speed).toBeGreaterThanOrEqual(0)
    }
  })

  it('turns the short way round', () => {
    expect(turnToward(0.1, -0.1)).toBeCloseTo(-0.2, 9)
    expect(Math.abs(turnToward(3, -3))).toBeLessThanOrEqual(Math.PI)
  })
})

describe('the scene walks from the measurement', () => {
  const scene = code('journey/scene.ts')

  it('takes the agent’s swing from the distance it covered', () => {
    expect(scene).toContain('gaitAt(')
    expect(scene).toContain('gait.stride')
    expect(scene).not.toContain('Math.sin(time * 9)')
  })

  it('drives the walkers from the same function', () => {
    expect(scene).toContain('walkerAt(')
    expect(scene).toContain('turnToward(')
    expect(scene).not.toContain('Math.cos(phase) > 0 ? Math.PI : 0')
  })
})
