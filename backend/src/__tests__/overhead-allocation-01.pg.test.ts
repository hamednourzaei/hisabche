import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { startPg, stopPg, type PgTestHandle } from './helpers/pg-test-harness'

describe('overhead-allocation-01-migration.sql (PG)', () => {
  let pg: PgTestHandle

  beforeAll(async () => {
    pg = await startPg()
    const baseSql = readFileSync(resolve(__dirname, '../../docs/base-schema-migration.sql'), 'utf8')
    const migSql = readFileSync(
      resolve(__dirname, '../../docs/overhead-allocation-01-migration.sql'),
      'utf8',
    )
    await pg.sql.unsafe(baseSql)
    await pg.sql.unsafe(migSql)
    await pg.sql.unsafe(migSql)
  }, 60_000)

  afterAll(async () => {
    await stopPg(pg)
  })

  it('enforces unique idempotency_key per workspace and basis check', async () => {
    const ws = '11111111-1111-4111-8111-111111111111'
    const actor = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const dimId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    const accId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

    await pg.sql`INSERT INTO public.workspaces (id, name, owner_id) VALUES (${ws}, 'WS', ${actor}) ON CONFLICT DO NOTHING`

    await expect(
      pg.sql`
        INSERT INTO public.overhead_policies (workspace_id, basis, source_account_ids, target_dimension_id)
        VALUES (${ws}, 'invalid_basis', ARRAY[${accId}]::uuid[], ${dimId})
      `,
    ).rejects.toThrow()

    const [pol] = await pg.sql`
      INSERT INTO public.overhead_policies (workspace_id, basis, source_account_ids, target_dimension_id)
      VALUES (${ws}, 'revenue_share', ARRAY[${accId}]::uuid[], ${dimId})
      RETURNING id
    `
    await pg.sql`
      INSERT INTO public.overhead_allocation_runs
        (workspace_id, policy_id, policy_version, period, currency, idempotency_key, pool_amount_minor, allocations)
      VALUES
        (${ws}, ${pol!.id}, 1, '2026-11', 'AFN', 'overhead-2026-11', 1000, '[]'::jsonb)
    `
    await expect(
      pg.sql`
        INSERT INTO public.overhead_allocation_runs
          (workspace_id, policy_id, policy_version, period, currency, idempotency_key, pool_amount_minor, allocations)
        VALUES
          (${ws}, ${pol!.id}, 1, '2026-11', 'AFN', 'overhead-2026-11', 1000, '[]'::jsonb)
      `,
    ).rejects.toThrow()
  })
})
