// ============================================
// Three things on screen, asked for on 13 October:
//
//   · «سرمایه‌ی افتتاحیه» on a till — its own route, not an ordinary cash-in
//   · a payment's fee — its own field, validated against the direction
//   · each payment of an invoice says its till and its fee
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

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
    till: Record<string, unknown>
    invoiceDetail: Record<string, unknown>
  }

describe('«سرمایه‌ی افتتاحیه» on a till', () => {
  const view = read('packages/ui/src/components/ui/till/till-view.tsx')
  const container = read('packages/ui/src/components/ui/till/containers/till-container.tsx')

  it('⚠️ it goes to its OWN route — an ordinary cash-in would be booked as takings at close', () => {
    const branch = container.slice(container.indexOf("if (input.kind === 'opening_capital') {"))
    expect(branch.slice(0, 400)).toContain('await openingCapital.mutateAsync({')
    expect(branch.slice(0, 400)).toContain("into: 'till',")
    // The id made with the form is the one sent: a retry is the same entry.
    expect(branch.slice(0, 400)).toContain('entryId: input.movementId,')
    expect(read('packages/api/src/hooks/till.ts')).toContain(
      "await apiClient.post('/pos/opening-capital', body)",
    )
  })

  it('a till that counts in another currency is not offered it', () => {
    expect(view).toContain('{!session.currency || session.currency === bookCurrency ? (')
    expect(view).toContain("onClick={() => openMovementForm('opening_capital')}")
  })

  it('the same dialog: no direction and no reason asked, the amount still required', () => {
    expect(view).toContain("{movementKind === 'opening_capital' ? null : ( <Field")
    expect(view).toContain(
      "movementAmountMinor <= 0 || (movementKind !== 'opening_capital' && movementReason.trim() === '')",
    )
    // Still a dialog, still one — not a second form.
    expect(view.split('data-movement-till').length - 1).toBe(1)
  })

  it('the drawer ledger has a word for it (and for the two transfers the type had lost)', () => {
    const api = read('packages/api/src/hooks/till.ts')
    for (const kind of ['opening_capital', 'transfer_to_bank', 'transfer_from_bank']) {
      expect(api).toContain(`| '${kind}'`)
    }
  })
})

describe('the fee of a payment', () => {
  const form = read('packages/ui/src/components/ui/invoice-detail/record-payment-form.tsx')

  it('⚠️ on money received it must be less than the amount; on money paid it is on top', () => {
    expect(form).toContain("(direction === 'out' || parsedFee < parsed))")
    expect(form).toContain('if (!valid || !rateValid || !feeValid || isSubmitting) return')
    // Declared after the amount it is compared with.
    expect(form.indexOf('const feeValid =')).toBeGreaterThan(form.indexOf('const valid ='))
  })

  it('sent only when typed, and forwarded by the page', () => {
    expect(form).toContain("...(fee.trim() !== '' ? { feeAmount: parsedFee } : {}),")
    expect(
      read('packages/ui/src/components/ui/invoice-detail/containers/invoice-detail-container.tsx'),
    ).toContain('...(input.feeAmount ? { feeAmount: input.feeAmount } : {}),')
    expect(read('packages/api/src/hooks/payments.ts')).toContain('feeAmount?: number')
  })
})

describe('each payment of an invoice says its till and its fee', () => {
  const panel = read('packages/ui/src/components/ui/invoice-detail/invoice-related-panel.tsx')

  it('⚠️ said only when there is one — a payment with no till shows no till line', () => {
    expect(panel).toContain('{payment.tillSessionId ? (')
    expect(panel).toContain("payment.tillLabel || t('payment.till.unnamed', 'صندوق بی‌نام')")
    expect(panel).toContain('{payment.feeAmount ? (')
    expect(panel).toContain('{fmtMoney(payment.feeAmount)}')
  })
})

describe('the words', () => {
  it.each(['fa', 'af', 'en'])('every key exists in %s', (lang) => {
    const words = messages(lang)
    for (const key of ['opening_capital', 'opening_capital_hint', 'kind_opening_capital']) {
      expect(typeof words.till[key], key).toBe('string')
    }
    for (const key of [
      'paymentFee',
      'paymentFeeHintIn',
      'paymentFeeHintOut',
      'paymentFeeShort',
      'paymentTill',
    ]) {
      expect(typeof words.invoiceDetail[key], key).toBe('string')
    }
  })
})
