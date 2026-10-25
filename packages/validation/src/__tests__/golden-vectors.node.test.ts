import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { canonicalJson, runVector, type GoldenVector } from '../__golden__/run-vectors'

// THE CORPUS, EXECUTED AGAINST THE PRODUCT'S OWN FUNCTIONS.
//
// Node is one of the four runtimes that must agree (the others are Electron
// main, React Native/Hermes and the backend). They all import this same runner,
// so a disagreement is a difference in the CORE, not in a test.
const CORPUS_PATH = path.resolve(__dirname, '../__golden__/vectors.json')

interface Corpus {
  version: string
  vectors: GoldenVector[]
}

const corpus: Corpus = JSON.parse(fs.readFileSync(CORPUS_PATH, 'utf8'))

describe('Golden vectors — Node, through the real core', () => {
  it('loads a corpus that is not empty', () => {
    expect(corpus.vectors.length).toBeGreaterThan(0)
  })

  for (const vector of corpus.vectors) {
    it(`${vector.id} (${vector.domain}) is computed by the core, not by the test`, () => {
      const actual = runVector(vector)
      // Byte-for-byte: canonical JSON, sorted keys.
      expect(canonicalJson(actual)).toBe(canonicalJson(vector.expected))
    })
  }
})
