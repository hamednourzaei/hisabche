// ============================================
// The customer's credit limit is enforced where an invoice is made (V53 OD-3 = C).
//
//   • block mode refuses a sale that takes the customer past the limit;
//   • passing it needs the `credit.override` permission AND a stated reason, and is recorded;
//   • off / warn, a customer without a limit, non-sales and imports are never refused;
//   • a failed read is an error, not «no limit».
//
// `assertWithinCreditLimit` is driven directly with a stubbed receivable, so each refusal is a statement
// about the real branch that raised it.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

let mode: 'off' | 'warn' | 'block' = 'block'
let limit: number | null = 1000
let receivable = 600

vi.mock('../db', () => {
  const q: any = new Proxy({}, { get: () => () => q })
  const supabase = { from: () => q, rpc: async () => ({ data: null, error: null }) }
  return { supabase, default: supabase }
})
vi.mock('../services/credit-limit', () => ({
  creditLimitModeOf: async () => mode,
  creditLimitOf: async () => limit,
}))

import { InvoiceService } from '../services/invoice.service'

const manager = { workspaceId: 'w-1', userId: 'u-1', role: 'manager' } as any
const seller = { workspaceId: 'w-1', userId: 'u-2', role: 'seller' } as any

const check = (
  ctx: any,
  over: Partial<{
    customerId: string | null
    type: string
    owing: number
    skip: boolean
    overrideReason: string | null
  }> = {},
) => {
  const service = new InvoiceService() as any
  service.payments = { getPartySummary: async () => ({ receivable }) }
  return service.assertWithinCreditLimit(ctx, {
    customerId: 'c-1',
    type: 'sale',
    owing: 500,
    skip: false,
    overrideReason: null,
    ...over,
  }) as Promise<null | { reason: string; overLimit: number; limit: number }>
}

beforeEach(() => {
  mode = 'block'
  limit = 1000
  receivable = 600
})

describe('assertWithinCreditLimit', () => {
  it('lets a sale inside the limit through', async () => {
    expect(await check(seller, { owing: 300 })).toBeNull()
  })

  it('exactly at the limit is inside it', async () => {
    expect(await check(seller, { owing: 400 })).toBeNull()
  })

  it('refuses a sale over the limit in block mode', async () => {
    await expect(check(seller)).rejects.toThrow(/over by 100/)
  })

  it('a reason alone does not pass the limit — the permission decides', async () => {
    await expect(check(seller, { overrideReason: 'مشتری قدیمی' })).rejects.toThrow(
      'CREDIT_OVERRIDE_FORBIDDEN',
    )
  })

  it('the permission alone does not pass the limit — a reason is required', async () => {
    await expect(check(manager)).rejects.toThrow(/over by 100/)
    await expect(check(manager, { overrideReason: '  ' })).rejects.toThrow(/over by 100/)
  })

  it('a one-character reason is not a reason', async () => {
    await expect(check(manager, { overrideReason: 'x' })).rejects.toThrow(
      'CREDIT_OVERRIDE_REASON_REQUIRED',
    )
  })

  it('permission + reason passes, and returns the record the caller audits', async () => {
    const record = await check(manager, { overrideReason: 'تأیید تلفنی مدیر' })
    expect(record).toEqual({
      reason: 'تأیید تلفنی مدیر',
      overLimit: 100,
      projectedReceivable: 1100,
      limit: 1000,
    })
  })

  it('a cash-only customer (limit 0) is refused any credit', async () => {
    limit = 0
    receivable = 0
    await expect(check(seller, { owing: 1 })).rejects.toThrow(/CASH_ONLY_CUSTOMER/)
  })

  it('warn mode only warns on the screen — the server still needs the override', async () => {
    mode = 'warn'
    await expect(check(seller)).rejects.toThrow(/over by 100/)
    await expect(check(seller, { overrideReason: 'ok then' })).rejects.toThrow(
      'CREDIT_OVERRIDE_FORBIDDEN',
    )
    expect(await check(manager, { overrideReason: 'ok then' })).not.toBeNull()
  })

  it('off mode never refuses', async () => {
    mode = 'off'
    expect(await check(seller)).toBeNull()
  })

  it('no limit set means no limit', async () => {
    limit = null
    expect(await check(seller, { owing: 9_999_999 })).toBeNull()
  })

  it('a sale paid in full leaves nothing owing and is never refused', async () => {
    expect(await check(seller, { owing: 0 })).toBeNull()
  })

  it.each([
    ['a purchase', { type: 'purchase' }],
    ['a sale with no customer', { customerId: null }],
    ['an import / system invoice', { skip: true }],
  ])('%s is not checked', async (_name, over) => {
    expect(await check(seller, over)).toBeNull()
  })
})

describe('wiring', () => {
  const strip = (text: string) =>
    text
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
      .split(/\s+/)
      .join(' ')
  const service = strip(readFileSync(join(__dirname, '../services/invoice.service.ts'), 'utf8'))
  const route = strip(readFileSync(join(__dirname, '../routes/invoice.routes.ts'), 'utf8'))

  it('create checks the limit before a number is used up', () => {
    const check = service.indexOf('await this.assertWithinCreditLimit(')
    const number = service.indexOf('await this.generateInvoiceNumber()')
    expect(check).toBeGreaterThan(-1)
    expect(check).toBeLessThan(number)
  })

  it('an override is written to the invoice history', () => {
    expect(service).toContain("action: 'credit_limit_overridden'")
  })

  it('the route passes only a reason; the service decides who may', () => {
    expect(route).toContain('creditOverrideReason')
    expect(route).not.toContain('credit.override')
  })
})
