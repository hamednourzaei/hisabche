// «از کادر هم بیرون نزنن»: the rule that measures every box against the 1080×1920 frame.
// (The renderer side — measuring a real reel — is `node scripts/check-frame-bounds.mjs <id>`.)
import { describe, expect, it } from 'vitest'

import { violationsOf } from '../check-frame-bounds.mjs'

const frame = { width: 1080, height: 1920 }
const box = (left, top, right, bottom, what = 'x') => ({ what, left, top, right, bottom })

describe('violationsOf', () => {
  it('a box well inside the frame is fine', () => {
    expect(violationsOf([box(100, 200, 900, 400)], frame, 24)).toEqual([])
  })

  it('a box that crosses an edge is OUTSIDE, with the side and how far', () => {
    expect(violationsOf([box(-10, 200, 500, 400, 'a')], frame, 24)).toEqual([
      { what: 'a', side: 'left', slack: -10, outside: true },
    ])
    expect(violationsOf([box(100, 200, 1100, 400, 'b')], frame, 24)).toEqual([
      { what: 'b', side: 'right', slack: -20, outside: true },
    ])
    expect(violationsOf([box(100, 1900, 500, 1950, 'c')], frame, 24)).toEqual([
      { what: 'c', side: 'bottom', slack: -30, outside: true },
    ])
    expect(violationsOf([box(100, -5, 500, 100, 'd')], frame, 24)[0]).toMatchObject({
      side: 'top',
      outside: true,
    })
  })

  it('a box inside but closer than the safe margin is TOO CLOSE, not outside', () => {
    const [problem] = violationsOf([box(10, 200, 500, 400, 'e')], frame, 24)
    expect(problem).toEqual({ what: 'e', side: 'left', slack: 10, outside: false })
  })

  it("exactly at the margin passes; the margin is the owner's to tighten, not to hide behind", () => {
    expect(violationsOf([box(24, 24, 1056, 1896)], frame, 24)).toEqual([])
    expect(violationsOf([box(23, 100, 500, 200)], frame, 24)).toHaveLength(1)
  })

  it('reports every offender', () => {
    const found = violationsOf(
      [box(-1, 0, 10, 10, 'p'), box(100, 100, 200, 200, 'q'), box(1070, 500, 1090, 600, 'r')],
      frame,
      24,
    )
    expect(found.map((f) => f.what)).toEqual(['p', 'r'])
  })
})
