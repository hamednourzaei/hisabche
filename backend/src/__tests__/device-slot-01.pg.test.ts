// ============================================
// docs/device-slot-01-migration.sql, run for real — twice — and raced.
//
// 25C: the offline licence holds at most two devices per kind. The service reads
// the active devices and then inserts, so the cap has to be the database's. Two
// connections insert the same numbered place at the same moment; exactly one may win.
// ============================================

import { readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'

const PORT = freePortSync()
const dir = pgTempDir('hisabche-pg-devslot-')
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
/** The SELECT statements of a VERIFY file, one per block. */
const blocksOf = (name: string) =>
  read(name)
    .split(/;\s*\n/)
    .filter((block) => /SELECT/i.test(block))

const LICENSE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const WORKSPACE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

let sql: ReturnType<typeof postgres>
let second: ReturnType<typeof postgres>

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  const connect = () =>
    postgres({ host: 'localhost', port: PORT, user: 'postgres', password: 'test', max: 1 })
  sql = connect()
  second = connect()
  // The table as docs/entitlement-01 + 02 leave it (the columns this migration touches).
  await sql.unsafe(`
    CREATE TABLE public.devices (
      device_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,
      license_id uuid,
      seat text,
      stable_id text,
      is_active boolean NOT NULL DEFAULT true,
      activated_at timestamptz NOT NULL DEFAULT now()
    );
    -- Two devices already on the computer seat, written before the slot existed.
    INSERT INTO public.devices (workspace_id, license_id, seat, stable_id, activated_at) VALUES
      ('${WORKSPACE}', '${LICENSE}', 'computer', 'old-pc-1', now() - interval '2 days'),
      ('${WORKSPACE}', '${LICENSE}', 'computer', 'old-pc-2', now() - interval '1 day');
  `)
}, 120_000)

afterAll(async () => {
  await sql?.end()
  await second?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
})

const code = async (run: () => PromiseLike<unknown>): Promise<string | null> => {
  try {
    await run()
    return null
  } catch (error) {
    return (error as { code?: string }).code ?? 'unknown'
  }
}

describe('device-slot-01', () => {
  it('before it runs, the VERIFY query says the column is missing', async () => {
    const [row] = await sql.unsafe(blocksOf('VERIFY-device-slot-01.sql')[0] ?? '')
    expect(row).toMatchObject({ column_slot_exists: false, index_exists: false })
  })

  it('numbers the places of devices that were already active, oldest first', async () => {
    await sql.unsafe(read('device-slot-01-migration.sql'))
    const rows = await sql`SELECT stable_id, slot FROM public.devices ORDER BY activated_at`
    expect(rows.map((r) => [r.stable_id, r.slot])).toEqual([
      ['old-pc-1', 1],
      ['old-pc-2', 2],
    ])
  })

  it('a second run changes nothing', async () => {
    await sql.unsafe(read('device-slot-01-migration.sql'))
    const rows = await sql`SELECT slot FROM public.devices ORDER BY activated_at`
    expect(rows.map((r) => r.slot)).toEqual([1, 2])
  })

  it('refuses a third device on a full seat, and a place outside 1..2', async () => {
    const insert = (seat: string, slot: number) => () =>
      sql`INSERT INTO public.devices (workspace_id, license_id, seat, stable_id, slot)
          VALUES (${WORKSPACE}, ${LICENSE}, ${seat}, ${'x-' + seat + slot}, ${slot})`
    expect(await code(insert('computer', 1))).toBe('23505')
    expect(await code(insert('computer', 2))).toBe('23505')
    expect(await code(insert('mobile', 3))).toBe('23514')
  })

  it('⚠️ two connections taking the same free place at the same moment: exactly one wins', async () => {
    const take = (db: ReturnType<typeof postgres>, who: string) => () =>
      db`INSERT INTO public.devices (workspace_id, license_id, seat, stable_id, slot)
         VALUES (${WORKSPACE}, ${LICENSE}, 'mobile', ${who}, 1)`
    const results = await Promise.all([code(take(sql, 'mob-a')), code(take(second, 'mob-b'))])
    expect(results.filter((r) => r === null)).toHaveLength(1)
    expect(results.filter((r) => r === '23505')).toHaveLength(1)

    const [row] = await sql`
      SELECT count(*)::int AS count FROM public.devices
       WHERE license_id = ${LICENSE} AND seat = 'mobile' AND is_active AND slot = 1`
    expect(row?.count).toBe(1)
  })

  it('a released device frees its place', async () => {
    await sql`UPDATE public.devices SET is_active = false WHERE stable_id = 'old-pc-2'`
    const again = await code(
      () => sql`INSERT INTO public.devices (workspace_id, license_id, seat, stable_id, slot)
                VALUES (${WORKSPACE}, ${LICENSE}, 'computer', 'new-pc', 2)`,
    )
    expect(again).toBeNull()
  })

  it('after the migration the VERIFY queries say ok', async () => {
    const blocks = blocksOf('VERIFY-device-slot-01.sql')
    const [first] = await sql.unsafe(blocks[0] ?? '')
    expect(first).toMatchObject({
      column_slot_exists: true,
      check_exists: true,
      index_exists: true,
    })
    const [unique] = await sql.unsafe(blocks[1] ?? '')
    expect(unique?.ok).toBe(true)
    const [capped] = await sql.unsafe(blocks[2] ?? '')
    expect(capped?.ok).toBe(true)
  })
})
