// ============================================
// v11 -> v12 on a real SQLite file: offering_type on product table.
// A product recorded before v12 keeps its row and defaults to 'goods'; running twice is harmless.
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

function v11WithAProduct(): DatabaseSync {
  const file = path.join(os.tmpdir(), `hisabche-v11p-${Date.now()}-${Math.random()}.db`)
  CREATED.push(file)
  const db = new DatabaseSync(file)
  db.exec(`
    CREATE TABLE product (
      id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL DEFAULT '', name TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 0, buy_price INTEGER NOT NULL DEFAULT 0,
      sell_price INTEGER NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );
    INSERT INTO product (id, workspace_id, name, quantity, buy_price, sell_price, is_active, updated_at)
      VALUES ('p1', 'w1', 'Existing Widget', 5, 100, 200, 1, '2026-10-01');
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

describe('v11 -> v12 migration', () => {
  it('keeps a v11 product and assigns default offering_type = goods', () => {
    const db = v11WithAProduct()
    applyFrom(db, 11)
    const row = db.prepare('SELECT * FROM product WHERE id = ?').get('p1') as Record<
      string,
      unknown
    >
    expect(row.name).toBe('Existing Widget')
    expect(row.offering_type).toBe('goods')
  })

  it('is idempotent and can be safely re-run', () => {
    const db = v11WithAProduct()
    applyFrom(db, 11)
    expect(() => applyFrom(db, 11)).not.toThrow()
    const n = db.prepare('SELECT COUNT(*) AS n FROM product').get() as { n: number }
    expect(n.n).toBe(1)
  })
})
