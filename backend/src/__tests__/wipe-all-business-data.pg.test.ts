// ============================================
// docs/WIPE-ALL-BUSINESS-DATA.sql on a real Postgres.
//
// It deletes data, so the three things that matter are proven by running it:
//   · as shipped (v_confirm = 'NO') it deletes NOTHING
//   · confirmed, it empties business data — including an append-only table
//     whose trigger refuses DELETE — and leaves accounts and settings
//   · when a kept table depends on a wiped one it stops and changes nothing
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const PORT = 58100 + Math.floor(Math.random() * 500)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-wipe-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/wipe`
let sql: postgres.Sql

const file = readFileSync(
  join(__dirname, '..', '..', '..', 'docs', 'WIPE-ALL-BUSINESS-DATA.sql'),
  'utf8',
)
const part = (n: 1 | 2 | 3) => {
  const start = file.indexOf(`-- PART ${n} —`)
  const next = n === 3 ? file.length : file.indexOf(`-- PART ${n + 1} —`)
  // From the line after the banner's closing rule to the next banner's opening rule.
  const body = file.slice(file.indexOf('\n', file.indexOf('\n', start) + 1) + 1, next)
  return n === 3 ? body : body.slice(0, body.lastIndexOf('-- ═'))
}
const verify = readFileSync(
  join(__dirname, '..', '..', '..', 'docs', 'VERIFY-reset-all-business-data.sql'),
  'utf8',
)
/** The KEEP list of a file: every quoted name between `keep (name) AS (` and its end. */
const keepList = (text: string) => {
  const from = text.indexOf('WITH keep (name) AS (')
  return [...text.slice(from, text.indexOf('candidates AS (', from)).matchAll(/'([a-z_]+)'/g)]
    .map((match) => match[1]!)
    .sort()
}
const confirmed = () =>
  part(2).replace("constant text := 'NO'", "constant text := 'YES-DELETE-ALL-BUSINESS-DATA'")

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const count = async (table: string) =>
  Number((await sql.unsafe(`SELECT count(*)::int AS n FROM public.${table}`))[0]!.n)

async function seed() {
  await sql.unsafe(`
    INSERT INTO workspaces VALUES ('${WS}', 'shop', 'AFN');
    INSERT INTO workspace_members (workspace_id, user_id) VALUES ('${WS}', gen_random_uuid());
    INSERT INTO accounts (workspace_id, code) VALUES ('${WS}', '1000');
    INSERT INTO blog_posts (workspace_id, title) VALUES ('${WS}', 'kept');
    INSERT INTO products (id, workspace_id, name) VALUES ('11111111-1111-4111-8111-111111111111', '${WS}', 'gold');
    INSERT INTO invoices (id, workspace_id, total) VALUES ('22222222-2222-4222-8222-222222222222', '${WS}', 10);
    INSERT INTO invoice_items (invoice_id, product_id) VALUES
      ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111');
    INSERT INTO journal_entries (workspace_id, memo) VALUES ('${WS}', 'x');
    INSERT INTO employees (workspace_id, name) VALUES ('${WS}', 'Ahmad');
    INSERT INTO activities (workspace_id, title) VALUES ('${WS}', 'did a thing');
  `)
}

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('wipe')
  sql = postgres(url, { max: 1, onnotice: () => {} })
  await sql.unsafe(`
    CREATE TABLE workspaces (id uuid PRIMARY KEY, name text, base_currency text);
    CREATE TABLE workspace_members (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid REFERENCES workspaces(id), user_id uuid);
    CREATE TABLE accounts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid, code text);
    CREATE TABLE blog_posts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid, title text);
    CREATE TABLE products (id uuid PRIMARY KEY, workspace_id uuid, name text);
    CREATE TABLE invoices (id uuid PRIMARY KEY, workspace_id uuid, total numeric);
    -- No workspace_id of its own: it goes because it depends on invoices.
    CREATE TABLE invoice_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_id uuid REFERENCES invoices(id), product_id uuid REFERENCES products(id));
    CREATE TABLE journal_entries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid, memo text);
    CREATE TABLE employees (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid, name text);
    CREATE TABLE activities (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid, title text);

    -- As on the real database: the ledger refuses DELETE.
    CREATE FUNCTION no_delete() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'APPEND_ONLY'; END $$;
    CREATE TRIGGER journal_no_delete BEFORE DELETE ON journal_entries
      FOR EACH ROW EXECUTE FUNCTION no_delete();
  `)
  await seed()
}, 120_000)

afterAll(async () => {
  if (sql) await sql.end()
  try {
    await pg.stop()
  } catch {
    // teardown only
  }
  rmSync(dir, { recursive: true, force: true })
})

describe('docs/WIPE-ALL-BUSINESS-DATA.sql', () => {
  it('the preview changes nothing and says, table by table, what would go and what stays', async () => {
    const rows = await sql.unsafe(part(1))
    const by = (what: string) =>
      rows
        .filter((row) => row.what === what)
        .map((row) => String(row.table))
        .sort()
    expect(by('will be emptied')).toEqual(
      [
        'activities',
        'employees',
        'invoice_items',
        'invoices',
        'journal_entries',
        'products',
      ].sort(),
    )
    expect(by('stays')).toEqual(['accounts', 'blog_posts', 'workspace_members', 'workspaces'])
    expect(rows.find((row) => row.table === 'invoices')!.rows).toBe('1')
    expect(await count('invoices')).toBe(1)
  })

  it('⚠️ the wider VERIFY targets exactly what the wipe does: one KEEP list, not two', () => {
    expect(keepList(verify)).toEqual(keepList(file))
    expect(keepList(verify).length).toBeGreaterThan(50)
    // Read-only: it must never be able to change anything.
    expect(verify).not.toMatch(/\b(TRUNCATE|DELETE|UPDATE|INSERT|DROP|ALTER)\b/)
  })

  it('before the wipe, the VERIFY says what is there and where', async () => {
    const rows = await sql.unsafe(verify)
    expect(rows[0]!.name).toBe('business rows left')
    expect(rows[0]!.ok).toBe(false)
    expect(
      rows.filter((row) => String(row.name).startsWith('left in: ')).map((row) => row.name),
    ).toContain('left in: invoices')
  })

  it('⚠️ as shipped it deletes NOTHING — the confirmation has to be typed', async () => {
    await expect(sql.unsafe(part(2))).rejects.toThrow('Nothing was deleted')
    for (const table of ['invoices', 'products', 'employees', 'journal_entries', 'activities']) {
      expect(await count(table), table).toBe(1)
    }
  })

  it('⚠️ an ACCOUNT table that depends on a wiped one stops it, with everything still there', async () => {
    // Membership (never touched) pointing at an employee (wiped).
    await sql.unsafe(
      'ALTER TABLE workspace_members ADD COLUMN employee_id uuid REFERENCES employees(id)',
    )
    await expect(sql.unsafe(confirmed())).rejects.toThrow('workspace_members')
    expect(await count('invoices')).toBe(1)
    expect(await count('employees')).toBe(1)
    expect(await count('workspace_members')).toBe(1)
    await sql.unsafe('ALTER TABLE workspace_members DROP COLUMN employee_id')
  })

  it('a SETTING that points at wiped data is shown in the preview as going with it', async () => {
    // A tax rule about one product: without the product it is not a rule.
    await sql.unsafe(`
      CREATE TABLE tax_rules (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid,
        product_id uuid REFERENCES products(id));
      INSERT INTO tax_rules (workspace_id, product_id)
      VALUES ('${WS}', '11111111-1111-4111-8111-111111111111');
    `)
    const rows = await sql.unsafe(part(1))
    expect(String(rows.find((row) => row.table === 'tax_rules')!.what)).toContain(
      'a setting that points at wiped data',
    )
    // A setting that points at nothing wiped stays.
    expect(rows.find((row) => row.table === 'accounts')!.what).toBe('stays')
  })

  it('confirmed: business data is gone — the append-only ledger too — and accounts and settings remain', async () => {
    await sql.unsafe(confirmed())
    for (const table of [
      'invoices',
      'invoice_items',
      'products',
      'employees',
      'journal_entries',
      'activities',
    ]) {
      expect(await count(table), table).toBe(0)
    }
    for (const table of ['workspaces', 'workspace_members', 'accounts', 'blog_posts']) {
      expect(await count(table), table).toBe(1)
    }
    // The setting that pointed at a product went with the product.
    expect(await count('tax_rules')).toBe(0)
    // The trigger that refuses DELETE is still there afterwards.
    await sql.unsafe(`INSERT INTO journal_entries (workspace_id, memo) VALUES ('${WS}', 'after')`)
    await expect(sql.unsafe('DELETE FROM journal_entries')).rejects.toThrow('APPEND_ONLY')
  })

  it('the check afterwards counts what is left, and tolerates a table this database does not have', async () => {
    const rows = await sql.unsafe(part(3))
    expect(rows.find((row) => row.table === 'invoices')!.rows_left).toBe('0')
    expect(rows.find((row) => row.table === 'pos_sessions')!.rows_left).toBeNull()
  })

  it('after the wipe, the VERIFY finds nothing left in ANY targeted table, and the accounts intact', async () => {
    // The test above wrote one ledger row after the wipe: the VERIFY sees it.
    const dirty = await sql.unsafe(verify)
    expect(dirty[0]!.ok).toBe(false)
    expect(dirty.filter((row) => String(row.name).startsWith('left in: '))).toEqual([
      { name: 'left in: journal_entries', ok: false, detail: '1 rows' },
    ])
    await sql.unsafe(confirmed())

    const rows = await sql.unsafe(verify)
    expect(rows[0]).toMatchObject({ name: 'business rows left', ok: true })
    expect(rows.filter((row) => String(row.name).startsWith('left in: '))).toEqual([])
    expect(rows.find((row) => row.name === 'kept: workspaces')!.detail).toBe('1 rows')
    expect(rows.find((row) => row.name === 'kept: workspace_members')!.detail).toBe('1 rows')
    expect(rows.find((row) => row.name === 'kept: api_keys')!.detail).toBe('no such table here')
  })

  it('running it again on an empty database is harmless', async () => {
    await sql.unsafe(confirmed())
    expect(await count('workspaces')).toBe(1)
  })
})
