// ============================================
// The invoice-return-05 scenarios, written once against a tiny SQL runner so the
// SAME assertions run on embedded-postgres (CI) and on any other real Postgres
// (PGlite on a machine where the embedded binary is quarantined).
//
// `run(text, params)` answers the rows. Nothing here imports a driver.
// ============================================

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export type Run = <T = Record<string, unknown>>(
  text: string,
  params?: readonly unknown[],
) => Promise<Array<T>>

export interface Scenario {
  name: string
  run: (run: Run) => Promise<void>
}

const DOCS = process.env.RETURN05_DOCS ?? join(__dirname, '..', '..', '..', '..', 'docs')
const doc = (name: string) => readFileSync(join(DOCS, name), 'utf8')

export const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
export const OTHER_WS = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const USER = '11111111-1111-4111-8111-111111111111'
const PRODUCT = '20000000-0000-4000-8000-000000000001'
const WAREHOUSE = '30000000-0000-4000-8000-000000000001'

// Just enough of the real schema for the migrations to run and the numbers to be checked.
const STUB_SCHEMA = `
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.workspace_members (
  workspace_id uuid, user_id uuid, has_access boolean DEFAULT true, suspended_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY, workspace_id uuid, invoice_number text, type text DEFAULT 'sale',
  customer_id uuid, total numeric DEFAULT 0, paid_amount numeric DEFAULT 0, tax_total numeric DEFAULT 0,
  exchange_rate numeric DEFAULT 1, currency text, warehouse_id uuid, status text DEFAULT 'pending'
);
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id uuid PRIMARY KEY, invoice_id uuid, workspace_id uuid, product_id uuid,
  quantity numeric, unit_price numeric, discount numeric DEFAULT 0, total numeric
);
CREATE TABLE IF NOT EXISTS public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid, role text,
  deleted_at timestamptz, is_active boolean DEFAULT true
);
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid, user_id uuid, product_id uuid,
  type text, quantity numeric, to_warehouse_id uuid, reference_type text, reference_id uuid,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.product_stock (
  workspace_id uuid, product_id uuid, warehouse_id uuid, qty numeric, deleted_at timestamptz,
  updated_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY, workspace_id uuid, quantity numeric, updated_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.cost_layers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid, product_id uuid,
  source_type text, source_id uuid, received_qty numeric, remaining_qty numeric,
  updated_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.cost_consumptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid, product_id uuid, warehouse_id uuid,
  layer_id uuid, consumer_type text, consumer_id uuid, consumer_line text, quantity numeric,
  unit_cost numeric, amount numeric, is_estimated boolean, entry_date date,
  created_at timestamptz DEFAULT now(), created_by uuid
);
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid, client_request_id text,
  status text DEFAULT 'posted'
);
CREATE TABLE IF NOT EXISTS public.test_journal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), header jsonb, lines jsonb
);
-- The real function refuses an unbalanced entry; so does this stand-in, so a rounding slip here fails the test.
CREATE OR REPLACE FUNCTION public.accounting_post_journal_entry(
  p_workspace_id uuid, p_user_id uuid, p_header jsonb, p_lines jsonb
) RETURNS uuid LANGUAGE plpgsql AS $fn$
DECLARE v_d numeric; v_c numeric; v_id uuid := gen_random_uuid();
BEGIN
  SELECT COALESCE(SUM((l->>'debit')::numeric), 0), COALESCE(SUM((l->>'credit')::numeric), 0)
    INTO v_d, v_c FROM jsonb_array_elements(p_lines) l;
  IF v_d <> v_c OR v_d = 0 THEN RAISE EXCEPTION 'JOURNAL_ENTRY_UNBALANCED: % vs %', v_d, v_c; END IF;
  INSERT INTO public.test_journal (id, header, lines) VALUES (v_id, p_header, p_lines);
  RETURN v_id;
END $fn$;
`

/** What each VERIFY file answered right after its migration ran (read by a scenario). */
export const verified: Record<string, Record<string, unknown>> = {}

/** Create the stand-in schema, then the real migrations in the order a person runs them: 01, 03, 04, 05 (twice). */
export async function setupReturn05(run: Run): Promise<void> {
  await run(STUB_SCHEMA)
  await run(doc('invoice-return-01-migration.sql'))
  await run(doc('invoice-return-03-repair-migration.sql'))
  verified['03'] = (await run(doc('VERIFY-invoice-return-03.sql')))[0] ?? {}
  await run(doc('invoice-return-04-one-per-invoice-migration.sql'))
  verified['04'] = (await run(doc('VERIFY-invoice-return-04.sql')))[0] ?? {}
  const migration = doc('invoice-return-05-core-migration.sql')
  await run(migration)
  await run(migration) // idempotent: a second run changes nothing and does not fail
  verified['05'] = (await run(doc('VERIFY-invoice-return-05.sql')))[0] ?? {}
  await run(
    `INSERT INTO public.accounts (workspace_id, role) VALUES
       ($1,'sales'),($1,'receivable'),($1,'payable'),($1,'inventory'),($1,'cogs'),($1,'tax')`,
    [WS],
  )
}

interface ReturnVector {
  id: string
  title: string
  fractionDigits: number
  invoice: {
    taxMinor: number
    lines: Array<{ id: string; quantity: number; unitPriceMinor: number; discountMinor: number }>
  }
  request: {
    lines: Array<{ originalLineId: string; quantity: number; conditionCode?: string }>
    deductions?: unknown[]
  }
  expected?: {
    subtotalMinor: number
    discountMinor: number
    taxMinor: number
    deductionMinor: number
    netCreditMinor: number
    lines: Array<{
      originalLineId: string
      subtotalMinor: number
      discountMinor: number
      taxMinor: number
    }>
  }
  expectedError?: string
}

const vectorsPath = join(
  DOCS,
  '..',
  'packages',
  'validation',
  'src',
  '__golden__',
  'returns-vectors.json',
)

let seq = 0
const uuid = (n: number) => `4${String(n).padStart(7, '0')}-0000-4000-8000-000000000000`

interface InvoiceSeed {
  total: number
  paid: number
  tax: number
  /** [quantity, unitPrice, lineDiscount?] per line — MAJOR units */
  lines: Array<[number, number] | [number, number, number]>
  type?: 'sale' | 'purchase'
  exchangeRate?: number
}

async function seedInvoice(run: Run, seed: InvoiceSeed) {
  seq += 1
  const id = uuid(seq)
  await run(
    `INSERT INTO public.invoices (id, workspace_id, invoice_number, type, total, paid_amount, tax_total,
       exchange_rate, warehouse_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      id,
      WS,
      `INV-${seq}`,
      seed.type ?? 'sale',
      seed.total,
      seed.paid,
      seed.tax,
      seed.exchangeRate ?? 1,
      WAREHOUSE,
    ],
  )
  const lineIds: string[] = []
  for (const [index, [quantity, price, discount = 0]] of seed.lines.entries()) {
    const lineId = `5${String(seq).padStart(3, '0')}${String(index).padStart(4, '0')}-0000-4000-8000-000000000000`
    lineIds.push(lineId)
    await run(
      `INSERT INTO public.invoice_items (id, invoice_id, workspace_id, product_id, quantity, unit_price, discount, total)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [lineId, id, WS, PRODUCT, quantity, price, discount, quantity * price - discount],
    )
  }
  return { id, lineIds }
}

async function createReturn(
  run: Run,
  invoiceId: string,
  body: {
    returnType?: 'sale_return' | 'purchase_return'
    lines: Array<{
      lineId: string
      quantity: number
      restock?: 'restock' | 'scrap'
      condition?: string
    }>
    deductions?: unknown[]
    reasonCode?: string
    notes?: string
    clientRequestId?: string
  },
) {
  seq += 1
  const rows = await run(
    `SELECT public.invoice_return_create($1::uuid, $2::uuid, 2, $3::jsonb, $4::jsonb, $5::jsonb) AS result`,
    [
      WS,
      USER,
      JSON.stringify({
        originalInvoiceId: invoiceId,
        returnType: body.returnType ?? 'sale_return',
        returnNumber: `RET-${seq}`,
        returnDate: '2026-11-01',
        reasonCode: body.reasonCode,
        notes: body.notes,
        clientRequestId: body.clientRequestId,
      }),
      JSON.stringify(
        body.lines.map((line) => ({
          originalLineId: line.lineId,
          quantity: line.quantity,
          restockChoice: line.restock ?? 'scrap',
          reasonCode: 'other',
          conditionCode: line.condition,
        })),
      ),
      JSON.stringify(body.deductions ?? []),
    ],
  )
  return rows[0]!.result as { id: string; grandTotalMinor?: number; [key: string]: unknown }
}

/** The lines of the journal entry a return posted, by role, in books units. */
async function journalOf(run: Run, returnId: string) {
  const entry = await run(`SELECT lines FROM public.test_journal WHERE header->>'source_id' = $1`, [
    returnId,
  ])
  const lines = (entry[0]?.lines ?? []) as Array<{
    account_id: string
    debit: number
    credit: number
  }>
  const accounts = await run(`SELECT id, role FROM public.accounts WHERE workspace_id = $1`, [WS])
  const roleOf = new Map(accounts.map((account) => [account.id as string, account.role as string]))
  const byRole: Record<string, { debit: number; credit: number }> = {}
  for (const line of lines) {
    const role = roleOf.get(line.account_id) ?? 'unknown'
    const row = (byRole[role] ??= { debit: 0, credit: 0 })
    row.debit = Math.round((row.debit + Number(line.debit)) * 100) / 100
    row.credit = Math.round((row.credit + Number(line.credit)) * 100) / 100
  }
  return byRole
}

async function expectFailure(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (error: unknown) => {
    const message = String((error as { message?: string }).message ?? error)
    assert.ok(message.includes(code), `expected ${code}, got: ${message}`)
    return true
  })
}

export const scenarios: Scenario[] = [
  {
    name: 'a sale return with tax and a 30% deduction: credit, tax and journal agree',
    run: async (run) => {
      // 1 000 net + 100 tax = 1 100, fully paid.
      const inv = await seedInvoice(run, {
        total: 1100,
        paid: 1100,
        tax: 100,
        lines: [
          [5, 100],
          [5, 100],
        ],
      })
      const result = await createReturn(run, inv.id, {
        lines: [{ lineId: inv.lineIds[0]!, quantity: 2, restock: 'restock', condition: 'sealed' }],
        deductions: [{ reason: 'return_fee', mode: 'percent', percent: 30 }],
        reasonCode: 'customer_change_of_mind',
        notes: 'opened box',
      })
      // net 200.00 (20000 minor), tax 10% of 200 = 20.00, deduction 30% of 200 = 60.00, credit 160.00
      assert.equal(Number(result.deductionMinor), 6000)
      assert.equal(Number(result.taxMinor), 2000)
      assert.equal(Number(result.grandTotalMinor), 16000)

      const [row] = await run(
        `SELECT total_subtotal_minor, total_tax_minor, grand_total_minor, deduction_minor, reason_code, notes
           FROM public.invoice_returns WHERE id = $1`,
        [result.id],
      )
      assert.equal(Number(row!.total_subtotal_minor), 20000)
      assert.equal(Number(row!.total_tax_minor), 2000)
      assert.equal(Number(row!.grand_total_minor), 16000)
      assert.equal(Number(row!.deduction_minor), 6000)
      assert.equal(row!.reason_code, 'customer_change_of_mind')

      const [line] = await run(
        `SELECT condition_code, tax_minor FROM public.invoice_return_lines WHERE return_id = $1`,
        [result.id],
      )
      assert.equal(line!.condition_code, 'sealed')
      assert.equal(Number(line!.tax_minor), 2000)

      const ded = await run(
        `SELECT reason_code, mode, percent, amount_minor FROM public.invoice_return_deductions WHERE return_id = $1`,
        [result.id],
      )
      assert.equal(ded.length, 1)
      assert.equal(Number(ded[0]!.amount_minor), 6000)

      // Dr sales 140 (goods 200 - 60 kept), Dr tax 20, Cr receivable 160.
      const journal = await journalOf(run, result.id)
      assert.deepEqual(journal.sales, { debit: 140, credit: 0 })
      assert.deepEqual(journal.tax, { debit: 20, credit: 0 })
      assert.deepEqual(journal.receivable, { debit: 0, credit: 160 })
    },
  },
  {
    name: 'several items in one return, and returning every line returns the whole tax',
    run: async (run) => {
      const inv = await seedInvoice(run, {
        total: 1100,
        paid: 0,
        tax: 100,
        lines: [
          [5, 100],
          [5, 100],
        ],
      })
      const result = await createReturn(run, inv.id, {
        lines: [
          { lineId: inv.lineIds[0]!, quantity: 5 },
          { lineId: inv.lineIds[1]!, quantity: 5 },
        ],
      })
      assert.equal(Number(result.taxMinor), 10000)
      assert.equal(Number(result.grandTotalMinor), 110000)
      const lines = await run(`SELECT 1 FROM public.invoice_return_lines WHERE return_id = $1`, [
        result.id,
      ])
      assert.equal(lines.length, 2)
    },
  },
  {
    name: 'a plain return (no deductions) keeps working with the optional argument left out',
    run: async (run) => {
      const inv = await seedInvoice(run, { total: 500, paid: 0, tax: 0, lines: [[5, 100]] })
      seq += 1
      const rows = await run<{ result: { grandTotalMinor: number } }>(
        `SELECT public.invoice_return_create($1::uuid, $2::uuid, 2, $3::jsonb, $4::jsonb) AS result`,
        [
          WS,
          USER,
          JSON.stringify({
            originalInvoiceId: inv.id,
            returnType: 'sale_return',
            returnNumber: `RET-${seq}`,
          }),
          JSON.stringify([
            {
              originalLineId: inv.lineIds[0],
              quantity: 1,
              restockChoice: 'scrap',
              reasonCode: 'other',
            },
          ]),
        ],
      )
      assert.equal(Number(rows[0]!.result.grandTotalMinor), 10000)
    },
  },
  {
    name: 'no tax account: the tax comes back inside sales, as the invoice booked it',
    run: async (run) => {
      await run(
        `UPDATE public.accounts SET deleted_at = now() WHERE workspace_id = $1 AND role = 'tax'`,
        [WS],
      )
      try {
        const inv = await seedInvoice(run, {
          total: 1100,
          paid: 1100,
          tax: 100,
          lines: [[10, 100]],
        })
        const result = await createReturn(run, inv.id, {
          lines: [{ lineId: inv.lineIds[0]!, quantity: 10 }],
        })
        const journal = await journalOf(run, result.id)
        assert.deepEqual(journal.sales, { debit: 1100, credit: 0 })
        assert.equal(journal.tax, undefined)
        assert.deepEqual(journal.receivable, { debit: 0, credit: 1100 })
      } finally {
        await run(
          `UPDATE public.accounts SET deleted_at = NULL WHERE workspace_id = $1 AND role = 'tax'`,
          [WS],
        )
      }
    },
  },
  {
    name: 'a foreign rate keeps the journal balanced (credit is the sum of the debits)',
    run: async (run) => {
      const inv = await seedInvoice(run, {
        total: 1100,
        paid: 1100,
        tax: 100,
        lines: [[3, 333.33]],
        exchangeRate: 71.3,
      })
      const result = await createReturn(run, inv.id, {
        lines: [{ lineId: inv.lineIds[0]!, quantity: 2 }],
        deductions: [{ reason: 'damage', mode: 'fixed', amount: 17.77 }],
      })
      const journal = await journalOf(run, result.id)
      const debit = Object.values(journal).reduce((sum, row) => sum + row.debit, 0)
      const credit = Object.values(journal).reduce((sum, row) => sum + row.credit, 0)
      assert.ok(Math.abs(debit - credit) < 0.0001, `debit ${debit} credit ${credit}`)
    },
  },
  {
    name: 'refused: deduction above the net goods, «other» without a note, bad percent, bad condition',
    run: async (run) => {
      const inv = await seedInvoice(run, { total: 1000, paid: 1000, tax: 0, lines: [[10, 100]] })
      const line = inv.lineIds[0]!
      await expectFailure(
        createReturn(run, inv.id, {
          lines: [{ lineId: line, quantity: 1 }],
          deductions: [{ reason: 'agreed', mode: 'fixed', amount: 100.01 }],
        }),
        'RETURN_DEDUCTION_EXCEEDS_BASE',
      )
      await expectFailure(
        createReturn(run, inv.id, {
          lines: [{ lineId: line, quantity: 1 }],
          deductions: [{ reason: 'other', mode: 'fixed', amount: 5 }],
        }),
        'RETURN_DEDUCTION_NOTE_REQUIRED',
      )
      await expectFailure(
        createReturn(run, inv.id, {
          lines: [{ lineId: line, quantity: 1 }],
          deductions: [{ reason: 'agreed', mode: 'percent', percent: 101 }],
        }),
        'RETURN_DEDUCTION_PERCENT_INVALID',
      )
      await expectFailure(
        createReturn(run, inv.id, { lines: [{ lineId: line, quantity: 1, condition: 'wet' }] }),
        'INVALID_RETURN_CONDITION',
      )
      // Nothing was written by any refused attempt.
      const rows = await run(
        `SELECT 1 FROM public.invoice_returns WHERE original_invoice_id = $1`,
        [inv.id],
      )
      assert.equal(rows.length, 0)
    },
  },
  {
    name: 'a purchase return takes no deductions',
    run: async (run) => {
      const inv = await seedInvoice(run, {
        total: 1000,
        paid: 0,
        tax: 0,
        lines: [[10, 100]],
        type: 'purchase',
      })
      await expectFailure(
        createReturn(run, inv.id, {
          returnType: 'purchase_return',
          lines: [{ lineId: inv.lineIds[0]!, quantity: 1 }],
          deductions: [{ reason: 'return_fee', mode: 'percent', percent: 10 }],
        }),
        'RETURN_DEDUCTION_NOT_ALLOWED',
      )
    },
  },
  {
    name: 'one return per invoice, enforced by the database',
    run: async (run) => {
      const inv = await seedInvoice(run, { total: 1000, paid: 0, tax: 0, lines: [[10, 100]] })
      await createReturn(run, inv.id, { lines: [{ lineId: inv.lineIds[0]!, quantity: 1 }] })
      await expectFailure(
        createReturn(run, inv.id, { lines: [{ lineId: inv.lineIds[0]!, quantity: 1 }] }),
        'INVOICE_ALREADY_RETURNED',
      )
    },
  },
  {
    name: 'refund: only the part of the credit that is money the customer gave, never twice',
    run: async (run) => {
      const inv = await seedInvoice(run, { total: 1100, paid: 1100, tax: 100, lines: [[10, 100]] })
      const result = await createReturn(run, inv.id, {
        lines: [{ lineId: inv.lineIds[0]!, quantity: 4 }],
        deductions: [{ reason: 'return_fee', mode: 'percent', percent: 25 }],
      })
      // net 400, tax 40, kept 100 -> credit 340.00 = 34000 minor
      assert.equal(Number(result.grandTotalMinor), 34000)

      type RefundRes = { id: string; refundableMinor: number; replayed?: boolean }
      const reserve = (amountMinor: number, method = 'cash') =>
        run<{ r: RefundRes }>(
          `SELECT public.invoice_return_refund_reserve($1::uuid, $2::uuid, 2, $3::uuid, $4::bigint, $5) AS r`,
          [WS, USER, result.id, amountMinor, method],
        )

      const first = await reserve(20000)
      assert.equal(Number(first[0]!.r.refundableMinor), 14000)
      // 200 reserved: another 150 would pass 340 together.
      await expectFailure(reserve(15000), 'REFUND_EXCEEDS_REFUNDABLE')
      // Releasing the reservation gives the room back.
      await run(`SELECT public.invoice_return_refund_fail($1::uuid, $2::uuid)`, [
        WS,
        first[0]!.r.id,
      ])
      const second = await reserve(34000)
      // Settling moves the counter once, and a second settle is a replay.
      const payment = '60000000-0000-4000-8000-000000000001'
      await run(`SELECT public.invoice_return_refund_settle($1::uuid, $2::uuid, $3::uuid)`, [
        WS,
        second[0]!.r.id,
        payment,
      ])
      const again = await run<{ r: RefundRes }>(
        `SELECT public.invoice_return_refund_settle($1::uuid, $2::uuid, $3::uuid) AS r`,
        [WS, second[0]!.r.id, payment],
      )
      assert.equal(again[0]!.r.replayed, true)
      const [after] = await run(`SELECT refunded_minor FROM public.invoice_returns WHERE id = $1`, [
        result.id,
      ])
      assert.equal(Number(after!.refunded_minor), 34000)
      await expectFailure(reserve(1), 'REFUND_EXCEEDS_REFUNDABLE')
    },
  },
  {
    name: 'refund: nothing to hand back when the credit only cancelled a debt',
    run: async (run) => {
      const inv = await seedInvoice(run, { total: 1100, paid: 0, tax: 100, lines: [[10, 100]] })
      const result = await createReturn(run, inv.id, {
        lines: [{ lineId: inv.lineIds[0]!, quantity: 2 }],
      })
      await expectFailure(
        run(
          `SELECT public.invoice_return_refund_reserve($1::uuid, $2::uuid, 2, $3::uuid, 100::bigint, 'cash')`,
          [WS, USER, result.id],
        ),
        'REFUND_EXCEEDS_REFUNDABLE',
      )
    },
  },
  {
    name: 'refund: a part-paid invoice refunds only the credit beyond the debt it cancelled',
    run: async (run) => {
      // 1 100 owed, 400 paid -> 700 still owed. A return worth 880 cancels 700 and leaves 180 of credit.
      const inv = await seedInvoice(run, { total: 1100, paid: 400, tax: 100, lines: [[10, 100]] })
      const result = await createReturn(run, inv.id, {
        lines: [{ lineId: inv.lineIds[0]!, quantity: 8 }],
      })
      assert.equal(Number(result.grandTotalMinor), 88000)
      type QuietReserve = { r: { id: string; refundableMinor?: number; amountMinor?: number } }
      const reserve = (amountMinor: number) =>
        run<QuietReserve>(
          `SELECT public.invoice_return_refund_reserve($1::uuid, $2::uuid, 2, $3::uuid, $4::bigint, 'bank') AS r`,
          [WS, USER, result.id, amountMinor],
        )
      await expectFailure(reserve(18001), 'REFUND_EXCEEDS_REFUNDABLE')
      const ok = await reserve(18000)
      assert.equal(Number(ok[0]!.r.refundableMinor), 0)
    },
  },
  {
    name: 'a restocked, costed line gives its cost layer back and books inventory against cost of sales',
    run: async (run) => {
      const inv = await seedInvoice(run, { total: 1000, paid: 1000, tax: 0, lines: [[5, 200]] })
      const layer = '70000000-0000-4000-8000-000000000001'
      await run(
        `INSERT INTO public.cost_layers (id, workspace_id, product_id, received_qty, remaining_qty)
         VALUES ($1,$2,$3,10,3)`,
        [layer, WS, PRODUCT],
      )
      // The sale consumed 5 units at 120 each from that layer.
      await run(
        `INSERT INTO public.cost_consumptions
           (workspace_id, product_id, layer_id, consumer_type, consumer_id, quantity, unit_cost, amount, entry_date)
         VALUES ($1,$2,$3,'invoice',$4,5,120,600,'2026-10-01')`,
        [WS, PRODUCT, layer, inv.id],
      )
      const result = await createReturn(run, inv.id, {
        lines: [{ lineId: inv.lineIds[0]!, quantity: 2, restock: 'restock', condition: 'opened' }],
        deductions: [{ reason: 'repackaging', mode: 'fixed', amount: 50 }],
      })
      const [row] = await run(`SELECT remaining_qty FROM public.cost_layers WHERE id = $1`, [layer])
      assert.equal(Number(row!.remaining_qty), 5)
      const journal = await journalOf(run, result.id)
      // goods 400 - 50 kept = 350 sales; 2 x 120 = 240 cost back.
      assert.deepEqual(journal.sales, { debit: 350, credit: 0 })
      assert.deepEqual(journal.inventory, { debit: 240, credit: 0 })
      assert.deepEqual(journal.cogs, { debit: 0, credit: 240 })
    },
  },
  {
    name: 'a restocked line puts the goods back and a scrapped one does not',
    run: async (run) => {
      const inv = await seedInvoice(run, {
        total: 1000,
        paid: 1000,
        tax: 0,
        lines: [
          [5, 100],
          [5, 100],
        ],
      })
      const result = await createReturn(run, inv.id, {
        lines: [
          { lineId: inv.lineIds[0]!, quantity: 2, restock: 'restock', condition: 'sealed' },
          { lineId: inv.lineIds[1]!, quantity: 3, restock: 'scrap', condition: 'damaged' },
        ],
      })
      const moves = await run(
        `SELECT quantity FROM public.stock_movements WHERE reference_id = $1 AND reference_type = 'invoice_return'`,
        [result.id],
      )
      assert.equal(moves.length, 1)
      assert.equal(Number(moves[0]!.quantity), 2)
    },
  },
  {
    name: 'a return keeps its Idempotency-Key, and a key is never shared by two returns of one business',
    run: async (run) => {
      const first = await seedInvoice(run, { total: 1000, paid: 0, tax: 0, lines: [[10, 100]] })
      const second = await seedInvoice(run, { total: 1000, paid: 0, tax: 0, lines: [[10, 100]] })
      const made = await createReturn(run, first.id, {
        lines: [{ lineId: first.lineIds[0]!, quantity: 1 }],
        clientRequestId: 'ret_abc12345',
      })
      const [row] = await run(
        `SELECT client_request_id FROM public.invoice_returns WHERE id = $1`,
        [made.id],
      )
      assert.equal(row!.client_request_id, 'ret_abc12345')
      // the same key on another invoice cannot make a second return: the key is the first one's
      await expectFailure(
        createReturn(run, second.id, {
          lines: [{ lineId: second.lineIds[0]!, quantity: 1 }],
          clientRequestId: 'ret_abc12345',
        }),
        'invoice_returns_request_idx',
      )
      // and a retry of the first (same invoice, same key) is refused by the one-per-invoice rule,
      // which the service answers by looking the key up and replaying the first return
      await expectFailure(
        createReturn(run, first.id, {
          lines: [{ lineId: first.lineIds[0]!, quantity: 1 }],
          clientRequestId: 'ret_abc12345',
        }),
        'INVOICE_ALREADY_RETURNED',
      )
    },
  },
  {
    name: 'golden vectors: the real SQL function answers what the reference function answers',
    run: async (run) => {
      const corpus = JSON.parse(readFileSync(vectorsPath, 'utf8')) as { vectors: ReturnVector[] }
      assert.ok(corpus.vectors.length >= 11)
      for (const vector of corpus.vectors) {
        const factor = 10 ** vector.fractionDigits
        const inv = await seedInvoice(run, {
          total: 1_000_000,
          paid: 0,
          tax: vector.invoice.taxMinor / factor,
          lines: vector.invoice.lines.map((line) => [
            line.quantity,
            line.unitPriceMinor / factor,
            line.discountMinor / factor,
          ]),
        })
        const lineIdOf = new Map(
          vector.invoice.lines.map((line, index) => [line.id, inv.lineIds[index]!]),
        )
        seq += 1
        const call = run(
          `SELECT public.invoice_return_create($1::uuid, $2::uuid, $3, $4::jsonb, $5::jsonb, $6::jsonb) AS result`,
          [
            WS,
            USER,
            vector.fractionDigits,
            JSON.stringify({
              originalInvoiceId: inv.id,
              returnType: 'sale_return',
              returnNumber: `GV-${seq}`,
            }),
            JSON.stringify(
              vector.request.lines.map((line) => ({
                originalLineId: lineIdOf.get(line.originalLineId),
                quantity: line.quantity,
                restockChoice: 'scrap',
                reasonCode: 'other',
                conditionCode: line.conditionCode,
              })),
            ),
            JSON.stringify(vector.request.deductions ?? []),
          ],
        )
        if (vector.expectedError) {
          await expectFailure(call, vector.expectedError)
          continue
        }
        const result = (await call)[0]!.result as Record<string, unknown>
        const expected = vector.expected!
        const [header] = await run(
          `SELECT total_subtotal_minor, total_discount_minor, total_tax_minor, deduction_minor, grand_total_minor
             FROM public.invoice_returns WHERE id = $1`,
          [result.id],
        )
        assert.deepEqual(
          {
            subtotalMinor: Number(header!.total_subtotal_minor),
            discountMinor: Number(header!.total_discount_minor),
            taxMinor: Number(header!.total_tax_minor),
            deductionMinor: Number(header!.deduction_minor),
            netCreditMinor: Number(header!.grand_total_minor),
          },
          {
            subtotalMinor: expected.subtotalMinor,
            discountMinor: expected.discountMinor,
            taxMinor: expected.taxMinor,
            deductionMinor: expected.deductionMinor,
            netCreditMinor: expected.netCreditMinor,
          },
          vector.id,
        )
        const lines = await run(
          `SELECT original_line_id, subtotal_minor, discount_minor, tax_minor
             FROM public.invoice_return_lines WHERE return_id = $1`,
          [result.id],
        )
        const byLine = new Map(lines.map((row) => [row.original_line_id as string, row]))
        for (const line of expected.lines) {
          const row = byLine.get(lineIdOf.get(line.originalLineId)!)!
          assert.deepEqual(
            [Number(row.subtotal_minor), Number(row.discount_minor), Number(row.tax_minor)],
            [line.subtotalMinor, line.discountMinor, line.taxMinor],
            `${vector.id} line ${line.originalLineId}`,
          )
        }
      }
    },
  },
  {
    name: 'each VERIFY file answers true for its own migration',
    run: async () => {
      for (const [name, row] of Object.entries(verified)) {
        const booleans = Object.entries(row).filter(([, value]) => typeof value === 'boolean')
        assert.ok(booleans.length > 0, `VERIFY-${name} answered no check`)
        for (const [column, value] of booleans)
          assert.equal(value, true, `VERIFY-${name}.${column}`)
      }
      assert.equal(Number(verified['04']!.legacy_multi_return_invoices), 0)
    },
  },
  {
    name: 'refund idempotency: the same key is the same refund; a different amount is refused; a failed one frees its key',
    run: async (run) => {
      const inv = await seedInvoice(run, { total: 1000, paid: 1000, tax: 0, lines: [[10, 100]] })
      const result = await createReturn(run, inv.id, {
        lines: [{ lineId: inv.lineIds[0]!, quantity: 5 }],
      })
      type ReserveOutput = {
        r: { id: string; replayed?: boolean; status?: string; paymentId?: string }
      }
      const reserve = (amountMinor: number, key: string | null) =>
        run<ReserveOutput>(
          `SELECT public.invoice_return_refund_reserve($1::uuid, $2::uuid, 2, $3::uuid, $4::bigint, 'cash', $5) AS r`,
          [WS, USER, result.id, amountMinor, key],
        )
      const first = await reserve(20000, 'key-1')
      assert.equal(first[0]!.r.replayed, false)
      // the retry after a timeout: same key, same amount → the same reservation, nothing new
      const again = await reserve(20000, 'key-1')
      assert.equal(again[0]!.r.replayed, true)
      assert.equal(again[0]!.r.id, first[0]!.r.id)
      const rows = await run(`SELECT 1 FROM public.invoice_return_refunds WHERE return_id = $1`, [
        result.id,
      ])
      assert.equal(rows.length, 1)
      await expectFailure(reserve(10000, 'key-1'), 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH')
      // a refund that never paid frees its key: the retry is a new attempt
      await run(`SELECT public.invoice_return_refund_fail($1::uuid, $2::uuid)`, [
        WS,
        first[0]!.r.id,
      ])
      const fresh = await reserve(20000, 'key-1')
      assert.equal(fresh[0]!.r.replayed, false)
      assert.notEqual(fresh[0]!.r.id, first[0]!.r.id)
      // a paid one stays paid: the same key answers with its payment
      const payment = '60000000-0000-4000-8000-0000000000aa'
      await run(`SELECT public.invoice_return_refund_settle($1::uuid, $2::uuid, $3::uuid)`, [
        WS,
        fresh[0]!.r.id,
        payment,
      ])
      const paid = await reserve(20000, 'key-1')
      assert.deepEqual(
        [paid[0]!.r.replayed, paid[0]!.r.status, paid[0]!.r.paymentId],
        [true, 'paid', payment],
      )
    },
  },
  {
    name: 'a reservation that went quiet: paid → finished, never paid → released (cap is never stuck, never doubled)',
    run: async (run) => {
      const inv = await seedInvoice(run, { total: 1000, paid: 1000, tax: 0, lines: [[10, 100]] })
      const result = await createReturn(run, inv.id, {
        lines: [{ lineId: inv.lineIds[0]!, quantity: 10 }],
      })
      type QuietReserve = { r: { id: string; refundableMinor?: number; amountMinor?: number } }
      const reserve = (amountMinor: number) =>
        run<QuietReserve>(
          `SELECT public.invoice_return_refund_reserve($1::uuid, $2::uuid, 2, $3::uuid, $4::bigint, 'bank') AS r`,
          [WS, USER, result.id, amountMinor],
        )
      // credit is 1 000.00. Two reservations of 400.00 each: 200.00 is left.
      const paidOne = await reserve(40000)
      const lostOne = await reserve(40000)
      await expectFailure(reserve(30000), 'REFUND_EXCEEDS_REFUNDABLE')

      // The process died after PAYING the first (its payment exists, keyed by the reservation id)
      // and before paying the second (no payment). Both go quiet for an hour.
      await run(`INSERT INTO public.payments (workspace_id, client_request_id) VALUES ($1, $2)`, [
        WS,
        paidOne[0]!.r.id,
      ])
      await run(
        `UPDATE public.invoice_return_refunds SET created_at = now() - interval '1 hour' WHERE return_id = $1`,
        [result.id],
      )

      // The next reserve reconciles first: the paid one is FINISHED (counted as paid), the unpaid one RELEASED.
      const next = await reserve(60000)
      assert.equal(Number(next[0]!.r.amountMinor), 60000)
      const states = await run<{ id: string; status: string; payment_id: string }>(
        `SELECT id, status, payment_id FROM public.invoice_return_refunds WHERE return_id = $1`,
        [result.id],
      )
      const byId = new Map(states.map((row) => [row.id as string, row]))
      assert.equal(byId.get(paidOne[0]!.r.id)!.status, 'paid')
      assert.ok(byId.get(paidOne[0]!.r.id)!.payment_id, 'the paid one carries its payment')
      assert.equal(byId.get(lostOne[0]!.r.id)!.status, 'failed')
      const [ret] = await run(`SELECT refunded_minor FROM public.invoice_returns WHERE id = $1`, [
        result.id,
      ])
      assert.equal(Number(ret!.refunded_minor), 40000)
      // 1 000 − 400 paid − 600 reserved = 0: nothing more, and the 400 is not paid a second time.
      await expectFailure(reserve(1), 'REFUND_EXCEEDS_REFUNDABLE')
    },
  },
  {
    name: 'another business can read, reserve, settle or release nothing of this one',
    run: async (run) => {
      const inv = await seedInvoice(run, { total: 1000, paid: 1000, tax: 0, lines: [[10, 100]] })
      const result = await createReturn(run, inv.id, {
        lines: [{ lineId: inv.lineIds[0]!, quantity: 2 }],
      })
      const reserved = await run<{ r: { id: string } }>(
        `SELECT public.invoice_return_refund_reserve($1::uuid, $2::uuid, 2, $3::uuid, 100::bigint, 'cash') AS r`,
        [WS, USER, result.id],
      )
      await expectFailure(
        run(
          `SELECT public.invoice_return_refund_reserve($1::uuid, $2::uuid, 2, $3::uuid, 100::bigint, 'cash')`,
          [OTHER_WS, USER, result.id],
        ),
        'RETURN_NOT_FOUND',
      )
      await expectFailure(
        run(`SELECT public.invoice_return_refund_settle($1::uuid, $2::uuid, $3::uuid)`, [
          OTHER_WS,
          reserved[0]!.r.id,
          '60000000-0000-4000-8000-0000000000bb',
        ]),
        'REFUND_NOT_FOUND',
      )
      await expectFailure(
        run(`SELECT public.invoice_return_refund_fail($1::uuid, $2::uuid)`, [
          OTHER_WS,
          reserved[0]!.r.id,
        ]),
        'REFUND_NOT_FOUND',
      )
      // and nobody else's invoice can be returned against
      seq += 1
      await expectFailure(
        run(`SELECT public.invoice_return_create($1::uuid, $2::uuid, 2, $3::jsonb, $4::jsonb)`, [
          OTHER_WS,
          USER,
          JSON.stringify({
            originalInvoiceId: inv.id,
            returnType: 'sale_return',
            returnNumber: `X-${seq}`,
          }),
          JSON.stringify([
            {
              originalLineId: inv.lineIds[0],
              quantity: 1,
              restockChoice: 'scrap',
              reasonCode: 'other',
            },
          ]),
        ]),
        'INVOICE_NOT_FOUND',
      )
      const [still] = await run(`SELECT status FROM public.invoice_return_refunds WHERE id = $1`, [
        reserved[0]!.r.id,
      ])
      assert.equal(still!.status, 'pending')
    },
  },
  {
    name: 'the books agree: every entry balances, and return + refund leave receivable, cash, tax and sales where they must be',
    run: async (run) => {
      // 1 100 sale (1 000 + 100 tax) paid in cash; then 4 of 10 back, 25% kept, all of the credit paid back.
      // The sale and payment entries are what the invoice and payment cores book; the return entry
      // is the database function's own; the payout is the payment core's rule for money out to a
      // customer (Dr receivable / Cr cash — customer-payout-is-a-refund.test.ts).
      const inv = await seedInvoice(run, { total: 1100, paid: 1100, tax: 100, lines: [[10, 100]] })
      const roles = await run(`SELECT id, role FROM public.accounts WHERE workspace_id = $1`, [WS])
      const id = (role: string) => roles.find((row) => row.role === role)!.id as string
      const cash = (await run(`SELECT gen_random_uuid() AS id`))[0]!.id as string
      await run(`INSERT INTO public.accounts (id, workspace_id, role) VALUES ($1, $2, 'cash')`, [
        cash,
        WS,
      ])
      const post = (lines: Array<{ account_id: string; debit: number; credit: number }>) =>
        run(
          `SELECT public.accounting_post_journal_entry($1::uuid, $2::uuid, '{}'::jsonb, $3::jsonb)`,
          [WS, USER, JSON.stringify(lines)],
        )

      const startingBooks = await ledgerBalances(run)
      await post([
        { account_id: id('receivable'), debit: 1100, credit: 0 },
        { account_id: id('sales'), debit: 0, credit: 1000 },
        { account_id: id('tax'), debit: 0, credit: 100 },
      ])
      await post([
        { account_id: cash, debit: 1100, credit: 0 },
        { account_id: id('receivable'), debit: 0, credit: 1100 },
      ])
      const result = await createReturn(run, inv.id, {
        lines: [{ lineId: inv.lineIds[0]!, quantity: 4 }],
        deductions: [{ reason: 'return_fee', mode: 'percent', percent: 25 }],
      })
      // credit = 400 + 40 tax − 100 kept = 340.00
      assert.equal(Number(result.grandTotalMinor), 34000)
      await post([
        { account_id: id('receivable'), debit: 340, credit: 0 },
        { account_id: cash, debit: 0, credit: 340 },
      ])

      const books = await ledgerBalances(run)
      const since = (role: string) =>
        Math.round(((books[role] ?? 0) - (startingBooks[role] ?? 0)) * 100) / 100
      assert.equal(since('sales'), -700, 'revenue kept: 1000 sold − (400 returned − 100 kept)')
      assert.equal(since('tax'), -60, 'tax still owed: 100 collected − 40 returned')
      assert.equal(since('receivable'), 0, 'the customer owes nothing and is owed nothing')
      assert.equal(since('cash'), 760, 'took 1100, paid 340 back')
    },
  },
]

/** Net balance per account role (debit − credit), in the books currency. */
async function ledgerBalances(run: Run): Promise<Record<string, number>> {
  const entries = await run(`SELECT lines FROM public.test_journal`)
  const accounts = await run(`SELECT id, role FROM public.accounts WHERE workspace_id = $1`, [WS])
  const roleOf = new Map(accounts.map((account) => [account.id as string, account.role as string]))
  const balances: Record<string, number> = {}
  for (const entry of entries) {
    for (const line of entry.lines as Array<{
      account_id: string
      debit: number
      credit: number
    }>) {
      const role = roleOf.get(line.account_id) ?? 'unknown'
      balances[role] =
        Math.round(((balances[role] ?? 0) + Number(line.debit) - Number(line.credit)) * 100) / 100
    }
  }
  return balances
}
