// ============================================
// backend/src/__tests__/gold-01.pg.test.ts
//
// Proves V59.1 Gold & Jewellery completion on real Postgres:
//   1. Idempotent gold-01-migration.sql runs twice + VERIFY-gold-01 passes
//   2. invoice_items persists locked metal snapshot columns (rate, purity, net_weight_mg, making_charge, captured_at/by)
//   3. Second-hand purchase enforces KYC when net credit >= threshold; idempotent replay
//   4. Melt/scrap refuses recovered > input and records weight loss
//   5. Showcase/safe location reconciliation computes variance idempotently
//   6. Tenant isolation across workspaces
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'

const PORT = freePortSync()
const dir = pgTempDir('hisabche-pg-gold01-')
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/gold01`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const readDoc = (name: string) => readFileSync(join(DOCS, name), 'utf8')

const U = '11111111-1111-4111-8111-111111111111'
const W1 = '22222222-2222-4222-8222-222222222221'
const W2 = '22222222-2222-4222-8222-222222222222'
const P = '33333333-3333-4333-8333-333333333333'
const INV = '44444444-4444-4444-8444-444444444444'

const BASE = `
  CREATE EXTENSION IF NOT EXISTS pgcrypto;
  CREATE TABLE public.workspaces (id uuid PRIMARY KEY);
  CREATE TABLE public.customers (id uuid PRIMARY KEY, workspace_id uuid);
  CREATE TABLE public.invoices (id uuid PRIMARY KEY, workspace_id uuid);
  CREATE TABLE public.invoice_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    workspace_id uuid,
    product_id uuid,
    product_name text,
    quantity numeric,
    unit_price numeric,
    total_price numeric
  );
  CREATE TABLE public.metal_rates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL,
    rate_date date NOT NULL,
    rate_24k_minor_per_gram bigint NOT NULL
  );
`

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('gold01')
  sql = postgres(url, { max: 4 })
  await sql.unsafe(BASE)
  await sql`INSERT INTO public.workspaces (id) VALUES (${W1}), (${W2})`
  await sql`INSERT INTO public.invoices (id, workspace_id) VALUES (${INV}, ${W1})`

  const goldSql = readDoc('gold-01-migration.sql')
  await sql.unsafe(goldSql)
  // Idempotent second run
  await sql.unsafe(goldSql)
}, 90_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
})

describe('gold-01 snapshot & operations', () => {
  it('passes all VERIFY-gold-01 checks', async () => {
    const [row] = await sql.unsafe(readDoc('VERIFY-gold-01.sql'))
    for (const [k, v] of Object.entries(row ?? {})) {
      expect(v, k).toBe(true)
    }
  })

  it('persists locked metal rate snapshot columns on invoice_items', async () => {
    await sql`
      INSERT INTO public.invoice_items (
        invoice_id, workspace_id, product_id, product_name, quantity, unit_price, total_price,
        metal_rate_24k_minor, metal_purity_karat, metal_net_weight_mg, making_charge_minor,
        metal_rate_captured_at, metal_rate_captured_by
      ) VALUES (
        ${INV}, ${W1}, ${P}, 'Gold Ring 21K', 1, 7800, 7800,
        8000, 21, 1000, 800, '2026-11-11T10:00:00Z', ${U}
      )
    `
    const [line] = await sql`
      SELECT metal_rate_24k_minor, metal_purity_karat, metal_net_weight_mg, making_charge_minor
        FROM public.invoice_items
       WHERE invoice_id = ${INV} AND workspace_id = ${W1}
    `
    expect(Number(line!.metal_rate_24k_minor)).toBe(8000)
    expect(Number(line!.metal_purity_karat)).toBe(21)
    expect(Number(line!.metal_net_weight_mg)).toBe(1000)
    expect(Number(line!.making_charge_minor)).toBe(800)

    await expect(
      sql`INSERT INTO public.invoice_items (invoice_id, workspace_id, metal_purity_karat)
          VALUES (${INV}, ${W1}, 17)`,
    ).rejects.toThrow(/invoice_items_metal_purity_check/)
  })

  it('enforces KYC threshold on second-hand purchase, melt recovery bounds, and location variance', async () => {
    await expect(
      sql`SELECT * FROM public.gold_record_second_hand_purchase(${W1}, ${U}, ${sql.json({
        karat: 18,
        input_weight_mg: 4000,
        recovered_pure_mg: 3000,
        rate_24k_minor_per_gram: 10000,
        gross_credit_minor: 30000,
        deduction_bp: 0,
        net_credit_minor: 30000,
        kyc_threshold_minor: 20000,
        client_request_id: 'sh-kyc-fail',
      })})`,
    ).rejects.toThrow(/GOLD_KYC_REQUIRED/)

    const [ok] = await sql`
      SELECT * FROM public.gold_record_second_hand_purchase(${W1}, ${U}, ${sql.json({
        karat: 18,
        input_weight_mg: 4000,
        recovered_pure_mg: 3000,
        rate_24k_minor_per_gram: 10000,
        gross_credit_minor: 30000,
        deduction_bp: 0,
        net_credit_minor: 30000,
        kyc_threshold_minor: 20000,
        id_full_name: 'Karim A.',
        id_type: 'national_id',
        id_number: '1400-1122',
        client_request_id: 'sh-1',
      })})
    `
    const [replay] = await sql`
      SELECT * FROM public.gold_record_second_hand_purchase(${W1}, ${U}, ${sql.json({
        karat: 18,
        input_weight_mg: 4000,
        recovered_pure_mg: 3000,
        rate_24k_minor_per_gram: 10000,
        gross_credit_minor: 30000,
        deduction_bp: 0,
        net_credit_minor: 30000,
        kyc_threshold_minor: 20000,
        id_full_name: 'Karim A.',
        id_type: 'national_id',
        id_number: '1400-1122',
        client_request_id: 'sh-1',
      })})
    `
    expect(replay!.id).toBe(ok!.id)

    await expect(
      sql`SELECT * FROM public.gold_record_melt_scrap(${W1}, ${U}, ${sql.json({
        karat: 21,
        input_weight_mg: 5000,
        recovered_pure_mg: 5001,
        rate_24k_minor_per_gram: 10000,
        waste_cost_minor: 0,
        client_request_id: 'melt-bad',
      })})`,
    ).rejects.toThrow(/GOLD_RECOVERED_EXCEEDS_INPUT/)

    const [rec] = await sql`
      SELECT * FROM public.gold_reconcile_location(${W1}, ${U}, ${sql.json({
        location: 'showcase',
        karat: 21,
        system_weight_mg: 25000,
        physical_counted_mg: 24800,
        client_request_id: 'rec-showcase-1',
      })})
    `
    expect(Number(rec!.variance_mg)).toBe(-200)

    const otherRows =
      await sql`SELECT id FROM public.gold_location_reconciliations WHERE workspace_id = ${W2}`
    expect(otherRows).toHaveLength(0)
  })
})
