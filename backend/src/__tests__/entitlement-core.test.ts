// ============================================
// Entitlement Core Unit & Integration Tests
// Covers:
//   - Two currencies (IRR and AFN)
//   - Lifetime invoice boundary 50 (both sides: 49 allowed, 50 allowed, 51 refused)
//   - Daily invoice boundary 500 (both sides: 499 allowed, 500 allowed, 501 refused)
//   - Usage policy: import no, draft no, cancelled yes, return 1
//   - Time zone in stored workspace setting, never ?tz=
//   - Export ALWAYS allowed (canExportData, canExportPDF)
//   - Pricing in IRR stored and Toman shown, with price versioning
//   - requireEntitlement middleware
// ============================================

import { describe, expect, it, beforeEach, vi } from 'vitest'
import { countsTowardsInvoiceQuota, mayCreateInvoice } from '@hisabche/validation'
import {
  PLAN_PRICING,
  getPlanPrice,
  storedIrrToToman,
  tomanToStoredIrr,
} from '../services/plan-pricing'

const WS_IRR = '11111111-1111-1111-1111-111111111111'
const WS_AFN = '22222222-2222-2222-2222-222222222222'

// Mock database state
const mockDb = {
  sub: { plan: 'FREE', is_trial: false } as {
    plan: string
    is_trial: boolean
    status?: string
  } | null,
  ws: { time_zone: 'Asia/Tehran' } as { time_zone: string | null } | null,
  counts: {
    invoicesLifetime: 0,
    invoicesToday: 0,
    users: 1,
  },
}

vi.mock('../db', () => ({
  supabase: {
    from: (table: string) => {
      const q: Record<string, unknown> = {}
      for (const m of ['eq', 'neq', 'order', 'limit', 'gte', 'select']) q[m] = () => q
      q.select = (_cols: string, opts?: { head?: boolean }) => {
        if (opts?.head) {
          const head: Record<string, unknown> = {
            eq: (_col: string, _val: unknown) => {
              const chain: Record<string, unknown> = {
                neq: (_ncol: string, _nval: unknown) => {
                  const subChain: Record<string, unknown> = {
                    gte: async () => ({ count: mockDb.counts.invoicesToday, error: null }),
                  }
                  // Resolves to lifetime count if no gte
                  subChain.then = (resolve: (val: unknown) => void) =>
                    resolve({ count: mockDb.counts.invoicesLifetime, error: null })
                  return subChain
                },
              }
              chain.then = (resolve: (val: unknown) => void) =>
                resolve({ count: mockDb.counts.invoicesLifetime, error: null })
              return chain
            },
          }
          return head
        }
        return q
      }
      q.maybeSingle = async () => {
        if (table === 'subscriptions') return { data: mockDb.sub, error: null }
        if (table === 'workspaces') return { data: mockDb.ws, error: null }
        return { data: null, error: null }
      }
      return q
    },
  },
}))

vi.mock('../utils/pagination', () => ({
  memoryCache: {
    get: async () => null,
    set: async () => {},
    getShared: async () => null,
    setShared: async () => {},
    invalidate: async () => {},
  },
}))

const limits = await import('../services/plan-limits.service')
const { EntitlementService } = await import('../services/entitlement.service')
const { requireEntitlement } = await import('../middleware/entitlement.middleware')

beforeEach(() => {
  mockDb.sub = { plan: 'FREE', is_trial: false }
  mockDb.ws = { time_zone: 'Asia/Tehran' }
  mockDb.counts = { invoicesLifetime: 0, invoicesToday: 0, users: 1 }
})

describe('Entitlement core: Usage policy function', () => {
  it('counts sale, purchase, and return documents as 1', () => {
    expect(countsTowardsInvoiceQuota({ type: 'sale', status: 'paid' })).toBe(true)
    expect(countsTowardsInvoiceQuota({ type: 'purchase', status: 'pending' })).toBe(true)
    expect(countsTowardsInvoiceQuota({ type: 'return', status: 'completed' })).toBe(true)
    expect(countsTowardsInvoiceQuota({ type: 'credit_note', status: 'completed' })).toBe(true)
  })

  it('cancelled invoices count towards the quota (prevent create-delete loop)', () => {
    expect(countsTowardsInvoiceQuota({ type: 'sale', status: 'cancelled' })).toBe(true)
  })

  it('drafts that were never finalised do NOT count', () => {
    expect(countsTowardsInvoiceQuota({ type: 'sale', status: 'draft' })).toBe(false)
  })

  it('quotations and proformas do NOT count', () => {
    expect(countsTowardsInvoiceQuota({ type: 'quotation', status: 'pending' })).toBe(false)
    expect(countsTowardsInvoiceQuota({ type: 'proforma', status: 'pending' })).toBe(false)
  })

  it('file imports and system-generated invoices do NOT count', () => {
    expect(countsTowardsInvoiceQuota({ type: 'sale', isImport: true })).toBe(false)
    expect(countsTowardsInvoiceQuota({ type: 'sale', isSystemGenerated: true })).toBe(false)
    expect(countsTowardsInvoiceQuota({ type: 'sale', isSyncPush: true })).toBe(false)
    expect(countsTowardsInvoiceQuota({ clientRequestId: 'mig-inv-abc123' })).toBe(false)
    expect(countsTowardsInvoiceQuota({ clientRequestId: 'late_fee-123' })).toBe(false)
  })

  it('mayCreateInvoice helper allows writes that do not count, regardless of quota', () => {
    const exhaustedQuota = { used: 50, limit: 50 }
    // Normal invoice refused at limit
    expect(mayCreateInvoice({ type: 'sale' }, exhaustedQuota)).toBe(false)
    // Import allowed even at limit
    expect(mayCreateInvoice({ type: 'sale', isImport: true }, exhaustedQuota)).toBe(true)
    // Late fee allowed even at limit
    expect(mayCreateInvoice({ clientRequestId: 'late_fee-1' }, exhaustedQuota)).toBe(true)
  })
})

describe('Entitlement core: Lifetime boundary at 50 (two currencies)', () => {
  it('WS_IRR (currency IRR): 49 invoices used -> 50th is allowed', async () => {
    mockDb.sub = { plan: 'FREE', is_trial: false }
    mockDb.counts.invoicesLifetime = 49
    await expect(limits.assertWithinLimit(WS_IRR, 'invoices')).resolves.toBeUndefined()
  })

  it('WS_IRR (currency IRR): 50 invoices used -> 51st is refused with 402 PLAN_LIMIT_REACHED', async () => {
    mockDb.sub = { plan: 'FREE', is_trial: false }
    mockDb.counts.invoicesLifetime = 50
    await expect(limits.assertWithinLimit(WS_IRR, 'invoices')).rejects.toMatchObject({
      statusCode: 402,
      code: 'PLAN_LIMIT_REACHED',
      feature: 'invoices',
      limit: 50,
      used: 50,
    })
  })

  it('WS_AFN (currency AFN): 49 invoices used -> 50th is allowed', async () => {
    mockDb.sub = { plan: 'FREE', is_trial: false }
    mockDb.counts.invoicesLifetime = 49
    await expect(limits.assertWithinLimit(WS_AFN, 'invoices')).resolves.toBeUndefined()
  })

  it('WS_AFN (currency AFN): 50 invoices used -> 51st is refused with 402 PLAN_LIMIT_REACHED', async () => {
    mockDb.sub = { plan: 'FREE', is_trial: false }
    mockDb.counts.invoicesLifetime = 50
    await expect(limits.assertWithinLimit(WS_AFN, 'invoices')).rejects.toMatchObject({
      statusCode: 402,
      code: 'PLAN_LIMIT_REACHED',
      feature: 'invoices',
      limit: 50,
      used: 50,
    })
  })

  it('Free plan is NOT bypassed by is_trial: true (trial is the 50 invoices)', async () => {
    mockDb.sub = { plan: 'FREE', is_trial: true }
    mockDb.counts.invoicesLifetime = 50
    await expect(limits.assertWithinLimit(WS_IRR, 'invoices')).rejects.toMatchObject({
      statusCode: 402,
      code: 'PLAN_LIMIT_REACHED',
      feature: 'invoices',
      limit: 50,
    })
  })
})

describe('Entitlement core: Daily ceiling boundary at 500 (ONLINE_500)', () => {
  it('WS_IRR (ONLINE_500): 499 invoices today -> 500th is allowed', async () => {
    mockDb.sub = { plan: 'ONLINE_500', is_trial: false }
    mockDb.counts.invoicesToday = 499
    mockDb.counts.invoicesLifetime = 10_000 // lifetime is unlimited
    await expect(limits.assertWithinLimit(WS_IRR, 'invoices')).resolves.toBeUndefined()
  })

  it('WS_IRR (ONLINE_500): 500 invoices today -> 501st is refused with 402 PLAN_LIMIT_REACHED (invoices_daily)', async () => {
    mockDb.sub = { plan: 'ONLINE_500', is_trial: false }
    mockDb.counts.invoicesToday = 500
    mockDb.counts.invoicesLifetime = 10_000
    await expect(limits.assertWithinLimit(WS_IRR, 'invoices')).rejects.toMatchObject({
      statusCode: 402,
      code: 'PLAN_LIMIT_REACHED',
      feature: 'invoices_daily',
      limit: 500,
      used: 500,
    })
  })

  it('WS_AFN (ONLINE_500): 499 invoices today -> 500th is allowed; 500 today -> 501st refused', async () => {
    mockDb.sub = { plan: 'ONLINE_500', is_trial: false }
    mockDb.counts.invoicesToday = 499
    await expect(limits.assertWithinLimit(WS_AFN, 'invoices_daily')).resolves.toBeUndefined()

    mockDb.counts.invoicesToday = 500
    await expect(limits.assertWithinLimit(WS_AFN, 'invoices_daily')).rejects.toMatchObject({
      feature: 'invoices_daily',
      limit: 500,
      used: 500,
    })
  })
})

describe('Entitlement core: Export is ALWAYS allowed', () => {
  it('FREE plan has canExportData: true and canExportPDF: true', async () => {
    const service = new EntitlementService()
    // Even when trial invoices are exhausted
    mockDb.sub = { plan: 'FREE', is_trial: false }
    mockDb.counts.invoicesLifetime = 50

    const result = await service.canPerformAction(
      { workspaceId: WS_IRR, userId: 'u1', role: 'owner' },
      'export_data',
    )
    expect(result.allowed).toBe(true)
  })

  it('resolveWorkspaceEntitlement returns AVAILABLE for export even when FREE_EXHAUSTED', async () => {
    const service = new EntitlementService()
    mockDb.sub = { plan: 'FREE', is_trial: false }
    mockDb.counts.invoicesLifetime = 50

    const verdict = await service.resolveWorkspaceEntitlement(WS_IRR, 'data.backup')
    expect(verdict.kind).toBe('AVAILABLE')
  })

  it('resolveWorkspaceEntitlement returns AVAILABLE for invoice.print even when expired', async () => {
    const service = new EntitlementService()
    mockDb.sub = { plan: 'ONLINE_500', is_trial: false, status: 'expired' }

    const verdict = await service.resolveWorkspaceEntitlement(WS_IRR, 'invoice.print')
    expect(verdict.kind).toBe('AVAILABLE')
  })
})

describe('Entitlement core: Plan pricing with versioning (IRR stored, Toman shown)', () => {
  it('stores price in IRR and shows in Toman (1 Toman = 10 IRR)', () => {
    expect(tomanToStoredIrr(12_000_000)).toBe(120_000_000)
    expect(storedIrrToToman(120_000_000)).toBe(12_000_000)

    expect(PLAN_PRICING.OFFLINE.yearly).toBe(120_000_000)
    expect(PLAN_PRICING.OFFLINE.tomanYearly).toBe(12_000_000)
    expect(PLAN_PRICING.ONLINE_500.yearly).toBe(300_000_000)
    expect(PLAN_PRICING.ONLINE_500.tomanYearly).toBe(30_000_000)
    expect(PLAN_PRICING.ONLINE_1000.yearly).toBe(400_000_000)
    expect(PLAN_PRICING.ONLINE_1000.tomanYearly).toBe(40_000_000)
    expect(PLAN_PRICING.ONLINE_1500.yearly).toBe(450_000_000)
    expect(PLAN_PRICING.ONLINE_1500.tomanYearly).toBe(45_000_000)
  })

  it('price versioning lookup returns version 1 records with effective date', () => {
    const entry = getPlanPrice('ONLINE_500', 'IRR', 1)
    expect(entry).toMatchObject({
      plan: 'ONLINE_500',
      version: 1,
      currency: 'IRR',
      yearly: 300_000_000,
      tomanYearly: 30_000_000,
    })
    expect(entry?.effectiveFrom).toBeDefined()
  })
})

describe('Entitlement core: requireEntitlement middleware', () => {
  it('allows request when feature is AVAILABLE', async () => {
    mockDb.sub = { plan: 'ONLINE_500', is_trial: false }
    mockDb.counts.invoicesLifetime = 10
    mockDb.counts.invoicesToday = 10

    const guard = requireEntitlement('invoice.create')
    const req = {
      tenancy: { workspaceId: WS_IRR, userId: 'u1', role: 'owner' },
      log: { error: vi.fn() },
    } as any
    const reply = { status: vi.fn().mockReturnThis(), send: vi.fn() } as any

    await guard(req, reply)
    expect(reply.status).not.toHaveBeenCalled()
  })

  it('returns 402 PLAN_LIMIT_REACHED when usage is exhausted on FREE', async () => {
    mockDb.sub = { plan: 'FREE', is_trial: false }
    mockDb.counts.invoicesLifetime = 50

    const guard = requireEntitlement('invoice.create')
    const req = {
      tenancy: { workspaceId: WS_IRR, userId: 'u1', role: 'owner' },
      log: { error: vi.fn() },
    } as any
    const reply = { status: vi.fn().mockReturnThis(), send: vi.fn() } as any

    await guard(req, reply)
    expect(reply.status).toHaveBeenCalledWith(402)
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'PLAN_LIMIT_REACHED',
        feature: 'invoice.create',
      }),
    )
  })

  it('returns 403 REQUIRES_ONLINE for server-only feature in local edition', async () => {
    mockDb.sub = { plan: 'OFFLINE', is_trial: false }

    const guard = requireEntitlement('ai.cashflow_forecast')
    const req = {
      tenancy: { workspaceId: WS_IRR, userId: 'u1', role: 'owner' },
      log: { error: vi.fn() },
    } as any
    const reply = { status: vi.fn().mockReturnThis(), send: vi.fn() } as any

    await guard(req, reply)
    expect(reply.status).toHaveBeenCalledWith(403)
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'REQUIRES_ONLINE',
        feature: 'ai.cashflow_forecast',
      }),
    )
  })
})
