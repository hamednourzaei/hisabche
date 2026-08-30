// ============================================
// Row-level security coverage.
//
// The master prompt asks that RLS be PROVEN rather than assumed. Proof has two
// halves, and this file is the first:
//
//   THIS FILE   every workspace-scoped table has RLS enabled and a policy that
//               restricts it to the caller's workspaces, in a migration that
//               is actually in the repository. It runs in CI, with no
//               database, and fails the moment a new tenant table is added
//               without one.
//
//   scripts/verify-rls.mjs
//               the other half: connects to the REAL database as a REAL user
//               and checks that the policies do what they say. A policy that
//               exists is not a policy that works, and only a live session can
//               tell the difference.
//
// Neither replaces the other. This one cannot see the deployed database; that
// one cannot run without credentials.
// ============================================

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const DOCS = join(__dirname, '..', '..', '..', 'docs')

/**
 * Every table whose rows belong to one workspace.
 *
 * Kept in step with SHARED_TABLES in tenancy-static-guard.test.ts: that test
 * proves the BACKEND never scopes them by user_id, this one proves the
 * DATABASE would refuse a direct client that tried.
 */
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
  'sync_conflicts',
  'sod_settings',
  'sod_actions',
  'sod_overrides',
  'budgets',
  'budget_commitments',
  'budget_breaches',
  'cost_reposts',
  'cost_repost_adjustments',
  'landed_costs',
  'landed_cost_allocations',
  'project_billing_config',
  'time_entries',
  'pos_sessions',
  'pos_orders',
  'pos_order_payments',
  'pos_cash_movements',
  'fixed_assets',
  'asset_depreciation_schedule',
  'bank_statements',
  'bank_statement_lines',
  'fx_revaluations',
  'fx_revaluation_lines',
  'accounting_dimensions',
  'dimension_values',
  'dimension_requirements',
  'stock_batches',
  'stock_serials',
  'lot_allocations',
  'tax_settings',
  'tax_components',
  'tax_rules',
  'invoice_tax_lines',
  'business_rules',
  'rule_decisions',
  'mdm_merges',
  'ui_visibility_profiles',
  'ui_visibility_suggestions',
  'branches',
  'member_branches',
]

function allMigrationSql(): string {
  return (
    readdirSync(DOCS)
      .filter((file) => file.endsWith('.sql'))
      // A leading underscore means generated or diagnostic, not a migration:
      // `_bundle.sql` is every migration concatenated for the SQL Editor, and
      // `_verify-rls.sql` is a read-only test. Reading them here double-counts
      // every policy and — worse — keeps reporting problems from a stale
      // generated copy long after the source file was fixed.
      .filter((file) => !file.startsWith('_'))
      .map((file) => readFileSync(join(DOCS, file), 'utf8'))
      .join('\n')
  )
}

const sql = allMigrationSql()

/** Strip SQL comments so a table named in prose is not counted as covered. */
function stripSqlComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*--.*$/gm, '')
}

const code = stripSqlComments(sql)

describe('row level security is enabled on every tenant table', () => {
  it('finds migrations to scan', () => {
    expect(readdirSync(DOCS).filter((f) => f.endsWith('.sql')).length).toBeGreaterThan(3)
  })

  it.each(TENANT_TABLES)('%s has RLS enabled by a migration', (table) => {
    // Either named directly, or driven by a FOREACH over a table array — the
    // shape tenancy-rls.sql uses for the original four.
    const direct = new RegExp(
      `ALTER\\s+TABLE\\s+${table}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`,
      'i',
    )
    const looped = new RegExp(`ARRAY\\[[^\\]]*'${table}'[^\\]]*\\]`, 'i')

    expect(direct.test(code) || looped.test(code)).toBe(true)
  })

  it.each(TENANT_TABLES)('%s has a workspace-scoped policy', (table) => {
    // A policy naming the table, or the generated per-table policies the
    // FOREACH block creates.
    const named = new RegExp(`CREATE\\s+POLICY[\\s\\S]{0,200}?ON\\s+${table}\\b`, 'i')
    const generated = new RegExp(`ARRAY\\[[^\\]]*'${table}'[^\\]]*\\]`, 'i')

    expect(named.test(code) || generated.test(code)).toBe(true)
  })
})

describe('the policies restrict by workspace membership, not by nothing', () => {
  it('never grants unconditional access', () => {
    // `USING (true)` is a policy that exists, satisfies a checklist, and
    // protects nothing.
    const unconditional = /USING\s*\(\s*true\s*\)/i
    expect(unconditional.test(code)).toBe(false)
  })

  it('every policy body references the membership chain', () => {
    const policies = code.match(/CREATE\s+POLICY[\s\S]*?;/gi) ?? []
    expect(policies.length).toBeGreaterThan(0)

    for (const policy of policies) {
      const scoped =
        /workspace_members/i.test(policy) ||
        /auth_workspace_ids\s*\(/i.test(policy) ||
        // The FOREACH block builds its policy bodies from format() strings.
        /%I/.test(policy)

      expect(scoped, `policy is not workspace-scoped:\n${policy.slice(0, 200)}`).toBe(true)
    }
  })

  it('no policy uses the creator as the tenancy boundary', () => {
    // This caught a real one. `invoice_item_details` was scoped by
    // `i.user_id = auth.uid()`, so a manager could open an invoice its seller
    // had raised and get the header with its line details missing — and it put
    // user_id back as a tenancy boundary in the database, the exact thing the
    // workspace policies removed everywhere else.
    //
    // `workspace_members.user_id = auth.uid()` is the membership lookup, not a
    // boundary, so a policy only offends if it has no workspace scope at all.
    const policies = code.match(/CREATE\s+POLICY[\s\S]*?;/gi) ?? []

    /**
     * `workspace_members` is the one table where `user_id = auth.uid()` is the
     * only correct answer.
     *
     * It IS the membership table. A policy on it that scopes by workspace has
     * to ask which workspaces the user belongs to — by reading
     * `workspace_members` — which re-enters this policy and loops. That is not
     * theoretical: `workspace_members_select` did exactly that in the live
     * database and failed with `42P17: infinite recursion` on the first query
     * ever made as a logged-in user.
     *
     * A member reading their own membership row leaks nothing: the row is
     * about them. Reading OTHER members of a shared workspace is a separate
     * policy that goes through `is_workspace_member()`, a SECURITY DEFINER
     * function, which is how that side avoids the loop.
     */
    const SELF_REFERENTIAL_BY_NECESSITY = new Set(['workspace_members'])

    const offenders = policies
      .filter(
        (policy) =>
          /\buser_id\s*=\s*auth\.uid\(\)/i.test(policy) &&
          !/workspace_id/i.test(policy) &&
          !/auth_workspace_ids\s*\(/i.test(policy),
      )
      .map((policy) => /ON\s+(\w+)/i.exec(policy)?.[1] ?? policy.slice(0, 60))
      .filter((table) => !SELF_REFERENTIAL_BY_NECESSITY.has(table))

    expect(offenders, 'these policies scope by creator instead of by workspace').toEqual([])
  })

  it('no policy on workspace_members or workspaces subqueries the other', () => {
    // The recursion that cost an afternoon.
    //
    //   workspaces_select_policy  → SELECT ... FROM workspace_members
    //   workspace_members_select  → SELECT ... FROM workspace_members
    //
    // Querying either table ran a policy that queried the other, and Postgres
    // aborted with `42P17`. It had been that way from the beginning and was
    // invisible because the backend connects with the service role, which
    // bypasses RLS — nothing had ever read those tables as a logged-in user.
    //
    // The rule that prevents it: policies on these two tables reach membership
    // ONLY through a SECURITY DEFINER function, which executes as its owner
    // and so does not re-enter the policy.
    const policies = code.match(/CREATE\s+POLICY[\s\S]*?;/gi) ?? []

    const offenders = policies
      .filter((policy) => /\bON\s+(workspace_members|workspaces)\b/i.test(policy))
      .filter((policy) => /FROM\s+(workspace_members|workspaces)\b/i.test(policy))
      .map((policy) => /CREATE\s+POLICY\s+(\S+)/i.exec(policy)?.[1] ?? policy.slice(0, 60))

    expect(
      offenders,
      'these policies read a table whose own policy reads them back — 42P17 infinite recursion',
    ).toEqual([])
  })

  it('the membership check excludes revoked and suspended members', () => {
    // A policy that only checks membership hands a removed employee the books
    // they had on their last day.
    expect(/has_access\s*=\s*true/i.test(code)).toBe(true)
    expect(/suspended_at\s+IS\s+NULL/i.test(code)).toBe(true)
  })

  it('grants nothing to the anon role', () => {
    // Every policy in the repository targets `authenticated`.
    const anonGrants = code.match(/CREATE\s+POLICY[\s\S]{0,300}?TO\s+anon\b/gi) ?? []
    expect(anonGrants).toEqual([])
  })
})

describe('the live check exists and is runnable', () => {
  it('ships the script that proves this against the real database', () => {
    const scripts = readdirSync(join(__dirname, '..', '..', '..', 'scripts'))
    expect(scripts).toContain('verify-rls.mjs')
  })
})
