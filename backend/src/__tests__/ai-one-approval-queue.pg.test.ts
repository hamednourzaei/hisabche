// ============================================
// docs/ai-pipeline-02-one-approval-queue-migration.sql run unchanged (twice)
// in a real Postgres, on top of the two migrations it builds on — then its
// VERIFY, and the rules of the ONE approval queue:
//
//   a request comes from an API key OR from an in-app run, never both or none;
//   a run has at most one request;
//   the claim, the forward-only moves and immutability hold for both origins;
//   a request that existed before (MCP, with a key) is untouched.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const PORT = 61000 + Math.floor(Math.random() * 900)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-aiq-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/aiq`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')
const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const KEY = '11111111-1111-4111-8111-111111111111'
const USER = '22222222-2222-4222-8222-222222222222'
const BOSS = '33333333-3333-4333-8333-333333333333'
/** A request made through MCP BEFORE this migration existed. */
let legacyId = ''

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('aiq')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    END $$;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;`)
  await setup.unsafe(read('ai-action-requests-01-migration.sql'))
  await setup.unsafe(read('ai-pipeline-01-migration.sql'))
  const [legacy] = await setup`
    INSERT INTO ai_action_requests (workspace_id, key_id, requested_by, tool, risk, arguments)
    VALUES (${WS}, ${KEY}, ${USER}, 'cancel_order', 'destructive', ${setup.json({ orderId: 'x' })})
    RETURNING id`
  legacyId = legacy!.id
  await setup.unsafe(read('ai-pipeline-02-one-approval-queue-migration.sql'))
  await setup.unsafe(read('ai-pipeline-02-one-approval-queue-migration.sql'))
  await setup.end()
  sql = postgres(url, { max: 6, onnotice: () => {} })
}, 240_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
})

const COMMAND = { operation: 'create_customer', body: { fullName: 'احمد' }, expect: {} }

let runId = ''
let requestId = ''
const newRun = async () => {
  const [row] = await sql`
    INSERT INTO ai_pipeline_runs (workspace_id, requested_by, request_text)
    VALUES (${WS}, ${USER}, 'مشتری احمد را بساز') RETURNING id`
  return row!.id as string
}
const requestFor = (run: string, risk = 'write') => sql`
  INSERT INTO ai_action_requests (workspace_id, run_id, requested_by, tool, risk, arguments)
  VALUES (${WS}, ${run}, ${USER}, 'create_customer', ${risk}, ${sql.json(COMMAND)})
  RETURNING id`

beforeEach(async () => {
  runId = await newRun()
  requestId = (await requestFor(runId))[0]!.id
})

const claim = () => sql`
  UPDATE ai_action_requests SET status = 'approved', decided_by = ${BOSS}, decided_at = now()
   WHERE id = ${requestId} AND status = 'pending' RETURNING id`

describe('ai-pipeline-02: one approval queue', () => {
  it('VERIFY: every check is ok', async () => {
    const rows = await sql.unsafe(read('VERIFY-ai-pipeline-02.sql'))
    expect(rows.length).toBeGreaterThanOrEqual(12)
    expect(rows.filter((row) => row.ok !== true).map((row) => row.check)).toEqual([])
  })

  it('the earlier VERIFY of the queue still passes', async () => {
    const rows = await sql.unsafe(read('VERIFY-ai-action-requests-01.sql'))
    expect(rows.filter((row) => row.ok !== true).map((row) => row.check)).toEqual([])
  })

  it('a request made with a key before the migration is untouched and still decidable', async () => {
    const [row] =
      await sql`SELECT key_id, run_id, risk, status FROM ai_action_requests WHERE id = ${legacyId}`
    expect(row).toEqual({ key_id: KEY, run_id: null, risk: 'destructive', status: 'pending' })
    await expect(
      sql`UPDATE ai_action_requests SET status = 'rejected', decided_by = ${BOSS}, decided_at = now() WHERE id = ${legacyId}`,
    ).resolves.toBeDefined()
  })

  it('a request has exactly one origin', async () => {
    await expect(
      sql`INSERT INTO ai_action_requests (workspace_id, requested_by, tool, risk, arguments)
          VALUES (${WS}, ${USER}, 'create_invoice', 'financial', '{}'::jsonb)`,
    ).rejects.toThrow('ai_action_requests_one_origin')
    const other = await newRun()
    await expect(
      sql`INSERT INTO ai_action_requests (workspace_id, key_id, run_id, requested_by, tool, risk, arguments)
          VALUES (${WS}, ${KEY}, ${other}, ${USER}, 'create_invoice', 'financial', '{}'::jsonb)`,
    ).rejects.toThrow('ai_action_requests_one_origin')
  })

  it('a run has at most one request', async () => {
    await expect(requestFor(runId, 'financial')).rejects.toThrow('ai_action_requests_run_idx')
  })

  it('a request cannot name a run that does not exist', async () => {
    await expect(requestFor(BOSS)).rejects.toThrow(/foreign key/)
  })

  it('through a key only money, stock and the irreversible are queued; a read never is', async () => {
    await expect(
      sql`INSERT INTO ai_action_requests (workspace_id, key_id, requested_by, tool, risk, arguments)
          VALUES (${WS}, ${KEY}, ${USER}, 'create_customer', 'write', '{}'::jsonb)`,
    ).rejects.toThrow('ai_action_requests_write_is_in_app')
    await expect(
      sql`INSERT INTO ai_action_requests (workspace_id, key_id, requested_by, tool, risk, arguments)
          VALUES (${WS}, ${KEY}, ${USER}, 'get_invoice', 'read', '{}'::jsonb)`,
    ).rejects.toThrow('ai_action_requests_risk_allowed')
  })

  it('five approvals of an in-app request at once: exactly ONE claims it', async () => {
    const settled = await Promise.all(Array.from({ length: 5 }, () => claim()))
    expect(settled.filter((rows) => rows.length === 1)).toHaveLength(1)
    expect(settled.filter((rows) => rows.length === 0)).toHaveLength(4)
  })

  it('an in-app request moves forward only, like any other', async () => {
    await claim()
    await sql`UPDATE ai_action_requests SET status = 'executed', result_status = 201 WHERE id = ${requestId}`
    for (const status of ['pending', 'approved', 'rejected']) {
      await expect(
        sql`UPDATE ai_action_requests SET status = ${status} WHERE id = ${requestId}`,
      ).rejects.toThrow('AI_REQUEST_ALREADY_DECIDED')
    }
  })

  it('what was asked — and where it came from — is never rewritten', async () => {
    const other = await newRun()
    await expect(
      sql`UPDATE ai_action_requests SET run_id = ${other} WHERE id = ${requestId}`,
    ).rejects.toThrow('AI_REQUEST_IMMUTABLE')
    await expect(
      sql`UPDATE ai_action_requests SET arguments = '{}'::jsonb WHERE id = ${requestId}`,
    ).rejects.toThrow('AI_REQUEST_IMMUTABLE')
    await expect(
      sql`UPDATE ai_action_requests SET risk = 'financial' WHERE id = ${requestId}`,
    ).rejects.toThrow('AI_REQUEST_IMMUTABLE')
    await expect(sql`DELETE FROM ai_action_requests WHERE id = ${requestId}`).rejects.toThrow(
      'AI_REQUEST_IMMUTABLE',
    )
  })

  it('a decision without a decider is still refused', async () => {
    await expect(
      sql`UPDATE ai_action_requests SET status = 'approved' WHERE id = ${requestId}`,
    ).rejects.toThrow('ai_action_requests_decision_has_decider')
  })
})
