// ============================================
// The mobile host local API engine over expo-sqlite.
//
// ⚠️ SAME LOCAL ENGINE WINDOWS USES.
//
// Both desktop and mobile instantiate createLocalEngine()
// from @hisabche/local-engine over their host SQLite driver.
// Mobile wraps expo-sqlite into LocalDb with synchronous execution.
// ============================================

import type * as SQLite from 'expo-sqlite'
import {
  CREATE_STATEMENTS,
  SCHEMA_VERSION,
  isAlreadyApplied,
  migrationsFrom,
} from '@hisabche/app-bridge'
import {
  createLocalEngine,
  type LocalDb,
  type LocalEngine,
  type LocalEngineRequest,
  type LocalEngineResponse,
  type RunResult,
} from '@hisabche/local-engine'

let database: SQLite.SQLiteDatabase | null = null
let engine: LocalEngine | null = null
let inTransaction = false

function ensureInitialized(db: SQLite.SQLiteDatabase): void {
  db.execSync('PRAGMA journal_mode = WAL')
  db.execSync('PRAGMA foreign_keys = ON')

  for (const statement of CREATE_STATEMENTS) {
    db.execSync(statement)
  }

  const row = db.getFirstSync<{ value?: string }>(
    "SELECT value FROM meta WHERE key = 'schema_version'",
  )
  const from = Number(row?.value ?? 1) || 1

  for (const migration of migrationsFrom(from)) {
    for (const statement of migration.statements) {
      try {
        db.execSync(statement)
      } catch (error) {
        if (isAlreadyApplied(error)) continue
        throw error
      }
    }
  }

  db.runSync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', [
    'schema_version',
    String(SCHEMA_VERSION),
  ])
}

export interface ExpoSqliteDatabaseLike {
  getAllSync<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[]
  getFirstSync<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | null
  runSync(
    sql: string,
    params?: unknown[],
  ): { changes: number; lastInsertRowId?: number | bigint | undefined }
  execSync(sql: string): void
  withTransactionSync(fn: () => void): void
}

export function wrapExpoSqlite(db: ExpoSqliteDatabaseLike): LocalDb {
  return {
    all<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
      return db.getAllSync<T>(sql, params)
    },
    get<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | undefined {
      const res = db.getFirstSync<T>(sql, params)
      return res ?? undefined
    },
    run(sql: string, params: unknown[] = []): RunResult {
      const res = db.runSync(sql, params)
      return {
        changes: res.changes,
        lastInsertRowid: res.lastInsertRowId,
      }
    },
    exec(sql: string): void {
      db.execSync(sql)
    },
    transaction<T>(fn: () => T): T {
      if (inTransaction) {
        return fn()
      }
      inTransaction = true
      try {
        let result: T
        db.withTransactionSync(() => {
          result = fn()
        })
        return result!
      } finally {
        inTransaction = false
      }
    },
  }
}

export function getMobileLocalDb(customDb?: ExpoSqliteDatabaseLike): LocalDb {
  if (customDb) {
    return wrapExpoSqlite(customDb)
  }
  if (!database) {
    const SQLite = require('expo-sqlite') as typeof import('expo-sqlite')
    const db = SQLite.openDatabaseSync('hisabche.db')
    ensureInitialized(db)
    database = db
  }
  return wrapExpoSqlite(database as unknown as ExpoSqliteDatabaseLike)
}

export function getMobileLocalEngine(): LocalEngine {
  if (!engine) {
    engine = createLocalEngine(getMobileLocalDb())
  }
  return engine
}

export async function handleMobileLocalApiRequest(
  req: LocalEngineRequest,
): Promise<LocalEngineResponse> {
  const localEngine = getMobileLocalEngine()
  return localEngine.request(req)
}
