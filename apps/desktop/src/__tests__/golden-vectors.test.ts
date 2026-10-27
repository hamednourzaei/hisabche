// ============================================
// apps/desktop/src/__tests__/golden-vectors.test.ts
//
// THE GOLDEN VECTORS ON THE ELECTRON MAIN RUNTIME.
//
// ⚠️ THE SAME RUNNER, NOT A SECOND COPY OF THE ARITHMETIC.
//
// `packages/validation/src/__golden__/run-vectors.ts` is the one implementation
// the Node, backend and local-engine suites already share. This file imports it
// BY PATH and reads the ONE corpus. Copying either into the desktop app would
// recreate exactly the defect the corpus exists to prevent: two agreeing copies
// proving nothing about the product.
//
// It is imported by path rather than from the `@hisabche/validation` barrel
// because the runner is test support and the barrel deliberately does not export
// it (exporting it created an import cycle that `no-import-cycles.test.ts`
// rejects — see ADR-006).
//
// WHAT THIS PROVES: the shared core produces byte-identical results when it is
// evaluated by Jest on a jsdom/Electron-flavoured runtime, not only under
// Vitest. It does NOT prove the packaged Electron binary behaves the same — that
// needs a run of the built app, which no unit test performs.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  canonicalJson,
  runVector,
  type GoldenVector,
} from '../../../../packages/validation/src/__golden__/run-vectors'

interface Corpus {
  version: string
  vectors: GoldenVector[]
}

const CORPUS = join(__dirname, '../../../../packages/validation/src/__golden__/vectors.json')

const corpus = JSON.parse(readFileSync(CORPUS, 'utf8')) as Corpus

describe('Golden vectors — Electron (desktop) runtime', () => {
  it('loads the shared corpus, and it is not empty', () => {
    expect(corpus.vectors.length).toBeGreaterThan(0)
  })

  it.each(corpus.vectors.map((v) => [v.id, v] as const))(
    '%s is computed by the shared core, byte-for-byte',
    (_id, vector) => {
      expect(canonicalJson(runVector(vector))).toBe(canonicalJson(vector.expected))
    },
  )

  it('⚠️ every domain in the corpus is actually exercised', () => {
    // A corpus that quietly lost a domain would still pass every vector above.
    const covered = new Set(corpus.vectors.map((v) => v.domain))
    expect([...covered].sort()).toEqual([
      'accounting-period',
      'costing',
      'currency',
      'invoice-math',
      'ledger',
      'list-filters',
      'payments',
      'unit-conversion',
    ])
  })
})
