// ============================================
// backend/src/__tests__/warranty-claim-idempotency.pg.test.ts
//
// WP-02 on real Postgres: docs/warranty-claim-idempotency-migration.sql runs
// TWICE, then the rule is exercised with the writes it must refuse and the
// writes it must allow.
//
// The claim under test: the SAME idempotency key, inside one workspace, is ONE
// claim — and two workspaces may each use the same key, and a claim recorded
// without a key is still a claim.
//
// The fixture mirrors public.warranty_claims as docs/quality-events-01-migration.sql
// creates it (no foreign keys here: they are not what this migration decides).
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
  databaseDir: pgTempDir('hisabche-pg-warranty-idem-'),
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/warrantyidemdb`
let sql: postgres.Sql

const MIGRATION = readFileSync(
  join(__dirname, '..', '..', '..', 'docs', 'warranty-claim-idempotency-migration.sql'),
  'utf8',
)
const VERIFY = readFileSync(
  join(__dirname, '..', '..', '..', 'docs', 'VERIFY-warranty-claim-idempotency.sql'),
  'utf8',
)

const WS = '11111111-1111-4111-8111-111111111111'
const WS_B = '99999999-9999-4999-8999-999999999999'
const WARRANTY = '22222222-2222-4222-8222-222222222221'
const USER = '44444444-4444-4444-8444-444444444441'

async function insertClaim(
  workspaceId: string,
  clientRequestId: string | null,
): Promise<string | null> {
  const rows = await sql<{ id: string }[]>`
    INSERT INTO public.warranty_claims
      (workspace_id, warranty_id, claim_date, issue_description, disposition, actor_id,
       client_request_id)
    VALUES (
      ${workspaceId}::uuid, ${WARRANTY}::uuid, '2026-03-15', 'Switch loose', 'repair',
      ${USER}::uuid, ${clientRequestId}
    )
    RETURNING id`
  return rows[0]?.id ?? null
}

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('warrantyidemdb')
  sql = postgres(url, { max: 1, onnotice: () => {} })

  await sql.unsafe(`
    CREATE TABLE public.warranty_claims (
      id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id      uuid NOT NULL,
      warranty_id       uuid NOT NULL,
      claim_date        date NOT NULL,
      issue_description text NOT NULL,
      status            text NOT NULL DEFAULT 'pending',
      disposition       text NOT NULL,
      repair_ticket_id  uuid,
      resolution_notes  text,
      actor_id          uuid NOT NULL,
      created_at        timestamptz NOT NULL DEFAULT now()
    );
  `)

  // Twice on purpose: the migration must be safe to re-run.
  await sql.unsafe(MIGRATION)
  await sql.unsafe(MIGRATION)
})

afterAll(async () => {
  await sql?.end({ timeout: 5 })
  await pg?.stop()
})

describe('warranty-claim-idempotency migration', () => {
  it('creates the column, the partial unique index and the blank-key rule', async () => {
    const rows = (await sql.unsafe(VERIFY).simple()) as unknown as Array<
      Array<Record<string, unknown>>
    >
    const checks = rows[rows.length - 1]!
    for (const row of checks) {
      expect([row.check_name, row.ok]).toEqual([row.check_name, true])
    }
  })

  it('refuses a second claim with the same key in the same workspace', async () => {
    await insertClaim(WS, 'key-a')
    await expect(insertClaim(WS, 'key-a')).rejects.toMatchObject({ code: '23505' })
  })

  it('allows the same key in another workspace — the key is scoped, like every row', async () => {
    await insertClaim(WS, 'key-shared')
    const other = await insertClaim(WS_B, 'key-shared')
    expect(other).not.toBeNull()
  })

  it('allows two claims with no key at all (the key is optional, not required)', async () => {
    const first = await insertClaim(WS, null)
    const second = await insertClaim(WS, null)
    expect(first).not.toBeNull()
    expect(second).not.toBeNull()
  })

  it('refuses a blank key — it cannot be replayed, so it is not a key', async () => {
    await expect(insertClaim(WS, '   ')).rejects.toMatchObject({ code: '23514' })
  })

  it('still refuses a duplicate key after the constraint has been validated', async () => {
    await insertClaim(WS, 'key-late')
    await expect(insertClaim(WS, 'key-late')).rejects.toMatchObject({ code: '23505' })
  })
})
