// ============================================
// backend/src/__tests__/quality-gates-enforcement.test.ts
//
// Phase 4 Permanent Automated Quality Gates:
// Conservative, zero-noise structural checks guarding against reintroduction of
// audited P0/P1 defects.
// ============================================

import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../../..')
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8')

describe('Permanent Engineering Quality Gates (Phase 4)', () => {
  it('migration registry passes dependency & cycle-free --check', () => {
    const res = spawnSync(
      process.execPath,
      [resolve(ROOT, 'scripts/migrations/generate-registry.mjs'), '--check'],
      { encoding: 'utf8' },
    )
    expect(res.stderr.trim()).toBe('')
    expect(res.status).toBe(0)
  })

  it('payment processor-state route enforces final-state webhook/adminOverride trust boundary', () => {
    const src = read('backend/src/routes/payments.routes.ts')
    expect(src).toContain('FINAL_PROCESSOR_STATES')
    expect(src).toContain('PROCESSOR_FINAL_STATE_REQUIRES_WEBHOOK_OR_OVERRIDE')
    expect(src).toContain("supabase.rpc(\n          'transition_payment_processor_state'")
  })

  it('project change orders use explicit DB replay result (no 500ms timestamp heuristic) and dedicated admin permission', () => {
    const projSrc = read('backend/src/routes/project.routes.ts')
    const adminOpsSrc = read('backend/src/routes/admin-ops.routes.ts')
    const rbacSrc = read('backend/src/services/admin/admin-rbac.domain.ts')

    expect(projSrc).toContain("supabase.rpc('create_project_change_order_v2'")
    expect(projSrc).not.toMatch(/Date\.now\(\)\s*-\s*new\s+Date\(/)
    expect(adminOpsSrc).toContain("adminRoute('projects.change_orders.decide', { stepUp: true })")
    expect(rbacSrc).toContain("'projects.change_orders.decide'")
  })

  it('cross-core reconciliation uses majorToMinor conversion and AI customer debt clamps negative overpayments', () => {
    const recSrc = read('backend/src/services/accounting/cross-core-reconcile.ts')
    const aiSrc = read('backend/src/services/ai.service.ts')

    expect(recSrc).toContain("from '../../utils/money-units'")
    expect(recSrc).toContain('majorToMinor(')
    expect(aiSrc).toContain('Math.max(0, Number(inv.total) - Number(inv.paid_amount))')
  })

  it('global auth preHandler exempts brand-asset content GET only when non-empty sig= is present', () => {
    const indexSrc = read('backend/src/index.ts')
    expect(indexSrc).toContain("new URLSearchParams(rawQuery).get('sig')?.trim()")
  })
})
