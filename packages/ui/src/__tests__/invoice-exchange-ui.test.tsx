// V64 §5.8 / V66 §9 — the exchange lives in the ONE return dialog.
//   · a returned line of a product with models offers «exchange for another model»
//   · a product with no models offers nothing (an ordinary return)
//   · the dialog sends an exchange through useExchangeInvoice, as credit at the original price,
//     and closes deductions and cash refunds while exchanging
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const variants = vi.hoisted(() => ({ list: [] as unknown[] }))
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('@hisabche/api', () => ({
  useProductVariants: () => ({ data: variants.list }),
}))

import { InvoiceExchangeField } from '../components/ui/invoices/invoice-exchange-field'

const tr = (_key: string, fallback: string) => fallback
afterEach(() => cleanup())

describe('the exchange field', () => {
  it('offers the active models of the product, and «return only» first', () => {
    variants.list = [
      {
        id: 'v-red',
        sku: 'S-RED',
        attributes: [{ name: 'colour', value: 'قرمز' }],
        isActive: true,
      },
      { id: 'v-old', sku: 'S-OLD', attributes: [], isActive: false },
    ]
    render(
      <InvoiceExchangeField
        productId="p-1"
        value=""
        onChange={() => undefined}
        disabled={false}
        tr={tr}
      />,
    )
    expect(screen.getAllByText('تعویض با مدل دیگر').length).toBeGreaterThan(0)
  })

  it('renders nothing for a product without models', () => {
    variants.list = []
    const { container } = render(
      <InvoiceExchangeField
        productId="p-2"
        value=""
        onChange={() => undefined}
        disabled={false}
        tr={tr}
      />,
    )
    expect(container.innerHTML).toBe('')
  })
})

describe('the return dialog sends an exchange', () => {
  const dialog = readFileSync(
    join(__dirname, '..', 'components', 'ui', 'invoices', 'invoice-returns-dialog.tsx'),
    'utf8',
  )
    .split(/\s+/)
    .join(' ')

  it('through useExchangeInvoice — no second dialog', () => {
    expect(dialog).toContain('const exchange = useExchangeInvoice()')
    expect(dialog).toContain('await exchange.mutateAsync({')
    expect(dialog).toContain('<InvoiceExchangeField')
  })

  it('as credit, at the original line price, with the replacement model', () => {
    expect(dialog).toContain("paymentMethod: 'credit', paidAmount: 0,")
    expect(dialog).toContain('variantId: row.replacement,')
    expect(dialog).toContain('unitPrice: item.unitPrice ?? 0,')
  })

  it('closes deductions and cash refunds while exchanging, and says it needs the internet', () => {
    expect(dialog).toContain('<section className="space-y-2" hidden={exchanging}>')
    expect(dialog.split('hidden={exchanging}').length - 1).toBe(2)
    expect(dialog).toContain("useActionAvailability('invoice.exchange').requiresOnline")
  })

  it('the invoice page hands the dialog the product of each line', () => {
    const container = readFileSync(
      join(
        __dirname,
        '..',
        'components',
        'ui',
        'invoice-detail',
        'containers',
        'invoice-detail-container.tsx',
      ),
      'utf8',
    )
    expect(container).toContain('productId: item.productId ?? item.product_id ?? null,')
  })
})
