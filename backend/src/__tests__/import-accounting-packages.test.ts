// ============================================
// Exports as accounting packages actually write them.
//
// Each sheet below is laid out the way a named package documents its export:
// the column names, their order, the group and total rows it adds, the
// language. None was written to suit the importer — the first run of this
// file is recorded in .claude/reverse-and-import/00-SPEC.md §14, failures and
// all, and what was fixed for each is there too.
//
// Every case walks the same path the server does (inspect → detect → map by
// name → map by content → validate → group), and asserts what a person would
// check: was it recognised as the right thing, how many records come out, and
// what the first of them reads as.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  groupInvoiceRows,
  inferMappingFromContent,
  inspectUpload,
  parseDelimited,
  suggestMapping,
  validateRows,
  type MigrationEntity,
} from '../services/migration'

const csv = (rows: (string | number)[][]) =>
  rows
    .map((row) =>
      row
        .map((cell) =>
          /[",\n]/.test(String(cell)) ? `"${String(cell).replace(/"/g, '""')}"` : cell,
        )
        .join(','),
    )
    .join('\n')

export function walk(rows: (string | number)[][]) {
  const seen = inspectUpload({ filename: 'file.csv', text: csv(rows) })
  const table = parseDelimited(seen.content)
  const entity = seen.detection.entity as MigrationEntity | null

  const mapping: Record<string, number> = {}
  if (entity) {
    suggestMapping(entity, table.headers).forEach((hit, column) => {
      if (hit.targetField && hit.status === 'matched') mapping[hit.targetField] = column
    })
    Object.assign(
      mapping,
      inferMappingFromContent(entity, table.headers, table.rows, mapping).mapping,
    )
  }
  if (!entity) {
    return {
      entity,
      mapping,
      records: 0,
      first: null,
      codes: [] as string[],
      headers: table.headers,
    }
  }

  const validated = validateRows(entity, table.headers, table.rows, mapping)
  const codes = [
    ...new Set(
      validated.findings
        .filter((finding) => finding.severity !== 'info')
        .map((finding) => finding.code),
    ),
  ].sort()

  if (entity === 'invoice') {
    const grouped = groupInvoiceRows(validated.candidates)
    const ready = grouped.drafts.filter((draft) => draft.importable)
    const more = [...new Set(grouped.findings.map((finding) => finding.code))]
    return {
      entity,
      mapping,
      records: ready.length,
      first: ready[0] ?? null,
      codes: [...new Set([...codes, ...more])].sort(),
      headers: table.headers,
    }
  }

  const ready = validated.candidates.filter((candidate) => candidate.importable)
  return {
    entity,
    mapping,
    records: ready.length,
    first: ready[0]?.values ?? null,
    codes,
    headers: table.headers,
  }
}

/* ─── the sheets ───────────────────────────────────────────────────────────── */

export const SHEETS: Record<string, (string | number)[][]> = {
  // QuickBooks Desktop — «Customer Contact List» report exported to Excel.
  quickbooksCustomers: [
    ['Customer', 'Main Phone', 'Main Email', 'Bill to 1', 'Bill to 2', 'Balance Total'],
    [
      'Ahmad Trading',
      '0700 111 222',
      'ahmad@example.com',
      'Ahmad Trading',
      'Kabul, Shahr-e-Naw',
      '12,500.00',
    ],
    ['Bilal & Sons', '0799-333-444', '', 'Bilal & Sons', 'Herat', '0.00'],
    ['Zarghona Store', '+93 78 555 6666', 'z@example.com', '', '', '4,300.50'],
  ],

  // QuickBooks Online — «Sales by Customer Detail», with its group and total rows.
  quickbooksSalesDetail: [
    ['Sales by Customer Detail'],
    ['January - March 2026'],
    [],
    [
      '',
      'Date',
      'Transaction Type',
      'Num',
      'Product/Service',
      'Memo/Description',
      'Qty',
      'Sales Price',
      'Amount',
      'Balance',
    ],
    ['Ahmad Trading'],
    [
      '',
      '01/15/2026',
      'Invoice',
      '1001',
      'Green Tea',
      'Green tea 500g',
      10,
      '150.00',
      '1,500.00',
      '1,500.00',
    ],
    ['', '01/15/2026', 'Invoice', '1001', 'Sugar', 'Sugar 1kg', 5, '90.00', '450.00', '1,950.00'],
    ['Total for Ahmad Trading', '', '', '', '', '', '', '', '1,950.00', ''],
    ['Bilal & Sons'],
    ['', '02/20/2026', 'Invoice', '1002', 'Rice', 'Rice 5kg', 2, '700.00', '1,400.00', '1,400.00'],
    ['Total for Bilal & Sons', '', '', '', '', '', '', '', '1,400.00', ''],
    ['TOTAL', '', '', '', '', '', '', '', '3,350.00', ''],
  ],

  // Xero — «Sales invoices» CSV export (its documented import template).
  xeroInvoices: [
    [
      '*ContactName',
      'EmailAddress',
      '*InvoiceNumber',
      'Reference',
      '*InvoiceDate',
      '*DueDate',
      'InventoryItemCode',
      '*Description',
      '*Quantity',
      '*UnitAmount',
      'Discount',
      '*AccountCode',
      '*TaxType',
      'TaxAmount',
      'Currency',
    ],
    [
      'Ahmad Trading',
      'ahmad@example.com',
      'INV-0001',
      '',
      '15/01/2026',
      '30/01/2026',
      'TEA-500',
      'Green tea 500g',
      10,
      150,
      '',
      200,
      'Tax Exempt',
      0,
      'AFN',
    ],
    [
      'Ahmad Trading',
      'ahmad@example.com',
      'INV-0001',
      '',
      '15/01/2026',
      '30/01/2026',
      'SUG-1',
      'Sugar 1kg',
      5,
      90,
      '',
      200,
      'Tax Exempt',
      0,
      'AFN',
    ],
    [
      'Bilal & Sons',
      '',
      'INV-0002',
      '',
      '20/02/2026',
      '05/03/2026',
      'RICE-5',
      'Rice 5kg',
      2,
      700,
      '',
      200,
      'Tax Exempt',
      0,
      'AFN',
    ],
  ],

  // Zoho Books — «Items» export.
  zohoItems: [
    [
      'Item ID',
      'Item Name',
      'SKU',
      'Description',
      'Rate',
      'Purchase Rate',
      'Usage unit',
      'Stock On Hand',
      'Status',
    ],
    [
      '460000000012345',
      'Green Tea 500g',
      'TEA-500',
      'Loose leaf',
      'AFN 150.00',
      'AFN 110.00',
      'pcs',
      40,
      'Active',
    ],
    ['460000000012346', 'Sugar 1kg', 'SUG-1', '', 'AFN 90.00', 'AFN 75.00', 'kg', 120, 'Active'],
    ['460000000012347', 'Rice 5kg', 'RICE-5', '', 'AFN 700.00', 'AFN 610.00', 'bag', 0, 'Inactive'],
  ],

  // Odoo — product export from the list view.
  odooProducts: [
    [
      'Internal Reference',
      'Name',
      'Barcode',
      'Sales Price',
      'Cost',
      'Quantity On Hand',
      'Unit of Measure',
      'Product Category',
    ],
    ['TEA-500', 'Green Tea 500g', '6260000000011', 150, 110, 40, 'Units', 'All / Saleable'],
    ['SUG-1', 'Sugar 1kg', '6260000000028', 90, 75, 120, 'kg', 'All / Saleable'],
  ],

  // A Persian accounting package's goods list (کالاها).
  persianGoods: [
    ['ردیف', 'کد کالا', 'نام کالا', 'واحد', 'موجودی', 'قیمت خرید', 'قیمت فروش', 'بارکد'],
    ['۱', '۱۰۰۱', 'چای سبز ۵۰۰ گرمی', 'عدد', '۴۰', '۱۱۰٬۰۰۰', '۱۵۰٬۰۰۰', '۶۲۶۰۰۰۰۰۰۰۰۱۱'],
    ['۲', '۱۰۰۲', 'شکر یک کیلویی', 'کیلوگرم', '۱۲۰', '۷۵٬۰۰۰', '۹۰٬۰۰۰', ''],
    ['۳', '۱۰۰۳', 'برنج پنج کیلویی', 'کیسه', '۰', '۶۱۰٬۰۰۰', '۷۰۰٬۰۰۰', ''],
    ['', '', 'جمع', '', '۱۶۰', '', '', ''],
  ],

  // A Persian package's parties list with debit and credit balance columns.
  persianParties: [
    ['کد حساب', 'نام طرف حساب', 'موبایل', 'آدرس', 'مانده بدهکار', 'مانده بستانکار'],
    ['۲۰۰۱', 'احمد کریمی', '۰۷۰۰۱۱۱۲۲۲', 'کابل، شهر نو', '۱۲٬۵۰۰', '۰'],
    ['۲۰۰۲', 'بلال احمدی', '۰۷۹۹۳۳۳۴۴۴', 'هرات', '۰', '۰'],
    ['۲۰۰۳', 'شرکت پخش آریا', '۰۷۸۵۵۵۶۶۶۶', 'مزار', '۰', '۸٬۰۰۰'],
  ],

  // A Persian sales register (دفتر فروش), one row per line, Solar Hijri dates.
  persianSalesRegister: [
    ['تاریخ', 'شماره فاکتور', 'نام مشتری', 'شرح کالا', 'تعداد', 'فی', 'تخفیف', 'مبلغ'],
    ['۱۴۰۵/۰۷/۰۱', '۳۰۱', 'احمد کریمی', 'چای سبز', '۱۰', '۱۵۰', '۰', '۱٬۵۰۰'],
    ['۱۴۰۵/۰۷/۰۱', '۳۰۱', 'احمد کریمی', 'شکر', '۵', '۹۰', '۵۰', '۴۰۰'],
    ['۱۴۰۵/۰۷/۰۳', '۳۰۲', 'بلال احمدی', 'برنج', '۲', '۷۰۰', '۰', '۱٬۴۰۰'],
    ['', '', '', 'جمع کل', '', '', '۵۰', '۳٬۳۰۰'],
  ],

  // Sage 50 — «Customer List» with account numbers and a credit limit.
  sageCustomers: [
    ['A/C', 'Name', 'Contact Name', 'Telephone', 'E-Mail', 'Credit Limit', 'Balance'],
    [
      'AHM001',
      'Ahmad Trading',
      'Ahmad Karimi',
      '0700111222',
      'ahmad@example.com',
      '50000.00',
      '12500.00',
    ],
    ['BIL001', 'Bilal & Sons', 'Bilal Ahmadi', '0799333444', '', '0.00', '0.00'],
  ],

  // Wave — «Invoices» export, one row per invoice with a total.
  waveInvoices: [
    [
      'Invoice Number',
      'Customer',
      'Invoice Date',
      'Due Date',
      'Status',
      'Subtotal',
      'Tax',
      'Total',
      'Amount Paid',
      'Amount Due',
      'Currency',
    ],
    [
      '1001',
      'Ahmad Trading',
      '2026-01-15',
      '2026-01-30',
      'Paid',
      '1950.00',
      '0.00',
      '1950.00',
      '1950.00',
      '0.00',
      'AFN',
    ],
    [
      '1002',
      'Bilal & Sons',
      '2026-02-20',
      '2026-03-05',
      'Unpaid',
      '1400.00',
      '0.00',
      '1400.00',
      '0.00',
      '1400.00',
      'AFN',
    ],
  ],

  // A shopkeeper's own workbook: a title, a blank line, then stock.
  handMadeStock: [
    ['لیست اجناس دکان — میزان ۱۴۰۵'],
    [],
    ['جنس', 'تعداد', 'قیمت خرید', 'قیمت فروش'],
    ['چای', '۴۰', '۱۱۰', '۱۵۰'],
    ['بوره', '۱۲۰', '۷۵', '۹۰'],
    ['برنج', '۳۰', '۶۱۰', '۷۰۰'],
  ],
}

/* ─── what each must come out as ───────────────────────────────────────────── */

describe('exports of accounting packages', () => {
  it('QuickBooks customer list → customers, with phone, email and balance', () => {
    const out = walk(SHEETS.quickbooksCustomers!)
    expect(out.entity).toBe('customer')
    expect(out.records).toBe(3)
    expect(out.first).toMatchObject({
      fullName: 'Ahmad Trading',
      email: 'ahmad@example.com',
      openingBalance: 1_250_000,
    })
    expect(String((out.first as Record<string, unknown>).phone)).toContain('700111222')
  })

  it('⚠️ QuickBooks «Sales by Customer Detail» → two invoices; the customer is the group row above', () => {
    const out = walk(SHEETS.quickbooksSalesDetail!)
    expect(out.entity).toBe('invoice')
    expect(out.records).toBe(2)
    expect(out.first).toMatchObject({
      number: '1001',
      partyName: 'Ahmad Trading',
      totalMinor: 195_000,
    })
    expect((out.first as { lines: unknown[] }).lines).toHaveLength(2)
  })

  it('Xero invoices → two invoices, starred headers and all', () => {
    const out = walk(SHEETS.xeroInvoices!)
    expect(out.entity).toBe('invoice')
    expect(out.records).toBe(2)
    expect(out.first).toMatchObject({
      number: 'INV-0001',
      partyName: 'Ahmad Trading',
      date: '2026-01-15',
      totalMinor: 195_000,
      currency: 'AFN',
    })
  })

  it('⚠️ Zoho items → products; «AFN 150.00» is 150, not unreadable', () => {
    const out = walk(SHEETS.zohoItems!)
    expect(out.entity).toBe('product')
    expect(out.records).toBe(3)
    expect(out.first).toMatchObject({
      name: 'Green Tea 500g',
      sku: 'TEA-500',
      sellPrice: 15_000,
      buyPrice: 11_000,
      quantity: 40,
    })
  })

  it('Odoo products → products, by internal reference and barcode', () => {
    const out = walk(SHEETS.odooProducts!)
    expect(out.entity).toBe('product')
    expect(out.records).toBe(2)
    expect(out.first).toMatchObject({
      name: 'Green Tea 500g',
      sku: 'TEA-500',
      barcode: '6260000000011',
      sellPrice: 15_000,
      buyPrice: 11_000,
      quantity: 40,
    })
  })

  it('a Persian goods list → three products; the «جمع» row is not a product', () => {
    const out = walk(SHEETS.persianGoods!)
    expect(out.entity).toBe('product')
    expect(out.records).toBe(3)
    expect(out.first).toMatchObject({
      name: 'چای سبز ۵۰۰ گرمی',
      sku: '1001',
      quantity: 40,
      buyPrice: 11_000_000,
      sellPrice: 15_000_000,
    })
  })

  it('⚠️ a Persian parties list → the debtors; a creditor is not imported as owing us', () => {
    const out = walk(SHEETS.persianParties!)
    expect(out.entity).toBe('customer')
    expect(out.first).toMatchObject({ fullName: 'احمد کریمی', openingBalance: 1_250_000 })
    // «شرکت پخش آریا» is owed 8,000 by us: it must not arrive as a customer who owes.
    expect(out.records).toBe(2)
    expect(out.codes).toContain('OPENING_BALANCE_IS_CREDIT')
  })

  it('a Persian sales register → two invoices with Solar Hijri dates; the total row is no invoice', () => {
    const out = walk(SHEETS.persianSalesRegister!)
    expect(out.entity).toBe('invoice')
    expect(out.records).toBe(2)
    expect(out.first).toMatchObject({
      number: '301',
      partyName: 'احمد کریمی',
      date: '2026-09-23',
      totalMinor: 190_000,
    })
  })

  it('Sage customer list → customers; the credit limit is not the balance', () => {
    const out = walk(SHEETS.sageCustomers!)
    expect(out.entity).toBe('customer')
    expect(out.records).toBe(2)
    expect(out.first).toMatchObject({ fullName: 'Ahmad Trading', openingBalance: 1_250_000 })
  })

  it('Wave invoices (one row each, no lines) → two invoices with what was paid', () => {
    const out = walk(SHEETS.waveInvoices!)
    expect(out.entity).toBe('invoice')
    expect(out.records).toBe(2)
    expect(out.first).toMatchObject({
      number: '1001',
      partyName: 'Ahmad Trading',
      totalMinor: 195_000,
      paidMinor: 195_000,
    })
  })

  it('a shopkeeper’s own stock sheet under a title → three products', () => {
    const out = walk(SHEETS.handMadeStock!)
    expect(out.entity).toBe('product')
    expect(out.records).toBe(3)
    expect(out.first).toMatchObject({
      name: 'چای',
      quantity: 40,
      buyPrice: 11_000,
      sellPrice: 15_000,
    })
  })
})
