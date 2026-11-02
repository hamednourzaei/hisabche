// ============================================
// backend/src/__tests__/m5-forward-fix-drift.test.ts
//
// The forward-fix (docs/m5-forward-fix-01-migration.sql) was generated from the CURRENT originals. If an original changes later and the
// forward-fix does not, a database repaired by the forward-fix would silently run a different definition than a fresh one. This guard
// makes that drift a red test, and checks the safety properties the runbook relies on: nothing destructive, every replaced object
// carries a version marker, the state probe and the combined VERIFY check the same markers, and the probe/VERIFY only read.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const doc = (name: string) => readFileSync(join(DOCS, name), 'utf8')
const fix = doc('m5-forward-fix-01-migration.sql')

const NEWLINE = String.fromCharCode(10)

/** What a script DOES at its top level: comments, function bodies (dollar-quoted) and string literals removed. */
const statements = (sql: string): string =>
  sql
    .split(NEWLINE)
    .filter((line) => !line.trimStart().startsWith('--'))
    .join(NEWLINE)
    .replace(/\$(fn)?\$[\s\S]*?\$(fn)?\$/g, ' ')
    .replace(/'(?:[^']|'')*'/g, "''")

function functionBlock(file: string, name: string): string {
  const text = doc(file)
  const start = text.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`)
  expect(start, `${name} not found in ${file}`).toBeGreaterThanOrEqual(0)
  const tail = text.slice(start)
  const end = tail.search(/^\$(fn)?\$;\s*$/m)
  return tail.slice(0, end) + (tail.slice(end).match(/^\$(fn)?\$;/m) as RegExpMatchArray)[0]
}

const BLOCKS: Array<[string, string]> = [
  ['package-deferred-revenue-01-migration.sql', 'package_credit_allocate'],
  ['package-deferred-revenue-01-migration.sql', 'accounting_deferred_revenue_change'],
  ['profit-ledger-totals-01-migration.sql', 'accounting_profit_ledger_totals'],
  ['invoice-write-grant-01-migration.sql', 'invoice_write_document'],
  ['invoice-return-06-scrap-loss-migration.sql', 'invoice_return_scrap_loss'],
]

describe('M5 forward-fix', () => {
  for (const [file, name] of BLOCKS) {
    it(`carries ${name} exactly as ${file} defines it (no drift)`, () => {
      expect(fix).toContain(functionBlock(file, name))
    })
  }

  it('is additive: it drops and deletes nothing but triggers it immediately re-creates', () => {
    const code = statements(fix)
    expect(code).not.toMatch(/\bDROP\s+(TABLE|COLUMN|FUNCTION|SCHEMA|INDEX|POLICY|TYPE)\b/i)
    expect(code).not.toMatch(
      /\b(DELETE\s+FROM|TRUNCATE|ALTER\s+TABLE|INSERT\s+INTO|UPDATE\s+\w+\s+SET)\b/i,
    )
    const dropped = [...code.matchAll(/DROP TRIGGER IF EXISTS (\w+)/g)].map((m) => m[1])
    expect(dropped.length).toBeGreaterThan(0)
    for (const trigger of dropped) expect(code).toContain(`CREATE TRIGGER ${trigger}`)
  })

  it('writes a version marker for every function it replaces, and the combined VERIFY reads the same markers', () => {
    const markers = [...fix.matchAll(/IS '(m5:[a-z_0-9]+:rev\d+)'/g)].map((m) => m[1]!)
    expect(markers.length).toBe(5)
    const verify = doc('VERIFY-m5-combined.sql')
    for (const marker of markers) expect(verify, marker).toContain(marker)
  })

  it('the corrected ledger predicate is in the forward-fix, and the probe and VERIFY fingerprint exactly that text', () => {
    expect(fix).toContain("IN ('posted', 'reversed')")
    expect(doc('PROBE-m5-state.sql')).toContain("posted'', ''reversed")
    expect(doc('VERIFY-m5-combined.sql')).toContain("posted'', ''reversed")
  })

  it('the probe and the combined VERIFY only read: no write, no temporary object', () => {
    for (const file of ['PROBE-m5-state.sql', 'VERIFY-m5-combined.sql']) {
      expect(statements(doc(file)), file).not.toMatch(
        /\b(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TRUNCATE|GRANT|REVOKE|COMMENT)\b/i,
      )
    }
  })
})
