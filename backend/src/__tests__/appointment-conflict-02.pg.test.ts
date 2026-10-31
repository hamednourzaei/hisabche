// ============================================
// docs/appointment-conflict-02-migration.sql, run for real — twice — and raced.
//
// BUG-NEW-011: a staff member must not be double-booked. The service checks and then
// inserts, so two requests can both pass the check. The exclusion constraint is what
// makes the second one fail; two connections book the same hour at the same moment.
// ============================================

import { readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'

const PORT = freePortSync()
const dir = pgTempDir('hisabche-pg-apptconf-')
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
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const STAFF = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const OTHER_STAFF = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

let sql: ReturnType<typeof postgres>
let second: ReturnType<typeof postgres>

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  const connect = () =>
    postgres({ host: 'localhost', port: PORT, user: 'postgres', password: 'test', max: 1 })
  sql = connect()
  second = connect()
  await sql.unsafe(`
    CREATE TABLE public.appointments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,
      customer_id uuid NOT NULL DEFAULT gen_random_uuid(),
      staff_employee_id uuid,
      service_product_id uuid NOT NULL DEFAULT gen_random_uuid(),
      start_time timestamptz NOT NULL,
      end_time timestamptz NOT NULL,
      status text NOT NULL DEFAULT 'scheduled',
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `)
}, 120_000)

afterAll(async () => {
  await sql?.end()
  await second?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
})

const book = (
  db: ReturnType<typeof postgres>,
  staff: string,
  from: string,
  to: string,
  status = 'scheduled',
) => db`
  INSERT INTO public.appointments (workspace_id, staff_employee_id, start_time, end_time, status)
  VALUES (${WS}, ${staff}, ${from}, ${to}, ${status})`

const code = async (run: () => PromiseLike<unknown>): Promise<string | null> => {
  try {
    await run()
    return null
  } catch (error) {
    return (error as { code?: string }).code ?? 'unknown'
  }
}

const constraintExists = async () => {
  const [row] = await sql`
    SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_no_staff_overlap') AS present`
  return row?.present === true
}

describe('appointment-conflict-02', () => {
  it('⚠️ existing overlapping bookings stop the migration instead of being changed', async () => {
    await book(sql, STAFF, '2026-11-02T10:00:00Z', '2026-11-02T11:00:00Z')
    await book(sql, STAFF, '2026-11-02T10:30:00Z', '2026-11-02T11:30:00Z')
    await sql.unsafe(read('appointment-conflict-02-migration.sql'))

    expect(await constraintExists()).toBe(false)
    const [row] = await sql`SELECT count(*)::int AS count FROM public.appointments`
    expect(row?.count).toBe(2)
  })

  it('once the clash is resolved, the migration adds the constraint — and a second run is a no-op', async () => {
    await sql`DELETE FROM public.appointments`
    await book(sql, STAFF, '2026-11-02T10:00:00Z', '2026-11-02T11:00:00Z')
    await sql.unsafe(read('appointment-conflict-02-migration.sql'))
    expect(await constraintExists()).toBe(true)
    await sql.unsafe(read('appointment-conflict-02-migration.sql'))
    expect(await constraintExists()).toBe(true)
  })

  it('refuses an overlapping booking of the same staff member (23P01)', async () => {
    expect(await code(() => book(sql, STAFF, '2026-11-02T10:30:00Z', '2026-11-02T11:30:00Z'))).toBe(
      '23P01',
    )
  })

  it('allows back-to-back bookings, another staff member, and a cancelled clash', async () => {
    expect(
      await code(() => book(sql, STAFF, '2026-11-02T11:00:00Z', '2026-11-02T12:00:00Z')),
    ).toBeNull()
    expect(
      await code(() => book(sql, OTHER_STAFF, '2026-11-02T10:00:00Z', '2026-11-02T11:00:00Z')),
    ).toBeNull()
    expect(
      await code(() =>
        book(sql, STAFF, '2026-11-02T10:00:00Z', '2026-11-02T11:00:00Z', 'cancelled'),
      ),
    ).toBeNull()
  })

  it('⚠️ two connections booking the same free hour at the same moment: exactly one wins', async () => {
    const results = await Promise.all([
      code(() => book(sql, STAFF, '2026-11-03T09:00:00Z', '2026-11-03T10:00:00Z')),
      code(() => book(second, STAFF, '2026-11-03T09:30:00Z', '2026-11-03T10:30:00Z')),
    ])
    expect(results.filter((r) => r === null)).toHaveLength(1)
    expect(results.filter((r) => r === '23P01')).toHaveLength(1)

    const [row] = await sql`
      SELECT count(*)::int AS count FROM public.appointments
       WHERE staff_employee_id = ${STAFF} AND start_time >= '2026-11-03' AND start_time < '2026-11-04'`
    expect(row?.count).toBe(1)
  })

  it('the VERIFY queries say ok', async () => {
    const blocks = read('VERIFY-appointment-conflict-02.sql')
      .split(/;\s*\n/)
      .filter((block) => /SELECT/i.test(block))
    const [first] = await sql.unsafe(blocks[0] ?? '')
    expect(first).toMatchObject({ extension_exists: true, constraint_exists: true })
    const [kind] = await sql.unsafe(blocks[1] ?? '')
    expect(kind?.ok).toBe(true)
    expect(await sql.unsafe(blocks[2] ?? '')).toHaveLength(0)
  })
})
