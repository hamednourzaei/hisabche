// ============================================
// packages/local-engine/src/__tests__/migration-v21.test.ts
//
// v20 → v21 (V55 P2, serialized_items): the device tracks its unit serials.
// On a real SQLite file: a v20 cache gains `stock_serials`, running twice is
// harmless, and the fitment join that has referenced this table since v9 can
// finally run on a device.
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

function v20Database(): DatabaseSync {
  const file = path.join(os.tmpdir(), `hisabche-v20-${Date.now()}-${Math.random()}.db`)
  CREATED.push(file)
  const db = new DatabaseSync(file)
  // Only what v21 touches: nothing — v21 only CREATES. A minimal cache stands in.
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

describe('v20 → v21 migration (stock_serials)', () => {
  it('creates the serials table a real v20 cache never had', () => {
    const db = v20Database()
    applyFrom(db, 20)
    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'stock_serials'")
      .get()
    expect(table).toBeDefined()
    // The fitment join (vehicle_attributes → stock_serials, since v9) runs now.
    db.exec(`
      CREATE TABLE vehicle_attributes (id TEXT PRIMARY KEY, serial_id TEXT NOT NULL);
      INSERT INTO stock_serials (id, workspace_id, product_id, serial_number, received_on, created_at, updated_at)
        VALUES ('s1', 'w1', 'p1', 'IMEI-1', '2026-11-11', '2026-11-11T00:00:00Z', '2026-11-11T00:00:00Z');
      INSERT INTO vehicle_attributes (id, serial_id) VALUES ('va1', 's1');
    `)
    const join = db
      .prepare(
        'SELECT va.id, ss.serial_number FROM vehicle_attributes va JOIN stock_serials ss ON ss.id = va.serial_id',
      )
      .get() as { id: string; serial_number: string }
    expect(join).toEqual({ id: 'va1', serial_number: 'IMEI-1' })
  })

  it('running twice is harmless', () => {
    const db = v20Database()
    applyFrom(db, 20)
    expect(() => applyFrom(db, 20)).not.toThrow()
  })
})
