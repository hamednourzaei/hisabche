// ============================================
// backend/src/__tests__/audit-hash-01.pg.test.ts
//
// Real PostgreSQL: docs/audit-hash-01-migration.sql (run twice) - the audit chain. The scenarios live in
// helpers/audit-hash-01-scenarios.ts so they also run on PGlite (scripts/pg/run-scenarios.mjs) and on any other real Postgres.
//
// ⚠️ WHEN THE EMBEDDED BINARY CANNOT START the scenarios are reported SKIPPED, never passed.
// ============================================

import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'
import { scenarios, setupAuditHash01, type Run } from './helpers/audit-hash-01-scenarios'

const PORT = freePortSync()
const dir = pgTempDir('hisabche-pg-audithash01-')
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})

let sql: postgres.Sql | undefined
let started = false

const run: Run = async (text, params) => {
  if (!sql) throw new Error('database not started')
  const rows = await sql.unsafe(text, (params ? [...params] : []) as never[])
  return rows as unknown as Array<Record<string, unknown>>
}

describe('Postgres: a tamper-evident audit chain (audit-hash-01)', () => {
  beforeAll(async () => {
    try {
      await pg.start()
    } catch {
      return // non-elevated Windows (error 1314) or a quarantined binary: skipped below, run in CI
    }
    started = true
    const admin = postgres(`postgres://postgres:test@localhost:${PORT}/postgres`)
    await admin`CREATE DATABASE audithash01_test;`
    await admin.end()
    sql = postgres(`postgres://postgres:test@localhost:${PORT}/audithash01_test`, { max: 4 })
    await setupAuditHash01(run)
  }, 120_000)

  afterAll(async () => {
    if (sql) await sql.end()
    try {
      await pg.stop()
    } catch {
      // ignore
    }
  })

  for (const scenario of scenarios) {
    it(scenario.name, async (context) => {
      if (!started) context.skip()
      await scenario.run(run)
    })
  }

  // What PGlite (one connection) cannot prove: concurrent writers of one workspace do not fork the chain.
  it('concurrent writers on separate connections produce one contiguous, verifying chain', async (context) => {
    if (!started) context.skip()
    const ws = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
    await Promise.all(
      Array.from({ length: 24 }, (_, i) =>
        run(
          `INSERT INTO public.audit_logs (workspace_id, user_id, action, entity_type) VALUES ('${ws}', 'u1', 'race.${i}', 'invoice')`,
        ),
      ),
    )
    const seqs = await run(
      `SELECT chain_seq::int AS s FROM public.audit_logs WHERE workspace_id = '${ws}' ORDER BY chain_seq`,
    )
    expect(seqs.map((r) => r.s)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1))
    const verdict = await run(`SELECT ok FROM public.audit_chain_verify('${ws}')`)
    expect(verdict[0]?.ok).toBe(true)
  })
})
