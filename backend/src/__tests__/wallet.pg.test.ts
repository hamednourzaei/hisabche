// ============================================
// docs/wallet-01-migration.sql in a real Postgres (twice), on top of the
// subscription-upgrade migration it reuses. What only a real database proves:
//   - a balance can never go negative, by any path;
//   - a top-up is credited once (no double approval; one receipt reference);
//   - the ledger is append-only and always sums to the balance;
//   - a balance cannot be written except through the functions;
//   - two purchases racing for one business: exactly one succeeds;
//   - paying a plan debits, files the request as 'wallet' and activates it in
//     ONE transaction — a refusal anywhere leaves nothing behind.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const PORT = 57000 + Math.floor(Math.random() * 900)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-wallet-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/wallet`
let db: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const upgrades = readFileSync(join(DOCS, 'subscription-upgrade-requests-migration.sql'), 'utf8')
const migration = readFileSync(join(DOCS, 'wallet-01-migration.sql'), 'utf8')
const verify = readFileSync(join(DOCS, 'VERIFY-wallet-01.sql'), 'utf8')

const WS = 'aaaaaaaa-0000-4000-8000-000000000001'
const OTHER = 'bbbbbbbb-0000-4000-8000-000000000002'
const OWNER = '11111111-1111-4111-8111-111111111111'
const ADMIN = '33333333-3333-4333-8333-333333333333'

let card: string
let usd: string

async function balance(ws = WS, currency = 'USD'): Promise<number> {
  const [r] = await db<{ b: string | null }[]>`
    SELECT balance_minor AS b FROM wallets WHERE workspace_id = ${ws} AND currency = ${currency}`
  return Number(r?.b ?? 0)
}
async function ledgerSum(ws = WS, currency = 'USD'): Promise<number> {
  const [r] = await db<{ s: string | null }[]>`
    SELECT sum(amount_minor) AS s FROM wallet_transactions WHERE workspace_id = ${ws} AND currency = ${currency}`
  return Number(r?.s ?? 0)
}
async function topup(method: string, amount: number, ref: string, last4: string | null = null) {
  const [r] = await db<{ id: string }[]>`
    SELECT (create_wallet_topup_request(${WS}, ${OWNER}, ${method}, ${amount}, ${ref}, ${last4},
            current_date, NULL, NULL, NULL)).id AS id`
  return r!.id
}
async function credit(amount: number, ref: string) {
  const id = await topup(usd, amount, ref)
  await db`SELECT approve_wallet_topup(${id}, ${ADMIN}, NULL, NULL)`
}
const pay = (key: string | null = null) =>
  db`SELECT wallet_pay_subscription_upgrade(${WS}, ${OWNER}, 'free', 'pro', 'month', 1200, 'USD', 'USD', ${key}) AS r`

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('wallet')
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
    CREATE TABLE public.workspace_members (workspace_id uuid NOT NULL, user_id uuid NOT NULL, has_access boolean DEFAULT true, suspended_at timestamptz);
    CREATE TABLE public.subscriptions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL, user_id uuid,
      plan text NOT NULL, status text NOT NULL, is_trial boolean DEFAULT true, trial_used boolean DEFAULT true,
      period_start timestamptz, period_end timestamptz, cancel_at_period_end boolean DEFAULT false,
      created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
    -- Supabase's storage table: the migration inserts the private bucket into it.
    CREATE SCHEMA IF NOT EXISTS storage;
    CREATE TABLE storage.buckets (id text PRIMARY KEY, name text NOT NULL, public boolean DEFAULT false,
      file_size_limit bigint, allowed_mime_types text[]);
    -- Production shape: the RLS helper lives in \`private\` (BUG-065).
    CREATE SCHEMA IF NOT EXISTS private;
    CREATE OR REPLACE FUNCTION private.auth_workspace_ids() RETURNS SETOF uuid LANGUAGE sql STABLE AS
      $$ SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid() $$;
  `)
  await setup.unsafe(upgrades)
  await setup.unsafe(migration)
  await setup.unsafe(migration)
  await setup.end()
  db = postgres(url, { max: 6, onnotice: () => {} })
}, 180_000)

afterAll(async () => {
  await db?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
}, 60_000)

beforeEach(async () => {
  await db.unsafe(`
    ALTER TABLE wallet_transactions DISABLE TRIGGER wallet_transactions_append_only;
    DELETE FROM wallet_transactions; DELETE FROM wallet_topup_requests;
    ALTER TABLE wallet_transactions ENABLE TRIGGER wallet_transactions_append_only;
    ALTER TABLE wallets DISABLE TRIGGER wallets_balance_guard;
    DELETE FROM wallets;
    ALTER TABLE wallets ENABLE TRIGGER wallets_balance_guard;
    DELETE FROM wallet_payment_methods; DELETE FROM subscription_events;
    DELETE FROM subscription_upgrade_requests; DELETE FROM subscriptions;`)
  await db`INSERT INTO subscriptions (workspace_id, plan, status, period_start, period_end)
           VALUES (${WS}, 'free', 'active', now(), now() + interval '10 years')`
  const [c] = await db<{ id: string }[]>`
    INSERT INTO wallet_payment_methods (kind, currency, title, destination)
    VALUES ('card_to_card', 'IRR', 'کارت ملت', '6104-0000-0000-0000') RETURNING id`
  card = c!.id
  const [u] = await db<{ id: string }[]>`
    INSERT INTO wallet_payment_methods (kind, currency, title, destination)
    VALUES ('foreign_currency', 'USD', 'USD account', 'IBAN XX00') RETURNING id`
  usd = u!.id
})

describe('top-up', () => {
  it('a request, then an approval: credited once, ledger = balance', async () => {
    const id = await topup(usd, 5000, 'TRX-1')
    expect(await balance()).toBe(0)
    await db`SELECT approve_wallet_topup(${id}, ${ADMIN}, NULL, NULL)`
    expect(await balance()).toBe(5000)
    expect(await ledgerSum()).toBe(5000)
  })

  it('the admin credits what actually arrived', async () => {
    const id = await topup(usd, 5000, 'TRX-2')
    await db`SELECT approve_wallet_topup(${id}, ${ADMIN}, 4800, 'bank fee')`
    expect(await balance()).toBe(4800)
  })

  it('⚠️ approving twice is refused — even two admins at once', async () => {
    const id = await topup(usd, 5000, 'TRX-3')
    const both = await Promise.allSettled([
      db`SELECT approve_wallet_topup(${id}, ${ADMIN}, NULL, NULL)`,
      db`SELECT approve_wallet_topup(${id}, ${ADMIN}, NULL, NULL)`,
    ])
    expect(both.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(await balance()).toBe(5000)
  })

  it('⚠️ one receipt reference is credited once per method', async () => {
    await topup(usd, 5000, 'TRX-4')
    await expect(topup(usd, 5000, 'TRX-4')).rejects.toThrow(/WALLET_TOPUP_DUPLICATE_REFERENCE/)
  })

  it('a rejected reference may be filed again (a typo the first time)', async () => {
    const id = await topup(usd, 5000, 'TRX-5')
    await db`SELECT reject_wallet_topup(${id}, ${ADMIN}, 'no such transfer')`
    await expect(topup(usd, 5000, 'TRX-5')).resolves.toBeTruthy()
  })

  it('card-to-card needs the last four digits', async () => {
    await expect(topup(card, 100000, 'REF-1')).rejects.toThrow(/WALLET_CARD_LAST4_REQUIRED/)
    await expect(topup(card, 100000, 'REF-1', '1234')).resolves.toBeTruthy()
  })

  it('a rejection needs a reason, and an inactive method takes nothing', async () => {
    const id = await topup(usd, 5000, 'TRX-6')
    await expect(db`SELECT reject_wallet_topup(${id}, ${ADMIN}, '  ')`).rejects.toThrow(
      /WALLET_NOTE_REQUIRED/,
    )
    await db`UPDATE wallet_payment_methods SET is_active = false WHERE id = ${usd}`
    await expect(topup(usd, 5000, 'TRX-7')).rejects.toThrow(/WALLET_METHOD_UNAVAILABLE/)
  })

  it('a member withdraws only their own pending request', async () => {
    const id = await topup(usd, 5000, 'TRX-8')
    await expect(db`SELECT cancel_wallet_topup(${id}, ${OTHER}, ${OWNER})`).rejects.toThrow(
      /WALLET_TOPUP_NOT_FOUND/,
    )
    await db`SELECT cancel_wallet_topup(${id}, ${WS}, ${OWNER})`
    await expect(db`SELECT approve_wallet_topup(${id}, ${ADMIN}, NULL, NULL)`).rejects.toThrow(
      /WALLET_TOPUP_NOT_PENDING/,
    )
  })
})

describe('the balance can never go negative', () => {
  it('⚠️ an adjustment below zero is refused and changes nothing', async () => {
    await credit(1000, 'A1')
    await expect(db`SELECT wallet_adjust(${WS}, 'USD', -1001, ${ADMIN}, 'fix')`).rejects.toThrow(
      /WALLET_INSUFFICIENT_FUNDS/,
    )
    expect(await balance()).toBe(1000)
    await db`SELECT wallet_adjust(${WS}, 'USD', -1000, ${ADMIN}, 'fix')`
    expect(await balance()).toBe(0)
    expect(await ledgerSum()).toBe(0)
  })

  it('an adjustment needs a note', async () => {
    await expect(db`SELECT wallet_adjust(${WS}, 'USD', 500, ${ADMIN}, '')`).rejects.toThrow(
      /WALLET_NOTE_REQUIRED/,
    )
  })

  it('⚠️ a direct UPDATE of a balance is refused (it moves only through the functions)', async () => {
    await credit(1000, 'A2')
    await expect(
      db`UPDATE wallets SET balance_minor = 999999 WHERE workspace_id = ${WS}`,
    ).rejects.toThrow(/WALLET_DIRECT_WRITE/)
  })

  it('⚠️ the ledger is append-only', async () => {
    await credit(1000, 'A3')
    await expect(db`UPDATE wallet_transactions SET amount_minor = 5`).rejects.toThrow(
      /WALLET_LEDGER_APPEND_ONLY/,
    )
    await expect(db`DELETE FROM wallet_transactions`).rejects.toThrow(/WALLET_LEDGER_APPEND_ONLY/)
  })
})

describe('paying a plan from the wallet', () => {
  it('debits, files the request as wallet and activates it — one transaction', async () => {
    await credit(5000, 'P1')
    const [r] = await pay('key-1')
    expect(r!.r).toMatchObject({ balance_after: 3800, replayed: false })
    const [sub] = await db`SELECT plan, status FROM subscriptions WHERE workspace_id = ${WS}`
    expect(sub).toMatchObject({ plan: 'pro', status: 'active' })
    const [req] =
      await db`SELECT payment_method, status, amount_minor FROM subscription_upgrade_requests`
    expect(req).toMatchObject({ payment_method: 'wallet', status: 'approved' })
    expect(await ledgerSum()).toBe(await balance())
  })

  it('⚠️ not enough money: refused, and NOTHING was filed or activated', async () => {
    await credit(1000, 'P2')
    await expect(pay()).rejects.toThrow(/WALLET_INSUFFICIENT_FUNDS/)
    expect(await db`SELECT 1 FROM subscription_upgrade_requests`).toHaveLength(0)
    const [sub] = await db`SELECT plan FROM subscriptions WHERE workspace_id = ${WS}`
    expect(sub!.plan).toBe('free')
  })

  it('⚠️ a wallet in another currency is refused — plans are priced in USD', async () => {
    await expect(
      db`SELECT wallet_pay_subscription_upgrade(${WS}, ${OWNER}, 'free', 'pro', 'month', 1200, 'USD', 'IRR', NULL)`,
    ).rejects.toThrow(/WALLET_CURRENCY_MISMATCH/)
  })

  it('a pending manual request blocks it (UPGRADE_REQUEST_PENDING), and the debit rolls back', async () => {
    await credit(5000, 'P3')
    await db`SELECT create_subscription_upgrade_request(${WS}, ${OWNER}, 'free', 'pro', 'month', 1200, 'USD', 'card_to_card', 'X', NULL)`
    await expect(pay()).rejects.toThrow(/UPGRADE_REQUEST_PENDING/)
    expect(await balance()).toBe(5000)
    expect(await ledgerSum()).toBe(5000)
  })

  it('⚠️ two purchases at the same moment: exactly one succeeds, paid once', async () => {
    await credit(5000, 'P4')
    const both = await Promise.allSettled([pay('k-a'), pay('k-b')])
    expect(both.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(await balance()).toBe(3800)
    expect(await ledgerSum()).toBe(3800)
  })

  it('a replay with the same key answers with the first purchase, paid once', async () => {
    await credit(5000, 'P5')
    await pay('same')
    // The plan is now active; a replay must not be refused as «already active»
    // nor charge again.
    const [again] = await pay('same')
    expect(again!.r).toMatchObject({ replayed: true })
    expect(await balance()).toBe(3800)
  })
})

describe('grants and VERIFY', () => {
  it('clients cannot execute any wallet function', async () => {
    const rows = await db<{ fn: string; anon: boolean; auth: boolean }[]>`
      SELECT p.proname AS fn,
             has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
             has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth
        FROM pg_proc p WHERE p.proname LIKE '%wallet%'`
    expect(rows.length).toBeGreaterThanOrEqual(7)
    expect(rows.filter((r) => r.anon || r.auth)).toEqual([])
  })

  it('VERIFY-wallet-01.sql: every check is ok', async () => {
    await credit(700, 'V1')
    const rows = (await db.unsafe(verify)) as unknown as Array<{ check: string; ok: boolean }>
    expect(rows.length).toBeGreaterThanOrEqual(30)
    expect(rows.filter((r) => r.ok !== true).map((r) => r.check)).toEqual([])
  })
})
