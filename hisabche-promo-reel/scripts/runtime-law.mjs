// Runtime law (owner, 24 Oct 2026): every reel runs MORE than 30 seconds.
// One definition, used by the audit, the exporter's check and the tests.
//
// ⚠️ Not a silent breaking change. When the law was written, many existing reels were at or under
// 30 s. They are listed in `RUNTIME_REMEDIATION` — a list that may only SHRINK (a reel leaves it
// when it is lengthened) and never grows: a reel that is not on it must exceed the minimum, and a
// new reel is never allowed on it. Reels on the list export with a warning, not a block, until the
// owner decides to close the list (see docs/RUNTIME-AUDIT.md).

/** A reel's runtime must be strictly greater than this many seconds. */
export const MIN_RUNTIME_SECONDS = 30

/**
 * The reels that were at or under the minimum when the law was written (the audit of 24 Oct 2026,
 * `node scripts/runtime-audit.mjs`). Each has a remediation line in docs/RUNTIME-AUDIT.md.
 * Remove an id when its reel passes; never add one.
 */
export const RUNTIME_REMEDIATION = [
  '50',
  '51',
  '52',
  '53',
  '54',
  '55',
  '56',
  '57',
  '58',
  '59',
  '60',
  '61',
  '62',
  '63',
  '64',
  '65',
  '68',
  '70',
]

/** The authoritative duration: the end of the last scene on the reel's own timeline. */
export function runtimeOf(reel) {
  const scenes = reel.scenes ?? []
  const last = scenes[scenes.length - 1]
  return last ? last.end : 0
}

export function exceedsMinimum(seconds) {
  return Number.isFinite(seconds) && seconds > MIN_RUNTIME_SECONDS
}

/**
 * What the law says about one reel.
 *   'ok'           — more than the minimum
 *   'remediation'  — at or under it, and on the recorded list (warn, do not block)
 *   'violation'    — at or under it, and NOT on the list (a new reel too short)
 *   'inconsistent' — `reel.duration` disagrees with the timeline
 */
export function judgeRuntime(reel, remediation = RUNTIME_REMEDIATION) {
  const seconds = runtimeOf(reel)
  if (Math.abs((reel.duration ?? NaN) - seconds) > 0.001) return { status: 'inconsistent', seconds }
  if (exceedsMinimum(seconds)) return { status: 'ok', seconds }
  return { status: remediation.includes(String(reel.id)) ? 'remediation' : 'violation', seconds }
}

/** A reel may be called production-ready only when it passes the law outright. */
export function isProductionReady(reel) {
  return judgeRuntime(reel).status === 'ok'
}
