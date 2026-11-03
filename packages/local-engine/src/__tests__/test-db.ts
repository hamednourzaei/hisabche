// ============================================
// packages/local-engine/src/__tests__/test-db.ts
//
// In-memory SQLite test database populated with CREATE_STATEMENTS.
// ============================================

import { DatabaseSync } from 'node:sqlite'
import { CREATE_STATEMENTS } from '@hisabche/app-bridge'
import type { LocalDb, RunResult } from '../db'
import { createLocalEngine, type LocalEngine } from '../index'

export const TEST_WORKSPACE_ID = '11111111-1111-4111-8111-111111111111'
export const TEST_USER_ID = '22222222-2222-4222-8222-222222222222'
export const TEST_WAREHOUSE_ID = '33333333-3333-4333-8333-333333333333'

export function createTestDb(filePath = ':memory:'): ClosableLocalDb {
  const db = new DatabaseSync(filePath)

  // Apply all schema tables and indexes
  for (const stmt of CREATE_STATEMENTS) {
    db.exec(stmt)
  }

  // Seed default workspace, user, and central warehouse
  db.exec(`
    INSERT INTO local_workspace (id, name, base_currency, time_zone, created_at, updated_at)
    VALUES ('${TEST_WORKSPACE_ID}', 'فروشگاه تستی', 'AFN', 'Asia/Kabul', datetime('now'), datetime('now'));

    INSERT INTO local_user (id, email, full_name, role, created_at, updated_at)
    VALUES ('${TEST_USER_ID}', 'test@hisabche.local', 'مدیر فروشگاه', 'owner', datetime('now'), datetime('now'));

    INSERT INTO warehouse (id, workspace_id, name, location, is_active, created_at, updated_at)
    VALUES ('${TEST_WAREHOUSE_ID}', '${TEST_WORKSPACE_ID}', 'انبار مرکزی', 'کابل', 1, datetime('now'), datetime('now'));
  `)

  return wrap(db)
}

/**
 * The same database, opened again from a file on disk — the second launch of
 * an app that was closed while a write was still waiting to sync.
 *
 * The schema statements are re-applied (they are all `IF NOT EXISTS`), the
 * seed is NOT: the rows that matter are the ones the previous process wrote.
 */
export function reopenTestDb(filePath: string): ClosableLocalDb {
  const db = new DatabaseSync(filePath)
  for (const stmt of CREATE_STATEMENTS) db.exec(stmt)
  return wrap(db)
}

/** `close` exists so a test can end the process the way the app does. */
export type ClosableLocalDb = LocalDb & { close(): void }

function wrap(db: DatabaseSync): ClosableLocalDb {
  let inTransaction = false

  return {
    all<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[] {
      const stmt = db.prepare(sql)
      return (params && params.length > 0 ? stmt.all(...(params as never[])) : stmt.all()) as T[]
    },
    get<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | undefined {
      const stmt = db.prepare(sql)
      return (params && params.length > 0 ? stmt.get(...(params as never[])) : stmt.get()) as
        T | undefined
    },
    run(sql: string, params?: unknown[]): RunResult {
      const stmt = db.prepare(sql)
      const res = (params && params.length > 0 ? stmt.run(...(params as never[])) : stmt.run()) as {
        changes?: number
        lastInsertRowid?: number | bigint
      }
      return {
        changes: Number(res.changes) || 0,
        lastInsertRowid: res.lastInsertRowid,
      }
    },
    exec(sql: string): void {
      db.exec(sql)
    },
    transaction<T>(fn: () => T): T {
      if (inTransaction) {
        return fn()
      }
      inTransaction = true
      db.exec('BEGIN')
      try {
        const result = fn()
        db.exec('COMMIT')
        return result
      } catch (err) {
        db.exec('ROLLBACK')
        throw err
      } finally {
        inTransaction = false
      }
    },
    close(): void {
      db.close()
    },
  }
}

/**
 * The engine as a SIGNED-IN device sees it: the host bridge stamps the session's
 * user on every request (app-shell providers.tsx), so a request that names nobody
 * is not a realistic one. A test that names a user itself — to be somebody else,
 * or nobody — wins over this default. The identity tests use `createLocalEngine`
 * directly, with no wrapper.
 */
export function createTestEngine(db: LocalDb): LocalEngine {
  const engine = createLocalEngine(db)
  return {
    routeTable: () => engine.routeTable(),
    request: (req) =>
      engine.request({
        ...req,
        headers: {
          'x-user-id': TEST_USER_ID,
          ...req.headers,
        },
      }),
  }
}
