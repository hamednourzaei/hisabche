import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
// ⚠️ IMPORTED BY PATH, NOT FROM THE BARREL.
//
// The runner is test support and exporting it from `@hisabche/validation`
// created a cycle (runner → core → runner) that `no-import-cycles.test.ts`
// rejects. `backend/tsconfig.json` includes this one file explicitly so the
// import type-checks; the barrel stays free of it.
import {
  canonicalJson,
  runVector,
  type GoldenVector,
} from '../../../packages/validation/src/__golden__/run-vectors'

// ⚠️ THE BACKEND RUNS THE SAME RUNNER AS THE OTHER THREE RUNTIMES.
//
// This file used to re-derive every answer inline — line subtotal, discount,
// tax, payment allocation, ledger balance — and compare that arithmetic with
// the corpus. It proved the copy in the test file, not the product: the core
// could have been deleted and this suite stayed green.
//
// Now Node (vitest), Electron main (desktop jest), React Native (mobile jest)
// and this backend all call `runVector`, which calls the core. Byte-identical
// output across the four is then a statement about the core.
const CORPUS_PATH = path.resolve(
  __dirname,
  '../../../packages/validation/src/__golden__/vectors.json',
)

interface Corpus {
  version: string
  vectors: GoldenVector[]
}

const corpus: Corpus = JSON.parse(fs.readFileSync(CORPUS_PATH, 'utf8'))

describe('Backend — golden vectors through the shared core', () => {
  it('reads a non-empty corpus', () => {
    expect(corpus.vectors.length).toBeGreaterThan(0)
  })

  for (const vector of corpus.vectors) {
    it(`[backend] ${vector.id} (${vector.domain}) matches the corpus byte-for-byte`, () => {
      expect(canonicalJson(runVector(vector))).toBe(canonicalJson(vector.expected))
    })
  }
})
