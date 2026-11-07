// ============================================
// v10 → v11 on a real SQLite file: a stock movement remembers where it went.
// A movement recorded before v11 keeps its row and gets NULL places (nothing is guessed); running twice is harmless.
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

function v10WithAMovement(): DatabaseSync {
  const file = path.join(os.tmpdir(), `hisabche-v10m-${Date.now()}-${Math.random()}.db`)
  CREATED.push(file)
  const db = new DatabaseSync(file)
  db.exec(`
    CREATE TABLE product (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL DEFAULT '', name TEXT NOT NULL DEFAULT '');
    CREATE TABLE inventory_movement (
      id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL DEFAULT '', product_id TEXT NOT NULL,
      type TEXT NOT NULL, quantity REAL NOT NULL DEFAULT 0, reference TEXT, date TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    INSERT INTO inventory_movement (id, workspace_id, product_id, type, quantity, reference, date, updated_at)
      VALUES ('m1', 'w1', 'p1', 'transfer', 4, 'Transfer from A to B', '2026-10-01', '2026-10-01');
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

describe('v10 → v11 migration', () => {
  it('keeps a v10 movement and gives it empty places', () => {
    const db = v10WithAMovement()
    applyFrom(db, 10)
    const row = db.prepare('SELECT * FROM inventory_movement WHERE id = ?').get('m1') as Record<
      string,
      unknown
    >
    expect(row.quantity).toBe(4)
    expect(row.reference).toBe('Transfer from A to B')
    expect(row.from_warehouse_id).toBeNull()
    expect(row.to_warehouse_id).toBeNull()
  })

  it('is idempotent', () => {
    const db = v10WithAMovement()
    applyFrom(db, 10)
    expect(() => applyFrom(db, 10)).not.toThrow()
    const n = db.prepare('SELECT COUNT(*) AS n FROM inventory_movement').get() as { n: number }
    expect(n.n).toBe(1)
  })
})
