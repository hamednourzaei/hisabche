// ============================================
// backend/src/__tests__/step-c-compliance-fleet-projects.test.ts
//
// STEP-C HTTP tests via buildServer() + app.inject():
//   - G33/G34      POST /api/tax/return/currency-summary
//   - G23/G24/X17  POST /api/financing/bank-match
//   - KYC/AML/X22  POST /api/fx/kyc/evaluate
//   - G49/G50/G100 POST /api/transport/fleet/compliance
//   - G22/G28      POST /api/contracts/guarantees/evaluate
//   - X16          POST /api/projects/:id/change-orders
//   - G80          POST /api/accounting/consolidated-summary
// ============================================

import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeDatabase, createFakeDb, fakeId } from './helpers/fake-supabase'

const db = new FakeDatabase()
const OWNER = { id: '11111111-1111-4111-8111-111111111111', token: 'token-owner' }
const SHOP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const PROJ = 'bbbbbbbb-0000-4000-8000-000000000001'

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
    { id: SHOP, name: 'Enterprise Group', base_currency: 'AFN', time_zone: 'Asia/Kabul' },
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

describe('STEP-C — Compliance, Banking, KYC, Fleet, Guarantees, Projects & Consolidation HTTP routes', () => {
  it('G33/G34 computes VAT return grouped strictly by currency', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/tax/return/currency-summary',
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP },
      payload: {
        lines: [
          { currency: 'afn', kind: 'sale', netMinor: 100000, vatMinor: 10000 },
          { currency: 'AFN', kind: 'purchase', netMinor: 40000, vatMinor: 4000 },
          { currency: 'USD', kind: 'sale', netMinor: 5000, vatMinor: 500 },
        ],
      },
    })
    expect(res.statusCode, res.body).toBe(200)
    expect(res.json().data).toEqual([
      { currency: 'AFN', outputVatMinor: 10000, inputVatMinor: 4000, netPayableMinor: 6000 },
      { currency: 'USD', outputVatMinor: 500, inputVatMinor: 0, netPayableMinor: 500 },
    ])
  })

  it('G23/G24/X17 auto-matches bank feed lines against open ledger candidates', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/financing/bank-match',
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP },
      payload: {
        maxDateDiffDays: 3,
        feed: [
          {
            id: 'f1',
            date: '2026-11-20',
            currency: 'AFN',
            amountMinor: 50000,
            reference: 'TRX-101',
          },
        ],
        candidates: [
          {
            id: 'c1',
            date: '2026-11-20',
            currency: 'AFN',
            amountMinor: 50000,
            reference: 'trx-101',
          },
        ],
      },
    })
    expect(res.statusCode, res.body).toBe(200)
    expect(res.json().data).toEqual([{ feedId: 'f1', candidateId: 'c1', confidence: 'exact_ref' }])
  })

  it('KYC/AML/X22 enforces FX daily cap and identity verification threshold', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/fx/kyc/evaluate',
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP },
      payload: {
        dailyAccumulatedMinor: 400000,
        requestedMinor: 150000,
        kycThresholdMinor: 500000,
        dailyCapMinor: 1000000,
        hasVerifiedIdDocument: false,
      },
    })
    expect(res.statusCode, res.body).toBe(200)
    expect(res.json().data).toEqual({ allowed: false, reason: 'KYC_DOCUMENT_REQUIRED' })
  })

  it('G49/G50/G100 evaluates fleet maintenance & insurance compliance', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/transport/fleet/compliance',
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP },
      payload: {
        currentKm: 120500,
        nextServiceKm: 120000,
        insuranceExpiresAt: '2027-01-01',
        asOfIso: '2026-11-25',
      },
    })
    expect(res.statusCode, res.body).toBe(200)
    expect(res.json().data).toEqual({ serviceDue: true, insuranceExpired: false, compliant: false })
  })

  it('G22/G28 & X16 & G80 evaluate guarantees, project change orders, and multi-currency consolidation', async () => {
    const g = await app.inject({
      method: 'POST',
      url: '/api/contracts/guarantees/evaluate',
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP },
      payload: {
        guaranteeNumber: 'BG-2026-01',
        amountMinor: 250000,
        contractValueMinor: 1000000,
        expiresAt: '2027-03-01',
        asOfIso: '2026-11-25',
      },
    })
    expect(g.statusCode, g.body).toBe(200)
    expect(g.json().data.coverageBps).toBe(2500)
    expect(g.json().data.active).toBe(true)

    const co = await app.inject({
      method: 'POST',
      url: `/api/projects/${PROJ}/change-orders`,
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP },
      payload: {
        title: 'Additional structural steel',
        originalBudgetMinor: 1000000,
        deltaMinor: 200000,
        estimatedCostDeltaMinor: 140000,
        approved: true,
      },
    })
    expect(co.statusCode, co.body).toBe(201)
    expect(co.json().data.revisedBudgetMinor).toBe(1200000)
    expect(co.json().data.netMarginDeltaMinor).toBe(60000)
    expect(co.json().data.status).toBe('approved')

    const cons = await app.inject({
      method: 'POST',
      url: '/api/accounting/consolidated-summary',
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP },
      payload: {
        entities: [
          {
            entityId: 'hq',
            currency: 'AFN',
            revenueMinor: 500000,
            expenseMinor: 300000,
            intercompanyEliminationMinor: 50000,
          },
          {
            entityId: 'branch',
            currency: 'AFN',
            revenueMinor: 200000,
            expenseMinor: 100000,
            intercompanyEliminationMinor: 0,
          },
          {
            entityId: 'dubai',
            currency: 'USD',
            revenueMinor: 10000,
            expenseMinor: 4000,
            intercompanyEliminationMinor: 0,
          },
        ],
      },
    })
    expect(cons.statusCode, cons.body).toBe(200)
    expect(cons.json().data).toEqual([
      {
        currency: 'AFN',
        grossRevenueMinor: 700000,
        consolidatedRevenueMinor: 650000,
        totalExpenseMinor: 400000,
        netProfitMinor: 250000,
      },
      {
        currency: 'USD',
        grossRevenueMinor: 10000,
        consolidatedRevenueMinor: 10000,
        totalExpenseMinor: 4000,
        netProfitMinor: 6000,
      },
    ])
  })
})
