// ============================================
// backend/src/__tests__/line-cut-loss.pg.test.ts
//
// WP-03 — «پرت برش» on an invoice line.
// `docs/line-cut-loss-01-migration.sql` is run unchanged (twice) on a real
// Postgres, on a table that predates the column, and then the database is asked
// the questions only it can answer:
//
//   • does every existing row read 0 — «no loss recorded» — without a backfill?
//   • can a measured line record a loss, and does it read back exactly?
//   • is a COUNT unit refused, so a piece cannot leave through a sale?
//   • is a negative loss refused?
//   • is the second run of the file a no-op (constraints still VALIDATED)?
//
// ⚠️ The numbers are computed by hand in each assertion. A test that reads its
// expectation from the code it tests proves nothing.
// ============================================

import { readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'

const PORT = freePortSync()
const dir = pgTempDir('hisabche-pg-cut-loss-')
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/cutloss`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const migration = readFileSync(join(DOCS, 'line-cut-loss-01-migration.sql'), 'utf8')

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const INVOICE = '10000000-0000-4000-8000-000000000001'
const PRODUCT = '20000000-0000-4000-8000-000000000001'

/** A line as this migration finds the table: no cut-loss column yet. */
async function insertLine(options: {
  id: string
  unit: string
  quantity: number
  /**
   * `undefined` = the column is not named at all (the pre-migration shape);
   * a number = the column is named, and the database decides.
   */
  cutLoss?: number
}): Promise<void> {
  if (options.cutLoss === undefined) {
    await sql`INSERT INTO invoice_items
      (id, invoice_id, workspace_id, product_id, product_name, quantity, unit)
      VALUES (${options.id}, ${INVOICE}, ${WS}, ${PRODUCT}, 'رول پارچه',
              ${options.quantity}, ${options.unit})`
    return
  }
  await sql`INSERT INTO invoice_items
    (id, invoice_id, workspace_id, product_id, product_name, quantity, unit, cut_loss_quantity)
    VALUES (${options.id}, ${INVOICE}, ${WS}, ${PRODUCT}, 'رول پارچه',
            ${options.quantity}, ${options.unit}, ${options.cutLoss})`
}

const cutLossOf = async (id: string): Promise<number | null> => {
  const rows = await sql<{ cut_loss_quantity: string | number | null }[]>`
    SELECT cut_loss_quantity FROM invoice_items WHERE id = ${id}`
  const value = rows[0]?.cut_loss_quantity
  return value === null || value === undefined ? null : Number(value)
}

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('cutloss')
  const setup = postgres(url, { max: 1, onnotice: () => {} })

  // ─── The database BEFORE this migration ──────────────────────────────────
  // An invoice line as the product already has it: the unit check is the one
  // `docs/unified-sale-purchase-migration.sql` installs, because the new
  // constraint mirrors that closed set.
  await setup.unsafe(`
    CREATE TABLE invoices (
      id uuid PRIMARY KEY,
      workspace_id uuid,
      type text NOT NULL DEFAULT 'sale'
    );
    CREATE TABLE invoice_items (
      id uuid PRIMARY KEY,
      invoice_id uuid NOT NULL,
      workspace_id uuid,
      product_id uuid,
      product_name text NOT NULL DEFAULT '',
      quantity numeric NOT NULL DEFAULT 0,
      unit text NOT NULL DEFAULT 'piece',
      CONSTRAINT invoice_items_unit_check
        CHECK (unit IN ('piece', 'gram', 'kg', 'meter', 'liter', 'box', 'pack', 'carton', 'custom'))
    );
    INSERT INTO invoices (id, workspace_id, type) VALUES
      ('${INVOICE}', '${WS}', 'sale'),
      ('10000000-0000-4000-8000-000000000002', '${WS}', 'purchase');
    -- A line written before the feature existed: 12.5 metres, no loss.
    INSERT INTO invoice_items (id, invoice_id, workspace_id, product_id, product_name, quantity, unit)
    VALUES ('30000000-0000-4000-8000-000000000001', '${INVOICE}', '${WS}', '${PRODUCT}',
            'رول پارچه', 12.5, 'meter');`)

  // The file under test, twice — the second run must be a no-op.
  await setup.unsafe(migration)
  await setup.unsafe(migration)
  await setup.end()

  sql = postgres(url, { max: 4, onnotice: () => {} })
}, 240_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
})

describe('invoice_items.cut_loss_quantity', () => {
  it('leaves every line written before the migration at 0 — no backfill', async () => {
    // One row existed before the column did. Its loss is «none», not «unknown»,
    // and its quantity is untouched.
    expect(await cutLossOf('30000000-0000-4000-8000-000000000001')).toBe(0)
    const [row] = await sql<{ quantity: string }[]>`
      SELECT quantity FROM invoice_items WHERE id = '30000000-0000-4000-8000-000000000001'`
    expect(Number(row!.quantity)).toBe(12.5)
  })

  it('records a loss on a measured line and reads it back exactly', async () => {
    await insertLine({
      id: '30000000-0000-4000-8000-000000000002',
      unit: 'meter',
      quantity: 12.5,
      cutLoss: 1.25,
    })
    expect(await cutLossOf('30000000-0000-4000-8000-000000000002')).toBe(1.25)

    // The shelf lost 13.75 m: quantity + cut loss, which is the rule the
    // service and the offline engine both apply (`stockQuantityOfLine`).
    const [row] = await sql<{ quantity: string; cut_loss_quantity: string }[]>`
      SELECT quantity, cut_loss_quantity FROM invoice_items
       WHERE id = '30000000-0000-4000-8000-000000000002'`
    expect(Number(row!.quantity) + Number(row!.cut_loss_quantity)).toBe(13.75)
  })

  it('refuses a cut loss on a count unit', async () => {
    await expect(
      insertLine({
        id: '30000000-0000-4000-8000-000000000003',
        unit: 'piece',
        quantity: 2,
        cutLoss: 1,
      }),
    ).rejects.toThrow(/invoice_items_cut_loss_measured_unit/)
    expect(await cutLossOf('30000000-0000-4000-8000-000000000003')).toBeNull()
  })

  it('refuses a negative loss', async () => {
    await expect(
      insertLine({
        id: '30000000-0000-4000-8000-000000000004',
        unit: 'meter',
        quantity: 5,
        cutLoss: -0.5,
      }),
    ).rejects.toThrow(/invoice_items_cut_loss_non_negative/)
  })

  it('lets a line with no loss carry on writing a count unit', async () => {
    // The constraint must not block the ordinary case: a piece sold as a piece.
    await insertLine({
      id: '30000000-0000-4000-8000-000000000005',
      unit: 'piece',
      quantity: 3,
      cutLoss: 0,
    })
    expect(await cutLossOf('30000000-0000-4000-8000-000000000005')).toBe(0)
  })

  it('accepts a custom unit, whose dimension is unknown by design', async () => {
    await insertLine({
      id: '30000000-0000-4000-8000-000000000006',
      unit: 'custom',
      quantity: 1,
      cutLoss: 0.2,
    })
    expect(await cutLossOf('30000000-0000-4000-8000-000000000006')).toBe(0.2)
  })

  it('is idempotent: the second run leaves both constraints installed and VALIDATED', async () => {
    const rows = await sql<{ conname: string; convalidated: boolean }[]>`
      SELECT conname, convalidated FROM pg_constraint
       WHERE conrelid = 'public.invoice_items'::regclass
         AND conname IN ('invoice_items_cut_loss_non_negative',
                         'invoice_items_cut_loss_measured_unit')
       ORDER BY conname`
    expect(rows.map((row) => row.conname)).toEqual([
      'invoice_items_cut_loss_measured_unit',
      'invoice_items_cut_loss_non_negative',
    ])
    // ⚠️ VALIDATED, not merely present: an unvalidated constraint protects only
    // rows written after it and says nothing about the ones already there.
    expect(rows.every((row) => row.convalidated === true)).toBe(true)
  })

  it('updates a recorded loss, and the refusal still holds after the update', async () => {
    await sql`UPDATE invoice_items SET cut_loss_quantity = 2.5
               WHERE id = '30000000-0000-4000-8000-000000000002'`
    expect(await cutLossOf('30000000-0000-4000-8000-000000000002')).toBe(2.5)

    await expect(
      sql`UPDATE invoice_items SET unit = 'carton'
           WHERE id = '30000000-0000-4000-8000-000000000002'`,
    ).rejects.toThrow(/invoice_items_cut_loss_measured_unit/)
  })

  it('keeps the column NOT NULL with a 0 default, so no read has to guess', async () => {
    const [column] = await sql<{ is_nullable: string; column_default: string | null }[]>`
      SELECT is_nullable, column_default FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'invoice_items'
         AND column_name = 'cut_loss_quantity'`
    expect(column!.is_nullable).toBe('NO')
    expect(column!.column_default).toBe('0')
  })
})
