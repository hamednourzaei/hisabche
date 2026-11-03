// ============================================
// The audit-hash-01 scenarios, written once against the tiny SQL runner (scripts/pg/run-scenarios.mjs).
//
// They apply the REAL migration (twice) on an audit_logs table with the real columns and prove the chain:
// normal chain, legacy rows, workspace isolation, and that every kind of tampering is found and named.
// ⚠️ LOGIC proof on PGlite (one connection). Two writers racing for the same workspace head is NOT proven
// here: that needs a real PostgreSQL and stays BLOCKED_EXTERNAL until `audit-hash-01.pg.test.ts` ran on one.
// "Tampering" disables the append-only guard the way a privileged operator would; the guard itself is
// admin-02's and is stood in for here by a trigger that blocks UPDATE and DELETE.
// ============================================

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export type Run = (
  text: string,
  params?: readonly unknown[],
) => Promise<Array<Record<string, unknown>>>
export interface Scenario {
  name: string
  run: (run: Run) => Promise<void>
}

const DOCS = process.env.AUDITHASH_DOCS ?? process.env.RETURN05_DOCS ?? join(process.cwd(), 'docs')
const migration = () => readFileSync(join(DOCS, 'audit-hash-01-migration.sql'), 'utf8')

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

export async function setupAuditHash01(run: Run): Promise<void> {
  for (const role of ['anon', 'authenticated', 'service_role']) {
    await run(
      `DO $r$ BEGIN CREATE ROLE ${role} NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $r$`,
    )
  }
  await run(`CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid,
    user_id text,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id text,
    old_data jsonb,
    new_data jsonb,
    ip_address text,
    user_agent text,
    reason text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`)
  // Stand-in for admin-02's append-only guard.
  await run(`CREATE OR REPLACE FUNCTION public.audit_logs_immutable_guard() RETURNS trigger
    LANGUAGE plpgsql AS $g$ BEGIN RAISE EXCEPTION 'AUDIT_LOG_IMMUTABLE'; END $g$`)
  await run(`DROP TRIGGER IF EXISTS audit_logs_immutable_trigger ON public.audit_logs`)
  await run(`CREATE TRIGGER audit_logs_immutable_trigger BEFORE UPDATE OR DELETE ON public.audit_logs
    FOR EACH ROW EXECUTE FUNCTION public.audit_logs_immutable_guard()`)

  // Two rows that predate the migration.
  await run(`INSERT INTO public.audit_logs (workspace_id, user_id, action, entity_type)
    VALUES ('${WS}', 'u1', 'old.one', 'invoice'), ('${WS}', 'u1', 'old.two', 'invoice')
    ON CONFLICT DO NOTHING`)

  await run(migration())
  await run(migration()) // re-runnable
}

const reset = async (run: Run) => {
  await run(`ALTER TABLE public.audit_logs DISABLE TRIGGER audit_logs_immutable_trigger`)
  await run(`DELETE FROM public.audit_logs WHERE action NOT LIKE 'old.%'`)
  await run(`DELETE FROM public.audit_chain_heads`)
  await run(`ALTER TABLE public.audit_logs ENABLE TRIGGER audit_logs_immutable_trigger`)
}

const write = (run: Run, workspace: string | null, action: string, extra = '') =>
  run(
    `INSERT INTO public.audit_logs (workspace_id, user_id, action, entity_type, entity_id, new_data${extra ? ', reason' : ''})
     VALUES (${workspace ? `'${workspace}'` : 'NULL'}, 'u1', '${action}', 'invoice', 'e1',
             '{"total": 100}'::jsonb${extra ? `, '${extra}'` : ''})`,
  )

const verify = async (run: Run, workspace = WS) => {
  const rows = await run(`SELECT * FROM public.audit_chain_verify('${workspace}')`)
  return rows[0] as {
    ok: boolean
    checked: string | number
    legacy_unchained: string | number
    first_bad_seq: string | number | null
    reason: string | null
  }
}

/** Run one statement with the append-only guard off, the way a privileged operator could. */
const tamper = async (run: Run, statement: string) => {
  await run(`ALTER TABLE public.audit_logs DISABLE TRIGGER audit_logs_immutable_trigger`)
  try {
    await run(statement)
  } finally {
    await run(`ALTER TABLE public.audit_logs ENABLE TRIGGER audit_logs_immutable_trigger`)
  }
}

const fiveRows = async (run: Run) => {
  for (const action of ['a1', 'a2', 'a3', 'a4', 'a5']) await write(run, WS, action)
}

export const scenarios: Scenario[] = [
  {
    name: 'the VERIFY script returns every row ok = true (all result rows checked, not only the first)',
    run: async (run) => {
      await reset(run)
      await fiveRows(run)
      const rows = await run(readFileSync(join(DOCS, 'VERIFY-audit-hash-01.sql'), 'utf8'))
      assert.ok(rows.length >= 8, 'expected every check row, got ' + rows.length)
      assert.deepEqual(
        rows.filter((r) => r.ok !== true),
        [],
      )
    },
  },
  {
    name: 'a normal chain: numbered 1..n, each row points at the one before, verifies',
    run: async (run) => {
      await reset(run)
      await fiveRows(run)
      const rows = await run(
        `SELECT chain_seq::int AS s, prev_hash, hash FROM public.audit_logs
          WHERE workspace_id = '${WS}' AND chain_seq IS NOT NULL ORDER BY chain_seq`,
      )
      assert.deepEqual(
        rows.map((r) => r.s),
        [1, 2, 3, 4, 5],
      )
      assert.equal(rows[0]!.prev_hash, '0'.repeat(64))
      for (let i = 1; i < rows.length; i++) assert.equal(rows[i]!.prev_hash, rows[i - 1]!.hash)
      const v = await verify(run)
      assert.equal(v.ok, true)
      assert.equal(Number(v.checked), 5)
    },
  },
  {
    name: 'legacy rows are counted, never given a hash, and do not break the chain',
    run: async (run) => {
      await reset(run)
      await fiveRows(run)
      const v = await verify(run)
      assert.equal(v.ok, true)
      assert.equal(Number(v.legacy_unchained), 2)
      const legacy = await run(
        `SELECT count(*)::int AS n FROM public.audit_logs WHERE action LIKE 'old.%' AND (hash IS NOT NULL OR chain_seq IS NOT NULL)`,
      )
      assert.equal(legacy[0]!.n, 0)
    },
  },
  {
    name: 'an empty workspace verifies as ok with nothing checked',
    run: async (run) => {
      await reset(run)
      const v = await verify(run, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc')
      assert.equal(v.ok, true)
      assert.equal(Number(v.checked), 0)
    },
  },
  {
    name: 'two workspaces keep separate chains; tampering in one does not fail the other',
    run: async (run) => {
      await reset(run)
      await fiveRows(run)
      await write(run, OTHER, 'b1')
      await write(run, OTHER, 'b2')
      const otherSeq = await run(
        `SELECT chain_seq::int AS s FROM public.audit_logs WHERE workspace_id = '${OTHER}' ORDER BY chain_seq`,
      )
      assert.deepEqual(
        otherSeq.map((r) => r.s),
        [1, 2],
      )
      await tamper(
        run,
        `UPDATE public.audit_logs SET action = 'forged' WHERE workspace_id = '${WS}' AND chain_seq = 3`,
      )
      assert.equal((await verify(run, WS)).ok, false)
      assert.equal((await verify(run, OTHER)).ok, true)
    },
  },
  {
    name: 'a modified payload is found, at the row that was changed',
    run: async (run) => {
      await reset(run)
      await fiveRows(run)
      await tamper(
        run,
        `UPDATE public.audit_logs SET new_data = '{"total": 1}'::jsonb WHERE workspace_id = '${WS}' AND chain_seq = 3`,
      )
      const v = await verify(run)
      assert.equal(v.ok, false)
      assert.equal(v.reason, 'HASH_MISMATCH')
      assert.equal(Number(v.first_bad_seq), 3)
    },
  },
  {
    name: 'a modified actor, action, time or reason is found',
    run: async (run) => {
      for (const set of [
        `user_id = 'someone-else'`,
        `action = 'invoice.deleted'`,
        `created_at = created_at + interval '1 second'`,
        `reason = 'edited'`,
      ]) {
        await reset(run)
        await write(run, WS, 'a1', 'original reason')
        await write(run, WS, 'a2')
        await tamper(
          run,
          `UPDATE public.audit_logs SET ${set} WHERE workspace_id = '${WS}' AND chain_seq = 1`,
        )
        const v = await verify(run)
        assert.equal(v.ok, false, set)
        assert.equal(v.reason, 'HASH_MISMATCH', set)
        assert.equal(Number(v.first_bad_seq), 1, set)
      }
    },
  },
  {
    name: 'a forged hash is found',
    run: async (run) => {
      await reset(run)
      await fiveRows(run)
      await tamper(
        run,
        `UPDATE public.audit_logs SET hash = repeat('f', 64) WHERE workspace_id = '${WS}' AND chain_seq = 2`,
      )
      const v = await verify(run)
      assert.equal(v.ok, false)
      assert.equal(Number(v.first_bad_seq), 2)
    },
  },
  {
    name: 'a broken link (prev_hash replaced) is found as a broken link',
    run: async (run) => {
      await reset(run)
      await fiveRows(run)
      await tamper(
        run,
        `UPDATE public.audit_logs SET prev_hash = repeat('a', 64) WHERE workspace_id = '${WS}' AND chain_seq = 4`,
      )
      const v = await verify(run)
      assert.equal(v.ok, false)
      assert.equal(v.reason, 'BROKEN_LINK')
      assert.equal(Number(v.first_bad_seq), 4)
    },
  },
  {
    name: 'a row removed from the middle is found as missing',
    run: async (run) => {
      await reset(run)
      await fiveRows(run)
      await tamper(
        run,
        `DELETE FROM public.audit_logs WHERE workspace_id = '${WS}' AND chain_seq = 3`,
      )
      const v = await verify(run)
      assert.equal(v.ok, false)
      assert.equal(v.reason, 'MISSING_RECORD')
      assert.equal(Number(v.first_bad_seq), 4)
    },
  },
  {
    name: 'the newest rows removed are found (the head remembers how far the chain went)',
    run: async (run) => {
      await reset(run)
      await fiveRows(run)
      await tamper(
        run,
        `DELETE FROM public.audit_logs WHERE workspace_id = '${WS}' AND chain_seq >= 4`,
      )
      const v = await verify(run)
      assert.equal(v.ok, false)
      assert.equal(v.reason, 'TAIL_REMOVED')
    },
  },
  {
    name: 'retention removing the OLDEST rows leaves a chain that still verifies',
    run: async (run) => {
      await reset(run)
      await fiveRows(run)
      await tamper(
        run,
        `DELETE FROM public.audit_logs WHERE workspace_id = '${WS}' AND chain_seq <= 2`,
      )
      const v = await verify(run)
      assert.equal(v.ok, true)
      assert.equal(Number(v.checked), 3)
    },
  },
  {
    name: 'a row with no workspace is not chained and does not move any head',
    run: async (run) => {
      await reset(run)
      await write(run, null, 'platform.event')
      const row = await run(
        `SELECT chain_seq, hash FROM public.audit_logs WHERE action = 'platform.event'`,
      )
      assert.equal(row[0]!.chain_seq, null)
      assert.equal(row[0]!.hash, null)
      const heads = await run(`SELECT count(*)::int AS n FROM public.audit_chain_heads`)
      assert.equal(heads[0]!.n, 0)
    },
  },
  {
    name: 'an insert that rolls back does not advance the chain (no hole is left)',
    run: async (run) => {
      await reset(run)
      await write(run, WS, 'a1')
      await run(`DO $r$ BEGIN
        BEGIN
          INSERT INTO public.audit_logs (workspace_id, user_id, action, entity_type)
          VALUES ('${WS}', 'u1', 'will.roll.back', 'invoice');
          RAISE EXCEPTION 'abort';
        EXCEPTION WHEN raise_exception THEN NULL;
        END;
      END $r$`)
      await write(run, WS, 'a2')
      const seqs = await run(
        `SELECT chain_seq::int AS s FROM public.audit_logs WHERE workspace_id = '${WS}' AND chain_seq IS NOT NULL ORDER BY chain_seq`,
      )
      assert.deepEqual(
        seqs.map((r) => r.s),
        [1, 2],
      )
      assert.equal((await verify(run)).ok, true)
    },
  },
  {
    name: 'the head can be exported as the trust anchor, and matches the newest row',
    run: async (run) => {
      await reset(run)
      await fiveRows(run)
      const head = await run(`SELECT * FROM public.audit_chain_head('${WS}')`)
      const newest = await run(
        `SELECT chain_seq::int AS s, hash FROM public.audit_logs WHERE workspace_id = '${WS}' ORDER BY chain_seq DESC NULLS LAST LIMIT 1`,
      )
      assert.equal(Number(head[0]!.last_seq), newest[0]!.s)
      assert.equal(head[0]!.last_hash, newest[0]!.hash)
    },
  },
  {
    name: 'anon and authenticated cannot run the verifier or read the heads; service_role can',
    run: async (run) => {
      const priv = await run(`SELECT
        has_function_privilege('anon', 'public.audit_chain_verify(uuid)', 'EXECUTE') AS anon_fn,
        has_function_privilege('authenticated', 'public.audit_chain_verify(uuid)', 'EXECUTE') AS auth_fn,
        has_function_privilege('service_role', 'public.audit_chain_verify(uuid)', 'EXECUTE') AS svc_fn,
        has_table_privilege('anon', 'public.audit_chain_heads', 'SELECT') AS anon_t,
        has_table_privilege('authenticated', 'public.audit_chain_heads', 'SELECT') AS auth_t`)
      assert.deepEqual(priv[0], {
        anon_fn: false,
        auth_fn: false,
        svc_fn: true,
        anon_t: false,
        auth_t: false,
      })
    },
  },
]
