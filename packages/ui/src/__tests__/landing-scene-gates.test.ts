// packages/ui/src/__tests__/landing-scene-gates.test.ts
//
// The barrier before each station, measured. The leaves are hinged glass with a
// real swing arc; the robot is a body with a real width. This test walks the
// robot at the gate from every distance and asserts the glass is never inside
// it — and that the leaves never fold through their own pedestal.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  GATE_OPEN_AT,
  GATE_SHUT_AT,
  HINGE_X,
  LEAF_LENGTH,
  PEDESTAL_HALF_WIDTH,
  PEDESTAL_X,
  ROBOT_RADIUS,
  gateAngle,
  gateOpening,
  leafSegment,
  leafToPedestal,
  passageWidth,
  robotGateClearance,
} from '../components/ui/landing/scene-gates'

const LANDING = join(process.cwd(), 'src/components/ui/landing')
const code = (file: string) =>
  readFileSync(join(LANDING, file), 'utf8')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line))
    .join('\n')
    .split(/\s+/)
    .join(' ')

describe('the gate is a hinge, not a fade', () => {
  it('meets in the middle when shut, leaving only a door gap', () => {
    const right = leafSegment(1, 0)
    const left = leafSegment(-1, 0)
    expect(right.tip.x).toBeCloseTo(HINGE_X - LEAF_LENGTH, 9)
    expect(left.tip.x).toBeCloseTo(-(HINGE_X - LEAF_LENGTH), 9)
    expect(passageWidth(0)).toBeLessThan(ROBOT_RADIUS)
  })

  it('opens wide enough for the robot and the sheet it carries', () => {
    expect(leafSegment(1, 1).tip.z).toBeCloseTo(-LEAF_LENGTH, 9)
    expect(passageWidth(1)).toBeGreaterThan(ROBOT_RADIUS * 2 + 0.6)
    expect(gateAngle(1)).toBeCloseTo(Math.PI / 2, 9)
  })

  it('folds forward, clear of its own pedestal', () => {
    for (const open of [0, 0.25, 0.5, 0.75, 1]) {
      expect(leafToPedestal(open), `open ${open}`).toBeGreaterThanOrEqual(0.03)
    }
  })

  it('is open before the robot is close enough to touch it', () => {
    expect(gateOpening(GATE_OPEN_AT)).toBeCloseTo(1, 9)
    expect(gateOpening(GATE_SHUT_AT)).toBeCloseTo(0, 9)
    expect(gateOpening(0)).toBe(1)
    for (let far = 0; far <= 8; far += 0.05) {
      expect(gateOpening(far)).toBeGreaterThanOrEqual(gateOpening(far + 0.05) - 1e-12)
    }
  })

  it('never puts a leaf inside the robot, at any distance on the road', () => {
    for (const lane of [-0.4, -0.2, 0, 0.2, 0.4]) {
      for (let far = 0; far <= 6; far += 0.02) {
        const open = gateOpening(far)
        const gap = robotGateClearance(open, { x: lane, z: far })
        expect(
          gap,
          `lane ${lane}, distance ${far.toFixed(2)}, open ${open.toFixed(3)}`,
        ).toBeGreaterThanOrEqual(0.1)
      }
    }
  })

  it('is wider than the pedestals are apart', () => {
    // The leaves sit between the posts, so the opening can never exceed them.
    expect(HINGE_X).toBeLessThan(PEDESTAL_X - PEDESTAL_HALF_WIDTH)
    expect(passageWidth(1)).toBeLessThanOrEqual(PEDESTAL_X * 2)
  })
})

describe('the scene takes the gate’s angle from the measurement', () => {
  const scene = code('journey/scene.ts')

  it('opens from the distance, not from a timer', () => {
    expect(scene).toContain('gateOpening(')
    expect(scene).toContain('gateAngle(')
    expect(scene).not.toContain('gate.open += ')
    expect(scene).not.toContain('const wanted =')
  })

  it('hinges the leaf from the measured angle, not a fixed ratio', () => {
    expect(scene).not.toContain('gate.open * 1.5')
  })
})
