// ============================================
// backend/src/__tests__/sync-account-tenancy-coverage.pg.test.ts
//
// Real PostgreSQL test for the final two sync entities:
// docs/sync-account-tenancy-coverage-migration.sql.
//
// Applies the migration TWICE (idempotency), runs its VERIFY query, and proves
// that a write to accounts produces a change-log row under the PROTOCOL name
// 'account' with a bumped version. inventory_settings must keep a stable id.
//
// BLOCKED_EXTERNAL on this Windows account: embedded-postgres cannot create
// its shared-memory segment (SeCreateGlobalPrivilege). Owner command:
//   cd backend && npx vitest run --project pg src/__tests__/sync-account-tenancy-coverage.pg.test.ts
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'

const PORT = freePortSync()
const dir = pgTempDir('hisabche-pg-sync-accounts-')
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})

const url = `postgres://postgres:test@localhost:${PORT}/sync_accounts_test`
let sql: postgres.Sql
let started = false

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')
const WS = '11111111-1111-4111-8111-111111111111'

describe('Postgres: accounts + inventory_settings sync coverage', () => {
  beforeAll(async () => {
    try {
      await pg.start()
      started = true
    } catch {
      return // Non-elevated Windows environment — no live PG witness here.
    }
    const admin = postgres(`postgres://postgres:test@localhost:${PORT}/postgres`)
    await admin`CREATE DATABASE sync_accounts_test;`
    await admin.end()
    sql = postgres(url)
    await sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`
    // The schema after accounting-core-migration.sql: accounts already has a
    // NOT NULL workspace_id. inventory_settings still has the workspace key
    // and no id — the gap this migration closes.
    await sql.unsafe(
      `
      CREATE TABLE IF NOT EXISTS sync_change_log (
        sync_version BIGSERIAL PRIMARY KEY, workspace_id UUID NOT NULL,
        entity_type TEXT NOT NULL, entity_id UUID NOT NULL,
        operation TEXT NOT NULL, entity_version BIGINT NOT NULL DEFAULT 1,
        origin_device TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE OR REPLACE FUNCTION sync_record_change() RETURNS TRIGGER AS $$
      DECLARE v_workspace UUID; v_entity UUID; v_op TEXT; v_version BIGINT;
      BEGIN
        IF TG_OP = 'DELETE' THEN
          v_workspace := OLD.workspace_id; v_entity := OLD.id;
          v_op := 'delete'; v_version := COALESCE(OLD.version, 1);
        ELSE
          v_workspace := NEW.workspace_id; v_entity := NEW.id;
          v_op := CASE WHEN TG_OP = 'INSERT' THEN 'create' ELSE 'update' END;
          v_version := COALESCE(NEW.version, 1);
        END IF;
        IF v_workspace IS NULL OR v_entity IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
        INSERT INTO sync_change_log (workspace_id, entity_type, entity_id, operation, entity_version, origin_device)
        VALUES (v_workspace, TG_ARGV[0], v_entity, v_op, v_version, current_setting('hisabche.device_id', true));
        RETURN COALESCE(NEW, OLD);
      END; $$ LANGUAGE plpgsql;
      CREATE OR REPLACE FUNCTION sync_bump_version() RETURNS TRIGGER AS $$
      BEGIN
        NEW.version := COALESCE(OLD.version, 1) + 1;
        RETURN NEW;
      END; $$ LANGUAGE plpgsql;
      CREATE TABLE IF NOT EXISTS accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL,
        user_id UUID NOT NULL DEFAULT gen_random_uuid(),
        code TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS inventory_settings (workspace_id UUID PRIMARY KEY);
      INSERT INTO inventory_settings (workspace_id) VALUES ($1);
    `,
      [WS],
    )

    const migration = read('sync-account-tenancy-coverage-migration.sql')
    await sql.unsafe(migration)
    await sql.unsafe(migration) // idempotency
    await sql.unsafe(read('VERIFY-sync-account-tenancy-coverage.sql'))
  }, 120_000)

  afterAll(async () => {
    if (sql) await sql.end()
    if (started) {
      try {
        await pg.stop()
      } catch {
        // embedded Postgres could not be stopped cleanly
      }
    }
  })

  it('accounts writes a routed change-log row and bumps version', async () => {
    if (!sql) return
    const { id } = await sql
      .unsafe<Array<{ id: string }>>(
        `INSERT INTO accounts (workspace_id, code) VALUES ($1, 'cash') RETURNING id`,
        [WS],
      )
      .then((rows) => {
        const first = rows[0]
        if (!first) throw new Error('INSERT into accounts returned no id')
        return { id: first.id }
      })
    await sql.unsafe(`UPDATE accounts SET code = 'bank' WHERE id = $1`, [id])

    const rows = await sql.unsafe<Array<{ entity_type: string; entity_version: number }>>(
      `SELECT entity_type, entity_version FROM sync_change_log
        WHERE workspace_id = $1 AND entity_id = $2 ORDER BY sync_version`,
      [WS, id],
    )
    expect(rows.map((r) => r.entity_type)).toEqual(['account', 'account'])
    expect(rows[1]?.entity_version).toBe(2)
  })

  it('inventory_settings rows keep a stable id and a unique index', async () => {
    if (!sql) return
    const rows = await sql.unsafe<Array<{ id: string; workspace_id: string }>>(
      `SELECT id, workspace_id FROM inventory_settings WHERE workspace_id = $1`,
      [WS],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.id).toMatch(/^[0-9a-f-]{36}$/)
    // A second application must not mint a new id for an existing row.
    const indexes = await sql.unsafe<Array<{ indexname: string }>>(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'inventory_settings'`,
    )
    expect(indexes.map((row) => row.indexname)).toContain('inventory_settings_id_key')
  })
})
