// ============================================
// docs/attendance-02-migration.sql — after the four it builds on, as a person
// would run them — TWICE, on a real Postgres with Supabase's default
// privileges; then its VERIFY; then the rules, each with the write it must
// refuse and the write it must allow:
//
//   · a night says so; an exit before the arrival without the mark is refused
//   · a reading after midnight counts toward yesterday ONLY with a planned
//     night shift, and only up to three hours past its end
//   · a held reading becomes the day only when a manager accepts it
//   · a link that asks for the phone's lock refuses a submission without proof
//   · one live phone per employee
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const PORT = 56500 + Math.floor(Math.random() * 800)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-attendance-02-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/att_two`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const MANAGER = '11111111-1111-4111-8111-111111111111'
const AHMAD = 'eeeeeeee-0000-4000-8000-00000000000a'
const TASNIM = 'eeeeeeee-0000-4000-8000-0000000000a2'
const NOOR = 'eeeeeeee-0000-4000-8000-0000000000a3'
const OLD_DEVICE = 'dddddddd-0000-4000-8000-000000000001'

let counter = 0
const hex = () => (++counter).toString(16).padStart(64, '0')
const requestId = () => `99999999-0000-4000-8000-${(++counter).toString(16).padStart(12, '0')}`

async function device(name = 'Door') {
  const [row] = await sql`
    INSERT INTO public.attendance_terminals (workspace_id, name, key_hash, key_prefix, created_by)
    VALUES (${WS}, ${name}, ${hex()}, 'hsd_test', ${MANAGER})
    RETURNING id
  `
  return row!.id as string
}
async function map(deviceId: string, userId: string, employee: string) {
  await sql`
    INSERT INTO public.attendance_terminal_identities
      (workspace_id, device_id, external_user_id, employee_id, created_by)
    VALUES (${WS}, ${deviceId}, ${userId}, ${employee}, ${MANAGER})
  `
}
type Sent = { id: string; user: string; day: string; at: string; direction?: string }
async function ingest(deviceId: string, events: Sent[]) {
  const body = events.map((event) => ({
    raw_id: event.id,
    user_id: event.user,
    day: event.day,
    at: event.at,
    direction: event.direction ?? 'unknown',
    method: 'FINGERPRINT',
    payload: null,
  }))
  const [row] = await sql`
    SELECT public.attendance_device_ingest(
      ${deviceId}, 'Asia/Kabul', ${JSON.stringify(body)}::text::jsonb, NULL
    ) AS out
  `
  return row!.out as Record<string, number>
}
const dayOf = async (employee: string, day: string) =>
  sql`
    SELECT status, check_in::text AS check_in, check_out::text AS check_out, ends_next_day, source
      FROM public.attendance WHERE employee_id = ${employee} AND date = ${day}::date
  `
const workDays = async (deviceId: string) =>
  (
    await sql`
      SELECT raw_event_id, work_day::text AS work_day, state
        FROM public.attendance_terminal_events
       WHERE device_id = ${deviceId} ORDER BY occurred_on, occurred_time, raw_event_id
    `
  ).map((row) => `${row.raw_event_id}:${row.work_day}:${row.state}`)

async function shift(name: string, startsAt: string, endsAt: string) {
  const [row] = await sql`
    INSERT INTO public.work_shifts (workspace_id, name, starts_at, ends_at, created_by)
    VALUES (${WS}, ${name}, ${startsAt}::time, ${endsAt}::time, ${MANAGER})
    RETURNING id
  `
  return row!.id as string
}
const plan = (employee: string, shiftId: string, day: string) => sql`
  INSERT INTO public.shift_assignments (workspace_id, employee_id, shift_id, work_date, assigned_by)
  VALUES (${WS}, ${employee}, ${shiftId}, ${day}::date, ${MANAGER})
`

async function link(employee: string, options: { autoApply?: boolean; unlock?: boolean } = {}) {
  const [row] = await sql`
    SELECT * FROM public.attendance_link_create(
      ${WS}, ${employee}, ${MANAGER}, ${hex()}, NULL, 3,
      ${options.autoApply ?? false}, ${options.unlock ?? false}
    )
  `
  return row as { id: string; require_unlock: boolean }
}
async function submit(
  linkId: string,
  date: string,
  times: {
    checkIn: string | null
    checkOut: string | null
    night?: boolean
    proof?: string | null
  },
  key = requestId(),
) {
  const [row] = await sql`
    SELECT public.attendance_submit(
      ${linkId}, ${date}::date, 'present', ${times.checkIn}::time, ${times.checkOut}::time,
      ${times.night ?? false}, NULL, ${key}, 'Asia/Kabul', ${times.proof ?? null}
    ) AS out
  `
  return row!.out as { id: string; state: string; replayed: boolean }
}

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
  await pg.createDatabase('att_two')
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

    INSERT INTO workspaces (id, name) VALUES ('${WS}', 'A');
    INSERT INTO employees (id, workspace_id, first_name) VALUES
      ('${AHMAD}', '${WS}', 'Ahmad'), ('${TASNIM}', '${WS}', 'Tasnim'), ('${NOOR}', '${WS}', 'Noor');
  `)

  for (const name of [
    'work-shifts-01-migration.sql',
    'shift-assignments-01-migration.sql',
    'attendance-self-01-migration.sql',
    'attendance-devices-01-migration.sql',
  ]) {
    await setup.unsafe(read(name))
  }

  // What was there before this migration: a reading and a record with no
  // notion of a working day or a night.
  await setup.unsafe(`
    INSERT INTO public.attendance_terminals (id, workspace_id, name, key_hash, key_prefix, created_by)
    VALUES ('${OLD_DEVICE}', '${WS}', 'Old', '${'f'.repeat(64)}', 'hsd_old', '${MANAGER}');
    INSERT INTO public.attendance_terminal_events
      (workspace_id, device_id, raw_event_id, external_user_id, occurred_on, occurred_time,
       time_zone, state)
    VALUES ('${WS}', '${OLD_DEVICE}', 'old-1', '900', '2026-08-01', '08:00', 'Asia/Kabul', 'unmatched');
  `)

  await setup.unsafe(read('attendance-02-migration.sql'))
  await setup.unsafe(read('attendance-02-migration.sql'))
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

describe('docs/attendance-02-migration.sql', () => {
  it('ran twice and its VERIFY says ok on every row', async () => {
    const rows = await sql.unsafe(read('VERIFY-attendance-02.sql'))
    expect(rows.length).toBeGreaterThan(25)
    expect(rows.filter((row) => row.ok !== true).map((row) => row.name)).toEqual([])
  })

  it('⚠️ the older tables of the same family are exactly as they were', async () => {
    const columns = await sql`
      SELECT table_name, string_agg(column_name, ',' ORDER BY ordinal_position) AS columns
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name IN ('attendance_devices', 'attendance_device_events')
       GROUP BY table_name ORDER BY table_name
    `
    expect(columns.map((row) => `${row.table_name}: ${row.columns}`)).toEqual([
      'attendance_device_events: id,workspace_id,device_id,payload,payload_hash,processing_status',
      'attendance_devices: id,workspace_id,name,status',
    ])
  })

  it('a reading from before the migration counts toward its own calendar day', async () => {
    expect(await workDays(OLD_DEVICE)).toEqual(['old-1:2026-08-01:unmatched'])
  })

  it('the earlier scripts refuse to run again once this one has', async () => {
    // Its own connection: the refused script leaves its transaction open.
    const one = postgres(url, { max: 1, onnotice: () => {} })
    for (const name of [
      'attendance-self-01-migration.sql',
      'attendance-devices-01-migration.sql',
    ]) {
      expect(await refusal(() => one.unsafe(read(name))), name).toContain('attendance-02')
      await one.unsafe('ROLLBACK')
    }
    await one.end()
    // …and refusing changed nothing.
    const rows = await sql.unsafe(read('VERIFY-attendance-02.sql'))
    expect(rows.filter((row) => row.ok !== true).map((row) => row.name)).toEqual([])
  })
})

describe('a night says so', () => {
  it('⚠️ the record: an exit before the arrival needs the mark, and the mark needs it', async () => {
    const write = (checkIn: string, checkOut: string | null, night: boolean, day: string) => sql`
      INSERT INTO public.attendance
        (employee_id, date, check_in, check_out, ends_next_day, status, user_id, workspace_id)
      VALUES (${NOOR}, ${day}::date, ${checkIn}::time, ${checkOut}::time, ${night}, 'present',
              ${MANAGER}, ${WS})
    `
    // The mark on a day that ends the same day, or on an open day, is refused.
    expect(await refusal(() => write('08:00', '16:00', true, '2026-07-01'))).toContain(
      'attendance_ends_next_day_check',
    )
    expect(await refusal(() => write('22:00', null, true, '2026-07-01'))).toContain(
      'attendance_ends_next_day_check',
    )
    expect(await refusal(() => write('22:00', '06:00', true, '2026-07-01'))).toBe('ALLOWED')
  })

  it('⚠️ a submission: without the mark it is still a typing error', async () => {
    const mine = await link(AHMAD, { autoApply: true })
    expect(
      await refusal(() => submit(mine.id, '2026-07-02', { checkIn: '22:00', checkOut: '06:00' })),
    ).toContain('attendance_submissions_times')
    // Nothing was half-written.
    expect(await dayOf(AHMAD, '2026-07-02')).toHaveLength(0)

    const sent = await submit(mine.id, '2026-07-02', {
      checkIn: '22:00',
      checkOut: '06:00',
      night: true,
    })
    expect(sent.state).toBe('applied')
    expect(await dayOf(AHMAD, '2026-07-02')).toEqual([
      {
        status: 'present',
        check_in: '22:00:00',
        check_out: '06:00:00',
        ends_next_day: true,
        source: 'employee_link',
      },
    ])
    // The mark with an exit that is not earlier is refused too.
    expect(
      await refusal(() =>
        submit(mine.id, '2026-07-03', { checkIn: '08:00', checkOut: '16:00', night: true }),
      ),
    ).toContain('attendance_ends_next_day_check')
    expect(await dayOf(AHMAD, '2026-07-03')).toHaveLength(0)
  })

  it('an approved night keeps its mark, and what was sent cannot be edited', async () => {
    const mine = await link(TASNIM)
    const sent = await submit(mine.id, '2026-07-02', {
      checkIn: '21:30',
      checkOut: '05:30',
      night: true,
    })
    expect(sent.state).toBe('pending')
    expect(
      await refusal(
        () =>
          sql`UPDATE public.attendance_submissions SET ends_next_day = false WHERE id = ${sent.id}`,
      ),
    ).toContain('ATTENDANCE_SUBMISSION')
    await sql`SELECT public.attendance_submission_decide(${WS}, ${sent.id}, ${MANAGER}, 'approve', NULL)`
    expect((await dayOf(TASNIM, '2026-07-02'))[0]).toMatchObject({
      check_in: '21:30:00',
      check_out: '05:30:00',
      ends_next_day: true,
    })
  })

  it('a shift may cross midnight, may not be zero long, and its break still fits', async () => {
    expect(await refusal(() => shift('Zero', '08:00', '08:00'))).toContain('work_shifts_')
    expect(
      await refusal(
        () => sql`
          INSERT INTO public.work_shifts (workspace_id, name, starts_at, ends_at, break_minutes, created_by)
          VALUES (${WS}, 'Long break', '22:00', '06:00', 480, ${MANAGER})
        `,
      ),
    ).toContain('work_shifts_break_shorter_than_shift')
    expect(
      await refusal(
        () => sql`
          INSERT INTO public.work_shifts (workspace_id, name, starts_at, ends_at, break_minutes, created_by)
          VALUES (${WS}, 'Night with break', '22:00', '06:00', 60, ${MANAGER})
        `,
      ),
    ).toBe('ALLOWED')
  })

  it('⚠️ a night plan collides with the next morning, not with the next evening', async () => {
    const night = await shift('Night A', '22:00', '06:00')
    const early = await shift('Early A', '05:00', '13:00')
    const day = await shift('Day A', '08:00', '16:00')
    await plan(NOOR, night, '2026-06-10')
    // 05:00 on the 11th is inside the night that began on the 10th.
    expect(await refusal(() => plan(NOOR, early, '2026-06-11'))).toContain(
      'SHIFT_ASSIGNMENT_OVERLAP',
    )
    expect(await refusal(() => plan(NOOR, day, '2026-06-11'))).toBe('ALLOWED')
    expect(await refusal(() => plan(NOOR, night, '2026-06-11'))).toBe('ALLOWED')
    // …and looking backwards: a night on the 9th would run into nothing, a
    // second night on the 10th is the same hours.
    expect(await refusal(() => plan(NOOR, night, '2026-06-10'))).toContain(
      'SHIFT_ASSIGNMENT_OVERLAP',
    )
  })
})

describe('which day a reading counts toward', () => {
  it('⚠️ with a planned night: in at 22, out at 06 is ONE day that ends the next', async () => {
    const door = await device('Night door')
    await map(door, '1', AHMAD)
    const night = await shift('Night B', '22:00', '06:00')
    await plan(AHMAD, night, '2026-05-10')

    const out = await ingest(door, [
      { id: 'n1', user: '1', day: '2026-05-10', at: '21:55' },
      { id: 'n2', user: '1', day: '2026-05-11', at: '06:05' },
    ])
    expect(out).toMatchObject({ received: 2, applied: 2, held: 0 })
    expect(await workDays(door)).toEqual(['n1:2026-05-10:applied', 'n2:2026-05-10:applied'])
    expect(await dayOf(AHMAD, '2026-05-10')).toEqual([
      {
        status: 'present',
        check_in: '21:55:00',
        check_out: '06:05:00',
        ends_next_day: true,
        source: 'device',
      },
    ])
    // The 11th has no record: nobody arrived on it.
    expect(await dayOf(AHMAD, '2026-05-11')).toHaveLength(0)
  })

  it('⚠️ later than three hours past the planned end is the new day', async () => {
    const door = await device('Late door')
    await map(door, '2', TASNIM)
    const night = await shift('Night C', '22:00', '06:00')
    await plan(TASNIM, night, '2026-05-10')
    await ingest(door, [
      { id: 'l1', user: '2', day: '2026-05-10', at: '22:00' },
      { id: 'l2', user: '2', day: '2026-05-11', at: '09:01' },
    ])
    expect(await workDays(door)).toEqual(['l1:2026-05-10:applied', 'l2:2026-05-11:applied'])
    // The night stays open — it is not closed with a guess.
    expect((await dayOf(TASNIM, '2026-05-10'))[0]).toMatchObject({
      check_in: '22:00:00',
      check_out: null,
      ends_next_day: false,
    })
    expect((await dayOf(TASNIM, '2026-05-11'))[0]).toMatchObject({ check_in: '09:01:00' })
  })

  it('⚠️ without a plan nothing is read as a night', async () => {
    const door = await device('Plain door')
    await map(door, '3', NOOR)
    await ingest(door, [
      { id: 'p1', user: '3', day: '2026-05-20', at: '22:00' },
      { id: 'p2', user: '3', day: '2026-05-21', at: '06:00' },
    ])
    expect(await workDays(door)).toEqual(['p1:2026-05-20:applied', 'p2:2026-05-21:applied'])
    expect((await dayOf(NOOR, '2026-05-20'))[0]).toMatchObject({ check_out: null })
    expect((await dayOf(NOOR, '2026-05-21'))[0]).toMatchObject({
      check_in: '06:00:00',
      ends_next_day: false,
    })
  })

  it('a morning shift planned for today claims the reading nearer to its start', async () => {
    const door = await device('Double door')
    await map(door, '4', NOOR)
    const night = await shift('Night D', '22:00', '04:00')
    const morning = await shift('Morning D', '06:00', '12:00')
    await plan(NOOR, night, '2026-04-10')
    await plan(NOOR, morning, '2026-04-11')
    await ingest(door, [
      { id: 'd1', user: '4', day: '2026-04-10', at: '22:00' },
      { id: 'd2', user: '4', day: '2026-04-11', at: '04:10' },
      { id: 'd3', user: '4', day: '2026-04-11', at: '05:50' },
    ])
    expect(await workDays(door)).toEqual([
      'd1:2026-04-10:applied',
      'd2:2026-04-10:applied',
      'd3:2026-04-11:applied',
    ])
  })

  it('a number mapped later gets its working day then — and it does not move afterwards', async () => {
    const door = await device('Waiting door')
    const night = await shift('Night E', '23:00', '07:00')
    await plan(TASNIM, night, '2026-03-10')
    await ingest(door, [
      { id: 'w1', user: '77', day: '2026-03-10', at: '23:00' },
      { id: 'w2', user: '77', day: '2026-03-11', at: '07:00' },
    ])
    expect(await workDays(door)).toEqual(['w1:2026-03-10:unmatched', 'w2:2026-03-11:unmatched'])
    await map(door, '77', TASNIM)
    await sql`SELECT public.attendance_device_reprocess(${WS}, ${door}, '77', ${MANAGER})`
    expect(await workDays(door)).toEqual(['w1:2026-03-10:applied', 'w2:2026-03-10:applied'])
    expect((await dayOf(TASNIM, '2026-03-10'))[0]).toMatchObject({
      check_in: '23:00:00',
      check_out: '07:00:00',
      ends_next_day: true,
    })
    expect(
      await refusal(
        () => sql`
          UPDATE public.attendance_terminal_events SET work_day = '2026-03-11'
           WHERE device_id = ${door} AND raw_event_id = 'w2'
        `,
      ),
    ).toContain('ATTENDANCE_DEVICE_EVENT_APPEND_ONLY')
  })
})

describe('held readings', () => {
  it('⚠️ stay held until a manager accepts; then the day is what the terminal saw', async () => {
    const door = await device('Held door')
    await map(door, '5', AHMAD)
    await sql`
      INSERT INTO public.attendance (employee_id, date, check_in, check_out, status, user_id, workspace_id)
      VALUES (${AHMAD}, '2026-02-10', '09:00', '17:00', 'present', ${MANAGER}, ${WS})
    `
    const out = await ingest(door, [
      { id: 'h1', user: '5', day: '2026-02-10', at: '08:02' },
      { id: 'h2', user: '5', day: '2026-02-10', at: '16:31' },
    ])
    expect(out).toMatchObject({ applied: 0, held: 2 })
    expect((await dayOf(AHMAD, '2026-02-10'))[0]).toMatchObject({
      check_in: '09:00:00',
      check_out: '17:00:00',
      source: null,
    })

    // A held reading cannot be turned into anything but «applied».
    expect(
      await refusal(
        () => sql`
          UPDATE public.attendance_terminal_events SET state = 'new'
           WHERE device_id = ${door} AND raw_event_id = 'h1'
        `,
      ),
    ).toContain('ATTENDANCE_DEVICE_EVENT_SETTLED')

    const [accepted] = await sql`
      SELECT public.attendance_device_accept_held(${WS}, ${AHMAD}, '2026-02-10', ${MANAGER}) AS out
    `
    expect(accepted!.out).toEqual({ accepted: 2 })
    expect(await dayOf(AHMAD, '2026-02-10')).toEqual([
      {
        status: 'present',
        check_in: '08:02:00',
        check_out: '16:31:00',
        ends_next_day: false,
        source: 'device',
      },
    ])
    expect(await workDays(door)).toEqual(['h1:2026-02-10:applied', 'h2:2026-02-10:applied'])

    // Nothing is left to accept, and saying so twice is refused, not repeated.
    expect(
      await refusal(
        () =>
          sql`SELECT public.attendance_device_accept_held(${WS}, ${AHMAD}, '2026-02-10', ${MANAGER})`,
      ),
    ).toContain('ATTENDANCE_DEVICE_NOTHING_HELD')
  })

  it('two managers accepting at once: one day, one acceptance', async () => {
    const door = await device('Race door')
    await map(door, '6', TASNIM)
    await sql`
      INSERT INTO public.attendance (employee_id, date, check_in, status, user_id, workspace_id)
      VALUES (${TASNIM}, '2026-02-11', '09:00', 'present', ${MANAGER}, ${WS})
    `
    await ingest(door, [{ id: 'r1', user: '6', day: '2026-02-11', at: '08:00' }])
    const results = await Promise.all(
      [1, 2].map(() =>
        refusal(
          () =>
            sql`SELECT public.attendance_device_accept_held(${WS}, ${TASNIM}, '2026-02-11', ${MANAGER})`,
        ),
      ),
    )
    expect(results.filter((result) => result === 'ALLOWED')).toHaveLength(1)
    expect(results.find((result) => result !== 'ALLOWED')).toContain(
      'ATTENDANCE_DEVICE_NOTHING_HELD',
    )
    expect(await dayOf(TASNIM, '2026-02-11')).toHaveLength(1)
  })

  it('service_role cannot settle a day by itself', async () => {
    const [row] = await sql`
      SELECT has_function_privilege(
        'service_role', 'public.attendance_device_settle(uuid, uuid, date, uuid, boolean)', 'EXECUTE'
      ) AS may
    `
    expect(row!.may).toBe(false)
  })
})

describe('the phone', () => {
  it('⚠️ a link that asks for the lock refuses a submission that claims none', async () => {
    const locked = await link(NOOR, { autoApply: true, unlock: true })
    expect(locked.require_unlock).toBe(true)
    expect(
      await refusal(() => submit(locked.id, '2026-01-10', { checkIn: '08:00', checkOut: null })),
    ).toContain('ATTENDANCE_UNLOCK_REQUIRED')
    expect(await dayOf(NOOR, '2026-01-10')).toHaveLength(0)

    const sent = await submit(locked.id, '2026-01-10', {
      checkIn: '08:00',
      checkOut: null,
      proof: 'device_unlock',
    })
    expect(sent.state).toBe('applied')
    const [row] = await sql`SELECT proof FROM public.attendance_submissions WHERE id = ${sent.id}`
    expect(row!.proof).toBe('device_unlock')
    // The list of proofs is closed.
    expect(
      await refusal(() =>
        submit(locked.id, '2026-01-11', { checkIn: '08:00', checkOut: null, proof: 'trust me' }),
      ),
    ).toContain('ATTENDANCE_UNLOCK_REQUIRED')
  })

  it('a link that does not ask works as before, with no proof written', async () => {
    const open = await link(AHMAD, { autoApply: true })
    const sent = await submit(open.id, '2026-01-12', { checkIn: '08:00', checkOut: '16:00' })
    const [row] =
      await sql`SELECT proof, ends_next_day FROM public.attendance_submissions WHERE id = ${sent.id}`
    expect(row).toMatchObject({ proof: null, ends_next_day: false })
  })

  it('⚠️ one live phone per employee; a forgotten one makes room', async () => {
    const add = (credential: string) => sql`
      INSERT INTO public.attendance_phone_keys
        (workspace_id, employee_id, credential_id, public_key, algorithm)
      VALUES (${WS}, ${AHMAD}, ${credential}, ${'A'.repeat(120)}, -7)
    `
    expect(await refusal(() => add('credential-number-one'))).toBe('ALLOWED')
    expect(await refusal(() => add('credential-number-two'))).toContain(
      'attendance_phone_keys_one_live',
    )
    await sql`
      UPDATE public.attendance_phone_keys SET revoked_at = now(), revoked_by = ${MANAGER}
       WHERE employee_id = ${AHMAD} AND revoked_at IS NULL
    `
    expect(await refusal(() => add('credential-number-two'))).toBe('ALLOWED')
    // An algorithm the server cannot check is not stored.
    expect(
      await refusal(
        () => sql`
          INSERT INTO public.attendance_phone_keys
            (workspace_id, employee_id, credential_id, public_key, algorithm)
          VALUES (${WS}, ${TASNIM}, 'credential-number-three', ${'A'.repeat(120)}, -8)
        `,
      ),
    ).toContain('attendance_phone_keys_algorithm_check')
  })
})
