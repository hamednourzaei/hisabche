// ============================================
// backend/src/__tests__/step-b-inventory-procurement-logistics.test.ts
//
// STEP-B HTTP tests via buildServer() + app.inject():
//   - G60               POST /api/products/:id/barcode-label
//   - G41               POST /api/quality-events/inspect
//   - G44               POST /api/warranties/rma/disposition
//   - G45               POST /api/repair-tickets/imei/check
//   - G47               POST /api/vehicles/vin/decode
//   - G14               POST /api/deliveries/cod/reconcile-batch
//   - G72               POST /api/purchase-orders/supplier-score
//   - G59/G73/G74/G76   POST /api/purchase-orders/landed-cost-allocate
// ============================================

import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeDatabase, createFakeDb, fakeId } from './helpers/fake-supabase'

const db = new FakeDatabase()
const OWNER = { id: '11111111-1111-4111-8111-111111111111', token: 'token-owner' }
const SHOP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const PROD_ID = 'dddddddd-0000-4000-8000-000000000001'

const users = new Map<string, { id: string }>([[OWNER.token, { id: OWNER.id }]])
vi.mock('../db', () => createFakeDb(db, users))

let app: FastifyInstance
beforeAll(async () => {
  const { buildServer } = await import('../index')
  app = await buildServer()
  await app.ready()
})
afterAll(async () => {
  await app?.close()
})
beforeEach(() => {
  db.tables.clear()
  db.failures.clear()
  db.seed('workspaces', [
    { id: SHOP, name: 'Omnichannel Trade', base_currency: 'AFN', time_zone: 'Asia/Kabul' },
  ])
  db.seed('workspace_members', [
    {
      id: fakeId('mem'),
      workspace_id: SHOP,
      user_id: OWNER.id,
      role: 'owner',
      has_access: true,
      suspended_at: null,
    },
  ])
})

describe('STEP-B — Inventory, Barcode, Quality, RMA/IMEI/VIN, COD & Landed Cost HTTP routes', () => {
  it('G60 generates ZPL and HTML barcode labels', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/products/${PROD_ID}/barcode-label`,
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP },
      payload: {
        title: 'Saffron 10g',
        barcode: '6260000000012',
        priceLabel: '450 AFN',
        sku: 'SAF-10',
        expiryDate: '2027-06-01',
      },
    })
    expect(res.statusCode, res.body).toBe(200)
    expect(res.json().data.zpl).toContain('^XA')
    expect(res.json().data.zpl).toContain('6260000000012')
    expect(res.json().data.html).toContain('Saffron 10g')
  })

  it('G41 evaluates quality inspection and quarantines batches above defect threshold', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/quality-events/inspect',
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP },
      payload: { batchId: 'BATCH-99', inspectedQty: 100, defectiveQty: 5, maxDefectBps: 200 },
    })
    expect(res.statusCode, res.body).toBe(200)
    expect(res.json().data.defectBps).toBe(500)
    expect(res.json().data.passed).toBe(false)
    expect(res.json().data.disposition).toBe('quarantine')
  })

  it('G44/G45/G47 routes RMA disposition, checks IMEI Luhn/blacklist, and normalizes VIN', async () => {
    const rma = await app.inject({
      method: 'POST',
      url: '/api/warranties/rma/disposition',
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP },
      payload: { condition: 'defective_doa', underWarranty: true },
    })
    expect(rma.statusCode, rma.body).toBe(200)
    expect(rma.json().data.resolution).toBe('vendor_rma_claim')

    const imei = await app.inject({
      method: 'POST',
      url: '/api/repair-tickets/imei/check',
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP },
      payload: {
        imei: '490154203237518',
        blacklist: [{ imei: '490154203237518', reason: 'stolen', reportedAt: '2026-10-01' }],
      },
    })
    expect(imei.statusCode, imei.body).toBe(200)
    expect(imei.json().data.validLuhn).toBe(true)
    expect(imei.json().data.blocked).toBe(true)

    const vin = await app.inject({
      method: 'POST',
      url: '/api/vehicles/vin/decode',
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP },
      payload: { vin: ' 1hgcm82633a004352 ' },
    })
    expect(vin.statusCode, vin.body).toBe(200)
    expect(vin.json().data).toEqual({ valid: true, vin: '1HGCM82633A004352' })
  })

  it('G14/G72/G59/G73/G74/G76 reconciles COD batches, scores suppliers, and allocates landed costs', async () => {
    const cod = await app.inject({
      method: 'POST',
      url: '/api/deliveries/cod/reconcile-batch',
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP },
      payload: {
        parcels: [
          { parcelId: 'p1', collectedMinor: 10000, courierFeeMinor: 500, delivered: true },
          { parcelId: 'p2', collectedMinor: 0, courierFeeMinor: 500, delivered: false },
        ],
      },
    })
    expect(cod.statusCode, cod.body).toBe(200)
    expect(cod.json().data.netMerchantPayoutMinor).toBe(9500)

    const score = await app.inject({
      method: 'POST',
      url: '/api/purchase-orders/supplier-score',
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP },
      payload: { totalOrders: 20, onTimeOrders: 18, defectiveOrders: 0 },
    })
    expect(score.statusCode, score.body).toBe(200)
    expect(score.json().data).toEqual({ score: 90, tier: 'A' })

    const landed = await app.inject({
      method: 'POST',
      url: '/api/purchase-orders/landed-cost-allocate',
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP },
      payload: {
        freightMinor: 6000,
        customsMinor: 3000,
        insuranceMinor: 1000,
        lines: [
          { lineId: 'l1', quantity: 10, lineValueMinor: 25000 },
          { lineId: 'l2', quantity: 10, lineValueMinor: 75000 },
        ],
      },
    })
    expect(landed.statusCode, landed.body).toBe(200)
    expect(landed.json().data.totalExtraMinor).toBe(10000)
    expect(landed.json().data.allocations[0].allocatedExtraMinor).toBe(2500)
    expect(landed.json().data.allocations[1].allocatedExtraMinor).toBe(7500)
  })
})
