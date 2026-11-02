// ============================================
// The returns core on screen:
//   · every sentence the returns forms use exists in fa, af AND en (a missing key throws and
//     takes the whole page to the error boundary)
//   · the invoice page lists a return with what the shop kept, where the refund stands, and
//     «ثبت بازپرداخت» only while there is money left to pay back
//   · the form uses the shared rules (previewReturn, returnPolicyFor) — it holds no copy of them
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { InvoiceRelatedPanel } from '../components/ui/invoice-detail/invoice-related-panel'

const ROOT = join(__dirname, '..', '..', '..', '..')
const messages = (lang: string) =>
  JSON.parse(readFileSync(join(ROOT, 'packages', 'i18n', 'messages', lang, 'common.json'), 'utf8'))

const SOURCES = [
  'components/ui/invoices/invoice-returns-dialog.tsx',
  'components/ui/invoices/invoice-return-refund-dialog.tsx',
  'components/ui/invoices/invoice-return-refund-fields.tsx',
].map((file) => readFileSync(join(__dirname, '..', file), 'utf8'))

/** Every `tr('key', …)` and `t(\`invoices.key…\`)` literal of the returns screens. */
function keysUsed(): string[] {
  const keys = new Set<string>()
  for (const source of SOURCES) {
    for (const match of source.matchAll(/\btr\(\s*'([A-Za-z]+)'/g)) keys.add(match[1]!)
    for (const match of source.matchAll(/\[\s*'([A-Za-z]+)',\s*'[^']*'\s*\]/g)) keys.add(match[1]!)
    for (const match of source.matchAll(/,\s*'([A-Za-z]+)',\s*'/g)) keys.add(match[1]!)
  }
  return [...keys]
}

describe('translations of the returns screens', () => {
  const used = keysUsed().filter(
    (key) => !['common', 'payment'].includes(key) && /^[a-z][A-Za-z]+$/.test(key),
  )

  it('found the keys the screens use', () => {
    expect(used.length).toBeGreaterThan(40)
    expect(used).toEqual(
      expect.arrayContaining(['deductionsTitle', 'refundTitle', 'summaryCredit']),
    )
  })

  for (const lang of ['fa', 'af', 'en']) {
    it(`${lang}: every key exists under invoices`, () => {
      const invoices = messages(lang).invoices as Record<string, unknown>
      const missing = used.filter((key) => typeof invoices[key] !== 'string')
      expect(missing).toEqual([])
    })
  }

  it('the three languages carry exactly the same new keys', () => {
    const own = (lang: string) =>
      Object.keys(messages(lang).invoices as Record<string, unknown>)
        .filter((key) => /^(condition|deduction|summary|refund|returnErr|returns[A-Z])/.test(key))
        .sort()
    expect(own('af')).toEqual(own('fa'))
    expect(own('en')).toEqual(own('fa'))
  })
})

describe('the form takes its rules from the shared core', () => {
  const dialog = SOURCES[0]!
  it('previews with previewReturn and defaults the destination with returnPolicyFor', () => {
    expect(dialog).toContain('previewReturn(')
    expect(dialog).toContain('returnPolicyFor(')
    expect(dialog).toContain('refundableMinor(')
  })

  it('does not re-derive the money by hand', () => {
    const code = dialog.replace(/\/\/.*$/gm, '')
    // no percentage arithmetic, no tax share, no deduction sum in the component
    expect(code).not.toMatch(/\*\s*percent|\/\s*100\b/)
    expect(code).not.toContain('taxTotal *')
  })

  it('pays the refund through the one hook, and asks which till for cash', () => {
    expect(dialog).toContain('useRefundInvoiceReturn')
    expect(SOURCES[2]!).toContain('TillSelectField')
  })
})

describe('the returns list on the invoice page', () => {
  afterEach(cleanup)

  const base = {
    t: (key: string, fallback?: string) => fallback ?? key,
    fmtMoney: (value: number) => String(value),
    fmtDate: (value: string) => value,
    currency: 'USD',
    isLoading: false,
    payments: [],
    journalEntry: null,
    allocatedTotal: 0,
    storedPaidAmount: 0,
  }
  const entry = {
    id: 'ret-1',
    returnNumber: 'R-1',
    returnDate: '2026-11-01',
    returnType: 'sale_return' as const,
    total: 160,
    deduction: 60,
    refundStatus: 'partial' as const,
    refunded: 40,
    refundable: 120,
  }

  it('shows the credit, what the shop kept, what was paid back and what is left', () => {
    render(<InvoiceRelatedPanel {...base} returns={[entry]} />)
    expect(screen.getByText(/160 USD/)).toBeTruthy()
    expect(screen.getByText(/: 60 USD/)).toBeTruthy()
    expect(screen.getByText(/: 40 USD/)).toBeTruthy()
    expect(screen.getByText(/: 120 USD/)).toBeTruthy()
    expect(screen.getByText('بازپرداخت جزئی')).toBeTruthy()
  })

  it('offers «ثبت بازپرداخت» only while money is left, and hands back the return id', () => {
    const onRefundReturn = vi.fn()
    render(<InvoiceRelatedPanel {...base} returns={[entry]} onRefundReturn={onRefundReturn} />)
    fireEvent.click(screen.getByRole('button', { name: 'ثبت بازپرداخت' }))
    expect(onRefundReturn).toHaveBeenCalledWith('ret-1')
  })

  it('a fully refunded return has no button, and a return with no cash due says so', () => {
    const onRefundReturn = vi.fn()
    const { rerender } = render(
      <InvoiceRelatedPanel
        {...base}
        returns={[{ ...entry, refundStatus: 'refunded', refunded: 160, refundable: 0 }]}
        onRefundReturn={onRefundReturn}
      />,
    )
    expect(screen.queryByRole('button', { name: 'ثبت بازپرداخت' })).toBeNull()
    expect(screen.getByText('بازپرداخت شد')).toBeTruthy()

    rerender(
      <InvoiceRelatedPanel
        {...base}
        returns={[{ ...entry, refundStatus: 'not_due', refunded: 0, refundable: 0 }]}
        onRefundReturn={onRefundReturn}
      />,
    )
    expect(screen.queryByRole('button', { name: 'ثبت بازپرداخت' })).toBeNull()
    expect(screen.getByText('بدون بازپرداخت نقدی')).toBeTruthy()
  })

  it('a purchase return shows no refund state (the supplier pays us, not the other way)', () => {
    render(
      <InvoiceRelatedPanel
        {...base}
        returns={[{ ...entry, returnType: 'purchase_return', refundStatus: undefined }]}
        onRefundReturn={vi.fn()}
      />,
    )
    expect(screen.queryByText('بازپرداخت جزئی')).toBeNull()
    expect(screen.queryByRole('button', { name: 'ثبت بازپرداخت' })).toBeNull()
  })
})
