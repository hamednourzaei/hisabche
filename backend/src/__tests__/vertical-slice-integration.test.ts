// ============================================
// The vertical slice: API → service → domain → database.
//
// ---------------------------------------------------------------------------
// WHAT THIS FILE CAN AND CANNOT PROVE
//
// There is no database in CI, so these are not tests that write a row and read
// it back. What they DO prove is the layer that domain tests cannot reach and
// that a passing domain suite hides completely:
//
//   * every route is registered and reachable
//   * every route declares authentication, workspace resolution and a
//     capability — in that order
//   * every service takes a verified TenancyContext rather than a bare id
//   * every service scopes its queries by workspace_id
//   * commands that must be idempotent are written so they can be
//   * the tables each service touches are covered by RLS and by the guards
//
// A module whose domain tests pass and which fails any of these is NOT
// product-complete, and the point of this file is to say so out loud.
//
// The parts that genuinely need a live database — a real row surviving a real
// retry, RLS refusing a real cross-tenant read — are in
// `scripts/verify-rls.mjs` and `scripts/verify-slice.mjs`, which run against a
// deployed instance. Neither replaces the other.
// ============================================

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = join(__dirname, '..')
const ROUTES = join(SRC, 'routes')
const SERVICES = join(SRC, 'services')
const DOCS = join(SRC, '..', '..', 'docs')

/**
 * Every Tier 1 and Tier 2 capability, and where each of its layers lives.
 *
 * Adding a module here is what makes the checks below apply to it. A module
 * absent from this list is a module nobody is checking.
 */
const MODULES = [
  {
    name: 'accounting',
    route: 'accounting.routes.ts',
    service: 'accounting',
    tables: ['accounts', 'journal_entries'],
  },
  {
    name: 'inventory-costing',
    route: 'inventory-costing.routes.ts',
    service: 'inventory-costing',
    tables: ['cost_layers', 'cost_consumptions'],
  },
  {
    name: 'payments',
    route: 'payments.routes.ts',
    service: 'payments',
    tables: ['payments', 'payment_allocations'],
  },
  {
    name: 'authorization',
    route: 'governance.routes.ts',
    service: 'authorization',
    tables: ['sod_settings', 'sod_actions'],
  },
  {
    name: 'conflict',
    route: 'conflict.routes.ts',
    service: 'conflict',
    tables: ['sync_conflicts'],
  },
  {
    name: 'branch',
    route: 'branch.routes.ts',
    service: 'branch',
    tables: ['branches', 'member_branches'],
  },
  { name: 'supplier', route: 'supplier.routes.ts', service: 'supplier', tables: ['suppliers'] },
  { name: 'rules', route: 'rules.routes.ts', service: 'rules', tables: ['business_rules'] },
  { name: 'mdm', route: 'intelligence.routes.ts', service: 'mdm', tables: ['mdm_merges'] },
  {
    name: 'tax',
    route: 'tax.routes.ts',
    service: 'tax',
    tables: ['tax_components', 'tax_rules', 'invoice_tax_lines'],
  },
  { name: 'pos', route: 'pos.routes.ts', service: 'pos', tables: ['pos_sessions', 'pos_orders'] },
  {
    name: 'assets',
    route: 'finance-ops.routes.ts',
    service: 'assets',
    tables: ['fixed_assets', 'asset_depreciation_schedule'],
  },
  {
    name: 'banking',
    route: 'finance-ops.routes.ts',
    service: 'banking',
    tables: ['bank_statements', 'bank_statement_lines'],
  },
  {
    name: 'currency',
    route: 'finance-ops.routes.ts',
    service: 'currency',
    tables: ['fx_revaluations'],
  },
  {
    name: 'dimensions',
    route: 'finance-ops.routes.ts',
    service: 'dimensions',
    tables: ['accounting_dimensions', 'dimension_values'],
  },
  {
    name: 'budgeting',
    route: 'operations.routes.ts',
    service: 'budgeting',
    tables: ['budgets', 'budget_commitments'],
  },
  {
    name: 'traceability',
    route: 'operations.routes.ts',
    service: 'traceability',
    tables: ['stock_batches', 'stock_serials'],
  },
  {
    name: 'timesheets',
    route: 'operations.routes.ts',
    service: 'timesheets',
    tables: ['time_entries'],
  },
] as const

const routeSource = (file: string) => readFileSync(join(ROUTES, file), 'utf8')

const serviceSources = (dir: string) => serviceSourceEntries(dir).map(([, source]) => source)

/** Each service file with its NAME, so a guard can exempt one by name. */
const serviceSourceEntries = (dir: string): [string, string][] => {
  const path = join(SERVICES, dir)
  return readdirSync(path)
    .filter((file) => file.endsWith('.service.ts'))
    .map((file) => [file, readFileSync(join(path, file), 'utf8')] as [string, string])
}

const allSql = readdirSync(DOCS)
  .filter((file) => file.endsWith('.sql'))
  .map((file) => readFileSync(join(DOCS, file), 'utf8'))
  .join('\n')

const indexSource = readFileSync(join(SRC, 'index.ts'), 'utf8')

// ══════════════════════════════════════════════ REACHABILITY

describe('every module is reachable over HTTP', () => {
  it.each(MODULES.map((m) => [m.name, m.route] as const))(
    '%s has a route file that is registered',
    (_name, route) => {
      // A service nobody can call is not a feature. This is the check a
      // passing domain suite most obviously fails to make.
      expect(readdirSync(ROUTES)).toContain(route)

      const importName = route.replace('.routes.ts', '')
      expect(indexSource).toContain(`./routes/${importName}.routes`)
      expect(indexSource).toMatch(new RegExp(`server\\.register\\(\\s*\\w+Routes`))
    },
  )

  it('registers every route file that exists', () => {
    // A route file that was written and never registered is invisible, and
    // nothing else in the codebase would notice.
    const unregistered = readdirSync(ROUTES)
      .filter((file) => file.endsWith('.routes.ts'))
      .map((file) => file.replace('.routes.ts', ''))
      .filter((name) => !indexSource.includes(`./routes/${name}.routes`))

    expect(unregistered, 'these route files are never registered').toEqual([])
  })
})

// ══════════════════════════════════════════════ AUTHORIZATION

describe('every route declares its guards, in order', () => {
  const NEW_ROUTES = [
    'tax.routes.ts',
    'pos.routes.ts',
    'finance-ops.routes.ts',
    'operations.routes.ts',
    'payments.routes.ts',
    'inventory-costing.routes.ts',
    'rules.routes.ts',
    'intelligence.routes.ts',
    'governance.routes.ts',
    'branch.routes.ts',
    'supplier.routes.ts',
    'conflict.routes.ts',
  ]

  it.each(NEW_ROUTES)('%s guards every endpoint with a capability', (file) => {
    const source = routeSource(file)

    // Guards may be written inline OR hoisted into a shared const — the
    // larger route files do the latter, which is better code, so counting
    // literal `requireCapability(` occurrences would punish the cleaner
    // pattern. What matters is that every registration's preHandler resolves
    // to something guarded.
    const guardConsts = new Set(
      [...source.matchAll(/const (\w+) = \[[^\]]*requireCapability\([^\]]*\]/g)].map(
        (match) => match[1] as string,
      ),
    )

    const registrations = [
      ...source.matchAll(
        /fastify\.(?:get|post|put|patch|delete)\(\s*'([^']+)'[\s\S]{0,600}?preHandler:\s*(\[[^\]]*\]|\w+)/g,
      ),
    ]

    const total = (source.match(/fastify\.(get|post|put|patch|delete)\(/g) ?? []).length
    expect(registrations.length, `${file}: could not read every preHandler`).toBe(total)

    const unguarded = registrations
      .filter(([, , preHandler]) => {
        const handler = preHandler as string
        if (handler.includes('requireCapability')) return false
        return !guardConsts.has(handler.trim())
      })
      .map(([, path]) => path)

    expect(unguarded, `${file} has unguarded endpoints`).toEqual([])
  })

  it.each(NEW_ROUTES)('%s resolves the workspace before checking a capability', (file) => {
    const source = routeSource(file)

    // The order is load-bearing: `requireCapability` reads the role off the
    // TenancyContext, so running it first would authorize against a role
    // nobody established. Shared guard consts are checked the same way — they
    // are just arrays declared a few lines higher.
    const blocks = [
      ...(source.match(/preHandler:\s*\[[^\]]*\]/g) ?? []),
      ...(source.match(/const \w+ = \[[^\]]*requireCapability\([^\]]*\]/g) ?? []),
    ]

    for (const block of blocks) {
      if (!block.includes('requireCapability')) continue

      expect(block, `${file}: capability checked before the workspace`).toMatch(
        /requireWorkspaceContext[\s\S]*requireCapability/,
      )
    }
  })

  it.each(NEW_ROUTES)('%s authenticates before anything else', (file) => {
    const source = routeSource(file)

    const blocks = [
      ...(source.match(/preHandler:\s*\[[^\]]*\]/g) ?? []),
      ...(source.match(/const \w+ = \[[^\]]*requireWorkspaceContext[^\]]*\]/g) ?? []),
    ]

    for (const block of blocks) {
      if (!block.includes('requireWorkspaceContext')) continue
      expect(block).toMatch(/authenticate[\s\S]*requireWorkspaceContext/)
    }
  })
})

// ══════════════════════════════════════════════ TENANCY

describe('every service takes a verified context, never a bare id', () => {
  it.each(MODULES.map((m) => [m.name, m.service] as const))(
    '%s services accept a TenancyContext',
    (_name, dir) => {
      for (const source of serviceSources(dir)) {
        // The defect this guards against is a PUBLIC method whose tenancy
        // comes from a bare `userId` — the fail-open shape that let a route
        // skipping the middleware read another shop's rows.
        //
        // `workspaceId: string` is deliberately NOT flagged: it can only have
        // come from an already-verified TenancyContext, and several services
        // legitimately pass it down to helpers and cache keys. Flagging it
        // would push the codebase towards passing whole contexts into
        // functions that need one field, which is worse code and no safer.
        const offenders = source.match(/async \w+\(\s*userId: string/g) ?? []
        expect(offenders, `${dir} takes a bare user id as its tenancy`).toEqual([])
      }
    },
  )

  /**
   * Services that read GLOBAL REFERENCE DATA and legitimately never filter by
   * workspace.
   *
   * ⚠️ AN EXPLICIT LIST, BECAUSE THE ALTERNATIVE WAS AN ACCIDENT.
   *
   * `units.service.ts` passed this guard only because the string
   * `workspace_id` appears in one of its COMMENTS — the comment explaining
   * that the table has no workspace column. Reword that comment and a real
   * exemption silently becomes a real failure; write the same comment in a
   * service that SHOULD filter, and a real failure silently passes.
   *
   * A service qualifies only if its table has no `workspace_id` column at all
   * and its rows are identical for every customer. It must also be on
   * GLOBAL_REFERENCE_TABLES in rls-coverage.test.ts, which additionally proves
   * the table is read-only to users.
   *
   * ⚠️ `units.service.ts` IS ALSO GLOBAL REFERENCE DATA BUT IS NOT LISTED —
   * because it lives in `services/inventory/`, and MODULES below covers
   * `inventory-costing` but not `inventory`. This guard has never scanned it.
   * That is a real gap in this suite's coverage, not something Patch 1
   * introduced; recorded here so the next person widening MODULES knows to
   * add `units.service.ts` to this list at the same time, rather than
   * discovering a confusing failure.
   */
  const REFERENCE_DATA_SERVICES = ['currencies.service.ts']

  it.each(MODULES.map((m) => [m.name, m.service] as const))(
    '%s scopes every query by workspace',
    (_name, dir) => {
      for (const [file, source] of serviceSourceEntries(dir)) {
        if (REFERENCE_DATA_SERVICES.includes(file)) continue

        const reads = source.match(/\.from\('[a-z_]+'\)/g) ?? []
        if (reads.length === 0) continue

        // Not a per-query proof — that is what the static tenancy guard does —
        // but a service with table reads and NO workspace filter anywhere is
        // unambiguously wrong.
        expect(source, `${dir} never filters on workspace_id`).toMatch(
          /workspace_id|p_workspace_id/,
        )
      }
    },
  )

  it('every exempted service really is global reference data', () => {
    // The exemption is only safe while these tables have no workspace column.
    // If one ever gains tenant data, this fails and the exemption has to be
    // reconsidered rather than quietly protecting a leak.
    for (const file of REFERENCE_DATA_SERVICES) {
      const found = MODULES.flatMap((m) => serviceSourceEntries(m.service)).find(
        ([name]) => name === file,
      )
      expect(found, `${file} is exempted but does not exist`).toBeDefined()
      // It must not be reading anything workspace-scoped.
      expect(found![1]).not.toMatch(/\.eq\('workspace_id'/)
    }
  })
})

// ══════════════════════════════════════════════ RLS

describe('every table a module writes is protected', () => {
  const code = allSql.replace(/^\s*--.*$/gm, '')

  it.each(MODULES.flatMap((m) => m.tables.map((t) => [m.name, t] as const)))(
    '%s: %s has RLS and a policy',
    (_module, table) => {
      const enabled = new RegExp(`ALTER TABLE %?I?\\s*${table}\\s+ENABLE ROW LEVEL SECURITY`, 'i')
      const looped = new RegExp(`ARRAY\\[[^\\]]*'${table}'[^\\]]*\\]`, 'is')

      expect(enabled.test(code) || looped.test(code), `${table} has no RLS`).toBe(true)
    },
  )
})

// ══════════════════════════════════════════════ IDEMPOTENCY

describe('commands that must survive a retry are written so they can', () => {
  it('a till order is keyed on a device-generated reference', () => {
    // The property a till depends on: a retry after a lost response must
    // return the sale that already exists rather than taking it twice.
    const source = readFileSync(join(SERVICES, 'pos', 'pos.service.ts'), 'utf8')
    expect(source).toContain('order_ref')
    expect(source).toMatch(/error\.code === '23505'/)
  })

  it('a till close only ever closes an OPEN session', () => {
    // Two devices closing at once: the second finds nothing to update rather
    // than posting the day's takings a second time.
    const source = readFileSync(join(SERVICES, 'pos', 'pos.service.ts'), 'utf8')
    expect(source).toMatch(/\.in\('status', \['open', 'closing'\]\)/)
  })

  it('depreciation is keyed on the schedule row, not on today', () => {
    const source = readFileSync(join(SERVICES, 'assets', 'assets.service.ts'), 'utf8')
    expect(source).toContain("sourceType: 'depreciation'")
    expect(source).toMatch(/is\('posted_at', null\)/)
  })

  it('a bank line only matches while it is unmatched', () => {
    const source = readFileSync(join(SERVICES, 'banking', 'banking.service.ts'), 'utf8')
    expect(source).toMatch(/\.is\('matched_to', null\)/)
  })

  it('a statement re-import cannot duplicate its lines', () => {
    const source = readFileSync(join(SERVICES, 'banking', 'banking.service.ts'), 'utf8')
    expect(source).toContain('statementLineKey')
    expect(source).toMatch(/ignoreDuplicates: true/)
  })

  it('an invoiced hour cannot be billed twice', () => {
    // The `invoice_id` IS the lock, and the write is guarded on it being null.
    const source = readFileSync(join(SERVICES, 'timesheets', 'timesheets.service.ts'), 'utf8')
    expect(source).toMatch(/\.is\('invoice_id', null\)/)
  })

  it('a serial number can only be sold while it is in stock', () => {
    const source = readFileSync(join(SERVICES, 'traceability', 'traceability.service.ts'), 'utf8')
    expect(source).toMatch(/\.eq\('status', 'in_stock'\)/)
  })

  it('a revaluation is one row per period', () => {
    const source = readFileSync(join(SERVICES, 'currency', 'currency.service.ts'), 'utf8')
    expect(source).toMatch(/onConflict: 'workspace_id,as_of'/)
  })

  it('a budget commitment is keyed on its source document', () => {
    const source = readFileSync(join(SERVICES, 'budgeting', 'budget.service.ts'), 'utf8')
    expect(source).toMatch(/onConflict: 'workspace_id,budget_id,source_type,source_id'/)
  })
})

// ══════════════════════════════════════════════ REVERSAL

describe('every financial effect can be undone', () => {
  it('a payment reverses its ledger entry when cancelled', () => {
    const source = readFileSync(join(SERVICES, 'payments', 'payments.service.ts'), 'utf8')
    expect(source).toContain('reverseDocument')
  })

  it('a disposed asset stops depreciating', () => {
    const source = readFileSync(join(SERVICES, 'assets', 'assets.service.ts'), 'utf8')
    expect(source).toContain('cancelled_at')
  })

  it('a bank match can be undone', () => {
    const source = readFileSync(join(SERVICES, 'banking', 'banking.service.ts'), 'utf8')
    expect(source).toContain('async unmatch')
  })

  it('a revaluation reverses the previous one rather than stacking', () => {
    const source = readFileSync(join(SERVICES, 'currency', 'currency.service.ts'), 'utf8')
    expect(source).toContain('reversed_minor')
  })

  it('a voided till order is marked, never deleted', () => {
    // A sale rung up and cancelled is two facts. A till whose voids leave no
    // trace is a till nobody can audit.
    const source = readFileSync(join(SERVICES, 'pos', 'pos.service.ts'), 'utf8')
    expect(source).toMatch(/status: 'voided'/)
    expect(source).not.toMatch(/from\('pos_orders'\)\s*\.delete\(\)/)
  })
})

// ══════════════════════════════════════════════ THE LIVE HALF

describe('the checks that need a real database are shipped', () => {
  it('ships the RLS prover', () => {
    const scripts = readdirSync(join(SRC, '..', '..', 'scripts'))
    expect(scripts).toContain('verify-rls.mjs')
  })

  it('ships the migration runner', () => {
    // Migrations are NOT executed from here. Running DDL against a live
    // financial database is a decision with a person's name on it.
    const scripts = readdirSync(join(SRC, '..', '..', 'scripts'))
    expect(scripts).toContain('run-migrations.mjs')
  })
})
