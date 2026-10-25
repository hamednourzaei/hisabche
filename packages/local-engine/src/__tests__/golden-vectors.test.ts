import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
// ⚠️ IMPORTED BY PATH, NOT FROM THE BARREL.
//
// The runner is test support, not product API, and exporting it from
// `@hisabche/validation` created a cycle (runner → core → runner) that
// `no-import-cycles.test.ts` rejects. Reaching it directly keeps the production
// barrel free of it while still running the SAME code as the other runtimes.
import {
  canonicalJson,
  runVector,
  type GoldenVector,
} from '../../../validation/src/__golden__/run-vectors'

// ⚠️ THE LOCAL ENGINE RUNS THE SAME RUNNER AS THE SERVER.
//
// This file used to carry its own copy of the invoice/costing/payment/ledger
// arithmetic and compare the copy with the corpus. The device and the server
// could therefore disagree while both suites were green — which is the one
// failure mode a golden corpus exists to prevent.
//
// Both sides now call `runVector` → the core. A device that computes a
// different total from the server now fails here.
const CORPUS_PATH = path.resolve(__dirname, '../../../validation/src/__golden__/vectors.json')

interface Corpus {
  version: string
  vectors: GoldenVector[]
}

const corpus: Corpus = JSON.parse(fs.readFileSync(CORPUS_PATH, 'utf8'))

describe('Local engine — golden vectors through the shared core', () => {
  it('reads a non-empty corpus', () => {
    expect(corpus.vectors.length).toBeGreaterThan(0)
  })

  for (const vector of corpus.vectors) {
    it(`[engine] ${vector.id} (${vector.domain}) matches the corpus byte-for-byte`, () => {
      expect(canonicalJson(runVector(vector))).toBe(canonicalJson(vector.expected))
    })
  }
})
