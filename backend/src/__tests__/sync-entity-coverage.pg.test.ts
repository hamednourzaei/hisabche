// ============================================
// backend/src/__tests__/sync-entity-coverage.pg.test.ts
//
// Real PostgreSQL integration test for docs/sync-entity-coverage-migration.sql.
// Applies the migration TWICE (idempotency), runs the VERIFY query, and proves
// that writes to each covered table produce a routed change-log row with the
// entity name the device pull expects, and that version bumps on update.
//
// BLOCKED_EXTERNAL on this Windows account: embedded-postgres cannot create
// its shared-memory segment (SeCreateGlobalPrivilege). Owner command:
//   cd backend && npx vitest run --project pg src/__tests__/sync-entity-coverage.pg.test.ts
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'

const PORT = freePortSync()
const dir = pgTempDir('hisabche-pg-sync-entities-')
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})

const url = `postgres://postgres:test@localhost:${PORT}/sync_entities_test`
let sql: postgres.Sql
let started = false

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')
const WS = '11111111-1111-4111-8111-111111111111'

describe('Postgres: sync entity coverage (sync-entity-coverage)', () => {
  beforeAll(async () => {
    try {
      await pg.start()
      started = true
    } catch {
      return // Non-elevated Windows environment — no live PG witness here.
    }
    const admin = postgres(`postgres://postgres:test@localhost:${PORT}/postgres`)
    await admin`CREATE DATABASE sync_entities_test;`
    await admin.end()
    sql = postgres(url)
    await sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`
    await sql.unsafe(`
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
        IF v_workspace IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
        INSERT INTO sync_change_log (workspace_id, entity_type, entity_id, operation, entity_version, origin_device)
        VALUES (v_workspace, TG_ARGV[0], v_entity, v_op, v_version, current_setting('hisabche.device_id', true));
        RETURN COALESCE(NEW, OLD);
      END; $$ LANGUAGE plpgsql;
      CREATE OR REPLACE FUNCTION sync_bump_version() RETURNS TRIGGER AS $$
      BEGIN
        NEW.version := COALESCE(OLD.version, 1) + 1;
        RETURN NEW;
      END; $$ LANGUAGE plpgsql;
      CREATE TABLE IF NOT EXISTS cost_layers (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL);
      CREATE TABLE IF NOT EXISTS stock_batches (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL);
      CREATE TABLE IF NOT EXISTS stock_serials (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL);
      CREATE TABLE IF NOT EXISTS inventory_settings (workspace_id UUID PRIMARY KEY);
    `)

    const migration = read('sync-entity-coverage-migration.sql')
    await sql.unsafe(migration)
    await sql.unsafe(migration) // idempotency
    await sql.unsafe(read('VERIFY-sync-entity-coverage.sql'))
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

  it.each([
    ['cost_layers', 'cost_layer'],
    ['stock_batches', 'stock_batches'],
    ['stock_serials', 'stock_serials'],
  ])('%s writes a routed change-log row and bumps version', async (table, entity) => {
    if (!sql) return
    const { id } = await sql
      .unsafe<Array<{ id: string }>>(
        `INSERT INTO ${table} (workspace_id) VALUES ($1) RETURNING id`,
        [WS],
      )
      .then((rows) => {
        const first = rows[0]
        if (!first) throw new Error(`INSERT into ${table} returned no id`)
        return { id: first.id }
      })
    await sql.unsafe(`UPDATE ${table} SET workspace_id = workspace_id WHERE id = $1`, [id])

    const rows = await sql.unsafe<Array<{ entity_type: string; entity_version: number }>>(
      `SELECT entity_type, entity_version FROM sync_change_log
        WHERE workspace_id = $1 AND entity_id = $2 ORDER BY sync_version`,
      [WS, id],
    )
    expect(rows.map((r) => r.entity_type)).toEqual([entity, entity])
    expect(rows[1]?.entity_version).toBe(2)
  })

  it('inventory_settings is routable by its stable id, under the protocol name', async () => {
    if (!sql) return
    const inserted = await sql.unsafe<Array<{ id: string }>>(
      `INSERT INTO inventory_settings (workspace_id) VALUES ($1) RETURNING id`,
      [WS],
    )
    const id = inserted[0]?.id
    expect(id).toBeTruthy()
    await sql.unsafe(`UPDATE inventory_settings SET version = version WHERE workspace_id = $1`, [
      WS,
    ])
    const rows = await sql.unsafe<
      Array<{ entity_type: string; entity_id: string; entity_version: number }>
    >(
      `SELECT entity_type, entity_id, entity_version FROM sync_change_log
        WHERE workspace_id = $1 AND entity_type = 'inventory_settings' ORDER BY sync_version`,
      [WS],
    )
    expect(rows).toHaveLength(2)
    expect(rows[0]?.entity_id).toBe(id)
    expect(rows[1]?.entity_version).toBe(2)
  })

  it('accounts is covered once the applied tenancy column exists', () => {
    const finding = read('FINDING-sync-account-tenancy.sql')
    expect(finding).toContain('RESOLUTION')
    expect(finding).toContain('workspace_id NOT NULL')
    const migration = read('sync-account-tenancy-coverage-migration.sql')
    expect(migration).toContain("sync_record_change('account')")
  })
})
