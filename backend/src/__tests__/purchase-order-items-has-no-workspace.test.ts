// Live FINDING, 8 Nov 2026 (docs/FINDING-schema-drift-2026-11-08.sql):
// `purchase_order_items` has NO `workspace_id`. The supplier analysis filtered
// on it, Postgres answered 42703, and the analysis failed with a 500. The
// boundary is the order ids, which come only from the workspace-scoped
// `purchase_orders` read in the same service.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(__dirname, '..', 'services', 'analysis', 'analysis.service.ts'),
  'utf8',
)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*\r?\n/gm, '')

describe('purchase order lines in the supplier analysis', () => {
  it('are not filtered on a workspace_id column the live table does not have', () => {
    const at = src.indexOf(".from('purchase_order_items')")
    expect(at).toBeGreaterThan(0)
    const statement = src.slice(at, src.indexOf('.range(', at))
    expect(statement).not.toContain('workspace_id')
    expect(statement).toContain(".in('purchase_order_id', chunk)")
  })

  it('take their order ids only from the workspace-scoped purchase_orders read', () => {
    const orders = src.slice(
      src.indexOf(".from('purchase_orders')"),
      src.indexOf('this.orderItems('),
    )
    expect(orders).toContain(".eq('workspace_id', ctx.workspaceId)")
    expect(src).toContain('this.orderItems(live.map((order) => order.id))')
  })
})
