// ============================================
// docs/activity-reads-01-migration.sql run unchanged (twice) in a real
// Postgres, with Supabase's default privileges, then its VERIFY — plus the
// per-person isolation, workspace isolation, deduplication, concurrent
// mark_all, and cascade delete tests.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'

const PORT = freePortSync()
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-activity-reads-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/act_reads`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')

const WS_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const WS_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const USER_A = '11111111-1111-4111-8111-111111111111'
const USER_B = '22222222-2222-4222-8222-222222222222'

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('act_reads')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    END $$;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

    -- Prerequisites: workspaces and activities tables
    CREATE TABLE workspaces (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL
    );

    CREATE TABLE activities (
      id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id     uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      actor_id         uuid,
      entity_type      text NOT NULL,
      entity_id        uuid NOT NULL,
      action           text NOT NULL,
      title            text NOT NULL,
      description      text,
      reference_number text,
      icon             text,
      metadata         jsonb DEFAULT '{}'::jsonb NOT NULL,
      entity_snapshot  jsonb DEFAULT '[]'::jsonb,
      importance       smallint DEFAULT 0 NOT NULL,
      is_read          boolean DEFAULT false NOT NULL,
      is_pinned        boolean DEFAULT false NOT NULL,
      is_archived      boolean DEFAULT false NOT NULL,
      created_at       timestamptz DEFAULT now() NOT NULL,
      updated_at       timestamptz DEFAULT now() NOT NULL,
      actor_name       text
    );

    INSERT INTO workspaces (id, name) VALUES
      ('${WS_A}', 'Workspace A'),
      ('${WS_B}', 'Workspace B');
  `)

  // Run the migration TWICE using max: 1 connection to prove idempotency
  const migration = read('activity-reads-01-migration.sql')
  await setup.unsafe(migration)
  await setup.unsafe(migration)
  await setup.end()

  sql = postgres(url, { max: 5, onnotice: () => {} })
}, 60_000)

afterAll(async () => {
  if (sql) await sql.end()
  try {
    await pg.stop()
  } catch {
    // ignore teardown errors
  }
  rmSync(dir, { recursive: true, force: true })
})

describe('docs/activity-reads-01-migration.sql', () => {
  it('runs idempotently (twice) on real Postgres and VERIFY passes', async () => {
    const verify = read('VERIFY-activity-reads-01.sql')
    const [row] = await sql.unsafe(verify)
    expect(row?.ok, JSON.stringify(row)).toBe(true)
  })

  it('marks read idempotently (marking twice = 1 row in table, second call returns 0)', async () => {
    const [act] = await sql`
      INSERT INTO activities (workspace_id, actor_id, entity_type, entity_id, action, title)
      VALUES (${WS_A}, ${USER_A}, 'invoice', gen_random_uuid(), 'created', 'Invoice 1')
      RETURNING id
    `
    const actId = act!.id

    const [first] = await sql`
      SELECT public.activity_mark_read(${WS_A}, ${USER_A}, ARRAY[${actId}]::uuid[]) AS marked
    `
    expect(first!.marked).toBe(1)

    const [second] = await sql`
      SELECT public.activity_mark_read(${WS_A}, ${USER_A}, ARRAY[${actId}]::uuid[]) AS marked
    `
    expect(second!.marked).toBe(0)

    const rows = await sql`
      SELECT * FROM public.activity_reads WHERE activity_id = ${actId} AND user_id = ${USER_A}
    `
    expect(rows.length).toBe(1)
  })

  it('refuses to mark an id of another workspace (no existence leak, returns 0 marked)', async () => {
    const [actB] = await sql`
      INSERT INTO activities (workspace_id, actor_id, entity_type, entity_id, action, title)
      VALUES (${WS_B}, ${USER_A}, 'invoice', gen_random_uuid(), 'created', 'Invoice B')
      RETURNING id
    `
    const actIdB = actB!.id

    // User A in Workspace A attempts to mark activity from Workspace B
    const [result] = await sql`
      SELECT public.activity_mark_read(${WS_A}, ${USER_A}, ARRAY[${actIdB}]::uuid[]) AS marked
    `
    expect(result!.marked).toBe(0)

    const rows = await sql`
      SELECT * FROM public.activity_reads WHERE activity_id = ${actIdB}
    `
    expect(rows.length).toBe(0)
  })

  it("the feed is personal: A marking all leaves B's own events unread, and never counts them", async () => {
    const unread = async (user: string) => {
      const [row] = await sql`SELECT public.activity_get_unread_count(${WS_A}, ${user}) AS unread`
      return Number(row?.unread)
    }
    const beforeA = await unread(USER_A)
    const beforeB = await unread(USER_B)

    const [mine] = await sql`
      INSERT INTO activities (workspace_id, actor_id, entity_type, entity_id, action, title)
      VALUES (${WS_A}, ${USER_A}, 'customer', gen_random_uuid(), 'created', 'A did this')
      RETURNING id
    `
    const [theirs] = await sql`
      INSERT INTO activities (workspace_id, actor_id, entity_type, entity_id, action, title)
      VALUES (${WS_A}, ${USER_B}, 'customer', gen_random_uuid(), 'created', 'B did this')
      RETURNING id
    `
    expect(await unread(USER_A)).toBe(beforeA + 1)
    expect(await unread(USER_B)).toBe(beforeB + 1)

    // A cannot mark B's event, by id or with «mark all».
    const [byId] = await sql`
      SELECT public.activity_mark_read(${WS_A}, ${USER_A}, ARRAY[${theirs!.id}]::uuid[]) AS marked
    `
    expect(byId!.marked).toBe(0)
    await sql`SELECT public.activity_mark_all_read(${WS_A}, ${USER_A}, NULL)`

    expect(await unread(USER_A)).toBe(0)
    expect(await unread(USER_B)).toBe(beforeB + 1)

    const reads = await sql`
      SELECT activity_id, user_id FROM public.activity_reads
      WHERE activity_id IN (${mine!.id}, ${theirs!.id})
    `
    expect(reads.map((row) => [row.activity_id, row.user_id])).toEqual([[mine!.id, USER_A]])

    const [counts] = await sql`SELECT public.activity_get_filter_counts(${WS_A}, ${USER_B}) AS c`
    expect(Number(counts!.c.unread)).toBe(beforeB + 1)
    expect(Number(counts!.c.all)).toBe(beforeB + 1)
    // B's one event is a customer event, and unread: it is in the per-tab unread.
    expect(counts!.c.unreadBy).toEqual({ invoices: 0, payments: 0, customers: beforeB + 1 })

    // A read everything: A's per-tab unread is zero on every tab, while the
    // totals of A's tabs are not.
    const [mineCounts] =
      await sql`SELECT public.activity_get_filter_counts(${WS_A}, ${USER_A}) AS c`
    expect(mineCounts!.c.unreadBy).toEqual({ invoices: 0, payments: 0, customers: 0 })
    expect(Number(mineCounts!.c.all)).toBeGreaterThan(0)
  })

  it('concurrent mark_all calls both succeed and row count is correct', async () => {
    const [act1] = await sql`
      INSERT INTO activities (workspace_id, actor_id, entity_type, entity_id, action, title)
      VALUES (${WS_A}, ${USER_A}, 'payment', gen_random_uuid(), 'received', 'Payment 1')
      RETURNING id
    `
    const [act2] = await sql`
      INSERT INTO activities (workspace_id, actor_id, entity_type, entity_id, action, title)
      VALUES (${WS_A}, ${USER_A}, 'payment', gen_random_uuid(), 'received', 'Payment 2')
      RETURNING id
    `

    // Run two mark_all concurrently for USER_A with filter 'payments'
    const [res1, res2] = await Promise.all([
      sql`SELECT public.activity_mark_all_read(${WS_A}, ${USER_A}, 'payments') AS marked`,
      sql`SELECT public.activity_mark_all_read(${WS_A}, ${USER_A}, 'payments') AS marked`,
    ])

    const totalMarked = (res1[0]!.marked as number) + (res2[0]!.marked as number)
    // Between both calls, exactly 2 rows were inserted
    expect(totalMarked).toBe(2)

    const rows = await sql`
      SELECT * FROM public.activity_reads
      WHERE activity_id IN (${act1!.id}, ${act2!.id}) AND user_id = ${USER_A}
    `
    expect(rows.length).toBe(2)
  })

  it('deleting an activity removes its reads via CASCADE', async () => {
    const [act] = await sql`
      INSERT INTO activities (workspace_id, actor_id, entity_type, entity_id, action, title)
      VALUES (${WS_A}, ${USER_A}, 'invoice', gen_random_uuid(), 'deleted', 'Temp Invoice')
      RETURNING id
    `
    const actId = act!.id

    await sql`
      SELECT public.activity_mark_read(${WS_A}, ${USER_A}, ARRAY[${actId}]::uuid[])
    `
    const beforeDel = await sql`
      SELECT * FROM public.activity_reads WHERE activity_id = ${actId}
    `
    expect(beforeDel.length).toBe(1)

    await sql`DELETE FROM public.activities WHERE id = ${actId}`

    const afterDel = await sql`
      SELECT * FROM public.activity_reads WHERE activity_id = ${actId}
    `
    expect(afterDel.length).toBe(0)
  })
})
