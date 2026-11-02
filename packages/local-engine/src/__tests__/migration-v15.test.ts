// ============================================
// packages/local-engine/src/__tests__/migration-v15.test.ts
//
// v14 -> v15 on a real SQLite file (M4 audit):
//   - service_delivery_sessions gains `settlement_reason` (why a complementary session was free)
//   - the ledger can hold ONE consume and ONE reversal per service session — a second is a constraint failure,
//     not something a retry or a second device can write
// A v14 session survives untouched; running twice is harmless.
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

function v14Database(): DatabaseSync {
  const file = path.join(os.tmpdir(), `hisabche-v14-${Date.now()}-${Math.random()}.db`)
  CREATED.push(file)
  const db = new DatabaseSync(file)
  db.exec(`
    CREATE TABLE package_credit_ledger (
      id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL DEFAULT '', customer_id TEXT NOT NULL,
      package_product_id TEXT NOT NULL, entry_type TEXT NOT NULL, quantity REAL NOT NULL DEFAULT 0,
      unit TEXT, source_document_type TEXT, source_document_id TEXT, source_line_id TEXT,
      reference_entry_id TEXT, idempotency_key TEXT, notes TEXT, expires_at TEXT,
      effective_date TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT '',
      deleted_at TEXT, origin TEXT NOT NULL DEFAULT 'local', sync_state TEXT NOT NULL DEFAULT 'local_only'
    );
    CREATE TABLE service_delivery_sessions (
      id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL DEFAULT '', customer_id TEXT NOT NULL,
      service_offering_id TEXT NOT NULL, practitioner_id TEXT, branch_id TEXT, session_date TEXT NOT NULL,
      start_time TEXT NOT NULL, end_time TEXT NOT NULL, duration_minutes INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL, settlement_method TEXT NOT NULL, package_credit_id TEXT, invoice_id TEXT,
      client_notes TEXT, internal_notes TEXT, created_at TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT '', deleted_at TEXT, origin TEXT NOT NULL DEFAULT 'local',
      sync_state TEXT NOT NULL DEFAULT 'local_only'
    );
    INSERT INTO service_delivery_sessions (id, workspace_id, customer_id, service_offering_id, session_date,
      start_time, end_time, status, settlement_method)
      VALUES ('s1', 'w1', 'c1', 'o1', '2026-11-01', '10:00', '11:00', 'delivered', 'complementary');
  `)
  return db
}

const ledgerRow = (db: DatabaseSync, id: string, type: string, session: string) =>
  db
    .prepare(
      `INSERT INTO package_credit_ledger (id, workspace_id, customer_id, package_product_id, entry_type, quantity,
         source_document_type, source_document_id, effective_date)
       VALUES (?, 'w1', 'c1', 'p1', ?, 1, 'service_delivery', ?, '2026-11-01')`,
    )
    .run(id, type, session)

afterEach(() => {
  for (const file of CREATED.splice(0)) {
    try {
      fs.unlinkSync(file)
    } catch {
      // already gone
    }
  }
})

describe('v14 → v15 migration', () => {
  it('keeps a v14 session and adds the empty reason column', () => {
    const db = v14Database()
    applyFrom(db, 14)
    const row = db
      .prepare('SELECT * FROM service_delivery_sessions WHERE id = ?')
      .get('s1') as Record<string, unknown>
    expect(row.status).toBe('delivered')
    expect(row.settlement_reason).toBeNull()
  })

  it('allows one consume and one reversal per session, and refuses a second of either', () => {
    const db = v14Database()
    applyFrom(db, 14)
    ledgerRow(db, 'c1', 'CONSUME', 's1')
    expect(() => ledgerRow(db, 'c2', 'CONSUME', 's1')).toThrow(/UNIQUE/)
    ledgerRow(db, 'r1', 'REVERSAL', 's1')
    expect(() => ledgerRow(db, 'r2', 'REVERSAL', 's1')).toThrow(/UNIQUE/)
    // another session is independent
    expect(() => ledgerRow(db, 'c3', 'CONSUME', 's2')).not.toThrow()
  })

  it('is idempotent', () => {
    const db = v14Database()
    applyFrom(db, 14)
    expect(() => applyFrom(db, 14)).not.toThrow()
  })
})
