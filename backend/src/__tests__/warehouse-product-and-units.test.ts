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
    expect(body).toContain('await this.assertWarehouse(workspaceId, openingWarehouseId)')
    const assert = product.slice(product.indexOf('private async assertWarehouse'))
    expect(assert.slice(0, 500)).toContain(".eq('workspace_id', workspaceId)")
    expect(assert.slice(0, 500)).toContain(".is('deleted_at', null)")
  })
})

describe('a workspace’s own unit', () => {
  const units = code(src('services/inventory/units.service.ts'))

  it('is scoped to the workspace on read and on write', () => {
    expect(units).toContain('workspace_id.is.null,workspace_id.eq.${workspaceId}')
    const create = units.slice(units.indexOf('async create('))
    expect(create).toContain('workspace_id: workspaceId')
  })

  it('never claims a conversion it does not know', () => {
    const create = units.slice(units.indexOf('async create('))
    expect(create).toContain("dimension: 'count'")
    expect(create).toContain('conversion_factor: 1')
    expect(create).toContain('is_base: false')
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
