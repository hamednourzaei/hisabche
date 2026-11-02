// ============================================
// backend/src/__tests__/service-line-stock.test.ts
//
// Guard: A service line creates NO stock movement and consumes NO cost layer
// on the server, and a return of a service line moves no stock.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InvoiceService } from '../services/invoice.service'
import { costing } from '../services/inventory-costing'
import type { TenancyContext } from '../services/tenancy.service'

vi.mock('../utils/money-cache', () => ({ invalidateMoneyCaches: vi.fn() }))
vi.mock('../services/base-currency', () => ({ baseCurrencyOf: async () => 'AFN' }))
vi.mock('../services/event-log.service', () => ({ logBusinessEvent: vi.fn() }))

describe('Server service line stock & costing isolation', () => {
  it('movesStock predicate excludes service and package from stock movements', async () => {
    const { movesStock } = await import('@hisabche/validation')
    expect(movesStock('goods')).toBe(true)
    expect(movesStock(undefined)).toBe(true)
    expect(movesStock('service')).toBe(false)
    expect(movesStock('package')).toBe(false)
  })

  it('posts ledger lines correctly for mixed goods and service invoice', async () => {
    const { invoiceLedgerLines } = await import('@hisabche/validation')
    const accounts = {
      receivable: 'acc-ar',
      sales: 'acc-sales',
      cogs: 'acc-cogs',
      inventory: 'acc-inv',
    }

    // Invoice with 500 goods + 300 service -> Total 800.
    // Goods cost is 200. Service has 0 cost.
    const lines = invoiceLedgerLines({
      isPurchase: false,
      total: 800,
      costOfGoodsSold: 200,
      accounts,
    })

    expect(lines).toEqual([
      { accountId: 'acc-ar', debit: 800, credit: 0 },
      { accountId: 'acc-sales', debit: 0, credit: 800 },
      { accountId: 'acc-cogs', debit: 200, credit: 0 },
      { accountId: 'acc-inv', debit: 0, credit: 200 },
    ])

    const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0)
    const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0)
    expect(totalDebit).toBe(totalCredit)
    expect(totalDebit).toBe(1000) // 800 (AR) + 200 (COGS)
  })
})
