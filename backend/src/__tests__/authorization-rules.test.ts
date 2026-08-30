// ============================================
// Capability, record-level and field-level authorization.
//
// These are three separate questions with three different answers, and the
// tests are grouped that way on purpose. A seller may read invoices, only
// their own, and not the margin on them.
// ============================================

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  CAPABILITIES,
  can,
  capabilitiesOf,
  deniedFields,
  maskForRead,
  maskRowsForRead,
  mayTouchRecord,
  recordScope,
  rejectedWriteFields,
  roleAtLeast,
} from '../services/authorization'

describe('capabilities follow the shape of a shop', () => {
  it('a seller can sell and take money', () => {
    expect(can('seller', 'invoice.create')).toBe(true)
    expect(can('seller', 'payment.record')).toBe(true)
    expect(can('seller', 'customer.write')).toBe(true)
  })

  it('a seller cannot open the books', () => {
    expect(can('seller', 'ledger.read')).toBe(false)
    expect(can('seller', 'ledger.post')).toBe(false)
  })

  it('a seller cannot see what the shop paid for its stock', () => {
    expect(can('seller', 'inventory.read')).toBe(true)
    expect(can('seller', 'inventory.cost.read')).toBe(false)
  })

  it('a manager runs the books but cannot rewrite what is already reported', () => {
    expect(can('manager', 'ledger.post')).toBe(true)
    expect(can('manager', 'ledger.reverse')).toBe(false)
    expect(can('manager', 'ledger.lock_period')).toBe(false)
    expect(can('manager', 'inventory.configure')).toBe(false)
    expect(can('manager', 'invoice.delete')).toBe(false)
  })

  it('an owner holds every capability', () => {
    expect(capabilitiesOf('owner')).toHaveLength(CAPABILITIES.length)
  })

  it('ranks roles so a higher one never loses a capability', () => {
    for (const capability of CAPABILITIES) {
      if (can('seller', capability)) expect(can('manager', capability)).toBe(true)
      if (can('manager', capability)) expect(can('owner', capability)).toBe(true)
    }
  })

  it('compares roles by rank, not by name', () => {
    expect(roleAtLeast('owner', 'seller')).toBe(true)
    expect(roleAtLeast('seller', 'manager')).toBe(false)
  })
})

describe('record-level scope', () => {
  it('limits a seller to the invoices they raised', () => {
    expect(recordScope('seller', 'invoice', 'u1')).toEqual({ kind: 'own', userId: 'u1' })
  })

  it('limits a seller to the payments they took', () => {
    expect(recordScope('seller', 'payment', 'u1')).toEqual({ kind: 'own', userId: 'u1' })
  })

  it('keeps the shared catalogue shared', () => {
    // A shop where each seller saw a different half of the product list would
    // be unusable.
    expect(recordScope('seller', 'product', 'u1')).toEqual({ kind: 'all' })
    expect(recordScope('seller', 'customer', 'u1')).toEqual({ kind: 'all' })
  })

  it('gives a seller no ledger rows at all', () => {
    expect(recordScope('seller', 'journal_entry', 'u1')).toEqual({ kind: 'none' })
  })

  it('gives a manager and an owner every row in the workspace', () => {
    expect(recordScope('manager', 'invoice', 'u1')).toEqual({ kind: 'all' })
    expect(recordScope('owner', 'journal_entry', 'u1')).toEqual({ kind: 'all' })
  })

  it('lets an owner touch a row somebody else created', () => {
    const scope = recordScope('owner', 'invoice', 'owner-1')
    expect(mayTouchRecord(scope, { userId: 'someone-else' })).toBe(true)
  })

  it("refuses a seller another seller's row", () => {
    const scope = recordScope('seller', 'invoice', 'seller-1')
    expect(mayTouchRecord(scope, { userId: 'seller-2' })).toBe(false)
    expect(mayTouchRecord(scope, { userId: 'seller-1' })).toBe(true)
  })

  it('refuses everything when the scope is none', () => {
    expect(mayTouchRecord({ kind: 'none' }, { userId: 'anyone' })).toBe(false)
  })
})

describe('field-level authorization', () => {
  const product = { id: 'p1', name: 'A35', sellPrice: 12_000_000, buyPrice: 10_000_000 }

  it('hides the buy price from a seller', () => {
    const masked = maskForRead('seller', 'product', product)
    expect(masked).not.toHaveProperty('buyPrice')
    expect(masked.name).toBe('A35')
  })

  it('REMOVES the field rather than nulling it', () => {
    // A null buy price reads as "this product has no buy price", which is a
    // different and wrong statement.
    const masked = maskForRead('seller', 'product', product) as Record<string, unknown>
    expect('buyPrice' in masked).toBe(false)
  })

  it('shows the buy price to a manager', () => {
    expect(maskForRead('manager', 'product', product).buyPrice).toBe(10_000_000)
  })

  it('hides the margin on an invoice from a seller', () => {
    const invoice = {
      id: 'i1',
      total: 12_000_000,
      costOfGoodsSold: 10_000_000,
      grossProfit: 2_000_000,
    }
    const masked = maskForRead('seller', 'invoice', invoice)
    expect(masked).not.toHaveProperty('costOfGoodsSold')
    expect(masked).not.toHaveProperty('grossProfit')
    expect(masked.total).toBe(12_000_000)
  })

  it('hides the layer cost from a seller', () => {
    const layer = { id: 'l1', remainingQty: 5, unitCost: 9_000_000 }
    expect(maskForRead('seller', 'cost_layer', layer)).not.toHaveProperty('unitCost')
  })

  it('masks a whole list in one pass', () => {
    const masked = maskRowsForRead('seller', 'product', [product, { ...product, id: 'p2' }])
    expect(masked.every((row) => !('buyPrice' in row))).toBe(true)
  })

  it('leaves rows of an unrestricted entity untouched', () => {
    const row = { id: 'w1', name: 'Main warehouse' }
    expect(maskForRead('seller', 'warehouse', row)).toBe(row)
  })

  it('names the write fields a seller may not set', () => {
    expect(rejectedWriteFields('seller', 'product', { name: 'x', sellPrice: 5 })).toEqual([
      'sellPrice',
    ])
  })

  it('reports rejected writes rather than dropping them silently', () => {
    // Ignoring a field the user filled in tells them it was saved when it
    // was not.
    expect(rejectedWriteFields('seller', 'customer', { openingBalance: 500 })).toEqual([
      'openingBalance',
    ])
    expect(rejectedWriteFields('manager', 'customer', { openingBalance: 500 })).toEqual([])
  })

  it('covers both the camelCase and the snake_case spelling of a field', () => {
    // Services hand back mapped rows; some hand back raw ones. A policy that
    // knew only one spelling would leak through the other.
    expect(deniedFields('seller', 'product', 'read')).toEqual(
      expect.arrayContaining(['buyPrice', 'buy_price']),
    )
  })
})

describe('every financial route declares a capability', () => {
  // A source scan, because the defect this guards against is a NEW route added
  // months from now by copying an old one. The copy will have `authenticate`
  // and `requireWorkspaceContext` — those are visible — and will silently be
  // open to every member of the workspace.
  const ROUTES_DIR = join(__dirname, '..', 'routes')

  const FINANCIAL_ROUTES = [
    'accounting.routes.ts',
    'payments.routes.ts',
    'inventory-costing.routes.ts',
  ]

  it.each(FINANCIAL_ROUTES)('%s guards every route', (file) => {
    const source = readFileSync(join(ROUTES_DIR, file), 'utf8')

    // Count route registrations and capability declarations. Every registered
    // route must carry one.
    const registrations = source.match(/fastify\.(get|post|put|patch|delete)\(/g) ?? []
    const capabilities = source.match(/requireCapability\(/g) ?? []

    expect(registrations.length).toBeGreaterThan(0)
    expect(capabilities.length).toBe(registrations.length)
  })

  it('finds the route files it claims to scan', () => {
    const present = readdirSync(ROUTES_DIR)
    for (const file of FINANCIAL_ROUTES) expect(present).toContain(file)
  })
})
