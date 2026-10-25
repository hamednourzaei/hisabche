// The runtime law: a reel runs MORE than 30 seconds. The numbers are the owner's; loosening them
// is a decision, not a test edit.
import { describe, expect, it } from 'vitest'

import {
  MIN_RUNTIME_SECONDS,
  RUNTIME_REMEDIATION,
  exceedsMinimum,
  isProductionReady,
  judgeRuntime,
  runtimeOf,
} from '../runtime-law.mjs'

const reel = (id, ends, declared = ends[ends.length - 1]) => ({
  id,
  duration: declared,
  scenes: ends.map((end) => ({ end })),
})

describe('the minimum', () => {
  it('is thirty seconds, strictly: exactly 30.0 does not pass', () => {
    expect(MIN_RUNTIME_SECONDS).toBe(30)
    expect(exceedsMinimum(30)).toBe(false)
    expect(exceedsMinimum(30.0001)).toBe(true)
    expect(exceedsMinimum(29.99)).toBe(false)
    expect(exceedsMinimum(Number.NaN)).toBe(false)
  })

  it('a reel is as long as the end of its last scene', () => {
    expect(runtimeOf(reel('x', [10, 22, 31.5]))).toBe(31.5)
    expect(runtimeOf({ id: 'x', scenes: [] })).toBe(0)
  })
})

describe('the verdict', () => {
  it('ok: longer than the minimum', () => {
    expect(judgeRuntime(reel('900', [10, 20, 31]))).toEqual({ status: 'ok', seconds: 31 })
    expect(isProductionReady(reel('900', [10, 20, 31]))).toBe(true)
  })

  it('a new reel that is too short is a violation — never quietly accepted', () => {
    expect(judgeRuntime(reel('900', [10, 20, 30])).status).toBe('violation')
    expect(isProductionReady(reel('900', [10, 20, 30]))).toBe(false)
  })

  it('a recorded reel that is too short is remediation: warned about, not blocked', () => {
    const verdict = judgeRuntime(reel('53', [26]), ['53'])
    expect(verdict.status).toBe('remediation')
    expect(isProductionReady(reel('53', [26]))).toBe(false)
  })

  it('a declared duration that disagrees with the timeline is inconsistent', () => {
    expect(judgeRuntime(reel('900', [10, 35], 40)).status).toBe('inconsistent')
  })
})

describe('the recorded list', () => {
  it('has no repeats and no reel 94 (it is lengthened, not excused)', () => {
    expect(new Set(RUNTIME_REMEDIATION).size).toBe(RUNTIME_REMEDIATION.length)
    expect(RUNTIME_REMEDIATION).not.toContain('94')
  })

  it('names only reels, as plain ids', () => {
    for (const id of RUNTIME_REMEDIATION) expect(id).toMatch(/^\d{2}$/)
  })
})
