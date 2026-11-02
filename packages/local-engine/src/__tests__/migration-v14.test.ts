// ============================================
// packages/local-engine/src/__tests__/migration-v14.test.ts
//
// v13 -> v14 on a real SQLite file: service_delivery_sessions table (M4).
// Creates service_delivery_sessions table and indexes; running twice is harmless.
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

function v13Database(): DatabaseSync {
  const file = path.join(os.tmpdir(), `hisabche-v13-${Date.now()}-${Math.random()}.db`)
  CREATED.push(file)
  const db = new DatabaseSync(file)
  db.exec(`
    CREATE TABLE product (
      id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL DEFAULT '', name TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 0, buy_price INTEGER NOT NULL DEFAULT 0,
      sell_price INTEGER NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1,
      offering_type TEXT NOT NULL DEFAULT 'goods', updated_at TEXT NOT NULL
    );
    CREATE TABLE package_credit_ledger (
      id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL DEFAULT '', customer_id TEXT NOT NULL,
      package_product_id TEXT NOT NULL, entry_type TEXT NOT NULL, quantity REAL NOT NULL DEFAULT 0,
      source_document_type TEXT, source_document_id TEXT, reference_entry_id TEXT, idempotency_key TEXT,
      deleted_at TEXT, effective_date TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT ''
    );
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

describe('v13 -> v14 migration (Service Delivery & Attendance)', () => {
  it('creates service_delivery_sessions table and permits CRUD operations', () => {
    const db = v13Database()
    applyFrom(db, 13)

    // Table exists
    const table = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='service_delivery_sessions'",
      )
      .get() as { name: string } | undefined
    expect(table?.name).toBe('service_delivery_sessions')

    // Insert session row
    db.exec(`
      INSERT INTO service_delivery_sessions (
        id, workspace_id, customer_id, service_offering_id, practitioner_id,
        session_date, start_time, end_time, duration_minutes, status, settlement_method,
        created_at, updated_at
      ) VALUES (
        'ses-1', 'w1', 'c1', 'srv-1', 'p1',
        '2026-11-01', '09:00', '10:00', 60, 'scheduled', 'package_credit',
        '2026-11-01', '2026-11-01'
      );
    `)

    const row = db
      .prepare(
        'SELECT id, duration_minutes, status, settlement_method FROM service_delivery_sessions WHERE id = ?',
      )
      .get('ses-1') as {
      id: string
      duration_minutes: number
      status: string
      settlement_method: string
    }

    expect(row.id).toBe('ses-1')
    expect(row.duration_minutes).toBe(60)
    expect(row.status).toBe('scheduled')
    expect(row.settlement_method).toBe('package_credit')
  })

  it('is idempotent: running migration twice on the same SQLite file does not throw', () => {
    const db = v13Database()
    applyFrom(db, 13)
    expect(() => applyFrom(db, 13)).not.toThrow()
  })
})
