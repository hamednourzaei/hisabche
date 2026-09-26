// ============================================
// The email outbox — against a REAL Postgres.
//
// Runs docs/email-outbox-migration.sql unchanged (twice: it must be
// re-runnable) in an embedded Postgres 17, driven from two connection pools
// standing in for two backend instances. SKIP LOCKED only means anything under
// real concurrency, so nothing here is mocked.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const PORT = 55000 + Math.floor(Math.random() * 1000)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-mail-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
})

const url = `postgres://postgres:test@localhost:${PORT}/mail`
let a: postgres.Sql // "instance A"
let b: postgres.Sql // "instance B"

const migration = readFileSync(
  join(__dirname, '..', '..', '..', 'docs', 'email-outbox-migration.sql'),
  'utf8',
)

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('mail')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
    END $$;
  `)
  await setup.unsafe(migration)
  await setup.unsafe(migration)
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
  await a`DELETE FROM email_outbox`
})

const enqueue = async (n = 1, maxAttempts = 5) =>
  (
    await a<{ id: string }[]>`
      INSERT INTO email_outbox (to_email, subject, html, max_attempts)
      SELECT 'u' || g || '@example.com', 'Reset', '<a href="/reset?token=secret">reset</a>', ${maxAttempts}
      FROM generate_series(1, ${n}) g
      RETURNING id`
  ).map((r) => r.id)

const claim = (
  sql: postgres.Sql,
  worker: string,
  limit = 10,
  lease = 120,
  id: string | null = null,
) =>
  sql<{ id: string; attempts: number }[]>`
    SELECT id, attempts FROM claim_email_outbox(${worker}, ${limit}, ${lease}, ${id}::uuid)`

const row = async (id: string) =>
  (
    await a<{ status: string; html: string | null; attempts: number; claimed_by: string | null }[]>`
    SELECT status, html, attempts, claimed_by FROM email_outbox WHERE id = ${id}`
  )[0]!

describe('⚠️ an email is sent by one instance, never two', () => {
  it("the sender (claim by id) and another instance's poller race: exactly one gets it", async () => {
    const [id] = await enqueue()
    const results = await Promise.all([
      claim(a, 'sender', 1, 120, id!),
      claim(b, 'poller-B', 10),
      claim(b, 'poller-B2', 10),
      claim(a, 'poller-A', 10),
    ])
    expect(results.flat()).toHaveLength(1)
  })

  it('120 emails, 24 concurrent claims from two instances: each exactly once', async () => {
    await enqueue(120)
    const calls = Array.from({ length: 24 }, (_, i) => claim(i % 2 ? a : b, i % 2 ? 'A' : 'B', 10))
    const ids = (await Promise.all(calls)).flat().map((r) => r.id)
    expect(ids).toHaveLength(120)
    expect(new Set(ids).size).toBe(120)
  })
})

describe('outcomes, recorded only by the holder', () => {
  it('sent: the body — a live reset token — is erased', async () => {
    const [id] = await enqueue()
    await claim(a, 'A', 1, 120, id!)
    const [r] = await a`SELECT complete_email_outbox(${id!}::uuid, 'A', 'resend-123') AS ok`
    expect(r!.ok).toBe(true)
    expect(await row(id!)).toMatchObject({ status: 'sent', html: null, claimed_by: null })
    // A sent email is never claimed again.
    expect(await claim(b, 'B')).toHaveLength(0)
  })

  it('a non-holder cannot complete or fail it', async () => {
    const [id] = await enqueue()
    await claim(a, 'A', 1, 120, id!)
    const [c] = await b`SELECT complete_email_outbox(${id!}::uuid, 'B', null) AS ok`
    const [f] = await b`SELECT fail_email_outbox(${id!}::uuid, 'B', 'x', 0) AS s`
    expect(c!.ok).toBe(false)
    expect(f!.s).toBeNull()
    expect((await row(id!)).status).toBe('sending')
  })

  it('a failure waits out its backoff, is retried, and ends failed — body erased — after its attempts', async () => {
    const [id] = await enqueue(1, 2)
    await claim(a, 'A', 1)
    const [r1] = await a`SELECT fail_email_outbox(${id!}::uuid, 'A', 'provider 500', 60) AS s`
    expect(r1!.s).toBe('pending')
    // Backoff: not due yet.
    expect(await claim(b, 'B')).toHaveLength(0)
    await a`UPDATE email_outbox SET next_attempt_at = now() - interval '1 second'`
    const [second] = await claim(b, 'B')
    expect(second).toMatchObject({ id, attempts: 2 })
    const [r2] = await b`SELECT fail_email_outbox(${id!}::uuid, 'B', 'provider 500', 60) AS s`
    expect(r2!.s).toBe('failed')
    expect(await row(id!)).toMatchObject({ status: 'failed', html: null })
    await a`UPDATE email_outbox SET next_attempt_at = now() - interval '1 second'`
    expect(await claim(a, 'A')).toHaveLength(0)
  })
})

describe('⚠️ an instance that dies mid-send does not lose the email', () => {
  it("its claim expires, another instance sends it, and the dead one's late answer is refused", async () => {
    const [id] = await enqueue()
    await claim(a, 'A-crashed', 1, 1, id!)
    // Still held: nobody else may take it.
    expect(await claim(b, 'B')).toHaveLength(0)
    await a`UPDATE email_outbox SET claim_expires_at = now() - interval '1 second'`
    const [taken] = await claim(b, 'B')
    expect(taken).toMatchObject({ id, attempts: 2 })
    const [late] = await a`SELECT complete_email_outbox(${id!}::uuid, 'A-crashed', null) AS ok`
    expect(late!.ok).toBe(false)
    expect((await row(id!)).claimed_by).toBe('B')
  })

  it('a dead claim with no attempts left ends failed, not stuck in "sending" forever', async () => {
    const [id] = await enqueue(1, 1)
    await claim(a, 'A-crashed', 1, 1, id!)
    await a`UPDATE email_outbox SET claim_expires_at = now() - interval '1 second'`
    expect(await claim(b, 'B')).toHaveLength(0)
    expect(await row(id!)).toMatchObject({ status: 'failed', html: null })
  })
})

describe('the body is a credential: clients cannot see the table or claim rows', () => {
  it('anon and authenticated have no privilege on the table or the functions; RLS is on', async () => {
    const [p] = await a`
      SELECT has_table_privilege('anon', 'public.email_outbox', 'SELECT') AS anon_sel,
             has_table_privilege('authenticated', 'public.email_outbox', 'SELECT') AS auth_sel,
             has_function_privilege('anon', 'public.claim_email_outbox(text, integer, integer, uuid)', 'EXECUTE') AS anon_claim,
             has_function_privilege('authenticated', 'public.claim_email_outbox(text, integer, integer, uuid)', 'EXECUTE') AS auth_claim,
             (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.email_outbox'::regclass) AS rls`
    expect(p).toEqual({
      anon_sel: false,
      auth_sel: false,
      anon_claim: false,
      auth_claim: false,
      rls: true,
    })
  })
})
