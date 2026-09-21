// ============================================
// better-sqlite3's surface, over Node's built-in SQLite.
//
// ⚠️ A SEAM, NOT A MOCK. better-sqlite3 is a native module built against
// Electron's Node ABI, so jest cannot load it — but the SQL, the transactions
// and the migrations still have to be exercised for real. Tests pass this
// driver to `initDatabaseWith`, and everything below it runs against a genuine
// SQLite.
//
// It lives here because two test files now need it, and a copied adapter is a
// copy that drifts: the day one of them learns about a new driver method, the
// other quietly keeps testing the old shape.
// ============================================

import { DatabaseSync } from 'node:sqlite'

export class TestDriver {
  private db: DatabaseSync

  constructor(path: string) {
    this.db = new DatabaseSync(path)
  }

  prepare(sql: string) {
    const statement = this.db.prepare(sql)
    return {
      all: (...params: unknown[]) => statement.all(...(params as never[])),
      get: (...params: unknown[]) => statement.get(...(params as never[])),
      run: (...params: unknown[]) => statement.run(...(params as never[])),
    }
  }

  exec(sql: string): void {
    this.db.exec(sql)
  }

  pragma(sql: string): unknown {
    // WAL is meaningless for :memory: and journal_mode is not settable there;
    // running it as a statement keeps the call site unchanged either way.
    try {
      this.db.exec(`PRAGMA ${sql}`)
    } catch {
      /* ignore — pragmas are tuning, not behaviour under test */
    }
    return null
  }

  /** Real BEGIN/COMMIT, so a failure mid-purge genuinely rolls back. */
  transaction<T extends (...args: never[]) => unknown>(fn: T): T {
    return ((...args: never[]) => {
      this.db.exec('BEGIN')
      try {
        const result = fn(...args)
        this.db.exec('COMMIT')
        return result
      } catch (error) {
        this.db.exec('ROLLBACK')
        throw error
      }
    }) as T
  }

  close(): void {
    this.db.close()
  }
}
