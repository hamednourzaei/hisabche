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

describe('#74 — smart suggestions in the reader’s language and the books currency', () => {
  const server = readFileSync(
    join(__dirname, '../../../../backend/src/services/ai.service.ts'),
    'utf8',
  )
  const insights = server
    .slice(server.indexOf('async getInsights'))
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n')

  it('the server writes no sentence and no «افغانی» — it sends a code, numbers and the currency', () => {
    expect(insights).not.toContain('افغانی')
    expect(insights).toContain('currency: booksCurrency')
  })

  it('money sums are sales only, in the books currency only', () => {
    expect(insights.split(".eq('type', 'sale')").length).toBe(3)
    expect(insights).toContain('.filter(inBooks)')
  })

  it('every code has its words in all three languages', () => {
    for (const lang of ['fa', 'af', 'en']) {
      const messages = JSON.parse(
        readFileSync(join(__dirname, `../../../i18n/messages/${lang}/common.json`), 'utf8'),
      )
      for (const code of [
        'lowStock',
        'unpaid',
        'weekSales',
        'outstanding',
        'outOfStock',
        'stockValue',
        'averageSale',
        'tip',
      ]) {
        expect(messages.dashboard.insight[code].title, `${lang}.${code}`).toBeTruthy()
        expect(messages.dashboard.insight[code].text).toBeTruthy()
      }
    }
  })

  it('the panel writes the sentence from the code', () => {
    expect(flat('components/ui/dashboard/dashboard-view.tsx')).toContain(
      'const key = `dashboard.insight.${insight.code}`',
    )
  })
})

describe('#33 — a refusal keeps its status where the screens read it', () => {
  it('the client error carries response.status and response.data', () => {
    const client = readFileSync(join(__dirname, '../../../api/src/lib/client.ts'), 'utf8')
      .split(/\s+/)
      .join(' ')
    expect(client).toContain('response: { status: error.response.status, data: responseData }')
  })
})

describe('#43 / #75 — the activity feed', () => {
  it('is in time order, not unread-first', () => {
    const service = readFileSync(
      join(__dirname, '../../../../backend/src/services/activity.service.ts'),
      'utf8',
    )
    expect(service).toContain(
      'result.sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime())',
    )
    expect(service).not.toContain('if (a.unreadCount > 0 && b.unreadCount === 0) return -1')
  })
  it('a feed still loading is not «nothing happened»', () => {
    const hook = readFileSync(join(__dirname, '../../../api/src/hooks/activity.ts'), 'utf8')
    const useActivities = hook.slice(
      hook.indexOf('export function useActivities('),
      hook.indexOf('export function useInfiniteActivities'),
    )
    expect(useActivities).not.toMatch(/^\s*placeholderData:/m)
  })
})

describe('#49 — stock is valued at what it cost', () => {
  it('buy price, never sell price', () => {
    const domain = readFileSync(
      join(__dirname, '../../../../backend/src/services/inventory/stock-summary.domain.ts'),
      'utf8',
    )
    expect(domain).toContain('Math.max(quantity, 0) * (Number(row.buy_price) || 0)')
    expect(domain).not.toContain('row.sell_price')
  })
})

describe('#63 — the afghani is a word', () => {
  it('«افغانی» in Persian, «AFN» in English', async () => {
    const { currencySign, formatMoney } = await import('@hisabche/formatting')
    expect(currencySign('AFN', 'fa-IR')).toBe('افغانی')
    expect(currencySign('AFN', 'en')).toBe('AFN')
    expect(formatMoney(1000, 'AFN', 'en')).toBe('1,000 AFN')
  })
})
