// ============================================
// BUG-NEW-005: a failed cost release must reach the caller.
//
// Reversing an invoice undoes the ledger entry and the payments FIRST, then
// releases the cost layers the sale drew from. The release used to be
// `.catch(console.error)`: if it failed, the reversal answered «done» with the
// layers still consumed, and the next sale of that product was costed from
// stock that no longer existed. The reversal is documented as safe to run again
// (every step is idempotent) — which only helps if the caller is told to.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SOURCE = readFileSync(join(__dirname, '../services/invoice.service.ts'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

describe('invoice.service releases cost layers without swallowing the error', () => {
  const calls = [...SOURCE.matchAll(/costing\s*\.releaseDocument\(/g)]

  it('still releases the layers in both places that reverse a sale', () => {
    expect(calls.length).toBeGreaterThanOrEqual(2)
  })

  for (const [index, call] of calls.entries()) {
    it(`release #${index + 1} is awaited and has no catch that hides its failure`, () => {
      const at = call.index ?? 0
      const before = SOURCE.slice(Math.max(0, at - 40), at)
      const after = SOURCE.slice(at, at + 160)
      expect(before).toContain('await')
      expect(after).not.toMatch(/\.catch\(/)
    })
  }
})
