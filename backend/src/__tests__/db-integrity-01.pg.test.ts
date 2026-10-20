// ============================================
// docs/db-integrity-01-migration.sql, run unchanged — twice — on a real
// Postgres, over a database shaped like the live one on 12 Oct 2026: no row
// breaks a rule, except 15… here, one… allocation whose invoice is gone and
// one invoice line with no workspace.
//
// Each rule is then proved the only way a rule can be: by sending the write it
// exists to refuse, and by sending the legitimate write beside it.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'

const PORT = freePortSync()
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-dbint-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const MIGRATION = readFileSync(join(DOCS, 'db-integrity-01-migration.sql'), 'utf8')
const VERIFY = readFileSync(join(DOCS, 'VERIFY-db-integrity-01.sql'), 'utf8')

const SHOP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const CASH = id(1)
const SALES = id(2)
const PRODUCT = id(20)
const AFN_INVOICE = id(40)
const USD_INVOICE = id(41)
const NO_CURRENCY_INVOICE = id(42)
const GONE_INVOICE = id(998)
const AFN_PAYMENT = id(60)
const LAYER = id(50)

let sql: ReturnType<typeof postgres>

/** The message of the error a statement raises, or null when it succeeds. */
async function refusal(work: () => Promise<unknown>): Promise<string | null> {
  try {
    await work()
    return null
  } catch (error) {
    return String((error as Error).message)
  }
}

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  sql = postgres({
    host: 'localhost',
    port: PORT,
    user: 'postgres',
    password: 'test',
    max: 1,
    onnotice: () => undefined,
  })
  await sql.unsafe(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN;
    -- Supabase: everything is born open to every role.
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

    CREATE TABLE workspaces (id uuid PRIMARY KEY, base_currency text NOT NULL DEFAULT 'AFN');
    CREATE TABLE accounts (id uuid PRIMARY KEY, workspace_id uuid, code text);
    CREATE TABLE journal_entries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid,
      status text NOT NULL DEFAULT 'draft', source_type text, source_id uuid, reversal_of uuid);
    CREATE TABLE journal_lines (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid,
      journal_id uuid REFERENCES journal_entries(id), account_id uuid REFERENCES accounts(id),
      debit numeric NOT NULL DEFAULT 0, credit numeric NOT NULL DEFAULT 0);
    CREATE TABLE products (id uuid PRIMARY KEY, workspace_id uuid);
    CREATE TABLE suppliers (id uuid PRIMARY KEY, workspace_id uuid);
    CREATE TABLE warehouses (id uuid PRIMARY KEY, workspace_id uuid);
    CREATE TABLE warehouse_stock (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid);
    CREATE TABLE stock_movements (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid);
    CREATE TABLE invoices (id uuid PRIMARY KEY, workspace_id uuid, currency text);
    CREATE TABLE invoice_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid,
      invoice_id uuid NOT NULL REFERENCES invoices(id));
    CREATE TABLE payments (id uuid PRIMARY KEY, workspace_id uuid NOT NULL,
      currency text NOT NULL DEFAULT 'AFN', journal_entry_id uuid);
    CREATE TABLE payment_allocations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL, payment_id uuid NOT NULL REFERENCES payments(id),
      invoice_id uuid NOT NULL, amount numeric NOT NULL);
    CREATE TABLE cost_layers (id uuid PRIMARY KEY, workspace_id uuid NOT NULL,
      product_id uuid NOT NULL, received_qty numeric NOT NULL, remaining_qty numeric NOT NULL);
    CREATE TABLE cost_consumptions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL, layer_id uuid, product_id uuid NOT NULL);

    INSERT INTO workspaces VALUES ('${SHOP}', 'AFN');
    INSERT INTO accounts VALUES ('${CASH}', '${SHOP}', '1010'), ('${SALES}', '${SHOP}', '4000');
    INSERT INTO products VALUES ('${PRODUCT}', '${SHOP}');
    INSERT INTO invoices VALUES
      ('${AFN_INVOICE}', '${SHOP}', 'AFN'),
      ('${USD_INVOICE}', '${SHOP}', 'USD'),
      ('${NO_CURRENCY_INVOICE}', '${SHOP}', NULL);
    -- One line that says its workspace, one that does not (the live A1 finding).
    INSERT INTO invoice_items (workspace_id, invoice_id) VALUES
      ('${SHOP}', '${AFN_INVOICE}'), (NULL, '${AFN_INVOICE}');
    INSERT INTO payments (id, workspace_id, currency) VALUES ('${AFN_PAYMENT}', '${SHOP}', 'AFN');
    -- An allocation whose invoice is gone (the live B2 finding).
    INSERT INTO payment_allocations (workspace_id, payment_id, invoice_id, amount)
      VALUES ('${SHOP}', '${AFN_PAYMENT}', '${GONE_INVOICE}', 5);
    INSERT INTO cost_layers VALUES ('${LAYER}', '${SHOP}', '${PRODUCT}', 10, 10);

    -- A balanced posted entry, as the posting function leaves one.
    INSERT INTO journal_entries (id, workspace_id, status) VALUES ('${id(30)}', '${SHOP}', 'posted');
    INSERT INTO journal_lines (workspace_id, journal_id, account_id, debit, credit) VALUES
      ('${SHOP}', '${id(30)}', '${CASH}', 100, 0),
      ('${SHOP}', '${id(30)}', '${SALES}', 0, 100);
  `)
}, 120_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
})

describe('db-integrity-01', () => {
  it('runs twice without an error', async () => {
    await sql.unsafe(MIGRATION)
    await sql.unsafe(MIGRATION)
  })

  it('⚠️ deletes nothing: the old orphan allocation is still there', async () => {
    const [row] = await sql`SELECT COUNT(*)::int AS n FROM payment_allocations
                             WHERE invoice_id = ${GONE_INVOICE}`
    expect(row!.n).toBe(1)
  })

  it('gives the workspace-less invoice line its invoice’s workspace', async () => {
    const rows = await sql`SELECT workspace_id FROM invoice_items`
    expect(rows.map((r) => r.workspace_id)).toEqual([SHOP, SHOP])
  })

  describe('a journal line has a shape', () => {
    it('a negative amount is refused', async () => {
      expect(
        await refusal(
          () => sql`INSERT INTO journal_lines (workspace_id, journal_id, account_id, debit, credit)
                    VALUES (${SHOP}, ${id(30)}, ${CASH}, -5, 0)`,
        ),
      ).toContain('journal_lines_amounts_not_negative')
    })

    it('a line on both sides is refused', async () => {
      expect(
        await refusal(
          () => sql`INSERT INTO journal_lines (workspace_id, journal_id, account_id, debit, credit)
                    VALUES (${SHOP}, ${id(30)}, ${CASH}, 5, 5)`,
        ),
      ).toContain('journal_lines_one_side')
    })

    it('a line with no entry, or no account, is refused', async () => {
      expect(
        await refusal(
          () => sql`INSERT INTO journal_lines (workspace_id, journal_id, account_id, debit)
                    VALUES (${SHOP}, NULL, ${CASH}, 5)`,
        ),
      ).toContain('journal_id')
      expect(
        await refusal(
          () => sql`INSERT INTO journal_lines (workspace_id, journal_id, account_id, debit)
                    VALUES (${SHOP}, ${id(30)}, NULL, 5)`,
        ),
      ).toContain('account_id')
    })
  })

  describe('a posted entry balances, whoever wrote it', () => {
    it('⚠️ one more line on a posted entry is refused at commit', async () => {
      expect(
        await refusal(
          () => sql`INSERT INTO journal_lines (workspace_id, journal_id, account_id, debit, credit)
                    VALUES (${SHOP}, ${id(30)}, ${CASH}, 50, 0)`,
        ),
      ).toContain('JOURNAL_ENTRY_UNBALANCED')
      const [row] =
        await sql`SELECT COUNT(*)::int AS n FROM journal_lines WHERE journal_id = ${id(30)}`
      expect(row!.n).toBe(2)
    })

    it('removing a line of a posted entry, or changing its amount, is refused', async () => {
      expect(
        await refusal(
          () => sql`DELETE FROM journal_lines WHERE journal_id = ${id(30)} AND credit = 100`,
        ),
      ).toContain('JOURNAL_ENTRY_UNBALANCED')
      expect(
        await refusal(
          () =>
            sql`UPDATE journal_lines SET debit = 70 WHERE journal_id = ${id(30)} AND debit = 100`,
        ),
      ).toContain('JOURNAL_ENTRY_UNBALANCED')
    })

    it('header first, then the lines, in ONE transaction — the posting function’s way — is fine', async () => {
      await sql.begin(async (tx) => {
        await tx`INSERT INTO journal_entries (id, workspace_id, status)
                 VALUES (${id(31)}, ${SHOP}, 'posted')`
        await tx`INSERT INTO journal_lines (workspace_id, journal_id, account_id, debit, credit)
                 VALUES (${SHOP}, ${id(31)}, ${CASH}, 40, 0)`
        await tx`INSERT INTO journal_lines (workspace_id, journal_id, account_id, debit, credit)
                 VALUES (${SHOP}, ${id(31)}, ${SALES}, 0, 40)`
      })
      const [row] =
        await sql`SELECT COUNT(*)::int AS n FROM journal_lines WHERE journal_id = ${id(31)}`
      expect(row!.n).toBe(2)
    })

    it('a draft may be unbalanced; it cannot be POSTED that way', async () => {
      await sql`INSERT INTO journal_entries (id, workspace_id, status)
                VALUES (${id(32)}, ${SHOP}, 'draft')`
      await sql`INSERT INTO journal_lines (workspace_id, journal_id, account_id, debit, credit)
                VALUES (${SHOP}, ${id(32)}, ${CASH}, 9, 0)`
      expect(
        await refusal(() => sql`UPDATE journal_entries SET status = 'posted' WHERE id = ${id(32)}`),
      ).toContain('JOURNAL_ENTRY_UNBALANCED')
      const [row] = await sql`SELECT status FROM journal_entries WHERE id = ${id(32)}`
      expect(row!.status).toBe('draft')
    })

    it('marking a balanced entry reversed is fine', async () => {
      await sql`UPDATE journal_entries SET status = 'reversed' WHERE id = ${id(31)}`
      const [row] = await sql`SELECT status FROM journal_entries WHERE id = ${id(31)}`
      expect(row!.status).toBe('reversed')
    })
  })

  describe('a cost layer stays within what it received', () => {
    it('below zero and above the receipt are refused; drawing down is fine', async () => {
      expect(
        await refusal(() => sql`UPDATE cost_layers SET remaining_qty = -1 WHERE id = ${LAYER}`),
      ).toContain('cost_layers_remaining_in_range')
      expect(
        await refusal(() => sql`UPDATE cost_layers SET remaining_qty = 11 WHERE id = ${LAYER}`),
      ).toContain('cost_layers_remaining_in_range')
      await sql`UPDATE cost_layers SET remaining_qty = 4 WHERE id = ${LAYER}`
    })
  })

  describe('a payment settles invoices of its own currency', () => {
    const allocate = (invoice: string) =>
      sql`INSERT INTO payment_allocations (workspace_id, payment_id, invoice_id, amount)
          VALUES (${SHOP}, ${AFN_PAYMENT}, ${invoice}, 10)`

    it('⚠️ afghani against a dollar invoice is refused', async () => {
      expect(await refusal(() => allocate(USD_INVOICE))).toContain(
        'PAYMENT_ALLOCATION_CURRENCY_MISMATCH',
      )
    })

    it('afghani against an afghani invoice is fine', async () => {
      expect(await refusal(() => allocate(AFN_INVOICE))).toBeNull()
    })

    it('an invoice with no currency is in the books currency', async () => {
      expect(await refusal(() => allocate(NO_CURRENCY_INVOICE))).toBeNull()
      await sql`UPDATE workspaces SET base_currency = 'IRR' WHERE id = ${SHOP}`
      expect(await refusal(() => allocate(NO_CURRENCY_INVOICE))).toContain(
        'PAYMENT_ALLOCATION_CURRENCY_MISMATCH',
      )
      await sql`UPDATE workspaces SET base_currency = 'AFN' WHERE id = ${SHOP}`
    })
  })

  describe('references are checked', () => {
    it('⚠️ a NEW allocation to an invoice that does not exist is refused', async () => {
      expect(
        await refusal(
          () => sql`INSERT INTO payment_allocations (workspace_id, payment_id, invoice_id, amount)
                    VALUES (${SHOP}, ${AFN_PAYMENT}, ${id(997)}, 1)`,
        ),
      ).toContain('payment_allocations_invoice_id_fkey')
    })

    it('a layer for a product that does not exist, and a row for a workspace that does not, are refused', async () => {
      expect(
        await refusal(
          () => sql`INSERT INTO cost_layers VALUES (${id(51)}, ${SHOP}, ${id(996)}, 1, 1)`,
        ),
      ).toContain('cost_layers_product_id_fkey')
      expect(
        await refusal(() => sql`INSERT INTO accounts VALUES (${id(3)}, ${id(995)}, '9999')`),
      ).toContain('accounts_workspace_id_fkey')
    })

    it('a product with a cost layer cannot be deleted out from under it', async () => {
      expect(await refusal(() => sql`DELETE FROM products WHERE id = ${PRODUCT}`)).toContain(
        'cost_layers_product_id_fkey',
      )
    })
  })

  describe('docs/VERIFY-db-integrity-01.sql', () => {
    it('is one read-only statement', () => {
      const body = VERIFY.split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n')
      expect(body.trim().toUpperCase().startsWith('WITH')).toBe(true)
      expect(body).not.toMatch(/\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE|GRANT)\b/i)
      expect(body.split(';').filter((part) => part.trim()).length).toBe(1)
    })

    it('says ok for everything except the one key that old rows keep NOT VALID', async () => {
      const rows = (await sql.unsafe(VERIFY)) as unknown as Array<{
        name: string
        ok: boolean
        detail: string
      }>
      expect(rows.length).toBeGreaterThan(40)
      expect(rows.filter((row) => !row.ok).map((row) => row.name)).toEqual([
        'fk payment_allocations.invoice_id is validated',
      ])
      // And the functions carry a pinned search_path (the Supabase linter).
      for (const row of rows.filter((r) => r.name.startsWith('function '))) {
        expect(row.detail).toContain('search_path=public')
      }
    })
  })
})
