// ============================================
// packages/local-engine/src/__tests__/migration-v19.test.ts
//
// v18 → v19 on a real SQLite file (V53 OD-3): the invoice row learns `credit_status`, the SERVER's answer
// to «may this customer take more credit?». A v18 invoice survives untouched with NULL — NULL is «no credit
// question was asked», never «refused» and never «ok» — and running the migration twice is harmless.
// ============================================

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'

import { LOCAL_MIGRATIONS, isAlreadyApplied } from '../../../app-bridge/src/local-migrations'

const CREATED: string[] = []

function applyFrom(db: DatabaseSync, from: number): void {
  for (const migration of LOCAL_MIGRATIONS.filter((m) => m.to > from)) {
    for (const statement of migration.statements) {
      try {
        db.exec(statement)
      } catch (error) {
        if (!isAlreadyApplied(error)) throw error
      }
    }
  }
}

/** Only what v18 needed of `invoice` — v19 only adds a column to it. */
function v18Database(): DatabaseSync {
  const file = path.join(os.tmpdir(), `hisabche-v18-${Date.now()}-${Math.random()}.db`)
  CREATED.push(file)
  const db = new DatabaseSync(file)
  db.exec(`
    CREATE TABLE invoice (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      updated_at TEXT NOT NULL DEFAULT ''
    );
    INSERT INTO invoice (id, workspace_id, status, updated_at)
      VALUES ('inv-1', 'w1', 'issued', '2026-11-01T00:00:00.000Z');
  `)
  return db
}

afterEach(() => {
  for (const file of CREATED.splice(0)) {
    try {
      fs.unlinkSync(file)
    } catch {
      // already gone
    }
  }
})

describe('v18 → v19 migration (credit_status)', () => {
  it('a v18 invoice survives untouched with NULL credit_status (no question was asked, not «refused»)', () => {
    const db = v18Database()
    applyFrom(db, 18)
    const row = db.prepare('SELECT * FROM invoice WHERE id = ?').get('inv-1') as Record<
      string,
      unknown
    >
    expect(row.status).toBe('issued')
    expect(row.credit_status).toBeNull()
  })

  it('adds the column and its index', () => {
    const db = v18Database()
    applyFrom(db, 18)
    const index = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_invoice_credit_status'",
      )
      .get()
    expect(index).toBeDefined()
    db.prepare("UPDATE invoice SET credit_status = 'pending_validation' WHERE id = 'inv-1'").run()
    const row = db.prepare('SELECT credit_status FROM invoice WHERE id = ?').get('inv-1') as {
      credit_status: string
    }
    expect(row.credit_status).toBe('pending_validation')
  })

  it('is idempotent', () => {
    const db = v18Database()
    applyFrom(db, 18)
    expect(() => applyFrom(db, 18)).not.toThrow()
  })
})
