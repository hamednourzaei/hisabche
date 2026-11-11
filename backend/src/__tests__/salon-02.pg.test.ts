// ============================================
// backend/src/__tests__/salon-02.pg.test.ts
//
// Proves V59.1 Salon completion on real Postgres:
//   1. Idempotent salon-02-migration.sql runs twice + VERIFY-salon-02 passes
//   2. checked_in + in_progress transitions via service_delivery_move_status are atomic,
//      idempotent on replay, and audited in service_delivery_status_audit
//   3. Concurrent 2-connection double-booking for the SAME practitioner OR SAME chair
//      serializes cleanly: 1 succeeds, 1 fails (PRACTITIONER_DOUBLE_BOOKED / SERVICE_RESOURCE_BUSY)
//   4. Cross-tenant status move refuses cleanly ('not_found')
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'

const PORT = freePortSync()
const dir = pgTempDir('hisabche-pg-salon02-')
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/salon02`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const readDoc = (name: string) => readFileSync(join(DOCS, name), 'utf8')

const U = '11111111-1111-4111-8111-111111111111'
const W1 = '22222222-2222-4222-8222-222222222221'
const W2 = '22222222-2222-4222-8222-222222222222'
const C = '33333333-3333-4333-8333-333333333333'
const P = '44444444-4444-4444-8444-444444444444'
const EMP = '55555555-5555-4555-8555-555555555555'

const BASE = `
  CREATE EXTENSION IF NOT EXISTS pgcrypto;
  CREATE TABLE public.workspaces (id uuid PRIMARY KEY);
  CREATE TABLE public.workspace_members (workspace_id uuid, user_id uuid);
  CREATE TABLE public.customers (id uuid PRIMARY KEY, workspace_id uuid);
  CREATE TABLE public.products (id uuid PRIMARY KEY, workspace_id uuid);
  CREATE TABLE public.employees (id uuid PRIMARY KEY, workspace_id uuid);
  CREATE TABLE public.branches (id uuid PRIMARY KEY, workspace_id uuid);
  CREATE TABLE public.departments (id uuid PRIMARY KEY, workspace_id uuid);
  CREATE TABLE public.warehouses (id uuid PRIMARY KEY, workspace_id uuid, deleted_at timestamptz);
  CREATE TABLE public.invoices (id uuid PRIMARY KEY, workspace_id uuid);
  CREATE TABLE public.package_credit_ledger (id uuid PRIMARY KEY, workspace_id uuid);
`

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('salon02')
  sql = postgres(url, { max: 4 })
  await sql.unsafe(BASE)
  await sql`INSERT INTO public.workspaces (id) VALUES (${W1}), (${W2})`
  await sql`INSERT INTO public.customers (id, workspace_id) VALUES (${C}, ${W1})`
  await sql`INSERT INTO public.products (id, workspace_id) VALUES (${P}, ${W1})`
  await sql`INSERT INTO public.employees (id, workspace_id) VALUES (${EMP}, ${W1})`

  await sql.unsafe(readDoc('service-delivery-01-migration.sql'))
  await sql.unsafe(readDoc('salon-01-migration.sql'))
  const s02 = readDoc('salon-02-migration.sql')
  await sql.unsafe(s02)
  await sql.unsafe(s02)
}, 90_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
})

describe('salon-02 checked_in/in_progress audit & concurrent double-booking guard', () => {
  it('passes all VERIFY-salon-02 checks', async () => {
    const [row] = await sql.unsafe(readDoc('VERIFY-salon-02.sql'))
    for (const [k, v] of Object.entries(row ?? {})) {
      expect(v, k).toBe(true)
    }
  })

  it('transitions scheduled -> checked_in -> in_progress idempotently and audits every step', async () => {
    const [sess] = await sql`
      INSERT INTO public.service_delivery_sessions (
        workspace_id, customer_id, service_offering_id, practitioner_id,
        session_date, start_time, end_time, duration_minutes, settlement_method
      ) VALUES (
        ${W1}, ${C}, ${P}, ${EMP}, '2026-11-12', '09:00', '10:00', 60, 'complementary'
      ) RETURNING id
    `

    const [m1] = await sql`
      SELECT public.service_delivery_move_status(${W1}, ${sess!.id}, 'checked_in', ${U}) AS r
    `
    expect((m1!.r as { status: string; replayed: boolean }).status).toBe('checked_in')
    expect((m1!.r as { replayed: boolean }).replayed).toBe(false)

    // Replay is idempotent no-op
    const [m1Replay] = await sql`
      SELECT public.service_delivery_move_status(${W1}, ${sess!.id}, 'checked_in', ${U}) AS r
    `
    expect((m1Replay!.r as { replayed: boolean }).replayed).toBe(true)

    // Cross-tenant attempt refused
    const [crossTenant] = await sql`
      SELECT public.service_delivery_move_status(${W2}, ${sess!.id}, 'in_progress', ${U}) AS r
    `
    expect((crossTenant!.r as { outcome: string }).outcome).toBe('not_found')

    const [m2] = await sql`
      SELECT public.service_delivery_move_status(${W1}, ${sess!.id}, 'in_progress', ${U}) AS r
    `
    expect((m2!.r as { status: string }).status).toBe('in_progress')

    const audit = await sql`
      SELECT from_status, to_status
        FROM public.service_delivery_status_audit
       WHERE workspace_id = ${W1} AND session_id = ${sess!.id}
       ORDER BY changed_at ASC
    `
    expect(audit.map((a) => `${a.from_status ?? 'null'}->${a.to_status}`)).toEqual([
      'null->scheduled',
      'scheduled->checked_in',
      'checked_in->in_progress',
    ])
  })

  it('refuses concurrent overlapping booking for the same practitioner and same chair', async () => {
    const [chair] = await sql`
      INSERT INTO public.service_resources (workspace_id, name, kind)
      VALUES (${W1}, 'Chair Concurrent', 'chair') RETURNING id
    `

    const bookPractitioner = (start: string, end: string) =>
      sql`INSERT INTO public.service_delivery_sessions (
            workspace_id, customer_id, service_offering_id, practitioner_id,
            session_date, start_time, end_time, duration_minutes, settlement_method
          ) VALUES (
            ${W1}, ${C}, ${P}, ${EMP}, '2026-11-15', ${start}, ${end}, 60, 'complementary'
          ) RETURNING id`

    const staffRace = await Promise.allSettled([
      bookPractitioner('10:00', '11:00'),
      bookPractitioner('10:30', '11:30'),
    ])
    expect(staffRace.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(staffRace.filter((r) => r.status === 'rejected')).toHaveLength(1)

    const bookChair = (start: string, end: string) =>
      sql`INSERT INTO public.service_delivery_sessions (
            workspace_id, customer_id, service_offering_id, resource_id,
            session_date, start_time, end_time, duration_minutes, settlement_method
          ) VALUES (
            ${W1}, ${C}, ${P}, ${chair!.id}, '2026-11-16', ${start}, ${end}, 60, 'complementary'
          ) RETURNING id`

    const chairRace = await Promise.allSettled([
      bookChair('14:00', '15:00'),
      bookChair('14:15', '15:15'),
    ])
    expect(chairRace.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(chairRace.filter((r) => r.status === 'rejected')).toHaveLength(1)
  })
})
