// ============================================
// packages/local-engine/src/__tests__/extended-local-ops.test.ts
//
// Real in-memory SQLite verification of X10 processor FSM and local-ops
// modules (assets, agriculture crop/livestock, manufacturing defs, approvals).
// ============================================

import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDb, createTestEngine, TEST_USER_ID } from './test-db'

const QUEUED = { 'x-hisabche-queue': '1', 'x-hisabche-user-id': TEST_USER_ID }

describe('Extended Local Ops & X10 Payment Processor Lifecycle', () => {
  let db: ReturnType<typeof createTestDb>
  let engine: ReturnType<typeof createTestEngine>

  beforeEach(() => {
    db = createTestDb()
    engine = createTestEngine(db)
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

    // Append-only gateway event trail preserves initial queued_offline + pending_capture + captured
    const eventsRes = await engine.request<{ data: Array<{ toState: string }> }>({
      method: 'GET',
      path: `/payments/${payId}/gateway-events`,
    })
    expect(eventsRes.status).toBe(200)
    expect(eventsRes.data.data.map((e) => e.toState)).toEqual([
      'queued_offline',
      'pending_capture',
      'captured',
    ])
  })

  it('persists offline assets, crop cycles, livestock groups, BOM defs, and approval requests with outbox queueing', async () => {
    const asset = await engine.request({
      method: 'POST',
      path: '/local-ops/assets',
      headers: QUEUED,
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
      headers: QUEUED,
      body: { landUnitId: 'plot-a', cropName: 'Saffron', plantingDate: '2026-10-15' },
    })
    expect(crop.status).toBe(201)

    const herd = await engine.request({
      method: 'POST',
      path: '/local-ops/livestock-groups',
      headers: QUEUED,
      body: { category: 'Dairy Cattle', headCount: 18, birthOrAcquisitionDate: '2026-09-01' },
    })
    expect(herd.status).toBe(201)

    const bom = await engine.request({
      method: 'POST',
      path: '/local-ops/manufacturing-defs',
      headers: QUEUED,
      body: { productId: 'prod-1', definition: { stages: ['mix', 'pack'], yieldQty: 10 } },
    })
    expect(bom.status).toBe(201)

    const apr = await engine.request({
      method: 'POST',
      path: '/local-ops/approvals',
      headers: QUEUED,
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

    const queuedEntities = db
      .all<{ entity: string }>('SELECT entity FROM sync_queue ORDER BY rowid ASC')
      .map((r) => r.entity)
    expect(queuedEntities).toEqual(
      expect.arrayContaining([
        'local_assets',
        'local_crop_cycles',
        'local_livestock_groups',
        'local_manufacturing_defs',
        'local_approval_queue',
      ]),
    )
  })

  it('persists and retrieves personal invoice drafts offline (CORE 01 parity)', async () => {
    const saved = await engine.request<{ id: string; title: string }>({
      method: 'PUT',
      path: '/me/invoice-drafts',
      body: { kind: 'sale', title: 'Draft Walk-in', payload: { rows: [{ qty: 2 }] } },
    })
    expect(saved.status).toBe(200)
    const draftId = saved.data.id

    const listed = await engine.request<{ configured: boolean; drafts: Array<{ id: string }> }>({
      method: 'GET',
      path: '/me/invoice-drafts',
    })
    expect(listed.status).toBe(200)
    expect(listed.data.configured).toBe(true)
    expect(listed.data.drafts.map((d) => d.id)).toContain(draftId)

    const del = await engine.request<{ deleted: boolean }>({
      method: 'DELETE',
      path: `/me/invoice-drafts/${draftId}`,
    })
    expect(del.status).toBe(200)
    expect(del.data.deleted).toBe(true)

    const after = await engine.request<{ drafts: unknown[] }>({
      method: 'GET',
      path: '/me/invoice-drafts',
    })
    expect(after.data.drafts).toHaveLength(0)
  })
})
