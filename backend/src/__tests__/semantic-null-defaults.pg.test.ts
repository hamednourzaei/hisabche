// ============================================
// docs/semantic-null-defaults-migration.sql, run unchanged (twice) in a real
// Postgres.
//
// This test builds the DEFECT itself — the same column definitions
// docs/base-schema-migration.sql declares — because only a freshly built
// schema shows it. The other pg tests hand-create their tables (for example
// invoice-write-document.pg.test.ts declares `finalized_at timestamptz` with
// no default), which is exactly why no pg test could ever catch a wrong
// DEFAULT.
//
// 29 columns, two evidence classes (see the migration header):
//   CLASS A — a reader in the repo treats NULL as «not yet»;
//   CLASS B — the production schema itself carries no default (captured at
//             performance/raw/production-schema-dump.sql).
//
// What only a real database proves:
//   - before the fix, an insert that omits the column takes DEFAULT now(), and
//     the application's own reader (`… IS NULL`) misses the row — measured
//     here, not assumed;
//   - after the fix (run twice — re-runnable), the same insert reads NULL and
//     the reader finds it;
//   - an explicitly set value survives untouched;
//   - the NOT NULL defaults both schemas share are kept (sync_logs.started_at,
//     created_at) — the file must not overreach.
//
// A default removal refuses no write, so there is no refusal branch to test;
// both the omitted and the explicit write are exercised instead.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'

const PORT = freePortSync()
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-semantic-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/semantic`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const migration = readFileSync(join(DOCS, 'semantic-null-defaults-migration.sql'), 'utf8')

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER = '11111111-1111-4111-8111-111111111111'

/** The 29 columns the file fixes, each declared with DEFAULT now() by the baseline. */
const fixed: Array<[table: string, column: string]> = [
  // CLASS A — readers treat NULL as «not yet»
  ['workspace_members', 'suspended_at'],
  ['accounts', 'deleted_at'],
  ['journal_entries', 'deleted_at'],
  ['invoices', 'finalized_at'],
  ['invoices', 'lock_expires_at'],
  ['profiles', 'onboarding_completed_at'],
  ['workflows', 'deleted_at'],
  ['password_reset_tokens', 'used_at'],
  ['password_reset_tokens', 'revoked_at'],
  ['password_reset_tokens', 'deleted_at'],
  // CLASS B — production carries no default on these
  ['background_jobs', 'completed_at'],
  ['background_jobs', 'started_at'],
  ['customers', 'synced_at'],
  ['event_log', 'completed_at'],
  ['event_log', 'next_retry_at'],
  ['invoices', 'synced_at'],
  ['leaves', 'approved_at'],
  ['notifications', 'read_at'],
  ['products', 'synced_at'],
  ['project_members', 'joined_at'],
  ['project_tasks', 'completed_at'],
  ['purchase_orders', 'received_at'],
  ['sync_logs', 'completed_at'],
  ['sync_queue', 'processed_at'],
  ['transactions', 'synced_at'],
  ['webhook_events', 'processed_at'],
  ['workflow_instances', 'completed_at'],
  ['workspace_invites', 'accepted_at'],
  ['workspace_members', 'joined_at'],
]

async function defaultOf(table: string, column: string): Promise<string | null> {
  const rows = await sql<{ d: string | null }[]>`
    SELECT column_default AS d FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = ${table} AND column_name = ${column}`
  return rows[0]!.d
}

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('semantic')
  sql = postgres(url, { max: 1, onnotice: () => {} })
  // The baseline column definitions (docs/base-schema-migration.sql), reduced
  // to the columns this file is about. sync_logs.started_at and
  // workspace_members.created_at are present as the «must keep default»
  // controls, proven below rather than claimed.
  await sql.unsafe(`
    CREATE TABLE workspace_members (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL, user_id uuid NOT NULL,
      has_access boolean NOT NULL DEFAULT true,
      created_at timestamptz DEFAULT now(),
      suspended_at timestamptz DEFAULT now(),
      joined_at timestamptz DEFAULT now());
    CREATE TABLE accounts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      deleted_at timestamp DEFAULT now());
    CREATE TABLE journal_entries (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      deleted_at timestamp DEFAULT now());
    CREATE TABLE invoices (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      finalized_at timestamptz DEFAULT now(),
      lock_expires_at timestamptz DEFAULT now(),
      synced_at timestamptz DEFAULT now());
    CREATE TABLE profiles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      onboarding_completed_at timestamptz DEFAULT now());
    CREATE TABLE workflows (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      deleted_at timestamptz DEFAULT now());
    CREATE TABLE password_reset_tokens (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      used_at timestamptz DEFAULT now(),
      revoked_at timestamptz DEFAULT now(),
      deleted_at timestamptz DEFAULT now());
    CREATE TABLE background_jobs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      started_at timestamptz DEFAULT now(),
      completed_at timestamptz DEFAULT now());
    CREATE TABLE customers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      synced_at timestamptz DEFAULT now());
    CREATE TABLE event_log (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      next_retry_at timestamptz DEFAULT now(),
      completed_at timestamptz DEFAULT now());
    CREATE TABLE leaves (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      approved_at timestamptz DEFAULT now());
    CREATE TABLE notifications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      read_at timestamptz DEFAULT now());
    CREATE TABLE products (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      synced_at timestamptz DEFAULT now());
    CREATE TABLE project_members (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      joined_at timestamptz DEFAULT now());
    CREATE TABLE project_tasks (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      completed_at timestamptz DEFAULT now());
    CREATE TABLE purchase_orders (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      received_at timestamptz DEFAULT now());
    CREATE TABLE sync_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      started_at timestamptz NOT NULL DEFAULT now(),
      completed_at timestamptz DEFAULT now());
    CREATE TABLE sync_queue (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      processed_at timestamptz DEFAULT now());
    CREATE TABLE transactions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      synced_at timestamptz DEFAULT now());
    CREATE TABLE webhook_events (
      id text PRIMARY KEY,
      processed_at timestamptz DEFAULT now());
    CREATE TABLE workflow_instances (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      completed_at timestamptz DEFAULT now());
    CREATE TABLE workspace_invites (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      accepted_at timestamptz DEFAULT now());
  `)
}, 180_000)

afterAll(async () => {
  if (sql) await sql.end()
  try {
    await pg.stop()
  } catch {
    // ignore teardown errors
  }
  rmSync(dir, { recursive: true, force: true })
})

describe('semantic nullable timestamps — the default must be NULL, not now()', () => {
  it('before the fix: omitting the column IS the event (the defect, reproduced)', async () => {
    const [member] = await sql<{ suspended_at: Date | null }[]>`
      INSERT INTO workspace_members (workspace_id, user_id)
      VALUES (${WS}, ${USER}) RETURNING suspended_at`
    expect(member!.suspended_at).not.toBeNull()

    const [entry] = await sql<{ deleted_at: Date | null }[]>`
      INSERT INTO journal_entries DEFAULT VALUES RETURNING deleted_at`
    expect(entry!.deleted_at).not.toBeNull()
  })

  it('after the fix, run twice: every fixed default is gone', async () => {
    await sql.unsafe(migration)
    await sql.unsafe(migration) // idempotent — the second run is a no-op
    for (const [table, column] of fixed) {
      expect(await defaultOf(table, column), `${table}.${column}`).toBeNull()
    }
  })

  it("omitted inserts now read NULL and the application's own readers find the rows", async () => {
    await sql`TRUNCATE workspace_members, password_reset_tokens, sync_logs`

    const [member] = await sql<{ suspended_at: Date | null; joined_at: Date | null }[]>`
      INSERT INTO workspace_members (workspace_id, user_id)
      VALUES (${WS}, ${USER}) RETURNING suspended_at, joined_at`
    expect(member!.suspended_at).toBeNull()
    expect(member!.joined_at).toBeNull()
    // private.auth_workspace_ids() / resolve_workspace_access, inline.
    const active = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM workspace_members
       WHERE user_id = ${USER} AND has_access = true AND suspended_at IS NULL`
    expect(active[0]!.n).toBe(1)

    const [token] = await sql<{ id: string }[]>`
      INSERT INTO password_reset_tokens DEFAULT VALUES RETURNING id`
    // password-reset.service.ts:154-156, inline: a fresh token must be usable.
    const usable = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM password_reset_tokens
       WHERE id = ${token!.id}
         AND used_at IS NULL AND revoked_at IS NULL AND deleted_at IS NULL`
    expect(usable[0]!.n).toBe(1)

    // The NOT NULL default both schemas share is KEPT: started_at reads now(),
    // while the semantic completed_at is NULL until a writer says otherwise.
    const [log] = await sql<{ started_at: Date | null; completed_at: Date | null }[]>`
      INSERT INTO sync_logs DEFAULT VALUES RETURNING started_at, completed_at`
    expect(log!.started_at).not.toBeNull()
    expect(log!.completed_at).toBeNull()
  })

  it('an explicitly set value is preserved', async () => {
    const suspendedAt = new Date('2026-10-17T10:00:00.000Z')
    const [row] = await sql<{ suspended_at: Date | null }[]>`
      INSERT INTO workspace_members (workspace_id, user_id, suspended_at)
      VALUES (${WS}, ${USER}, ${suspendedAt}) RETURNING suspended_at`
    expect(row!.suspended_at?.toISOString()).toBe(suspendedAt.toISOString())
  })

  it('created_at keeps its default — the file must not overreach', async () => {
    expect(await defaultOf('workspace_members', 'created_at')).toContain('now()')
    const [member] = await sql<{ created_at: Date | null }[]>`
      INSERT INTO workspace_members (workspace_id, user_id)
      VALUES (${WS}, ${USER}) RETURNING created_at`
    expect(member!.created_at).not.toBeNull()
  })
})
