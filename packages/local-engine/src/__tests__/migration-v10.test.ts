// ============================================
// v9 → v10 on a real SQLite file: the return document becomes complete on the device.
//
// - a v9 return (header + line) survives untouched, new columns take their defaults
// - the deductions table exists and is writable
// - running the migration twice is harmless (a fresh cache and an upgraded one end up the same)
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

function v9WithAReturn(): DatabaseSync {
  const file = path.join(os.tmpdir(), `hisabche-v9r-${Date.now()}-${Math.random()}.db`)
  CREATED.push(file)
  const db = new DatabaseSync(file)
  db.exec(`
    CREATE TABLE product (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL DEFAULT '', name TEXT NOT NULL DEFAULT '');
    CREATE TABLE inventory_movement (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL DEFAULT '', product_id TEXT NOT NULL DEFAULT '', type TEXT NOT NULL DEFAULT '', quantity REAL NOT NULL DEFAULT 0, reference TEXT, date TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT '');
    CREATE TABLE invoice_returns (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL DEFAULT '',
      original_invoice_id TEXT NOT NULL,
      return_type TEXT NOT NULL,
      return_number TEXT NOT NULL,
      return_date TEXT NOT NULL,
      total_subtotal_minor INTEGER NOT NULL,
      total_discount_minor INTEGER NOT NULL DEFAULT 0,
      total_tax_minor INTEGER NOT NULL DEFAULT 0,
      grand_total_minor INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE invoice_return_lines (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL DEFAULT '',
      return_id TEXT NOT NULL,
      original_line_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity REAL NOT NULL,
      restock_choice TEXT NOT NULL,
      reason_code TEXT NOT NULL,
      subtotal_minor INTEGER NOT NULL,
      total_minor INTEGER NOT NULL
    );
    INSERT INTO invoice_returns (id, workspace_id, original_invoice_id, return_type, return_number,
      return_date, total_subtotal_minor, grand_total_minor)
      VALUES ('r1', 'w1', 'i1', 'sale_return', 'RET-1', '2026-10-01', 5000, 5000);
    INSERT INTO invoice_return_lines (id, workspace_id, return_id, original_line_id, product_id,
      quantity, restock_choice, reason_code, subtotal_minor, total_minor)
      VALUES ('l1', 'w1', 'r1', 'x', 'p1', 2, 'restock', 'other', 5000, 5000);
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

describe('v9 → v10 migration', () => {
  it('keeps a v9 return and gives it the new columns with neutral defaults', () => {
    const db = v9WithAReturn()
    applyFrom(db, 9)

    const header = db.prepare('SELECT * FROM invoice_returns WHERE id = ?').get('r1') as Record<
      string,
      unknown
    >
    expect(header.grand_total_minor).toBe(5000)
    expect(header.deduction_minor).toBe(0)
    expect(header.reason_code).toBeNull()
    expect(header.notes).toBeNull()
    expect(header.client_request_id).toBeNull()

    const line = db.prepare('SELECT * FROM invoice_return_lines WHERE id = ?').get('l1') as Record<
      string,
      unknown
    >
    expect(line.total_minor).toBe(5000)
    expect(line.condition_code).toBeNull()
  })

  it('creates a writable deductions table', () => {
    const db = v9WithAReturn()
    applyFrom(db, 9)
    db.prepare(
      `INSERT INTO invoice_return_deductions (id, workspace_id, return_id, reason_code, mode, percent, amount_minor)
       VALUES ('d1', 'w1', 'r1', 'return_fee', 'percent', 10, 500)`,
    ).run()
    const row = db
      .prepare('SELECT amount_minor FROM invoice_return_deductions WHERE id = ?')
      .get('d1') as {
      amount_minor: number
    }
    expect(row.amount_minor).toBe(500)
  })

  it('is idempotent: applying it twice changes nothing and throws nothing', () => {
    const db = v9WithAReturn()
    applyFrom(db, 9)
    expect(() => applyFrom(db, 9)).not.toThrow()
    const n = db.prepare('SELECT COUNT(*) AS n FROM invoice_returns').get() as { n: number }
    expect(n.n).toBe(1)
  })
})
