// ============================================
// docs/ai-pipeline-01-migration.sql run unchanged (twice) in a real Postgres,
// then its VERIFY — and the rules the pipeline rests on:
//
//   a run moves forward only, so an approved action can run ONCE;
//   what was proposed cannot be rewritten after it was shown;
//   a dry run can never be approved;
//   the audit trail can only grow.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const PORT = 64000 + Math.floor(Math.random() * 900)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-aip-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/aip`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')
const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER = '22222222-2222-4222-8222-222222222222'
const BOSS = '33333333-3333-4333-8333-333333333333'

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('aip')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    END $$;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    -- As on Supabase: every new table arrives already granted to the API roles.
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;`)
  await setup.unsafe(read('ai-pipeline-01-migration.sql'))
  await setup.unsafe(read('ai-pipeline-01-migration.sql'))
  await setup.end()
  sql = postgres(url, { max: 6, onnotice: () => {} })
}, 240_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
})

const COMMAND = { customer: { fullName: 'احمد' } }
const PROPOSAL = { changes: [{ entity: 'customer', field: 'fullName', from: null, to: 'احمد' }] }

let runId = ''
const newRun = async (dryRun = false) => {
  const [row] = await sql`
    INSERT INTO ai_pipeline_runs (workspace_id, requested_by, request_text, dry_run)
    VALUES (${WS}, ${USER}, 'مشتری احمد را بساز', ${dryRun}) RETURNING id`
  return row!.id as string
}
const propose = (id: string) => sql`
  UPDATE ai_pipeline_runs
     SET status = 'proposed', operation = 'create_customer',
         command = ${sql.json(COMMAND)}, proposal = ${sql.json(PROPOSAL)}
   WHERE id = ${id}`
const approve = (id: string) => sql`
  UPDATE ai_pipeline_runs SET status = 'approved', approved_by = ${BOSS}, approved_at = now()
   WHERE id = ${id} AND status = 'proposed' RETURNING id`

beforeEach(async () => {
  runId = await newRun()
})

describe('ai-pipeline-01', () => {
  it('VERIFY: every check is ok', async () => {
    const rows = await sql.unsafe(read('VERIFY-ai-pipeline-01.sql'))
    expect(rows.length).toBeGreaterThanOrEqual(14)
    expect(rows.filter((row) => row.ok !== true).map((row) => row.check)).toEqual([])
  })

  it('the switch is OFF for a business nobody configured, and both parts default to off', async () => {
    expect(await sql`SELECT 1 FROM ai_pipeline_settings WHERE workspace_id = ${WS}`).toHaveLength(0)
    const [row] = await sql`
      INSERT INTO ai_pipeline_settings (workspace_id) VALUES (${WS})
      ON CONFLICT (workspace_id) DO UPDATE SET updated_at = now()
      RETURNING enabled, auto_approve_non_financial`
    expect(row).toEqual({ enabled: false, auto_approve_non_financial: false })
  })

  it('understanding → needs_input → proposed → approved → executed is allowed', async () => {
    await sql`UPDATE ai_pipeline_runs SET status = 'needs_input', draft = ${sql.json({ a: 1 })} WHERE id = ${runId}`
    await propose(runId)
    await expect(approve(runId)).resolves.toHaveLength(1)
    await sql`UPDATE ai_pipeline_runs SET status = 'executed', result_status = 201 WHERE id = ${runId}`
    const [row] =
      await sql`SELECT status, updated_at > created_at AS touched FROM ai_pipeline_runs WHERE id = ${runId}`
    expect(row).toEqual({ status: 'executed', touched: true })
  })

  it('five approvals at once: exactly ONE claims the run', async () => {
    await propose(runId)
    const settled = await Promise.all(Array.from({ length: 5 }, () => approve(runId)))
    expect(settled.filter((rows) => rows.length === 1)).toHaveLength(1)
    expect(settled.filter((rows) => rows.length === 0)).toHaveLength(4)
  })

  it('a run cannot be approved before it was proposed', async () => {
    await expect(
      sql`UPDATE ai_pipeline_runs SET status = 'approved', approved_by = ${BOSS}, approved_at = now() WHERE id = ${runId}`,
    ).rejects.toThrow(/AI_RUN_ALREADY_DECIDED|ai_pipeline_runs_proposed_has_proposal/)
  })

  it('a dry run stops at the proposal and can never be approved', async () => {
    const dry = await newRun(true)
    await propose(dry)
    await expect(
      sql`UPDATE ai_pipeline_runs SET status = 'approved', approved_by = ${BOSS}, approved_at = now() WHERE id = ${dry}`,
    ).rejects.toThrow('AI_RUN_IS_DRY_RUN')
    // …and it cannot be turned into a real run afterwards.
    await expect(
      sql`UPDATE ai_pipeline_runs SET dry_run = false WHERE id = ${dry}`,
    ).rejects.toThrow('AI_RUN_IMMUTABLE')
  })

  it('what was proposed cannot be rewritten after it was shown', async () => {
    await propose(runId)
    await expect(
      sql`UPDATE ai_pipeline_runs SET command = ${sql.json({ customer: { fullName: 'محمود' } })} WHERE id = ${runId}`,
    ).rejects.toThrow('AI_RUN_IMMUTABLE')
    await expect(
      sql`UPDATE ai_pipeline_runs SET operation = 'create_invoice' WHERE id = ${runId}`,
    ).rejects.toThrow('AI_RUN_IMMUTABLE')
    await approve(runId)
    await expect(
      sql`UPDATE ai_pipeline_runs SET status = 'executed', proposal = ${sql.json({ changes: [] })} WHERE id = ${runId}`,
    ).rejects.toThrow('AI_RUN_IMMUTABLE')
  })

  it('a decided run cannot be re-opened, re-approved or re-run', async () => {
    await propose(runId)
    await sql`UPDATE ai_pipeline_runs SET status = 'rejected' WHERE id = ${runId}`
    for (const status of ['proposed', 'approved', 'executed', 'needs_input']) {
      await expect(
        sql`UPDATE ai_pipeline_runs SET status = ${status}, approved_by = ${BOSS}, approved_at = now() WHERE id = ${runId}`,
      ).rejects.toThrow('AI_RUN_ALREADY_DECIDED')
    }
  })

  it('an executed run cannot go back to approved, and a run is never deleted', async () => {
    await propose(runId)
    await approve(runId)
    await sql`UPDATE ai_pipeline_runs SET status = 'executed' WHERE id = ${runId}`
    await expect(
      sql`UPDATE ai_pipeline_runs SET status = 'approved' WHERE id = ${runId}`,
    ).rejects.toThrow('AI_RUN_ALREADY_DECIDED')
    await expect(sql`DELETE FROM ai_pipeline_runs WHERE id = ${runId}`).rejects.toThrow(
      'AI_RUN_IMMUTABLE',
    )
  })

  it('what was asked, by whom and in which business is never rewritten', async () => {
    await expect(
      sql`UPDATE ai_pipeline_runs SET request_text = 'چیز دیگر' WHERE id = ${runId}`,
    ).rejects.toThrow('AI_RUN_IMMUTABLE')
    await expect(
      sql`UPDATE ai_pipeline_runs SET requested_by = ${BOSS} WHERE id = ${runId}`,
    ).rejects.toThrow('AI_RUN_IMMUTABLE')
    await expect(
      sql`UPDATE ai_pipeline_runs SET workspace_id = ${BOSS} WHERE id = ${runId}`,
    ).rejects.toThrow('AI_RUN_IMMUTABLE')
  })

  it('an approval without an approver is refused', async () => {
    await propose(runId)
    await expect(
      sql`UPDATE ai_pipeline_runs SET status = 'approved' WHERE id = ${runId}`,
    ).rejects.toThrow('ai_pipeline_runs_approval_has_approver')
  })

  it('only the four operations of this round can be stored', async () => {
    await expect(
      sql`UPDATE ai_pipeline_runs SET operation = 'delete_invoice' WHERE id = ${runId}`,
    ).rejects.toThrow(/operation/)
  })

  it('the audit trail only grows', async () => {
    const [step] = await sql`
      INSERT INTO ai_pipeline_steps (run_id, workspace_id, stage, outcome, actor_id, detail)
      VALUES (${runId}, ${WS}, 'understand', 'ok', ${USER}, ${sql.json({ operation: 'create_customer' })})
      RETURNING id`
    await expect(
      sql`UPDATE ai_pipeline_steps SET outcome = 'failed' WHERE id = ${step!.id}`,
    ).rejects.toThrow('AI_STEP_APPEND_ONLY')
    await expect(sql`DELETE FROM ai_pipeline_steps WHERE id = ${step!.id}`).rejects.toThrow(
      'AI_STEP_APPEND_ONLY',
    )
    await expect(
      sql`INSERT INTO ai_pipeline_steps (run_id, workspace_id, stage, outcome) VALUES (${runId}, ${WS}, 'think', 'ok')`,
    ).rejects.toThrow(/stage/)
  })

  it('a step needs a run that exists', async () => {
    await expect(
      sql`INSERT INTO ai_pipeline_steps (run_id, workspace_id, stage, outcome)
          VALUES (${BOSS}, ${WS}, 'understand', 'ok')`,
    ).rejects.toThrow(/foreign key/)
  })

  it('a browser role cannot read runs, steps or the switch', async () => {
    for (const table of ['ai_pipeline_runs', 'ai_pipeline_steps', 'ai_pipeline_settings']) {
      await expect(
        sql.begin(async (tx) => {
          await tx`SET LOCAL ROLE authenticated`
          await tx.unsafe(`SELECT * FROM ${table}`)
        }),
      ).rejects.toThrow(/permission denied/)
    }
  })
})
