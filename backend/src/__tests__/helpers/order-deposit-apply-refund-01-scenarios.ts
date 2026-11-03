// ============================================
// backend/src/__tests__/helpers/order-deposit-apply-refund-01-scenarios.ts
//
// The order-deposit APPLY / REFUND proofs, written once against the tiny
// `run(text, params)` runner so the SAME scenarios run on PGlite
// (scripts/pg/run-scenarios.mjs) and on a real Postgres (*.pg.test.ts).
//
// WHAT IS REAL HERE
//
//   · docs/order-deposit-apply-refund-01-migration.sql — applied TWICE.
//   · docs/accounting-core-migration.sql — the REAL body of
//     accounting_post_journal_entry, extracted from the file at run time.
//   · docs/phase-f-01-receivables-projection-migration.sql — the REAL bodies of
//     payments_record and invoices_project_settlement, extracted from the file
//     at run time, plus the REAL settlement trigger.
//
// Only the surrounding tables are stand-ins, and they keep the columns those
// functions actually read. Nothing about the financial logic is re-implemented
// in TypeScript: a scenario that "passes" here passed because the SQL in docs/
// did the work.
//
// WHAT PGLITE CANNOT PROVE: it has ONE connection, so two concurrent
// transactions cannot contend for a row lock. The two-connection race lives in
// order-deposit-apply-refund-01.pg.test.ts and is reported separately.
// ============================================

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export type Run = (
  text: string,
  params?: readonly unknown[],
) => Promise<Array<Record<string, unknown>>>
export interface Scenario {
  name: string
  run: (run: Run) => Promise<void>
}

const DOCS = process.env.RETURN05_DOCS ?? join(__dirname, '..', '..', '..', '..', 'docs')
const doc = (name: string) => readFileSync(join(DOCS, name), 'utf8')

/**
 * The function text as the docs define it, from `CREATE OR REPLACE FUNCTION`
 * to its closing dollar quote. Extracted rather than copied, so a change to the
 * real function cannot leave the test proving an older version.
 */
function functionBlock(file: string, name: string): string {
  const text = doc(file)
  let start = text.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`)
  if (start < 0) start = text.indexOf(`CREATE OR REPLACE FUNCTION ${name}(`)
  assert.ok(start >= 0, `${name} not found in ${file}`)

  const tail = text.slice(start)
  const open = /AS \$([A-Za-z_]*)\$/.exec(tail)
  assert.ok(open, `no dollar quote for ${name} in ${file}`)

  const close = `$${open[1]}$;`
  const end = tail.indexOf(close, open.index + open[0].length)
  assert.ok(end >= 0, `unterminated ${name} in ${file}`)

  return tail.slice(0, end + close.length)
}

export const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
export const OTHER_WS = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const C1 = 'c0000000-0000-4000-8000-000000000001'
const C2 = 'c0000000-0000-4000-8000-000000000002'
const C3 = 'c0000000-0000-4000-8000-000000000003'
const USER = 'd0000000-0000-4000-8000-000000000001'
const ORDER = 'e0000000-0000-4000-8000-000000000001'

const ACCOUNTS = {
  [WS]: {
    cash: 'a0000000-0000-4000-8000-000000000101',
    bank: 'a0000000-0000-4000-8000-000000000102',
    receivable: 'a0000000-0000-4000-8000-000000000103',
    advances: 'a0000000-0000-4000-8000-000000000104',
    sales: 'a0000000-0000-4000-8000-000000000105',
  },
  [OTHER_WS]: {
    cash: 'a0000000-0000-4000-8000-000000000201',
    bank: 'a0000000-0000-4000-8000-000000000202',
    receivable: 'a0000000-0000-4000-8000-000000000203',
    advances: 'a0000000-0000-4000-8000-000000000204',
    sales: 'a0000000-0000-4000-8000-000000000205',
  },
} as const

let nextId = 1000
function newId(prefix = 'f'): string {
  nextId += 1
  return `${prefix}0000000-0000-4000-8000-${String(nextId).padStart(12, '0')}`
}

// ---------------------------------------------------------------------------
// The tables the real functions read. Columns, defaults and the amount type
// match docs/payments-ar-ap-migration.sql and docs/base-schema-migration.sql.
// ---------------------------------------------------------------------------

const SCHEMA = `
DO $roles$ BEGIN
  CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL;
END $roles$;
DO $roles$ BEGIN
  CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL;
END $roles$;
DO $roles$ BEGIN
  CREATE ROLE service_role NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL;
END $roles$;

CREATE TABLE IF NOT EXISTS public.accounts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid,
  user_id     uuid,
  code        text NOT NULL,
  name        text NOT NULL,
  type        text NOT NULL,
  role        text,
  is_group    boolean NOT NULL DEFAULT false,
  is_active   boolean NOT NULL DEFAULT true,
  deleted_at  timestamptz
);

CREATE TABLE IF NOT EXISTS public.journal_entries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid,
  user_id      uuid,
  date         date NOT NULL,
  description  text,
  reference    text,
  status       text NOT NULL DEFAULT 'draft',
  entry_number text,
  source_type  text,
  source_id    uuid,
  reversal_of  uuid,
  posted_at    timestamptz,
  posted_by    uuid,
  deleted_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS journal_entries_workspace_number_key
  ON public.journal_entries (workspace_id, entry_number) WHERE entry_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS journal_entries_source_key
  ON public.journal_entries (workspace_id, source_type, source_id)
  WHERE source_id IS NOT NULL AND status <> 'cancelled';

CREATE TABLE IF NOT EXISTS public.journal_lines (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id   uuid NOT NULL,
  workspace_id uuid,
  user_id      uuid,
  account_id   uuid NOT NULL,
  debit        numeric(18, 2) NOT NULL DEFAULT 0,
  credit       numeric(18, 2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.accounting_period_locks (
  workspace_id  uuid PRIMARY KEY,
  locked_until  date
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid,
  invoice_number  text,
  type            text DEFAULT 'sales',
  customer_id     uuid,
  supplier_id     uuid,
  date            timestamptz NOT NULL DEFAULT now(),
  due_date        timestamptz,
  total           numeric(18, 2) NOT NULL DEFAULT 0,
  paid_amount     numeric(18, 2) NOT NULL DEFAULT 0,
  settlement_status text,
  currency        text,
  status          text,
  document_status text,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL,
  payment_number   text,
  direction        text NOT NULL,
  party_type       text NOT NULL,
  party_id         uuid,
  amount           numeric(18, 2) NOT NULL,
  currency         text NOT NULL DEFAULT 'AFN',
  method           text NOT NULL DEFAULT 'cash',
  entry_date       date NOT NULL,
  reference        text NOT NULL DEFAULT '',
  notes            text NOT NULL DEFAULT '',
  status           text NOT NULL DEFAULT 'posted',
  journal_entry_id uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid,
  CONSTRAINT payments_direction_check CHECK (direction IN ('in', 'out')),
  CONSTRAINT payments_party_check CHECK (party_type IN ('customer', 'supplier')),
  CONSTRAINT payments_status_check CHECK (status IN ('draft', 'posted', 'cancelled')),
  CONSTRAINT payments_amount_check CHECK (amount > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS payments_number_key
  ON public.payments (workspace_id, payment_number) WHERE payment_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  payment_id   uuid NOT NULL REFERENCES public.payments (id) ON DELETE CASCADE,
  invoice_id   uuid NOT NULL,
  amount       numeric(18, 2) NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_allocations_amount_check CHECK (amount <> 0)
);

CREATE TABLE IF NOT EXISTS public.order_deposits (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       uuid NOT NULL,
  order_id           uuid NOT NULL,
  customer_id        uuid NOT NULL,
  amount_minor       bigint NOT NULL,
  payment_method     text NOT NULL DEFAULT 'cash',
  applied_invoice_id uuid,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL,
  workspace_id uuid,
  action       text NOT NULL,
  entity_type  text NOT NULL,
  entity_id    uuid,
  old_data     jsonb DEFAULT '{}'::jsonb,
  new_data     jsonb DEFAULT '{}'::jsonb,
  ip_address   text,
  created_at   timestamptz DEFAULT now(),
  user_agent   text
);

CREATE TABLE IF NOT EXISTS public.sod_actions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  entity_type  text NOT NULL,
  entity_id    uuid NOT NULL,
  capability   text NOT NULL,
  actor_id     uuid NOT NULL,
  actor_role   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
`

function ledgerAndPaymentsFunctions(): string {
  const post = functionBlock('accounting-core-migration.sql', 'accounting_post_journal_entry')
  const record = functionBlock('phase-f-01-receivables-projection-migration.sql', 'payments_record')
  const project = functionBlock(
    'phase-f-01-receivables-projection-migration.sql',
    'invoices_project_settlement',
  )
  return `
${post}
${record}
${project}

DROP TRIGGER IF EXISTS invoices_project_settlement_trg ON public.payment_allocations;
CREATE TRIGGER invoices_project_settlement_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.payment_allocations
  FOR EACH ROW EXECUTE FUNCTION invoices_project_settlement();
`
}

/** The four standard accounts a workspace needs for these flows. */
async function seedAccounts(run: Run, workspaceId: string): Promise<void> {
  const ids = ACCOUNTS[workspaceId as keyof typeof ACCOUNTS]
  const rows: Array<[string, string, string, string, string]> = [
    [ids.cash, '1000', 'صندوق', 'asset', 'cash'],
    [ids.bank, '1010', 'بانک', 'asset', 'bank'],
    [ids.receivable, '1200', 'حساب‌های دریافتنی', 'asset', 'receivable'],
    [ids.advances, '2150', 'پیش‌دریافت مشتریان', 'liability', 'customer_advances'],
    [ids.sales, '4000', 'فروش', 'revenue', 'sales'],
  ]
  for (const [id, code, name, type, role] of rows) {
    await run(
      `INSERT INTO public.accounts (id, workspace_id, code, name, type, role)
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`,
      [id, workspaceId, code, name, type, role],
    )
  }
}

export async function setupOrderDepositApplyRefund(run: Run): Promise<void> {
  await run(SCHEMA)
  await run(ledgerAndPaymentsFunctions())

  await seedAccounts(run, WS)
  await seedAccounts(run, OTHER_WS)

  // The REAL migration, twice: the second run must not fail and must not
  // duplicate an index, a constraint or a function.
  await run(doc('order-deposit-apply-refund-01-migration.sql'))
  await run(doc('order-deposit-apply-refund-01-migration.sql'))
}

// ---------------------------------------------------------------------------
// Fixtures — every one is built through the real posting functions, so a
// deposit in these tests is booked the way the service books it.
// ---------------------------------------------------------------------------

const accountId = (
  workspaceId: string,
  role: 'cash' | 'bank' | 'receivable' | 'advances' | 'sales',
) => ACCOUNTS[workspaceId as keyof typeof ACCOUNTS][role]

/** Post an invoice the way InvoiceService does: Dr receivable / Cr sales. */
async function createInvoice(
  run: Run,
  options: {
    workspaceId?: string
    customerId?: string
    total: number
    currency: string | null
    status?: string
    documentStatus?: string | null
    posted?: boolean
  },
): Promise<string> {
  const workspaceId = options.workspaceId ?? WS
  const id = newId('1')
  await run(
    `INSERT INTO public.invoices (id, workspace_id, invoice_number, customer_id, total, currency, status, document_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      id,
      workspaceId,
      `INV-${id.slice(-6)}`,
      options.customerId ?? C1,
      options.total,
      options.currency,
      options.status ?? 'issued',
      options.documentStatus ?? null,
    ],
  )

  if (options.posted !== false) {
    await run(
      `SELECT public.accounting_post_journal_entry(
         $1::uuid, $2::uuid,
         jsonb_build_object('date', CURRENT_DATE, 'description', 'sale', 'status', 'posted',
                            'entry_number', 'JV-' || $3::text, 'source_type', 'invoice',
                            'source_id', $4::text),
         jsonb_build_array(
           jsonb_build_object('account_id', $5::uuid, 'debit', $6::numeric, 'credit', 0),
           jsonb_build_object('account_id', $7::uuid, 'debit', 0, 'credit', $6::numeric)
         )
       )`,
      [
        workspaceId,
        USER,
        id,
        id,
        accountId(workspaceId, 'receivable'),
        options.total,
        accountId(workspaceId, 'sales'),
      ],
    )
  }
  return id
}

/**
 * Record a deposit and book its RECEIPT the way the service does:
 * insert the row, post Dr cash|bank / Cr customer advances, then flip
 * posting_status. `booked: false` and `postingStatus: 'pending_posting'` model
 * the two recoverable states the apply must refuse.
 */
async function createDeposit(
  run: Run,
  options: {
    workspaceId?: string
    customerId?: string
    amountMinor: number
    currency?: string | null
    booked?: boolean
    postingStatus?: string | null
  },
): Promise<string> {
  const workspaceId = options.workspaceId ?? WS
  const id = newId('2')

  await run(
    `INSERT INTO public.order_deposits
       (id, workspace_id, order_id, customer_id, amount_minor, payment_method, currency, posting_status)
     VALUES ($1, $2, $3, $4, $5, 'cash', $6, $7)`,
    [
      id,
      workspaceId,
      ORDER,
      options.customerId ?? C1,
      options.amountMinor,
      options.currency === undefined ? 'AFN' : options.currency,
      options.postingStatus === undefined ? 'posted' : options.postingStatus,
    ],
  )

  if (options.booked !== false) {
    const entryId = await run(
      `SELECT public.accounting_post_journal_entry(
         $1::uuid, $2::uuid,
         jsonb_build_object('date', CURRENT_DATE, 'description', 'receipt', 'status', 'posted',
                            'entry_number', 'JV-' || $3::text, 'source_type', 'order_deposit',
                            'source_id', $4::text),
         jsonb_build_array(
           jsonb_build_object('account_id', $5::uuid, 'debit', $6::numeric, 'credit', 0),
           jsonb_build_object('account_id', $7::uuid, 'debit', 0, 'credit', $6::numeric)
         )
       ) AS id`,
      [
        workspaceId,
        USER,
        `DEP-${id.slice(-6)}`,
        id,
        accountId(workspaceId, 'cash'),
        options.amountMinor,
        accountId(workspaceId, 'advances'),
      ],
    )
    await run(`UPDATE public.order_deposits SET journal_entry_id = $2 WHERE id = $1`, [
      id,
      entryId[0]!.id,
    ])
  }

  return id
}

interface ApplyArgs {
  workspaceId?: string
  depositId: string
  invoiceId: string
  amountMinor: number
  fractionDigits?: number
  key?: string
  advancesAccountId?: string | null
  receivableAccountId?: string | null
}

async function apply(run: Run, args: ApplyArgs): Promise<Record<string, unknown>> {
  const workspaceId = args.workspaceId ?? WS
  const rows = await run(
    `SELECT public.order_deposit_apply(
       $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::bigint, $6::smallint, CURRENT_DATE,
       $7::text, $8::uuid, $9::uuid, 'owner'
     ) AS result`,
    [
      workspaceId,
      USER,
      args.depositId,
      args.invoiceId,
      args.amountMinor,
      args.fractionDigits ?? 0,
      args.key ?? `apply-${newId('k').slice(-8)}`,
      args.advancesAccountId === undefined
        ? accountId(workspaceId, 'advances')
        : args.advancesAccountId,
      args.receivableAccountId === undefined
        ? accountId(workspaceId, 'receivable')
        : args.receivableAccountId,
    ],
  )
  return rows[0]!.result as Record<string, unknown>
}

interface RefundArgs {
  workspaceId?: string
  depositId: string
  amountMinor: number
  fractionDigits?: number
  key?: string
  method?: string
  /** `null` deliberately omits it, to prove the database refuses. */
  reason?: string | null
  advancesAccountId?: string | null
  moneyAccountId?: string | null
}

const DEFAULT_REFUND_REASON = 'customer changed the order'

async function refund(run: Run, args: RefundArgs): Promise<Record<string, unknown>> {
  const workspaceId = args.workspaceId ?? WS
  const rows = await run(
    `SELECT public.order_deposit_refund(
       $1::uuid, $2::uuid, $3::uuid, $4::bigint, $5::smallint, CURRENT_DATE, $6::text,
       $7::text, $8::text, $9::uuid, $10::uuid, 'owner'
     ) AS result`,
    [
      workspaceId,
      USER,
      args.depositId,
      args.amountMinor,
      args.fractionDigits ?? 0,
      args.method ?? 'cash',
      args.reason === undefined ? DEFAULT_REFUND_REASON : args.reason,
      args.key ?? `refund-${newId('k').slice(-8)}`,
      args.advancesAccountId === undefined
        ? accountId(workspaceId, 'advances')
        : args.advancesAccountId,
      args.moneyAccountId === undefined ? accountId(workspaceId, 'cash') : args.moneyAccountId,
    ],
  )
  return rows[0]!.result as Record<string, unknown>
}

async function balance(run: Run, depositId: string, workspaceId = WS) {
  const rows = await run(`SELECT public.order_deposit_balance($1::uuid, $2::uuid) AS b`, [
    workspaceId,
    depositId,
  ])
  return rows[0]!.b as Record<string, unknown>
}

async function count(run: Run, sql: string, params: readonly unknown[] = []): Promise<number> {
  const rows = await run(sql, params)
  return Number(rows[0]!.n)
}

/** Nothing at all was written for this deposit beyond the receipt itself. */
async function assertNothingWritten(run: Run, depositId: string): Promise<void> {
  assert.equal(
    await count(
      run,
      `SELECT count(*)::int AS n FROM public.order_deposit_applications WHERE deposit_id = $1`,
      [depositId],
    ),
    0,
    'no application row may survive a failed apply',
  )
  assert.equal(
    await count(
      run,
      `SELECT count(*)::int AS n FROM public.order_deposit_refunds WHERE deposit_id = $1`,
      [depositId],
    ),
    0,
    'no refund row may survive a failed refund',
  )
  assert.equal(
    await count(
      run,
      `SELECT count(*)::int AS n FROM public.payment_allocations pa
         JOIN public.payments p ON p.id = pa.payment_id
        WHERE p.reference = 'DEPOSIT:' || $1::text`,
      [depositId],
    ),
    0,
    'no allocation may survive a failed apply',
  )
}

const expectError = (fn: () => Promise<unknown>, code: string) =>
  assert.rejects(fn, (error: Error) => {
    assert.ok(String(error.message).includes(code), `expected ${code}, got: ${error.message}`)
    return true
  })

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

export const scenarios: Scenario[] = [
  // ── apply ────────────────────────────────────────────────────────────────
  {
    name: 'the migration ran twice: three functions, two tables, one of each index',
    async run(run) {
      assert.equal(
        await count(
          run,
          `SELECT count(*)::int AS n FROM pg_proc
            WHERE pronamespace = 'public'::regnamespace
              AND proname IN ('order_deposit_balance','order_deposit_apply','order_deposit_refund')`,
        ),
        3,
      )
      assert.equal(
        await count(
          run,
          `SELECT count(*)::int AS n FROM pg_indexes
            WHERE schemaname = 'public'
              AND indexname IN ('order_deposit_applications_idem_key',
                                'order_deposit_applications_payment_key',
                                'order_deposit_refunds_idem_key',
                                'order_deposit_refunds_payment_key')`,
        ),
        4,
      )
      assert.equal(
        await count(
          run,
          `SELECT count(*)::int AS n FROM pg_constraint c
             JOIN pg_class t ON t.oid = c.conrelid
            WHERE t.relname = 'order_deposits'
              AND c.conname = 'order_deposits_posting_status_check'`,
        ),
        1,
      )
    },
  },
  {
    name: 'AFN (0 decimals): a full apply settles the invoice and leaves no balance',
    async run(run) {
      const invoiceId = await createInvoice(run, { total: 150_000, currency: 'AFN' })
      const depositId = await createDeposit(run, { amountMinor: 150_000, currency: 'AFN' })

      const result = await apply(run, {
        depositId,
        invoiceId,
        amountMinor: 150_000,
        fractionDigits: 0,
      })

      assert.equal(result.replayed, false)
      assert.equal(result.amount_minor, 150_000)
      assert.equal(result.currency, 'AFN')

      // The ledger: Dr customer advances / Cr receivable, both 150000 (AFN has
      // no minor unit to divide by), in ONE posted entry.
      const lines = await run(
        `SELECT a.role, l.debit::text AS debit, l.credit::text AS credit
           FROM public.journal_lines l
           JOIN public.accounts a ON a.id = l.account_id
          WHERE l.journal_id = $1::uuid
          ORDER BY a.role`,
        [result.journal_entry_id],
      )
      assert.equal(lines.length, 2)
      const byRole = Object.fromEntries(lines.map((l) => [l.role, l]))
      assert.equal(byRole.customer_advances!.debit, '150000.00')
      assert.equal(byRole.customer_advances!.credit, '0.00')
      assert.equal(byRole.receivable!.credit, '150000.00')

      // The settlement: a real payment + allocation, and the invoice says paid.
      const settlement = await run(
        `SELECT p.direction, p.method, p.amount::text AS amount, p.currency,
                i.paid_amount::text AS paid, i.settlement_status
           FROM public.payments p
           JOIN public.payment_allocations pa ON pa.payment_id = p.id
           JOIN public.invoices i ON i.id = pa.invoice_id
          WHERE p.id = $1::uuid`,
        [result.payment_id],
      )
      assert.equal(settlement[0]!.direction, 'in')
      assert.equal(settlement[0]!.method, 'order_deposit')
      assert.equal(settlement[0]!.amount, '150000.00')
      assert.equal(settlement[0]!.paid, '150000.00')
      assert.equal(settlement[0]!.settlement_status, 'paid')

      const b = await balance(run, depositId)
      assert.equal(Number(b.remaining_minor), 0)
      assert.equal(Number(b.applied_minor), 150_000)
    },
  },
  {
    name: 'USD (2 decimals): 12345 minor units apply as 123.45, never 12345',
    async run(run) {
      const invoiceId = await createInvoice(run, { total: 200, currency: 'USD' })
      const depositId = await createDeposit(run, { amountMinor: 12_345, currency: 'USD' })

      const result = await apply(run, {
        depositId,
        invoiceId,
        amountMinor: 12_345,
        fractionDigits: 2,
      })

      const lines = await run(
        `SELECT a.role, l.debit::text AS debit, l.credit::text AS credit
           FROM public.journal_lines l JOIN public.accounts a ON a.id = l.account_id
          WHERE l.journal_id = $1::uuid AND a.role = 'customer_advances'`,
        [result.journal_entry_id],
      )
      assert.equal(lines[0]!.debit, '123.45')

      const paid = await run(
        `SELECT paid_amount::text AS paid FROM public.invoices WHERE id = $1`,
        [invoiceId],
      )
      assert.equal(paid[0]!.paid, '123.45')

      const b = await balance(run, depositId)
      assert.equal(Number(b.remaining_minor), 0)
    },
  },
  {
    name: 'a partial apply leaves the unused part as Customer Advance',
    async run(run) {
      const invoiceId = await createInvoice(run, { total: 60_000, currency: 'AFN' })
      const depositId = await createDeposit(run, { amountMinor: 100_000, currency: 'AFN' })

      await apply(run, { depositId, invoiceId, amountMinor: 40_000, fractionDigits: 0 })

      const b = await balance(run, depositId)
      assert.equal(Number(b.applied_minor), 40_000)
      assert.equal(Number(b.remaining_minor), 60_000)

      const invoice = await run(
        `SELECT paid_amount::text AS paid, settlement_status FROM public.invoices WHERE id = $1`,
        [invoiceId],
      )
      assert.equal(invoice[0]!.paid, '40000.00')
      assert.equal(invoice[0]!.settlement_status, 'partially_paid')
    },
  },
  {
    name: 'an apply beyond what the deposit still holds is refused and writes nothing',
    async run(run) {
      const invoiceId = await createInvoice(run, { total: 500_000, currency: 'AFN' })
      const depositId = await createDeposit(run, { amountMinor: 100_000, currency: 'AFN' })

      await expectError(
        () => apply(run, { depositId, invoiceId, amountMinor: 100_001, fractionDigits: 0 }),
        'DEPOSIT_INSUFFICIENT_BALANCE',
      )
      await assertNothingWritten(run, depositId)
      const b = await balance(run, depositId)
      assert.equal(Number(b.remaining_minor), 100_000)
    },
  },
  {
    name: 'a second apply cannot spend the part already applied',
    async run(run) {
      const invoiceA = await createInvoice(run, { total: 100_000, currency: 'AFN' })
      const invoiceB = await createInvoice(run, { total: 100_000, currency: 'AFN' })
      const depositId = await createDeposit(run, { amountMinor: 100_000, currency: 'AFN' })

      await apply(run, { depositId, invoiceId: invoiceA, amountMinor: 60_000, fractionDigits: 0 })
      await expectError(
        () =>
          apply(run, { depositId, invoiceId: invoiceB, amountMinor: 60_000, fractionDigits: 0 }),
        'DEPOSIT_INSUFFICIENT_BALANCE',
      )

      const b = await balance(run, depositId)
      assert.equal(Number(b.applied_minor), 60_000)
      assert.equal(Number(b.remaining_minor), 40_000)
      assert.equal(
        await count(
          run,
          `SELECT count(*)::int AS n FROM public.order_deposit_applications WHERE deposit_id = $1`,
          [depositId],
        ),
        1,
      )
    },
  },
  {
    name: 'an apply beyond what the invoice still owes is refused, not over-settled',
    async run(run) {
      const invoiceId = await createInvoice(run, { total: 30_000, currency: 'AFN' })
      const depositId = await createDeposit(run, { amountMinor: 100_000, currency: 'AFN' })

      await expectError(
        () => apply(run, { depositId, invoiceId, amountMinor: 40_000, fractionDigits: 0 }),
        'DEPOSIT_APPLY_EXCEEDS_INVOICE',
      )
      await assertNothingWritten(run, depositId)
    },
  },
  {
    name: "an apply to another customer's invoice is refused",
    async run(run) {
      const invoice = await createInvoice(run, { customerId: C2, total: 50_000, currency: 'AFN' })
      const depositId = await createDeposit(run, { customerId: C1, amountMinor: 50_000 })

      await expectError(
        () => apply(run, { depositId, invoiceId: invoice, amountMinor: 50_000, fractionDigits: 0 }),
        'DEPOSIT_CUSTOMER_MISMATCH',
      )
      await assertNothingWritten(run, depositId)
    },
  },
  {
    name: 'an invoice in ANOTHER workspace is invisible: DEPOSIT_INVOICE_NOT_FOUND, nothing leaks',
    async run(run) {
      const foreignInvoice = await createInvoice(run, {
        workspaceId: OTHER_WS,
        customerId: C3,
        total: 50_000,
        currency: 'AFN',
      })
      const depositId = await createDeposit(run, { amountMinor: 50_000, currency: 'AFN' })

      await expectError(
        () =>
          apply(run, {
            depositId,
            invoiceId: foreignInvoice,
            amountMinor: 50_000,
            fractionDigits: 0,
          }),
        'DEPOSIT_INVOICE_NOT_FOUND',
      )
      await assertNothingWritten(run, depositId)
    },
  },
  {
    name: 'a deposit from ANOTHER workspace cannot be applied from this one',
    async run(run) {
      const invoiceId = await createInvoice(run, { total: 50_000, currency: 'AFN' })
      const foreignDeposit = await createDeposit(run, {
        workspaceId: OTHER_WS,
        customerId: C3,
        amountMinor: 50_000,
      })

      await expectError(
        () =>
          apply(run, {
            depositId: foreignDeposit,
            invoiceId,
            amountMinor: 50_000,
            fractionDigits: 0,
          }),
        'DEPOSIT_NOT_FOUND',
      )
    },
  },
  {
    name: 'a draft invoice is not final: DEPOSIT_INVOICE_NOT_FINAL',
    async run(run) {
      const invoiceId = await createInvoice(run, {
        total: 50_000,
        currency: 'AFN',
        status: 'draft',
      })
      const depositId = await createDeposit(run, { amountMinor: 50_000, currency: 'AFN' })

      await expectError(
        () => apply(run, { depositId, invoiceId, amountMinor: 50_000, fractionDigits: 0 }),
        'DEPOSIT_INVOICE_NOT_FINAL',
      )
      await assertNothingWritten(run, depositId)
    },
  },
  {
    name: 'a cancelled invoice (document_status) is not final even when status looks settled',
    async run(run) {
      const invoiceId = await createInvoice(run, {
        total: 50_000,
        currency: 'AFN',
        status: 'paid',
        documentStatus: 'cancelled',
      })
      const depositId = await createDeposit(run, { amountMinor: 50_000, currency: 'AFN' })

      await expectError(
        () => apply(run, { depositId, invoiceId, amountMinor: 50_000, fractionDigits: 0 }),
        'DEPOSIT_INVOICE_NOT_FINAL',
      )
    },
  },
  {
    name: 'a final invoice whose posting was skipped has no receivable to credit: DEPOSIT_INVOICE_NOT_POSTED',
    async run(run) {
      const invoiceId = await createInvoice(run, {
        total: 50_000,
        currency: 'AFN',
        posted: false,
      })
      const depositId = await createDeposit(run, { amountMinor: 50_000, currency: 'AFN' })

      await expectError(
        () => apply(run, { depositId, invoiceId, amountMinor: 50_000, fractionDigits: 0 }),
        'DEPOSIT_INVOICE_NOT_POSTED',
      )
      await assertNothingWritten(run, depositId)
    },
  },
  {
    name: 'an invoice in another currency is refused rather than treated as 1:1',
    async run(run) {
      const invoiceId = await createInvoice(run, { total: 100, currency: 'USD' })
      const depositId = await createDeposit(run, { amountMinor: 100, currency: 'AFN' })

      await expectError(
        () => apply(run, { depositId, invoiceId, amountMinor: 100, fractionDigits: 0 }),
        'DEPOSIT_CURRENCY_MISMATCH',
      )
    },
  },
  {
    name: 'an invoice with NO currency is UNKNOWN, not assumed: DEPOSIT_CURRENCY_MISMATCH',
    async run(run) {
      const invoiceId = await createInvoice(run, { total: 100, currency: null })
      const depositId = await createDeposit(run, { amountMinor: 100, currency: 'AFN' })

      await expectError(
        () => apply(run, { depositId, invoiceId, amountMinor: 100, fractionDigits: 0 }),
        'DEPOSIT_CURRENCY_MISMATCH',
      )
    },
  },
  {
    name: 'a deposit whose receipt never posted is refused (DEPOSIT_NOT_BOOKED)',
    async run(run) {
      const invoiceId = await createInvoice(run, { total: 50_000, currency: 'AFN' })
      const depositId = await createDeposit(run, {
        amountMinor: 50_000,
        currency: 'AFN',
        booked: false,
      })

      await expectError(
        () => apply(run, { depositId, invoiceId, amountMinor: 50_000, fractionDigits: 0 }),
        'DEPOSIT_NOT_BOOKED',
      )
    },
  },
  {
    name: 'a deposit recorded while the chart could not express the entry says PENDING_POSTING, not success',
    async run(run) {
      const invoiceId = await createInvoice(run, { total: 50_000, currency: 'AFN' })
      const depositId = await createDeposit(run, {
        amountMinor: 50_000,
        currency: 'AFN',
        booked: false,
        postingStatus: 'pending_posting',
      })

      await expectError(
        () => apply(run, { depositId, invoiceId, amountMinor: 50_000, fractionDigits: 0 }),
        'DEPOSIT_PENDING_POSTING',
      )

      // The state is explicit and recoverable: re-posting the receipt and
      // flipping the flag makes the same deposit applicable.
      await run(
        `SELECT public.accounting_post_journal_entry(
           $1::uuid, $2::uuid,
           jsonb_build_object('date', CURRENT_DATE, 'description', 'recovery', 'status', 'posted',
                              'entry_number', 'JV-' || $3::text, 'source_type', 'order_deposit',
                              'source_id', $4::text),
           jsonb_build_array(
             jsonb_build_object('account_id', $5::uuid, 'debit', 50000, 'credit', 0),
             jsonb_build_object('account_id', $6::uuid, 'debit', 0, 'credit', 50000)
           )
         )`,
        [
          WS,
          USER,
          `REC-${depositId.slice(-6)}`,
          depositId,
          accountId(WS, 'cash'),
          accountId(WS, 'advances'),
        ],
      )
      await run(`UPDATE public.order_deposits SET posting_status = 'posted' WHERE id = $1`, [
        depositId,
      ])
      const ok = await apply(run, {
        depositId,
        invoiceId,
        amountMinor: 50_000,
        fractionDigits: 0,
      })
      assert.equal(ok.replayed, false)
    },
  },
  {
    name: 'a historical deposit with NULL currency is unknown, never guessed',
    async run(run) {
      const invoiceId = await createInvoice(run, { total: 50_000, currency: 'AFN' })
      const depositId = await createDeposit(run, {
        amountMinor: 50_000,
        currency: null,
        postingStatus: null,
      })

      await expectError(
        () => apply(run, { depositId, invoiceId, amountMinor: 50_000, fractionDigits: 0 }),
        'DEPOSIT_CURRENCY_UNKNOWN',
      )
    },
  },
  {
    name: 'a currency precision the ledger cannot store is refused, never rounded',
    async run(run) {
      const invoiceId = await createInvoice(run, { total: 500, currency: 'KWD' })
      const depositId = await createDeposit(run, { amountMinor: 12_345, currency: 'KWD' })

      await expectError(
        () => apply(run, { depositId, invoiceId, amountMinor: 12_345, fractionDigits: 3 }),
        'DEPOSIT_CURRENCY_PRECISION_UNSUPPORTED',
      )
      await assertNothingWritten(run, depositId)
    },
  },
  {
    name: 'missing ledger accounts are named, not silently skipped',
    async run(run) {
      const invoiceId = await createInvoice(run, { total: 50_000, currency: 'AFN' })
      const depositId = await createDeposit(run, { amountMinor: 50_000, currency: 'AFN' })

      await expectError(
        () =>
          apply(run, {
            depositId,
            invoiceId,
            amountMinor: 50_000,
            fractionDigits: 0,
            advancesAccountId: null,
          }),
        'DEPOSIT_ACCOUNTS_MISSING',
      )
      await assertNothingWritten(run, depositId)
    },
  },
  {
    name: 'a failure after the payment was written rolls the payment back too (no orphan)',
    async run(run) {
      const invoiceId = await createInvoice(run, { total: 50_000, currency: 'AFN' })
      const depositId = await createDeposit(run, { amountMinor: 50_000, currency: 'AFN' })

      // payments_record succeeds, then the journal posting fails because the
      // receivable account belongs to ANOTHER workspace. If the two statements
      // were not one transaction, a payment would be left behind with no entry
      // and no application.
      await expectError(
        () =>
          apply(run, {
            depositId,
            invoiceId,
            amountMinor: 50_000,
            fractionDigits: 0,
            receivableAccountId: accountId(OTHER_WS, 'receivable'),
          }),
        'JOURNAL_LINE_ACCOUNT_INVALID',
      )

      await assertNothingWritten(run, depositId)
      assert.equal(
        await count(
          run,
          `SELECT count(*)::int AS n FROM public.payments WHERE reference = 'DEPOSIT:' || $1::text`,
          [depositId],
        ),
        0,
        'the payment must roll back with the entry',
      )
      const b = await balance(run, depositId)
      assert.equal(Number(b.remaining_minor), 50_000)
    },
  },
  {
    name: 'a duplicate journal entry for the same payment is refused by the database',
    async run(run) {
      const invoiceId = await createInvoice(run, { total: 50_000, currency: 'AFN' })
      const depositId = await createDeposit(run, { amountMinor: 50_000, currency: 'AFN' })
      const result = await apply(run, {
        depositId,
        invoiceId,
        amountMinor: 50_000,
        fractionDigits: 0,
      })

      await expectError(
        () =>
          run(
            `SELECT public.accounting_post_journal_entry(
               $1::uuid, $2::uuid,
               jsonb_build_object('date', CURRENT_DATE, 'description', 'double', 'status', 'posted',
                                  'entry_number', 'JV-DUP-' || $3::text, 'source_type', 'payment',
                                  'source_id', $4::text),
               jsonb_build_array(
                 jsonb_build_object('account_id', $5::uuid, 'debit', 50000, 'credit', 0),
                 jsonb_build_object('account_id', $6::uuid, 'debit', 0, 'credit', 50000)
               )
             )`,
            [
              WS,
              USER,
              depositId.slice(-6),
              result.payment_id,
              accountId(WS, 'advances'),
              accountId(WS, 'receivable'),
            ],
          ),
        'journal_entries_source_key',
      )
    },
  },
  {
    name: 'the same idempotency key replays the first result and posts nothing twice',
    async run(run) {
      const invoiceId = await createInvoice(run, { total: 50_000, currency: 'AFN' })
      const depositId = await createDeposit(run, { amountMinor: 50_000, currency: 'AFN' })
      const key = 'idem-key-apply-0001'

      const first = await apply(run, {
        depositId,
        invoiceId,
        amountMinor: 50_000,
        fractionDigits: 0,
        key,
      })
      const second = await apply(run, {
        depositId,
        invoiceId,
        amountMinor: 50_000,
        fractionDigits: 0,
        key,
      })

      assert.equal(first.replayed, false)
      assert.equal(second.replayed, true)
      assert.equal(second.application_id, first.application_id)
      assert.equal(second.payment_id, first.payment_id)
      assert.equal(
        await count(
          run,
          `SELECT count(*)::int AS n FROM public.order_deposit_applications WHERE deposit_id = $1`,
          [depositId],
        ),
        1,
      )
      assert.equal(
        await count(
          run,
          `SELECT count(*)::int AS n FROM public.payments WHERE reference = 'DEPOSIT:' || $1::text`,
          [depositId],
        ),
        1,
      )
      assert.equal(
        await count(
          run,
          `SELECT count(*)::int AS n FROM public.journal_entries
            WHERE source_type = 'payment' AND source_id = $1::uuid`,
          [first.payment_id],
        ),
        1,
      )
    },
  },
  {
    name: 'the same key reused for a DIFFERENT request is a conflict, not a replay',
    async run(run) {
      const invoiceId = await createInvoice(run, { total: 100_000, currency: 'AFN' })
      const depositId = await createDeposit(run, { amountMinor: 100_000, currency: 'AFN' })
      const key = 'idem-key-conflict-1'

      await apply(run, { depositId, invoiceId, amountMinor: 10_000, fractionDigits: 0, key })
      await expectError(
        () => apply(run, { depositId, invoiceId, amountMinor: 20_000, fractionDigits: 0, key }),
        'DEPOSIT_IDEMPOTENCY_CONFLICT',
      )
    },
  },

  // ── refund ───────────────────────────────────────────────────────────────
  {
    name: 'a full refund returns the money: Dr customer advances / Cr cash',
    async run(run) {
      const depositId = await createDeposit(run, { amountMinor: 80_000, currency: 'AFN' })

      const result = await refund(run, {
        depositId,
        amountMinor: 80_000,
        fractionDigits: 0,
      })

      assert.equal(result.replayed, false)
      const lines = await run(
        `SELECT a.role, l.debit::text AS debit, l.credit::text AS credit
           FROM public.journal_lines l JOIN public.accounts a ON a.id = l.account_id
          WHERE l.journal_id = $1::uuid`,
        [result.journal_entry_id],
      )
      const byRole = Object.fromEntries(lines.map((l) => [l.role, l]))
      assert.equal(byRole.customer_advances!.debit, '80000.00')
      assert.equal(byRole.cash!.credit, '80000.00')

      const payment = await run(
        `SELECT direction, method, amount::text AS amount FROM public.payments WHERE id = $1::uuid`,
        [result.payment_id],
      )
      assert.equal(payment[0]!.direction, 'out')
      assert.equal(payment[0]!.amount, '80000.00')
      assert.equal(
        await count(
          run,
          `SELECT count(*)::int AS n FROM public.payment_allocations WHERE payment_id = $1::uuid`,
          [result.payment_id],
        ),
        0,
        'a refund settles no invoice',
      )

      const b = await balance(run, depositId)
      assert.equal(Number(b.refunded_minor), 80_000)
      assert.equal(Number(b.remaining_minor), 0)
    },
  },
  {
    name: 'a partial refund leaves the rest available for an apply (one balance, two uses)',
    async run(run) {
      const invoiceId = await createInvoice(run, { total: 100_000, currency: 'AFN' })
      const depositId = await createDeposit(run, { amountMinor: 100_000, currency: 'AFN' })

      await refund(run, { depositId, amountMinor: 30_000, fractionDigits: 0 })
      await apply(run, { depositId, invoiceId, amountMinor: 50_000, fractionDigits: 0 })

      const b = await balance(run, depositId)
      assert.equal(Number(b.refunded_minor), 30_000)
      assert.equal(Number(b.applied_minor), 50_000)
      assert.equal(Number(b.remaining_minor), 20_000)
    },
  },
  {
    name: 'refund + apply cannot exceed what was received',
    async run(run) {
      const invoiceId = await createInvoice(run, { total: 100_000, currency: 'AFN' })
      const depositId = await createDeposit(run, { amountMinor: 100_000, currency: 'AFN' })

      await apply(run, { depositId, invoiceId, amountMinor: 60_000, fractionDigits: 0 })
      await expectError(
        () => refund(run, { depositId, amountMinor: 50_000, fractionDigits: 0 }),
        'DEPOSIT_INSUFFICIENT_BALANCE',
      )
      await refund(run, { depositId, amountMinor: 40_000, fractionDigits: 0 })

      const b = await balance(run, depositId)
      assert.equal(Number(b.remaining_minor), 0)
      assert.equal(Number(b.applied_minor) + Number(b.refunded_minor), 100_000)
    },
  },
  {
    name: 'a refund of an unbooked deposit is refused',
    async run(run) {
      const depositId = await createDeposit(run, {
        amountMinor: 50_000,
        booked: false,
        postingStatus: 'pending_posting',
      })
      await expectError(
        () => refund(run, { depositId, amountMinor: 50_000, fractionDigits: 0 }),
        'DEPOSIT_PENDING_POSTING',
      )
    },
  },
  {
    name: 'a refund key replays instead of paying the customer twice',
    async run(run) {
      const depositId = await createDeposit(run, { amountMinor: 50_000, currency: 'AFN' })
      const key = 'idem-key-refund-0001'

      const first = await refund(run, { depositId, amountMinor: 20_000, fractionDigits: 0, key })
      const second = await refund(run, { depositId, amountMinor: 20_000, fractionDigits: 0, key })
      assert.equal(second.replayed, true)
      assert.equal(second.refund_id, first.refund_id)
      assert.equal(Number((await balance(run, depositId)).refunded_minor), 20_000)
    },
  },
  {
    name: 'a refund that fails after the payment is written rolls the payment back too',
    async run(run) {
      const depositId = await createDeposit(run, { amountMinor: 50_000, currency: 'AFN' })
      await expectError(
        () =>
          refund(run, {
            depositId,
            amountMinor: 50_000,
            fractionDigits: 0,
            moneyAccountId: accountId(OTHER_WS, 'cash'),
          }),
        'JOURNAL_LINE_ACCOUNT_INVALID',
      )
      await assertNothingWritten(run, depositId)
      assert.equal(
        await count(
          run,
          `SELECT count(*)::int AS n FROM public.payments WHERE reference = 'DEPOSIT-REFUND:' || $1::text`,
          [depositId],
        ),
        0,
      )
      assert.equal(Number((await balance(run, depositId)).remaining_minor), 50_000)
    },
  },

  {
    name: 'a refund with no reason is refused and writes nothing',
    async run(run) {
      const depositId = await createDeposit(run, { amountMinor: 50_000, currency: 'AFN' })
      await expectError(
        () => refund(run, { depositId, amountMinor: 50_000, fractionDigits: 0, reason: null }),
        'DEPOSIT_REFUND_REASON_REQUIRED',
      )
      await assertNothingWritten(run, depositId)
      assert.equal(Number((await balance(run, depositId)).remaining_minor), 50_000)
    },
  },
  {
    name: 'a blank or one-word reason is refused: «no» is not an explanation',
    async run(run) {
      const depositId = await createDeposit(run, { amountMinor: 50_000, currency: 'AFN' })
      await expectError(
        () => refund(run, { depositId, amountMinor: 10_000, fractionDigits: 0, reason: '   ' }),
        'DEPOSIT_REFUND_REASON_REQUIRED',
      )
      await expectError(
        () => refund(run, { depositId, amountMinor: 10_000, fractionDigits: 0, reason: 'no' }),
        'DEPOSIT_REFUND_REASON_REQUIRED',
      )
      await assertNothingWritten(run, depositId)
    },
  },
  {
    name: 'a reason longer than 500 characters is refused, not truncated',
    async run(run) {
      const depositId = await createDeposit(run, { amountMinor: 50_000, currency: 'AFN' })
      await expectError(
        () =>
          refund(run, {
            depositId,
            amountMinor: 10_000,
            fractionDigits: 0,
            reason: 'x'.repeat(501),
          }),
        'DEPOSIT_REFUND_REASON_TOO_LONG',
      )
      await assertNothingWritten(run, depositId)
    },
  },
  {
    name: 'the reason cannot be bypassed through the old 11-argument signature',
    async run(run) {
      const signatures = await run(
        `SELECT pg_get_function_identity_arguments(p.oid) AS args
           FROM pg_proc p
          WHERE p.pronamespace = 'public'::regnamespace
            AND p.proname = 'order_deposit_refund'`,
      )
      assert.equal(signatures.length, 1, 'exactly one refund function may exist')
      assert.ok(
        String(signatures[0]!.args).includes('reason'),
        'the only refund signature carries a reason',
      )
    },
  },
  {
    name: 'the audit trail names the actor, amount, currency, reason, deposit, payment and entry',
    async run(run) {
      const depositId = await createDeposit(run, { amountMinor: 40_000, currency: 'USD' })
      const result = await refund(run, {
        depositId,
        amountMinor: 12_345,
        fractionDigits: 2,
        reason: 'customer returned the goods',
      })

      const audit = await run(
        `SELECT workspace_id, user_id, action, entity_type, new_data
           FROM public.audit_logs
          WHERE entity_type = 'order_deposit' AND entity_id = $1::uuid`,
        [depositId],
      )
      assert.equal(audit.length, 1)
      assert.equal(audit[0]!.user_id, USER)
      assert.equal(audit[0]!.workspace_id, WS)
      const data = audit[0]!.new_data as Record<string, unknown>
      assert.equal(data.event, 'order_deposit_refunded')
      assert.equal(data.reason, 'customer returned the goods')
      assert.equal(data.actor_id, USER)
      assert.ok(typeof data.occurred_at === 'string' && data.occurred_at.length > 0)
      assert.equal(data.amount_minor, 12_345)
      assert.equal(data.currency, 'USD')
      assert.equal(data.deposit_id, depositId)
      assert.equal(data.payment_id, result.payment_id)
      assert.equal(data.journal_entry_id, result.journal_entry_id)

      // The row itself carries it too, not only the log.
      const row = await run(
        `SELECT reason, amount_minor, currency
           FROM public.order_deposit_refunds WHERE id = $1::uuid`,
        [result.refund_id],
      )
      assert.equal(row[0]!.reason, 'customer returned the goods')
      assert.equal(row[0]!.currency, 'USD')
    },
  },
  {
    name: 'the same key with a DIFFERENT reason is a conflict, not a replay',
    async run(run) {
      const depositId = await createDeposit(run, { amountMinor: 50_000, currency: 'AFN' })
      const key = 'idem-key-refund-reason-1'
      await refund(run, {
        depositId,
        amountMinor: 20_000,
        fractionDigits: 0,
        key,
        reason: 'customer changed the order',
      })
      await expectError(
        () =>
          refund(run, {
            depositId,
            amountMinor: 20_000,
            fractionDigits: 0,
            key,
            reason: 'wrong size',
          }),
        'DEPOSIT_IDEMPOTENCY_CONFLICT',
      )
      assert.equal(Number((await balance(run, depositId)).refunded_minor), 20_000)
    },
  },

  // ── the settlement stays one truth ────────────────────────────────────────
  {
    name: 'cancelling the apply payment reopens the invoice and gives the deposit back',
    async run(run) {
      const invoiceId = await createInvoice(run, { total: 50_000, currency: 'AFN' })
      const depositId = await createDeposit(run, { amountMinor: 50_000, currency: 'AFN' })
      const result = await apply(run, {
        depositId,
        invoiceId,
        amountMinor: 50_000,
        fractionDigits: 0,
      })

      // The existing payments path: allocations deleted, payment cancelled.
      await run(`DELETE FROM public.payment_allocations WHERE payment_id = $1::uuid`, [
        result.payment_id,
      ])
      await run(`UPDATE public.payments SET status = 'cancelled' WHERE id = $1::uuid`, [
        result.payment_id,
      ])

      const b = await balance(run, depositId)
      assert.equal(Number(b.applied_minor), 0)
      assert.equal(Number(b.remaining_minor), 50_000)

      const invoice = await run(
        `SELECT paid_amount::text AS paid, settlement_status FROM public.invoices WHERE id = $1`,
        [invoiceId],
      )
      assert.equal(invoice[0]!.paid, '0.00')
      assert.equal(invoice[0]!.settlement_status, 'unpaid')
    },
  },
  {
    name: 'the audit trail records the amount, the invoice, the payment and the entry',
    async run(run) {
      const invoiceId = await createInvoice(run, { total: 50_000, currency: 'AFN' })
      const depositId = await createDeposit(run, { amountMinor: 50_000, currency: 'AFN' })
      const result = await apply(run, {
        depositId,
        invoiceId,
        amountMinor: 50_000,
        fractionDigits: 0,
      })

      const audit = await run(
        `SELECT workspace_id, action, entity_type, new_data
           FROM public.audit_logs
          WHERE entity_type = 'order_deposit' AND entity_id = $1::uuid`,
        [depositId],
      )
      assert.equal(audit.length, 1)
      assert.equal(audit[0]!.workspace_id, WS)
      assert.equal(audit[0]!.action, 'update')
      const data = audit[0]!.new_data as Record<string, unknown>
      assert.equal(data.event, 'order_deposit_applied')
      assert.equal(data.invoice_id, invoiceId)
      assert.equal(data.payment_id, result.payment_id)
      assert.equal(data.journal_entry_id, result.journal_entry_id)
    },
  },
  {
    name: 'the deposit row is not deleted or rewritten: only applied_invoice_id is filled once',
    async run(run) {
      const invoiceA = await createInvoice(run, { total: 40_000, currency: 'AFN' })
      const invoiceB = await createInvoice(run, { total: 40_000, currency: 'AFN' })
      const depositId = await createDeposit(run, { amountMinor: 100_000, currency: 'AFN' })

      await apply(run, { depositId, invoiceId: invoiceA, amountMinor: 40_000, fractionDigits: 0 })
      await apply(run, { depositId, invoiceId: invoiceB, amountMinor: 40_000, fractionDigits: 0 })

      const row = await run(
        `SELECT amount_minor, applied_invoice_id, currency, posting_status
           FROM public.order_deposits WHERE id = $1`,
        [depositId],
      )
      assert.equal(Number(row[0]!.amount_minor), 100_000)
      assert.equal(row[0]!.applied_invoice_id, invoiceA, 'the first application is kept')
      assert.equal(row[0]!.currency, 'AFN')
      assert.equal(row[0]!.posting_status, 'posted')
    },
  },
]

// The two-connection race lives in the pg test, which needs the same fixtures.
export {
  apply as applyDeposit,
  refund as refundDeposit,
  balance as depositBalance,
  createDeposit,
  createInvoice,
  accountId,
  USER,
  C1,
}
