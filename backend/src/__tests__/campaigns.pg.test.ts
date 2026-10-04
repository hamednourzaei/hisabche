// ============================================
// docs/campaigns-01-migration.sql run unchanged (twice) in a real Postgres,
// with Supabase's default privileges, then its VERIFY — and the rules only the
// database can hold: a campaign launches ONCE, a recipient is sent XOR skipped,
// an answer is given once, and history does not change.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const PORT = 50100 + Math.floor(Math.random() * 800)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-camp-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/camp`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')
const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const USER = '11111111-1111-4111-8111-111111111111'
const C1 = 'c1111111-1111-4111-8111-111111111111'
const C2 = 'c2222222-2222-4222-8222-222222222222'
const T1 = 'd1111111-1111-4111-8111-111111111111'
const T2 = 'd2222222-2222-4222-8222-222222222222'

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('camp')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    END $$;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    -- As on Supabase: every new table and function in public arrives already
    -- granted to the three API roles.
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;`)
  await setup.unsafe(read('email-outbox-migration.sql'))
  await setup.unsafe(read('campaigns-01-migration.sql'))
  await setup.unsafe(read('campaigns-01-migration.sql'))
  await setup.end()
  sql = postgres(url, { max: 6, onnotice: () => {} })
}, 240_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
})

let campaign = ''
beforeEach(async () => {
  await sql`TRUNCATE campaign_recipients, customer_campaigns, customer_contact_optouts, email_outbox CASCADE`
  const [row] = await sql`
    INSERT INTO customer_campaigns (workspace_id, name, kind, subject, body, language, segment, created_by)
    VALUES (${WS}, 'نظرسنجی', 'nps', 'نظر شما', 'سلام', 'fa', 'all', ${USER}) RETURNING id`
  campaign = row!.id
})

const lines = () => [
  { customer_id: C1, email: 'a@example.com', token: T1, html: '<p>1</p>' },
  { customer_id: C2, email: '', token: T2, skip_reason: 'NO_EMAIL' },
]
const launch = (workspace = WS, body: unknown = lines()) =>
  sql`SELECT campaign_launch(${workspace}, ${USER}, ${campaign}, ${JSON.stringify(body)}::text::jsonb) AS result`

describe('campaigns-01', () => {
  it('VERIFY: every check is ok', async () => {
    const rows = await sql.unsafe(read('VERIFY-campaigns-01.sql'))
    expect(rows.length).toBeGreaterThanOrEqual(16)
    expect(rows.filter((row) => row.ok !== true).map((row) => row.check)).toEqual([])
  })

  it('launching writes the recipients AND their outbox emails together', async () => {
    const [row] = await launch()
    expect(row!.result).toEqual({ queued: 1, skipped: 1 })
    const outbox = await sql`SELECT to_email, subject, status FROM email_outbox`
    expect(outbox).toEqual([{ to_email: 'a@example.com', subject: 'نظر شما', status: 'pending' }])
    const recipients =
      await sql`SELECT customer_id, outbox_id IS NOT NULL AS sent, skip_reason FROM campaign_recipients ORDER BY customer_id`
    expect(recipients).toEqual([
      { customer_id: C1, sent: true, skip_reason: null },
      { customer_id: C2, sent: false, skip_reason: 'NO_EMAIL' },
    ])
    const [state] = await sql`SELECT status, sent_by FROM customer_campaigns WHERE id = ${campaign}`
    expect(state).toEqual({ status: 'sent', sent_by: USER })
  })

  it('five people pressing «send» at once: ONE launch, one email per customer', async () => {
    const settled = await Promise.allSettled(Array.from({ length: 5 }, () => launch()))
    expect(settled.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    for (const result of settled) {
      if (result.status === 'rejected')
        expect(String(result.reason)).toContain('CAMPAIGN_ALREADY_SENT')
    }
    const [count] = await sql`SELECT COUNT(*)::int AS c FROM email_outbox`
    expect(count!.c).toBe(1)
  })

  it('a failing line rolls the WHOLE launch back — no half-sent campaign', async () => {
    const broken = [
      ...lines(),
      { customer_id: C1, email: 'again@example.com', token: T1, html: '<p>x</p>' },
    ]
    await expect(launch(WS, broken)).rejects.toThrow()
    const [emails] = await sql`SELECT COUNT(*)::int AS c FROM email_outbox`
    const [recipients] = await sql`SELECT COUNT(*)::int AS c FROM campaign_recipients`
    const [state] = await sql`SELECT status FROM customer_campaigns WHERE id = ${campaign}`
    expect([emails!.c, recipients!.c, state!.status]).toEqual([0, 0, 'draft'])
  })

  it('another workspace cannot launch this campaign, and an empty one is refused', async () => {
    await expect(launch(OTHER)).rejects.toThrow('CAMPAIGN_NOT_FOUND')
    await expect(launch(WS, [])).rejects.toThrow('CAMPAIGN_NO_RECIPIENTS')
  })

  it('an answer is given once, only by someone who was sent to, and is 0–10', async () => {
    await launch()
    const answer = (token: string, score: number) => sql`
      UPDATE campaign_recipients SET nps_score = ${score}, responded_at = now()
       WHERE token = ${token} AND nps_score IS NULL RETURNING id`
    await expect(answer(T1, 11)).rejects.toThrow(/nps_score/)
    await expect(answer(T2, 9)).rejects.toThrow('campaign_recipients_answer_needs_send')
    expect(await answer(T1, 9)).toHaveLength(1)
    expect(await answer(T1, 2)).toHaveLength(0)
    await expect(
      sql`UPDATE campaign_recipients SET nps_score = 2 WHERE token = ${T1}`,
    ).rejects.toThrow('NPS_ALREADY_ANSWERED')
  })

  it('what was sent cannot be rewritten, and a sent campaign does not go back to draft', async () => {
    await launch()
    await expect(
      sql`UPDATE customer_campaigns SET body = 'دیگر' WHERE id = ${campaign}`,
    ).rejects.toThrow('CAMPAIGN_ALREADY_SENT')
    await expect(
      sql`UPDATE customer_campaigns SET status = 'draft' WHERE id = ${campaign}`,
    ).rejects.toThrow('CAMPAIGN_ALREADY_SENT')
    await expect(
      sql`UPDATE campaign_recipients SET outbox_id = NULL, skip_reason = 'NO_EMAIL' WHERE token = ${T1}`,
    ).rejects.toThrow('CAMPAIGN_RECIPIENT_IMMUTABLE')
  })

  it('the backend role cannot delete a campaign, a recipient or an opt-out; a browser role sees nothing', async () => {
    for (const table of ['customer_campaigns', 'campaign_recipients', 'customer_contact_optouts']) {
      await expect(
        sql.begin(async (tx) => {
          await tx`SET LOCAL ROLE service_role`
          await tx.unsafe(`DELETE FROM ${table}`)
        }),
      ).rejects.toThrow(/permission denied/)
      await expect(
        sql.begin(async (tx) => {
          await tx`SET LOCAL ROLE authenticated`
          await tx.unsafe(`SELECT * FROM ${table}`)
        }),
      ).rejects.toThrow(/permission denied/)
    }
    await expect(
      sql.begin(async (tx) => {
        await tx`SET LOCAL ROLE anon`
        await tx`SELECT campaign_launch(${WS}, ${USER}, ${campaign}, '[]'::jsonb)`
      }),
    ).rejects.toThrow(/permission denied/)
  })
})
