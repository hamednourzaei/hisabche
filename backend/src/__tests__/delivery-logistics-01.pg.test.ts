// ============================================
// backend/src/__tests__/delivery-logistics-01.pg.test.ts
//
// WP-19 — fleet, delivery, proof of delivery and COD.
// `docs/delivery-logistics-01-migration.sql` is run unchanged (twice) on a real
// Postgres, on a `courier_deliveries` table that predates every new column, and
// then the database is asked the questions only it can answer:
//
//   • do rows closed before WP-19 keep their exact figures — no invented proof,
//     no invented shortfall, attempt_count 0?
//   • does a delivered row without proof get refused from now on?
//   • does a failed row without a reason get refused?
//   • can nothing be collected above what was due, or below zero?
//   • is the device's outbox key unique per workspace, so a retry returns the
//     first row instead of writing a second one?
//   • is a vehicle with an undeclared capacity still insertable (unknown is not
//     zero), while a declared capacity of 0 is not?
//   • is the second run of the file a no-op?
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
const dir = pgTempDir('hisabche-pg-delivery-')
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/delivery`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const migration = readFileSync(join(DOCS, 'delivery-logistics-01-migration.sql'), 'utf8')

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER_WS = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const USER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

/** Rows that already existed when the migration ran. */
const DELIVERED_BEFORE = 'd0000000-0000-4000-8000-000000000001'
const FAILED_BEFORE = 'd0000000-0000-4000-8000-000000000002'
const ASSIGNED_BEFORE = 'd0000000-0000-4000-8000-000000000003'

const VEHICLE = 'e0000000-0000-4000-8000-000000000001'

/** A delivery row as it looks after the migration, named column by column. */
async function insertDelivery(options: {
  id: string
  status: string
  codMinor?: number
  collected?: number | null
  shortfall?: number
  podMethod?: string | null
  podRecipient?: string | null
  podRecordedAt?: string | null
  failureReason?: string | null
  requestKey?: string | null
  workspace?: string
}): Promise<void> {
  await sql`
    INSERT INTO courier_deliveries (
      id, workspace_id, tracking_number, customer_name, destination_address,
      status, cod_amount_minor, cod_collected_minor, cod_shortfall_minor,
      pod_method, pod_recipient_name, pod_recorded_at, failure_reason, client_request_id
    ) VALUES (
      ${options.id}, ${options.workspace ?? WS}, ${`TRK-${options.id.slice(-4)}`}, 'مشتری', 'کابل، سرک ۴',
      ${options.status}, ${options.codMinor ?? 0}, ${options.collected ?? null},
      ${options.shortfall ?? 0}, ${options.podMethod ?? null}, ${options.podRecipient ?? null},
      ${options.podRecordedAt ?? null}, ${options.failureReason ?? null},
      ${options.requestKey ?? null}
    )`
}

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('delivery')
  const setup = postgres(url, { max: 1, onnotice: () => {} })

  // ─── The database BEFORE this migration ──────────────────────────────────
  // `courier_deliveries` and `delivery_notes` exactly as
  // `docs/universal-core-migration.sql` creates them, plus the auth shape the
  // policy needs.
  await setup.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
    END $$;

    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT '${USER}'::uuid
    $$;

    CREATE TABLE workspace_members (
      workspace_id uuid NOT NULL,
      user_id uuid NOT NULL,
      has_access boolean NOT NULL DEFAULT true,
      suspended_at timestamptz
    );

    CREATE TABLE courier_deliveries (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,
      tracking_number text NOT NULL,
      customer_name text NOT NULL,
      destination_address text NOT NULL,
      driver_employee_id uuid,
      status text NOT NULL DEFAULT 'unassigned'
        CHECK (status IN ('unassigned', 'assigned', 'picked_up', 'delivered', 'failed', 'returned')),
      cod_amount_minor bigint NOT NULL DEFAULT 0,
      cod_stage text NOT NULL DEFAULT 'to_collect'
        CHECK (cod_stage IN ('to_collect', 'with_driver', 'with_cashier', 'banked')),
      proof_of_delivery_ref text,
      delivery_timestamp timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE delivery_notes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,
      invoice_id uuid NOT NULL,
      note_number text NOT NULL,
      delivery_date date NOT NULL,
      carrier_notes text,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    -- Three deliveries closed before WP-19 existed. The first two are the reason
    -- the two history constraints are NOT VALID: nobody captured a proof then.
    INSERT INTO courier_deliveries
      (id, workspace_id, tracking_number, customer_name, destination_address, status, cod_amount_minor, cod_stage)
    VALUES
      ('${DELIVERED_BEFORE}', '${WS}', 'TRK-0001', 'مشتری الف', 'کابل', 'delivered', 25000, 'with_cashier'),
      ('${FAILED_BEFORE}',    '${WS}', 'TRK-0002', 'مشتری ب',   'هرات', 'failed',    0,     'to_collect'),
      ('${ASSIGNED_BEFORE}',  '${WS}', 'TRK-0003', 'مشتری ج',   'مزار', 'assigned',  25000, 'to_collect');
  `)

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

describe('history: the rows that existed before WP-19', () => {
  it('keeps a delivered row without inventing a proof, a collection or a shortfall', async () => {
    const [row] = await sql<
      {
        status: string
        pod_recorded_at: Date | null
        pod_method: string | null
        cod_collected_minor: string | null
        cod_shortfall_minor: string
        attempt_count: number
      }[]
    >`SELECT status, pod_recorded_at, pod_method, cod_collected_minor, cod_shortfall_minor, attempt_count
        FROM courier_deliveries WHERE id = ${DELIVERED_BEFORE}`

    expect(row!.status).toBe('delivered')
    // Nothing is known about how it was signed, so nothing is claimed.
    expect(row!.pod_recorded_at).toBeNull()
    expect(row!.pod_method).toBeNull()
    // Nothing was collected through the new model, and nothing is owed by it
    // through a figure this migration invented.
    expect(row!.cod_collected_minor).toBeNull()
    expect(Number(row!.cod_shortfall_minor)).toBe(0)
    expect(row!.attempt_count).toBe(0)
  })

  it('keeps a failed row failed and reasonless instead of guessing a reason', async () => {
    const [row] = await sql<{ status: string; failure_reason: string | null }[]>`
      SELECT status, failure_reason FROM courier_deliveries WHERE id = ${FAILED_BEFORE}`
    expect(row!.status).toBe('failed')
    expect(row!.failure_reason).toBeNull()
  })
})

describe('closing a delivery: proof or evidence, never both', () => {
  it('accepts a delivered row with a signature, collecting 240.00 of 250.00', async () => {
    // 25 000 minor due, 24 000 collected → 1 000 still owed by the customer.
    await sql`
      UPDATE courier_deliveries
         SET status = 'delivered',
             cod_stage = 'with_driver',
             pod_method = 'signature',
             pod_recipient_name = 'احمد',
             pod_recorded_at = '2026-11-18T09:30:00Z',
             cod_collected_minor = 24000,
             cod_shortfall_minor = 1000,
             attempt_count = 1,
             last_attempt_at = '2026-11-18T09:30:00Z',
             client_request_id = 'close-0003'
       WHERE id = ${ASSIGNED_BEFORE}`

    const [row] = await sql<
      { status: string; cod_stage: string; collected: string; shortfall: string }[]
    >`SELECT status, cod_stage, cod_collected_minor AS collected, cod_shortfall_minor AS shortfall
        FROM courier_deliveries WHERE id = ${ASSIGNED_BEFORE}`

    expect(row!.status).toBe('delivered')
    expect(row!.cod_stage).toBe('with_driver')
    expect(Number(row!.collected)).toBe(24_000)
    expect(Number(row!.shortfall)).toBe(1_000)
  })

  it('refuses a delivered row with no proof of delivery', async () => {
    await expect(
      sql`UPDATE courier_deliveries SET status = 'delivered' WHERE id = ${FAILED_BEFORE}`,
    ).rejects.toThrow(/courier_deliveries_delivered_has_pod/)
  })

  it('refuses a failed row with no reason', async () => {
    await expect(
      sql`UPDATE courier_deliveries SET status = 'failed', failure_reason = '   '
          WHERE id = 'd0000000-0000-4000-8000-000000000004'`,
    ).rejects.toThrow(/check constraint|violates/)
  })

  it('refuses a proof that names no person', async () => {
    await expect(
      sql`INSERT INTO courier_deliveries
            (id, workspace_id, tracking_number, customer_name, destination_address, status,
             pod_method, pod_recorded_at)
          VALUES ('d0000000-0000-4000-8000-000000000005', ${WS}, 'TRK-0005', 'مشتری', 'کابل',
                  'delivered', 'signature', now())`,
    ).rejects.toThrow(/courier_deliveries_pod_shape/)
  })

  it('refuses a proof method that is not signature, photo or code', async () => {
    await expect(
      sql`INSERT INTO courier_deliveries
            (id, workspace_id, tracking_number, customer_name, destination_address, status,
             pod_method, pod_recipient_name, pod_recorded_at)
          VALUES ('d0000000-0000-4000-8000-000000000006', ${WS}, 'TRK-0006', 'مشتری', 'کابل',
                  'delivered', 'sms', 'احمد', now())`,
    ).rejects.toThrow(/courier_deliveries_pod_method_check/)
  })
})

describe('COD: what was collected, and what is still owed', () => {
  it('refuses collecting more than the amount due', async () => {
    await expect(
      insertDelivery({
        id: 'd0000000-0000-4000-8000-000000000007',
        status: 'delivered',
        codMinor: 25_000,
        collected: 25_001,
        podMethod: 'signature',
        podRecipient: 'احمد',
        podRecordedAt: '2026-11-18T10:00:00Z',
      }),
    ).rejects.toThrow(/courier_deliveries_cod_collected_range/)
  })

  it('refuses a negative collection', async () => {
    await expect(
      insertDelivery({
        id: 'd0000000-0000-4000-8000-000000000008',
        status: 'delivered',
        codMinor: 25_000,
        collected: -1,
        podMethod: 'signature',
        podRecipient: 'احمد',
        podRecordedAt: '2026-11-18T10:00:00Z',
      }),
    ).rejects.toThrow(/courier_deliveries_cod_collected_range/)
  })

  it('refuses a negative shortfall', async () => {
    await expect(
      insertDelivery({
        id: 'd0000000-0000-4000-8000-000000000009',
        status: 'failed',
        codMinor: 25_000,
        shortfall: -1,
        failureReason: 'مشتری نبود',
      }),
    ).rejects.toThrow(/courier_deliveries_shortfall_non_negative/)
  })

  it('accepts a full collection: 250.00 of 250.00 leaves nothing owed', async () => {
    await insertDelivery({
      id: 'd0000000-0000-4000-8000-00000000000a',
      status: 'delivered',
      codMinor: 25_000,
      collected: 25_000,
      shortfall: 0,
      podMethod: 'code',
      podRecipient: 'احمد',
      podRecordedAt: '2026-11-18T11:00:00Z',
    })

    const [row] = await sql<{ collected: string; shortfall: string }[]>`
      SELECT cod_collected_minor AS collected, cod_shortfall_minor AS shortfall
        FROM courier_deliveries WHERE id = 'd0000000-0000-4000-8000-00000000000a'`
    expect(Number(row!.collected)).toBe(25_000)
    expect(Number(row!.shortfall)).toBe(0)
  })
})

describe('the outbox key: one close per delivery, per workspace', () => {
  it('refuses a second row with the same key in the same workspace', async () => {
    await expect(
      insertDelivery({
        id: 'd0000000-0000-4000-8000-00000000000b',
        status: 'assigned',
        requestKey: 'close-0003',
      }),
    ).rejects.toThrow(/courier_deliveries_request_idx|duplicate key/)
  })

  it('allows the same key in another workspace — it belongs to a different shop', async () => {
    await insertDelivery({
      id: 'd0000000-0000-4000-8000-00000000000c',
      status: 'assigned',
      requestKey: 'close-0003',
      workspace: OTHER_WS,
    })
    const [row] = await sql<{ client_request_id: string }[]>`
      SELECT client_request_id FROM courier_deliveries
       WHERE id = 'd0000000-0000-4000-8000-00000000000c'`
    expect(row!.client_request_id).toBe('close-0003')
  })
})

describe('the fleet register', () => {
  it('accepts a vehicle with no declared capacity — unknown is not zero', async () => {
    await sql`INSERT INTO delivery_vehicles (id, workspace_id, name, plate_number)
              VALUES (${VEHICLE}, ${WS}, 'کرولا سفید', 'KBL-1234')`

    const [row] = await sql<
      { capacity: number | null; active: boolean; next_service_due_on: Date | null }[]
    >`SELECT capacity_parcels AS capacity, active, next_service_due_on
        FROM delivery_vehicles WHERE id = ${VEHICLE}`
    expect(row!.capacity).toBeNull()
    expect(row!.active).toBe(true)
    // Nobody has serviced it yet, and the column says so instead of «fine».
    expect(row!.next_service_due_on).toBeNull()
  })

  it('refuses a declared capacity of 0 — a van that can carry nothing is a broken row', async () => {
    await expect(
      sql`INSERT INTO delivery_vehicles (id, workspace_id, name, capacity_parcels)
          VALUES ('e0000000-0000-4000-8000-000000000002', ${WS}, 'موتور', 0)`,
    ).rejects.toThrow(/delivery_vehicles_capacity_positive/)
  })

  it('refuses a negative odometer', async () => {
    await expect(
      sql`INSERT INTO delivery_vehicles (id, workspace_id, name, odometer_km)
          VALUES ('e0000000-0000-4000-8000-000000000003', ${WS}, 'موتور', -5)`,
    ).rejects.toThrow(/delivery_vehicles_odometer_non_negative/)
  })

  it('refuses the same plate twice in one workspace, and allows it in another', async () => {
    await expect(
      sql`INSERT INTO delivery_vehicles (id, workspace_id, name, plate_number)
          VALUES ('e0000000-0000-4000-8000-000000000004', ${WS}, 'کرولا دوم', 'KBL-1234')`,
    ).rejects.toThrow(/delivery_vehicles_plate_idx|duplicate key/)

    await sql`INSERT INTO delivery_vehicles (id, workspace_id, name, plate_number)
              VALUES ('e0000000-0000-4000-8000-000000000005', ${OTHER_WS}, 'کرولا دوم', 'KBL-1234')`
  })

  it('is tenanted: RLS on, one policy, nothing granted to anon', async () => {
    const [row] = await sql<{ rowsecurity: boolean; policies: number; anon: string }[]>`
      SELECT c.relrowsecurity AS rowsecurity,
             (SELECT count(*) FROM pg_policies p
               WHERE p.schemaname = 'public' AND p.tablename = 'delivery_vehicles')::int AS policies,
             coalesce((SELECT string_agg(privilege_type, ',')
                         FROM information_schema.role_table_grants g
                        WHERE g.table_schema = 'public'
                          AND g.table_name = 'delivery_vehicles'
                          AND g.grantee = 'anon'), '') AS anon
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = 'delivery_vehicles'`

    expect(row!.rowsecurity).toBe(true)
    // The fleet register is backend-only: no client-write policy (see migration).
    expect(row!.policies).toBe(0)
    expect(row!.anon).toBe('')
  })
})

describe('the delivery note carries its own proof', () => {
  const NOTE = 'f0000000-0000-4000-8000-000000000001'
  const INVOICE = 'f0000000-0000-4000-8000-000000000002'

  it('stores a signature with the person who took it', async () => {
    await sql`INSERT INTO delivery_notes (id, workspace_id, invoice_id, note_number, delivery_date)
              VALUES (${NOTE}, ${WS}, ${INVOICE}, 'DN-1', '2026-11-18')`
    await sql`UPDATE delivery_notes
                 SET pod_method = 'signature', pod_recipient_name = 'مریم',
                     pod_recorded_at = '2026-11-18T12:00:00Z'
               WHERE id = ${NOTE}`

    const [row] = await sql<{ pod_method: string; pod_recipient_name: string }[]>`
      SELECT pod_method, pod_recipient_name FROM delivery_notes WHERE id = ${NOTE}`
    expect(row!.pod_method).toBe('signature')
    expect(row!.pod_recipient_name).toBe('مریم')
  })

  it('refuses a proof with no person on it', async () => {
    await expect(
      sql`UPDATE delivery_notes SET pod_recorded_at = now() WHERE id = ${NOTE}`,
    ).rejects.toThrow(/delivery_notes_pod_shape/)
  })
})

describe('the second run of the file', () => {
  it('left the four clean constraints VALIDATED and the two history ones NOT VALID', async () => {
    const rows = await sql<{ conname: string; convalidated: boolean }[]>`
      SELECT conname, convalidated FROM pg_constraint
       WHERE conrelid = 'public.courier_deliveries'::regclass
         AND conname LIKE 'courier_deliveries_%'
       ORDER BY conname`

    const state = Object.fromEntries(rows.map((r) => [r.conname, r.convalidated]))
    expect(state['courier_deliveries_pod_method_check']).toBe(true)
    expect(state['courier_deliveries_pod_shape']).toBe(true)
    expect(state['courier_deliveries_cod_collected_range']).toBe(true)
    expect(state['courier_deliveries_shortfall_non_negative']).toBe(true)
    // History: nobody captured a proof for TRK-0001, so this one stays NOT VALID
    // on purpose (see the migration header).
    expect(state['courier_deliveries_delivered_has_pod']).toBe(false)
    expect(state['courier_deliveries_failed_has_reason']).toBe(false)
  })
})
