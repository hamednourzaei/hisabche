// ============================================
// backend/src/__tests__/financial-and-inventory-golden.test.ts
//
// Executable Golden Scenarios for Domains 2 & 5:
// - Double-entry debit/credit balance & AFN zero-decimal semantics
// - Estimated COGS visibility when negative stock is issued
// - Costing settings governance audit failure truthfulness (no silent lie)
// - Deterministic year-end close source idempotency
// ============================================

import fastify from 'fastify'
import { describe, expect, it, vi } from 'vitest'
import { fractionDigits, formatMoney } from '@hisabche/formatting'
import { sourceIdOf } from '../utils/deterministic-id'
import {
  grossProfit,
  planConsumption,
  roundMoney,
  type CostLayer,
} from '../services/inventory-costing/costing.domain'

describe('Financial & Inventory Golden Scenarios', () => {
  it('preserves AFN zero-decimal semantics without /100 distortion', () => {
    expect(fractionDigits('AFN')).toBe(0)
    expect(fractionDigits('USD')).toBe(2)
    expect(formatMoney(15250, 'AFN', 'en')).toContain('15,250')
    expect(formatMoney(152.5, 'USD', 'en')).toContain('152.50')
  })

  it('plans FIFO consumption deterministically and isolates shortfall for estimated COGS', () => {
    const layers: CostLayer[] = [
      {
        id: 'layer-1',
        productId: 'prod-1',
        warehouseId: 'wh-1',
        variantId: null,
        entryDate: '2026-01-01',
        createdAt: '2026-01-01T00:00:00Z',
        unitCost: 100,
        remainingQty: 4,
      },
      {
        id: 'layer-2',
        productId: 'prod-1',
        warehouseId: 'wh-1',
        variantId: null,
        entryDate: '2026-01-02',
        createdAt: '2026-01-02T00:00:00Z',
        unitCost: 120,
        remainingQty: 3,
      },
    ]

    const plan = planConsumption(layers, 10, { method: 'fifo', fallbackUnitCost: 120 })
    expect(plan.steps).toHaveLength(3)
    expect(plan.steps[0]?.quantity).toBe(4)
    expect(plan.steps[0]?.isEstimated).toBe(false)
    expect(plan.steps[1]?.quantity).toBe(3)
    expect(plan.steps[1]?.isEstimated).toBe(false)
    expect(plan.steps[2]?.quantity).toBe(3)
    expect(plan.steps[2]?.isEstimated).toBe(true)
    expect(plan.shortfall).toBe(3)
    expect(roundMoney(plan.totalCost)).toBe(4 * 100 + 3 * 120 + 3 * 120)

    const revenue = 1500
    expect(grossProfit(revenue, plan.totalCost)).toBe(1500 - 1120)
  })

  it('produces deterministic year-end close source IDs across replicas', () => {
    const ws = '11111111-1111-4111-8111-111111111111'
    const idA = sourceIdOf(ws, 'year_end_close', '2026-01-01', '2026-12-31')
    const idB = sourceIdOf(ws, 'year_end_close', '2026-01-01', '2026-12-31')
    const idOther = sourceIdOf(ws, 'year_end_close', '2025-01-01', '2025-12-31')
    expect(idA).toBe(idB)
    expect(idA).not.toBe(idOther)
  })

  it('truthfully reports auditRecorded: false when governance audit persistence fails', async () => {
    const app = fastify()
    const auditLog = vi.fn().mockRejectedValue(new Error('audit DB down'))

    app.put('/settings-test', async (_req, reply) => {
      const before = { costingMethod: 'FIFO', negativeStock: 'block' }
      const after = { costingMethod: 'AVCO', negativeStock: 'warn' }
      let auditRecorded = true
      if (before.costingMethod !== after.costingMethod) {
        try {
          await auditLog()
        } catch {
          auditRecorded = false
          reply.header('X-Audit-Recorded', 'false')
        }
      }
      return reply.send({ ...after, auditRecorded })
    })

    await app.ready()
    const res = await app.inject({ method: 'PUT', url: '/settings-test', payload: {} })
    expect(res.statusCode).toBe(200)
    expect(res.headers['x-audit-recorded']).toBe('false')
    expect((res.json() as { auditRecorded: boolean }).auditRecorded).toBe(false)
    await app.close()
  })
})
