// ============================================
// docs/ai-action-requests-01-migration.sql run unchanged (twice) in a real
// Postgres, then its VERIFY — and the rule the whole confirmation step rests
// on: a request moves forward only, so an approved action can run ONCE.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const PORT = 63000 + Math.floor(Math.random() * 900)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-air-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/air`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')
const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const KEY = '11111111-1111-4111-8111-111111111111'
const USER = '22222222-2222-4222-8222-222222222222'
const BOSS = '33333333-3333-4333-8333-333333333333'

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('air')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    END $$;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    -- As on Supabase: every new table and function in public arrives already
    -- granted to the three API roles. A migration that only GRANTs a narrower
    -- set, without revoking first, passes on a bare Postgres and fails there.
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;`)
  await setup.unsafe(read('ai-action-requests-01-migration.sql'))
  await setup.unsafe(read('ai-action-requests-01-migration.sql'))
  await setup.end()
  sql = postgres(url, { max: 6, onnotice: () => {} })
}, 240_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
})

let requestId = ''
beforeEach(async () => {
  const [row] = await sql`
    INSERT INTO ai_action_requests (workspace_id, key_id, requested_by, tool, risk, arguments)
    VALUES (${WS}, ${KEY}, ${USER}, 'create_invoice', 'financial', ${sql.json({ invoice: { type: 'sale' } })})
    RETURNING id`
  requestId = row!.id
})

const decide = (status: string) => sql`
  UPDATE ai_action_requests SET status = ${status}, decided_by = ${BOSS}, decided_at = now()
   WHERE id = ${requestId} AND status = 'pending' RETURNING id`

describe('ai-action-requests-01', () => {
  it('VERIFY: every check is ok', async () => {
    const rows = await sql.unsafe(read('VERIFY-ai-action-requests-01.sql'))
    expect(rows.length).toBeGreaterThanOrEqual(7)
    expect(rows.filter((row) => row.ok !== true).map((row) => row.check)).toEqual([])
  })

  it('pending → approved → executed is allowed', async () => {
    await expect(decide('approved')).resolves.toHaveLength(1)
    await expect(
      sql`UPDATE ai_action_requests SET status = 'executed', result_status = 201 WHERE id = ${requestId}`,
    ).resolves.toBeDefined()
  })

  it('five approvals at once: exactly ONE claims the request', async () => {
    const settled = await Promise.all(Array.from({ length: 5 }, () => decide('approved')))
    expect(settled.filter((rows) => rows.length === 1)).toHaveLength(1)
  })

  it('a decided request cannot be re-opened, re-approved or re-run', async () => {
    await decide('rejected')
    for (const status of ['pending', 'approved', 'executed']) {
      await expect(
        sql`UPDATE ai_action_requests SET status = ${status} WHERE id = ${requestId}`,
      ).rejects.toThrow('AI_REQUEST_ALREADY_DECIDED')
    }
  })

  it('an executed request cannot go back to approved', async () => {
    await decide('approved')
    await sql`UPDATE ai_action_requests SET status = 'executed' WHERE id = ${requestId}`
    await expect(
      sql`UPDATE ai_action_requests SET status = 'approved' WHERE id = ${requestId}`,
    ).rejects.toThrow('AI_REQUEST_ALREADY_DECIDED')
  })

  it('what was asked can never be rewritten, and a request is never deleted', async () => {
    await expect(
      sql`UPDATE ai_action_requests SET arguments = ${sql.json({ invoice: { type: 'purchase' } })} WHERE id = ${requestId}`,
    ).rejects.toThrow('AI_REQUEST_IMMUTABLE')
    await expect(
      sql`UPDATE ai_action_requests SET tool = 'cancel_order' WHERE id = ${requestId}`,
    ).rejects.toThrow('AI_REQUEST_IMMUTABLE')
    await expect(sql`DELETE FROM ai_action_requests WHERE id = ${requestId}`).rejects.toThrow(
      'AI_REQUEST_IMMUTABLE',
    )
  })

  it('a decision without a decider is refused', async () => {
    await expect(
      sql`UPDATE ai_action_requests SET status = 'approved' WHERE id = ${requestId}`,
    ).rejects.toThrow('ai_action_requests_decision_has_decider')
  })

  it('only the two risk classes that need approval are stored; a read is not a request', async () => {
    await expect(
      sql`INSERT INTO ai_action_requests (workspace_id, key_id, requested_by, tool, risk, arguments)
          VALUES (${WS}, ${KEY}, ${USER}, 'get_invoice', 'read', '{}'::jsonb)`,
    ).rejects.toThrow(/risk/)
  })

  it('a browser role cannot read the queue', async () => {
    await expect(
      sql.begin(async (tx) => {
        await tx`SET LOCAL ROLE authenticated`
        await tx`SELECT * FROM ai_action_requests`
      }),
    ).rejects.toThrow(/permission denied/)
  })
})
