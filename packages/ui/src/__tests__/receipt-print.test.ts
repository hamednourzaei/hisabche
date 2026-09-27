// Receipt printing: the HTML receipt, ESC/POS control bytes, and the adapter
// that keeps «printed» / «failed» / «dialog» apart from the invoice itself.
import { afterEach, describe, expect, it, vi } from 'vitest'

import { escPosControl } from '../lib/print/escpos-control'
import { printReceipt } from '../lib/print/print-receipt'
import { registerReceiptPrinterHost, type ReceiptPrinterHost } from '../lib/print/printer-host'
import { DEFAULT_PRINTER_SETTINGS, sanitizePrinterSettings } from '../lib/print/printer-settings'
import { renderReceiptHtml, type ReceiptLabels } from '../lib/print/receipt-html'

const labels: ReceiptLabels = {
  invoice: 'فاکتور',
  date: 'تاریخ',
  customer: 'مشتری',
  item: 'کالا',
  quantity: 'تعداد',
  price: 'فی',
  amount: 'مبلغ',
  subtotal: 'جمع',
  discount: 'تخفیف',
  tax: 'مالیات',
  total: 'قابل پرداخت',
  paid: 'پرداخت‌شده',
  remaining: 'مانده',
}
const data = {
  businessName: 'فروشگاه <b>کریمی</b>',
  invoiceNumber: 'INV-2026-0042',
  date: '۵ مهر ۱۴۰۵',
  customerName: 'احمد',
  lines: [{ name: 'چای سبز', quantity: '۲', unitPrice: '۶۰٬۰۰۰', total: '۱۲۰٬۰۰۰' }],
  subtotal: '۱۲۰٬۰۰۰',
  total: '۱۲۰٬۰۰۰',
  paid: '۱۰۰٬۰۰۰',
  remaining: '۲۰٬۰۰۰',
  currency: '؋',
}

describe('receipt HTML', () => {
  it('is sized for the paper and right-to-left', () => {
    const html = renderReceiptHtml(data, labels, { widthMm: 80, direction: 'rtl', lang: 'fa' })
    expect(html).toContain('@page { size: 80mm auto; margin: 0; }')
    expect(html).toContain('dir="rtl"')
    expect(html).toContain('چای سبز')
    expect(
      renderReceiptHtml(data, labels, { widthMm: 58, direction: 'rtl', lang: 'fa' }),
    ).toContain('size: 58mm auto')
  })

  it('escapes every value (a product name is user text)', () => {
    const html = renderReceiptHtml(data, labels, { widthMm: 80, direction: 'rtl', lang: 'fa' })
    expect(html).not.toContain('<b>کریمی</b>')
    expect(html).toContain('&lt;b&gt;کریمی&lt;/b&gt;')
  })

  it('omits discount and tax rows when there are none', () => {
    const html = renderReceiptHtml(data, labels, { widthMm: 80, direction: 'rtl', lang: 'fa' })
    expect(html).not.toContain('تخفیف</td>')
    expect(
      renderReceiptHtml({ ...data, discount: '۵٬۰۰۰' }, labels, {
        widthMm: 80,
        direction: 'rtl',
        lang: 'fa',
      }),
    ).toContain('تخفیف</td>')
  })
})

describe('ESC/POS control bytes', () => {
  const bytes = (b64: string | null) => (b64 ? [...atob(b64)].map((c) => c.charCodeAt(0)) : null)

  it('nothing asked → nothing sent', () => {
    expect(escPosControl({ openDrawer: false, cutPaper: false })).toBeNull()
  })

  it('drawer pulse (ESC p) and partial cut (GS V 66 0), after ESC @', () => {
    expect(bytes(escPosControl({ openDrawer: true, cutPaper: true }))).toEqual([
      0x1b, 0x40, 0x1b, 0x70, 0x00, 0x19, 0xfa, 0x0a, 0x0a, 0x0a, 0x1d, 0x56, 0x42, 0x00,
    ])
  })
})

describe('printer settings are never trusted as stored', () => {
  it('garbage → defaults; copies clamped; width only 58 or 80', () => {
    expect(sanitizePrinterSettings('x')).toEqual(DEFAULT_PRINTER_SETTINGS)
    expect(sanitizePrinterSettings({ widthMm: 100, copies: 9, deviceName: '  ' })).toMatchObject({
      widthMm: 80,
      copies: 3,
      deviceName: null,
    })
  })
})

describe('printReceipt', () => {
  afterEach(() => registerReceiptPrinterHost(null as unknown as ReceiptPrinterHost))

  const host = (over: Partial<ReceiptPrinterHost> = {}): ReceiptPrinterHost => ({
    listPrinters: async () => [],
    printHtml: vi.fn(async () => true),
    printEscPos: vi.fn(async () => true),
    ...over,
  })

  it('desktop: silent to the chosen printer, at the paper width and copy count', async () => {
    const h = host()
    registerReceiptPrinterHost(h)
    const outcome = await printReceipt('<p/>', {
      ...DEFAULT_PRINTER_SETTINGS,
      deviceName: 'XP-80C',
      copies: 2,
    })
    expect(outcome).toEqual({ status: 'printed' })
    expect(h.printHtml).toHaveBeenCalledWith({
      html: '<p/>',
      deviceName: 'XP-80C',
      silent: true,
      pageWidthMm: 80,
      copies: 2,
    })
    expect(h.printEscPos).not.toHaveBeenCalled() // no drawer, no cut asked
  })

  it('no printer chosen → the dialog (not silent)', async () => {
    const h = host()
    registerReceiptPrinterHost(h)
    await printReceipt('<p/>', DEFAULT_PRINTER_SETTINGS)
    expect(h.printHtml).toHaveBeenCalledWith(
      expect.objectContaining({ silent: false, deviceName: undefined }),
    )
  })

  it('a printer failure is «failed: printer» — and nothing else is attempted', async () => {
    const h = host({ printHtml: vi.fn(async () => false) })
    registerReceiptPrinterHost(h)
    expect(await printReceipt('<p/>', { ...DEFAULT_PRINTER_SETTINGS, openDrawer: true })).toEqual({
      status: 'failed',
      reason: 'printer',
    })
    expect(h.printEscPos).not.toHaveBeenCalled()
  })

  it('printed but the drawer failed → said as exactly that', async () => {
    registerReceiptPrinterHost(host({ printEscPos: vi.fn(async () => false) }))
    expect(await printReceipt('<p/>', { ...DEFAULT_PRINTER_SETTINGS, openDrawer: true })).toEqual({
      status: 'failed',
      reason: 'drawer',
    })
  })
})
