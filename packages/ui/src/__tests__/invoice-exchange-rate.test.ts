// ============================================
// «نرخ تبدیل» on an invoice whose currency is not the books currency.
//
// The server refuses such an invoice without a rate
// (backend/src/__tests__/invoice-exchange-rate.test.ts). This is the screen's
// half: it asks, it does not send without an answer, and it never invents 1.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { exchangeRateOf, needsExchangeRate } from '../lib/invoices/exchange-rate'

describe('exchangeRateOf', () => {
  it('a rate is said as a pair, and becomes books-currency per one unit', () => {
    // 1,000,000 toman = 1,570 afghani → one toman is 0.00157 afghani.
    expect(exchangeRateOf('1000000', '1570')).toBeCloseTo(0.00157, 10)
    expect(exchangeRateOf('1', '750')).toBe(750)
  })

  it('reads the digits a person types in Persian, with separators', () => {
    expect(exchangeRateOf('۱', '۷۵۰')).toBe(750)
    expect(exchangeRateOf('1,000,000', '1,570')).toBeCloseTo(0.00157, 10)
  })

  it('⚠️ nothing typed, a zero, a negative or a word is NOT a rate — never 1', () => {
    for (const [from, to] of [
      ['1', ''],
      ['', '750'],
      ['0', '750'],
      ['1', '0'],
      ['1', '-5'],
      ['1', 'abc'],
    ] as const) {
      expect(exchangeRateOf(from, to), `${from} = ${to}`).toBeNull()
    }
  })
})

describe('needsExchangeRate', () => {
  it('only when both are known and differ — whichever of them is the afghani', () => {
    expect(needsExchangeRate('IRR', 'AFN')).toBe(true)
    expect(needsExchangeRate('AFN', 'USD')).toBe(true)
    expect(needsExchangeRate('AFN', 'AFN')).toBe(false)
    // The books currency has not arrived: the screen does not guess, and the
    // server still refuses if one was needed.
    expect(needsExchangeRate('IRR', undefined)).toBe(false)
  })
})

describe('the screens', () => {
  const read = (path: string) =>
    readFileSync(join(__dirname, '..', path), 'utf8')
      .split('\n')
      .filter((line) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line))
      .join('\n')
      .split(/\s+/)
      .join(' ')
  const preview = read('components/ui/invoice-builder/containers/invoice-preview-container.tsx')
  const builder = read('components/ui/invoice-builder/containers/invoice-builder-container.tsx')
  const field = read('components/ui/invoice-builder/invoice-exchange-rate.tsx')

  it('⚠️ a foreign-currency invoice without a rate cannot be confirmed — from the button or from code', () => {
    expect(preview).toContain('const rateMissing = foreign && exchangeRate === null')
    expect(preview).toContain(
      'if (issues.length || items.length === 0 || paymentBlocked || rateMissing) return',
    )
    expect(
      preview.split('disabled={issues.length > 0 || paymentBlocked || rateMissing}').length - 1,
    ).toBe(2)
  })

  it('the rate is sent only when there is one to send, and only on a foreign-currency invoice', () => {
    expect(preview).toContain('...(foreign && exchangeRate !== null ? { exchangeRate } : {}),')
    expect(preview).not.toContain('exchangeRate: 1')
  })

  it('the field is on both steps, shown only when the currencies differ', () => {
    // Right under «ارز فاکتور» (live audit #59), through the panel's rate slot.
    expect(builder).toContain(
      'rateSlot={ bookCurrency && needsExchangeRate(currency, bookCurrency) ? (',
    )
    expect(read('components/ui/invoice-builder/customer-panel.tsx')).toContain('{rateSlot}')
    expect(preview).toContain('{foreign && bookCurrency ? ( <InvoiceExchangeRate')
    expect(field).toContain("data-invoice-rate={missing ? 'missing' : 'set'}")
    // No currency is named in the field itself: both come from the invoice and the books.
    for (const code of ["'AFN'", "'IRR'", "'USD'"]) expect(field, code).not.toContain(code)
  })

  it('⚠️ a new invoice starts in the books currency; one being written keeps its own', () => {
    expect(builder).toContain(
      'if (!untouched) return if (currency !== bookCurrency) { handleCurrencyChange(bookCurrency as CurrencyCode)',
    )
    expect(builder).toContain('if (startedInBooks.current || !bookCurrency) return')
    // The effect is placed AFTER the function it names (its dependency array is
    // read during render; before the definition that is a ReferenceError).
    expect(builder.indexOf('const handleCurrencyChange = useCallback(')).toBeLessThan(
      builder.indexOf('const startedInBooks = useRef(false)'),
    )
  })

  it('the scan button sits with «add row» and «add column» — and is still there on a phone', () => {
    expect(builder).toContain('scanSlot={ <CameraScanButton')
    expect(read('components/ui/invoice-builder/grid/grid-toolbar.tsx')).toContain('{scanSlot}')
    const page = read('components/ui/invoice-builder/invoice-builder-page.tsx')
    expect(page).toContain('stockWarning={ <> {rateSlot} {scanSlot} {stockWarning} </> }')
    // One button, not two dialogs listening to the same scanner.
    expect(builder.split('<CameraScanButton').length - 1).toBe(1)
  })

  it('a rate belongs to one invoice: a cleared draft has none', () => {
    const store = readFileSync(
      join(__dirname, '../../../store/src/slices/invoice-draft.slice.ts'),
      'utf8',
    )
    const blank = store.slice(store.indexOf('function blankDraft'))
    expect(blank.slice(0, blank.indexOf('\n}\n'))).toContain("exchangeRateTo: '',")
  })

  it.each(['fa', 'af', 'en'])('the sentences exist in %s', (lang) => {
    const all = JSON.parse(
      readFileSync(join(__dirname, '../../../i18n/messages', lang, 'common.json'), 'utf8'),
    ) as { invoiceBuilder: { rate: Record<string, unknown> } }
    for (const key of ['title', 'hint', 'amount', 'required']) {
      expect(typeof all.invoiceBuilder.rate[key], key).toBe('string')
    }
  })
})
