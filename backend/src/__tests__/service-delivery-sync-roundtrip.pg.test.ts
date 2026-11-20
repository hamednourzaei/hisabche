// ============================================
// backend/src/__tests__/service-delivery-sync-roundtrip.pg.test.ts
//
// Shared-core integration audit SC-04 (finding F-003): the seam between the
// service-delivery transaction, the sync change log, and the REAL pull function.
//
// operational-pull-02.pg.test.ts proves the triggers fire on raw writes.
// service-delivery-02.pg.test.ts proves deliver/cancel are atomic. Neither proves
// the two together: that a REAL `service_delivery_deliver` writes its session
// update and its credit consumption into `sync_change_log` under the PROTOCOL
// entity names, in the same transaction, and that the REAL
// `sync_pull_changes_v2` hands both records to a device — with no other
// workspace's rows leaking through.
//
// Real migrations, in their real order:
//   package-credit-ledger-01, service-delivery-01/02/03 (via the shared helper),
//   sync-engine, sync-commit-horizon, sync-scope-01, operational-pull-02 (twice).
//
// ⚠️ WHEN THE EMBEDDED BINARY CANNOT START the tests fail loudly at the guard,
// never pass silently. The pg project's preflight refuses the file first on a
// machine that cannot run Postgres at all.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'
import {
  OTHER_WS,
  setupServiceDelivery,
  WS,
  type Run,
} from './helpers/service-delivery-02-scenarios'

const PORT = freePortSync()
const dir = pgTempDir('hisabche-pg-sd-sync-roundtrip-')
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
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')

const CUST = 'c0000000-0000-4000-8000-000000000113'
const OTHER_CUST = 'c0000000-0000-4000-8000-000000000213'
const SERVICE = '20000000-0000-4000-8000-000000000113'
const PACKAGE = '20000000-0000-4000-8000-000000000213'

let sql: postgres.Sql | undefined
let started = false

const q: Run = async (text, params) => {
  if (!sql) throw new Error('database not started')
  const rows = await sql.unsafe(text, (params ? [...params] : []) as never[])
  return rows as unknown as Array<Record<string, unknown>>
}

let seq = 0
const sid = () => `5e000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`

async function newSession(customer = CUST, workspace = WS): Promise<string> {
  const id = sid()
  await q(
    `INSERT INTO public.service_delivery_sessions (id, workspace_id, customer_id, service_offering_id, session_date,
       start_time, end_time, duration_minutes)
     VALUES ($1, $2, $3, $4, '2026-11-20', '10:00', '11:00', 60)`,
    [id, workspace, customer, SERVICE],
  )
  return id
}

async function grant(quantity: number, customer = CUST, workspace = WS): Promise<void> {
  await q(
    `INSERT INTO public.package_credit_ledger (workspace_id, customer_id, package_product_id, entry_type, quantity)
     VALUES ($1, $2, $3, 'GRANT', $4)`,
    [workspace, customer, PACKAGE, quantity],
  )
}

const deliver = (session: string, entry: string | null, workspace = WS) =>
  q(
    `SELECT public.service_delivery_deliver($1::uuid, $2::uuid, 'package_credit', $3::uuid, 1::numeric,
       NULL::uuid, NULL::text, $4::uuid, NULL::timestamptz) AS r`,
    [workspace, session, PACKAGE, entry],
  ).then((rows) => rows[0]!.r as Record<string, unknown>)

const cancel = (session: string, workspace = WS) =>
  q(
    `SELECT public.service_delivery_cancel($1::uuid, $2::uuid, NULL::uuid, 'wrong customer') AS r`,
    [workspace, session],
  ).then((rows) => rows[0]!.r as Record<string, unknown>)

const logFor = (entityType: string, entityId: string, workspace = WS) =>
  q(
    `SELECT operation, entity_version, workspace_id FROM public.sync_change_log
     WHERE entity_type = $1 AND entity_id = $2 AND workspace_id = $3
     ORDER BY sync_version ASC`,
    [entityType, entityId, workspace],
  )

const pullV2 = (workspace: string, cursor: number, entities: string[] | null) =>
  q(`SELECT * FROM public.sync_pull_changes_v2($1::uuid, $2::bigint, $3::int, $4::text[])`, [
    workspace,
    cursor,
    100,
    entities,
  ])

describe('Postgres: a delivered session and its credit travel the sync road (SC-04)', () => {
  beforeAll(async () => {
    try {
      await pg.initialise()
      await pg.start()
    } catch {
      return // non-elevated Windows (error 1314) or a quarantined binary
    }
    started = true

    const admin = postgres(`postgres://postgres:test@localhost:${PORT}/postgres`)
    await admin`CREATE DATABASE sd_sync_roundtrip_test;`
    await admin.end()

    sql = postgres(`postgres://postgres:test@localhost:${PORT}/sd_sync_roundtrip_test`, {
      max: 2,
      onnotice: () => {},
    })

    // The real service-delivery stack: ledger + sessions + atomic deliver/cancel.
    await setupServiceDelivery(q)

    // The sync engine's own prerequisites, shaped like the real tables it guards.
    await q(
      `
      CREATE TABLE IF NOT EXISTS public.transactions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL,
        version bigint NOT NULL DEFAULT 1
      );
      ALTER TABLE public.invoices
        ADD COLUMN IF NOT EXISTS total numeric,
        ADD COLUMN IF NOT EXISTS subtotal numeric,
        ADD COLUMN IF NOT EXISTS discount_total numeric,
        ADD COLUMN IF NOT EXISTS tax_total numeric,
        ADD COLUMN IF NOT EXISTS currency text,
        ADD COLUMN IF NOT EXISTS type text,
        ADD COLUMN IF NOT EXISTS date date,
        ADD COLUMN IF NOT EXISTS invoice_number text;
      CREATE TABLE IF NOT EXISTS public.product_variants (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL,
        template_product_id uuid,
        sku text NOT NULL DEFAULT '',
        is_active boolean NOT NULL DEFAULT true
      );
      CREATE TABLE IF NOT EXISTS public.repair_tickets (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL,
        customer_id uuid,
        device_label text,
        problem text,
        status text NOT NULL DEFAULT 'received'
      );
      INSERT INTO public.customers (id, workspace_id) VALUES ($1, $2), ($3, $4);
      INSERT INTO public.products (id, workspace_id) VALUES ($5, $6), ($7, $8);
    `,
      [CUST, WS, OTHER_CUST, OTHER_WS, SERVICE, WS, PACKAGE, WS],
    )

    // The sync road itself, in dependency order.
    await q(read('sync-engine-migration.sql'))
    await q(read('sync-commit-horizon-migration.sql'))
    await q(read('sync-scope-01-migration.sql'))
    // Twice: the operational-lift migration must be safe to re-run.
    await q(read('operational-pull-02-migration.sql'))
    await q(read('operational-pull-02-migration.sql'))
  }, 180_000)

  afterAll(async () => {
    if (sql) await sql.end()
    try {
      await pg.stop()
    } catch {
      /* the temp directory is removed either way */
    }
  })

  it('the real delivery writes session + consume to the change log in ONE transaction, under the protocol names', async () => {
    if (!started) return expect(started, 'postgres did not start — run in CI').toBe(true)

    await grant(3)
    const session = await newSession()
    const entry = 'd0000000-0000-4000-8000-000000000113'
    const res = await deliver(session, entry)
    expect(res.replayed).toBe(false)

    // The business facts.
    const s = (
      await q(`SELECT * FROM public.service_delivery_sessions WHERE id = $1`, [session])
    )[0]!
    expect(s.status).toBe('delivered')
    expect(s.settlement_method).toBe('package_credit')
    expect(s.package_credit_id).toBe(entry)
    // Inserted at 1, bumped by the delivery update.
    expect(Number(s.version)).toBe(2)
    const consume = (
      await q(
        `SELECT * FROM public.package_credit_ledger WHERE source_document_type = 'service_delivery' AND source_document_id = $1`,
        [session],
      )
    )[0]!
    expect(consume.entry_type).toBe('CONSUME')
    expect(consume.id).toBe(entry)
    expect(consume.idempotency_key).toBe(`delivery_${session}`)

    // The sync facts: same transaction, protocol entity names, bumped versions.
    const sessionLog = await logFor('service_delivery_sessions', session)
    expect(sessionLog).toEqual([
      { operation: 'create', entity_version: 1, workspace_id: WS },
      { operation: 'update', entity_version: 2, workspace_id: WS },
    ])
    const creditLog = await logFor('package_credit_ledger', entry)
    expect(creditLog).toEqual([{ operation: 'create', entity_version: 1, workspace_id: WS }])
  })

  it('the REAL pull function returns both records, and hydrating them gives the delivered session and its consume', async () => {
    if (!started) return expect(started, 'postgres did not start — run in CI').toBe(true)

    await grant(3)
    const session = await newSession()
    const entry = 'd0000000-0000-4000-8000-000000000213'
    await deliver(session, entry)

    const page = await pullV2(WS, 0, ['service_delivery_sessions', 'package_credit_ledger'])
    const sessionChange = page.find(
      (row) =>
        row.entity_type === 'service_delivery_sessions' &&
        row.entity_id === session &&
        row.operation === 'update',
    )
    const creditChange = page.find(
      (row) => row.entity_type === 'package_credit_ledger' && row.entity_id === entry,
    )
    expect(sessionChange).toBeDefined()
    expect(creditChange).toBeDefined()
    expect(Number(sessionChange!.entity_version)).toBe(2)

    // What SyncService.pull does next: read the row behind each change.
    const hydratedSession = (
      await q(`SELECT * FROM public.service_delivery_sessions WHERE id = $1`, [session])
    )[0]!
    expect(hydratedSession.status).toBe('delivered')
    expect(hydratedSession.package_credit_id).toBe(entry)
    const hydratedCredit = (
      await q(`SELECT * FROM public.package_credit_ledger WHERE id = $1`, [entry])
    )[0]!
    expect(hydratedCredit.entry_type).toBe('CONSUME')
    expect(Number(hydratedCredit.quantity)).toBe(1)

    // The v1 function carries them too (older clients).
    const v1 = await q(`SELECT * FROM public.sync_pull_changes($1::uuid, 0::bigint, 100::int)`, [
      WS,
    ])
    expect(v1.some((row) => row.entity_id === session && row.operation === 'update')).toBe(true)
    expect(v1.some((row) => row.entity_id === entry)).toBe(true)

    // Scoped pull: asking for the ledger only returns no sessions.
    const ledgerOnly = await pullV2(WS, 0, ['package_credit_ledger'])
    expect(ledgerOnly.every((row) => row.entity_type === 'package_credit_ledger')).toBe(true)
    expect(ledgerOnly.some((row) => row.entity_id === entry)).toBe(true)
  })

  it("another workspace's delivery never surfaces in this workspace's pull", async () => {
    if (!started) return expect(started, 'postgres did not start — run in CI').toBe(true)

    await grant(2, OTHER_CUST, OTHER_WS)
    const foreign = await newSession(OTHER_CUST, OTHER_WS)
    const foreignEntry = 'd0000000-0000-4000-8000-000000000313'
    await deliver(foreign, foreignEntry, OTHER_WS)

    const mine = await pullV2(WS, 0, null)
    expect(mine.length).toBeGreaterThan(0)
    expect(mine.every((row) => row.workspace_id === WS)).toBe(true)
    expect(mine.some((row) => row.entity_id === foreign || row.entity_id === foreignEntry)).toBe(
      false,
    )

    const theirs = await pullV2(OTHER_WS, 0, null)
    expect(theirs.length).toBeGreaterThan(0)
    expect(theirs.every((row) => row.workspace_id === OTHER_WS)).toBe(true)
    expect(theirs.some((row) => row.entity_id === foreign)).toBe(true)
  })

  it('a cancellation reverses the credit, and the reversal travels the same road', async () => {
    if (!started) return expect(started, 'postgres did not start — run in CI').toBe(true)

    await grant(3)
    const session = await newSession()
    const entry = 'd0000000-0000-4000-8000-000000000413'
    await deliver(session, entry)
    const cursorRows = await q(
      `SELECT COALESCE(MAX(sync_version), 0) AS head FROM public.sync_change_log`,
    )
    const head = Number(cursorRows[0]!.head)

    const res = await cancel(session)
    expect(res.replayed).toBe(false)

    const s = (
      await q(`SELECT * FROM public.service_delivery_sessions WHERE id = $1`, [session])
    )[0]!
    expect(s.status).toBe('cancelled')
    expect(Number(s.version)).toBe(3)
    const reversal = (
      await q(
        `SELECT * FROM public.package_credit_ledger WHERE entry_type = 'REVERSAL' AND source_document_id = $1`,
        [session],
      )
    )[0]!
    expect(reversal.reference_entry_id).toBe(entry)

    // Only the NEW changes arrive after the cursor — the reversal and the cancel.
    const page = await pullV2(WS, head, ['service_delivery_sessions', 'package_credit_ledger'])
    expect(page.some((row) => row.entity_id === session && row.operation === 'update')).toBe(true)
    expect(page.some((row) => row.entity_id === reversal.id && row.operation === 'create')).toBe(
      true,
    )
    expect(page.every((row) => Number(row.sync_version) > head)).toBe(true)
  })

  it('a replayed delivery adds NO second change-log entry', async () => {
    if (!started) return expect(started, 'postgres did not start — run in CI').toBe(true)

    await grant(3)
    const session = await newSession()
    const entry = 'd0000000-0000-4000-8000-000000000513'
    await deliver(session, entry)
    const before = (await logFor('service_delivery_sessions', session)).length
    const creditBefore = (await logFor('package_credit_ledger', entry)).length

    const again = await deliver(session, entry)
    expect(again.replayed).toBe(true)

    expect((await logFor('service_delivery_sessions', session)).length).toBe(before)
    expect((await logFor('package_credit_ledger', entry)).length).toBe(creditBefore)
  })
})
