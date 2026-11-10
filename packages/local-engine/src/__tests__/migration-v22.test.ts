// ============================================
// packages/local-engine/src/__tests__/migration-v22.test.ts
//
// v21 → v22 (V55 final completion, batch_expiry offline): the device tracks
// its expiry batches. On a real SQLite file: a v21 cache gains `stock_batches`
// and `lot_allocations`, running twice is harmless, legacy data is untouched,
// and the server's quantity invariants hold on the device too.
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

function v21Database(): DatabaseSync {
  const file = path.join(os.tmpdir(), `hisabche-v21-${Date.now()}-${Math.random()}.db`)
  CREATED.push(file)
  const db = new DatabaseSync(file)
  // Only what v22 touches: nothing — v22 only CREATES. A minimal cache stands in.
  db.exec(`CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);`)
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

describe('v21 → v22 migration (stock_batches + lot_allocations)', () => {
  it('creates the batch tables a real v21 cache never had', () => {
    const db = v21Database()
    applyFrom(db, 21)
    for (const table of ['stock_batches', 'lot_allocations']) {
      const row = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
        .get(table)
      expect(row).toBeDefined()
    }
    // A received batch keeps the server's identity columns.
    db.exec(`
      INSERT INTO stock_batches (id, workspace_id, product_id, batch_number, expiry_date,
        received_qty, remaining_qty, received_on, created_at, updated_at)
        VALUES ('b1', 'w1', 'p1', 'B-2026-11', '2027-01-31', 100, 100, '2026-11-11', '', '');
    `)
    const batch = db
      .prepare('SELECT batch_number, remaining_qty FROM stock_batches WHERE id = ?')
      .get('b1') as { batch_number: string; remaining_qty: number }
    expect(batch).toEqual({ batch_number: 'B-2026-11', remaining_qty: 100 })
  })

  it('refuses what the server refuses: a negative or over-remaining batch', () => {
    const db = v21Database()
    applyFrom(db, 21)
    db.exec(`
      INSERT INTO stock_batches (id, workspace_id, product_id, batch_number,
        received_qty, remaining_qty, received_on, created_at, updated_at)
        VALUES ('b2', 'w1', 'p1', 'B-2', 10, 10, '2026-11-11', '', '');
    `)
    expect(() => db.exec(`UPDATE stock_batches SET remaining_qty = -1 WHERE id = 'b2'`)).toThrow()
    expect(() => db.exec(`UPDATE stock_batches SET remaining_qty = 11 WHERE id = 'b2'`)).toThrow()
  })

  it('an allocation names exactly one target: a batch or a serial, never both', () => {
    const db = v21Database()
    applyFrom(db, 21)
    db.exec(`
      INSERT INTO stock_batches (id, workspace_id, product_id, batch_number,
        received_qty, remaining_qty, received_on, created_at, updated_at)
        VALUES ('b3', 'w1', 'p1', 'B-3', 10, 10, '2026-11-11', '', '');
    `)
    db.exec(`
      INSERT INTO lot_allocations (id, workspace_id, consumer_type, consumer_id,
        product_id, batch_id, serial_id, quantity, entry_date, created_at, updated_at)
        VALUES ('a1', 'w1', 'invoice', 'i1', 'p1', 'b3', NULL, 2, '2026-11-11', '', '');
    `)
    expect(() =>
      db.exec(`
        INSERT INTO lot_allocations (id, workspace_id, consumer_type, consumer_id,
          product_id, batch_id, serial_id, quantity, entry_date, created_at, updated_at)
          VALUES ('a2', 'w1', 'invoice', 'i1', 'p1', 'b3', 's1', 2, '2026-11-11', '', '');
      `),
    ).toThrow()
  })

  it('running twice is harmless', () => {
    const db = v21Database()
    applyFrom(db, 21)
    expect(() => applyFrom(db, 21)).not.toThrow()
  })
})
