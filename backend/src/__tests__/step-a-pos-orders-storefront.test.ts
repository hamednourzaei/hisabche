// ============================================
// backend/src/__tests__/step-a-pos-orders-storefront.test.ts
//
// STEP-A HTTP tests via buildServer() + app.inject():
//   - G04/G05/G06 POST /api/orders/table-service/bill-summary
//   - G03         POST /api/orders/layaway
//   - G09/G10/G62/G63 GET /api/public/v1/catalog/qr-whatsapp
//   - G15         POST /api/contracts/subscriptions/next-cycle
//   - G68/G69     POST /api/appointments/waitlist/allocate
//   - G46         POST /api/exchange/trade-in/quote
// ============================================

import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { generatePublishableKey, hashApiKey } from '../services/developer/developer.domain'
import { FakeDatabase, createFakeDb, fakeId } from './helpers/fake-supabase'

const db = new FakeDatabase()
const OWNER = { id: '11111111-1111-4111-8111-111111111111', token: 'token-owner' }
const SHOP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const CONTRACT_ID = 'cccccccc-0000-4000-8000-000000000001'
const PUB_TOKEN = generatePublishableKey()
const PUB_HASH = hashApiKey(PUB_TOKEN)

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
    { id: SHOP, name: 'Cafe & Boutique', base_currency: 'AFN', time_zone: 'Asia/Kabul' },
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
  db.seed('api_keys', [
    {
      id: fakeId('pk'),
      workspace_id: SHOP,
      kind: 'publishable',
      key_hash: PUB_HASH,
      name: 'QR Menu',
      allowed_origins: ['*'],
      revoked_at: null,
    },
  ])
  db.seed('products', [
    {
      id: fakeId('prod'),
      workspace_id: SHOP,
      name: 'Espresso',
      sku: 'ESP-01',
      sell_price: 120,
      is_active: true,
      show_on_storefront: true,
    },
  ])
})

describe('STEP-A — POS, Orders, Storefront, Contracts, Appointments & Trade-in HTTP routes', () => {
  it('G04/G05/G06 computes table-service bill summary, tip pool, and validates seat split', async () => {
    const okRes = await app.inject({
      method: 'POST',
      url: '/api/orders/table-service/bill-summary',
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP },
      payload: {
        subtotalMinor: 10000,
        serviceChargeBps: 1000,
        tipMinor: 500,
        staffIds: ['s1', 's2'],
        seatAmountsMinor: [6000, 5500],
      },
    })
    expect(okRes.statusCode, okRes.body).toBe(200)
    const data = okRes.json().data
    expect(data.serviceChargeMinor).toBe(1000)
    expect(data.grandTotalMinor).toBe(11500)
    expect(data.tipPool).toEqual({ s1: 250, s2: 250 })
    expect(data.seatSplit).toEqual([6000, 5500])

    const badSplit = await app.inject({
      method: 'POST',
      url: '/api/orders/table-service/bill-summary',
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP },
      payload: {
        subtotalMinor: 10000,
        serviceChargeBps: 0,
        tipMinor: 0,
        seatAmountsMinor: [5000, 4000],
      },
    })
    expect(badSplit.statusCode).toBe(422)
    expect(badSplit.json().code).toBe('SEAT_SPLIT_MISMATCH')
  })

  it('G03 creates a layaway deposit and installment schedule without losing minor units', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/layaway',
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP },
      payload: { totalMinor: 10000, depositMinor: 2500, installmentCount: 3, currency: 'usd' },
    })
    expect(res.statusCode, res.body).toBe(201)
    const data = res.json().data
    expect(data.currency).toBe('USD')
    expect(data.remainingMinor).toBe(7500)
    expect(data.installments).toHaveLength(3)
    expect(
      data.installments.reduce((s: number, i: { amountMinor: number }) => s + i.amountMinor, 0),
    ).toBe(7500)
  })

  it('G09/G10/G62/G63 serves QR menu & WhatsApp catalog link over storefront publishable key', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/public/v1/catalog/qr-whatsapp?tableNumber=T4&whatsappPhone=%2B93700123456',
      headers: { 'Hisabche-Publishable-Key': PUB_TOKEN },
    })
    expect(res.statusCode, res.body).toBe(200)
    const data = res.json().data
    expect(data.tableNumber).toBe('T4')
    expect(data.qrMenuPath).toBe('/api/public/v1/catalog?table=T4')
    expect(data.whatsappUrl).toContain('https://wa.me/93700123456')
  })

  it('G15 schedules next subscription billing cycle and grace period', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/contracts/subscriptions/next-cycle',
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP },
      payload: {
        contractId: CONTRACT_ID,
        currentPeriodEnd: '2026-11-01',
        cycleDays: 30,
        graceDays: 5,
        amountMinor: 50000,
      },
    })
    expect(res.statusCode, res.body).toBe(200)
    expect(res.json().data.nextBillingDate).toBe('2026-12-01')
    expect(res.json().data.gracePeriodEnd).toBe('2026-12-06')
  })

  it('G68/G69 allocates capacity or places caller on waitlist', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/appointments/waitlist/allocate',
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP },
      payload: {
        capacity: 2,
        confirmedIds: ['c1', 'c2'],
        waitlistIds: ['w1'],
        applicantId: 'c3',
      },
    })
    expect(res.statusCode, res.body).toBe(200)
    expect(res.json().data.status).toBe('waitlisted')
    expect(res.json().data.waitlistIds).toEqual(['w1', 'c3'])
  })

  it('G46 calculates trade-in net credit and payable balance', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/exchange/trade-in/quote',
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP },
      payload: {
        newItemPriceMinor: 85000,
        tradeInAppraisedMinor: 30000,
        conditionDeductionMinor: 4000,
        currency: 'AFN',
      },
    })
    expect(res.statusCode, res.body).toBe(200)
    expect(res.json().data.netTradeInCreditMinor).toBe(26000)
    expect(res.json().data.customerPayableMinor).toBe(59000)
    expect(res.json().data.storeCreditOverpaymentMinor).toBe(0)
  })
})
