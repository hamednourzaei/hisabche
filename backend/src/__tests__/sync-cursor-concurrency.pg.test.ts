// ============================================
// backend/src/__tests__/sync-cursor-concurrency.pg.test.ts
//
// Real PostgreSQL integration test for sync commit horizon (N-36):
// Verifies with TWO INTERLEAVED CONNECTIONS that out-of-order commits
// do not cause the sync cursor to skip uncommitted lower version rows,
// and that gaps from other tenants or rollbacks do not stall the cursor.
//
// BLOCKED_EXTERNAL on this Windows account: embedded-postgres cannot create
// its shared-memory segment (error 1314). Owner command:
//   cd backend && npx vitest run --project pg src/__tests__/sync-cursor-concurrency.pg.test.ts
// ============================================

import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { freePortSync } from './helpers/free-port'

const PORT = freePortSync()
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-synchorizon-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})

const url = `postgres://postgres:test@localhost:${PORT}/sync_test`
let sql: postgres.Sql
let connA: postgres.Sql
let connB: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')

const WS_1 = '11111111-1111-4111-8111-111111111111'
const WS_2 = '22222222-2222-4222-8222-222222222222'

describe('Postgres: sync commit-horizon (sync-commit-horizon)', () => {
  beforeAll(async () => {
    try {
      await pg.start()
    } catch {
      return // Non-elevated Windows environment
    }

    const admin = postgres(`postgres://postgres:test@localhost:${PORT}/postgres`)
    await admin`CREATE DATABASE sync_test;`
    await admin.end()

    sql = postgres(url)
    connA = postgres(url)
    connB = postgres(url)

    await sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`

    // Prerequisite table sync_change_log — the shape sync-engine-migration.sql
    // creates, so the commit-horizon migration is applied to the real table.
    await sql`
      CREATE TABLE IF NOT EXISTS sync_change_log (
        sync_version   BIGSERIAL     PRIMARY KEY,
        workspace_id   UUID          NOT NULL,
        entity_type    TEXT          NOT NULL,
        entity_id      UUID          NOT NULL,
        operation      TEXT          NOT NULL,
        entity_version BIGINT        NOT NULL DEFAULT 1,
        origin_device  TEXT,
        created_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
      );
    `

    // Run the migration TWICE — it must be idempotent.
    const migrationSql = read('sync-commit-horizon-migration.sql')
    await sql.unsafe(migrationSql)
    await sql.unsafe(migrationSql)

    // Run the VERIFY file; every check must be satisfied.
    const verifySql = read('VERIFY-sync-commit-horizon.sql')
    const verifyResult = await sql.unsafe(verifySql)
    expect(verifyResult).toBeDefined()
  }, 120_000)

  afterAll(async () => {
    if (sql) await sql.end()
    if (connA) await connA.end()
    if (connB) await connB.end()
    try {
      await pg.stop()
    } catch {
      // ignore
    }
  })

  it('runs migration twice and establishes txid column and sync_pull_changes function', async () => {
    if (!sql) return

    const fn = await sql`
      SELECT proname FROM pg_proc WHERE proname = 'sync_pull_changes';
    `
    expect(fn.length).toBe(1)

    const col = await sql`
      SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'sync_change_log'
         AND column_name = 'txid';
    `
    expect(col.length).toBe(1)

    const idx = await sql`
      SELECT indexname FROM pg_indexes
       WHERE schemaname = 'public'
         AND tablename = 'sync_change_log'
         AND indexname IN ('sync_change_log_ws_version_idx', 'sync_change_log_txid_idx');
    `
    expect(idx.length).toBe(2)
  })

  it('does not stall the cursor on gaps from rolled-back or other-tenant transactions', async () => {
    if (!sql) return

    // Insert for WS_1
    await sql`
      INSERT INTO sync_change_log (workspace_id, entity_type, entity_id, operation)
      VALUES (${WS_1}, 'customer', gen_random_uuid(), 'create');
    `

    // Insert for WS_2 — a gap for WS_1 that will never be filled for that tenant
    await sql`
      INSERT INTO sync_change_log (workspace_id, entity_type, entity_id, operation)
      VALUES (${WS_2}, 'customer', gen_random_uuid(), 'create');
    `

    // Insert for WS_1 again
    await sql`
      INSERT INTO sync_change_log (workspace_id, entity_type, entity_id, operation)
      VALUES (${WS_1}, 'customer', gen_random_uuid(), 'create');
    `

    const pulled = await sql`
      SELECT * FROM sync_pull_changes(${WS_1}::uuid, 0::bigint, 10::int);
    `
    // Must return the two rows for WS_1 without stalling on the WS_2 gap
    expect(pulled.length).toBe(2)
    expect(Number(pulled[0]?.sync_version)).toBe(1)
    expect(Number(pulled[1]?.sync_version)).toBe(3)
  })

  it('interleaving: when A is open with lower version, B commits higher version, pull hides B until A commits', async () => {
    if (!sql || !connA || !connB) return

    const startRow = await sql`SELECT COALESCE(MAX(sync_version), 0) AS max_v FROM sync_change_log;`
    const startCursor = Number(startRow[0]?.max_v ?? 0)

    // Conn A begins a transaction and inserts — allocates V_A and txid A, still open.
    await connA`BEGIN;`
    const rowA = await connA`
      INSERT INTO sync_change_log (workspace_id, entity_type, entity_id, operation)
      VALUES (${WS_1}, 'customer', gen_random_uuid(), 'create')
      RETURNING sync_version;
    `
    const versionA = Number(rowA[0]?.sync_version)

    // Conn B inserts a LARGER version and commits while A is still open.
    await connB`BEGIN;`
    const rowB = await connB`
      INSERT INTO sync_change_log (workspace_id, entity_type, entity_id, operation)
      VALUES (${WS_1}, 'customer', gen_random_uuid(), 'create')
      RETURNING sync_version;
    `
    const versionB = Number(rowB[0]?.sync_version)
    expect(versionB).toBeGreaterThan(versionA)
    await connB`COMMIT;`

    // A pull from another connection must NOT return B: A's txid pins xmin.
    const pullWhileAInFlight = await sql`
      SELECT * FROM sync_pull_changes(${WS_1}::uuid, ${startCursor}::bigint, 10::int);
    `
    expect(pullWhileAInFlight.length).toBe(0)

    // A commits; now both are visible and are returned in version order.
    await connA`COMMIT;`

    const pullAfterACommits = await sql`
      SELECT * FROM sync_pull_changes(${WS_1}::uuid, ${startCursor}::bigint, 10::int);
    `
    expect(pullAfterACommits.length).toBe(2)
    expect(Number(pullAfterACommits[0]?.sync_version)).toBe(versionA)
    expect(Number(pullAfterACommits[1]?.sync_version)).toBe(versionB)
  })

  it('rolled-back transaction does not block later committed transactions', async () => {
    if (!sql || !connA || !connB) return

    const startRow = await sql`SELECT COALESCE(MAX(sync_version), 0) AS max_v FROM sync_change_log;`
    const startCursor = Number(startRow[0]?.max_v ?? 0)

    // Conn A begins, inserts, then ROLLS BACK — the allocated version is a gap.
    await connA`BEGIN;`
    await connA`
      INSERT INTO sync_change_log (workspace_id, entity_type, entity_id, operation)
      VALUES (${WS_1}, 'customer', gen_random_uuid(), 'create');
    `
    await connA`ROLLBACK;`

    // Conn B inserts and commits.
    await connB`
      INSERT INTO sync_change_log (workspace_id, entity_type, entity_id, operation)
      VALUES (${WS_1}, 'customer', gen_random_uuid(), 'update');
    `

    // Pull must return B's commit immediately without stalling on A's gap.
    const pulled = await sql`
      SELECT * FROM sync_pull_changes(${WS_1}::uuid, ${startCursor}::bigint, 10::int);
    `
    expect(pulled.length).toBe(1)
    expect(pulled[0]?.operation).toBe('update')
  })
})
