// packages/ui/src/__tests__/landing-scene-clearance.test.ts
//
// The invoice may never pass through a machine. This is the measurement, not
// the picture: the same pure functions the render loop uses are swept across
// every station, at every 0.005 of the handoff, on both sides of the road.
//
// A failure here names the station, the step and the distance — what the
// scene-realism audit asks a failure report to contain.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  ARM_REACH,
  CARRY_Y,
  MIN_CLEARANCE,
  PRESENT_GAP,
  PRESENT_Y,
  SHEET,
  STATION_SOLID,
  clearanceToStation,
  handoff,
  presentPoint,
  stationStand,
  type StationFace,
} from '../components/ui/landing/scene-clearance'

const LANDING = join(process.cwd(), 'src/components/ui/landing')
/** Comments explain hazards; only code is asserted on. */
const code = (file: string) =>
  readFileSync(join(LANDING, file), 'utf8')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line))
    .join('\n')
    .split(/\s+/)
    .join(' ')

/** The five stations, on both sides of the road, as the scene lays them out. */
const STATIONS: { name: string; place: StationFace; from: { x: number; z: number } }[] = [
  ['pay', 1],
  ['cash', -1],
  ['stock', 1],
  ['post', -1],
  ['report', 1],
].map(([name, side], index) => {
  const place: StationFace = {
    x: (side as number) * 2.4,
    z: -(index + 1) * 18,
    turn: -(side as number) * 0.22,
  }
  return {
    name: name as string,
    place,
    from: { x: place.x - Math.sign(place.x) * 2.5, z: place.z + 1.3 },
  }
})

/** The robot walks down the hall, so the sheet starts the handoff behind it. */
const travel = { x: 0, z: -1 }

describe('the invoice is physically clear of every station', () => {
  it('holds the sheet at the robot’s hands while it is being read', () => {
    for (const { name, place, from } of STATIONS) {
      for (let step = 40; step <= 160; step++) {
        const along = step / 200
        const pose = handoff(from, travel, place, along)
        const reach = Math.hypot(pose.sheet.x - pose.robot.x, pose.sheet.z - pose.robot.z)
        expect(reach, `${name} @ ${along.toFixed(3)}`).toBeCloseTo(ARM_REACH, 9)
      }
    }
  })

  it.each(STATIONS)('$name: no collider is entered, at any step', ({ place, from }) => {
    for (let step = 0; step <= 200; step++) {
      const along = step / 200
      const pose = handoff(from, travel, place, along)
      const gap = clearanceToStation(pose.sheet, place)
      expect(
        gap,
        `${place.x > 0 ? 'east' : 'west'} station ${place.z}: progress ${along.toFixed(3)}, ` +
          `sheet y ${pose.sheet.y.toFixed(3)} → gap ${gap.toFixed(3)} m`,
      ).toBeGreaterThanOrEqual(MIN_CLEARANCE)
    }
  })

  it('carries the sheet above every intake until the robot is in place', () => {
    expect(CARRY_Y - SHEET.halfHeight).toBeGreaterThanOrEqual(
      STATION_SOLID.halfHeight + MIN_CLEARANCE,
    )
    for (const { place, from } of STATIONS) {
      for (const along of [0, 0.05, 0.1]) {
        const pose = handoff(from, travel, place, along)
        expect(pose.sheet.y - SHEET.halfHeight).toBeGreaterThanOrEqual(
          STATION_SOLID.halfHeight + MIN_CLEARANCE,
        )
      }
    }
  })

  it('lifts the sheet clear before stepping back', () => {
    for (const { place, from } of STATIONS) {
      const pose = handoff(from, travel, place, 0.92)
      expect(pose.sheet.y - SHEET.halfHeight).toBeGreaterThanOrEqual(
        STATION_SOLID.halfHeight + MIN_CLEARANCE,
      )
    }
  })

  it('presents the sheet parallel to the face, 0.62 m in front of the solid', () => {
    for (const { place, from } of STATIONS) {
      const pose = handoff(from, travel, place, 0.4)
      expect(pose.sheet.turn).toBeCloseTo(place.turn, 9)
      expect(pose.sheet.y).toBeCloseTo(PRESENT_Y, 9)
      const point = presentPoint(place)
      expect(Math.hypot(pose.sheet.x - point.x, pose.sheet.z - point.z)).toBeCloseTo(0, 9)
      expect(clearanceToStation(pose.sheet, place)).toBeCloseTo(PRESENT_GAP, 9)
    }
  })

  it('stands the robot one arm’s length from the sheet it presents', () => {
    for (const { place } of STATIONS) {
      const stand = stationStand(place)
      const point = presentPoint(place)
      expect(Math.hypot(stand.x - point.x, stand.z - point.z)).toBeCloseTo(ARM_REACH, 9)
      // The sheet is read at the intake's corner, so the whole face stays seen.
      expect(Math.abs(point.x - place.x)).toBeGreaterThan(STATION_SOLID.halfWidth * 0.5)
    }
  })

  it('measures an intersection as zero and clear air as the real distance', () => {
    const place: StationFace = { x: 0, z: 0, turn: 0 }
    const inside = { x: 0, y: 1.2, z: 0, turn: 0, lean: 0 }
    expect(clearanceToStation(inside, place)).toBe(0)
    const above = { x: 0, y: CARRY_Y, z: 0, turn: 0, lean: 0 }
    expect(clearanceToStation(above, place)).toBe(Number.POSITIVE_INFINITY)
    const front = { x: 0, y: 1.2, z: STATION_SOLID.halfDepth + 0.4, turn: 0, lean: 0 }
    expect(clearanceToStation(front, place)).toBeCloseTo(0.4, 9)
  })
})

describe('the sheet goes into the intake, and only there', () => {
  const scene = code('journey/scene.ts')

  it('is clipped at the slot so the part inside is hidden', () => {
    expect(scene).toContain('localClippingEnabled = true')
    expect(scene).toContain('cut.constant = -MACHINE_SLOT')
  })

  it('is lowered straight down over the intake, clear of the board behind it', () => {
    expect(scene).toContain('INTAKE_HOLD - sink * (INTAKE_HOLD - inside)')
    expect(scene).toContain('const INTAKE_HOLD = MACHINE_SLOT + SHEET_HALF + 0.18')
  })

  it('measures the gap only while the sheet is on its way', () => {
    expect(scene).toContain('clearanceToStation')
    expect(scene).toContain('place && !inserting')
    expect(scene).toContain('told.clearance =')
    expect(scene).toContain('told.breach =')
    expect(scene).toContain('MIN_CLEARANCE')
  })
})
