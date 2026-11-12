import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { startPg, stopPg, type PgTestHandle } from './helpers/pg-test-harness'

describe('approval-policy-01-migration.sql (PG)', () => {
  let pg: PgTestHandle

  beforeAll(async () => {
    pg = await startPg()
    const baseSql = readFileSync(resolve(__dirname, '../../docs/base-schema-migration.sql'), 'utf8')
    const migSql = readFileSync(
      resolve(__dirname, '../../docs/approval-policy-01-migration.sql'),
      'utf8',
    )
    await pg.sql.unsafe(baseSql)
    await pg.sql.unsafe(migSql)
    await pg.sql.unsafe(migSql)
  }, 60_000)

  afterAll(async () => {
    await stopPg(pg)
  })

  it('stores policies/requests/append-only events and refuses UPDATE/DELETE on events', async () => {
    const ws1 = '11111111-1111-4111-8111-111111111111'
    const actor = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const approver = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    const docId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

    const pol = await pg.sql`
      INSERT INTO public.approval_policies (workspace_id, document_type, name, min_amount_minor, steps)
      VALUES (${ws1}, 'purchase_order', 'PO > 10k', 1000000, '[{"stepNumber":1,"approverRoles":["manager"]}]'::jsonb)
      RETURNING id
    `
    const req = await pg.sql`
      INSERT INTO public.approval_policy_requests (workspace_id, policy_id, document_type, document_id, requester_id, total_steps)
      VALUES (${ws1}, ${pol[0]!.id}, 'purchase_order', ${docId}, ${actor}, 1)
      RETURNING id
    `
    const evt = await pg.sql`
      INSERT INTO public.approval_policy_events (workspace_id, request_id, step_number, actor_id, actor_role, decision)
      VALUES (${ws1}, ${req[0]!.id}, 1, ${approver}, 'manager', 'approved')
      RETURNING id
    `
    await expect(
      pg.sql`UPDATE public.approval_policy_events SET decision = 'rejected' WHERE id = ${evt[0]!.id}`,
    ).rejects.toThrow(/APPROVAL_EVENTS_IMMUTABLE/)
    await expect(
      pg.sql`DELETE FROM public.approval_policy_events WHERE id = ${evt[0]!.id}`,
    ).rejects.toThrow(/APPROVAL_EVENTS_IMMUTABLE/)
  })
})
