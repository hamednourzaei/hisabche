import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'

let pg: EmbeddedPostgres | undefined
let sql: postgres.Sql | undefined
let dataDir: string | undefined

describe('time-entries-unify-01 migration (real PostgreSQL)', () => {
  beforeAll(async () => {
    const port = freePortSync()
    dataDir = pgTempDir('time-entries-unify-01')
    pg = new EmbeddedPostgres({ databaseDir: dataDir, port, user: 'postgres', password: 'pw' })
    await pg.initialise()
    await pg.start()
    sql = postgres({
      host: '127.0.0.1',
      port,
      user: 'postgres',
      password: 'pw',
      database: 'postgres',
    })
    await sql.unsafe(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      CREATE TABLE workspaces (id uuid PRIMARY KEY);
      CREATE TABLE projects (id uuid PRIMARY KEY, workspace_id uuid NOT NULL);
      CREATE TABLE project_time_entries (
        id uuid PRIMARY KEY,
        workspace_id uuid NOT NULL,
        project_id uuid NOT NULL,
        task_id uuid,
        employee_id uuid NOT NULL,
        date date NOT NULL,
        hours numeric(8,2) NOT NULL,
        description text,
        billable boolean DEFAULT true,
        hourly_rate numeric(14,2),
        created_at timestamptz DEFAULT now()
      );
      CREATE TABLE time_entries (
        id uuid PRIMARY KEY,
        workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        task_id uuid,
        employee_id uuid NOT NULL,
        on_date date NOT NULL,
        minutes integer NOT NULL CHECK (minutes > 0),
        billable boolean NOT NULL DEFAULT true,
        rate_minor bigint,
        invoice_id uuid,
        description text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `)
  }, 60_000)

  afterAll(async () => {
    await sql?.end()
    await pg?.stop()
  })

  it('copies project_time_entries into time_entries idempotently without deleting source rows', async () => {
    if (!sql) throw new Error('pg not started')
    const ws = '11111111-1111-4111-8111-111111111111'
    const proj = '22222222-2222-4222-8222-222222222222'
    const emp = '33333333-3333-4333-8333-333333333333'
    const entryId = '44444444-4444-4444-8444-444444444444'

    await sql.unsafe(`INSERT INTO workspaces (id) VALUES ('${ws}')`)
    await sql.unsafe(`INSERT INTO projects (id, workspace_id) VALUES ('${proj}', '${ws}')`)
    await sql.unsafe(`
      INSERT INTO project_time_entries (id, workspace_id, project_id, employee_id, date, hours, description, billable, hourly_rate)
      VALUES ('${entryId}', '${ws}', '${proj}', '${emp}', '2026-11-10', 2.50, 'Audit work', true, 1500.00)
    `)

    const migrationSql = readFileSync(
      join(__dirname, '../../../docs/time-entries-unify-01-migration.sql'),
      'utf8',
    )
    await sql.unsafe(migrationSql)
    await sql.unsafe(migrationSql)

    const teRows = await sql<
      { id: string; minutes: number; rate_minor: string; billable: boolean }[]
    >`
      SELECT id, minutes, rate_minor::text, billable FROM time_entries
    `
    expect(teRows).toHaveLength(1)
    expect(teRows[0]!.id).toBe(entryId)
    expect(teRows[0]!.minutes).toBe(150)
    expect(teRows[0]!.rate_minor).toBe('150000')
    expect(teRows[0]!.billable).toBe(true)

    const pteRows = await sql<{ id: string }[]>`SELECT id FROM project_time_entries`
    expect(pteRows).toHaveLength(1)
  })
})
