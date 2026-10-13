// ============================================
// «صندوق» on a cash payment — one field, three forms.
//
// Asked for on 13 October: the person says which till a sale's cash goes into
// and which till a purchase is paid from; one shared piece, so the three forms
// cannot drift apart.
//
//   · the rule (which tills are offered) is pure and tested as behaviour
//   · the wiring (every form sends what the field shows) is read from source
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { keptTill, onlyTill, tillChoices } from '../lib/till/till-choices'

const ROOT = join(__dirname, '../../../..')
const read = (path: string) =>
  readFileSync(join(ROOT, path), 'utf8')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line))
    .join('\n')
    .split(/\s+/)
    .join(' ')
const messages = (lang: string) =>
  JSON.parse(readFileSync(join(ROOT, 'packages/i18n/messages', lang, 'common.json'), 'utf8')) as {
    payment: { till: Record<string, unknown> }
    invoiceDetail: Record<string, unknown>
  }

const tills = [
  { sessionId: 'afn-1', label: 'دخل جلو', status: 'open' },
  { sessionId: 'usd-1', label: 'دالر', currency: 'USD', status: 'open' },
  { sessionId: 'irr-1', label: 'تومان', currency: 'IRR', status: 'open' },
  { sessionId: 'afn-2', label: 'تعلیق', status: 'suspended' },
]

describe('which tills a cash payment may name', () => {
  it('a books-currency payment: only the open books-currency tills', () => {
    expect(tillChoices(tills, 'AFN', 'AFN').map((till) => till.id)).toEqual(['afn-1'])
    // No currency on the payment = the books currency.
    expect(tillChoices(tills, undefined, 'AFN').map((till) => till.id)).toEqual(['afn-1'])
  })

  it('a dollar payment: the dollar till, and the books-currency till AT THE RATE', () => {
    const choices = tillChoices(tills, 'USD', 'AFN')
    expect(choices.map((till) => [till.id, till.atRate])).toEqual([
      ['afn-1', true],
      ['usd-1', false],
    ])
  })

  it('⚠️ a toman payment is never offered a dollar till — there is no rate between them', () => {
    expect(tillChoices(tills, 'IRR', 'AFN').map((till) => till.id)).toEqual(['afn-1', 'irr-1'])
  })

  it('⚠️ a suspended till takes nothing, and a till with no name is still a till', () => {
    expect(tillChoices(tills, 'AFN', 'AFN').some((till) => till.id === 'afn-2')).toBe(false)
    expect(tillChoices([{ sessionId: 'x', label: '  ' }], 'AFN', 'AFN')).toEqual([
      { id: 'x', label: null, currency: 'AFN', atRate: false },
    ])
  })

  it('⚠️ until the books currency is known, nothing is offered — not everything', () => {
    expect(tillChoices(tills, 'AFN', undefined)).toEqual([])
  })

  it('⚠️ one till is offered already chosen; with two, the person says', () => {
    expect(onlyTill(tillChoices(tills, 'AFN', 'AFN'))).toBe('afn-1')
    expect(onlyTill(tillChoices(tills, 'USD', 'AFN'))).toBe('')
    expect(onlyTill([])).toBe('')
  })

  it('a till chosen earlier that left the list (closed, currency changed) is not sent', () => {
    const choices = tillChoices(tills, 'AFN', 'AFN')
    expect(keptTill(choices, 'afn-1')).toBe('afn-1')
    expect(keptTill(choices, 'usd-1')).toBe('')
    expect(keptTill(choices, '')).toBe('')
  })
})

describe('the state behind the field', () => {
  const hook = read('packages/ui/src/hooks/use-till-choice.ts')

  it('⚠️ «بدون صندوق» chosen by the person is KEPT — not overruled by the one open till', () => {
    expect(hook).toContain(
      'tillSessionId: picked === null ? onlyTill(choices) : keptTill(choices, picked),',
    )
    expect(hook).toContain('const [picked, setPicked] = useState<string | null>(null)')
  })

  it('a failed read is said — it is not «no tills»', () => {
    expect(hook).toContain('failed: Boolean(open.error),')
    const field = read('packages/ui/src/components/ui/till/till-select-field.tsx')
    expect(field.indexOf('{choice.failed ? (')).toBeGreaterThan(-1)
    expect(field).toContain('!choice.failed && !choice.isLoading && choice.choices.length === 0')
    expect(field).toContain('<SelectField')
    expect(field).not.toContain('<select')
    expect(field).not.toContain('eslint-disable')
  })
})

describe('every form that records cash against an invoice uses the one field', () => {
  it('the invoice being created: only when cash is paid, in the direction of the invoice', () => {
    const preview = read(
      'packages/ui/src/components/ui/invoice-builder/containers/invoice-preview-container.tsx',
    )
    expect(preview).toContain('const tillChoice = useTillChoice(currency)')
    expect(preview).toContain("const tillSessionId = cashPaid ? tillChoice.tillSessionId : ''")
    expect(preview).toContain('...(tillSessionId ? { tillSessionId } : {}),')
    expect(preview).toContain('{cashPaid ? (')
    expect(preview).toContain("direction={draft.transactionType === 'purchase' ? 'out' : 'in'}")
    // In the dependency list, or a stale till is sent.
    expect(preview).toContain('paymentBlocked, tillSessionId,')
  })

  it('a payment added to an invoice later: the till with cash, and the day’s rate if given', () => {
    const form = read('packages/ui/src/components/ui/invoice-detail/record-payment-form.tsx')
    expect(form).toContain("{method === 'cash' ? (")
    expect(form).toContain(
      "...(method === 'cash' && till.tillSessionId ? { tillSessionId: till.tillSessionId } : {}),",
    )
    expect(form).toContain(
      "...(foreign && rate.trim() !== '' ? { exchangeRate: parsedRate } : {}),",
    )
    const container = read(
      'packages/ui/src/components/ui/invoice-detail/containers/invoice-detail-container.tsx',
    )
    expect(container).toContain(
      '...(input.tillSessionId ? { tillSessionId: input.tillSessionId } : {}),',
    )
    expect(container).toContain(
      '...(input.exchangeRate ? { exchangeRate: input.exchangeRate } : {}),',
    )
    expect(container).toContain("paymentDirection={display.type === 'purchase' ? 'out' : 'in'}")
  })

  it('a customer’s payment', () => {
    const modal = read('packages/ui/src/components/ui/customers/PaymentModal.tsx')
    expect(modal).toContain('<TillSelectField')
    expect(modal).toContain('...(till.tillSessionId ? { tillSessionId: till.tillSessionId } : {}),')
  })

  it('⚠️ the api type names both fields — a field the type lacks is never sent', () => {
    const api = read('packages/api/src/hooks/payments.ts')
    expect(api).toContain('tillSessionId?: string')
    expect(api).toContain('exchangeRate?: number')
  })

  it.each(['fa', 'af', 'en'])('every word of it exists in %s', (lang) => {
    const words = messages(lang)
    for (const key of ['into', 'outOf', 'none', 'unnamed', 'failed', 'noneOpen', 'atRate']) {
      expect(typeof words.payment.till[key], key).toBe('string')
    }
    expect(typeof words.invoiceDetail.paymentRate).toBe('string')
    expect(typeof words.invoiceDetail.paymentRateHint).toBe('string')
  })
})
