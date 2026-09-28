// ============================================
// Developer platform 03 — docs/developer-platform-03-commerce-migration.sql,
// run unchanged (twice) after 01 in a real Postgres, then its VERIFY query.
//
// The security contract, proved on the database that enforces it:
//   · the price and the total come from the products table, never the caller;
//   · stock, activity and workspace are checked for every line;
//   · a replay returns the first order and writes nothing;
//   · the lifecycle refuses every transition it does not list;
//   · «paid» follows the invoice, both ways, and cannot fail the payment;
//   · every transition emits its event in the same transaction.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const PORT = 57000 + Math.floor(Math.random() * 900)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-dev3-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/dev3`
let db: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const m01 = readFileSync(join(DOCS, 'developer-platform-migration.sql'), 'utf8')
const m03 = readFileSync(join(DOCS, 'developer-platform-03-commerce-migration.sql'), 'utf8')
const verify = readFileSync(join(DOCS, 'VERIFY-developer-platform-03.sql'), 'utf8')

const WS = 'aaaaaaaa-0000-0000-0000-000000000001'
const OTHER = 'aaaaaaaa-0000-0000-0000-000000000002'
const OWNER = '11111111-1111-1111-1111-111111111111'
const OUTSIDER = '99999999-9999-9999-9999-999999999999'

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('dev3')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    END $$;
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
    CREATE TABLE public.workspaces (id uuid PRIMARY KEY);
    CREATE TABLE public.workspace_members (
      workspace_id uuid NOT NULL, user_id uuid NOT NULL, role text,
      has_access boolean DEFAULT true, suspended_at timestamptz
    );
    GRANT SELECT ON public.workspace_members TO authenticated;
    CREATE TABLE public.products (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid, name text NOT NULL,
      unit text, quantity numeric(18,4) DEFAULT 0, sell_price numeric DEFAULT 0,
      buy_price numeric DEFAULT 0, min_stock_level integer DEFAULT 0, is_active boolean DEFAULT true
    );
    CREATE TABLE public.invoices (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid, status text);
  `)
  await setup.unsafe(m01)
  await setup.unsafe(m03)
  await setup.unsafe(m03)
  await setup`INSERT INTO workspaces VALUES (${WS}), (${OTHER})`
  await setup`INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (${WS}, ${OWNER}, 'owner')`
  await setup.end()
  db = postgres(url, { max: 5, onnotice: () => {} })
}, 180_000)

afterAll(async () => {
  await db?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
}, 60_000)

beforeEach(async () => {
  await db`DELETE FROM webhook_deliveries`
  await db`DELETE FROM webhook_endpoints`
  await db`DELETE FROM sales_orders`
  await db`DELETE FROM storefront_settings`
  await db`DELETE FROM products`
  await db`DELETE FROM invoices`
  await db`
    INSERT INTO webhook_endpoints (workspace_id, created_by, url, events)
    VALUES (${WS}, ${OWNER}, 'https://example.com/h',
            ${['order.created', 'order.confirmed', 'order.invoiced', 'order.paid', 'order.fulfilled', 'order.cancelled', 'order.payment_reversed']})`
})

async function product(
  fields: Partial<{ price: number; qty: number; active: boolean; ws: string; name: string }> = {},
) {
  const [row] = await db`
    INSERT INTO products (workspace_id, name, sell_price, buy_price, quantity, is_active, unit)
    VALUES (${fields.ws ?? WS}, ${fields.name ?? 'چای'}, ${fields.price ?? 150.5}, 90, ${fields.qty ?? 10},
            ${fields.active ?? true}, 'piece')
    RETURNING id`
  return row!.id as string
}

async function create(
  items: unknown[],
  opts: { idem?: string | null; phone?: string; source?: string } = {},
) {
  const [row] = await db`
    SELECT create_sales_order(
      ${WS}, ${opts.source ?? 'website'}, NULL, ${opts.idem ?? null},
      ${db.json({ name: 'مریم', phone: opts.phone ?? '0799000000' })}, ${db.json(items as never)}, NULL
    ) AS r`
  return row!.r as { order_id: string; replay: boolean }
}

const order = async (id: string) =>
  (await db`SELECT status, total, invoice_id, expires_at FROM sales_orders WHERE id = ${id}`)[0]!
const events = async () =>
  (await db`SELECT event_type FROM webhook_deliveries ORDER BY created_at`).map((r) => r.event_type)

describe('the migration', () => {
  it('ran twice after 01, and every VERIFY row reads ok', async () => {
    const rows = await db.unsafe(verify)
    expect(rows.length).toBe(10)
    for (const row of rows)
      expect({ check: row.check, ok: row.ok }).toEqual({ check: row.check, ok: true })
  })
})

describe('creating an order — the price is the database’s', () => {
  it('the total is the product price times quantity; duplicates are merged', async () => {
    const tea = await product({ price: 150.5 })
    const r = await create([
      { productId: tea, quantity: 2 },
      { productId: tea, quantity: 1 },
    ])
    const o = await order(r.order_id)
    expect(o.status).toBe('pending')
    expect(o.total).toBe('451.5000')
    const lines =
      await db`SELECT quantity, unit_price, line_total FROM sales_order_items WHERE order_id = ${r.order_id}`
    expect(lines).toEqual([{ quantity: '3.0000', unit_price: '150.5000', line_total: '451.5000' }])
    expect(await events()).toEqual(['order.created'])
  })

  it('a price sent by the caller has nowhere to go', async () => {
    const tea = await product({ price: 100 })
    const r = await create([{ productId: tea, quantity: 1, unitPrice: 1, total: 1 }])
    expect((await order(r.order_id)).total).toBe('100.0000')
  })

  it.each([
    ['another workspace’s product', { ws: OTHER }, 'ORDER_PRODUCT_NOT_FOUND'],
    ['an inactive product', { active: false }, 'ORDER_PRODUCT_NOT_FOUND'],
    ['an unpriced product', { price: 0 }, 'ORDER_PRODUCT_NOT_PRICED'],
    ['more than the stock', { qty: 1 }, 'ORDER_INSUFFICIENT_STOCK'],
  ])('refuses %s, and writes nothing', async (_label, fields, code) => {
    const id = await product(fields)
    await expect(create([{ productId: id, quantity: 2 }])).rejects.toThrow(code)
    expect((await db`SELECT count(*)::int AS n FROM sales_orders`)[0]!.n).toBe(0)
    expect(await events()).toEqual([])
  })

  it('refuses a zero or negative quantity', async () => {
    const tea = await product()
    await expect(create([{ productId: tea, quantity: 0 }])).rejects.toThrow(
      'ORDER_QUANTITY_INVALID',
    )
  })

  it('a replay with the same key returns the first order and writes nothing', async () => {
    const tea = await product()
    const first = await create([{ productId: tea, quantity: 1 }], { idem: 'key-000001' })
    const again = await create([{ productId: tea, quantity: 5 }], { idem: 'key-000001' })
    expect(again).toEqual({ order_id: first.order_id, replay: true })
    expect((await db`SELECT count(*)::int AS n FROM sales_orders`)[0]!.n).toBe(1)
  })

  it('two identical requests at the same instant make one order', async () => {
    const tea = await product()
    const [a, b] = await Promise.all([
      create([{ productId: tea, quantity: 1 }], { idem: 'race-000001' }),
      create([{ productId: tea, quantity: 1 }], { idem: 'race-000001' }),
    ])
    expect(a.order_id).toBe(b.order_id)
    expect((await db`SELECT count(*)::int AS n FROM sales_orders`)[0]!.n).toBe(1)
  })

  it('caps pending orders per contact', async () => {
    const tea = await product({ qty: 100 })
    await db`INSERT INTO storefront_settings (workspace_id, max_pending_per_contact) VALUES (${WS}, 2)`
    await create([{ productId: tea, quantity: 1 }])
    await create([{ productId: tea, quantity: 1 }])
    await expect(create([{ productId: tea, quantity: 1 }])).rejects.toThrow(
      'ORDER_TOO_MANY_PENDING',
    )
    // Another contact is not affected.
    await expect(
      create([{ productId: tea, quantity: 1 }], { phone: '0788111111' }),
    ).resolves.toBeTruthy()
  })

  it('without settings, a website order waits for a person (the default)', async () => {
    const tea = await product()
    const r = await create([{ productId: tea, quantity: 1 }])
    const o = await order(r.order_id)
    expect(o.status).toBe('pending')
    expect(o.expires_at).not.toBeNull()
  })

  it('automatic confirmation confirms a website order and says so', async () => {
    await db`INSERT INTO storefront_settings (workspace_id, order_confirmation) VALUES (${WS}, 'automatic')`
    const tea = await product()
    const r = await create([{ productId: tea, quantity: 1 }])
    expect((await order(r.order_id)).status).toBe('confirmed')
    expect(await events()).toEqual(['order.created', 'order.confirmed'])
  })
})

const move = (id: string, to: string, invoice: string | null = null) =>
  db`SELECT transition_sales_order(${WS}, ${id}, ${to}, 'test', ${invoice}, NULL) AS s`

describe('the lifecycle', () => {
  it('walks pending → confirmed → invoiced → paid → fulfilled, one event each', async () => {
    const tea = await product()
    const { order_id } = await create([{ productId: tea, quantity: 1 }])
    const [inv] =
      await db`INSERT INTO invoices (workspace_id, status) VALUES (${WS}, 'pending') RETURNING id`
    await move(order_id, 'confirmed')
    await move(order_id, 'invoiced', inv!.id as string)
    // A person cannot set «paid»: it follows the invoice.
    await db`UPDATE invoices SET status = 'paid' WHERE id = ${inv!.id as string}`
    expect((await order(order_id)).status).toBe('paid')
    await move(order_id, 'fulfilled')
    expect(await events()).toEqual([
      'order.created',
      'order.confirmed',
      'order.invoiced',
      'order.paid',
      'order.fulfilled',
    ])
  })

  it('a reversed payment takes the order back to invoiced, with its own event', async () => {
    const tea = await product()
    const { order_id } = await create([{ productId: tea, quantity: 1 }])
    const [inv] =
      await db`INSERT INTO invoices (workspace_id, status) VALUES (${WS}, 'pending') RETURNING id`
    await move(order_id, 'confirmed')
    await move(order_id, 'invoiced', inv!.id as string)
    await db`UPDATE invoices SET status = 'paid' WHERE id = ${inv!.id as string}`
    await db`UPDATE invoices SET status = 'pending' WHERE id = ${inv!.id as string}`
    expect((await order(order_id)).status).toBe('invoiced')
    expect((await events()).slice(-1)).toEqual(['order.payment_reversed'])
  })

  it.each([
    ['pending', 'invoiced'],
    ['pending', 'paid'],
    ['pending', 'fulfilled'],
    ['confirmed', 'paid'],
  ])('refuses %s → %s', async (from, to) => {
    const tea = await product()
    const { order_id } = await create([{ productId: tea, quantity: 1 }])
    if (from === 'confirmed') await move(order_id, 'confirmed')
    await expect(move(order_id, to)).rejects.toThrow(
      /ORDER_TRANSITION_INVALID|ORDER_INVOICE_REQUIRED/,
    )
  })

  it('invoicing requires the invoice', async () => {
    const tea = await product()
    const { order_id } = await create([{ productId: tea, quantity: 1 }])
    await move(order_id, 'confirmed')
    await expect(move(order_id, 'invoiced')).rejects.toThrow('ORDER_INVOICE_REQUIRED')
  })

  it('a cancelled order stays cancelled', async () => {
    const tea = await product()
    const { order_id } = await create([{ productId: tea, quantity: 1 }])
    await move(order_id, 'cancelled')
    await expect(move(order_id, 'confirmed')).rejects.toThrow('ORDER_TRANSITION_INVALID')
  })

  it('another workspace cannot move the order', async () => {
    const tea = await product()
    const { order_id } = await create([{ productId: tea, quantity: 1 }])
    await expect(
      db`SELECT transition_sales_order(${OTHER}, ${order_id}, 'confirmed')`,
    ).rejects.toThrow('ORDER_NOT_FOUND')
  })

  it('a broken order path cannot fail the payment', async () => {
    const tea = await product()
    const { order_id } = await create([{ productId: tea, quantity: 1 }])
    const [inv] =
      await db`INSERT INTO invoices (workspace_id, status) VALUES (${WS}, 'pending') RETURNING id`
    await move(order_id, 'confirmed')
    await move(order_id, 'invoiced', inv!.id as string)
    await db`ALTER TABLE webhook_deliveries ADD CONSTRAINT refuse_all CHECK (false) NOT VALID`
    try {
      await db`UPDATE invoices SET status = 'paid' WHERE id = ${inv!.id as string}`
      expect(
        (await db`SELECT status FROM invoices WHERE id = ${inv!.id as string}`)[0]!.status,
      ).toBe('paid')
    } finally {
      await db`ALTER TABLE webhook_deliveries DROP CONSTRAINT refuse_all`
    }
  })

  it('pending orders past their expiry are cancelled with the reason', async () => {
    const tea = await product()
    const { order_id } = await create([{ productId: tea, quantity: 1 }])
    await db`UPDATE sales_orders SET expires_at = now() - interval '1 minute' WHERE id = ${order_id}`
    const [r] = await db`SELECT expire_pending_sales_orders() AS n`
    expect(r!.n).toBe(1)
    expect(
      (await db`SELECT status, cancel_reason FROM sales_orders WHERE id = ${order_id}`)[0],
    ).toEqual({
      status: 'cancelled',
      cancel_reason: 'EXPIRED',
    })
  })
})

describe('RLS', () => {
  const as = async <T>(userId: string, fn: (tx: postgres.TransactionSql) => Promise<T>) =>
    (await db.begin(async (tx) => {
      await tx.unsafe('SET LOCAL ROLE authenticated')
      await tx.unsafe(`SET LOCAL request.jwt.claim.sub = '${userId}'`)
      return fn(tx)
    })) as T

  it('members read their orders; outsiders read none; nobody writes', async () => {
    const tea = await product()
    await create([{ productId: tea, quantity: 1 }])
    expect((await as(OWNER, (tx) => tx`SELECT id FROM sales_orders`)).length).toBe(1)
    expect((await as(OUTSIDER, (tx) => tx`SELECT id FROM sales_orders`)).length).toBe(0)
    await expect(as(OWNER, (tx) => tx`UPDATE sales_orders SET total = 0`)).rejects.toThrow(
      /permission denied/,
    )
    await expect(
      as(
        OWNER,
        (tx) =>
          tx`SELECT create_sales_order(${WS}, 'website', NULL, NULL, '{}'::jsonb, '[]'::jsonb, NULL)`,
      ),
    ).rejects.toThrow(/permission denied/)
  })

  it('a secret key can never carry a public token', async () => {
    await expect(
      db`INSERT INTO api_keys (workspace_id, created_by, name, prefix, key_hash, scopes, kind, public_token)
         VALUES (${WS}, ${OWNER}, 'x', 'hk_live_x', ${'c'.repeat(64)}, ${['read:invoices']}, 'secret', 'leak')`,
    ).rejects.toThrow(/api_keys_public_token_only_publishable/)
  })
})
