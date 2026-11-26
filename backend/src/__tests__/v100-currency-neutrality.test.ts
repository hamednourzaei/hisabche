import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeDatabase, createFakeDb } from './helpers/fake-supabase'

const db = new FakeDatabase()
const users = new Map<string, { id: string }>()

vi.mock('../db', () => createFakeDb(db, users))

import { BUDGET_CURRENCIES, budgetCurrencies, CURRENCY_CODES } from '@hisabche/validation'
import { FRACTION_DIGITS, currencySign, fractionDigits, formatMoney } from '@hisabche/formatting'

let AIService: typeof import('../services/ai.service').AIService

beforeAll(async () => {
  const mod = await import('../services/ai.service')
  AIService = mod.AIService
})

describe('V100 currency & precious-metal neutrality', () => {
  beforeEach(() => {
    db.rows('workspaces').length = 0
    db.rows('customers').length = 0
    db.rows('invoices').length = 0
  })

  it('supports currencies and precious metals across BUDGET_CURRENCIES without hardcoded AFN restriction', () => {
    expect(BUDGET_CURRENCIES).toEqual(CURRENCY_CODES)
    expect(budgetCurrencies('USD')).toContain('XAU')
    expect(budgetCurrencies('IRT')).toContain('XAG')
    expect(FRACTION_DIGITS.XAU).toBe(3)
    expect(FRACTION_DIGITS.USD).toBe(2)
    expect(FRACTION_DIGITS.IRT).toBe(0)
    expect(currencySign('XAU', 'fa')).toBe('g')
    expect(fractionDigits('XAG')).toBe(3)
    expect(formatMoney(12.345, 'XAU', 'en-US')).toContain('12.345')
  })

  it('AIService sales and customer answers follow workspace base_currency and never hardcode AFN', async () => {
    const wsId = 'ws-gold-0000-0000-0000-000000000001'
    const today = new Date().toISOString().slice(0, 10)
    db.seed('workspaces', [{ id: wsId, name: 'Gold House', base_currency: 'USD' }])
    db.seed('customers', [
      { id: 'c1', workspace_id: wsId, full_name: 'Nora', opening_balance: 0, is_active: true },
    ])
    db.seed('invoices', [
      {
        id: 'inv1',
        workspace_id: wsId,
        type: 'sale',
        status: 'unpaid',
        customer_id: 'c1',
        date: today,
        total: 150,
        paid_amount: 0,
        currency: 'USD',
      },
      {
        id: 'inv2',
        workspace_id: wsId,
        type: 'sale',
        status: 'unpaid',
        customer_id: 'c1',
        date: today,
        total: 999999,
        paid_amount: 0,
        currency: 'IRR',
      },
    ])

    const ai = new AIService()
    const salesRes = await ai.processQuery(
      { workspaceId: wsId, userId: 'u1', role: 'owner' },
      { question: 'فروش امروز چقدر بود؟', context: 'sales', language: 'fa' },
    )
    expect(salesRes.answer).not.toContain('افغانی')
    expect(salesRes.answer).toContain('$')
    expect(salesRes.data.todayTotal).toBe(150)

    const customerRes = await ai.processQuery(
      { workspaceId: wsId, userId: 'u1', role: 'owner' },
      { question: 'بدهکاران اصلی چه کسانی هستند؟', context: 'general', language: 'fa' },
    )
    expect(customerRes.answer).not.toContain('افغانی')
    expect(customerRes.answer).toContain('$')
    expect(customerRes.data.totalUnpaid).toBe(150)
  })
})
