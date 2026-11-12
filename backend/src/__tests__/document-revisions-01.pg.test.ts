import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { startPg, stopPg, type PgTestHandle } from './helpers/pg-test-harness'

describe('document-revisions-01-migration.sql (PG)', () => {
  let pg: PgTestHandle

  beforeAll(async () => {
    pg = await startPg()
    const baseSql = readFileSync(resolve(__dirname, '../../docs/base-schema-migration.sql'), 'utf8')
    const migSql = readFileSync(
      resolve(__dirname, '../../docs/document-revisions-01-migration.sql'),
      'utf8',
    )
    await pg.sql.unsafe(baseSql)
    // Idempotent check: run migration twice
    await pg.sql.unsafe(migSql)
    await pg.sql.unsafe(migSql)
  }, 60_000)

  afterAll(async () => {
    await stopPg(pg)
  })

  it('writes 1 revision on edit, 0 on no-op edit, enforces immutability, and isolates tenants', async () => {
    const ws1 = '11111111-1111-4111-8111-111111111111'
    const ws2 = '22222222-2222-4222-8222-222222222222'
    const actor = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const cust1 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

    await pg.sql`
      INSERT INTO public.workspaces (id, name, owner_id)
      VALUES (${ws1}, 'WS1', ${actor}), (${ws2}, 'WS2', ${actor})
      ON CONFLICT DO NOTHING
    `
    await pg.sql`
      INSERT INTO public.customers (id, workspace_id, user_id, name, phone)
      VALUES (${cust1}, ${ws1}, ${actor}, 'Old Name', '+93700000001')
    `

    // Real edit -> 1 revision
    await pg.sql`
      UPDATE public.customers SET name = 'New Name' WHERE id = ${cust1} AND workspace_id = ${ws1}
    `
    const revs1 = await pg.sql`
      SELECT version, changed_fields, before_data->>'name' AS old_name, after_data->>'name' AS new_name
        FROM public.document_revisions
       WHERE workspace_id = ${ws1} AND document_type = 'customer' AND document_id = ${cust1}
    `
    expect(revs1.length).toBe(1)
    expect(revs1[0]?.version).toBe(1)
    expect(revs1[0]?.changed_fields).toContain('name')
    expect(revs1[0]?.old_name).toBe('Old Name')
    expect(revs1[0]?.new_name).toBe('New Name')

    // No-op edit -> still 1 revision
    await pg.sql`
      UPDATE public.customers SET name = 'New Name' WHERE id = ${cust1} AND workspace_id = ${ws1}
    `
    const revs2 = await pg.sql`
      SELECT count(*)::int AS cnt FROM public.document_revisions
       WHERE workspace_id = ${ws1} AND document_type = 'customer' AND document_id = ${cust1}
    `
    expect(revs2[0]?.cnt).toBe(1)

    // Tenant isolation: ws2 sees 0 revisions
    const ws2Revs = await pg.sql`
      SELECT count(*)::int AS cnt FROM public.document_revisions WHERE workspace_id = ${ws2}
    `
    expect(ws2Revs[0]?.cnt).toBe(0)

    // Immutability: UPDATE and DELETE refused
    await expect(
      pg.sql`UPDATE public.document_revisions SET version = 99 WHERE document_id = ${cust1}`,
    ).rejects.toThrow(/DOCUMENT_REVISIONS_IMMUTABLE/)
    await expect(
      pg.sql`DELETE FROM public.document_revisions WHERE document_id = ${cust1}`,
    ).rejects.toThrow(/DOCUMENT_REVISIONS_IMMUTABLE/)
  })
})
