// ============================================
// packages/local-engine/src/db.ts
//
// The abstraction over the host's SQLite engine.
// Electron passes better-sqlite3 in the main process.
// Expo passes expo-sqlite behind the native bridge.
// Tests pass node:sqlite or in-memory better-sqlite3.
// ============================================

export interface RunResult {
  changes: number
  lastInsertRowid?: number | bigint | undefined
}

export interface LocalDb {
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[]
  get<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | undefined
  run(sql: string, params?: unknown[]): RunResult
  exec(sql: string): void
  transaction<T>(fn: () => T): T
}
