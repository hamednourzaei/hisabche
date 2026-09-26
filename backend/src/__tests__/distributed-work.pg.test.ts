// ============================================
// Multi-instance background work — against a REAL Postgres.
//
// Runs docs/background-jobs-claim-migration.sql unchanged in an embedded
// Postgres 17 and drives it from two independent connection pools, standing in
// for two backend instances. SKIP LOCKED and advisory locks only mean anything
// under real concurrency, so nothing here is mocked.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const PORT = 54000 + Math.floor(Math.random() * 1000)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-'))
// UTF8 like Supabase — Windows' initdb default (WIN1252) cannot store the migration's own text.
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
})

const url = `postgres://postgres:test@localhost:${PORT}/jobs`
let a: postgres.Sql // "instance A"
let b: postgres.Sql // "instance B"

const migration = readFileSync(
  join(__dirname, '..', '..', '..', 'docs', 'background-jobs-claim-migration.sql'),
  'utf8',
)
const eventMigration = readFileSync(
  join(__dirname, '..', '..', '..', 'docs', 'event-log-claim-migration.sql'),
  'utf8',
)

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('jobs')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
    END $$;
    -- As in docs/base-schema-migration.sql.
    CREATE TABLE IF NOT EXISTS background_jobs (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      job_type text NOT NULL,
      status text NOT NULL,
      payload jsonb DEFAULT '{}'::jsonb,
      scheduled_at timestamptz DEFAULT now() NOT NULL,
      started_at timestamptz DEFAULT now(),
      completed_at timestamptz DEFAULT now(),
      last_error text,
      retry_count integer DEFAULT 0,
      max_retries integer DEFAULT 0,
      created_at timestamptz DEFAULT now() NOT NULL
    );
    -- As in docs/base-schema-migration.sql (columns the claim touches).
    CREATE TABLE IF NOT EXISTS event_log (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      event_type text NOT NULL,
      entity_type text NOT NULL,
      entity_id uuid NOT NULL,
      payload jsonb DEFAULT '{}'::jsonb,
      processed boolean DEFAULT true,
      created_at timestamptz DEFAULT now(),
      user_id uuid NOT NULL,
      retry_count integer DEFAULT 0,
      max_retries integer DEFAULT 0,
      next_retry_at timestamptz DEFAULT now(),
      error_message text,
      completed_at timestamptz DEFAULT now(),
      idempotency_key text
    );
  `)
  await setup.unsafe(migration)
  await setup.unsafe(eventMigration)
  // Idempotent: each migration must survive a second run unchanged.
  await setup.unsafe(migration)
  await setup.unsafe(eventMigration)
  await setup.end()
  a = postgres(url, { max: 10, onnotice: () => {} })
  b = postgres(url, { max: 10, onnotice: () => {} })
}, 180_000)

afterAll(async () => {
  await a?.end()
  await b?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
}, 60_000)

beforeEach(async () => {
  await a`DELETE FROM background_jobs`
  await a`DELETE FROM scheduled_task_runs`
  await a`DELETE FROM event_log`
})

const addJobs = (n: number, maxRetries = 2) =>
  a`INSERT INTO background_jobs (job_type, status, scheduled_at, max_retries)
    SELECT 'CHECK_OVERDUE_INVOICES', 'pending', now() - interval '1 second', ${maxRetries}
    FROM generate_series(1, ${n})`

const claim = (sql: postgres.Sql, worker: string, limit = 5, lease = 900) =>
  sql<{ id: string }[]>`SELECT id FROM claim_background_jobs(${worker}, ${limit}, ${lease})`

describe('a job is claimed by exactly one instance', () => {
  it('⚠️ a row being claimed by A is skipped by B, not returned twice', async () => {
    await addJobs(1)
    // A claims inside an open transaction: its row lock is held until commit.
    await a.begin(async (tx) => {
      const mine = await claim(tx as unknown as postgres.Sql, 'A', 1)
      expect(mine).toHaveLength(1)
      // B, concurrently, on another connection: SKIP LOCKED gives it nothing.
      const theirs = await claim(b, 'B', 1)
      expect(theirs).toHaveLength(0)
    })
    // After A committed the job is processing under A; B still cannot take it.
    expect(await claim(b, 'B', 1)).toHaveLength(0)
    const [row] = await a`SELECT status, claimed_by FROM background_jobs`
    expect(row).toMatchObject({ status: 'processing', claimed_by: 'A' })
  })

  it('⚠️ 200 jobs, 40 concurrent claims from two instances: every job once, none twice', async () => {
    await addJobs(200)
    const calls = Array.from({ length: 40 }, (_, i) =>
      claim(i % 2 === 0 ? a : b, i % 2 === 0 ? 'A' : 'B', 5),
    )
    const ids = (await Promise.all(calls)).flat().map((r) => r.id)
    expect(ids).toHaveLength(200)
    expect(new Set(ids).size).toBe(200)
  })
})

describe('failure, retry and recovery', () => {
  it('a failed job goes back to pending, runs again, and fails for good after max_retries', async () => {
    await addJobs(1, 1)
    const [job] = await claim(a, 'A', 1)
    const [first] = await a`SELECT fail_background_job(${job!.id}::uuid, 'A', 'boom', 0) AS s`
    expect(first!.s).toBe('pending')
    const [again] = await claim(b, 'B', 1)
    expect(again!.id).toBe(job!.id)
    const [second] =
      await b`SELECT fail_background_job(${job!.id}::uuid, 'B', 'boom again', 0) AS s`
    expect(second!.s).toBe('failed')
    expect(await claim(a, 'A', 1)).toHaveLength(0)
    const [row] = await a`SELECT retry_count, last_error FROM background_jobs`
    expect(row).toMatchObject({ retry_count: 1, last_error: 'boom again' })
  })

  it('⚠️ a stale claim (worker died) is recovered by another instance — and the dead one cannot finish it', async () => {
    await addJobs(1, 2)
    const [job] = await claim(a, 'A', 1, 1) // 1-second lease
    await new Promise((r) => setTimeout(r, 1300))
    const [recovered] = await claim(b, 'B', 1, 900)
    expect(recovered!.id).toBe(job!.id)
    // A comes back late: its completion is refused, B's claim stands.
    const [late] = await a`SELECT complete_background_job(${job!.id}::uuid, 'A') AS ok`
    expect(late!.ok).toBe(false)
    const [done] = await b`SELECT complete_background_job(${job!.id}::uuid, 'B') AS ok`
    expect(done!.ok).toBe(true)
  })

  it('a stale claim that has used its retries ends as failed, not run again', async () => {
    await addJobs(1, 0)
    await claim(a, 'A', 1, 1)
    await new Promise((r) => setTimeout(r, 1300))
    expect(await claim(b, 'B', 1)).toHaveLength(0)
    const [row] = await a`SELECT status, last_error FROM background_jobs`
    expect(row!.status).toBe('failed')
    expect(String(row!.last_error)).toContain('CLAIM_EXPIRED')
  })

  it('⚠️ a restart loses nothing: pending stays pending, an abandoned claim comes back', async () => {
    await addJobs(3, 2)
    // "Instance A" claims one and is killed; its pool is simply gone.
    const [taken] = await claim(a, 'A-before-restart', 1, 1)
    await new Promise((r) => setTimeout(r, 1300))
    // After restart the process has a NEW worker id.
    const after = await claim(b, 'A-after-restart', 10)
    expect(after.map((r) => r.id)).toContain(taken!.id)
    expect(after).toHaveLength(3)
  })

  it('⚠️ duplicate delivery is idempotent: a second completion changes nothing', async () => {
    await addJobs(1)
    const [job] = await claim(a, 'A', 1)
    const [first] = await a`SELECT complete_background_job(${job!.id}::uuid, 'A') AS ok`
    const [dupe] = await a`SELECT complete_background_job(${job!.id}::uuid, 'A') AS ok`
    const [other] = await b`SELECT complete_background_job(${job!.id}::uuid, 'B') AS ok`
    expect([first!.ok, dupe!.ok, other!.ok]).toEqual([true, false, false])
    expect(await claim(b, 'B', 1)).toHaveLength(0)
  })
})

describe('a scheduled task runs once per slot, never two at once', () => {
  const claimRun = (sql: postgres.Sql, holder: string, slot: string, lease = 900) =>
    sql<
      { ok: boolean }[]
    >`SELECT claim_scheduled_run('trial-expiration', ${slot}, ${holder}, ${lease}) AS ok`
  const finish = (sql: postgres.Sql, holder: string, slot: string) =>
    sql`SELECT finish_scheduled_run('trial-expiration', ${slot}, ${holder}, NULL)`

  it('⚠️ 20 instances fire the same tick at once: exactly one runs it', async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) => claimRun(i % 2 ? a : b, `I${i}`, 'slot-1')),
    )
    expect(results.filter(([r]) => r!.ok)).toHaveLength(1)
  })

  it('⚠️ the next tick cannot start while the previous run is still open on another instance', async () => {
    const [first] = await claimRun(a, 'A', 'slot-1')
    expect(first!.ok).toBe(true)
    const [overlap] = await claimRun(b, 'B', 'slot-2')
    expect(overlap!.ok).toBe(false)
    await finish(a, 'A', 'slot-1')
    const [next] = await claimRun(b, 'B', 'slot-2')
    expect(next!.ok).toBe(true)
  })

  it('a run whose instance died stops blocking once its lease passes', async () => {
    await claimRun(a, 'A', 'slot-1', 1)
    await new Promise((r) => setTimeout(r, 1300))
    const [next] = await claimRun(b, 'B', 'slot-2', 1)
    expect(next!.ok).toBe(true)
  })

  it('the same slot never runs twice, even after the first run finished', async () => {
    await claimRun(a, 'A', 'slot-1')
    await finish(a, 'A', 'slot-1')
    const [again] = await claimRun(b, 'B', 'slot-1')
    expect(again!.ok).toBe(false)
  })
})

describe('clients cannot use any of it', () => {
  it('anon and authenticated have no EXECUTE on the claim functions', async () => {
    const [row] = await a`
      SELECT has_function_privilege('anon', 'claim_background_jobs(text, integer, integer)', 'EXECUTE') AS anon,
             has_function_privilege('authenticated', 'claim_scheduled_run(text, text, text, integer)', 'EXECUTE') AS authed,
             has_function_privilege('service_role', 'claim_background_jobs(text, integer, integer)', 'EXECUTE') AS service`
    expect(row).toMatchObject({ anon: false, authed: false, service: true })
  })
})

describe('event_log: an event is processed by one instance at a time', () => {
  const addEvents = (n: number, processed = false) =>
    a`INSERT INTO event_log (event_type, entity_type, entity_id, user_id, processed, next_retry_at)
      SELECT 'invoice.created', 'invoice', gen_random_uuid(), gen_random_uuid(), ${processed}, now() - interval '1 second'
      FROM generate_series(1, ${n})`
  const claimEvents = (
    sql: postgres.Sql,
    worker: string,
    limit = 10,
    lease = 300,
    id: string | null = null,
  ) =>
    sql<
      { id: string }[]
    >`SELECT id FROM claim_event_log(${worker}, ${limit}, ${lease}, ${id}::uuid)`

  it('⚠️ the emitting instance and a recovery pass race for one event: exactly one gets it', async () => {
    await addEvents(1)
    const [row] = await a<{ id: string }[]>`SELECT id FROM event_log`
    const id = row!.id
    const results = await Promise.all([
      claimEvents(a, 'emitter', 1, 300, id),
      claimEvents(b, 'recovery', 10),
      claimEvents(b, 'recovery-2', 10),
      claimEvents(a, 'emitter-again', 1, 300, id),
    ])
    expect(results.flat()).toHaveLength(1)
  })

  it('⚠️ 150 events, 30 concurrent batch claims from two instances: each once, none twice', async () => {
    await addEvents(150)
    const calls = Array.from({ length: 30 }, (_, i) =>
      claimEvents(i % 2 ? a : b, i % 2 ? 'A' : 'B', 10),
    )
    const ids = (await Promise.all(calls)).flat().map((r) => r.id)
    expect(ids).toHaveLength(150)
    expect(new Set(ids).size).toBe(150)
  })

  it('an event already processed is never claimed', async () => {
    await addEvents(3, true)
    expect(await claimEvents(a, 'A', 10)).toHaveLength(0)
  })

  it('historical rows (inserted on the column default, processed = TRUE) stay untouched; new ones are recovered', async () => {
    // What the old emit() wrote: no `processed` column → the DEFAULT true.
    await a`INSERT INTO event_log (event_type, entity_type, entity_id, user_id)
            VALUES ('invoice.created', 'invoice', gen_random_uuid(), gen_random_uuid())`
    // What emit() writes now.
    await addEvents(1, false)
    const claimed = await claimEvents(b, 'recovery', 10)
    expect(claimed).toHaveLength(1)
    const rows = await a<{ processed: boolean; claimed_by: string | null }[]>`
      SELECT processed, claimed_by FROM event_log ORDER BY created_at`
    expect(rows).toEqual([
      { processed: true, claimed_by: null },
      { processed: false, claimed_by: 'recovery' },
    ])
  })

  it('a failed event waits out its backoff, runs again, and is dead after its retries', async () => {
    await a`INSERT INTO event_log (event_type, entity_type, entity_id, user_id, processed, max_retries, next_retry_at)
            VALUES ('x', 'invoice', gen_random_uuid(), gen_random_uuid(), false, 2, now() - interval '1 second')`
    const [first] = await claimEvents(a, 'A', 1)
    const [r1] = await a`SELECT fail_event_log(${first!.id}::uuid, 'A', 'boom') AS s`
    expect(r1!.s).toBe('retry')
    // Backoff: not claimable yet.
    expect(await claimEvents(b, 'B', 1)).toHaveLength(0)
    await a`UPDATE event_log SET next_retry_at = now() - interval '1 second'`
    const [second] = await claimEvents(b, 'B', 1)
    expect(second!.id).toBe(first!.id)
    const [r2] = await b`SELECT fail_event_log(${second!.id}::uuid, 'B', 'boom') AS s`
    expect(r2!.s).toBe('dead')
    await a`UPDATE event_log SET next_retry_at = now() - interval '1 second'`
    expect(await claimEvents(a, 'A', 1)).toHaveLength(0)
  })

  it('⚠️ a stale claim is recovered, and the instance that lost it cannot complete it', async () => {
    await addEvents(1)
    const [held] = await claimEvents(a, 'A', 1, 1)
    await new Promise((r) => setTimeout(r, 1300))
    const [recovered] = await claimEvents(b, 'B', 1, 300)
    expect(recovered!.id).toBe(held!.id)
    const [late] = await a`SELECT complete_event_log(${held!.id}::uuid, 'A') AS ok`
    const [done] = await b`SELECT complete_event_log(${held!.id}::uuid, 'B') AS ok`
    const [dupe] = await b`SELECT complete_event_log(${held!.id}::uuid, 'B') AS ok`
    expect([late!.ok, done!.ok, dupe!.ok]).toEqual([false, true, false])
    const [row] = await a`SELECT processed, retry_count FROM event_log`
    expect(row).toMatchObject({ processed: true, retry_count: 1 })
  })

  it('clients cannot claim events', async () => {
    const [row] = await a`
      SELECT has_function_privilege('anon', 'claim_event_log(text, integer, integer, uuid)', 'EXECUTE') AS anon,
             has_function_privilege('authenticated', 'complete_event_log(uuid, text)', 'EXECUTE') AS authed`
    expect(row).toMatchObject({ anon: false, authed: false })
  })
})
