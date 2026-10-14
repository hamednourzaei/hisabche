// ============================================
// Regression guards for what the live audit of 14 Oct found on hisabche.com
// (.claude/LIVE-AUDIT-2026-10-14.md). Each case names its row.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { priceForInvoice } from '../lib/invoices/exchange-rate'
import { displayedInvoiceStatus } from '../lib/invoices/invoices-format'

const flat = (path: string) =>
  readFileSync(join(__dirname, '..', path), 'utf8')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line))
    .join('\n')
    .split(/\s+/)
    .join(' ')

describe('#58 — a product price on an invoice in another currency', () => {
  it('⚠️ is converted at the invoice rate: 80 afghani at 70 per dollar is 1.14 dollars, not 80', () => {
    expect(priceForInvoice('80', 'USD', 'AFN', 70)).toBe('1.14')
  })

  it('is left EMPTY without a rate — never copied, never guessed', () => {
    expect(priceForInvoice('80', 'USD', 'AFN', null)).toBe('')
  })

  it('is rounded to the invoice currency’s own digits (gold grams have three)', () => {
    // 1,000 afghani at 8,000 per gram = 0.125 g
    expect(priceForInvoice('1000', 'XAU', 'AFN', 8000)).toBe('0.125')
  })

  it('in the books currency it is the price itself', () => {
    expect(priceForInvoice('80', 'AFN', 'AFN', null)).toBe('80')
  })

  it('both ways onto a line use it: picking a product and scanning one', () => {
    const container = flat('components/ui/invoice-builder/containers/invoice-builder-container.tsx')
    expect(container).toContain('priceForInvoice(product.price, currency, bookCurrency, lineRate)')
    expect(container).toContain('const price = priceForInvoice(')
  })
})

describe('#7 — the status a person reads', () => {
  it('⚠️ 7,000 of 10,000 received is part-paid, not «پرداخت‌نشده»', () => {
    expect(displayedInvoiceStatus('pending', 7000, 10000)).toBe('partial')
  })
  it('nothing received stays pending; paid and cancelled are left alone', () => {
    expect(displayedInvoiceStatus('pending', 0, 10000)).toBe('pending')
    expect(displayedInvoiceStatus('completed', 10000, 10000)).toBe('completed')
    expect(displayedInvoiceStatus('cancelled', 5000, 10000)).toBe('cancelled')
  })
  it('the list and the invoice page both read it', () => {
    expect(flat('lib/invoices/invoices-mappers.ts')).toContain(
      "status: displayedInvoiceStatus(inv.status ?? '', inv.paid_amount, inv.total)",
    )
    expect(flat('components/ui/invoice-detail/containers/invoice-detail-container.tsx')).toContain(
      'status: displayedInvoiceStatus(',
    )
  })
})

describe('#10 — a payment method is a word, not `cash`', () => {
  it('the invoice’s payments panel translates the methods it knows', () => {
    const panel = flat('components/ui/invoice-detail/invoice-related-panel.tsx')
    expect(panel).toContain('[methodLabel(payment.method, t), payment.reference]')
    expect(panel).toContain('t(`payment.method.${method}`, method)')
  })
})

describe('#9 — the till chooser says the till’s name', () => {
  it('the names are read beside the open tills', () => {
    const hook = flat('hooks/use-till-choice.ts')
    expect(hook).toContain('const names = useTillLabels()')
    expect(hook).toContain('label: till.label || names.data?.labels[till.sessionId] || null,')
  })
})

describe('#78 — a new invoice does not inherit an old invoice’s column currency', () => {
  it('an untouched draft brings its money columns to the books currency', () => {
    const container = flat('components/ui/invoice-builder/containers/invoice-builder-container.tsx')
    const effect = container.slice(container.indexOf('const startedInBooks = useRef(false)'))
    expect(effect.slice(0, 2500)).toContain('column.currency !== bookCurrency')
    expect(effect.slice(0, 2500)).toContain('currency: bookCurrency as CurrencyCode,')
  })
})

describe('#15 — a purchase does not thank the reader for buying', () => {
  it('the thank-you line is a sale’s', () => {
    expect(flat('components/ui/invoice-detail/invoice-document.tsx')).toContain(
      "{isPurchase ? null : <p>{t('invoices.thankYou', 'از خرید شما سپاسگزاریم')}</p>}",
    )
  })
})
