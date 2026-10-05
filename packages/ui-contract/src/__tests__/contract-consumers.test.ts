// ============================================
// Every shared contract has at least TWO real consumers.
//
// ---------------------------------------------------------------------------
// WHY TWO
//
// One consumer can pass by accident. A component shaped around its only caller
// looks general and is not — its props are that caller's props, its
// assumptions are that caller's assumptions, and the second screen to try it
// has to change it. The second consumer is what turns "shared" from a claim
// into a fact.
//
// And zero is worse than either: `scope.domain.ts` was correct, fully tested,
// and called by nothing for an entire session, while a seller could still edit
// another seller's invoice. A contract nothing consumes is not a finished
// phase, whatever its own tests say.
// ============================================

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')

/**
 * Where a consumer may live. Deliberately excludes the contract package
 * itself: a contract importing another contract is composition, not use.
 */
const CONSUMER_ROOTS = [
  join(ROOT, 'packages', 'ui', 'src'),
  join(ROOT, 'apps', 'web', 'app'),
  join(ROOT, 'apps', 'desktop', 'src'),
  join(ROOT, 'apps', 'mobile', 'src'),
]

function sourceFiles(directory: string): string[] {
  let entries: string[]
  try {
    entries = readdirSync(directory)
  } catch {
    return []
  }

  return entries.flatMap((entry) => {
    if (entry === 'node_modules' || entry === '__tests__') return []
    const full = join(directory, entry)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    return /\.tsx?$/.test(entry) ? [full] : []
  })
}

const FILES = CONSUMER_ROOTS.flatMap(sourceFiles).map((path) => ({
  path,
  text: readFileSync(path, 'utf8'),
}))

/**
 * Each contract, and the file that DEFINES it — which never counts as a
 * consumer of itself.
 *
 * ⚠️ These are the things a SCREEN mounts — hooks and shared primitives.
 *
 * A view/container pair is deliberately absent: `WorkQueuePanel` has exactly
 * one consumer (`WorkQueueContainer`) and always will, because that is the
 * repo's pattern — the view renders, the container fetches. Demanding two
 * consumers of a view would push people to inline data-fetching into views to
 * satisfy a test, which is worse than the thing being checked.
 *
 * The rule bites where reuse is actually claimed: a hook, a shell, a badge.
 */
const CONTRACTS: ReadonlyArray<{ symbol: string; definedIn: RegExp }> = [
  { symbol: 'useListEngine', definedIn: /use-list-engine\.tsx?$/ },
  { symbol: 'Entity360', definedIn: /entity-360\.tsx$/ },
  { symbol: 'WorkStateNote', definedIn: /work-state\.tsx$/ },
  { symbol: 'WorkStateBadge', definedIn: /work-state\.tsx$/ },
]

/**
 * A barrel re-export is not a consumer.
 *
 * `packages/ui/src/index.ts` mentions every symbol in the package. Counting it
 * would let a contract satisfy this test by being exported twice, which is the
 * exact opposite of what is being checked.
 */
const BARRELS = /[\\/](index|screens)\.tsx?$/

function consumersOf(symbol: string, definedIn: RegExp): string[] {
  const word = new RegExp(`\\b${symbol}\\b`)

  return FILES.filter((file) => {
    if (definedIn.test(file.path)) return false
    if (BARRELS.test(file.path)) return false
    return word.test(file.text)
  }).map((file) => file.path)
}

describe('the consumer roots exist', () => {
  it('found source files to scan', () => {
    // Without this the whole suite passes vacuously the day a path changes.
    expect(FILES.length).toBeGreaterThan(50)
  })
})

describe('every shared contract is used by at least two screens', () => {
  it.each(CONTRACTS.map((contract) => [contract.symbol, contract] as const))(
    '%s',
    (symbol, contract) => {
      const consumers = consumersOf(symbol, contract.definedIn)

      expect(
        consumers.length,
        `${symbol} has ${consumers.length} consumer(s): ${consumers
          .map((path) => path.split(/[\\/]/).slice(-2).join('/'))
          .join(', ')}`,
      ).toBeGreaterThanOrEqual(2)
    },
  )
})
