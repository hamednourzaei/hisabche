// ============================================
// Cancelling a purchase takes its cost layers out of the valuation — and refuses when they were already drawn from.
//
// Before: a cancelled purchase returned the stock and reversed the ledger entry, but its layers kept their remaining quantity, so
// valuation and the next sale's cost still saw goods that no longer existed. The rule is in the database function
// (docs/inventory-void-receipt-01-migration.sql, proved on PGlite); these tests prove the TypeScript side keeps it:
//   · the refusal comes BEFORE any other step of the cancel,
//   · a database without the migration behaves exactly as before (no refusal, no void),
//   · a late refusal from the function keeps its code.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

import { CostingService } from '../services/inventory-costing/costing.service'
import type { CostingRepository } from '../services/inventory-costing/costing.repository'
import type { TenancyContext } from '../services/tenancy.service'

const ctx = { workspaceId: 'w', userId: 'u', role: 'owner' } as unknown as TenancyContext

function service(repo: Partial<Record<'consumedLayersOfReceipt' | 'voidReceipt', unknown>>) {
  return new CostingService(repo as unknown as CostingRepository)
}

describe('assertReceiptUntouched', () => {
  it('refuses when a layer of the receipt was drawn from', async () => {
    const costing = service({ consumedLayersOfReceipt: vi.fn(async () => 1) })
    await expect(costing.assertReceiptUntouched(ctx, 'invoice', 'i')).rejects.toThrow(
      /PURCHASE_LAYER_CONSUMED/,
    )
  })

  it('passes when nothing was drawn from it', async () => {
    const costing = service({ consumedLayersOfReceipt: vi.fn(async () => 0) })
    await expect(costing.assertReceiptUntouched(ctx, 'invoice', 'i')).resolves.toBeUndefined()
  })

  it('passes on a database without the void schema (behaves as before)', async () => {
    const costing = service({ consumedLayersOfReceipt: vi.fn(async () => null) })
    await expect(costing.assertReceiptUntouched(ctx, 'invoice', 'i')).resolves.toBeUndefined()
  })
})

describe('voidReceipt', () => {
  it('reports whether the layers were voided', async () => {
    const applied = service({ voidReceipt: vi.fn(async () => ({ layers: 2, quantity: 8 })) })
    await expect(applied.voidReceipt(ctx, 'invoice', 'i')).resolves.toBe(true)
  })

  it('is false, not an error, when the function is not applied yet', async () => {
    const missing = service({ voidReceipt: vi.fn(async () => null) })
    await expect(missing.voidReceipt(ctx, 'invoice', 'i')).resolves.toBe(false)
  })

  it('keeps the code of a refusal raised by the function itself', async () => {
    const raced = service({
      voidReceipt: vi.fn(async () => {
        throw new Error(
          'PURCHASE_LAYER_CONSUMED: 1 of 2 cost layers of this receipt were already drawn from',
        )
      }),
    })
    await expect(raced.voidReceipt(ctx, 'invoice', 'i')).rejects.toThrow(/PURCHASE_LAYER_CONSUMED/)
  })
})

describe('the cancel path asks before it changes anything', () => {
  const source = readFileSync(join(__dirname, '../services/invoice.service.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .split(/\s+/)
    .join(' ')

  it('asserts the receipt is untouched BEFORE the ledger reversal, and voids it AFTER the release', () => {
    const assertAt = source.indexOf("costing.assertReceiptUntouched(ctx, 'invoice', invoiceId)")
    const reverseAt = source.indexOf("ledger.reverseDocument(ctx, 'invoice', invoiceId")
    const releaseAt = source.indexOf("costing.releaseDocument(ctx, 'invoice', invoiceId)")
    const voidAt = source.indexOf("costing.voidReceipt(ctx, 'invoice', invoiceId)")
    expect(assertAt).toBeGreaterThan(0)
    expect(assertAt).toBeLessThan(reverseAt)
    expect(voidAt).toBeGreaterThan(releaseAt)
  })
})
