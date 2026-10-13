// ============================================
// Which warehouses a member may sell from (services/inventory/warehouse-access).
//
// «شعبه‌ی سعادت‌آباد فروشنده‌اش فقط به انبار شعبه‌ی سعادت‌آباد دسترسی داشته باشد.»
// There is no second permission system: a warehouse belongs to a branch, and a
// member's branches were already decided. This is the one rule joining them.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import type { BranchScope } from '../services/branch/branch.domain'
import { mayUseWarehouse } from '../services/inventory/warehouse-access'

const SAADAT = 'b-saadat'
const KABUL = 'b-kabul'
const everything: BranchScope = { kind: 'all' }
const saadatOnly: BranchScope = { kind: 'limited', branchIds: [SAADAT] }
const nothing: BranchScope = { kind: 'none' }

describe('mayUseWarehouse', () => {
  it('⚠️ a seller of one branch uses that branch’s warehouse and no other', () => {
    expect(mayUseWarehouse(saadatOnly, SAADAT, true)).toBe(true)
    expect(mayUseWarehouse(saadatOnly, KABUL, true)).toBe(false)
  })

  it('⚠️ a warehouse not yet placed in a branch stays open — shipping this rule locks nobody out', () => {
    // Every warehouse that existed before this rule has no branch.
    expect(mayUseWarehouse(saadatOnly, null, true)).toBe(true)
    expect(mayUseWarehouse(everything, null, true)).toBe(true)
    // Placing it is what restricts it.
    expect(mayUseWarehouse(saadatOnly, KABUL, true)).toBe(false)
  })

  it('a member with every branch uses every warehouse; one with none uses none', () => {
    expect(mayUseWarehouse(everything, KABUL, true)).toBe(true)
    expect(mayUseWarehouse(nothing, SAADAT, true)).toBe(false)
    expect(mayUseWarehouse(nothing, null, true)).toBe(false)
  })

  it('a database that cannot place warehouses does not lock every seller out — and still refuses «none»', () => {
    expect(mayUseWarehouse(saadatOnly, null, false)).toBe(true)
    expect(mayUseWarehouse(nothing, null, false)).toBe(false)
  })
})

describe('where it is enforced', () => {
  const read = (path: string) =>
    readFileSync(join(__dirname, '..', path), 'utf8')
      .split('\n')
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .join('\n')
      .split(/\s+/)
      .join(' ')
  const access = read('services/inventory/warehouse-access.ts')
  const invoice = read('services/invoice.service.ts')
  const routes = read('routes/warehouse.routes.ts')

  it('⚠️ on the server, when the invoice is made — not only in the select', () => {
    expect(invoice).toContain('await assertMayUseWarehouse(ctx, invoiceWarehouseId)')
    expect(access).toContain("throw new ForbiddenError('INVOICE_WAREHOUSE_NOT_PERMITTED')")
  })

  it('what a member is shown is filtered by the same rule, stock included', () => {
    expect(access).toContain(
      '.filter((row) => mayUseWarehouse(scope, row.branchId, branchesConfigured))',
    )
    expect(access).toContain('.filter((row) => allowed.has(row.warehouse_id))')
    // Every read is inside the caller's workspace.
    expect(access.split(".eq('workspace_id', ctx.workspaceId)").length - 1).toBe(2)
    expect(access).toContain(".eq('workspace_id', workspaceId)")
  })

  it('the placement carries names and quantities — never a cost or a price', () => {
    for (const word of ['buy_price', 'sell_price', 'cost', 'price']) {
      expect(access.toLowerCase(), word).not.toContain(word)
    }
    expect(routes).toContain("'/api/warehouses/placement'")
  })

  it('a branch given to a warehouse must be this workspace’s own, and a missing column is said by name', () => {
    expect(access).toContain("throw new ValidationError('WAREHOUSE_BRANCH_NOT_FOUND')")
    expect(read('services/warehouse.service.ts')).toContain(
      "throw new ConflictError('WAREHOUSE_BRANCH_NOT_CONFIGURED')",
    )
  })
})
