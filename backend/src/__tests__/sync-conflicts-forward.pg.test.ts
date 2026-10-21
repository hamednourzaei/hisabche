// ============================================
// docs/sync-conflicts-forward-01-migration.sql, run unchanged — twice — on a
// real Postgres, then the rules it has to hold.
//
// A decided conflict is final: no going back to 'open'. A HUMAN decision names
// the person who made it and the moment. An AUTO-MERGE (the machine merging a
// non-financial field) names only the moment — demanding a decider there would
// reject the write the sync path actually makes, and the merge would be lost.
//
// The writes it must refuse, the writes it must allow, and the documented
// ROLLBACK (which must leave the table usable) are all here. A one-sided test
// would pass on a trigger that refuses everything.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'

const PORT = freePortSync()
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-conflicts-forward-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const MIGRATION = readFileSync(join(DOCS, 'sync-conflicts-forward-01-migration.sql'), 'utf8')
const VERIFY = readFileSync(join(DOCS, 'VERIFY-sync-conflicts-forward-01.sql'), 'utf8')

const SHOP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OWNER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ENTITY = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

let sql: ReturnType<typeof postgres>

/**
 * The ROLLBACK block the migration documents, as SQL.
 *
 * Read out of the file itself: a rollback that exists only in a comment nobody
 * runs is not a rollback, and a copy pasted into a test can drift from the one
 * a person would run.
 */
function documentedRollback(file: string): string {
  // The files are CRLF on this machine: strip the carriage return, or `$`
  // never matches and the parsed block comes back empty (which would make this
  // test pass against nothing).
  const lines = file.split('\n').map((line) => line.replace(/\r$/, ''))
  const start = lines.findIndex((line) => /^--\s*ROLLBACK\s*$/.test(line))
  if (start < 0) throw new Error('the migration documents no ROLLBACK block')
  const body: string[] = []
  for (const line of lines.slice(start + 1)) {
    if (/^--\s*={5,}/.test(line)) break
    if (/^--\s*-{5,}/.test(line)) continue
    const match = /^--\s?(.*)$/.exec(line)
    if (match) body.push(match[1]!)
  }
  const rollback = body.join('\n')
  // An empty parse would make the test below assert against nothing.
  if (!/DROP\s+TRIGGER/i.test(rollback)) {
    throw new Error('the ROLLBACK block parsed to nothing usable')
  }
  return rollback
}

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  sql = postgres({
    host: 'localhost',
    port: PORT,
    user: 'postgres',
    password: 'test',
    max: 1,
    onnotice: () => undefined,
  })
  await sql.unsafe(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

    -- The table as docs/sync-conflicts-migration.sql leaves it, without the
    -- RLS policy (that needs auth.uid() and workspace_members).
    CREATE TABLE sync_conflicts (
      id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id      uuid NOT NULL,
      entity_type       text NOT NULL,
      entity_id         uuid NOT NULL,
      mutation_id       text NOT NULL,
      operation         text NOT NULL,
      server_version    integer,
      server_row        jsonb NOT NULL DEFAULT '{}'::jsonb,
      client_version    integer,
      client_payload    jsonb NOT NULL DEFAULT '{}'::jsonb,
      divergences       jsonb NOT NULL DEFAULT '[]'::jsonb,
      has_financial_divergence boolean NOT NULL DEFAULT false,
      status            text NOT NULL DEFAULT 'open',
      resolution        text,
      resolution_reason text,
      resolved_row      jsonb,
      resolved_by       uuid,
      resolved_at       timestamptz,
      detected_by       uuid,
      created_at        timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT sync_conflicts_status_check
        CHECK (status IN ('open', 'resolved', 'superseded')),
      CONSTRAINT sync_conflicts_resolution_check
        CHECK (resolution IS NULL OR resolution IN ('keep_server', 'keep_client', 'merge', 'auto_merge'))
    );
    CREATE UNIQUE INDEX sync_conflicts_mutation_key
      ON sync_conflicts (workspace_id, mutation_id);
  `)
}, 120_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
})

async function openConflict(mutationId: string): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO sync_conflicts
      (workspace_id, entity_type, entity_id, mutation_id, operation, server_row, client_payload)
    VALUES (${SHOP}, 'invoice', ${ENTITY}, ${mutationId}, 'create', '{}'::jsonb, '{}'::jsonb)
    RETURNING id`
  return String(row?.id)
}

describe('a decision on a conflict is final', () => {
  it('runs twice without error', async () => {
    await sql.unsafe(MIGRATION)
    await sql.unsafe(MIGRATION)
  })

  it('allows open -> resolved when a person and a moment are recorded', async () => {
    const id = await openConflict('m-allow')
    await sql`
      UPDATE sync_conflicts
      SET status = 'resolved', resolution = 'keep_client',
          resolution_reason = 'the device version is the sale that happened',
          resolved_by = ${OWNER}, resolved_at = now()
      WHERE id = ${id}`
    const [row] = await sql<{ status: string; resolution: string }[]>`
      SELECT status, resolution FROM sync_conflicts WHERE id = ${id}`
    expect(row?.status).toBe('resolved')
    expect(row?.resolution).toBe('keep_client')
  })

  it('allows an auto-merge: the machine decided, with a moment and no decider', async () => {
    // ⚠️ THIS IS THE SHAPE THE SYNC PATH WRITES (ConflictService.record, a
    // non-financial field). If the trigger refused it, the write would fail,
    // `fileConflict` would swallow the error, and the merge would vanish.
    const [row] = await sql<
      { id: string; status: string; resolution: string; resolved_by: string | null }[]
    >`
      INSERT INTO sync_conflicts
        (workspace_id, entity_type, entity_id, mutation_id, operation,
         server_row, client_payload, divergences, has_financial_divergence,
         status, resolution, resolution_reason, resolved_row, resolved_at, detected_by)
      VALUES (${SHOP}, 'customer', ${ENTITY}, 'm-auto', 'update',
              '{"note":"old"}'::jsonb, '{"note":"new"}'::jsonb,
              '[{"field":"note","serverValue":"old","clientValue":"new","financial":false}]'::jsonb,
              false, 'resolved', 'auto_merge', 'no financial field diverged',
              '{"note":"new"}'::jsonb, now(), ${OWNER})
      RETURNING id, status, resolution, resolved_by`

    expect(row?.status).toBe('resolved')
    expect(row?.resolution).toBe('auto_merge')
    // The machine is not a person: no decider is invented for it.
    expect(row?.resolved_by).toBeNull()
  })

  it('allows the same auto-merge to be written again (a replay)', async () => {
    // `record()` upserts on (workspace_id, mutation_id): a re-delivered
    // mutation must not be refused, or the sync reports a failure that is not.
    await sql`
      UPDATE sync_conflicts
      SET resolved_at = now(), resolution_reason = 'no financial field diverged'
      WHERE workspace_id = ${SHOP} AND mutation_id = 'm-auto'`
    const [row] = await sql<{ status: string }[]>`
      SELECT status FROM sync_conflicts WHERE mutation_id = 'm-auto'`
    expect(row?.status).toBe('resolved')
  })

  it('refuses resolved -> open', async () => {
    const id = await openConflict('m-back')
    await sql`
      UPDATE sync_conflicts
      SET status = 'resolved', resolution = 'keep_server', resolved_by = ${OWNER}, resolved_at = now()
      WHERE id = ${id}`

    await expect(sql`UPDATE sync_conflicts SET status = 'open' WHERE id = ${id}`).rejects.toThrow(
      /cannot go back/,
    )
  })

  it('refuses superseded -> open', async () => {
    const id = await openConflict('m-superseded')
    await sql`UPDATE sync_conflicts SET status = 'superseded' WHERE id = ${id}`
    await expect(sql`UPDATE sync_conflicts SET status = 'open' WHERE id = ${id}`).rejects.toThrow(
      /cannot go back/,
    )
  })

  it('refuses a resolution with no decider', async () => {
    const id = await openConflict('m-nobody')
    await expect(
      sql`
        UPDATE sync_conflicts
        SET status = 'resolved', resolution = 'keep_client', resolved_at = now()
        WHERE id = ${id}`,
    ).rejects.toThrow(/needs resolved_by/)
  })

  it('refuses a resolution with no moment', async () => {
    const id = await openConflict('m-notime')
    await expect(
      sql`
        UPDATE sync_conflicts
        SET status = 'resolved', resolution = 'keep_client', resolved_by = ${OWNER}
        WHERE id = ${id}`,
    ).rejects.toThrow(/needs resolved_at/)
  })

  it('refuses an auto-merge with no moment', async () => {
    const id = await openConflict('m-auto-notime')
    await expect(
      sql`
        UPDATE sync_conflicts
        SET status = 'resolved', resolution = 'auto_merge'
        WHERE id = ${id}`,
    ).rejects.toThrow(/needs resolved_at/)
  })

  it('refuses a row inserted already resolved with no decider', async () => {
    await expect(
      sql`
        INSERT INTO sync_conflicts
          (workspace_id, entity_type, entity_id, mutation_id, operation, status, resolution, resolved_at)
        VALUES (${SHOP}, 'invoice', ${ENTITY}, 'm-inserted', 'create', 'resolved', 'keep_client', now())`,
    ).rejects.toThrow(/needs resolved_by/)
  })

  it('the VERIFY file runs and both rules read zero', async () => {
    await sql.unsafe(VERIFY)

    const [human] = await sql<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM sync_conflicts
      WHERE status = 'resolved'
        AND resolution IS DISTINCT FROM 'auto_merge'
        AND resolved_by IS NULL`
    expect(human?.n).toBe(0)

    const [moment] = await sql<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM sync_conflicts
      WHERE status = 'resolved' AND resolved_at IS NULL`
    expect(moment?.n).toBe(0)

    const [autoMerged] = await sql<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM sync_conflicts WHERE resolution = 'auto_merge'`
    expect(autoMerged?.n).toBe(1)
  })

  it('the documented ROLLBACK removes the rule, and the migration puts it back', async () => {
    await sql.unsafe(documentedRollback(MIGRATION))

    const [gone] = await sql<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM pg_trigger WHERE tgname = 'sync_conflicts_forward_only'`
    expect(gone?.n).toBe(0)

    // Without the trigger the backward move is possible — the rollback really
    // did remove the rule, so the forward-only test above is not passing by
    // accident of some other constraint.
    const id = await openConflict('m-after-rollback')
    await sql`
      UPDATE sync_conflicts
      SET status = 'resolved', resolution = 'keep_server', resolved_by = ${OWNER}, resolved_at = now()
      WHERE id = ${id}`
    await sql`UPDATE sync_conflicts SET status = 'open' WHERE id = ${id}`

    // Back-test: the same file, run again, restores the rule.
    await sql.unsafe(MIGRATION)
    const [back] = await sql<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM pg_trigger WHERE tgname = 'sync_conflicts_forward_only'`
    expect(back?.n).toBe(1)

    // Decide it once more, then try to reopen it: the rule is back.
    await sql`
      UPDATE sync_conflicts
      SET status = 'resolved', resolution = 'keep_server', resolved_by = ${OWNER}, resolved_at = now()
      WHERE id = ${id}`
    await expect(sql`UPDATE sync_conflicts SET status = 'open' WHERE id = ${id}`).rejects.toThrow(
      /cannot go back/,
    )
  })
})
