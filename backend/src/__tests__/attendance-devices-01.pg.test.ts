// ============================================
// docs/attendance-devices-01-migration.sql — after attendance-self-01, as a
// person would run them — TWICE, on a real Postgres with Supabase's default
// privileges; then its VERIFY; then each of the six rules with the write it
// must refuse and the write it must allow.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const PORT = 55600 + Math.floor(Math.random() * 800)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-attendance-devices-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/att_dev`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const GONE = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const MANAGER = '11111111-1111-4111-8111-111111111111'
const AHMAD = 'eeeeeeee-0000-4000-8000-00000000000a'
const TASNIM = 'eeeeeeee-0000-4000-8000-0000000000a2'
const THEIRS = 'eeeeeeee-0000-4000-8000-00000000000b'
const LEAVING = 'eeeeeeee-0000-4000-8000-00000000000c'

let counter = 0
const hash = () => (++counter).toString(16).padStart(64, '0')

async function device(workspace = WS, name = 'Front door') {
  const [row] = await sql`
    INSERT INTO public.attendance_terminals (workspace_id, name, key_hash, key_prefix, created_by)
    VALUES (${workspace}, ${name}, ${hash()}, 'hsd_test', ${MANAGER})
    RETURNING id
  `
  return row!.id as string
}

async function map(deviceId: string | null, userId: string, employee: string, workspace = WS) {
  await sql`
    INSERT INTO public.attendance_terminal_identities
      (workspace_id, device_id, external_user_id, employee_id, created_by)
    VALUES (${workspace}, ${deviceId}, ${userId}, ${employee}, ${MANAGER})
  `
}

type Sent = {
  id: string
  user: string
  day: string
  at: string
  direction?: string
  method?: string
}
async function ingest(deviceId: string, events: Sent[], cursor: string | null = null) {
  const body = events.map((event) => ({
    raw_id: event.id,
    user_id: event.user,
    day: event.day,
    at: event.at,
    direction: event.direction ?? 'unknown',
    method: event.method ?? 'FINGERPRINT',
    payload: { seen: event.at },
  }))
  const [row] = await sql`
    SELECT public.attendance_device_ingest(
      ${deviceId}, 'Asia/Kabul', ${JSON.stringify(body)}::text::jsonb, ${cursor}
    ) AS out
  `
  return row!.out as Record<string, number>
}

const dayOf = async (employee: string, day: string) =>
  sql`
    SELECT status, check_in::text AS check_in, check_out::text AS check_out, source
      FROM public.attendance WHERE employee_id = ${employee} AND date = ${day}::date
  `
const statesOf = async (deviceId: string) =>
  (
    await sql`
      SELECT raw_event_id, state FROM public.attendance_terminal_events
       WHERE device_id = ${deviceId} ORDER BY occurred_on, occurred_time, raw_event_id
    `
  ).map((row) => `${row.raw_event_id}:${row.state}`)

async function refusal(run: () => Promise<unknown>): Promise<string> {
  try {
    await run()
    return 'ALLOWED'
  } catch (error) {
    return (error as Error).message
  }
}

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('att_dev')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    END $$;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

    CREATE TABLE workspaces (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL);
    CREATE TABLE branches (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,
      name text NOT NULL
    );
    CREATE TABLE employees (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid,
      first_name text
    );
    CREATE TABLE attendance (
      id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      employee_id uuid NOT NULL,
      date        date NOT NULL,
      check_in    time without time zone,
      check_out   time without time zone,
      status      text,
      notes       text,
      user_id     uuid NOT NULL,
      created_at  timestamp without time zone DEFAULT now(),
      updated_at  timestamp without time zone DEFAULT now(),
      workspace_id uuid
    );
    CREATE UNIQUE INDEX attendance_one_per_employee_day
      ON attendance (workspace_id, employee_id, date) WHERE workspace_id IS NOT NULL;

    -- As on the live database: the older workforce schema owns these two
    -- names, in another shape. The terminals must not need, touch or trip
    -- over them.
    CREATE TABLE attendance_devices (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,
      name text NOT NULL,
      status text NOT NULL DEFAULT 'active'
    );
    CREATE TABLE attendance_device_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,
      device_id uuid REFERENCES attendance_devices(id),
      payload jsonb NOT NULL,
      payload_hash text NOT NULL,
      processing_status text NOT NULL DEFAULT 'pending'
    );

    INSERT INTO workspaces (id, name) VALUES ('${WS}', 'A'), ('${OTHER}', 'B'), ('${GONE}', 'going');
    INSERT INTO employees (id, workspace_id, first_name) VALUES
      ('${AHMAD}', '${WS}', 'Ahmad'), ('${TASNIM}', '${WS}', 'Tasnim'),
      ('${THEIRS}', '${OTHER}', 'Theirs'), ('${LEAVING}', '${GONE}', 'Leaving');
  `)

  // In the order a person runs them, and each of them twice.
  for (const name of ['attendance-self-01-migration.sql', 'attendance-devices-01-migration.sql']) {
    await setup.unsafe(read(name))
    await setup.unsafe(read(name))
  }
  // …and the first one again AFTER the second: it must not narrow what the
  // second widened (attendance.source = 'device').
  await setup.unsafe(read('attendance-self-01-migration.sql'))
  await setup.end()

  sql = postgres(url, { max: 6, onnotice: () => {} })
}, 120_000)

afterAll(async () => {
  if (sql) await sql.end()
  try {
    await pg.stop()
  } catch {
    // teardown only
  }
  rmSync(dir, { recursive: true, force: true })
})

describe('docs/attendance-devices-01-migration.sql', () => {
  it('ran twice (and survives the first script run again); both VERIFY files say ok', async () => {
    for (const name of ['VERIFY-attendance-devices-01.sql', 'VERIFY-attendance-self-01.sql']) {
      const rows = await sql.unsafe(read(name))
      expect(rows.length, name).toBeGreaterThan(15)
      expect(
        rows.filter((row) => row.ok !== true).map((row) => row.name),
        name,
      ).toEqual([])
    }
  })

  it('⚠️ with Supabase default grants, the browser roles reach nothing', async () => {
    for (const role of ['anon', 'authenticated']) {
      for (const table of [
        'attendance_terminals',
        'attendance_terminal_identities',
        'attendance_terminal_events',
      ]) {
        const [row] = await sql`
          SELECT has_table_privilege(${role}, ${'public.' + table}, 'SELECT') AS can
        `
        expect(row!.can, `${role} ${table}`).toBe(false)
      }
    }
    const fns = await sql`
      SELECT p.proname,
             has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
             has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authed,
             has_function_privilege('service_role', p.oid, 'EXECUTE') AS service
        FROM pg_proc p
       WHERE p.pronamespace = 'public'::regnamespace AND (p.proname LIKE 'attendance_device_%' OR p.proname LIKE 'attendance_terminal_%')
       ORDER BY p.proname
    `
    expect(fns.map((fn) => [fn.proname, fn.anon, fn.authed, fn.service])).toEqual([
      ['attendance_device_ingest', false, false, true],
      ['attendance_device_reprocess', false, false, true],
      // Settling a day is an inner step: not callable on its own.
      ['attendance_device_settle', false, false, false],
      ['attendance_terminal_events_guard', false, false, false],
    ])
  })

  it('rule 4 — the day is the earliest reading and the latest; a lone reading is an open day', async () => {
    const door = await device()
    await map(door, '182', AHMAD)

    const first = await ingest(door, [{ id: 'e1', user: '182', day: '2026-10-01', at: '08:03:10' }])
    expect(first).toEqual({
      received: 1,
      redelivered: 0,
      unmatched: 0,
      duplicate: 0,
      applied: 1,
      held: 0,
    })
    // One reading: arrived, not yet left. No check-out is invented.
    expect(await dayOf(AHMAD, '2026-10-01')).toEqual([
      { status: 'present', check_in: '08:03:10', check_out: null, source: 'device' },
    ])

    await ingest(door, [
      { id: 'e2', user: '182', day: '2026-10-01', at: '12:30:00' },
      { id: 'e3', user: '182', day: '2026-10-01', at: '16:45:20' },
    ])
    // Three readings, one record: 08:03 in, 16:45 out. The lunch reading is
    // kept as an event and changes neither end.
    expect(await dayOf(AHMAD, '2026-10-01')).toEqual([
      { status: 'present', check_in: '08:03:10', check_out: '16:45:20', source: 'device' },
    ])
    expect(await statesOf(door)).toEqual(['e1:applied', 'e2:applied', 'e3:applied'])
  })

  it('rule 4 — events that arrive out of order give the same day', async () => {
    const door = await device()
    await map(door, '7', TASNIM)
    await ingest(door, [{ id: 'late', user: '7', day: '2026-10-02', at: '17:00:00' }])
    await ingest(door, [{ id: 'early', user: '7', day: '2026-10-02', at: '07:55:00' }])
    expect(await dayOf(TASNIM, '2026-10-02')).toEqual([
      { status: 'present', check_in: '07:55:00', check_out: '17:00:00', source: 'device' },
    ])
  })

  it('rule 4 — a device that says «in» and «out» is believed; an exit alone invents no arrival', async () => {
    const door = await device()
    await map(door, '9', TASNIM)
    await ingest(door, [
      { id: 'x1', user: '9', day: '2026-10-03', at: '18:00:00', direction: 'out' },
    ])
    expect(await dayOf(TASNIM, '2026-10-03')).toEqual([
      { status: 'present', check_in: null, check_out: '18:00:00', source: 'device' },
    ])
    await ingest(door, [
      { id: 'x2', user: '9', day: '2026-10-03', at: '09:00:00', direction: 'in' },
      // A second «in» after lunch is not a departure.
      { id: 'x3', user: '9', day: '2026-10-03', at: '13:00:00', direction: 'in' },
    ])
    expect(await dayOf(TASNIM, '2026-10-03')).toEqual([
      { status: 'present', check_in: '09:00:00', check_out: '18:00:00', source: 'device' },
    ])
  })

  it('rule 1 — the same batch delivered twice writes nothing the second time', async () => {
    const door = await device()
    await map(door, '182', AHMAD)
    const batch: Sent[] = [
      { id: 'a', user: '182', day: '2026-10-04', at: '08:00:00' },
      { id: 'b', user: '182', day: '2026-10-04', at: '16:00:00' },
    ]
    await ingest(door, batch)
    const again = await ingest(door, batch)
    expect(again).toEqual({
      received: 2,
      redelivered: 2,
      unmatched: 0,
      duplicate: 0,
      applied: 0,
      held: 0,
    })
    const [row] = await sql`
      SELECT COUNT(*)::int AS n FROM public.attendance_terminal_events WHERE device_id = ${door}
    `
    expect(row!.n).toBe(2)
    expect((await dayOf(AHMAD, '2026-10-04')).length).toBe(1)
  })

  it('rule 1 — ⚠️ the same batch at the same instant: every event exists once, the day is right', async () => {
    const door = await device()
    await map(door, '182', AHMAD)
    const batch: Sent[] = [
      { id: 'p', user: '182', day: '2026-10-05', at: '08:00:00' },
      { id: 'q', user: '182', day: '2026-10-05', at: '16:00:00' },
    ]
    const results = await Promise.all([
      ingest(door, batch),
      ingest(door, batch),
      ingest(door, batch),
    ])
    // Between the three calls: two new events, four re-deliveries.
    expect(results.reduce((sum, out) => sum + out.applied!, 0)).toBe(2)
    expect(results.reduce((sum, out) => sum + out.redelivered!, 0)).toBe(4)
    expect(await dayOf(AHMAD, '2026-10-05')).toEqual([
      { status: 'present', check_in: '08:00:00', check_out: '16:00:00', source: 'device' },
    ])
  })

  it('rule 3 — a fingerprint and a face 30 seconds apart, on two devices, are one arrival', async () => {
    const finger = await device(WS, 'Fingerprint')
    const face = await device(WS, 'Face')
    // One number for this person on every device of the business.
    await map(null, '500', AHMAD)

    await ingest(finger, [{ id: 'f1', user: '500', day: '2026-10-06', at: '08:00:00' }])
    const second = await ingest(face, [
      { id: 'c1', user: '500', day: '2026-10-06', at: '08:00:30', method: 'FACE' },
    ])
    expect(second).toMatchObject({ duplicate: 1, applied: 0 })
    expect(await statesOf(face)).toEqual(['c1:duplicate'])
    // Still an open day: the second reading did not become a check-out.
    expect(await dayOf(AHMAD, '2026-10-06')).toEqual([
      { status: 'present', check_in: '08:00:00', check_out: null, source: 'device' },
    ])

    // A minute and a half later is a different reading.
    await ingest(face, [
      { id: 'c2', user: '500', day: '2026-10-06', at: '08:01:30', method: 'FACE' },
    ])
    expect(await statesOf(face)).toEqual(['c1:duplicate', 'c2:applied'])
    expect((await dayOf(AHMAD, '2026-10-06'))[0]!.check_out).toBe('08:01:30')
  })

  it('rule 2 — an unmapped number is kept, guessed at never; mapping it settles what waited', async () => {
    const door = await device()
    const out = await ingest(door, [
      { id: 'u1', user: '777', day: '2026-10-07', at: '08:10:00' },
      { id: 'u2', user: '777', day: '2026-10-07', at: '16:20:00' },
      { id: 'u3', user: '777', day: '2026-10-08', at: '08:05:00' },
    ])
    expect(out).toMatchObject({ received: 3, unmatched: 3, applied: 0 })
    expect((await dayOf(TASNIM, '2026-10-07')).length).toBe(0)

    // Nothing to settle before the mapping exists.
    const [early] = await sql`
      SELECT public.attendance_device_reprocess(${WS}, ${door}, '777', ${MANAGER}) AS out
    `
    expect(early!.out).toEqual({ matched: 0, applied: 0, held: 0, duplicate: 0 })

    await map(door, '777', TASNIM)
    const [row] = await sql`
      SELECT public.attendance_device_reprocess(${WS}, ${door}, '777', ${MANAGER}) AS out
    `
    expect(row!.out).toEqual({ matched: 3, applied: 3, held: 0, duplicate: 0 })
    expect(await dayOf(TASNIM, '2026-10-07')).toEqual([
      { status: 'present', check_in: '08:10:00', check_out: '16:20:00', source: 'device' },
    ])
    expect(await dayOf(TASNIM, '2026-10-08')).toEqual([
      { status: 'present', check_in: '08:05:00', check_out: null, source: 'device' },
    ])
    expect(await statesOf(door)).toEqual(['u1:applied', 'u2:applied', 'u3:applied'])
  })

  it('rule 2 — a mapping for one device wins over the business-wide one', async () => {
    const door = await device()
    await map(null, '42', AHMAD)
    await map(door, '42', TASNIM)
    await ingest(door, [{ id: 'w1', user: '42', day: '2026-10-09', at: '08:00:00' }])
    expect((await dayOf(TASNIM, '2026-10-09')).length).toBe(1)
    expect((await dayOf(AHMAD, '2026-10-09')).length).toBe(0)
    // …and one number cannot mean two people on the same device.
    expect(await refusal(() => map(door, '42', AHMAD))).toContain(
      'attendance_terminal_identities_one',
    )
  })

  it('rule 5 — ⚠️ a day a person recorded is not changed; the events are held', async () => {
    const door = await device()
    await map(door, '182', AHMAD)
    await sql`
      INSERT INTO public.attendance (employee_id, date, status, user_id, workspace_id)
      VALUES (${AHMAD}, '2026-10-10', 'leave', ${MANAGER}, ${WS})
    `
    const out = await ingest(door, [
      { id: 'h1', user: '182', day: '2026-10-10', at: '08:00:00' },
      { id: 'h2', user: '182', day: '2026-10-10', at: '16:00:00' },
    ])
    expect(out).toMatchObject({ applied: 0, held: 2 })
    expect(await dayOf(AHMAD, '2026-10-10')).toEqual([
      { status: 'leave', check_in: null, check_out: null, source: null },
    ])
    expect(await statesOf(door)).toEqual(['h1:held', 'h2:held'])

    // The same for a day the employee sent through their own link.
    await sql`
      INSERT INTO public.attendance (employee_id, date, status, check_in, user_id, workspace_id, source)
      VALUES (${AHMAD}, '2026-10-11', 'present', '09:00', ${MANAGER}, ${WS}, 'employee_link')
    `
    await ingest(door, [{ id: 'h3', user: '182', day: '2026-10-11', at: '08:00:00' }])
    expect(await dayOf(AHMAD, '2026-10-11')).toEqual([
      { status: 'present', check_in: '09:00:00', check_out: null, source: 'employee_link' },
    ])
  })

  it('an event is for ever: no delete, no rewrite, and a settled one does not move', async () => {
    const door = await device()
    await map(door, '182', AHMAD)
    await ingest(door, [{ id: 'k1', user: '182', day: '2026-10-12', at: '08:00:00' }])
    const [event] = await sql`
      SELECT id FROM public.attendance_terminal_events WHERE device_id = ${door}
    `
    expect(
      await refusal(
        () => sql`DELETE FROM public.attendance_terminal_events WHERE id = ${event!.id}`,
      ),
    ).toContain('ATTENDANCE_DEVICE_EVENT_APPEND_ONLY')
    for (const change of [
      sql`occurred_time = '07:00'`,
      sql`occurred_on = '2026-10-13'`,
      sql`external_user_id = '999'`,
      sql`time_zone = 'Asia/Tehran'`,
      sql`employee_id = ${TASNIM}`,
      sql`payload = '{}'::jsonb`,
    ]) {
      expect(
        await refusal(
          () => sql`UPDATE public.attendance_terminal_events SET ${change} WHERE id = ${event!.id}`,
        ),
      ).toContain('ATTENDANCE_DEVICE_EVENT_APPEND_ONLY')
    }
    expect(
      await refusal(
        () => sql`
          UPDATE public.attendance_terminal_events SET state = 'unmatched' WHERE id = ${event!.id}
        `,
      ),
    ).toContain('ATTENDANCE_DEVICE_EVENT_SETTLED')
  })

  it('a revoked device takes nothing; an unknown method or direction is refused whole', async () => {
    const door = await device()
    await map(door, '182', AHMAD)
    await sql`UPDATE public.attendance_terminals SET revoked_at = now() WHERE id = ${door}`
    expect(
      await refusal(() =>
        ingest(door, [{ id: 'r1', user: '182', day: '2026-10-14', at: '08:00:00' }]),
      ),
    ).toContain('ATTENDANCE_DEVICE_NOT_FOUND')

    const live = await device()
    await map(live, '182', AHMAD)
    expect(
      await refusal(() =>
        ingest(live, [
          { id: 'ok', user: '182', day: '2026-10-14', at: '08:00:00' },
          { id: 'bad', user: '182', day: '2026-10-14', at: '16:00:00', method: 'RETINA' },
        ]),
      ),
    ).toContain('method')
    // The good event of that batch was not kept either: a batch is one write.
    expect((await dayOf(AHMAD, '2026-10-14')).length).toBe(0)
    expect((await statesOf(live)).length).toBe(0)
  })

  it('two businesses never meet: a device maps and writes only inside its own', async () => {
    const mine = await device(WS)
    const theirs = await device(OTHER, 'Their door')
    await map(mine, '1', AHMAD)
    await map(theirs, '1', THEIRS, OTHER)

    await ingest(mine, [{ id: 'm', user: '1', day: '2026-10-15', at: '08:00:00' }])
    await ingest(theirs, [{ id: 't', user: '1', day: '2026-10-15', at: '09:00:00' }])
    expect((await dayOf(AHMAD, '2026-10-15'))[0]!.check_in).toBe('08:00:00')
    expect((await dayOf(THEIRS, '2026-10-15'))[0]!.check_in).toBe('09:00:00')
    const [row] = await sql`
      SELECT COUNT(*)::int AS n FROM public.attendance
       WHERE date = '2026-10-15' AND workspace_id = ${WS} AND employee_id = ${THEIRS}
    `
    expect(row!.n).toBe(0)

    // Reprocess with another business's device id finds no such device.
    expect(
      await refusal(
        () => sql`SELECT public.attendance_device_reprocess(${WS}, ${theirs}, '1', ${MANAGER})`,
      ),
    ).toContain('ATTENDANCE_DEVICE_NOT_FOUND')
  })

  it('health and the cursor: every batch is «seen»; only new events are «an event»', async () => {
    const door = await device()
    await map(door, '182', AHMAD)
    await ingest(door, [{ id: 'c', user: '182', day: '2026-10-16', at: '08:00:00' }], 'page-7')
    const [first] = await sql`
      SELECT sync_cursor, last_seen_at, last_event_at FROM public.attendance_terminals WHERE id = ${door}
    `
    expect(first!.sync_cursor).toBe('page-7')
    expect(first!.last_event_at).not.toBeNull()

    // An empty batch is a heartbeat: seen, no event, the cursor stays.
    await sql`SELECT pg_sleep(0.05)`
    await ingest(door, [], null)
    const [second] = await sql`
      SELECT sync_cursor, last_seen_at, last_event_at FROM public.attendance_terminals WHERE id = ${door}
    `
    expect(second!.sync_cursor).toBe('page-7')
    expect(second!.last_seen_at.getTime()).toBeGreaterThan(first!.last_seen_at.getTime())
    expect(second!.last_event_at.getTime()).toBe(first!.last_event_at.getTime())
  })

  it('⚠️ the events go with their business — the guard does not block a cascade', async () => {
    const door = await device(GONE)
    await map(door, '1', LEAVING, GONE)
    await ingest(door, [{ id: 'g', user: '1', day: '2026-10-17', at: '08:00:00' }])
    await sql`DELETE FROM public.workspaces WHERE id = ${GONE}`
    const [row] = await sql`
      SELECT (SELECT COUNT(*) FROM public.attendance_terminal_events WHERE workspace_id = ${GONE})::int AS events,
             (SELECT COUNT(*) FROM public.attendance_terminals WHERE workspace_id = ${GONE})::int AS devices
    `
    expect(row).toEqual({ events: 0, devices: 0 })
  })

  it('a device stores a hash and a closed list of capabilities', async () => {
    expect(
      await refusal(
        () => sql`
          INSERT INTO public.attendance_terminals (workspace_id, name, key_hash, key_prefix, created_by)
          VALUES (${WS}, 'x', 'not-a-hash', 'hsd_test', ${MANAGER})
        `,
      ),
    ).toContain('key_hash')
    expect(
      await refusal(
        () => sql`
          INSERT INTO public.attendance_terminals
            (workspace_id, name, key_hash, key_prefix, created_by, capabilities)
          VALUES (${WS}, 'x', ${hash()}, 'hsd_test', ${MANAGER}, ARRAY['FACE', 'RETINA'])
        `,
      ),
    ).toContain('capabilities')
    expect(
      await refusal(
        () => sql`
          INSERT INTO public.attendance_terminals
            (workspace_id, name, key_hash, key_prefix, created_by, capabilities)
          VALUES (${WS}, 'x', ${hash()}, 'hsd_test', ${MANAGER}, ARRAY['FACE', 'FINGERPRINT', 'CARD'])
        `,
      ),
    ).toBe('ALLOWED')
  })
})
