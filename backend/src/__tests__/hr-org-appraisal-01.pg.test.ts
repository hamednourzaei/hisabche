import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { startPg, stopPg, type PgTestHandle } from './helpers/pg-test-harness'

describe('hr-org-appraisal-01-migration.sql (PG)', () => {
  let pg: PgTestHandle

  beforeAll(async () => {
    pg = await startPg()
    const baseSql = readFileSync(resolve(__dirname, '../../docs/base-schema-migration.sql'), 'utf8')
    const migSql = readFileSync(
      resolve(__dirname, '../../docs/hr-org-appraisal-01-migration.sql'),
      'utf8',
    )
    await pg.sql.unsafe(baseSql)
    await pg.sql.unsafe(migSql)
    await pg.sql.unsafe(migSql)
  }, 60_000)

  afterAll(async () => {
    await stopPg(pg)
  })

  it('blocks org chart cycles and enforces appraisal immutability', async () => {
    const ws1 = '11111111-1111-4111-8111-111111111111'
    const e1 = '10000000-0000-4000-8000-000000000001'
    const e2 = '10000000-0000-4000-8000-000000000002'

    await pg.sql`
      INSERT INTO public.employees
        (id, workspace_id, employee_code, first_name, last_name, hire_date, reports_to)
      VALUES
        (${e1}, ${ws1}, 'E-1', 'Chief', 'Executive', '2026-01-01', NULL),
        (${e2}, ${ws1}, 'E-2', 'Team', 'Lead', '2026-01-01', ${e1})
    `
    await expect(
      pg.sql`UPDATE public.employees SET reports_to = ${e2} WHERE id = ${e1}`,
    ).rejects.toThrow(/ORG_CYCLE_DETECTED/)

    const app = await pg.sql`
      INSERT INTO public.employee_appraisals (workspace_id, employee_id, reviewer_id, period, criteria)
      VALUES (${ws1}, ${e2}, ${e1}, '2026-Q2', '[{"label":"Delivery","rating":"exceeds"}]'::jsonb)
      RETURNING id
    `
    await expect(
      pg.sql`UPDATE public.employee_appraisals SET period = '2026-Q3' WHERE id = ${app[0]!.id}`,
    ).rejects.toThrow(/APPRAISALS_IMMUTABLE/)
  })
})
