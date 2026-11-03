// ============================================
// packages/ui/src/__tests__/customer-deposits-panel.test.ts
//
// The customer page's payments tab is where a person MEETS a deposit. These are
// source assertions on purpose: what is being checked is that the screen is
// wired to the real mutations and refuses the same things the server does, not
// that a helper returns a value.
//
// The rules this file guards:
//   · Apply and Refund call the canonical hooks — no local «success» before the
//     server answers;
//   · the refund reason is trimmed and bounded here as well as in the column;
//   · nothing may exceed what is left of the deposit;
//   · an UNKNOWN currency is never rendered through `Money`'s two-decimal
//     fallback, and no action is offered for that row;
//   · a pending receipt is visible, and «posted» is never assumed;
//   · every key the panel asks for exists in fa, af and en.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const REPO = join(__dirname, '..', '..', '..', '..')
const UI = join(REPO, 'packages', 'ui', 'src')

/** Comments stripped first: a rule named in a comment is not an implementation. */
function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\/.*/g, '')
}

const panel = () => code(join(UI, 'components', 'ui', 'customers', 'customer-deposits-panel.tsx'))

describe('the deposit panel on the customer page', () => {
  it('is mounted in the payments tab, not left as an orphan component', () => {
    const detail = code(join(UI, 'components', 'ui', 'customers', 'customer-detail-view.tsx'))
    expect(detail).toContain('CustomerDepositsPanel')
    expect(detail).toContain('<CustomerDepositsPanel')
  })

  it('reads the customer deposits and sends real apply/refund mutations', () => {
    const src = panel()
    expect(src).toContain('useCustomerDeposits(')
    expect(src).toContain('useApplyOrderDeposit()')
    expect(src).toContain('useRefundOrderDeposit()')
    expect(src).toContain('usePostOrderDepositReceipt()')

    // The apply carries the invoice it settles and the amount, under the key the
    // server deduplicates on.
    expect(src).toContain('invoiceId,')
    expect(src).toContain('amountMinor,')
    // The refund carries the reason the column demands.
    expect(src).toContain('reason,')
  })

  it('refuses an over-refund and an over-apply before the request is sent', () => {
    const src = panel()
    expect(src).toContain('amountMinor > deposit.remainingMinor')
    expect(src).toContain("t('errorInsufficient')")
  })

  it('trims the refund reason and enforces the same 3..500 bounds as the database', () => {
    const src = panel()
    expect(src).toContain('reason.trim()')
    expect(src).toContain('trimmed.length < 3')
    expect(src).toContain('trimmed.length > 500')
    expect(src).toContain("t('errorReason')")
    expect(src).toContain("t('errorReasonLong')")
  })

  it('never renders an unknown currency through the 2-decimal fallback', () => {
    const src = panel()
    // The old shape — `currency ?? undefined` — is exactly the silent 100× bug.
    expect(src).not.toContain('currency ?? undefined')
    expect(src).toContain("t('errorCurrencyUnknown')")
    // And no action is offered on such a row.
    expect(src).toContain('digits !== null')
    expect(src).toContain('disabled={!canMove}')
  })

  it('keeps a pending operation distinguishable from a posted one', () => {
    const src = panel()
    expect(src).toContain('pendingSync')
    expect(src).toContain("t('pendingSync')")
    // A receipt that never reached the ledger can be booked from here.
    expect(src).toContain("deposit.status === 'pending_posting'")
    expect(src).toContain("t('postReceipt')")
    // Every status the server can return has a sentence of its own.
    for (const status of [
      'pending_posting',
      'posting_unknown',
      'available',
      'partially_used',
      'fully_used',
    ]) {
      expect(src, status).toContain(status)
    }
  })

  it('turns a refusal code into the sentence a person can act on', () => {
    const src = panel()
    for (const code of [
      'DEPOSIT_INSUFFICIENT_BALANCE',
      'DEPOSIT_APPLY_EXCEEDS_INVOICE',
      'DEPOSIT_CURRENCY_MISMATCH',
      'DEPOSIT_CUSTOMER_MISMATCH',
      'DEPOSIT_PENDING_POSTING',
      'DEPOSIT_REFUND_NOT_POSTED',
      'DEPOSIT_REFUND_REASON_REQUIRED',
      'DEPOSIT_IDEMPOTENCY_CONFLICT',
      'DEPOSIT_CURRENCY_UNKNOWN',
      'DEPOSIT_ACCOUNTS_MISSING',
    ]) {
      expect(src, code).toContain(code)
    }
  })

  it('uses no hardcoded currency and no raw <select>', () => {
    const src = panel()
    expect(src).not.toMatch(/'AFN'|'USD'/)
    expect(src).not.toContain('<select')
    expect(src).toContain('SelectField')
  })

  it('asks only for keys that exist in fa, af and en', () => {
    const src = panel()
    const literal = new Set<string>()
    for (const match of src.matchAll(/\bt\('([a-zA-Z0-9_]+)'\)/g)) literal.add(match[1]!)
    expect(literal.size).toBeGreaterThan(20)

    for (const lang of ['fa', 'af', 'en']) {
      const messages = JSON.parse(
        readFileSync(join(REPO, 'packages/i18n/messages', lang, 'common.json'), 'utf8'),
      ) as { customerDeposits?: Record<string, unknown> }
      const namespace = messages.customerDeposits
      expect(namespace, `${lang}: customerDeposits missing`).toBeDefined()
      for (const key of literal) {
        expect(namespace, `${lang}: ${key}`).toHaveProperty(key)
      }
      const status = namespace?.status as Record<string, unknown> | undefined
      expect(Object.keys(status ?? {}).sort(), `${lang}: status keys`).toEqual([
        'available',
        'fully_used',
        'partially_used',
        'pending_posting',
        'posting_unknown',
      ])
    }
  })
})
