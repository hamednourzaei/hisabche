// ============================================
// docs/workspace-create-01-migration.sql run unchanged (twice) in a real
// Postgres with Supabase's default privileges, then its VERIFY — plus the rule
// the function exists for: the workspace and its owner's membership are
// written together or not at all.
// ============================================

import { readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'

const PORT = freePortSync()
const dir = pgTempDir('hisabche-pg-wsc-')
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/wsc`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')
const OWNER = '11111111-1111-4111-8111-111111111111'
const FAILING_OWNER = '99999999-9999-4999-8999-999999999999'

const create = (owner: string | null, name: string, extra: Record<string, string | null> = {}) =>
  sql`SELECT public.workspace_create_with_owner(
        ${owner}::uuid, ${name}, ${extra.slug ?? null}, NULL, NULL, NULL,
        ${extra.currency ?? null}, ${extra.timeZone ?? null}) AS id`

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('wsc')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    END $$;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    -- As on Supabase: every new table and function in public arrives already
    -- granted to the three API roles.
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

    -- The two tables as docs/base-schema-migration.sql defines them, plus the
    -- columns later migrations add (stamp, base currency, time zone).
    CREATE TABLE workspaces (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      name text NOT NULL,
      slug text NOT NULL,
      description text,
      logo_url text,
      owner_id uuid NOT NULL,
      is_active boolean DEFAULT true,
      created_at timestamp without time zone DEFAULT now(),
      updated_at timestamp without time zone DEFAULT now(),
      stamp_url text,
      base_currency text NOT NULL DEFAULT 'AFN',
      time_zone text
    );
    -- Whether the live database holds this is unknown; the function must cope.
    CREATE UNIQUE INDEX workspaces_slug_key ON workspaces (slug);
    CREATE TABLE workspace_members (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      workspace_id uuid NOT NULL,
      user_id uuid NOT NULL,
      role text,
      joined_at timestamp without time zone DEFAULT now(),
      created_at timestamp without time zone DEFAULT now(),
      has_access boolean DEFAULT true NOT NULL,
      -- The base schema's own default, which would suspend every new member.
      suspended_at timestamp with time zone DEFAULT now()
    );

    -- A membership insert that fails, to prove the workspace is rolled back.
    CREATE FUNCTION refuse_member() RETURNS trigger LANGUAGE plpgsql AS $f$
    BEGIN
      IF NEW.user_id = '${FAILING_OWNER}'::uuid THEN
        RAISE EXCEPTION 'MEMBER_INSERT_REFUSED';
      END IF;
      RETURN NEW;
    END $f$;
    CREATE TRIGGER refuse_member BEFORE INSERT ON workspace_members
      FOR EACH ROW EXECUTE FUNCTION refuse_member();`)
  await setup.unsafe(read('workspace-create-01-migration.sql'))
  await setup.unsafe(read('workspace-create-01-migration.sql'))
  await setup.end()
  sql = postgres(url, { max: 4, onnotice: () => {} })
}, 240_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
})

beforeEach(async () => {
  await sql`TRUNCATE workspaces, workspace_members`
})

describe('workspace-create-01', () => {
  it('VERIFY: every check is ok', async () => {
    await create(OWNER, 'دکان نمونه')
    const rows = await sql.unsafe(read('VERIFY-workspace-create-01.sql'))
    const failed = rows.filter((row) => row.ok !== true).map((row) => row.check)
    expect(failed).toEqual([])
    expect(rows.length).toBe(6)
  })

  it('writes the workspace and an active owner membership together', async () => {
    const [row] = await create(OWNER, 'دکان نمونه', { currency: 'USD', timeZone: 'Asia/Kabul' })
    const id = row!.id as string
    const [ws] =
      await sql`SELECT owner_id, base_currency, time_zone FROM workspaces WHERE id = ${id}`
    expect(ws).toMatchObject({ owner_id: OWNER, base_currency: 'USD', time_zone: 'Asia/Kabul' })
    const members = await sql`
      SELECT role, has_access, suspended_at FROM workspace_members
       WHERE workspace_id = ${id} AND user_id = ${OWNER}`
    expect(members).toHaveLength(1)
    // Written explicitly — the column default (now()) would have suspended the owner.
    expect(members[0]).toMatchObject({ role: 'owner', has_access: true, suspended_at: null })
  })

  it('a failed membership leaves no workspace behind', async () => {
    await expect(create(FAILING_OWNER, 'نیمه‌کاره')).rejects.toThrow('MEMBER_INSERT_REFUSED')
    const [count] =
      await sql`SELECT count(*)::int AS n FROM workspaces WHERE owner_id = ${FAILING_OWNER}`
    expect(count!.n).toBe(0)
  })

  it('a slug that is taken gets a suffix instead of failing', async () => {
    await create(OWNER, 'Same Name')
    const [second] = await create(OWNER, 'Same Name')
    const slugs = await sql`SELECT slug FROM workspaces ORDER BY created_at, slug`
    expect(slugs).toHaveLength(2)
    expect(slugs.map((s) => s.slug)).toContain('same-name')
    const [other] = await sql`SELECT slug FROM workspaces WHERE id = ${second!.id as string}`
    expect(other!.slug).toMatch(/^same-name-[0-9a-f]{8}$/)
  })

  it('refuses a missing owner or an empty name by name', async () => {
    await expect(create(null, 'x')).rejects.toThrow('WORKSPACE_OWNER_REQUIRED')
    await expect(create(OWNER, '   ')).rejects.toThrow('WORKSPACE_NAME_REQUIRED')
  })

  it('only service_role may execute it', async () => {
    for (const role of ['anon', 'authenticated']) {
      await expect(
        sql.begin(async (tx) => {
          await tx.unsafe(`SET LOCAL ROLE ${role}`)
          await tx`SELECT public.workspace_create_with_owner(${OWNER}::uuid, 'x', NULL)`
        }),
      ).rejects.toThrow(/permission denied/)
    }
  })
})
