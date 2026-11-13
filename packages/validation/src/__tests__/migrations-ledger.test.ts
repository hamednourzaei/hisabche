// ============================================
// packages/validation/src/__tests__/migrations-ledger.test.ts
//
// V64 §16 — one canonical migration ledger.
//
// The ledger cannot know which migrations a database has received (that lives in
// `supabase_migrations.schema_migrations`), so every row is
// `PENDING HUMAN CONFIRMATION` and §2 carries the query that resolves it. What
// the guard can hold is the inventory itself: every file on disk appears once,
// no row claims a status it was not given, and the owner's query stays in the
// document.
// ============================================

import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../../../..')
const DOC = resolve(ROOT, 'docs/MIGRATIONS-PENDING.md')
const GENERATOR = resolve(ROOT, 'scripts/migrations/pending-ledger.mjs')

const doc = readFileSync(DOC, 'utf8')
const migrations = readdirSync(resolve(ROOT, 'docs'))
  .filter((name) => name.endsWith('-migration.sql'))
  .sort()

const rows = doc
  .split(/\r?\n/)
  // Prettier pads table cells (`| 1   |`), so match the cell, not its spacing.
  .filter((line) => /^\|\s*\d+\s*\|/.test(line))
  .map((line) => line.split('|').map((cell) => cell.trim()))

describe('docs/MIGRATIONS-PENDING.md — the canonical ledger', () => {
  it('is not stale', () => {
    const run = spawnSync(process.execPath, [GENERATOR, '--check'], { encoding: 'utf8' })
    expect(run.stderr.trim(), 'run node scripts/migrations/pending-ledger.mjs').toBe('')
    expect(run.status).toBe(0)
  })

  it('lists every migration on disk exactly once, in a fixed order', () => {
    expect(rows.map((cells) => cells[2]?.replaceAll('`', ''))).toEqual(migrations)
    expect(rows.length).toBe(migrations.length)
  })

  it('never claims a migration is applied', () => {
    // The one honest status without database access.
    for (const cells of rows) {
      expect(cells.at(-2), `${cells[2]}`).toBe('PENDING HUMAN CONFIRMATION')
    }
    const statuses = new Set(rows.map((cells) => cells.at(-2)))
    expect([...statuses]).toEqual(['PENDING HUMAN CONFIRMATION'])
  })

  it('keeps the read-only query that turns the ledger into an answer', () => {
    expect(doc).toContain('supabase_migrations.schema_migrations')
    expect(doc).toContain('select version, name, inserted_at')
    // …and says the table order is not a dependency order, so nobody runs it as one.
    expect(doc).toMatch(/not a dependency\s+order/i)
  })

  it('names the gaps instead of hiding them', () => {
    const withoutVerify = rows.filter((cells) => cells[4] === '—').length
    const withoutTest = rows.filter((cells) => cells[6] === '—').length
    // Prettier pads the count cell, so the row is matched as a whole.
    const verifyRow = new RegExp(
      `\\| Migration without a \`VERIFY-\\*\` file \\|\\s*${withoutVerify}\\s*\\|`,
    )
    const testRow = new RegExp(
      `\\| Migration without a \`\\*\\.pg\\.test\\.ts\`\\s*\\|\\s*${withoutTest}\\s*\\|`,
    )
    expect(doc).toMatch(verifyRow)
    expect(doc).toMatch(testRow)
  })
})
