// ============================================
// v12 -> v13 on a real SQLite file: package_credit_ledger table (M3).
// Creates package_credit_ledger table and indexes; running twice is harmless.
// ============================================

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'

import { LOCAL_MIGRATIONS, isAlreadyApplied } from '../../../app-bridge/src/local-migrations'

const CREATED: string[] = []

function applyFrom(db: DatabaseSync, from: number): void {
  for (const migration of LOCAL_MIGRATIONS.filter((m) => m.to > from && m.to <= from + 1)) {
    for (const statement of migration.statements) {
      try {
        db.exec(statement)
      } catch (error) {
        if (!isAlreadyApplied(error)) throw error
      }
    }
  }
}

function v12Database(): DatabaseSync {
  const file = path.join(os.tmpdir(), `hisabche-v12-${Date.now()}-${Math.random()}.db`)
  CREATED.push(file)
  const db = new DatabaseSync(file)
  db.exec(`
    CREATE TABLE product (
      id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL DEFAULT '', name TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 0, buy_price INTEGER NOT NULL DEFAULT 0,
      sell_price INTEGER NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1,
      offering_type TEXT NOT NULL DEFAULT 'goods', updated_at TEXT NOT NULL
    );
    INSERT INTO product (id, workspace_id, name, quantity, buy_price, sell_price, is_active, offering_type, updated_at)
      VALUES ('pkg-1', 'w1', '10-Session Course', 0, 0, 10000, 1, 'package', '2026-11-01');
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

describe('v12 -> v13 migration (Package Credit Ledger)', () => {
  it('creates package_credit_ledger table and permits CRUD operations', () => {
    const db = v12Database()
    applyFrom(db, 12)

    // Table exists
    expect(() =>
      db.prepare('SELECT COUNT(*) AS count FROM package_credit_ledger').get(),
    ).not.toThrow()

    // Insert a GRANT entry
    db.prepare(
      `
      INSERT INTO package_credit_ledger (
        id, workspace_id, customer_id, package_product_id, entry_type, quantity,
        unit, source_document_type, source_document_id, effective_date, created_at, updated_at
      ) VALUES (
        'pce-1', 'w1', 'cust-1', 'pkg-1', 'GRANT', 10,
        'session', 'invoice', 'inv-1', '2026-11-01', '2026-11-01T10:00:00Z', '2026-11-01T10:00:00Z'
      )
    `,
    ).run()

    const row = db
      .prepare('SELECT * FROM package_credit_ledger WHERE id = ?')
      .get('pce-1') as Record<string, unknown>
    expect(row.entry_type).toBe('GRANT')
    expect(row.quantity).toBe(10)
    expect(row.customer_id).toBe('cust-1')
    expect(row.package_product_id).toBe('pkg-1')
  })

  it('is idempotent and can be safely re-run without error', () => {
    const db = v12Database()
    applyFrom(db, 12)
    expect(() => applyFrom(db, 12)).not.toThrow()
  })
})
