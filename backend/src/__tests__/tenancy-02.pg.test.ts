import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { startPg, stopPg, type PgTestHandle } from './helpers/pg-test-harness'

describe('tenancy-02-migration.sql (PG)', () => {
  let pg: PgTestHandle

  beforeAll(async () => {
    pg = await startPg()
    const baseSql = readFileSync(resolve(__dirname, '../../docs/base-schema-migration.sql'), 'utf8')
    const migSql = readFileSync(resolve(__dirname, '../../docs/tenancy-02-migration.sql'), 'utf8')
    await pg.sql.unsafe(baseSql)

    // Create a sample tenant table with nullable workspace_id to verify hardening
    await pg.sql.unsafe(`
      CREATE TABLE IF NOT EXISTS public.test_nullable_ws_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid,
        label text NOT NULL
      );
    `)

    // Idempotent: run migration twice
    await pg.sql.unsafe(migSql)
    await pg.sql.unsafe(migSql)
  }, 60_000)

  afterAll(async () => {
    await stopPg(pg)
  })

  it('blocks NULL workspace_id writes and allows valid workspace_id writes after hardening', async () => {
    const ws1 = '11111111-1111-4111-8111-111111111111'
    await expect(
      pg.sql`INSERT INTO public.test_nullable_ws_items (workspace_id, label) VALUES (NULL, 'bad')`,
    ).rejects.toThrow()

    const rows = await pg.sql`
      INSERT INTO public.test_nullable_ws_items (workspace_id, label)
      VALUES (${ws1}, 'good')
      RETURNING workspace_id::text
    `
    expect(rows[0]?.workspace_id).toBe(ws1)
  })
})
