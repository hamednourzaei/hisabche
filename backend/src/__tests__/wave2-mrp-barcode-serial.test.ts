// ============================================
// backend/src/__tests__/wave2-mrp-barcode-serial.test.ts
//
// Wave 2 verification:
//   - G53 / G54: MRP net shortage & BOM explosion via POST /api/manufacturing/mrp/plan
//   - G60: Barcode ZPL & HTML label builders with escaping
//   - G44 / G45 / G47: RMA disposition, IMEI Luhn & blacklist, VIN normalization
// ============================================

import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildBarcodeLabelHtml,
  buildBarcodeLabelZpl,
  checkImeiBlacklist,
  isValidImeiLuhn,
  normalizeVin,
  resolveRmaDisposition,
} from '@hisabche/validation'
import { FakeDatabase, createFakeDb, fakeId } from './helpers/fake-supabase'

const db = new FakeDatabase()
const OWNER = { id: '11111111-1111-4111-8111-111111111111', token: 'token-owner' }
const SHOP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const PROD_ROOT = 'dddddddd-0000-4000-8000-000000000001'
const PROD_FLOUR = 'dddddddd-0000-4000-8000-000000000002'
const PROD_SUGAR = 'dddddddd-0000-4000-8000-000000000003'

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
    { id: SHOP, name: 'Bakery & Mfg', base_currency: 'AFN', time_zone: 'Asia/Kabul' },
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

describe('Wave 2 — MRP, Barcode Labels, IMEI/RMA/VIN', () => {
  it('computes MRP net shortages via POST /api/manufacturing/mrp/plan', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/manufacturing/mrp/plan',
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP },
      payload: {
        rootProductId: PROD_ROOT,
        requestedQuantity: 10,
        boms: {
          [PROD_ROOT]: {
            productId: PROD_ROOT,
            label: 'Cake Box',
            version: 1,
            components: [
              { productId: PROD_FLOUR, label: 'Flour (kg)', quantity: 2, unitCostMinor: 60 },
              { productId: PROD_SUGAR, label: 'Sugar (kg)', quantity: 1, unitCostMinor: 80 },
            ],
          },
        },
        onHandByProduct: { [PROD_FLOUR]: 8, [PROD_SUGAR]: 15 },
        onOrderByProduct: { [PROD_FLOUR]: 5 },
        safetyStockByProduct: { [PROD_FLOUR]: 2 },
      },
    })
    expect(res.statusCode, res.body).toBe(200)
    const body = res.json()
    // Flour: required 20 + safety 2 - (8 + 5) = 9 shortage * 60 = 540
    const flour = body.lines.find((l: { productId: string }) => l.productId === PROD_FLOUR)
    const sugar = body.lines.find((l: { productId: string }) => l.productId === PROD_SUGAR)
    expect(flour.netShortageQty).toBe(9)
    expect(flour.estimatedShortageCostMinor).toBe(540)
    expect(sugar.netShortageQty).toBe(0)
  })

  it('builds injection-safe ZPL & HTML barcode labels (G60)', () => {
    const zpl = buildBarcodeLabelZpl({
      barcode: '6261234567890',
      title: 'T-Shirt ^L',
      priceLabel: '450 AFN',
      variantLabel: 'L / Black',
    })
    expect(zpl).toContain('^XA')
    expect(zpl).toContain('^FD6261234567890^FS')
    expect(zpl).not.toContain('^L^')

    const html = buildBarcodeLabelHtml({
      barcode: '6261234567890',
      title: '<script>alert(1)</script>',
      priceLabel: '450 AFN',
    })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('validates IMEI Luhn + blacklist (G45), RMA disposition (G44), and VIN (G47)', () => {
    expect(isValidImeiLuhn('490154203237518')).toBe(true)
    expect(isValidImeiLuhn('490154203237519')).toBe(false)

    const hit = checkImeiBlacklist('490154203237518', [
      { imei: '490154203237518', reason: 'Reported stolen', reportedAt: '2026-11-01T00:00:00Z' },
    ])
    expect(hit.blocked).toBe(true)
    expect(hit.validLuhn).toBe(true)

    expect(resolveRmaDisposition('defective_doa', true)).toBe('vendor_rma_claim')
    expect(resolveRmaDisposition('sealed_resellable', false)).toBe('restock_sellable')
    expect(resolveRmaDisposition('repairable', false)).toBe('repair_bench')

    expect(normalizeVin(' 1hgcm82633a004352 ')).toEqual({ valid: true, vin: '1HGCM82633A004352' })
    expect(normalizeVin('1HGCM82633O004352').valid).toBe(false) // O is invalid in ISO 3779 VIN
  })
})
