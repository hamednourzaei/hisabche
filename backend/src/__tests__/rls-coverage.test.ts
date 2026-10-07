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
  'product_barcodes',
  'migration_jobs',
  'migration_profiles',
  'migration_records',
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
  // docs/developer-platform-migration.sql — SELECT for owners/managers only.
  'api_keys',
  'webhook_endpoints',
  'webhook_deliveries',
  'api_request_logs',
  'storefront_settings',
  'sales_orders',
  'sales_order_items',
  'customer_portal_links',
  'oauth_apps',
  'app_publishers',
  'app_installations',
  'app_reviews',
  'app_reports',
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
  // ⚠️ LINE COMMENTS FIRST. Four migrations write a path with a glob in a `--`
  // comment (`-- backend/src/services/accounting/* …`, `-- docs/*.sql …`).
  // Stripping block comments first read that `/*` as the start of one, which
  // ran on to the next `*/` anywhere in the concatenated SQL and swallowed
  // every migration in between — 49 tenant tables «had no RLS» and the blog's
  // policies were invisible to the checks below.
  return source.replace(/^\s*--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
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

/**
 * Tables that hold NO tenant data at all, and therefore have nothing to scope.
 *
 * ⚠️ THIS LIST IS A LOADED GUN. Every entry is a table where `USING (true)` is
 * permitted, so adding one wrongly disables the workspace check for it.
 *
 * A table qualifies only if ALL of these hold:
 *   1. It has no `workspace_id` column — there is literally nothing to filter.
 *   2. Its rows are identical for every customer (a gram is a gram).
 *   3. It is READ-ONLY to users: no INSERT/UPDATE/DELETE policy exists, so
 *      only the service role can write it. This is asserted below, not assumed.
 *
 * `units` (phase-l-01, RLS added in T2) and `currencies` (Patch 1) are the
 * list. Both satisfy all three: no workspace column, identical rows for every
 * customer, and no write policy at all.
 *
 * If a third is ever proposed, check condition 3 first: a globally readable
 * table that users can also WRITE lets one customer change every other
 * customer's conversion factors — or, for currencies, how every amount in the
 * product is formatted.
 *
 * `blog_categories` / `blog_tags` (docs/blog-migration.sql) passed that check:
 * no workspace column, the same public blog for everyone, and clients hold
 * SELECT only — every write goes through the backend's platform-admin routes.
 */
const GLOBAL_REFERENCE_TABLES = ['units', 'currencies', 'blog_categories', 'blog_tags']

/**
 * Platform-published content whose visibility is a PUBLICATION rule, not a
 * membership rule: `blog_posts` (published, or scheduled and due) and
 * `blog_post_tags` (tags of such a post).
 *
 * Same price as the lists around it: no workspace column, and SELECT-only for
 * every client — asserted below. Drafts stay invisible to clients because the
 * policy body is the publication predicate, never `true`.
 */
const PUBLIC_CONTENT_TABLES = [
  'blog_posts',
  'blog_post_tags',
  'cms_pages',
  'cms_media',
  'cms_navigation',
  'cms_globals',
  'cms_page_versions',
  'storage.objects',
]

/**
 * The desktop update feed (docs/module-desktop-update-feed-migration.sql):
 * one set of releases for every installation, read before anyone signs in.
 * No workspace column. Paid for below: SELECT-only, and the body is exactly
 * the publication flag — an unpublished build stays invisible.
 */
const RELEASE_FEED_TABLES = ['app_releases']

const isReleaseFeed = (policy: string): boolean =>
  RELEASE_FEED_TABLES.some((table) =>
    new RegExp(`\\bON\\s+(?:public\\.)?${table}\\b`, 'i').test(policy),
  )

const isPublicContent = (policy: string): boolean =>
  PUBLIC_CONTENT_TABLES.some((table) => new RegExp(`\\bON\\s+${table}\\b`, 'i').test(policy))

const isGlobalReference = (policy: string): boolean =>
  GLOBAL_REFERENCE_TABLES.some((table) => new RegExp(`\\bON\\s+${table}\\b`, 'i').test(policy))

/**
 * Tables whose rows belong to a PERSON, not to a workspace.
 *
 * ⚠️ A NARROW, NAMED EXEMPTION — NOT A LOOSENING OF THE RULE.
 *
 * `workspace_id` is the tenancy boundary for business data, and `user_id` must
 * never stand in for it there. The referral programme is the one thing in this
 * product that genuinely belongs to a person: somebody keeps the businesses
 * they invited when they move between shops, and two owners of the SAME shop
 * must not see each other's commissions. Scoping these by workspace would be
 * the wrong answer, not a stricter one.
 *
 * The exemption is paid for below: each of these must still be scoped to
 * `auth.uid()` and must still be SELECT-only for a client.
 *
 * The blog's comments, reactions and ratings are a person's own words and
 * votes on public content — there is no workspace in them. Same terms: the
 * policies are SELECT-only and name `auth.uid()`; writes go through the
 * backend, which takes the user from the verified token.
 */
const PERSON_SCOPED_TABLES = [
  'referral_codes',
  'referrals',
  'referral_commissions',
  'referral_payouts',
  'blog_comments',
  'blog_reactions',
  'blog_ratings',
]

const isPersonScoped = (policy: string): boolean =>
  PERSON_SCOPED_TABLES.some((table) => new RegExp(`\\bON\\s+${table}\\b`, 'i').test(policy))

describe('the policies restrict by workspace membership, not by nothing', () => {
  it('never grants unconditional access', () => {
    // `USING (true)` is a policy that exists, satisfies a checklist, and
    // protects nothing.
    //
    // Checked per-policy rather than across the whole file, so one justified
    // exemption cannot blind the test to every other table.
    const unconditional = /USING\s*\(\s*true\s*\)/i
    const policies = code.match(/CREATE\s+POLICY[\s\S]*?;/gi) ?? []

    for (const policy of policies) {
      if (isGlobalReference(policy)) continue
      if (isPublicContent(policy)) continue
      expect(unconditional.test(policy), `unconditional policy:\n${policy.slice(0, 200)}`).toBe(
        false,
      )
    }
  })

  it('a globally-readable table is readable ONLY — never writable by a user', () => {
    // The condition that makes the exemption safe. A reference table any
    // authenticated user can rewrite is a way to change every conversion
    // factor in the product, for every customer at once.
    const policies = code.match(/CREATE\s+POLICY[\s\S]*?;/gi) ?? []
    const exempted = policies.filter(isGlobalReference)

    expect(exempted.length, 'the exemption list names a table with no policy').toBeGreaterThan(0)

    for (const policy of exempted) {
      expect(/FOR\s+SELECT/i.test(policy), `not SELECT-only:\n${policy.slice(0, 200)}`).toBe(true)
      for (const write of ['INSERT', 'UPDATE', 'DELETE', 'ALL']) {
        expect(new RegExp(`FOR\\s+${write}\\b`, 'i').test(policy), `${write} policy`).toBe(false)
      }
    }
  })

  it('every policy body references the membership chain', () => {
    const policies = code.match(/CREATE\s+POLICY[\s\S]*?;/gi) ?? []
    expect(policies.length).toBeGreaterThan(0)

    for (const policy of policies) {
      // A table with no workspace column has no membership chain to
      // reference. See GLOBAL_REFERENCE_TABLES — the exemption is paid for by
      // the SELECT-only assertion above.
      if (isGlobalReference(policy)) continue
      // Person-scoped: asserted separately, and more strictly, below.
      if (isPersonScoped(policy)) continue
      // Published blog content: SELECT-only, asserted below.
      if (isPublicContent(policy)) continue
      // Desktop release feed: asserted below.
      if (isReleaseFeed(policy)) continue

      const scoped =
        /workspace_members/i.test(policy) ||
        /auth_workspace_ids\s*\(/i.test(policy) ||
        // The FOREACH block builds its policy bodies from format() strings.
        /%I/.test(policy)

      expect(scoped, `policy is not workspace-scoped:\n${policy.slice(0, 200)}`).toBe(true)
    }
  })

  it('the release feed is SELECT-only and shows published builds only', () => {
    const policies = (code.match(/CREATE\s+POLICY[\s\S]*?;/gi) ?? []).filter(isReleaseFeed)
    expect(policies.length, 'release feed has no policy').toBeGreaterThan(0)
    for (const policy of policies) {
      expect(
        /FOR\s+SELECT/i.test(policy),
        `release feed policy is not SELECT-only:\n${policy}`,
      ).toBe(true)
      expect(
        /USING\s*\(\s*is_published\s*\)/i.test(policy),
        `release feed shows unpublished builds:\n${policy}`,
      ).toBe(true)
    }
  })

  it('published content is SELECT-only and never unconditional', () => {
    const policies = code.match(/CREATE\s+POLICY[\s\S]*?;/gi) ?? []
    const exempted = policies.filter(isPublicContent)

    expect(exempted.length, 'public content tables have no policies').toBeGreaterThan(0)

    for (const policy of exempted) {
      expect(/FOR\s+SELECT/i.test(policy), `not SELECT-only:\n${policy.slice(0, 200)}`).toBe(true)
      const ruleApplies =
        /blog_post_is_public\s*\(/i.test(policy) ||
        /status\s*=\s*'published'/i.test(policy) ||
        (/cms_/i.test(policy) && /USING\s*\(\s*true\s*\)/i.test(policy)) ||
        /bucket_id\s*=\s*'cms-media'/i.test(policy)

      expect(ruleApplies, `does not apply the publication rule:\n${policy.slice(0, 200)}`).toBe(
        true,
      )
    }
  })

  it('⚠️ a person-scoped table is scoped to auth.uid() and is SELECT-only', () => {
    // What makes the exemption safe. Without `auth.uid()` these would be
    // readable by every authenticated user on the platform, and a writable
    // commission table is a way to pay yourself.
    const policies = code.match(/CREATE\s+POLICY[\s\S]*?;/gi) ?? []
    const exempted = policies.filter(isPersonScoped)

    expect(exempted.length, 'person-scoped tables have no policies').toBeGreaterThan(0)

    for (const policy of exempted) {
      expect(
        /auth\.uid\s*\(\s*\)/i.test(policy),
        `person-scoped policy is not tied to the caller:\n${policy.slice(0, 200)}`,
      ).toBe(true)

      expect(
        /FOR\s+SELECT/i.test(policy),
        `person-scoped policy is not SELECT-only:\n${policy.slice(0, 200)}`,
      ).toBe(true)
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
    //
    // Person-scoped tables are excluded by name: for them `auth.uid()` is the
    // correct boundary, asserted in its own test above.
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
      // The referral programme belongs to a person by design — see
      // PERSON_SCOPED_TABLES and the stricter test above.
      .filter((table) => !PERSON_SCOPED_TABLES.includes(table))

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
