// ============================================
// Invoices out of a spreadsheet: the calendar, the grouping, the lookups, and
// the body handed to the invoice service.
//
// Every expected figure here was worked by hand and is said beside the test,
// because an importer that is consistently wrong is still consistent.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  findHeaderRow,
  groupInvoiceRows,
  inspectUpload,
  jalaliToGregorian,
  parseJalaliIso,
  resolveInvoiceParties,
  toInvoiceBody,
  validateRows,
  ENTITY_FIELDS,
  suggestMapping,
} from '../services/migration'

/** Headers + rows → validated candidates, mapped the way the scan maps them. */
function candidatesOf(headers: string[], rows: string[][]) {
  const mapping: Record<string, number> = {}
  suggestMapping('invoice', headers).forEach((hit, column) => {
    if (hit.targetField && hit.status === 'matched') mapping[hit.targetField] = column
  })
  return { mapping, ...validateRows('invoice', headers, rows, mapping) }
}

/* ─── The calendar ────────────────────────────────────────────────────────── */

describe('Solar Hijri dates', () => {
  it('⚠️ land on the right Gregorian day', () => {
    // Nowruz 1403 was 20 March 2024; Nowruz 1404, 21 March 2025.
    expect(jalaliToGregorian(1403, 1, 1)).toEqual([2024, 3, 20])
    expect(jalaliToGregorian(1404, 1, 1)).toEqual([2025, 3, 21])
    // 1403 is a leap year: its last day is 30 Esfand, the day before Nowruz.
    expect(jalaliToGregorian(1403, 12, 30)).toEqual([2025, 3, 20])
    // 19 Mehr 1405 is 11 October 2026.
    expect(jalaliToGregorian(1405, 7, 19)).toEqual([2026, 10, 11])
    // 22 Bahman 1357 is 11 February 1979.
    expect(jalaliToGregorian(1357, 11, 22)).toEqual([1979, 2, 11])
  })

  it('are read in Persian digits and with any separator', () => {
    expect(parseJalaliIso('۱۴۰۵/۰۷/۱۹')).toEqual({ ok: true, iso: '2026-10-11' })
    expect(parseJalaliIso('1405-7-19')).toEqual({ ok: true, iso: '2026-10-11' })
    expect(parseJalaliIso('1405.07.19')).toEqual({ ok: true, iso: '2026-10-11' })
  })

  it('⚠️ refuse a day the calendar does not have', () => {
    // Mehr has 30 days; 1404 is not a leap year, so it has no 30 Esfand.
    expect(parseJalaliIso('1405/07/31')).toEqual({ ok: false, reason: 'OUT_OF_RANGE' })
    expect(parseJalaliIso('1404/12/30')).toEqual({ ok: false, reason: 'OUT_OF_RANGE' })
    expect(parseJalaliIso('1403/12/30')).toEqual({ ok: true, iso: '2025-03-20' })
  })

  it('leave a Gregorian date alone', () => {
    expect(parseJalaliIso('2026-10-11')).toEqual({ ok: false, reason: 'NOT_JALALI' })
  })
})

/* ─── Rows → documents ────────────────────────────────────────────────────── */

describe('grouping rows into invoices', () => {
  const HEADERS = ['شماره فاکتور', 'تاریخ', 'نام مشتری', 'نام کالا', 'تعداد', 'فی', 'پرداخت شده']

  it('the invoice fields map themselves from Persian headers', () => {
    const { mapping } = candidatesOf(HEADERS, [])
    expect(mapping).toMatchObject({
      invoiceNumber: 0,
      date: 1,
      customerName: 2,
      itemName: 3,
      quantity: 4,
      unitPrice: 5,
      paidAmount: 6,
    })
  })

  it('⚠️ rows with one number are one invoice; the total is the sum of its lines', () => {
    const { candidates, findings } = candidatesOf(HEADERS, [
      ['1001', '1405/07/19', 'احمد', 'چای', '2', '150', '390'],
      ['1001', '1405/07/19', 'احمد', 'قند', '1', '90', ''],
      ['1002', '1405/07/20', 'کریم', 'چای', '2.5', '150', '0'],
    ])
    expect(findings.filter((finding) => finding.severity === 'fatal')).toEqual([])

    const { drafts } = groupInvoiceRows(candidates)
    expect(drafts).toHaveLength(2)

    const [first, second] = drafts
    // 2 × 150 + 1 × 90 = 390, in minor units 39,000.
    expect(first).toMatchObject({
      number: '1001',
      date: '2026-10-11',
      partyName: 'احمد',
      totalMinor: 39_000,
      paidMinor: 39_000,
      importable: true,
    })
    expect(first?.lines.map((line) => [line.name, line.quantity, line.unitPriceMinor])).toEqual([
      ['چای', 2, 15_000],
      ['قند', 1, 9_000],
    ])
    // 2.5 × 150 = 375 → 37,500: a fractional quantity is kept, not rounded to 2 or 3.
    expect(second).toMatchObject({ date: '2026-10-12', totalMinor: 37_500, paidMinor: 0 })
  })

  it('a row with no invoice number is an invoice of its own', () => {
    const { candidates } = candidatesOf(
      ['تاریخ', 'مشتری', 'جمع کل'],
      [
        ['2026-10-01', 'احمد', '500'],
        ['2026-10-01', 'احمد', '500'],
      ],
    )
    const { drafts } = groupInvoiceRows(candidates)
    // Two identical rows are two sales, not one — and not the same identity.
    expect(drafts).toHaveLength(2)
    expect(drafts[0]?.identity).not.toBe(drafts[1]?.identity)
    expect(drafts[0]?.totalMinor).toBe(50_000)
  })

  it('⚠️ a line with no price is refused, never imported at zero', () => {
    const { candidates } = candidatesOf(
      ['شماره فاکتور', 'تاریخ', 'نام کالا', 'تعداد'],
      [['7', '2026-10-01', 'چای', '3']],
    )
    const { drafts, findings } = groupInvoiceRows(candidates)
    expect(drafts[0]?.importable).toBe(false)
    expect(findings.map((finding) => finding.code)).toContain('INVOICE_LINE_NO_PRICE')
  })

  it('⚠️ one number with two dates is two documents pretending to be one', () => {
    const { candidates } = candidatesOf(
      ['شماره فاکتور', 'تاریخ', 'فی'],
      [
        ['9', '2026-10-01', '100'],
        ['9', '2026-10-02', '100'],
      ],
    )
    const { drafts, findings } = groupInvoiceRows(candidates)
    expect(drafts[0]?.importable).toBe(false)
    expect(findings[0]).toMatchObject({ code: 'INVOICE_HEADER_CONFLICT', detail: 'date' })
  })

  it('paying more than the invoice is worth stops it', () => {
    const { candidates } = candidatesOf(
      ['تاریخ', 'فی', 'پرداخت شده'],
      [['2026-10-01', '100', '150']],
    )
    const { drafts, findings } = groupInvoiceRows(candidates)
    expect(drafts[0]?.importable).toBe(false)
    expect(findings.map((finding) => finding.code)).toContain('INVOICE_PAID_EXCEEDS_TOTAL')
  })

  it('⚠️ 03/04/2026 is not guessed — the row is refused with the reason', () => {
    const { findings } = candidatesOf(['تاریخ', 'فی'], [['03/04/2026', '100']])
    expect(findings.map((finding) => finding.code)).toContain('DATE_AMBIGUOUS')
  })

  it('every invoice field has a kind the validator handles', () => {
    for (const spec of ENTITY_FIELDS.invoice) {
      expect(['text', 'money', 'decimal', 'date', 'phone']).toContain(spec.kind)
    }
  })
})

/* ─── Who and what ────────────────────────────────────────────────────────── */

describe('finding the customer and the products', () => {
  const draftsOf = (rows: string[][]) =>
    groupInvoiceRows(
      candidatesOf(
        ['شماره فاکتور', 'تاریخ', 'نام مشتری', 'تلفن', 'نام کالا', 'کد کالا', 'فی'],
        rows,
      ).candidates,
    ).drafts

  const known = {
    customers: [
      { id: 'c-ahmad', name: 'احمد', phone: '0700123456' },
      { id: 'c-karim-1', name: 'کریم', phone: '0799000001' },
      { id: 'c-karim-2', name: 'کریم', phone: '0799000002' },
    ],
    products: [{ id: 'p-tea', name: 'چای', sku: 'T-1', barcode: null }],
  }

  it('by name, and by phone when the name is shared', () => {
    const drafts = draftsOf([
      ['1', '2026-10-01', 'احمد', '', 'چای', '', '100'],
      ['2', '2026-10-01', 'کریم', '0799000002', 'چای', '', '100'],
    ])
    const findings = resolveInvoiceParties(drafts, known)

    expect(drafts.map((draft) => draft.customerId)).toEqual(['c-ahmad', 'c-karim-2'])
    expect(findings.filter((finding) => finding.severity === 'fatal')).toEqual([])
  })

  it('⚠️ a name nobody has stops the invoice; no customer is made up', () => {
    const drafts = draftsOf([['1', '2026-10-01', 'ناشناس', '', 'چای', '', '100']])
    const findings = resolveInvoiceParties(drafts, known)

    expect(drafts[0]).toMatchObject({ importable: false, customerId: null })
    expect(findings[0]).toMatchObject({ code: 'INVOICE_CUSTOMER_UNKNOWN', detail: 'ناشناس' })
  })

  it('⚠️ a name two customers share, with no phone, is a question — not the first one', () => {
    const drafts = draftsOf([['1', '2026-10-01', 'کریم', '', 'چای', '', '100']])
    const findings = resolveInvoiceParties(drafts, known)

    expect(drafts[0]?.importable).toBe(false)
    expect(findings[0]?.code).toBe('INVOICE_CUSTOMER_AMBIGUOUS')
  })

  it('a product in the catalogue is linked; one that is not stays a line of text, and says so', () => {
    const drafts = draftsOf([
      ['1', '2026-10-01', 'احمد', '', 'هر اسمی', 'T-1', '100'],
      ['1', '2026-10-01', 'احمد', '', 'خدمات نصب', '', '50'],
    ])
    const findings = resolveInvoiceParties(drafts, known)

    expect(drafts[0]?.lines.map((line) => line.productId)).toEqual(['p-tea', null])
    expect(drafts[0]?.importable).toBe(true)
    expect(findings).toEqual([
      expect.objectContaining({ severity: 'info', code: 'INVOICE_PRODUCT_UNMATCHED' }),
    ])
  })

  it('an invoice with no customer column is a sale to nobody in particular', () => {
    const { candidates } = candidatesOf(['تاریخ', 'فی'], [['2026-10-01', '100']])
    const { drafts } = groupInvoiceRows(candidates)
    expect(resolveInvoiceParties(drafts, known)).toEqual([])
    expect(drafts[0]).toMatchObject({ importable: true, customerId: null })
  })
})

/* ─── What the invoice service is given ───────────────────────────────────── */

describe('the body sent to the invoice service', () => {
  it('⚠️ is in major units, totals from the lines, and the old number as the reference', () => {
    const { candidates } = candidatesOf(
      ['شماره فاکتور', 'تاریخ', 'نام مشتری', 'نام کالا', 'تعداد', 'فی', 'پرداخت شده'],
      [
        ['1001', '1405/07/19', 'احمد', 'چای', '2', '150', '100'],
        ['1001', '1405/07/19', 'احمد', 'قند', '1', '90', ''],
      ],
    )
    const { drafts } = groupInvoiceRows(candidates)
    resolveInvoiceParties(drafts, {
      customers: [{ id: 'c-ahmad', name: 'احمد', phone: null }],
      products: [{ id: 'p-tea', name: 'چای', sku: null, barcode: null }],
    })

    const body = toInvoiceBody(drafts[0]!)

    expect(body).toMatchObject({
      type: 'sale',
      date: '2026-10-11T00:00:00.000Z',
      customerId: 'c-ahmad',
      subtotal: 390,
      total: 390,
      paidAmount: 100,
      reference: '1001',
    })
    expect(body.items).toEqual([
      expect.objectContaining({ productId: 'p-tea', quantity: 2, unitPrice: 150, totalPrice: 300 }),
      expect.objectContaining({ productName: 'قند', quantity: 1, unitPrice: 90, totalPrice: 90 }),
    ])
    expect(body.items[1]).not.toHaveProperty('productId')
    // No currency column ⇒ no currency sent: the invoice gets the default any invoice gets.
    expect(body).not.toHaveProperty('currency')
    // A scale check beside the exact one: this is hundreds, not tens of thousands.
    expect(body.total).toBeLessThan(1000)
  })

  it('a purchase names its supplier as text', () => {
    const { candidates } = candidatesOf(
      ['نوع', 'تاریخ', 'تامین کننده', 'فی'],
      [['خرید', '2026-10-01', 'عمده‌فروشی نور', '800']],
    )
    const { drafts } = groupInvoiceRows(candidates)
    const body = toInvoiceBody(drafts[0]!)
    expect(body).toMatchObject({ type: 'purchase', supplierName: 'عمده‌فروشی نور' })
    expect(body).not.toHaveProperty('customerId')
  })

  it('⚠️ the Persian half-space survives the import, and still matches without it', () => {
    const zwnj = String.fromCharCode(0x200c)
    const name = `عمده${zwnj}فروشی`
    const { candidates } = candidatesOf(['تاریخ', 'نام مشتری', 'فی'], [['2026-10-01', name, '100']])
    const { drafts } = groupInvoiceRows(candidates)
    // Stored as written …
    expect(drafts[0]?.partyName).toBe(name)
    expect(drafts[0]?.partyName).toHaveLength(10)
    // … and found under the spelling without it.
    resolveInvoiceParties(drafts, {
      customers: [{ id: 'c-1', name: 'عمدهفروشی', phone: null }],
      products: [],
    })
    expect(drafts[0]?.customerId).toBe('c-1')
  })
})

/* ─── A spreadsheet that does not start with its table ────────────────────── */

describe('a file whose table starts lower down', () => {
  it('⚠️ finds the header under a title, and reads from there', () => {
    const rows = [
      ['فروشگاه نور', '', ''],
      ['گزارش فروش مهر ۱۴۰۵', '', ''],
      ['', '', ''],
      ['شماره فاکتور', 'تاریخ', 'مبلغ کل'],
      ['1001', '1405/07/19', '390'],
    ]
    expect(findHeaderRow(rows)).toBe(3)

    const text = rows.map((row) => row.join(',')).join('\n')
    const seen = inspectUpload({ filename: 'sales.csv', text })

    expect(seen.skippedRows).toBe(3)
    expect(seen.headers).toEqual(['شماره فاکتور', 'تاریخ', 'مبلغ کل'])
    expect(seen.rowCount).toBe(1)
    expect(seen.content.split('\n')[0]).toBe('شماره فاکتور,تاریخ,مبلغ کل')
    expect(seen.detection.entity).toBe('invoice')
  })

  it('a file it does not recognise is read as written', () => {
    expect(
      findHeaderRow([
        ['الف', 'ب'],
        ['۱', '۲'],
      ]),
    ).toBe(0)
  })
})
