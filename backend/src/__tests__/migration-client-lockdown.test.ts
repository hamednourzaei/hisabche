// ============================================
// backend/src/__tests__/migration-client-lockdown.test.ts
//
// ⚠️ A TABLE THE BACKEND OWNS IS NOT A TABLE A CLIENT MAY WRITE.
//
// The V61 audit (12 Nov 2026) found 19 migrations that gave every member of a
// workspace — a seller included — INSERT/UPDATE on backend-only tables through
// the Supabase API: a policy "FOR ALL TO authenticated USING (workspace
// member)" plus a GRANT to `authenticated`. That skipped every capability check
// the backend makes. The worst cases: any member could approve their own
// approval request, or overwrite another member's 2FA enrollment.
//
// The rule since then (salon-01 pattern): RLS ON, NO policy, REVOKE from
// anon/authenticated, service_role only. This guard:
//   1. the 19 fixed migrations end with the lockdown block naming EVERY table
//      they create, and grant nothing to authenticated;
//   2. no other migration may give `authenticated` write access — except a
//      CLOSED list of older files written before the rule (already live; each
//      needs its own review, never a silent edit). Growing that list is the
//      moment someone loosens the rule instead of keeping it: don't.
// ============================================
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const DOCS = resolve(__dirname, '../../../docs')

/** SQL with `--` comments removed (the lockdown comment itself names the bad pattern). */
function sqlOf(name: string): string {
  return readFileSync(resolve(DOCS, `${name}-migration.sql`), 'utf8').replace(/--[^\n]*/g, '')
}

const LOCKED_DOWN = [
  'approval-policy-01',
  'hr-org-appraisal-01',
  'cheques-01',
  'accrual-schedules-01',
  'bundles-consignment-commission-01',
  'rfq-purchase-contracts-01',
  'messaging-outbox-01',
  'customer-payment-gateway-01',
  'workspace-2fa-01',
  'document-revisions-01',
  'sales-orders-02',
  'overhead-allocation-01',
  'contracts-01',
  'quality-events-01',
  'resource-capacity-01',
  'exchange-03',
  'gold-01',
  'repair-parts-01',
  'salon-02',
] as const

/** Written before the rule; already live. Closed — do not add to it. */
const LEGACY_MEMBER_WRITE = new Set([
  'accounting-core',
  'branch',
  'cloud-migration-01',
  'core-divergence',
  'customer-360-phase3',
  'data-migration-center',
  'finance-gaps',
  'inventory-costing',
  'live-reconciliation',
  'mdm',
  'package-credit-ledger-01',
  'payments-ar-ap',
  'personalization',
  'phase-d-01-employee-branch-assignments',
  'phase-e-01-rbac-2.0',
  'phase-o-01-reporting-layer',
  'remaining-policies',
  'rls-performance',
  'rls-recursion-fix',
  'rules-engine',
  'schema-drift-fix',
  'service-delivery-01',
  'service-delivery-02-atomic',
  'sod',
  'sync-conflicts',
  'tax-engine',
  'tenant-isolation-closure',
  'tier2-gaps',
  'traceability',
  'unified-sale-purchase',
  'universal-core',
])

const WRITE_GRANT = /GRANT[^;]*\b(INSERT|UPDATE|DELETE|ALL)\b[^;]*\bTO\b[^;]*\bauthenticated\b/i
const WRITE_POLICY =
  /CREATE POLICY[^;]*\bFOR\s+(ALL|INSERT|UPDATE|DELETE)\b[^;]*\bTO\s+authenticated\b/i

describe('backend-only tables are locked against clients', () => {
  it.each(LOCKED_DOWN)('%s ends with the lockdown and grants nothing to clients', (name) => {
    const sql = sqlOf(name)
    const created = [...sql.matchAll(/CREATE TABLE IF NOT EXISTS (?:public\.)?([a-z_0-9]+)/g)].map(
      (m) => m[1]!,
    )
    expect(created.length).toBeGreaterThan(0)

    expect(sql).not.toMatch(/^GRANT[^;]*\bauthenticated\b/m)
    expect(sql).not.toMatch(/CREATE POLICY/)

    const lockdown = sql.slice(sql.indexOf('DO $lockdown$'))
    expect(sql.includes('DO $lockdown$')).toBe(true)
    for (const table of created) {
      expect(lockdown).toContain(`'${table}'`)
      expect(lockdown).toContain(`REVOKE ALL ON public.${table} FROM PUBLIC, anon, authenticated;`)
    }
  })

  it('every lockdown block runs inside the transaction when the file has one', () => {
    for (const name of LOCKED_DOWN) {
      const sql = sqlOf(name)
      const commit = sql.lastIndexOf('COMMIT;')
      if (commit === -1) continue
      expect(sql.indexOf('DO $lockdown$')).toBeLessThan(commit)
    }
  })

  it('no migration outside the closed legacy list gives authenticated write access', () => {
    const offenders = readdirSync(DOCS)
      .filter((f) => f.endsWith('-migration.sql'))
      .map((f) => f.replace(/-migration\.sql$/, ''))
      .filter((name) => !LEGACY_MEMBER_WRITE.has(name))
      .filter((name) => {
        const sql = sqlOf(name)
        return WRITE_GRANT.test(sql) || WRITE_POLICY.test(sql)
      })
    expect(offenders).toEqual([])
  })

  it('the legacy list only names files that still exist and still need review', () => {
    const stale = [...LEGACY_MEMBER_WRITE].filter((name) => {
      try {
        const sql = sqlOf(name)
        return !(WRITE_GRANT.test(sql) || WRITE_POLICY.test(sql))
      } catch {
        return true
      }
    })
    expect(stale).toEqual([])
  })
})
