/**
 * Pure SemVer parser, total-order comparator, and range evaluator.
 * Rejects lexicographic string ordering bugs ("1.10" vs "1.9").
 */

export interface SemVer {
  major: number
  minor: number
  patch: number
  prerelease: readonly (string | number)[]
  build: readonly string[]
}

const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/

export function parseSemVer(input: string): SemVer | null {
  const trimmed = input.trim().replace(/^v/, '')
  const match = SEMVER_RE.exec(trimmed)
  if (!match) return null
  const prereleaseRaw = match[4]
  const prerelease: (string | number)[] = []
  if (prereleaseRaw) {
    for (const part of prereleaseRaw.split('.')) {
      if (/^\d+$/.test(part)) {
        if (part.length > 1 && part.startsWith('0')) return null
        prerelease.push(Number(part))
      } else {
        prerelease.push(part)
      }
    }
  }
  const build = match[5] ? match[5].split('.') : []
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease,
    build,
  }
}

export function isValidSemVer(input: string): boolean {
  return parseSemVer(input) !== null
}

/**
 * Total order comparator consistent with SemVer 2.0.0.
 * Build metadata is ignored in precedence comparison.
 */
export function compareSemVer(aInput: string | SemVer, bInput: string | SemVer): number {
  const a = typeof aInput === 'string' ? parseSemVer(aInput) : aInput
  const b = typeof bInput === 'string' ? parseSemVer(bInput) : bInput
  if (!a || !b) {
    throw new Error('INVALID_SEMVER_COMPARISON')
  }
  if (a.major !== b.major) return a.major < b.major ? -1 : 1
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1

  const aPre = a.prerelease
  const bPre = b.prerelease
  if (aPre.length === 0 && bPre.length === 0) return 0
  if (aPre.length === 0) return 1
  if (bPre.length === 0) return -1

  const len = Math.max(aPre.length, bPre.length)
  for (let i = 0; i < len; i += 1) {
    const ap = aPre[i]
    const bp = bPre[i]
    if (ap === undefined) return -1
    if (bp === undefined) return 1
    if (ap === bp) continue
    const aNum = typeof ap === 'number'
    const bNum = typeof bp === 'number'
    if (aNum && bNum) return ap < bp ? -1 : 1
    if (aNum && !bNum) return -1
    if (!aNum && bNum) return 1
    return String(ap) < String(bp) ? -1 : 1
  }
  return 0
}

function matchSingleComparator(version: SemVer, comparator: string): boolean {
  const trimmed = comparator.trim()
  if (trimmed === '' || trimmed === '*') return true

  if (trimmed.startsWith('^')) {
    const base = parseSemVer(trimmed.slice(1))
    if (!base) throw new Error(`INVALID_SEMVER_RANGE:${comparator}`)
    if (compareSemVer(version, base) < 0) return false
    if (base.major > 0) {
      return version.major === base.major
    }
    if (base.minor > 0) {
      return version.major === 0 && version.minor === base.minor
    }
    return version.major === 0 && version.minor === 0 && version.patch === base.patch
  }

  if (trimmed.startsWith('~')) {
    const base = parseSemVer(trimmed.slice(1))
    if (!base) throw new Error(`INVALID_SEMVER_RANGE:${comparator}`)
    if (compareSemVer(version, base) < 0) return false
    return version.major === base.major && version.minor === base.minor
  }

  let op: '>=' | '<=' | '>' | '<' | '=' = '='
  let verStr = trimmed
  if (trimmed.startsWith('>=')) {
    op = '>='
    verStr = trimmed.slice(2)
  } else if (trimmed.startsWith('<=')) {
    op = '<='
    verStr = trimmed.slice(2)
  } else if (trimmed.startsWith('>')) {
    op = '>'
    verStr = trimmed.slice(1)
  } else if (trimmed.startsWith('<')) {
    op = '<'
    verStr = trimmed.slice(1)
  } else if (trimmed.startsWith('=')) {
    op = '='
    verStr = trimmed.slice(1)
  }

  const target = parseSemVer(verStr)
  if (!target) throw new Error(`INVALID_SEMVER_RANGE:${comparator}`)
  const cmp = compareSemVer(version, target)
  switch (op) {
    case '>=':
      return cmp >= 0
    case '<=':
      return cmp <= 0
    case '>':
      return cmp > 0
    case '<':
      return cmp < 0
    case '=':
      return cmp === 0
  }
}

function matchAndClause(version: SemVer, clause: string): boolean {
  const trimmed = clause.trim()
  if (!trimmed) return false
  const hyphenParts = trimmed.split(/\s+-\s+/)
  if (hyphenParts.length === 2) {
    const low = parseSemVer(hyphenParts[0]!)
    const high = parseSemVer(hyphenParts[1]!)
    if (!low || !high) throw new Error(`INVALID_SEMVER_RANGE:${clause}`)
    return compareSemVer(version, low) >= 0 && compareSemVer(version, high) <= 0
  }
  const tokens = trimmed.split(/\s+/)
  for (const token of tokens) {
    if (!matchSingleComparator(version, token)) return false
  }
  return true
}

export function isValidSemVerRange(range: string): boolean {
  const trimmed = range.trim()
  if (!trimmed) return false
  try {
    const dummy: SemVer = { major: 1, minor: 0, patch: 0, prerelease: [], build: [] }
    const orClauses = trimmed.split('||')
    for (const clause of orClauses) {
      matchAndClause(dummy, clause)
    }
    return true
  } catch {
    return false
  }
}

export function satisfiesRange(versionInput: string, range: string): boolean {
  const version = parseSemVer(versionInput)
  if (!version) return false
  const orClauses = range.trim().split('||')
  for (const clause of orClauses) {
    if (matchAndClause(version, clause)) return true
  }
  return false
}

export function maxSatisfying(versions: readonly string[], range: string): string | null {
  let best: string | null = null
  for (const v of versions) {
    if (!satisfiesRange(v, range)) continue
    if (best === null || compareSemVer(v, best) > 0) {
      best = v
    }
  }
  return best
}
