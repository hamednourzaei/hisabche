// ============================================
// docs/workspace-signature-01-migration.sql, run unchanged — twice — on a real
// Postgres, then its VERIFY.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const PORT = 58000 + Math.floor(Math.random() * 900)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-signature-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const MIGRATION = readFileSync(join(DOCS, 'workspace-signature-01-migration.sql'), 'utf8')
const VERIFY = readFileSync(join(DOCS, 'VERIFY-workspace-signature-01.sql'), 'utf8')

const SHOP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

let sql: ReturnType<typeof postgres>

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  sql = postgres({
    host: 'localhost',
    port: PORT,
    user: 'postgres',
    password: 'test',
    max: 1,
    onnotice: () => undefined,
  })
  await sql.unsafe(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    CREATE TABLE workspaces (id uuid PRIMARY KEY, name text, logo_url text, stamp_url text);
    INSERT INTO workspaces (id, name) VALUES ('${SHOP}', 'shop');
  `)
}, 120_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
})

describe('workspace-signature-01', () => {
  it('runs twice without error', async () => {
    await sql.unsafe(MIGRATION)
    await sql.unsafe(MIGRATION)
  })

  it('an existing workspace has no signature — nothing is backfilled', async () => {
    const [row] = await sql`SELECT signature_url FROM workspaces WHERE id = ${SHOP}`
    expect(row?.signature_url).toBeNull()
  })

  it('stores a signature beside the stamp and the logo', async () => {
    await sql`UPDATE workspaces SET signature_url = 'data:image/png;base64,AA', stamp_url = 'data:image/png;base64,BB', logo_url = 'data:image/png;base64,CC' WHERE id = ${SHOP}`
    const [row] =
      await sql`SELECT signature_url, stamp_url, logo_url FROM workspaces WHERE id = ${SHOP}`
    expect(row).toEqual({
      signature_url: 'data:image/png;base64,AA',
      stamp_url: 'data:image/png;base64,BB',
      logo_url: 'data:image/png;base64,CC',
    })
  })

  it('VERIFY says ok', async () => {
    const rows = await sql.unsafe(VERIFY)
    expect(rows.every((row) => row.ok === true)).toBe(true)
  })
})
