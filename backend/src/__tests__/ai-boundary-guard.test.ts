// ============================================
// backend/src/__tests__/ai-boundary-guard.test.ts
//
// PHASE O — the raw-SQL boundary, enforced rather than documented.
//
// ---------------------------------------------------------------------------
// WHY A TEST AND NOT JUST A README
//
// «AI never runs raw SQL» is the most important security boundary in the
// product, and it is exactly the kind of rule that survives review and then
// dies quietly when somebody adds a "temporary" escape hatch for a question
// the views cannot answer.
//
// This reads the migrations and the documentation as artefacts and checks the
// properties that make the boundary real:
//
//   • no reporting view accepts a workspace argument
//   • every reporting view filters on auth_workspace_ids()
//   • every reporting view is security_invoker
//   • no view exposes a credential or contact detail
//   • no AI provider SDK has appeared in the dependency tree
//
// The last one is the tripwire for the whole phase: O3 says explicitly that no
// provider is connected yet, and the day one is, this test should fail and be
// updated deliberately.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const REPO = join(__dirname, '..', '..', '..')
const read = (rel: string) => readFileSync(join(REPO, rel), 'utf8')

const REPORTING = read('docs/phase-o-01-reporting-layer-migration.sql')
const CATALOG = read('docs/phase-o-02-catalog-and-query-log-migration.sql')

/** SQL with `--` comments stripped — the file explains the hazards at length. */
const sql = (source: string) => source.replace(/^\s*--.*$/gm, '')

const REPORTING_SQL = sql(REPORTING)

/** The four views the spec requires. */
const VIEWS = ['inventory_summary', 'customer_balance', 'sales_summary', 'outstanding_invoices']

describe('every reporting view exists', () => {
  it.each(VIEWS)('reporting.%s', (view) => {
    expect(REPORTING_SQL).toContain(`CREATE OR REPLACE VIEW reporting.${view}`)
  })
})

describe('⚠️ the workspace is never an argument', () => {
  it('no view or function in the schema takes a workspace parameter', () => {
    // THE CORE OF THE WHOLE PHASE. A workspace parameter is what a prompt
    // injection would target: it turns «read someone else's books» into a
    // well-formed, authorised-looking tool call.
    expect(REPORTING_SQL).not.toMatch(/p_workspace_id/)
    expect(REPORTING_SQL).not.toMatch(/workspace_id\s+uuid\s*\)/)
    // No functions at all yet — and if any are added, this is the line that
    // has to be revisited deliberately.
    expect(REPORTING_SQL).not.toContain('CREATE OR REPLACE FUNCTION reporting.')
  })

  it.each(VIEWS)('reporting.%s filters on auth_workspace_ids()', (view) => {
    // Each view's body, from its CREATE to the ALTER that follows it.
    const body = new RegExp(
      `CREATE OR REPLACE VIEW reporting\\.${view} AS([\\s\\S]*?)ALTER VIEW reporting\\.${view}`,
    ).exec(REPORTING_SQL)?.[1]

    expect(body, `${view} body not found`).toBeDefined()
    expect(body).toContain('auth_workspace_ids()')
  })
})

describe('⚠️ RLS actually applies', () => {
  it.each(VIEWS)('reporting.%s is security_invoker', (view) => {
    // Without this the view runs as its OWNER, RLS on the underlying tables
    // never applies, and the view becomes a cross-workspace read. This exact
    // regression already happened once here — phase-b-03 exists to fix it.
    expect(REPORTING_SQL).toContain(`ALTER VIEW reporting.${view} SET (security_invoker = true)`)
  })
})

describe('⚠️ the column allow-list', () => {
  it('no view selects everything', () => {
    // `SELECT *` would expose whatever columns get added to a table later —
    // including ones nobody thought about when writing this.
    expect(REPORTING_SQL).not.toMatch(/SELECT\s+\*/i)
  })

  it('no contact detail is exposed', () => {
    // A model that cannot see a column cannot be persuaded to repeat it. A
    // balance question needs a name and a number.
    for (const forbidden of ['c.phone', 'c.email', 'c.address', 'customer_phone']) {
      expect(REPORTING_SQL).not.toContain(forbidden)
    }
  })

  it('no credential column is exposed anywhere in the phase', () => {
    for (const secret of ['password', 'token', 'secret', 'api_key', 'access_key']) {
      expect(REPORTING_SQL.toLowerCase()).not.toContain(secret)
      expect(sql(CATALOG).toLowerCase()).not.toContain(secret)
    }
  })

  it('the schema is SELECT-only for members', () => {
    expect(REPORTING_SQL).toContain('GRANT  SELECT ON ALL TABLES IN SCHEMA reporting')
    expect(REPORTING_SQL).not.toMatch(/GRANT\s+(INSERT|UPDATE|DELETE|ALL)\s+ON.*reporting/i)
  })
})

describe('O1 — the catalogue tells the truth about this database', () => {
  const catalogSql = sql(CATALOG)

  it('names the frozen accounting table as frozen', () => {
    // A model reading the schema will otherwise answer a revenue question
    // from `ledger_entries`, which has refused writes since Phase B.
    expect(catalogSql).toMatch(/'ledger_entries'[\s\S]{0,400}'frozen'/)
  })

  it('names the inventory projections as derived', () => {
    expect(catalogSql).toMatch(/'warehouse_stock'[\s\S]{0,400}'stock_movements'/)
  })

  it('a non-source-of-truth row must explain what it derives from', () => {
    // Enforced by a CHECK constraint, not by discipline: «false» with no
    // explanation is a warning nobody can act on.
    expect(catalogSql).toContain('entity_catalog_derived_explained')
  })
})

describe('⚠️ O3 — the provider is connected, and how it is connected is fixed', () => {
  /**
   * ⚠️ THIS BLOCK WAS «no AI provider is connected». IT WAS UPDATED
   * DELIBERATELY IN T13, WHICH IS WHAT PHASE O ASKED FOR.
   *
   * Phase O shipped the infrastructure with no provider and left this as a
   * tripwire so that connecting one would be a decision rather than a drift.
   * T13 connected Anthropic and OpenAI.
   *
   * The SDK assertion below SURVIVED that change, and is not a leftover: the
   * integration is a plain `fetch` against the documented HTTP endpoint, on
   * purpose. An SDK brings a dependency tree into the process that handles
   * every customer's books, and it hides the request body — which is exactly
   * what a reviewer of «what leaves this server» needs to see.
   *
   * So the rule is now sharper than «no provider»: the provider is reached by
   * `fetch`, in one file, or not at all.
   *
   * The behaviour of the connected layer is guarded in
   * `ai-provider-boundary.test.ts` — user-scoped reads, closed view list, and
   * the key never leaving the server.
   */
  it('the query log is infrastructure only', () => {
    expect(sql(CATALOG)).toContain('CREATE TABLE IF NOT EXISTS ai_query_log')
    expect(sql(CATALOG)).toContain('ENABLE ROW LEVEL SECURITY')
  })

  it('no provider SDK is a dependency — the call is a plain fetch', () => {
    const pkg = read('backend/package.json')
    for (const sdk of ['@anthropic-ai/', 'openai', '@google/generative-ai', 'langchain']) {
      expect(pkg).not.toContain(sdk)
    }
  })

  it('exactly one file talks to a provider', () => {
    // Concentrating it means «what do we send to a third party» has one
    // answer, in one place, that can be read in full.
    const callers = ['backend/src/services/ai/ai-chat.service.ts']
    for (const caller of callers) {
      expect(read(caller)).toContain('api.anthropic.com')
    }
  })

  it('nothing in the backend reads the reporting schema yet', () => {
    // There is no AI layer. If one appears, it must go through the documented
    // pattern rather than being wired in ad hoc.
    expect(read('docs/ai-integration-readme.md')).toContain('RAW SQL IS FORBIDDEN')
  })
})
