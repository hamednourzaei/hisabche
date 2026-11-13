import { describe, expect, it, vi, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Owner decision (12 Nov 2026, V61 open decision 1): the seller of an invoice
 * is a MEMBER of the business; the issuer is the seller unless another member
 * is named; the owner sees every seller.
 */

const memberRow = vi.hoisted(() => ({ value: null as unknown, error: null as unknown }))

vi.mock('../db', () => {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => ({ data: memberRow.value, error: memberRow.error }),
  }
  return { supabase: { from: () => chain } }
})

import {
  isMissingSellerColumn,
  resolveSellerOverride,
  summarizeSalesBySeller,
} from '../services/invoice-seller'

const ctx = { workspaceId: 'ws-1', userId: 'issuer', role: 'owner' } as const
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const read = (...p: string[]) => fs.readFileSync(path.resolve(__dirname, '..', ...p), 'utf8')

describe('summarizeSalesBySeller', () => {
  const toMinor = (row: { total: number | string | null }, currency: string) =>
    Math.round(Number(row.total) * (currency === 'USD' ? 100 : 1))

  it('credits the stored seller, else the issuer, per currency', () => {
    const { totals, unattributed } = summarizeSalesBySeller(
      [
        { user_id: 'issuer', seller_user_id: 'ali', currency: 'AFN', total: 1000 },
        { user_id: 'issuer', seller_user_id: null, currency: 'AFN', total: 300 },
        { user_id: 'issuer', currency: 'USD', total: 12.5 },
        { user_id: 'ali', seller_user_id: null, currency: null, total: 200 },
      ],
      'AFN',
      toMinor,
    )
    expect(unattributed).toBe(0)
    expect(totals).toEqual([
      { sellerUserId: 'ali', currency: 'AFN', invoiceCount: 2, totalMinor: 1200 },
      { sellerUserId: 'issuer', currency: 'AFN', invoiceCount: 1, totalMinor: 300 },
      { sellerUserId: 'issuer', currency: 'USD', invoiceCount: 1, totalMinor: 1250 },
    ])
  })

  it('never adds two currencies, and never credits a row with nobody', () => {
    const { totals, unattributed } = summarizeSalesBySeller(
      [
        { user_id: null, seller_user_id: null, currency: 'AFN', total: 999 },
        { user_id: 'a', currency: 'AFN', total: 1 },
        { user_id: 'a', currency: 'USD', total: 1 },
      ],
      'AFN',
      toMinor,
    )
    expect(unattributed).toBe(1)
    expect(totals.map((t) => t.currency)).toEqual(['AFN', 'USD'])
  })
})

describe('resolveSellerOverride — a request, proven on the server', () => {
  beforeEach(() => {
    memberRow.value = null
    memberRow.error = null
  })

  it('stores nothing when the issuer sold it', async () => {
    expect(await resolveSellerOverride(ctx, undefined)).toBeNull()
    expect(await resolveSellerOverride(ctx, 'issuer')).toBeNull()
  })

  it('accepts a current member of this business', async () => {
    memberRow.value = { user_id: 'ali', has_access: true, suspended_at: null }
    expect(await resolveSellerOverride(ctx, 'ali')).toBe('ali')
  })

  it.each([
    ['not a member', null],
    ['no access', { has_access: false, suspended_at: null }],
    ['suspended', { has_access: true, suspended_at: '2026-11-01T00:00:00Z' }],
  ])('refuses %s', async (_name, row) => {
    memberRow.value = row
    await expect(resolveSellerOverride(ctx, 'stranger')).rejects.toThrow(
      'INVOICE_SELLER_NOT_A_MEMBER',
    )
  })

  it('a failed read is an error, never «not a member»', async () => {
    memberRow.error = { message: 'boom', code: '57014' }
    await expect(resolveSellerOverride(ctx, 'ali')).rejects.toThrow('Failed to check the seller')
  })
})

describe('isMissingSellerColumn', () => {
  it('only the seller column, not any missing column', () => {
    expect(
      isMissingSellerColumn({ code: '42703', message: 'column "seller_user_id" does not exist' }),
    ).toBe(true)
    expect(
      isMissingSellerColumn({
        code: 'PGRST204',
        message: "Could not find the 'seller_user_id' column",
      }),
    ).toBe(true)
    expect(
      isMissingSellerColumn({
        code: '42703',
        message: 'column "client_request_id" does not exist',
      }),
    ).toBe(false)
    expect(isMissingSellerColumn(null)).toBe(false)
  })
})

describe('wiring', () => {
  const route = strip(read('routes', 'invoice.routes.ts'))
  const service = strip(read('services', 'invoice.service.ts'))

  it('the route forwards sellerUserId (a field this mapping does not name never arrives)', () => {
    expect(route).toContain('sellerUserId: body.sellerUserId as string')
    expect(route).toContain("'/api/invoices/sales-by-seller'")
    expect(route).toContain('err instanceof InvoiceSellerNotInstalledError')
  })

  it('the service proves the seller before a number is taken and names the column only for an override', () => {
    expect(service).toContain('await resolveSellerOverride(ctx, data.sellerUserId)')
    expect(service).toContain('...(sellerOverride ? { seller_user_id: sellerOverride } : {})')
    const missing = service.indexOf('if (isMissingSellerColumn(invoiceError))')
    const idem = service.indexOf('if (invoiceError && clientRequestId)')
    expect(missing).toBeGreaterThan(0)
    expect(missing).toBeLessThan(idem)
  })

  it('the migration back-fills nothing and adds no commission', () => {
    const sql = read('..', '..', 'docs', 'invoices-seller-01-migration.sql')
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n')
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS seller_user_id uuid')
    expect(sql).not.toMatch(/\bUPDATE\b/i)
    expect(sql).not.toMatch(/commission/i)
  })
})
