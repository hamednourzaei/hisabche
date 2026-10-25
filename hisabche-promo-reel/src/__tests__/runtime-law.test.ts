// The runtime law applied to every registered reel. A reel not on the remediation list must run
// more than 30 s; a reel on the list must still be too short (the list only shrinks).
import { describe, expect, it } from 'vitest'

import { RUNTIME_REMEDIATION, judgeRuntime } from '../../scripts/runtime-law.mjs'
import { REELS } from '../reels'

describe('runtime law over the registry', () => {
  it('no reel disagrees with its own timeline', () => {
    const inconsistent = REELS.filter((reel) => judgeRuntime(reel).status === 'inconsistent').map(
      (r) => r.id,
    )
    expect(inconsistent).toEqual([])
  })

  it('every reel off the list runs more than 30 seconds (a new short reel fails here)', () => {
    const violations = REELS.filter((reel) => judgeRuntime(reel).status === 'violation').map(
      (reel) => `${reel.id}: ${judgeRuntime(reel).seconds}s`,
    )
    expect(violations).toEqual([])
  })

  it('the list only shrinks: a listed reel that now passes must be removed from it', () => {
    const stale = REELS.filter(
      (reel) =>
        RUNTIME_REMEDIATION.includes(String(reel.id)) && judgeRuntime(reel, []).status === 'ok',
    ).map((reel) => reel.id)
    expect(stale, 'remove these ids from RUNTIME_REMEDIATION').toEqual([])
  })

  it('every listed id is a registered reel', () => {
    const ids = new Set(REELS.map((reel) => String(reel.id)))
    for (const id of RUNTIME_REMEDIATION) expect(ids.has(id), `reel ${id}`).toBe(true)
  })
})
