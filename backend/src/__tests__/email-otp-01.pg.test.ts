// ============================================
// docs/email-otp-01-migration.sql run unchanged (twice) on real Postgres with
// Supabase's default privileges, then VERIFY; and the verifier's rules: a
// right code works once, a wrong one counts, five wrong ones lock, an expired
// one is refused.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'

const PORT = freePortSync()
const pg = new EmbeddedPostgres({
  databaseDir: pgTempDir('hisabche-pg-otp-'),
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/otp`
let sql: postgres.Sql
const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')
const U = '11111111-1111-4111-8111-111111111111'
const RIGHT = 'a'.repeat(64)
const WRONG = 'b'.repeat(64)

const issue = (minutes: number) =>
  sql`INSERT INTO email_otp_codes (user_id, email, code_hash, expires_at)
      VALUES (${U}, 'me@x.af', ${RIGHT}, now() + make_interval(mins => ${minutes}))`
const verify = async (hash: string) =>
  (await sql`SELECT email_otp_verify(${U}::uuid, 'ME@x.af', ${hash}) AS v`)[0]?.v

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('otp')
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
  `)
  await setup.unsafe(read('email-otp-01-migration.sql'))
  await setup.unsafe(read('email-otp-01-migration.sql'))
  await setup.end()
  sql = postgres(url, { max: 2, onnotice: () => {} })
}, 240_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
})

describe('email_otp_verify', () => {
  it('no code at all is EXPIRED', async () => {
    expect(await verify(RIGHT)).toBe('EXPIRED')
  })

  it('a wrong code counts; the right one works once (address case ignored)', async () => {
    await issue(10)
    expect(await verify(WRONG)).toBe('WRONG')
    expect(await verify(RIGHT)).toBe('VERIFIED')
    expect(await verify(RIGHT)).toBe('EXPIRED')
  })

  it('five wrong tries lock the code, even for the right one', async () => {
    await issue(10)
    for (let i = 0; i < 5; i++) expect(await verify(WRONG)).toBe('WRONG')
    expect(await verify(RIGHT)).toBe('LOCKED')
  })

  it('an expired code is refused', async () => {
    await issue(-1)
    expect(await verify(RIGHT)).toBe('EXPIRED')
  })

  it('VERIFY answers ok', async () => {
    const [row] = await sql.unsafe(read('VERIFY-email-otp-01.sql'))
    expect(row?.ok).toBe(true)
  })
})
