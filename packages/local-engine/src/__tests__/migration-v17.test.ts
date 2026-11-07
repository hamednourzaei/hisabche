// ============================================
// packages/local-engine/src/__tests__/migration-v17.test.ts
//
// v16 -> v17 on a real SQLite file (M5): the GRANT remembers its deferred amount and term, a package product has a term, and
// the device gets the allocation and suspension tables. A v16 GRANT survives untouched with empty (legacy) values -
// "sold before the cut-over" is NULL, never zero - and running twice is harmless.
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

function v16Database(): DatabaseSync {
  const file = path.join(os.tmpdir(), `hisabche-v16-${Date.now()}-${Math.random()}.db`)
  CREATED.push(file)
  const db = new DatabaseSync(file)
  db.exec(`
    CREATE TABLE product (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL DEFAULT '', name TEXT, offering_type TEXT NOT NULL DEFAULT 'goods');
    CREATE TABLE package_credit_ledger (
      id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL DEFAULT '', customer_id TEXT NOT NULL, package_product_id TEXT NOT NULL,
      entry_type TEXT NOT NULL, quantity REAL NOT NULL DEFAULT 0, unit TEXT, source_document_type TEXT, source_document_id TEXT,
      source_line_id TEXT, reference_entry_id TEXT, idempotency_key TEXT, notes TEXT, expires_at TEXT,
      effective_date TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT '', deleted_at TEXT,
      origin TEXT NOT NULL DEFAULT 'local', sync_state TEXT NOT NULL DEFAULT 'local_only'
    );
    INSERT INTO product (id, workspace_id, name, offering_type) VALUES ('p1', 'w1', 'Course', 'package');
    INSERT INTO package_credit_ledger (id, workspace_id, customer_id, package_product_id, entry_type, quantity, effective_date)
      VALUES ('g1', 'w1', 'c1', 'p1', 'GRANT', 10, '2026-10-01');
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

describe('v16 → v17 migration', () => {
  it('keeps a v16 GRANT and gives it EMPTY deferred amount and term (legacy is NULL, not zero)', () => {
    const db = v16Database()
    applyFrom(db, 16)
    const row = db.prepare('SELECT * FROM package_credit_ledger WHERE id = ?').get('g1') as Record<
      string,
      unknown
    >
    expect(row.quantity).toBe(10)
    expect(row.deferred_amount).toBeNull()
    expect(row.term_months).toBeNull()
  })

  it('gives a package product a term column, empty for existing products', () => {
    const db = v16Database()
    applyFrom(db, 16)
    const row = db.prepare('SELECT * FROM product WHERE id = ?').get('p1') as Record<
      string,
      unknown
    >
    expect(row.package_term_months).toBeNull()
  })

  it('creates the allocation table: one row per (entry, GRANT), and one unattributed row per entry', () => {
    const db = v16Database()
    applyFrom(db, 16)
    const insert = db.prepare(
      `INSERT INTO package_credit_allocations (id, workspace_id, entry_id, kind, grant_entry_id, quantity, released_amount, effective_date)
       VALUES (?, 'w1', ?, 'CONSUME', ?, 1, 100, '2026-11-02')`,
    )
    insert.run('a1', 'e1', 'g1')
    expect(() => insert.run('a2', 'e1', 'g1')).toThrow()
    insert.run('a3', 'e1', null)
    expect(() => insert.run('a4', 'e1', null)).toThrow()
  })

  it('creates the suspension table', () => {
    const db = v16Database()
    applyFrom(db, 16)
    db.prepare(
      `INSERT INTO package_credit_suspensions (id, workspace_id, grant_entry_id, kind, effective_on, reason) VALUES ('s1', 'w1', 'g1', 'SUSPEND', '2026-11-01', 'x')`,
    ).run()
    expect(db.prepare('SELECT COUNT(*) AS n FROM package_credit_suspensions').get()).toEqual({
      n: 1,
    })
  })

  it('is idempotent', () => {
    const db = v16Database()
    applyFrom(db, 16)
    expect(() => applyFrom(db, 16)).not.toThrow()
  })
})
