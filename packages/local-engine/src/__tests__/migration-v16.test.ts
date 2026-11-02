// ============================================
// packages/local-engine/src/__tests__/migration-v16.test.ts
//
// v15 -> v16 on a real SQLite file: a cancelled service session keeps WHY it was cancelled
// (`cancellation_reason`). A v15 session survives untouched with an empty reason; running twice is harmless.
// ============================================

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'

import { LOCAL_MIGRATIONS, isAlreadyApplied } from '../../../app-bridge/src/local-migrations'

const CREATED: string[] = []

// Only the migration this file is about: a LATER migration (v17 alters tables a hand-made v15 database never had) is its own test.
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

function v15Database(): DatabaseSync {
  const file = path.join(os.tmpdir(), `hisabche-v15-${Date.now()}-${Math.random()}.db`)
  CREATED.push(file)
  const db = new DatabaseSync(file)
  db.exec(`
    CREATE TABLE service_delivery_sessions (
      id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL DEFAULT '', customer_id TEXT NOT NULL,
      service_offering_id TEXT NOT NULL, practitioner_id TEXT, branch_id TEXT, session_date TEXT NOT NULL,
      start_time TEXT NOT NULL, end_time TEXT NOT NULL, duration_minutes INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL, settlement_method TEXT NOT NULL, package_credit_id TEXT, invoice_id TEXT,
      settlement_reason TEXT, client_notes TEXT, internal_notes TEXT, created_at TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT '', deleted_at TEXT, origin TEXT NOT NULL DEFAULT 'local',
      sync_state TEXT NOT NULL DEFAULT 'local_only'
    );
    INSERT INTO service_delivery_sessions (id, workspace_id, customer_id, service_offering_id, session_date,
      start_time, end_time, status, settlement_method)
      VALUES ('s1', 'w1', 'c1', 'o1', '2026-11-01', '10:00', '11:00', 'cancelled', 'complementary');
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

describe('v15 → v16 migration', () => {
  it('keeps a v15 session and adds the empty reason column', () => {
    const db = v15Database()
    applyFrom(db, 15)
    const row = db
      .prepare('SELECT * FROM service_delivery_sessions WHERE id = ?')
      .get('s1') as Record<string, unknown>
    expect(row.status).toBe('cancelled')
    expect(row.cancellation_reason).toBeNull()
  })

  it('is idempotent', () => {
    const db = v15Database()
    applyFrom(db, 15)
    expect(() => applyFrom(db, 15)).not.toThrow()
  })
})
