// ============================================
// docs/attendance-self-01-migration.sql, run unchanged — TWICE — on a real
// Postgres with Supabase's default privileges, then its VERIFY, then every
// rule with the write it must refuse and the write it must allow.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const PORT = 54600 + Math.floor(Math.random() * 800)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-attendance-self-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/att_self`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')

const WS_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const WS_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const WS_GONE = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const MANAGER = '11111111-1111-4111-8111-111111111111'
const MANAGER_2 = '22222222-2222-4222-8222-222222222222'
const EMP_A = 'eeeeeeee-0000-4000-8000-00000000000a'
const EMP_A2 = 'eeeeeeee-0000-4000-8000-0000000000a2'
const EMP_B = 'eeeeeeee-0000-4000-8000-00000000000b'
const EMP_GONE = 'eeeeeeee-0000-4000-8000-00000000000c'

let counter = 0
const token = () => (++counter).toString(16).padStart(64, '0')
const requestId = () => `99999999-0000-4000-8000-${(++counter).toString(16).padStart(12, '0')}`

async function link(
  employee: string,
  options: { workspace?: string; autoApply?: boolean; daysBack?: number } = {},
) {
  const [row] = await sql`
    SELECT * FROM public.attendance_link_create(
      ${options.workspace ?? WS_A}, ${employee}, ${MANAGER}, ${token()}, NULL,
      ${options.daysBack ?? 0}, ${options.autoApply ?? false}
    )
  `
  return row as { id: string; token: string; revoked_at: Date | null }
}

async function submit(
  linkId: string,
  date: string,
  status: string,
  checkIn: string | null,
  checkOut: string | null,
  key = requestId(),
) {
  const [row] = await sql`
    SELECT public.attendance_submit(
      ${linkId}, ${date}::date, ${status}, ${checkIn}::time, ${checkOut}::time, NULL, ${key},
      'Asia/Kabul'
    ) AS out
  `
  return row!.out as { id: string; state: string; replayed: boolean }
}

const recordOf = async (employee: string, date: string) =>
  sql`
    SELECT status, check_in::text AS check_in, check_out::text AS check_out, source
      FROM public.attendance
     WHERE employee_id = ${employee} AND date = ${date}::date
  `

/** The message of the refusal, or 'ALLOWED' when the write went through. */
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
  await pg.createDatabase('att_self')
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
      first_name text,
      last_name text
    );
    -- As the base schema has it, plus workspace_id (tenant-isolation-closure)
    -- and the unique index of attendance-01.
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

    INSERT INTO workspaces (id, name) VALUES
      ('${WS_A}', 'A'), ('${WS_B}', 'B'), ('${WS_GONE}', 'to be deleted');
    INSERT INTO employees (id, workspace_id, first_name) VALUES
      ('${EMP_A}', '${WS_A}', 'Ahmad'),
      ('${EMP_A2}', '${WS_A}', 'Tasnim'),
      ('${EMP_B}', '${WS_B}', 'Other shop'),
      ('${EMP_GONE}', '${WS_GONE}', 'Leaving');
  `)

  const migration = read('attendance-self-01-migration.sql')
  await setup.unsafe(migration)
  await setup.unsafe(migration)
  await setup.end()

  sql = postgres(url, { max: 6, onnotice: () => {} })
}, 90_000)

afterAll(async () => {
  if (sql) await sql.end()
  try {
    await pg.stop()
  } catch {
    // teardown only
  }
  rmSync(dir, { recursive: true, force: true })
})

describe('docs/attendance-self-01-migration.sql', () => {
  it('ran twice, and VERIFY says ok on every row', async () => {
    const rows = await sql.unsafe(read('VERIFY-attendance-self-01.sql'))
    expect(rows.length).toBeGreaterThan(15)
    expect(rows.filter((row) => row.ok !== true).map((row) => row.name)).toEqual([])
  })

  it('⚠️ with Supabase default grants, the browser roles still cannot touch the tables or call the functions', async () => {
    for (const role of ['anon', 'authenticated']) {
      for (const table of ['attendance_links', 'attendance_submissions']) {
        const [row] = await sql`
          SELECT has_table_privilege(${role}, ${'public.' + table}, 'SELECT') AS can
        `
        expect(row!.can, `${role} ${table}`).toBe(false)
      }
    }
    const fns = await sql`
      SELECT p.proname,
             has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
             has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authed
        FROM pg_proc p
       WHERE p.pronamespace = 'public'::regnamespace AND p.proname LIKE 'attendance\\_%'
    `
    expect(fns.length).toBe(4)
    for (const fn of fns)
      expect([fn.proname, fn.anon, fn.authed]).toEqual([fn.proname, false, false])
  })

  describe('one live link per employee', () => {
    it('a new link revokes the old one', async () => {
      const first = await link(EMP_A)
      const second = await link(EMP_A)
      const rows = await sql`
        SELECT id, revoked_at IS NULL AS live FROM public.attendance_links
         WHERE employee_id = ${EMP_A} ORDER BY created_at, id
      `
      expect(rows.filter((row) => row.live).map((row) => row.id)).toEqual([second.id])
      expect(rows.find((row) => row.id === first.id)?.live).toBe(false)
    })

    it('a second live link written directly is refused by the index', async () => {
      await link(EMP_A)
      expect(
        await refusal(
          () => sql`
            INSERT INTO public.attendance_links
              (workspace_id, employee_id, token, created_by)
            VALUES (${WS_A}, ${EMP_A}, ${token()}, ${MANAGER})
          `,
        ),
      ).toContain('attendance_links_one_live')
    })

    it('⚠️ two managers at the same instant: both succeed, exactly one link is live', async () => {
      const results = await Promise.allSettled([link(EMP_A2), link(EMP_A2), link(EMP_A2)])
      expect(results.map((result) => result.status)).toEqual([
        'fulfilled',
        'fulfilled',
        'fulfilled',
      ])
      const [row] = await sql`
        SELECT COUNT(*) FILTER (WHERE revoked_at IS NULL)::int AS live, COUNT(*)::int AS total
          FROM public.attendance_links WHERE employee_id = ${EMP_A2}
      `
      expect(row).toMatchObject({ live: 1, total: 3 })
    })

    it('an employee of another workspace is not found — and no link is made', async () => {
      expect(await refusal(() => link(EMP_B, { workspace: WS_A }))).toContain(
        'ATTENDANCE_EMPLOYEE_NOT_FOUND',
      )
      const rows = await sql`
        SELECT 1 FROM public.attendance_links WHERE employee_id = ${EMP_B} AND workspace_id = ${WS_A}
      `
      expect(rows.length).toBe(0)
    })

    it('days_back outside 0–7 and a malformed token are refused', async () => {
      expect(await refusal(() => link(EMP_A, { daysBack: 8 }))).toContain('days_back')
      expect(
        await refusal(
          () => sql`
            SELECT * FROM public.attendance_link_create(
              ${WS_A}, ${EMP_A}, ${MANAGER}, 'short', NULL, 0, false)
          `,
        ),
      ).toContain('token')
    })
  })

  describe('what the employee sends', () => {
    it('auto-apply OFF: the submission waits and the sheet is untouched', async () => {
      const made = await link(EMP_A, { autoApply: false })
      const out = await submit(made.id, '2026-10-01', 'present', '08:00', '16:30')
      expect(out).toMatchObject({ state: 'pending', replayed: false })
      expect((await recordOf(EMP_A, '2026-10-01')).length).toBe(0)
    })

    it('auto-apply ON and an empty day: the record is exactly what was sent, marked as from the link', async () => {
      const made = await link(EMP_A, { autoApply: true })
      const out = await submit(made.id, '2026-10-02', 'present', '08:15', '17:00')
      expect(out.state).toBe('applied')
      expect(await recordOf(EMP_A, '2026-10-02')).toEqual([
        { status: 'present', check_in: '08:15:00', check_out: '17:00:00', source: 'employee_link' },
      ])
    })

    it('⚠️ auto-apply ON and a day somebody already recorded: the record is NOT changed', async () => {
      await sql`
        INSERT INTO public.attendance (employee_id, date, status, user_id, workspace_id)
        VALUES (${EMP_A}, '2026-10-03', 'absent', ${MANAGER}, ${WS_A})
      `
      const made = await link(EMP_A, { autoApply: true })
      const out = await submit(made.id, '2026-10-03', 'present', '08:00', '16:00')
      expect(out.state).toBe('pending')
      expect(await recordOf(EMP_A, '2026-10-03')).toEqual([
        { status: 'absent', check_in: null, check_out: null, source: null },
      ])
    })

    it('the same form twice is one submission and one record', async () => {
      const made = await link(EMP_A, { autoApply: true })
      const key = requestId()
      const first = await submit(made.id, '2026-10-04', 'present', '09:00', null, key)
      const again = await submit(made.id, '2026-10-04', 'present', '09:00', null, key)
      expect(first).toMatchObject({ state: 'applied', replayed: false })
      expect(again).toMatchObject({ id: first.id, state: 'applied', replayed: true })
      const [row] = await sql`
        SELECT COUNT(*)::int AS n FROM public.attendance_submissions
         WHERE link_id = ${made.id} AND client_request_id = ${key}
      `
      expect(row!.n).toBe(1)
      expect((await recordOf(EMP_A, '2026-10-04')).length).toBe(1)
    })

    it('⚠️ the same form at the same instant: one row; the loser is told to read the winner', async () => {
      const made = await link(EMP_A, { autoApply: true })
      const key = requestId()
      const results = await Promise.allSettled([
        submit(made.id, '2026-10-05', 'present', '09:00', null, key),
        submit(made.id, '2026-10-05', 'present', '09:00', null, key),
      ])
      const won = results.filter((result) => result.status === 'fulfilled')
      expect(won.length).toBeGreaterThanOrEqual(1)
      for (const result of results) {
        if (result.status === 'rejected') {
          expect(String(result.reason.message)).toContain('ATTENDANCE_SUBMISSION_REPLAY')
        }
      }
      const [row] = await sql`
        SELECT COUNT(*)::int AS n FROM public.attendance_submissions WHERE link_id = ${made.id}
      `
      expect(row!.n).toBe(1)
      expect((await recordOf(EMP_A, '2026-10-05')).length).toBe(1)
    })

    it('times belong to a day at work: on leave they are dropped; out before in is refused', async () => {
      const made = await link(EMP_A, { autoApply: true })
      await submit(made.id, '2026-10-06', 'leave', '08:00', '16:00')
      expect(await recordOf(EMP_A, '2026-10-06')).toEqual([
        { status: 'leave', check_in: null, check_out: null, source: 'employee_link' },
      ])
      expect(
        await refusal(() => submit(made.id, '2026-10-07', 'present', '16:00', '08:00')),
      ).toContain('attendance_submissions_times')
      // …and the refused one left no record behind.
      expect((await recordOf(EMP_A, '2026-10-07')).length).toBe(0)
      expect(await refusal(() => submit(made.id, '2026-10-07', 'holiday', null, null))).toContain(
        'status',
      )
    })

    it('a revoked or expired link takes nothing', async () => {
      const old = await link(EMP_A, { autoApply: true })
      await link(EMP_A, { autoApply: true })
      expect(await refusal(() => submit(old.id, '2026-10-08', 'present', '08:00', null))).toContain(
        'ATTENDANCE_LINK_NOT_FOUND',
      )
      const [expired] = await sql`
        SELECT * FROM public.attendance_link_create(
          ${WS_A}, ${EMP_A}, ${MANAGER}, ${token()}, now() - interval '1 minute', 0, true)
      `
      expect(
        await refusal(() => submit(expired!.id, '2026-10-08', 'present', '08:00', null)),
      ).toContain('ATTENDANCE_LINK_NOT_FOUND')
      expect((await recordOf(EMP_A, '2026-10-08')).length).toBe(0)
    })
  })

  describe('a submission is for ever', () => {
    it('it cannot be deleted, and what was sent cannot be rewritten', async () => {
      const made = await link(EMP_A)
      const out = await submit(made.id, '2026-10-09', 'present', '08:00', '16:00')
      expect(
        await refusal(() => sql`DELETE FROM public.attendance_submissions WHERE id = ${out.id}`),
      ).toContain('ATTENDANCE_SUBMISSION_APPEND_ONLY')
      for (const change of [
        sql`check_in = '06:00'`,
        sql`date = '2026-10-10'`,
        sql`status = 'leave', check_in = NULL, check_out = NULL`,
        sql`received_at = now() - interval '1 day'`,
        sql`time_zone = 'Asia/Tehran'`,
        sql`employee_id = ${EMP_A2}`,
      ]) {
        expect(
          await refusal(
            () => sql`UPDATE public.attendance_submissions SET ${change} WHERE id = ${out.id}`,
          ),
        ).toContain('ATTENDANCE_SUBMISSION_APPEND_ONLY')
      }
      const [row] = await sql`
        SELECT check_in::text AS check_in, state FROM public.attendance_submissions WHERE id = ${out.id}
      `
      expect(row).toEqual({ check_in: '08:00:00', state: 'pending' })
    })

    it('⚠️ it does go with its workspace — the guard does not block a cascade', async () => {
      const made = await link(EMP_GONE, { workspace: WS_GONE })
      await submit(made.id, '2026-10-09', 'absent', null, null)
      await sql`DELETE FROM public.workspaces WHERE id = ${WS_GONE}`
      const [row] = await sql`
        SELECT (SELECT COUNT(*) FROM public.attendance_submissions WHERE workspace_id = ${WS_GONE})::int AS subs,
               (SELECT COUNT(*) FROM public.attendance_links WHERE workspace_id = ${WS_GONE})::int AS links
      `
      expect(row).toEqual({ subs: 0, links: 0 })
    })
  })

  describe('a manager decides', () => {
    const decide = (
      id: string,
      decision: string,
      note: string | null,
      workspace = WS_A,
      user = MANAGER,
    ) =>
      sql`
        SELECT public.attendance_submission_decide(${workspace}, ${id}, ${user}, ${decision}, ${note}) AS out
      `

    it('approve writes the day; the record is what the employee sent', async () => {
      const made = await link(EMP_A)
      const out = await submit(made.id, '2026-10-11', 'present', '07:45', '15:30')
      const [row] = await decide(out.id, 'approve', null)
      expect(row!.out).toMatchObject({ state: 'approved', employeeId: EMP_A })
      expect(await recordOf(EMP_A, '2026-10-11')).toEqual([
        { status: 'present', check_in: '07:45:00', check_out: '15:30:00', source: 'employee_link' },
      ])
    })

    it('approve over a day the manager had recorded replaces it — one row, not two', async () => {
      await sql`
        INSERT INTO public.attendance (employee_id, date, status, user_id, workspace_id)
        VALUES (${EMP_A}, '2026-10-12', 'absent', ${MANAGER}, ${WS_A})
      `
      const made = await link(EMP_A, { autoApply: true })
      const out = await submit(made.id, '2026-10-12', 'present', '10:00', '12:00')
      expect(out.state).toBe('pending')
      await decide(out.id, 'approve', null)
      expect(await recordOf(EMP_A, '2026-10-12')).toEqual([
        { status: 'present', check_in: '10:00:00', check_out: '12:00:00', source: 'employee_link' },
      ])
    })

    it('reject needs a reason, and leaves the sheet alone', async () => {
      const made = await link(EMP_A)
      const out = await submit(made.id, '2026-10-13', 'present', '08:00', '16:00')
      expect(await refusal(() => decide(out.id, 'reject', '   '))).toContain(
        'ATTENDANCE_REJECTION_REASON_REQUIRED',
      )
      await decide(out.id, 'reject', 'was on leave that day')
      const [row] = await sql`
        SELECT state, decision_note, decided_by FROM public.attendance_submissions WHERE id = ${out.id}
      `
      expect(row).toEqual({
        state: 'rejected',
        decision_note: 'was on leave that day',
        decided_by: MANAGER,
      })
      expect((await recordOf(EMP_A, '2026-10-13')).length).toBe(0)
    })

    it('a decision is final: approved, rejected and applied cannot be decided again', async () => {
      const made = await link(EMP_A, { autoApply: true })
      const applied = await submit(made.id, '2026-10-14', 'present', '08:00', null)
      expect(applied.state).toBe('applied')
      expect(await refusal(() => decide(applied.id, 'reject', 'no'))).toContain(
        'ATTENDANCE_SUBMISSION_DECIDED',
      )
      // The trigger says the same to a direct write.
      expect(
        await refusal(
          () => sql`
            UPDATE public.attendance_submissions SET state = 'pending' WHERE id = ${applied.id}
          `,
        ),
      ).toContain('ATTENDANCE_SUBMISSION_DECIDED')
    })

    it('⚠️ two managers at once: one approval wins, the other is told it was decided', async () => {
      const made = await link(EMP_A)
      const out = await submit(made.id, '2026-10-15', 'present', '08:00', '16:00')
      const results = await Promise.allSettled([
        decide(out.id, 'approve', null, WS_A, MANAGER),
        decide(out.id, 'reject', 'not true', WS_A, MANAGER_2),
      ])
      const won = results.filter((result) => result.status === 'fulfilled')
      const lost = results.filter(
        (result) => result.status === 'rejected',
      ) as PromiseRejectedResult[]
      expect(won.length).toBe(1)
      expect(lost.length).toBe(1)
      expect(String(lost[0]!.reason.message)).toContain('ATTENDANCE_SUBMISSION_DECIDED')
      // The sheet agrees with whichever won.
      const [row] = await sql`
        SELECT state FROM public.attendance_submissions WHERE id = ${out.id}
      `
      const records = await recordOf(EMP_A, '2026-10-15')
      expect(records.length).toBe(row!.state === 'approved' ? 1 : 0)
    })

    it('a manager of another workspace finds nothing to decide', async () => {
      const made = await link(EMP_A)
      const out = await submit(made.id, '2026-10-16', 'present', '08:00', '16:00')
      expect(await refusal(() => decide(out.id, 'approve', null, WS_B))).toContain(
        'ATTENDANCE_SUBMISSION_NOT_FOUND',
      )
      const [row] = await sql`
        SELECT state FROM public.attendance_submissions WHERE id = ${out.id}
      `
      expect(row!.state).toBe('pending')
    })
  })

  it('the zone belongs to the workplace: born NULL on business and branch, written on each submission', async () => {
    const [ws] = await sql`SELECT time_zone FROM public.workspaces WHERE id = ${WS_A}`
    expect(ws!.time_zone).toBeNull()
    const [branch] = await sql`
      INSERT INTO public.branches (workspace_id, name) VALUES (${WS_A}, 'Herat') RETURNING time_zone
    `
    expect(branch!.time_zone).toBeNull()
    await sql`UPDATE public.workspaces SET time_zone = 'Asia/Kabul' WHERE id = ${WS_B}`
    expect(
      await refusal(() => sql`UPDATE public.workspaces SET time_zone = '' WHERE id = ${WS_B}`),
    ).toContain('workspaces_time_zone_check')

    const columns = await sql`
      SELECT table_name FROM information_schema.columns
       WHERE table_schema = 'public' AND column_name = 'time_zone' ORDER BY table_name
    `
    // …and NOT on the link: the device that made a link says nothing about where the work is.
    expect(columns.map((row) => row.table_name)).toEqual([
      'attendance_submissions',
      'branches',
      'workspaces',
    ])

    const made = await link(EMP_A)
    const out = await submit(made.id, '2026-10-20', 'absent', null, null)
    const [row] = await sql`
      SELECT time_zone FROM public.attendance_submissions WHERE id = ${out.id}
    `
    expect(row!.time_zone).toBe('Asia/Kabul')
  })

  it('attendance.source takes NULL and employee_link, nothing else', async () => {
    expect(
      await refusal(
        () => sql`
          INSERT INTO public.attendance (employee_id, date, status, user_id, workspace_id, source)
          VALUES (${EMP_A2}, '2026-11-01', 'present', ${MANAGER}, ${WS_A}, 'guess')
        `,
      ),
    ).toContain('attendance_source_check')
    expect(
      await refusal(
        () => sql`
          INSERT INTO public.attendance (employee_id, date, status, user_id, workspace_id)
          VALUES (${EMP_A2}, '2026-11-01', 'present', ${MANAGER}, ${WS_A})
        `,
      ),
    ).toBe('ALLOWED')
  })
})
