// Requests #94/#95 — «افزودن به انبار»: opening stock lands in the warehouse,
// a workspace can invent a unit, and a batch carries the expiry.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const src = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8')
const code = (s: string) => s.replace(/^\s*\/\/.*$/gm, '')

describe('opening stock into a warehouse', () => {
  const product = code(src('services/product.service.ts'))
  const body = product.slice(product.indexOf('async create('))

  it('writes the quantity as a movement, not twice', () => {
    // With a warehouse the row starts at 0 and the movement carries the amount,
    // so products.quantity and warehouse_stock both come from the trigger.
    expect(body).toContain('quantity: openingWarehouseId ? 0 : data.quantity || 0')
    expect(body).toContain('to_warehouse_id: openingWarehouseId')
    expect(body).toContain("reference_type: 'product_opening'")
  })

  it('a failed movement fails the create — stock never silently missing', () => {
    expect(body).toContain(
      "throw new DatabaseError('Failed to record the opening stock', movementError)",
    )
  })

  it('the warehouse must belong to this workspace', () => {
    // The opening warehouse is chosen by stockEditWarehouse (BUG-080) over
    // this workspace's live warehouses only.
    expect(body).toContain('await this.stockWarehouse(')
    const assert = product.slice(product.indexOf('private async stockWarehouse'))
    expect(assert.slice(0, 500)).toContain(".eq('workspace_id', workspaceId)")
    expect(assert.slice(0, 500)).toContain(".is('deleted_at', null)")
  })
})

describe('a workspace’s own unit lives in custom_units', () => {
  const units = code(src('services/inventory/units.service.ts'))

  it('is a SEPARATE table — `units` keeps its global invariants', () => {
    // `units.code` is globally UNIQUE and one row per dimension is the base;
    // per-workspace rows there would mean rewriting both.
    const create = units.slice(units.indexOf('async create('))
    expect(create).toContain(".from('custom_units')")
    expect(create).not.toContain(".from('units')")
    expect(units).not.toContain('workspace_id.is.null,workspace_id.eq.')
  })

  it('is scoped to the workspace on read and on write', () => {
    const scoped = units.slice(units.indexOf('private async workspaceUnits'))
    expect(scoped.slice(0, 700)).toContain(".eq('workspace_id', workspaceId)")
    expect(units.slice(units.indexOf('async create('))).toContain('workspace_id: workspaceId')
  })

  it('carries a real conversion and never claims a base', () => {
    const create = units.slice(units.indexOf('async create('))
    expect(create).toContain('conversion_factor: input.conversionFactor')
    expect(create).toContain("throw new ValidationError('UNIT_FACTOR_INVALID')")
    // The INSERT never names is_base: a workspace cannot redefine a
    // dimension's base. (It appears once more below, where the row is mapped
    // back out as `false`.)
    const insert = create.slice(create.indexOf('.insert({'), create.indexOf('.select('))
    expect(insert).not.toContain('is_base')
  })

  it('says so when the migration has not run', () => {
    expect(units).toContain("throw new ConflictError('UNIT_CUSTOM_MIGRATION_REQUIRED')")
  })
})

describe('expiry lives on the batch', () => {
  const trace = code(src('services/traceability/traceability.service.ts'))
  const update = trace.slice(trace.indexOf('async updateBatchDates'))

  it('only the dates can be corrected', () => {
    expect(update.slice(0, 900)).toContain('patch.expiry_date = input.expiryDate')
    expect(update.slice(0, 900)).not.toContain('remaining_qty')
    expect(update.slice(0, 900)).not.toContain('received_qty')
  })

  it('is scoped by workspace and 404s an unknown batch', () => {
    expect(update.slice(0, 900)).toContain(".eq('workspace_id', ctx.workspaceId)")
    expect(update.slice(0, 900)).toContain("throw new NotFoundError('Batch')")
  })
})
