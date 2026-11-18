// ============================================
// backend/src/__tests__/batch-recall.pg.test.ts
//
// WP-05 on real Postgres: docs/batch-recall-migration.sql runs TWICE, then the
// rule it adds is exercised with the writes it must refuse and the writes it
// must allow.
//
// The claim under test: a batch is blocked exactly when it has a time AND a
// non-blank reason — neither half exists alone — and a batch that was never
// blocked keeps a NULL reason. Nothing here touches the quantity: blocking
// goods does not delete them.
//
// The fixture mirrors public.stock_batches as docs/traceability-migration.sql
// creates it (no foreign keys: they are not what this migration decides).
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
  databaseDir: pgTempDir('hisabche-pg-batch-recall-'),
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/batchrecalldb`
let sql: postgres.Sql

const MIGRATION = readFileSync(
  join(__dirname, '..', '..', '..', 'docs', 'batch-recall-migration.sql'),
  'utf8',
)
const VERIFY = readFileSync(
  join(__dirname, '..', '..', '..', 'docs', 'VERIFY-batch-recall.sql'),
  'utf8',
)

const WS = '11111111-1111-4111-8111-111111111111'
const PRODUCT = '22222222-2222-4222-8222-222222222221'

async function insertBatch(
  batchNumber: string,
  recalledAt: string | null,
  reason: string | null,
): Promise<string | null> {
  const rows = await sql<{ id: string }[]>`
    INSERT INTO public.stock_batches
      (workspace_id, product_id, batch_number, expiry_date, received_qty, remaining_qty,
       received_on, recalled_at, recalled_reason)
    VALUES (
      ${WS}::uuid, ${PRODUCT}::uuid, ${batchNumber}, '2027-01-31', 10, 10,
      '2026-11-01', ${recalledAt}::timestamptz, ${reason}
    )
    RETURNING id`
  return rows[0]?.id ?? null
}

async function setRecall(id: string, recalledAt: string | null, reason: string | null) {
  await sql`
    UPDATE public.stock_batches
       SET recalled_at = ${recalledAt}::timestamptz,
           recalled_reason = ${reason}
     WHERE id = ${id}::uuid`
}

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('batchrecalldb')
  sql = postgres(url, { max: 1, onnotice: () => {} })

  await sql.unsafe(`
    CREATE TABLE public.stock_batches (
      id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id      uuid NOT NULL,
      product_id        uuid NOT NULL,
      batch_number      text NOT NULL,
      expiry_date       date,
      manufactured_date date,
      received_qty      numeric(18, 4) NOT NULL,
      remaining_qty     numeric(18, 4) NOT NULL,
      cost_layer_id     uuid,
      warehouse_id      uuid,
      received_on       date NOT NULL,
      created_at        timestamptz NOT NULL DEFAULT now(),
      created_by        uuid,
      CONSTRAINT stock_batches_qty_check CHECK (
        received_qty > 0 AND remaining_qty >= 0 AND remaining_qty <= received_qty
      )
    );

    CREATE UNIQUE INDEX stock_batches_number_key
      ON public.stock_batches (workspace_id, product_id, batch_number);
  `)

  // Twice on purpose: the migration must be safe to re-run.
  await sql.unsafe(MIGRATION)
  await sql.unsafe(MIGRATION)
})

afterAll(async () => {
  await sql?.end({ timeout: 5 })
  await pg?.stop()
})

describe('batch-recall migration', () => {
  it('adds the three columns, the checked rule and the partial index', async () => {
    const results = (await sql.unsafe(VERIFY).simple()) as unknown as Array<
      Array<Record<string, unknown>>
    >
    const structure = results[0]!
    expect(structure).toHaveLength(5)
    for (const row of structure) {
      expect([row.check_name, row.ok]).toEqual([row.check_name, true])
    }

    // Every rule the migration adds holds for the rows that already existed.
    const rules = results[1]!
    expect(rules).toHaveLength(2)
    for (const row of rules) expect(Number(row.bad_rows)).toBe(0)
  })

  it('allows a recall with a time and a reason', async () => {
    const id = await insertBatch('B-RECALLED', '2026-11-17T09:00:00.000Z', 'supplier recall')
    expect(id).not.toBeNull()

    const [row] = await sql<{ recalled_reason: string }[]>`
      SELECT recalled_reason FROM public.stock_batches WHERE id = ${id!}::uuid`
    expect(row?.recalled_reason).toBe('supplier recall')
  })

  it('refuses a block with no reason — a block nobody can explain', async () => {
    await expect(
      insertBatch('B-NO-REASON', '2026-11-17T09:00:00.000Z', null),
    ).rejects.toMatchObject({ code: '23514' })
  })

  it('refuses a reason with no block — a sentence about nothing', async () => {
    await expect(insertBatch('B-NO-BLOCK', null, 'supplier recall')).rejects.toMatchObject({
      code: '23514',
    })
  })

  it('refuses a blank reason — whitespace is not an explanation', async () => {
    await expect(insertBatch('B-BLANK', '2026-11-17T09:00:00.000Z', '   ')).rejects.toMatchObject({
      code: '23514',
    })
  })

  it('leaves the quantity alone when a batch is blocked', async () => {
    const id = await insertBatch('B-KEEPS-STOCK', null, null)
    await setRecall(id!, '2026-11-17T09:00:00.000Z', 'failed inspection')

    const [row] = await sql<{ received_qty: string; remaining_qty: string }[]>`
      SELECT received_qty, remaining_qty FROM public.stock_batches WHERE id = ${id!}::uuid`
    expect(Number(row?.received_qty)).toBe(10)
    expect(Number(row?.remaining_qty)).toBe(10)
  })

  it('allows clearing the block — both halves, together', async () => {
    const id = await insertBatch('B-CLEARED', '2026-11-17T09:00:00.000Z', 'supplier recall')
    await setRecall(id!, null, null)

    const [row] = await sql<{ recalled_at: Date | null; recalled_reason: string | null }[]>`
      SELECT recalled_at, recalled_reason FROM public.stock_batches WHERE id = ${id!}::uuid`
    expect(row?.recalled_at).toBeNull()
    expect(row?.recalled_reason).toBeNull()
  })

  it('refuses half a clear too — the reason cannot outlive the block', async () => {
    const id = await insertBatch('B-HALF-CLEAR', '2026-11-17T09:00:00.000Z', 'supplier recall')
    await expect(setRecall(id!, null, 'supplier recall')).rejects.toMatchObject({ code: '23514' })
  })

  it('still refuses a block with no reason after the constraint has been validated', async () => {
    await expect(insertBatch('B-LATE', '2026-11-18T09:00:00.000Z', '')).rejects.toMatchObject({
      code: '23514',
    })
  })
})
