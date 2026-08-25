// ============================================
// Minimal ambient types for Node's built-in SQLite.
//
// `node:sqlite` shipped in Node 22 and is typed from @types/node v22. This
// workspace pins @types/node 20, and bumping it across the monorepo to type a
// single test driver is a much larger change than the problem warrants.
//
// Only the members the test driver actually calls are declared. Deliberately
// NOT a `declare module '*'` catch-all: a wrong call should still fail to
// compile.
//
// Delete this file when @types/node reaches 22 here.
// ============================================

declare module 'node:sqlite' {
  export class StatementSync {
    all(...params: unknown[]): unknown[]
    get(...params: unknown[]): unknown
    run(...params: unknown[]): unknown
  }

  export class DatabaseSync {
    constructor(path: string)
    prepare(sql: string): StatementSync
    exec(sql: string): void
    close(): void
  }
}
