import { encodeReceipt } from '../escpos'
import { renderInvoiceHtml, type PrintableInvoice, type PrintLabels } from '../invoice-template'

const invoice: PrintableInvoice = {
  invoiceNumber: 'INV-1',
  date: '2026-01-01',
  customerName: 'Ali <script>',
  lines: [{ productName: 'Flour', quantity: 2, unitPrice: 100, totalPrice: 200 }],
  subtotal: '200',
  total: '200',
  paid: '0',
  currencySign: '؋',
}

const labels: PrintLabels = {
  title: 'Invoice',
  invoiceNumber: 'No.',
  customer: 'Customer',
  date: 'Date',
  product: 'Product',
  quantity: 'Qty',
  unitPrice: 'Price',
  amount: 'Amount',
  subtotal: 'Subtotal',
  total: 'Total',
  paid: 'Paid',
}

describe('A4 template', () => {
  it('escapes customer-supplied text', () => {
    const html = renderInvoiceHtml(invoice, labels, 'rtl')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('honours the writing direction', () => {
    expect(renderInvoiceHtml(invoice, labels, 'rtl')).toContain('dir="rtl"')
    expect(renderInvoiceHtml(invoice, labels, 'ltr')).toContain('dir="ltr"')
  })

  it('renders every line item', () => {
    expect(renderInvoiceHtml(invoice, labels, 'ltr')).toContain('Flour')
  })
})

describe('ESC/POS encoder', () => {
  it('emits base64 that starts with the initialise command', () => {
    const base64 = encodeReceipt(invoice, labels)
    const bytes = Buffer.from(base64, 'base64')

    expect(bytes[0]).toBe(0x1b)
    expect(bytes[1]).toBe(0x40)
  })

  it('ends with the paper cut command', () => {
    const bytes = Buffer.from(encodeReceipt(invoice, labels), 'base64')
    expect(Array.from(bytes.subarray(-4))).toEqual([0x1d, 0x56, 0x42, 0x00])
  })
})
