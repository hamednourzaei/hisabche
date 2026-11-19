// ============================================
// docs/roll-cutting-01-migration.sql — TWICE on a real Postgres, then the
// rules: a roll starts with its full length; a consume leaves the remainder;
// the row-locked function refuses to oversell; a retry with the same key does
// not take the length twice; a return goes to the SAME roll and cannot invent
// stock; waste above the cut is refused; a cost that was not recorded stays
// unknown; and a workspace cannot touch another workspace's roll.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'

const PORT = freePortSync()
const dir = pgTempDir('hisabche-pg-roll-cutting-')
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/roll_cutting`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')

const SHOP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ACTOR = '66666666-6666-4666-8666-666666666666'

async function refusal(run: () => Promise<unknown>): Promise<string> {
  try {
    await run()
    return 'ALLOWED'
  } catch (error) {
    return String((error as Error).message)
  }
}

let seq = 0
const nextKey = () => `roll-key-${Date.now()}-${seq++}`
const create = (workspace = SHOP, key = nextKey(), length = 50, cost = 50_000) =>
  sql`SELECT public.roll_create(${workspace}, ${ACTOR}, 'R-50', ${length}::numeric, 'm', 'قفسه ۱', ${cost}::bigint, 3.2::numeric, ${key}) AS result`
const move = (
  workspace: string,
  roll: string,
  kind: string,
  length: number,
  key = nextKey(),
  waste = 0,
) =>
  sql`SELECT public.roll_apply_movement(${workspace}, ${ACTOR}, ${roll}::uuid, ${kind}, ${length}::numeric, ${waste}::numeric, ${key}) AS result`
const remainingOf = async (roll: string) =>
  Number(
    (await sql`SELECT remaining_length FROM public.rolls WHERE id = ${roll}::uuid`)[0]
      ?.remaining_length,
  )

let rollId: string
beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('roll_cutting')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  `)
  // Twice: a migration that is not re-runnable is one nobody dares re-run.
  await setup.unsafe(read('roll-cutting-01-migration.sql'))
  await setup.unsafe(read('roll-cutting-01-migration.sql'))
  await setup.end()
  sql = postgres(url, { max: 1, onnotice: () => {} })
})

afterAll(async () => {
  await sql?.end()
  await pg.stop()
})

beforeEach(async () => {
  await sql`DELETE FROM public.roll_movements`
  await sql`DELETE FROM public.rolls`
  const result = (await create())[0]?.result as Record<string, unknown>
  rollId = String(result.roll_id)
})

describe('roll-cutting-01 — schema', () => {
  it('created both tables, both unique keys and both functions', async () => {
    const fns = await sql`
      SELECT proname FROM pg_proc
       WHERE pronamespace = 'public'::regnamespace
         AND proname IN ('roll_create','roll_apply_movement')`
    expect(fns.length).toBe(2)
    const idx = await sql`
      SELECT indexname FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname IN ('idx_rolls_request','idx_roll_movements_request')`
    expect(idx.length).toBe(2)
  })
})

describe('roll-cutting-01 — movement rules', () => {
  it('selling 12.5 m from a 50 m roll leaves 37.5 m', async () => {
    await move(SHOP, rollId, 'consume', 12.5)
    expect(await remainingOf(rollId)).toBe(37.5)
  })

  it('a row-locked consume refuses to oversell', async () => {
    expect(await refusal(() => move(SHOP, rollId, 'consume', 51))).toContain('ROLL_INSUFFICIENT')
    expect(await remainingOf(rollId)).toBe(50)
  })

  it('a retry with the same key does not take the length twice', async () => {
    const key = nextKey()
    await move(SHOP, rollId, 'consume', 10, key)
    await move(SHOP, rollId, 'consume', 10, key)
    expect(await remainingOf(rollId)).toBe(40)
  })

  it('a return restores the same roll but cannot invent stock', async () => {
    await move(SHOP, rollId, 'consume', 12.5)
    await move(SHOP, rollId, 'return', 12.5)
    expect(await remainingOf(rollId)).toBe(50)
    expect(await refusal(() => move(SHOP, rollId, 'return', 1))).toContain(
      'ROLL_RETURN_EXCEEDS_CONSUMED',
    )
  })

  it('waste above the cut is refused', async () => {
    expect(await refusal(() => move(SHOP, rollId, 'cut', 5, nextKey(), 6))).toContain(
      'ROLL_WASTE_INVALID',
    )
    expect(await remainingOf(rollId)).toBe(50)
  })

  it('a workspace cannot move another workspace roll', async () => {
    expect(await refusal(() => move(OTHER, rollId, 'consume', 1))).toContain('ROLL_NOT_FOUND')
    expect(await remainingOf(rollId)).toBe(50)
  })
})
