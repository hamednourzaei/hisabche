// ============================================
// apps/mobile/src/__tests__/golden-vectors.test.ts
//
// THE GOLDEN VECTORS ON THE REACT NATIVE RUNTIME.
//
// ⚠️ THE SAME RUNNER, NOT A SECOND COPY OF THE ARITHMETIC.
//
// `packages/validation/src/__golden__/run-vectors.ts` is the one implementation
// the Node, backend, local-engine and desktop suites already share. This file
// imports it BY PATH and reads the ONE corpus — a copy here would recreate the
// defect the corpus exists to prevent.
//
// It is imported by path rather than from the `@hisabche/validation` barrel
// because the runner is test support and the barrel deliberately does not export
// it (exporting it created an import cycle that `no-import-cycles.test.ts`
// rejects — see ADR-006).
//
// WHAT THIS PROVES: the shared core computes byte-identical results under Jest
// with the React Native preset (jest-expo, Hermes-targeted Babel transform). It
// does NOT prove the packaged APK behaves the same — that needs an emulator run,
// which no unit test performs.
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

describe('Golden vectors — React Native (mobile) runtime', () => {
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
    const covered = new Set(corpus.vectors.map((v) => v.domain))
    expect([...covered].sort()).toEqual([
      'accounting-period',
      'costing',
      'currency',
      'invoice-math',
      'ledger',
      'payments',
    ])
  })
})
