// ============================================
// docs/workflow-escalation-01-migration.sql run unchanged (twice) in a real
// Postgres on the workflow tables as docs/base-schema-migration.sql left them,
// then docs/VERIFY-workflow-escalation-01.sql.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const PORT = 54000 + Math.floor(Math.random() * 900)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-esc-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/esc`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')
const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
let workflowId: string
let instanceId: string

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('esc')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    END $$;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    CREATE TYPE workflow_status AS ENUM ('pending', 'in_progress', 'approved', 'rejected', 'cancelled');
    CREATE TABLE workflows (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY, workspace_id uuid NOT NULL, name text NOT NULL,
      description text, entity_type text NOT NULL, is_active boolean DEFAULT true NOT NULL,
      created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL,
      deleted_at timestamptz);
    CREATE TABLE workflow_instances (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY, workflow_id uuid NOT NULL, workspace_id uuid NOT NULL,
      entity_type text NOT NULL, entity_id uuid NOT NULL, status workflow_status NOT NULL,
      current_step integer DEFAULT 0 NOT NULL, total_steps integer DEFAULT 0 NOT NULL,
      started_at timestamptz DEFAULT now() NOT NULL, completed_at timestamptz,
      created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL);
    -- A workflow and a waiting document that exist BEFORE the migration.
    INSERT INTO workflows (workspace_id, name, entity_type) VALUES ('${WS}', 'old', 'invoice');
    INSERT INTO workflow_instances (workflow_id, workspace_id, entity_type, entity_id, status, current_step)
      SELECT id, '${WS}', 'invoice', gen_random_uuid(), 'in_progress', 1 FROM workflows;`)
  await setup.unsafe(read('workflow-escalation-01-migration.sql'))
  await setup.unsafe(read('workflow-escalation-01-migration.sql'))
  await setup.end()
  sql = postgres(url, { max: 6, onnotice: () => {} })
  workflowId = (await sql`SELECT id FROM workflows`)[0]!.id
  instanceId = (await sql`SELECT id FROM workflow_instances`)[0]!.id
}, 240_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
})

beforeEach(async () => {
  await sql`TRUNCATE workflow_escalations`
  await sql`UPDATE workflows SET escalate_after_hours = NULL, escalate_to_role = NULL, escalate_max_times = 1`
})

describe('workflow escalation schema', () => {
  it('is OFF for a workflow that existed before the migration', async () => {
    const [row] =
      await sql`SELECT escalate_after_hours, escalate_to_role, escalate_max_times FROM workflows`
    expect(row).toMatchObject({
      escalate_after_hours: null,
      escalate_to_role: null,
      escalate_max_times: 1,
    })
    const [inst] =
      await sql`SELECT escalated_role, escalations, escalated_step FROM workflow_instances`
    expect(inst).toMatchObject({ escalated_role: null, escalations: 0, escalated_step: null })
  })

  it('accepts a whole policy and refuses half of one', async () => {
    await sql`UPDATE workflows SET escalate_after_hours = 24, escalate_to_role = 'manager' WHERE id = ${workflowId}`
    await expect(
      sql`UPDATE workflows SET escalate_after_hours = 24, escalate_to_role = NULL WHERE id = ${workflowId}`,
    ).rejects.toThrow()
    await expect(
      sql`UPDATE workflows SET escalate_after_hours = NULL, escalate_to_role = 'owner' WHERE id = ${workflowId}`,
    ).rejects.toThrow()
  })

  it('refuses a zero wait, a role that is not higher than any step, and too many repeats', async () => {
    await expect(
      sql`UPDATE workflows SET escalate_after_hours = 0, escalate_to_role = 'owner' WHERE id = ${workflowId}`,
    ).rejects.toThrow()
    await expect(
      sql`UPDATE workflows SET escalate_after_hours = 5, escalate_to_role = 'seller' WHERE id = ${workflowId}`,
    ).rejects.toThrow()
    await expect(
      sql`UPDATE workflows SET escalate_max_times = 9 WHERE id = ${workflowId}`,
    ).rejects.toThrow()
  })

  it('records one escalation per (document, step, role, outcome), however many arrive at once', async () => {
    const insert = (outcome: string, role = 'manager') => sql`
      INSERT INTO workflow_escalations (workspace_id, instance_id, step_order, from_role, to_role, outcome)
      VALUES (${WS}, ${instanceId}, 1, 'seller', ${role}, ${outcome})`
    const settled = await Promise.allSettled([1, 2, 3, 4].map(() => insert('escalated')))
    expect(settled.filter((s) => s.status === 'fulfilled')).toHaveLength(1)
    // A different outcome, or a different role, is a different fact.
    await insert('no_one')
    await insert('escalated', 'owner')
    expect(await sql`SELECT 1 FROM workflow_escalations`).toHaveLength(3)
    await expect(insert('approved')).rejects.toThrow()
  })

  it.each(['anon', 'authenticated'])('%s cannot read the escalation record', async (role) => {
    await expect(
      sql.begin(async (tx) => {
        await tx.unsafe(`SET LOCAL ROLE ${role}`)
        return tx.unsafe('SELECT * FROM workflow_escalations')
      }),
    ).rejects.toThrow(/permission denied/)
  })

  it('docs/VERIFY-workflow-escalation-01.sql runs and every check is ok', async () => {
    const rows = await sql.unsafe(read('VERIFY-workflow-escalation-01.sql'))
    expect(rows.length).toBe(13)
    expect(rows.filter((r) => r.ok !== true).map((r) => r.check)).toEqual([])
  })
})
