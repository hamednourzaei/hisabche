// ============================================
// docs/base-currency-01-migration.sql, run for real — twice.
//
// One column on workspaces. What matters: every workspace that already exists
// becomes AFN (what the code assumed for it), a second run changes nothing —
// including a workspace that has since chosen another currency — and nonsense
// is refused.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const PORT = 55000 + Math.floor(Math.random() * 900)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-basecur-'))
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

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

let sql: ReturnType<typeof postgres>

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  sql = postgres({ host: 'localhost', port: PORT, user: 'postgres', password: 'test', max: 1 })
  await sql.unsafe(`
    CREATE TABLE public.workspaces (id uuid PRIMARY KEY, name text);
    INSERT INTO public.workspaces VALUES ('${A}', 'first'), ('${B}', 'second');
  `)
}, 120_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
})

const refused = async (statement: string): Promise<string | null> => {
  try {
    await sql.unsafe(statement)
    return null
  } catch (error) {
    return (error as { code?: string }).code ?? 'unknown'
  }
}

describe('base-currency-01', () => {
  it('before it runs, the VERIFY query says NOT ok', async () => {
    const [row] = await sql.unsafe(read('VERIFY-base-currency-01.sql'))
    expect(row).toMatchObject({ column_exists: false, ok: false })
  })

  it('every existing workspace becomes AFN', async () => {
    await sql.unsafe(read('base-currency-01-migration.sql'))
    const rows = await sql`SELECT id, base_currency FROM public.workspaces ORDER BY id`
    expect(rows.map((row) => row.base_currency)).toEqual(['AFN', 'AFN'])
  })

  it('⚠️ a second run does not put a chosen currency back to AFN', async () => {
    await sql`UPDATE public.workspaces SET base_currency = 'IRT' WHERE id = ${B}`
    await sql.unsafe(read('base-currency-01-migration.sql'))
    const [row] = await sql`SELECT base_currency FROM public.workspaces WHERE id = ${B}`
    expect(row?.base_currency).toBe('IRT')
  })

  it('refuses what is not a currency code, and null', async () => {
    expect(
      await refused(`UPDATE public.workspaces SET base_currency = 'toman' WHERE id = '${A}'`),
    ).toBe('23514')
    expect(
      await refused(`UPDATE public.workspaces SET base_currency = NULL WHERE id = '${A}'`),
    ).toBe('23502')
  })

  it('the VERIFY query says ok, and counts the one that is no longer AFN', async () => {
    const [row] = await sql.unsafe(read('VERIFY-base-currency-01.sql'))
    expect(row).toMatchObject({
      column_exists: true,
      default_is_afn: true,
      format_guarded: true,
      workspaces: 2,
      not_afn: 1,
      ok: true,
    })
  })
})
