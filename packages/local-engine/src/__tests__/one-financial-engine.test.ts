// ============================================
// ONE financial engine.
//
// The rules that turn quantities and prices into money — the rounding, the
// line total, the cost, the profit — live in ONE implementation, in the
// shared core (@hisabche/validation). The server and the device import it.
//
// A second implementation is not a style question: it is a place where the
// desktop can disagree with the server about what a sale was worth, and the
// difference is discovered at the reconciliation, in front of a shopkeeper.
//
// This guard is on the SOURCE, because what regressed here was a coding
// choice ("round it here, quick"), and that is exactly what source inspection
// catches.
// ============================================

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const REPO = join(__dirname, '..', '..', '..', '..')

const AREAS = [
  join(REPO, 'packages', 'local-engine', 'src'),
  join(REPO, 'packages', 'app-shell', 'src'),
]

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') return []
      return walk(full)
    }
    return /\.tsx?$/.test(entry) ? [full] : []
  })
}

/** Comments are stripped first: the files document what they replaced. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

const MONEY_RULES = [
  { name: 'a cents conversion', pattern: /[*/]\s*100\b/ },
  { name: 'a local rounding', pattern: /Math\.round\(|toFixed\(/ },
]

describe('one financial engine', () => {
  const files = AREAS.flatMap(walk)

  it('the guard is not vacuous (it reads real files)', () => {
    expect(files.length).toBeGreaterThan(20)
  })

  it.each(MONEY_RULES)('no file holds its own $name', ({ pattern }) => {
    const offenders: string[] = []

    for (const file of files) {
      const source = stripComments(readFileSync(file, 'utf8'))
      if (pattern.test(source)) offenders.push(file.replace(REPO, ''))
    }

    expect(offenders).toEqual([])
  })

  it('the files that do money import the shared core', () => {
    const invoiceDraft = readFileSync(
      join(REPO, 'packages', 'app-shell', 'src', 'features', 'sales', 'invoice-draft.ts'),
      'utf8',
    )
    expect(invoiceDraft).toContain("from '@hisabche/validation'")

    const localInvoices = readFileSync(
      join(REPO, 'packages', 'local-engine', 'src', 'routes', 'invoices.ts'),
      'utf8',
    )
    expect(localInvoices).toContain("from '@hisabche/validation'")
    // The line total, the rounding and the ledger effect are the shared ones.
    expect(localInvoices).toContain('computeItemTotal')
    expect(localInvoices).toContain('invoiceLedgerLines')
  })
})
