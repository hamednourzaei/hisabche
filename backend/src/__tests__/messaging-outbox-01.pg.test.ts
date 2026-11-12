import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { startPg, stopPg, type PgTestHandle } from './helpers/pg-test-harness'

describe('messaging-outbox-01-migration.sql (PG)', () => {
  let pg: PgTestHandle

  beforeAll(async () => {
    pg = await startPg()
    const baseSql = readFileSync(resolve(__dirname, '../../docs/base-schema-migration.sql'), 'utf8')
    const migSql = readFileSync(
      resolve(__dirname, '../../docs/messaging-outbox-01-migration.sql'),
      'utf8',
    )
    await pg.sql.unsafe(baseSql)
    await pg.sql.unsafe(migSql)
    await pg.sql.unsafe(migSql)
  }, 60_000)

  afterAll(async () => {
    await stopPg(pg)
  })

  it('enforces idempotency_key uniqueness per workspace', async () => {
    const ws1 = '11111111-1111-4111-8111-111111111111'
    await pg.sql`
      INSERT INTO public.messaging_outbox (workspace_id, channel, recipient, template_key, idempotency_key)
      VALUES (${ws1}, 'sms', '+93700000001', 'sms.debt_reminder', 'key-1')
    `
    await expect(
      pg.sql`
        INSERT INTO public.messaging_outbox (workspace_id, channel, recipient, template_key, idempotency_key)
        VALUES (${ws1}, 'sms', '+93700000001', 'sms.debt_reminder', 'key-1')
      `,
    ).rejects.toThrow()
  })
})
