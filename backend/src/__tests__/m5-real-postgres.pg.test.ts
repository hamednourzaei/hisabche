// ============================================
// backend/src/__tests__/m5-real-postgres.pg.test.ts
//
// REAL multi-connection tests for the M5 database objects. They need a throwaway PostgreSQL (see helpers/disposable-pg.ts); without it
// every test is reported SKIPPED with the reason (BLOCKED_EXTERNAL) - never passed. Nothing here runs against a production database:
// each run creates its own qa_m5_ database and drops it.
//
// Each test names the invariant and the GUARD it proves. They use SEPARATE connections released at the same moment by a barrier; no mocks.
//
// PREPARED: package credit consume on one GRANT (customer row lock + balance check), service delivery double delivery (session row lock +
//           unique consume index), deferred-revenue double recognition (the same), RLS with real roles (membership chain).
// NOT PREPARED (and why): stock decrement race, document numbering, payment double submit, accounting posting uniqueness and warehouse
//           transfer race live in TypeScript services over tables whose full DDL is not in this repository's SQL set; a faithful test needs the
//           whole chain on a real database. The same-return-line race is covered by invoice-return-05.pg.test.ts.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  createDisposableDatabase,
  disposableEnabled,
  SKIP_REASON,
  type DisposableDatabase,
} from './helpers/disposable-pg'
import { setupDeferredRevenue } from './helpers/package-deferred-revenue-01-scenarios'

const enabled = disposableEnabled()
const DOCS = join(__dirname, '..', '..', '..', 'docs')
const doc = (name: string) => readFileSync(join(DOCS, name), 'utf8')

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER_WS = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const SERVICE = '20000000-0000-4000-8000-000000000001'
const PACKAGE = '20000000-0000-4000-8000-000000000002'
const MEMBER = 'f0000000-0000-4000-8000-000000000001'
const OUTSIDER = 'f0000000-0000-4000-8000-000000000002'

let database: DisposableDatabase | undefined

/** Releases every waiter at the same instant; each waiter is a promise bound to ITS OWN connection. */
function barrier(count: number) {
  let arrived = 0
  let release!: () => void
  const gate = new Promise<void>((resolve) => (release = resolve))
  return async () => {
    arrived += 1
    if (arrived === count) release()
    await gate
  }
}

describe.skipIf(!enabled)(
  `M5 on a real PostgreSQL (${enabled ? 'disposable server' : SKIP_REASON})`,
  () => {
    beforeAll(async () => {
      database = await createDisposableDatabase()
      const admin = database.connect(1)
      const run = async (text: string, params?: readonly unknown[]) =>
        (await admin.unsafe(text, (params ? [...params] : []) as never[])) as unknown as Array<
          Record<string, unknown>
        >
      await setupDeferredRevenue(run) // the whole current M5 chain, twice each, on the real server
      // a real auth.uid(): the claim set on the connection, like Supabase does
      await admin.unsafe(
        `CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $f$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $f$`,
      )
      await admin.unsafe(`INSERT INTO public.workspace_members VALUES ('${WS}', '${MEMBER}')`)
      await admin.unsafe(`INSERT INTO public.workspaces VALUES ('${OTHER_WS}')`)
      await admin.unsafe(
        `GRANT USAGE ON SCHEMA public, auth TO authenticated; GRANT SELECT ON public.workspace_members TO authenticated`,
      )
    }, 180_000)

    afterAll(async () => {
      await database?.drop()
    }, 60_000)

    async function seedCustomerWithGrant(quantity: number, deferred: number | null) {
      const admin = database!.connect(1)
      const customer = (
        await admin`INSERT INTO public.customers VALUES (gen_random_uuid(), ${WS}) RETURNING id`
      )[0]!.id as string
      const invoice = (
        await admin`INSERT INTO public.invoices (id, workspace_id, customer_id) VALUES (gen_random_uuid(), ${WS}, ${customer}) RETURNING id`
      )[0]!.id as string
      await admin`INSERT INTO public.journal_entries (workspace_id, date, source_type, source_id) VALUES (${WS}, '2030-01-01', 'invoice', ${invoice})`
      await admin`INSERT INTO public.package_credit_ledger (workspace_id, customer_id, package_product_id, entry_type, quantity, source_document_type, source_document_id, deferred_amount, effective_date)
                VALUES (${WS}, ${customer}, ${PACKAGE}, 'GRANT', ${quantity}, 'invoice', ${invoice}, ${deferred}, '2030-01-01')`
      return customer
    }

    it('GUARD customer row lock + balance check: two connections spend the LAST unit of one GRANT - exactly one wins', async () => {
      const customer = await seedCustomerWithGrant(1, null)
      const wait = barrier(2)
      const spend = async (key: string) => {
        const sql = database!.connect(1)
        await wait()
        return sql`SELECT public.package_credit_consume(${WS}, ${customer}, ${PACKAGE}, 1, NULL, ${key}, NULL, '2030-01-02', NULL) AS r`
      }
      const results = await Promise.allSettled([spend('race-a'), spend('race-b')])
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1)
      const consumes = await database!.connect(
        1,
      )`SELECT count(*)::int AS n FROM public.package_credit_ledger WHERE customer_id = ${customer} AND entry_type = 'CONSUME'`
      expect(consumes[0]!.n).toBe(1)
    })

    it('GUARD session row lock + unique consume index: the same session delivered from two connections consumes ONCE and recognises revenue ONCE', async () => {
      const customer = await seedCustomerWithGrant(5, 500)
      const admin = database!.connect(1)
      const session = (
        await admin`INSERT INTO public.service_delivery_sessions (id, workspace_id, customer_id, service_offering_id, session_date, start_time, end_time, duration_minutes)
      VALUES (gen_random_uuid(), ${WS}, ${customer}, ${SERVICE}, '2030-01-02', '10:00', '11:00', 60) RETURNING id`
      )[0]!.id as string
      const wait = barrier(2)
      const deliver = async () => {
        const sql = database!.connect(1)
        await wait()
        return sql`SELECT public.service_delivery_deliver(${WS}, ${session}, 'package_credit', ${PACKAGE}, 1, NULL, NULL, NULL, NULL) AS r`
      }
      const results = await Promise.allSettled([deliver(), deliver()])
      expect(results.every((r) => r.status === 'fulfilled')).toBe(true) // the loser is a REPLAY, not an error
      const consumes =
        await admin`SELECT count(*)::int AS n FROM public.package_credit_ledger WHERE source_document_id = ${session} AND entry_type = 'CONSUME'`
      expect(consumes[0]!.n).toBe(1)
      const releases =
        await admin`SELECT count(*)::int AS n FROM public.journal_entries je JOIN public.package_credit_ledger c ON c.id = je.source_id WHERE je.source_type = 'package_release' AND c.source_document_id = ${session}`
      expect(releases[0]!.n).toBe(1)
      const allocated =
        await admin`SELECT COALESCE(sum(a.released_amount), 0)::float AS r FROM public.package_credit_allocations a JOIN public.package_credit_ledger c ON c.id = a.entry_id WHERE c.source_document_id = ${session}`
      expect(allocated[0]!.r).toBe(100)
    })

    it('GUARD membership-chain RLS with REAL roles: a member reads the allocation rows, an outsider reads none, and neither can write', async () => {
      const admin = database!.connect(1)
      const rows =
        await admin`SELECT count(*)::int AS n FROM public.package_credit_allocations WHERE workspace_id = ${WS}`
      expect(rows[0]!.n).toBeGreaterThan(0)

      const asUser = async (user: string, query: string) => {
        const sql = database!.connect(1)
        return sql.begin(async (tx) => {
          await tx.unsafe(`SET LOCAL ROLE authenticated`)
          await tx.unsafe(`SELECT set_config('request.jwt.claim.sub', '${user}', true)`)
          return tx.unsafe(query)
        })
      }
      const member = await asUser(
        MEMBER,
        `SELECT count(*)::int AS n FROM public.package_credit_allocations`,
      )
      expect(member[0]!.n).toBe(rows[0]!.n)
      const outsider = await asUser(
        OUTSIDER,
        `SELECT count(*)::int AS n FROM public.package_credit_allocations`,
      )
      expect(outsider[0]!.n).toBe(0)
      await expect(
        asUser(
          MEMBER,
          `INSERT INTO public.package_credit_allocations (workspace_id, entry_id, kind, quantity, effective_date) VALUES ('${WS}', gen_random_uuid(), 'CONSUME', 1, '2030-01-01')`,
        ),
      ).rejects.toThrow()
      await expect(
        asUser(MEMBER, `UPDATE public.package_credit_allocations SET quantity = 99`),
      ).rejects.toThrow()
    })

    it('GUARD idempotency: the combined VERIFY passes on the freshly applied chain', async () => {
      const admin = database!.connect(1)
      await admin.unsafe(doc('m5-forward-fix-01-migration.sql'))
      await admin.unsafe(doc('m5-forward-fix-01-migration.sql'))
      const verify = await admin.unsafe(doc('VERIFY-m5-combined.sql'))
      expect(verify.filter((r) => r.pass !== true).map((r) => r.check_name)).toEqual([])
    })
  },
)
