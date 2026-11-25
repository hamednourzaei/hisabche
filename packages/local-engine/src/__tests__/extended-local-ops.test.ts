// ============================================
// packages/local-engine/src/__tests__/extended-local-ops.test.ts
//
// Real in-memory SQLite verification of X10 processor FSM and local-ops
// modules (assets, agriculture crop/livestock, manufacturing defs, approvals).
// ============================================

import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDb, createTestEngine } from './test-db'

describe('Extended Local Ops & X10 Payment Processor Lifecycle', () => {
  let engine: ReturnType<typeof createTestEngine>

  beforeEach(() => {
    engine = createTestEngine(createTestDb())
  })

  it('tracks queued_offline on card payments and transitions cleanly to captured', async () => {
    const payId = '00000000-0000-4000-8000-000000000701'
    const created = await engine.request<{ id: string; processorState: string }>({
      method: 'POST',
      path: '/payments',
      body: {
        id: payId,
        direction: 'in',
        partyType: 'customer',
        partyId: '00000000-0000-4000-8000-000000000001',
        amount: 2500,
        currency: 'AFN',
        method: 'card',
      },
    })
    expect(created.status).toBe(201)
    expect(created.data.processorState).toBe('queued_offline')

    const toPending = await engine.request<{ data: { processorState: string } }>({
      method: 'POST',
      path: `/payments/${payId}/processor-state`,
      body: { processorState: 'pending_capture', gatewayName: 'MelliPOS', feeMinor: 50 },
    })
    expect(toPending.status).toBe(200)
    expect(toPending.data.data.processorState).toBe('pending_capture')

    const toCaptured = await engine.request<{ data: { processorState: string; feeMinor: number } }>(
      {
        method: 'POST',
        path: `/payments/${payId}/processor-state`,
        body: { processorState: 'captured', feeMinor: 50 },
      },
    )
    expect(toCaptured.status).toBe(200)
    expect(toCaptured.data.data.processorState).toBe('captured')

    const forbidden = await engine.request({
      method: 'POST',
      path: `/payments/${payId}/processor-state`,
      body: { processorState: 'queued_offline', feeMinor: 0 },
    })
    expect(forbidden.status).toBe(409)
  })

  it('persists offline assets, crop cycles, livestock groups, BOM defs, and approval requests', async () => {
    const asset = await engine.request({
      method: 'POST',
      path: '/local-ops/assets',
      body: {
        name: 'Solar Inverter',
        costMinor: 120000,
        method: 'straight_line',
        periods: 24,
        firstPeriodOn: '2026-12-01',
        acquiredOn: '2026-11-25',
      },
    })
    expect(asset.status).toBe(201)

    const crop = await engine.request({
      method: 'POST',
      path: '/local-ops/crop-cycles',
      body: { landUnitId: 'plot-a', cropName: 'Saffron', plantingDate: '2026-10-15' },
    })
    expect(crop.status).toBe(201)

    const herd = await engine.request({
      method: 'POST',
      path: '/local-ops/livestock-groups',
      body: { category: 'Dairy Cattle', headCount: 18, birthOrAcquisitionDate: '2026-09-01' },
    })
    expect(herd.status).toBe(201)

    const bom = await engine.request({
      method: 'POST',
      path: '/local-ops/manufacturing-defs',
      body: { productId: 'prod-1', definition: { stages: ['mix', 'pack'], yieldQty: 10 } },
    })
    expect(bom.status).toBe(201)

    const apr = await engine.request({
      method: 'POST',
      path: '/local-ops/approvals',
      body: { documentType: 'purchase_order', documentId: 'po-99', note: 'Urgent' },
    })
    expect(apr.status).toBe(201)

    expect(
      (await engine.request<{ data: unknown[] }>({ method: 'GET', path: '/local-ops/assets' })).data
        .data,
    ).toHaveLength(1)
    expect(
      (await engine.request<{ data: unknown[] }>({ method: 'GET', path: '/local-ops/crop-cycles' }))
        .data.data,
    ).toHaveLength(1)
    expect(
      (
        await engine.request<{ data: unknown[] }>({
          method: 'GET',
          path: '/local-ops/livestock-groups',
        })
      ).data.data,
    ).toHaveLength(1)
    expect(
      (
        await engine.request<{ data: unknown[] }>({
          method: 'GET',
          path: '/local-ops/manufacturing-defs',
        })
      ).data.data,
    ).toHaveLength(1)
    expect(
      (await engine.request<{ data: unknown[] }>({ method: 'GET', path: '/local-ops/approvals' }))
        .data.data,
    ).toHaveLength(1)
  })
})
