// ============================================
// One invoice table for four document kinds.
//
// The owner's mandate: /invoices exposes exactly three filters (all, purchases
// & sales, advance purchases & sales) over ONE shared table. Pre-sale and
// pre-purchase were previously a second DataTable swapped in by the container;
// these tests pin the single table, the three groups, the legacy-link mapping,
// and the finalize action (which may only appear on an unposted advance).
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  advanceMatchesSearch,
  filterFromLegacyType,
  legacyTypeFor,
  type InvoiceListRow,
} from '../lib/invoices/invoice-list-row'
import type { CustomerDepositRecord } from '@hisabche/api'

function source(...parts: string[]): string {
  return readFileSync(join(__dirname, '..', 'components', 'ui', 'invoices', ...parts), 'utf8')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n')
}

const advance: CustomerDepositRecord = {
  id: '0d9a7c6e-4b1f-4e2a-9c3d-5f6a7b8c9d10',
  orderId: '0d9a7c6e-4b1f-4e2a-9c3d-5f6a7b8c9d10',
  customerId: 'aa11bb22-cc33-dd44-ee55-ff6677889900',
  amountMinor: 250000,
  appliedMinor: 0,
  refundedMinor: 0,
  remainingMinor: 250000,
  currency: 'AFN',
  paymentMethod: 'cash',
  postingStatus: 'pending',
  journalEntryId: null,
  sourceType: 'pre_sale',
  note: 'سفارش زمستانی',
  document: {
    version: 1,
    currency: 'AFN',
    lines: [
      {
        productId: null,
        name: 'پالتو',
        quantity: 2,
        unit: 'عدد',
        unitPriceMinor: 125000,
        discountMinor: 0,
        totalMinor: 250000,
      },
    ],
    subtotalMinor: 250000,
    discountMinor: 0,
    taxRate: 0,
    taxMinor: 0,
    totalMinor: 250000,
    dueDate: null,
    notes: null,
  },
  status: 'pending_posting',
  pendingSync: false,
  createdAt: '2026-11-20T10:00:00.000Z',
}

const row: InvoiceListRow = {
  rowType: 'advance',
  id: advance.id,
  kind: 'pre_sale',
  advance,
  partyName: 'احمد رضایی',
}

describe('the page has three groups, not five tabs', () => {
  const view = source('invoices-view.tsx')

  it('draws exactly one table', () => {
    expect(view.match(/<DataTable/g)).toHaveLength(1)
  })

  it('offers all / trading / advances', () => {
    expect(view).toContain("key: 'all'")
    expect(view).toContain("key: 'trading'")
    expect(view).toContain("key: 'advances'")
    expect(view).toContain('invoices.filterTrading')
    expect(view).toContain('invoices.filterAdvances')
  })

  it('never offers a pre-sale or pre-purchase segment', () => {
    expect(view).not.toMatch(/key:\s*'pre_sale'/)
    expect(view).not.toMatch(/key:\s*'pre_purchase'/)
  })

  it('no longer swaps in a second advances table', () => {
    const container = source('containers', 'invoices-container.tsx')
    expect(container).not.toContain('AdvancesContainer')
    expect(container).toContain('advanceRows={visibleAdvanceRows}')
  })
})

describe('an old ?type= link opens the right group', () => {
  it('maps each legacy type', () => {
    expect(filterFromLegacyType('sale')).toEqual({ filter: 'trading', advanceKinds: [] })
    expect(filterFromLegacyType('purchase')).toEqual({ filter: 'trading', advanceKinds: [] })
    expect(filterFromLegacyType('pre_sale')).toEqual({
      filter: 'advances',
      advanceKinds: ['pre_sale'],
    })
    expect(filterFromLegacyType('pre_purchase')).toEqual({
      filter: 'advances',
      advanceKinds: ['pre_purchase'],
    })
    expect(filterFromLegacyType(null)).toEqual({ filter: 'all', advanceKinds: [] })
  })

  it('writes the group back', () => {
    expect(legacyTypeFor('trading')).toBe('sale')
    expect(legacyTypeFor('advances')).toBe('advances')
    expect(legacyTypeFor('all')).toBeNull()
  })
})

describe('advance search reads the facts the row has', () => {
  it('matches the party', () => {
    expect(advanceMatchesSearch(row, 'احمد')).toBe(true)
  })

  it('matches a line name', () => {
    expect(advanceMatchesSearch(row, 'پالتو')).toBe(true)
  })

  it('matches the note and the id', () => {
    expect(advanceMatchesSearch(row, 'زمستانی')).toBe(true)
    expect(advanceMatchesSearch(row, advance.id)).toBe(true)
  })

  it('does not match an unrelated word', () => {
    expect(advanceMatchesSearch(row, 'کفش')).toBe(false)
  })

  it('an empty query keeps every row', () => {
    expect(advanceMatchesSearch(row, '   ')).toBe(true)
  })
})

describe('finalize is an existing, idempotent ledger action', () => {
  const actions = source('invoice-row-actions.tsx')

  it('uses the deposit receipt route, not a new posting path', () => {
    expect(actions).toContain('usePostOrderDepositReceipt')
    expect(actions).toContain('POST /orders/:id/deposits/:depositId/post')
  })

  it('is offered only while the receipt is unposted', () => {
    expect(actions).toContain("advance.status === 'pending_posting'")
    expect(actions).toContain("advance.status === 'posting_unknown'")
  })

  it('is capability-gated in the UI and re-checked by the route', () => {
    expect(actions).toContain("capabilities.can('invoice.create')")
  })

  it('an advance names itself as its document', () => {
    expect(actions).toContain('orderId: advance.id')
    expect(actions).toContain('depositId: advance.id')
  })
})
