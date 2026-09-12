// ============================================
// «فروش امروز» read zero on a day with sales.
//
// ---------------------------------------------------------------------------
// ⚠️ THE COLUMN IT ASKED WAS NULL
//
// Today's figures filtered on `created_at`:
//
//     i.created_at >= today.toISOString() && i.created_at < tomorrow.toISOString()
//
// `created_at` is NULLABLE, and it IS null on real production rows. The schema
// files declare `DEFAULT now()`, but they create the table with
// `CREATE TABLE IF NOT EXISTS` — so on a database where `invoices` already
// existed the default was never added, and nothing failed. A production query
// returned `created_at: null` on INV-000050, 51 and 52, and on the one
// `stock_movements` row.
//
// In JavaScript `null >= '2026-09-12T00:00:00Z'` is **false**, not an error.
// So every such invoice dropped out of the filter and today's sales read zero
// — indistinguishable from a shop that sold nothing, which is a claim about
// someone's business.
//
// `date` is `NOT NULL`, and it is the right question anyway: an invoice
// entered tonight for yesterday's sale belongs to yesterday.
//
// The column default is restored separately by
// `docs/module-created-at-default-migration.sql`, which deliberately does NOT
// backfill the old rows — see §12 in that file.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '')
}

const service = code(join(__dirname, '..', 'services', 'invoice.service.ts'))

describe("today's figures use a column that is never null", () => {
  it('⚠️ no longer compares against created_at', () => {
    expect(service).not.toContain('i.created_at >= today.toISOString()')
    expect(service).not.toContain('i.created_at < tomorrow.toISOString()')
  })

  it('asks `date`, which is NOT NULL', () => {
    expect(service).toContain('isOnDay(i.date, today, tomorrow)')
    expect(service).toContain("'total, paid_amount, status, date, type'")
  })
})

describe('the comparison is explicit about a missing value', () => {
  it('⚠️ a missing or unparseable date is false, not today', () => {
    // The bare `>=` gave the same safe answer by accident, which is exactly
    // why nobody noticed it was answering at all.
    const helper = service.slice(service.indexOf('function isOnDay'))
    expect(helper).toContain("if (typeof value !== 'string' || value === '') return false")
    expect(helper).toContain('if (Number.isNaN(at.getTime())) return false')
  })

  it('the window is half-open, so a sale at midnight lands on one day only', () => {
    const helper = service.slice(service.indexOf('function isOnDay'))
    expect(helper).toContain('return at >= from && at < to')
  })
})

describe('the migration exists and does not invent data', () => {
  const raw = readFileSync(
    join(__dirname, '..', '..', '..', 'docs', 'module-created-at-default-migration.sql'),
    'utf8',
  )

  // ⚠️ SQL COMMENTS STRIPPED FOR THE «does not backfill» ASSERTION.
  //
  // That file explains WHY the backfill is forbidden by quoting the statement
  // it refuses to run. Matching the raw text made the guard fail on its own
  // documentation — the same trap the TSX guards in `packages/ui` hit, where a
  // `not.toMatch` fires on the comment describing the defect. A guard must not
  // punish the file for being well explained.
  const migration = raw.replace(/--.*$/gm, '')

  it('restores the default', () => {
    expect(raw).toContain('ALTER TABLE invoices        ALTER COLUMN created_at SET DEFAULT now()')
    expect(raw).toContain('ALTER TABLE stock_movements ALTER COLUMN created_at SET DEFAULT now()')
  })

  it('⚠️ does NOT backfill created_at from date', () => {
    // `date` is when the business says it happened; `created_at` is when the
    // row was written. Stamping one onto the other produces an audit trail
    // that reads as fact and is not.
    expect(migration).not.toMatch(/UPDATE\s+invoices\s+SET\s+created_at/i)
    expect(migration).not.toMatch(/created_at\s*=\s*date/i)
  })

  it('carries a rollback block, as every migration here must', () => {
    expect(raw).toContain('ROLLBACK / MITIGATION')
    expect(raw).toContain('DROP DEFAULT')
  })
})
