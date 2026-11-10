// ============================================
// A sale line that names a variant is refused when THAT variant has no stock,
// and only when the negative-stock policy blocks (V55 P2). The pure rule lives
// in `checkVariantSalesAvailability` (validation, tested there); this file pins
// the wiring in the invoice service.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('variant sale availability wiring', () => {
  const flat = (file: string) => readFileSync(join(__dirname, file), 'utf8').split(/\s+/).join(' ')
  const service = flat('../services/invoice.service.ts')

  it('the check runs on the built movement rows of a sale, inside planStockMovements', () => {
    expect(service).toContain('const refusal = checkVariantSalesAvailability({ demands, stock })')
    expect(
      service.indexOf('const variantRows = rows.filter((row) => row.variant_id)'),
    ).toBeGreaterThan(service.indexOf('private async planStockMovements('))
  })

  it('only a SALE is checked (a purchase arrives onto the variant)', () => {
    expect(service).toContain('if (direction === -1) { const variantRows')
  })

  it('the policy gate is the negative-stock setting, and `allow` skips the check', () => {
    expect(service).toContain('const settings = await costing.getSettings(ctx)')
    expect(service).toContain("if (settings.negativeStock === 'block') {")
  })

  it('the stock read is the same rpc the variant stock screen uses, and a pre-migration database is skipped, not guessed', () => {
    expect(service).toContain("supabase.rpc('product_variant_stock'")
    expect(service).toContain('if (notReady) continue')
  })
})
