// ============================================
// docs/session-deposit-01-migration.sql run unchanged (twice) on real Postgres,
// then its VERIFY: existing deposits keep their meaning (default
// 'sales_order'), a session deposit is accepted, an unknown kind is refused.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'

const PORT = freePortSync()
const pg = new EmbeddedPostgres({
  databaseDir: pgTempDir('hisabche-pg-sdep-'),
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/sdep`
let sql: postgres.Sql
const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')
const WS = '22222222-2222-4222-8222-222222222222'
const C = '33333333-3333-4333-8333-333333333333'

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('sdep')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(`
    CREATE TABLE order_deposits (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,
      order_id uuid NOT NULL,
      customer_id uuid NOT NULL,
      amount_minor bigint NOT NULL,
      payment_method text NOT NULL DEFAULT 'cash'
    );
    INSERT INTO order_deposits (workspace_id, order_id, customer_id, amount_minor)
    VALUES ('${WS}', gen_random_uuid(), '${C}', 300);
  `)
  await setup.unsafe(read('session-deposit-01-migration.sql'))
  await setup.unsafe(read('session-deposit-01-migration.sql'))
  await setup.end()
  sql = postgres(url, { max: 2, onnotice: () => {} })
}, 240_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
})

describe('session-deposit-01', () => {
  it('an existing deposit keeps its meaning', async () => {
    const [row] = await sql`SELECT source_type FROM order_deposits`
    expect(row?.source_type).toBe('sales_order')
  })

  it('a session deposit is accepted; an unknown kind is refused by name', async () => {
    await sql`INSERT INTO order_deposits (workspace_id, order_id, customer_id, amount_minor, source_type)
              VALUES (${WS}, gen_random_uuid(), ${C}, 300, 'service_session')`
    await expect(
      sql`INSERT INTO order_deposits (workspace_id, order_id, customer_id, amount_minor, source_type)
          VALUES (${WS}, gen_random_uuid(), ${C}, 300, 'gift')`,
    ).rejects.toThrow('order_deposits_source_type_known')
  })

  it('VERIFY answers ok', async () => {
    const [row] = await sql.unsafe(read('VERIFY-session-deposit-01.sql'))
    expect(row?.ok).toBe(true)
    expect(row?.no_unknown_source).toBe(true)
  })
})
