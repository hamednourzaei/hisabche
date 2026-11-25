import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { startPg, stopPg, type PgTestHandle } from './helpers/pg-test-harness'

describe('ha-replica-lag-01-migration.sql (PG)', () => {
  let pg: PgTestHandle

  beforeAll(async () => {
    pg = await startPg()
    const migSql = readFileSync(
      resolve(__dirname, '../../../docs/ha-replica-lag-01-migration.sql'),
      'utf8',
    )
    // Additive & idempotent: running migration twice must succeed cleanly
    await pg.sql.unsafe(migSql)
    await pg.sql.unsafe(migSql)
  }, 60_000)

  afterAll(async () => {
    await stopPg(pg)
  })

  it('installs get_replication_lag_ms(), returns NULL on primary (never 0), and restricts grants', async () => {
    const rows = await pg.sql`SELECT public.get_replication_lag_ms() AS lag_ms`
    expect(rows[0]?.lag_ms).toBeNull()

    const priv = await pg.sql`
      SELECT
        has_function_privilege('public', 'public.get_replication_lag_ms()', 'EXECUTE') AS pub_exec
    `
    expect(priv[0]?.pub_exec).toBe(false)
  })
})
