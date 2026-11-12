import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { startPg, stopPg, type PgTestHandle } from './helpers/pg-test-harness'

describe('data-translations-01-migration.sql (PG)', () => {
  let pg: PgTestHandle

  beforeAll(async () => {
    pg = await startPg()
    const baseSql = readFileSync(resolve(__dirname, '../../docs/base-schema-migration.sql'), 'utf8')
    const migSql = readFileSync(
      resolve(__dirname, '../../docs/data-translations-01-migration.sql'),
      'utf8',
    )
    await pg.sql.unsafe(baseSql)
    await pg.sql.unsafe(migSql)
    await pg.sql.unsafe(migSql)
  }, 60_000)

  afterAll(async () => {
    await stopPg(pg)
  })

  it('stores and queries localized product names via jsonb', async () => {
    const ws1 = '11111111-1111-4111-8111-111111111111'
    const actor = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    await pg.sql`
      INSERT INTO public.products (workspace_id, user_id, name, translations)
      VALUES (${ws1}, ${actor}, 'Sugar', '{"fa":"شکر","af":"بوره","en":"Sugar"}'::jsonb)
    `
    const found = await pg.sql`
      SELECT name FROM public.products
       WHERE workspace_id = ${ws1} AND translations ->> 'af' = 'بوره'
    `
    expect(found[0]?.name).toBe('Sugar')
  })
})
