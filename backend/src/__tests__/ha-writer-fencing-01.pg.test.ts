import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { startPg, stopPg, type PgTestHandle } from './helpers/pg-test-harness'

describe('ha-writer-fencing-01-migration.sql (PG)', () => {
  let pg: PgTestHandle

  beforeAll(async () => {
    pg = await startPg()
    const migSql = readFileSync(
      resolve(__dirname, '../../../docs/ha-writer-fencing-01-migration.sql'),
      'utf8',
    )
    // Additive & idempotent: running migration twice must succeed
    await pg.sql.unsafe(migSql)
    await pg.sql.unsafe(migSql)
  }, 60_000)

  afterAll(async () => {
    await stopPg(pg)
  })

  it('acquires lease, blocks competing writer at same epoch, promotes standby, and fences old writer', async () => {
    const cluster = 'hisabche-primary-cluster'

    // 1. Acquire initial lease at epoch 1 for primary-a
    const acquired = await pg.sql`
      SELECT * FROM public.acquire_or_renew_writer_lease(${cluster}, 'primary-a', 1, 30000, 'sig-1')
    `
    expect(Number(acquired[0]?.epoch)).toBe(1)
    expect(acquired[0]?.writer_id).toBe('primary-a')

    // 2. Assert primary-a passes check at epoch 1
    const assertOk = await pg.sql`
      SELECT public.assert_writer_epoch(${cluster}, 'primary-a', 1) AS ok
    `
    expect(assertOk[0]?.ok).toBe(true)

    // 3. Another writer at same epoch must be rejected while lease is active
    await expect(
      pg.sql`SELECT * FROM public.acquire_or_renew_writer_lease(${cluster}, 'rogue-b', 1, 30000, 'sig-r')`,
    ).rejects.toThrow(/ERR_FENCING_TOKEN_REJECTED/)

    // 4. Promote standby-b (CAS expectedEpoch=1 -> new epoch=2)
    const promoted = await pg.sql`
      SELECT * FROM public.promote_standby_writer(${cluster}, 1, 'standby-b', 'ops-lead', 'primary failure', 30000, 'sig-2')
    `
    expect(Number(promoted[0]?.epoch)).toBe(2)
    expect(promoted[0]?.writer_id).toBe('standby-b')

    // 5. Deposed primary-a with epoch 1 is now rejected on write assertion and renewal
    await expect(
      pg.sql`SELECT public.assert_writer_epoch(${cluster}, 'primary-a', 1)`,
    ).rejects.toThrow(/ERR_FENCING_TOKEN_REJECTED/)
    await expect(
      pg.sql`SELECT * FROM public.acquire_or_renew_writer_lease(${cluster}, 'primary-a', 1, 30000, 'sig-1')`,
    ).rejects.toThrow(/ERR_FENCING_TOKEN_REJECTED/)

    // 6. Promoted standby-b with epoch 2 succeeds
    const promotedAssert = await pg.sql`
      SELECT public.assert_writer_epoch(${cluster}, 'standby-b', 2) AS ok
    `
    expect(promotedAssert[0]?.ok).toBe(true)

    // 7. Expired lease refuses assert_writer_epoch (no silent auto-renewal)
    await pg.sql`
      UPDATE public.writer_fencing_leases
      SET lease_expires_at = now() - interval '5 seconds'
      WHERE cluster_key = ${cluster}
    `
    await expect(
      pg.sql`SELECT public.assert_writer_epoch(${cluster}, 'standby-b', 2)`,
    ).rejects.toThrow(/expired/i)
  })
})
