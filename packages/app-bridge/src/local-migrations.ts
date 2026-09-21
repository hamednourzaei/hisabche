// ============================================
// Migrating a cache that is already on somebody's machine.
//
// ⚠️ `CREATE TABLE IF NOT EXISTS` IS NOT A MIGRATION.
//
// It creates a table on a fresh install and does NOTHING on a device that
// already has one — so a column added to the schema exists for new users and
// is missing for everybody else. The app then writes SQL naming a column the
// local database has never heard of, and every read of that table fails on
// exactly the machines that have been running longest.
//
// `schema_version` was already being written to `meta` on both hosts. Nothing
// ever read it back. This is what reads it.
//
// The statements are plain SQL and each host runs them with its own driver,
// the same arrangement as `local-sql.ts`.
// ============================================

import { SCHEMA_VERSION, WRITABLE_COLUMNS } from './local-schema'

export interface LocalMigration {
  /** The version this migration brings the cache UP TO. */
  to: number
  /**
   * ⚠️ Every statement must be safe to run twice.
   *
   * A migration that fails halfway leaves the version unchanged, so the next
   * launch runs it again from the top — and SQLite has no transactional DDL
   * to lean on for some of these.
   */
  statements: readonly string[]
}

/**
 * v2 — optimistic concurrency.
 *
 * Without a local `version` the client cannot tell the server which copy it
 * edited, so `/api/sync/push` has nothing to compare and every conflicting
 * edit resolves as last-write-wins, silently. Defaulting to 1 is correct for
 * rows already cached: the next pull overwrites it with the server's number.
 */
const ADD_VERSION: LocalMigration = {
  to: 2,
  // ⚠️ The table name is QUOTED. One of these tables is called `transaction`,
  // which is a reserved word: unquoted, SQLite reads `ALTER TABLE transaction`
  // as the start of a transaction statement and answers `near "transaction":
  // syntax error`. The CREATE statements have always quoted it; the migration
  // has to as well, or start-up fails on every existing machine.
  statements: Object.keys(WRITABLE_COLUMNS).map(
    (table) => `ALTER TABLE "${table}" ADD COLUMN version INTEGER NOT NULL DEFAULT 1`,
  ),
}

export const LOCAL_MIGRATIONS: readonly LocalMigration[] = [ADD_VERSION]

/**
 * The statements needed to bring a cache at `from` up to the current version.
 *
 * ⚠️ A cache NEWER than this build gets nothing rather than being downgraded:
 * an older app opening a newer cache must not drop a column the newer app is
 * still writing to — the user may launch that one again tomorrow.
 */
export function migrationsFrom(from: number): readonly LocalMigration[] {
  if (from >= SCHEMA_VERSION) return []
  return LOCAL_MIGRATIONS.filter((migration) => migration.to > from)
}

/**
 * `duplicate column name` means the migration already ran — on a device whose
 * version row was lost, or where a half-applied run is being repeated.
 *
 * ⚠️ Recognised and IGNORED, not caught blindly: a genuine failure (a missing
 * table, a locked database) must still surface, or the cache silently stays
 * one version behind and every later migration is skipped too.
 */
export function isAlreadyApplied(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /duplicate column name/i.test(message)
}
