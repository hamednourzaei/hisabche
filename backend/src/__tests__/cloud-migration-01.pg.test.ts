// ============================================
// Cloud Migration 01 Migration PG Test
// Runs docs/cloud-migration-01-migration.sql TWICE on real Postgres.
// ============================================

import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'

const PORT = freePortSync()
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-cmig-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
})
const url = `postgres://postgres:test@localhost:${PORT}/cmig`
let sql: postgres.Sql

const migrationSql = readFileSync(
  join(__dirname, '..', '..', '..', 'docs', 'cloud-migration-01-migration.sql'),
  'utf8',
)
const verifySql = readFileSync(
  join(__dirname, '..', '..', '..', 'docs', 'VERIFY-cloud-migration-01.sql'),
  'utf8',
)

const WS_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const USER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('cmig')
  const setup = postgres(url, { max: 1, onnotice: () => {} })

  // Prerequisite setup: roles, auth schema, workspaces
  await setup.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
    END $$;

    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT '${USER_ID}'::uuid
    $$;

    CREATE TABLE IF NOT EXISTS public.workspaces (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      created_at timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.workspace_members (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
      user_id uuid NOT NULL,
      role text NOT NULL DEFAULT 'owner'
    );

    INSERT INTO public.workspaces (id, name) VALUES ('${WS_ID}', 'فروشگاه مهاجرت');
    INSERT INTO public.workspace_members (workspace_id, user_id, role) VALUES ('${WS_ID}', '${USER_ID}', 'owner');
  `)

  await setup.end()
  sql = postgres(url, { max: 1, onnotice: () => {} })
})

afterAll(async () => {
  if (sql) await sql.end()
  await pg.stop()
})

describe('docs/cloud-migration-01-migration.sql', () => {
  it('applies the migration cleanly on real Postgres', async () => {
    await expect(sql.unsafe(migrationSql)).resolves.toBeDefined()
  })

  it('is idempotent: running the migration a second time succeeds without error', async () => {
    await expect(sql.unsafe(migrationSql)).resolves.toBeDefined()
  })

  it('passes all checks in docs/VERIFY-cloud-migration-01.sql', async () => {
    const results = await sql.unsafe<{ check: string; ok: boolean }[]>(verifySql)
    expect(results.length).toBeGreaterThanOrEqual(5)
    for (const r of results) {
      expect(r.ok, `Failed check: ${r.check}`).toBe(true)
    }
  })

  it('prevents state rollback once COMPLETED (forward-only state trigger)', async () => {
    const [job] = await sql<[{ id: string }]>`
      INSERT INTO public.cloud_migration_jobs (
        workspace_id, created_by, device_id, licence_id, status
      ) VALUES (
        ${WS_ID}, ${USER_ID}, 'dev-1', 'lic-1', 'UPLOADING'
      ) RETURNING id
    `

    // Transition to COMPLETED is allowed
    await sql`
      UPDATE public.cloud_migration_jobs
      SET status = 'COMPLETED'
      WHERE id = ${job.id}
    `

    // Attempting to move backwards from COMPLETED is refused
    await expect(
      sql`
        UPDATE public.cloud_migration_jobs
        SET status = 'UPLOADING'
        WHERE id = ${job.id}
      `,
    ).rejects.toThrow(/MIGRATION_JOB_ALREADY_COMPLETED/)
  })

  it('enforces uniqueness on (workspace_id, entity_type, local_id) in mapping table', async () => {
    const [job] = await sql<[{ id: string }]>`
      SELECT id FROM public.cloud_migration_jobs WHERE workspace_id = ${WS_ID} LIMIT 1
    `

    const cloudId1 = '11111111-1111-1111-1111-111111111111'
    const cloudId2 = '22222222-2222-2222-2222-222222222222'

    // First insert succeeds
    await sql`
      INSERT INTO public.cloud_migration_map (
        workspace_id, job_id, entity_type, local_id, cloud_id
      ) VALUES (
        ${WS_ID}, ${job.id}, 'customer', 'cust-loc-1', ${cloudId1}
      )
    `

    // Duplicate local_id insert fails with unique violation
    await expect(
      sql`
        INSERT INTO public.cloud_migration_map (
          workspace_id, job_id, entity_type, local_id, cloud_id
        ) VALUES (
          ${WS_ID}, ${job.id}, 'customer', 'cust-loc-1', ${cloudId2}
        )
      `,
    ).rejects.toThrow(/uq_migration_entity_local/)
  })
})
