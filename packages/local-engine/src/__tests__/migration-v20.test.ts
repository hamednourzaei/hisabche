// ============================================
// packages/local-engine/src/__tests__/migration-v20.test.ts
//
// v19 → v20 (V55 P2): a line keeps the VARIANT it sold, bought or moved.
// On a real SQLite file: a v19 row survives untouched with NULL — NULL is «no
// variant», never re-mapped — and running the migration twice is harmless.
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

/** Only what v19 needed of the three tables — v20 only adds a column to each. */
function v19Database(): DatabaseSync {
  const file = path.join(os.tmpdir(), `hisabche-v19-${Date.now()}-${Math.random()}.db`)
  CREATED.push(file)
  const db = new DatabaseSync(file)
  db.exec(`
    CREATE TABLE invoice_item (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL,
      product_id TEXT,
      quantity REAL NOT NULL DEFAULT 0
    );
    CREATE TABLE inventory_movement (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 0
    );
    CREATE TABLE purchase_order_item (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 0
    );
    INSERT INTO invoice_item (id, invoice_id, product_id, quantity)
      VALUES ('i1', 'inv-1', 'p1', 2);
    INSERT INTO inventory_movement (id, product_id, quantity) VALUES ('m1', 'p1', -2);
    INSERT INTO purchase_order_item (id, product_id, quantity) VALUES ('l1', 'p1', 5);
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

describe('v19 → v20 migration (variant identity)', () => {
  it('a v19 row survives untouched with NULL variant_id (no variant, not «wrong variant»)', () => {
    const db = v19Database()
    applyFrom(db, 19)
    const item = db.prepare('SELECT * FROM invoice_item WHERE id = ?').get('i1') as Record<
      string,
      unknown
    >
    const movement = db
      .prepare('SELECT * FROM inventory_movement WHERE id = ?')
      .get('m1') as Record<string, unknown>
    const line = db.prepare('SELECT * FROM purchase_order_item WHERE id = ?').get('l1') as Record<
      string,
      unknown
    >
    expect(item.quantity).toBe(2)
    expect(item.variant_id).toBeNull()
    expect(movement.quantity).toBe(-2)
    expect(movement.variant_id).toBeNull()
    expect(line.quantity).toBe(5)
    expect(line.variant_id).toBeNull()
  })

  it('adds the columns and the variant indexes', () => {
    const db = v19Database()
    applyFrom(db, 19)
    for (const table of ['invoice_item', 'inventory_movement', 'purchase_order_item']) {
      const column = db
        .prepare(`SELECT name FROM pragma_table_info(?) WHERE name = 'variant_id'`)
        .get(table)
      expect(column, table).toBeDefined()
    }
    for (const index of ['idx_invoice_item_variant', 'idx_movement_variant']) {
      const row = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?")
        .get(index)
      expect(row, index).toBeDefined()
    }
  })

  it('running twice is harmless (a lost version row does not corrupt the cache)', () => {
    const db = v19Database()
    applyFrom(db, 19)
    expect(() => applyFrom(db, 19)).not.toThrow()
  })

  it('a named variant survives the migration with its identity', () => {
    const db = v19Database()
    applyFrom(db, 19)
    db.prepare(
      "UPDATE invoice_item SET variant_id = '44444444-4444-4444-8444-444444444441' WHERE id = 'i1'",
    ).run()
    const row = db.prepare('SELECT variant_id FROM invoice_item WHERE id = ?').get('i1') as {
      variant_id: string
    }
    expect(row.variant_id).toBe('44444444-4444-4444-8444-444444444441')
  })
})
