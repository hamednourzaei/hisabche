import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { startPg, stopPg, type PgTestHandle } from './helpers/pg-test-harness'

describe('workspace-2fa-01-migration.sql (PG)', () => {
  let pg: PgTestHandle

  beforeAll(async () => {
    pg = await startPg()
    const baseSql = readFileSync(resolve(__dirname, '../../docs/base-schema-migration.sql'), 'utf8')
    const migSql = readFileSync(
      resolve(__dirname, '../../docs/workspace-2fa-01-migration.sql'),
      'utf8',
    )
    await pg.sql.unsafe(baseSql)
    await pg.sql.unsafe(migSql)
    await pg.sql.unsafe(migSql)
  }, 60_000)

  afterAll(async () => {
    await stopPg(pg)
  })

  it('enforces unique enrollment per workspace+user', async () => {
    const ws1 = '11111111-1111-4111-8111-111111111111'
    const u1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    await pg.sql`
      INSERT INTO public.workspace_2fa_enrollments (workspace_id, user_id, totp_secret_ref, is_enabled)
      VALUES (${ws1}, ${u1}, 'enc:ref-1', true)
    `
    await expect(
      pg.sql`
        INSERT INTO public.workspace_2fa_enrollments (workspace_id, user_id, totp_secret_ref, is_enabled)
        VALUES (${ws1}, ${u1}, 'enc:ref-2', true)
      `,
    ).rejects.toThrow()
  })
})
