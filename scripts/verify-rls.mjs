#!/usr/bin/env node
// ============================================================================
// scripts/verify-rls.mjs
//
// Prove row-level security against the REAL database, as a REAL user.
//
// WHY THIS EXISTS
//   `backend/src/__tests__/rls-coverage.test.ts` proves the migrations DECLARE
//   a policy for every tenant table. It cannot prove the migration was ever
//   run, that the policy was not dropped afterwards, or that it does what it
//   says. Only a live session can, and a policy that exists is not a policy
//   that works.
//
// WHAT IT CHECKS
//   1. Anonymous access reads nothing from any tenant table.
//   2. A signed-in user reads rows only from workspaces they are a member of.
//   3. That user cannot write a row into a workspace they do not belong to.
//
// IT NEVER WRITES REAL DATA. The write probe is expected to FAIL; if it
// succeeds, the row is deleted with the service key and the check is reported
// as a failure.
//
// USAGE
//   node scripts/verify-rls.mjs
//
// ENVIRONMENT
//   SUPABASE_URL                required
//   SUPABASE_ANON_KEY           required — the key a browser would use
//   RLS_TEST_EMAIL              required — a real, low-privilege test account
//   RLS_TEST_PASSWORD           required
//   SUPABASE_SERVICE_KEY        optional — only used to clean up if a write
//                               that should have been refused went through
// ============================================================================

import { createClient } from '@supabase/supabase-js'

import { loadEnv, requireEnv } from './lib/load-env.mjs'

const TENANT_TABLES = [
  'invoices',
  'customers',
  'products',
  'transactions',
  'accounts',
  'journal_entries',
  'journal_lines',
  'warehouses',
  'warehouse_stock',
  'stock_movements',
  'cost_layers',
  'cost_consumptions',
  'payments',
  'payment_allocations',
  'inventory_settings',
  'accounting_period_locks',
]

loadEnv()

const SUPABASE_URL = process.env.SUPABASE_URL
const ANON_KEY = process.env.SUPABASE_ANON_KEY
const EMAIL = process.env.RLS_TEST_EMAIL
const PASSWORD = process.env.RLS_TEST_PASSWORD

if (!requireEnv(['SUPABASE_URL', 'SUPABASE_ANON_KEY'])) {
  console.error('SUPABASE_URL is the Project URL, and SUPABASE_ANON_KEY is the')
  console.error('publishable anon key — both under Project Settings → API.\n')
  console.error('The ANON key is the right one here, deliberately: this script')
  console.error('proves what an ordinary logged-in user can reach. A service key')
  console.error('bypasses RLS entirely and would make every check pass.\n')
  process.exit(2)
}

const results = []
const record = (name, passed, detail) => {
  results.push({ name, passed, detail })
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

// ─── 1. Anonymous ────────────────────────────────────────────────────────────
// A browser with only the publishable key must see nothing. An empty result
// and a permission error are both acceptable; rows are not.

const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })

console.log('\n── anonymous access ──')
for (const table of TENANT_TABLES) {
  const { data, error } = await anon.from(table).select('*').limit(5)

  if (error) {
    // A missing table is a different problem and is reported as such rather
    // than counted as a pass.
    const missing = /does not exist|schema cache/i.test(error.message)
    record(
      `anon cannot read ${table}`,
      !missing,
      missing ? `table missing: ${error.message}` : 'refused',
    )
    continue
  }

  record(
    `anon cannot read ${table}`,
    (data ?? []).length === 0,
    `${(data ?? []).length} rows visible`,
  )
}

// ─── 2. Signed in ────────────────────────────────────────────────────────────

if (!EMAIL || !PASSWORD) {
  console.log('\n── signed-in checks skipped: set RLS_TEST_EMAIL and RLS_TEST_PASSWORD ──')
} else {
  const user = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })

  const { data: session, error: signInError } = await user.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  })

  if (signInError || !session?.user) {
    record('test account signs in', false, signInError?.message ?? 'no session')
  } else {
    console.log(`\n── signed in as ${session.user.id} ──`)

    const { data: memberships, error: membershipError } = await user
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', session.user.id)
      .eq('has_access', true)
      .is('suspended_at', null)

    if (membershipError) {
      record('reads own memberships', false, membershipError.message)
    } else {
      const allowed = new Set((memberships ?? []).map((m) => m.workspace_id))
      record('reads own memberships', true, `${allowed.size} workspace(s)`)

      for (const table of TENANT_TABLES) {
        const { data, error } = await user.from(table).select('workspace_id').limit(500)

        if (error) {
          const missing = /does not exist|schema cache|column/i.test(error.message)
          record(
            `${table} shows only own workspaces`,
            !missing,
            missing ? `skipped: ${error.message}` : 'refused entirely',
          )
          continue
        }

        const foreign = (data ?? []).filter(
          (row) => row.workspace_id && !allowed.has(row.workspace_id),
        )

        record(
          `${table} shows only own workspaces`,
          foreign.length === 0,
          foreign.length > 0
            ? `${foreign.length} row(s) from ${[...new Set(foreign.map((r) => r.workspace_id))].join(', ')}`
            : `${(data ?? []).length} row(s), all own`,
        )
      }

      // ─── 3. Cross-workspace write ────────────────────────────────────────
      // A workspace id the user is not a member of. Inserting into it must be
      // refused by WITH CHECK, not merely be invisible afterwards.
      const foreignWorkspace = '00000000-0000-4000-8000-000000000001'

      const { data: inserted, error: insertError } = await user
        .from('customers')
        .insert({
          full_name: 'RLS probe — delete me',
          workspace_id: foreignWorkspace,
          user_id: session.user.id,
        })
        .select('id')

      if (insertError) {
        record('cannot write into a foreign workspace', true, 'refused')
      } else {
        record(
          'cannot write into a foreign workspace',
          false,
          `INSERT SUCCEEDED — row ${inserted?.[0]?.id}`,
        )

        if (process.env.SUPABASE_SERVICE_KEY && inserted?.[0]?.id) {
          const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
            auth: { persistSession: false },
          })
          await admin.from('customers').delete().eq('id', inserted[0].id)
          console.log('      (probe row cleaned up)')
        } else {
          console.log('      ⚠ probe row left behind; set SUPABASE_SERVICE_KEY to clean it up')
        }
      }
    }

    await user.auth.signOut()
  }
}

// ─── Verdict ─────────────────────────────────────────────────────────────────

const failed = results.filter((r) => !r.passed)

console.log(`\n${results.length - failed.length}/${results.length} checks passed`)

if (failed.length > 0) {
  console.error('\nFAILED:')
  for (const failure of failed) console.error(`  ${failure.name} — ${failure.detail}`)
  process.exit(1)
}

console.log('Row-level security verified against the live database.')
