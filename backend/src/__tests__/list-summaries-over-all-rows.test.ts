import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { summarizeInvoices } from '../services/invoices/invoice-list-summary.domain'
import { summarizeStock } from '../services/inventory/stock-summary.domain'

// Business figures on the invoice and warehouse pages used to be reduced in
// the browser over a page (≤ 100 rows). They are now computed server-side
// over every row. These tests pin the rules and the "every row" part.

const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')

const read = (rel: string) =>
  stripComments(
    readFileSync(join(__dirname, '..', rel), 'utf8')
      .split(String.fromCharCode(13))
      .join(''),
  )

describe('summarizeInvoices', () => {
  const now = new Date('2026-09-13T12:00:00Z')

  it('excludes cancelled, splits paid/pending, buckets by month', () => {
    const s = summarizeInvoices(
      [
        { total: 100, status: 'paid', date: '2026-09-01', created_at: null, currency: 'AFN' },
        { total: '50', status: 'pending', date: '2026-08-20', created_at: null, currency: 'AFN' },
        { total: 30, status: 'completed', date: null, created_at: '2026-08-02', currency: 'USD' },
        { total: 999, status: 'cancelled', date: '2026-09-02', created_at: null, currency: 'IRR' },
        { total: 7, status: 'partial', date: '2025-01-01', created_at: null, currency: null },
      ],
      now,
    )
    expect(s.count).toBe(4)
    expect(s.totalAmount).toBe(187)
    expect(s.paidAmount).toBe(130)
    expect(s.pendingAmount).toBe(57)
    expect(s.currentMonth).toEqual({
      count: 1,
      totalAmount: 100,
      pendingAmount: 0,
      paidAmount: 100,
    })
    expect(s.previousMonth).toEqual({
      count: 2,
      totalAmount: 80,
      pendingAmount: 50,
      paidAmount: 30,
    })
    expect(s.currencies).toEqual(['AFN', 'USD'])
  })

  it('counts more rows than one page', () => {
    const rows = Array.from({ length: 2500 }, () => ({
      total: 1,
      status: 'paid',
      date: '2026-09-01',
      created_at: null,
      currency: 'AFN',
    }))
    expect(summarizeInvoices(rows, now).totalAmount).toBe(2500)
  })
})

describe('summarizeStock', () => {
  it('values stock and classifies oversold as out, not low', () => {
    const s = summarizeStock([
      { quantity: 10, sell_price: 3, min_stock_level: 5 },
      { quantity: 4, sell_price: '2.5', min_stock_level: 5 },
      { quantity: -98, sell_price: 1, min_stock_level: 5 },
      { quantity: 0, sell_price: 9, min_stock_level: null },
      { quantity: 3, sell_price: 1, min_stock_level: null },
    ])
    expect(s).toEqual({ productCount: 5, totalValue: -55, lowStockCount: 2, outOfStockCount: 2 })
  })
})

describe('services page through every row for the summary', () => {
  for (const [file, method] of [
    ['services/invoice.service.ts', 'summarizeList'],
    ['services/product.service.ts', 'summarizeStock'],
  ] as const) {
    it(`${file} ${method} uses ordered .range paging, never .limit`, () => {
      const src = read(file)
      const start = src.indexOf(`private async ${method}(`)
      expect(start).toBeGreaterThan(-1)
      const body = src.slice(start, src.indexOf('\n  }\n', start))
      expect(body).toContain('.range(from, from + PAGE - 1)')
      expect(body).toContain(".order('id', { ascending: true })")
      expect(body).toContain('page.length < PAGE')
      expect(body).not.toContain('.limit(')
      expect(body).toContain(".eq('workspace_id', workspaceId)")
    })
  }
})
