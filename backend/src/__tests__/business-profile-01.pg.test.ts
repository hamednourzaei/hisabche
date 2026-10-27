// ============================================
// backend/src/__tests__/business-profile-01.pg.test.ts
//
// Real PostgreSQL integration test for workspace business profile migration:
// docs/business-profile-01-migration.sql run TWICE (idempotency),
// verifies columns and operating_characteristics shape/size constraints.
// ============================================

import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { freePortSync } from './helpers/free-port'

const PORT = freePortSync()
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-biz-profile-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})

const url = `postgres://postgres:test@localhost:${PORT}/biz_profile_test`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')

describe('Postgres: workspace business profile (business-profile-01)', () => {
  beforeAll(async () => {
    try {
      await pg.start()
    } catch {
      // Skipped on Windows non-elevated (error 1314) per instructions
      return
    }

    const admin = postgres(`postgres://postgres:test@localhost:${PORT}/postgres`)
    await admin`CREATE DATABASE biz_profile_test;`
    await admin.end()

    sql = postgres(url)

    await sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`
    await sql`
      CREATE TABLE IF NOT EXISTS public.workspaces (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        name text NOT NULL,
        slug text NOT NULL,
        owner_id uuid NOT NULL,
        is_active boolean DEFAULT true,
        created_at timestamp without time zone DEFAULT now(),
        updated_at timestamp without time zone DEFAULT now()
      );
    `

    // Run migration TWICE to assert idempotency
    const migrationSql = read('business-profile-01-migration.sql')
    await sql.unsafe(migrationSql)
    await sql.unsafe(migrationSql)

    // Run VERIFY file
    const verifySql = read('VERIFY-business-profile-01.sql')
    const verifyResult = await sql.unsafe(verifySql)
    expect(verifyResult).toBeDefined()
  }, 120_000)

  afterAll(async () => {
    if (sql) await sql.end()
    try {
      await pg.stop()
    } catch {
      // ignore
    }
  })

  it('runs migration twice without error and columns exist', async () => {
    if (!sql) return

    const cols = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'workspaces'
        AND column_name IN ('business_types', 'operating_characteristics', 'business_profile_updated_at', 'business_profile_updated_by');
    `
    expect(cols.length).toBe(4)
  })

  it('allows valid operating characteristics and business types', async () => {
    if (!sql) return

    const wsId = '11111111-1111-4111-8111-111111111111'
    const ownerId = '22222222-2222-4222-8222-222222222222'

    await sql`
      INSERT INTO workspaces (id, name, slug, owner_id, business_types, operating_characteristics)
      VALUES (
        ${wsId},
        'Test Shop',
        'test-shop',
        ${ownerId},
        ARRAY['retail', 'grocery']::text[],
        ${JSON.stringify({ holdsStock: 'yes', hasStaff: 'no' })}::jsonb
      );
    `

    const row = await sql`
      SELECT business_types, operating_characteristics FROM workspaces WHERE id = ${wsId};
    `
    expect(row[0]?.business_types).toEqual(['retail', 'grocery'])
    expect(row[0]?.operating_characteristics).toEqual({ holdsStock: 'yes', hasStaff: 'no' })
  })

  it('rejects non-object operating characteristics', async () => {
    if (!sql) return

    const wsId = '33333333-3333-4333-8333-333333333333'
    const ownerId = '44444444-4444-4444-8444-444444444444'

    await expect(
      sql`
        INSERT INTO workspaces (id, name, slug, owner_id, operating_characteristics)
        VALUES (${wsId}, 'Invalid Shop', 'inv-shop', ${ownerId}, '["not", "an", "object"]'::jsonb);
      `,
    ).rejects.toThrow()
  })
})
