// ============================================
// THE FILES PEOPLE ACTUALLY HAVE.
//
// Each sheet below is modelled on a layout that is published or documented —
// the line register accounting packages import (Tally's voucher sheet), the
// one-row-per-invoice sales list (Qoyod's export, the generic sales register),
// the GST tool sheet with its extra tax columns, the printed-invoice FORM that
// spreadsheet tutorials teach (a title, «DATE:», «Bill To:», then a two-column
// table and a TOTAL line), its Persian twin, and day-first dates.
//
// None of them is a file downloaded from anyone: the layouts are rebuilt here
// cell by cell, so what is tested is the SHAPE, and the fixture is readable.
//
// The whole path runs for each: look → kind → columns (by name, then by
// content) → rows → documents. What is asserted is what a shopkeeper would
// see: was it recognised, how many invoices came out, for how much.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  groupInvoiceRows,
  inferMappingFromContent,
  inspectUpload,
  parseDelimited,
  suggestMapping,
  validateRows,
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

/** The whole way from a file to invoice drafts, as the server walks it. */
function importOf(rows: (string | number)[][]) {
  const seen = inspectUpload({ filename: 'file.csv', text: csv(rows) })
  const table = parseDelimited(seen.content)

  const mapping: Record<string, number> = {}
  if (seen.detection.entity) {
    suggestMapping(seen.detection.entity, table.headers).forEach((hit, column) => {
      if (hit.targetField && hit.status === 'matched') mapping[hit.targetField] = column
    })
    Object.assign(
      mapping,
      inferMappingFromContent(seen.detection.entity, table.headers, table.rows, mapping).mapping,
    )
  }

  const validated = validateRows('invoice', table.headers, table.rows, mapping)
  const grouped = groupInvoiceRows(validated.candidates)
  const ready = grouped.drafts.filter((draft) => draft.importable)

  return {
    kind: seen.detection.entity,
    skipped: seen.skippedRows,
    mapping,
    invoices: ready.length,
    refused: grouped.drafts.length - ready.length,
    total: ready.reduce((sum, draft) => sum + draft.totalMinor, 0) / 100,
    dates: [...new Set(ready.map((draft) => draft.date))],
    fatal: [...validated.findings, ...grouped.findings]
      .filter((finding) => finding.severity === 'fatal')
      .map((finding) => finding.code),
    drafts: ready,
  }
}

describe('files as they come', () => {
  it('a line register, the way accounting packages lay it out (Tally-style)', () => {
    const out = importOf([
      [
        'Voucher Date',
        'Voucher Number',
        'Party Name',
        'Item Name',
        'Quantity',
        'Rate',
        'Taxable Value',
        'Invoice Total',
      ],
      ['2026-10-01', 'S-101', 'Acme Traders', 'Widget A', 10, 150, 1500, 2300],
      ['2026-10-01', 'S-101', 'Acme Traders', 'Widget B', 2, 400, 800, 2300],
      ['2026-10-02', 'S-102', 'Bharat Stores', 'Widget A', 5, 150, 750, 750],
    ])

    expect(out.kind).toBe('invoice')
    expect(out.fatal).toEqual([])
    // Two vouchers; 1500 + 800 = 2300 and 750 → 3050.
    expect(out).toMatchObject({ invoices: 2, refused: 0, total: 3050 })
    expect(out.drafts[0]?.partyName).toBe('Acme Traders')
  })

  it('one row per invoice, with no lines at all (a sales list export)', () => {
    const out = importOf([
      ['Invoice No', 'Date', 'Customer Account Code', 'Description', 'Amount'],
      ['1001', '2026-10-01', 'C-17', 'October supplies', '1,250.50'],
      ['1002', '2026-10-03', 'C-22', 'Repairs', '480'],
    ])

    expect(out.kind).toBe('invoice')
    expect(out.fatal).toEqual([])
    expect(out).toMatchObject({ invoices: 2, total: 1730.5 })
    // The description is the one line of each invoice.
    expect(out.drafts[0]?.lines.map((line) => line.name)).toEqual(['October supplies'])
  })

  it('⚠️ a tax-tool sheet: the tax rate is applied, and the result agrees with the sheet’s own total', () => {
    const out = importOf([
      [
        'Invoice Number',
        'Date',
        'Customer',
        'GSTIN',
        'Place of Supply',
        'Item',
        'HSN/SAC',
        'Quantity',
        'Price',
        'Tax %',
        'Total',
      ],
      [
        'INV-7',
        '2026-10-05',
        'Noor Store',
        '29ABCDE1234F1Z5',
        'KA',
        'Tea 500g',
        '0902',
        4,
        250,
        5,
        1050,
      ],
      [
        'INV-8',
        '2026-10-05',
        'Noor Store',
        '29ABCDE1234F1Z5',
        'KA',
        'Sugar 1kg',
        '1701',
        2,
        90,
        5,
        189,
      ],
    ])

    expect(out.kind).toBe('invoice')
    expect(out.fatal).toEqual([])
    // 4 × 250 = 1000, +5% = 1050; 2 × 90 = 180, +5% = 189. Together 1239 —
    // and each is exactly what the sheet's «Total» column says, which is why
    // neither was refused.
    expect(out).toMatchObject({ invoices: 2, refused: 0, total: 1239 })
    expect(out.drafts.map((draft) => [draft.subtotalMinor, draft.totalMinor])).toEqual([
      [100_000, 105_000],
      [18_000, 18_900],
    ])
  })

  it('⚠️ day-first dates (DD/MM/YYYY) are settled by the column, not refused row by row', () => {
    const out = importOf([
      ['Invoice No', 'Invoice Date', 'Party Name', 'Amount'],
      // 03/04 alone could be 3 April or 4 March — but 25/04 two rows down can
      // only be day-first, and one column has one format.
      ['1', '03/04/2026', 'Acme', '100'],
      ['2', '04/04/2026', 'Acme', '100'],
      ['3', '25/04/2026', 'Acme', '100'],
    ])

    expect(out.fatal).toEqual([])
    expect(out.invoices).toBe(3)
    expect(out.dates).toEqual(['2026-04-03', '2026-04-04', '2026-04-25'])
  })

  it('⚠️ a date column that never says which is the day stays a question', () => {
    const out = importOf([
      ['Invoice No', 'Invoice Date', 'Amount'],
      ['1', '03/04/2026', '100'],
      ['2', '05/06/2026', '100'],
      ['3', '07/08/2026', '100'],
    ])
    expect(out.invoices).toBe(0)
    expect(out.fatal).toContain('DATE_AMBIGUOUS')
  })

  it('⚠️ a printed-invoice FORM: the date and number above the table belong to its rows', () => {
    // The layout spreadsheet tutorials teach: a title, labelled cells, then a
    // two-column table and a TOTAL line under it.
    const out = importOf([
      ['Invoice', '', ''],
      ['', '', ''],
      ['DATE:', '2026-10-09', ''],
      ['INVOICE:', 'A-55', ''],
      ['Bill To:', 'Karim Trading', ''],
      ['', '', ''],
      ['DESCRIPTION', '', 'AMOUNT'],
      ['Web design', '', 900],
      ['Hosting, one year', '', 120],
      ['TOTAL', '', 1020],
    ])

    expect(out.kind).toBe('invoice')
    expect(out.fatal).toEqual([])
    // ONE invoice of two lines, 900 + 120 — and the TOTAL line is not a third.
    expect(out).toMatchObject({ invoices: 1, refused: 0, total: 1020 })
    expect(out.drafts[0]).toMatchObject({
      number: 'A-55',
      date: '2026-10-09',
      partyName: 'Karim Trading',
    })
    expect(out.drafts[0]?.lines.map((line) => line.name)).toEqual([
      'Web design',
      'Hosting, one year',
    ])
  })

  it('⚠️ the same form in Persian, with a Solar Hijri date and a «جمع کل» line', () => {
    const out = importOf([
      ['فروشگاه نور', '', '', '', ''],
      ['شماره فاکتور:', '۲۳۴', '', 'تاریخ:', '۱۴۰۵/۰۷/۱۹'],
      ['نام خریدار:', 'احمد رحیمی', '', '', ''],
      ['', '', '', '', ''],
      ['ردیف', 'شرح کالا', 'تعداد', 'قیمت واحد', 'مبلغ کل'],
      ['۱', 'چای', '۲', '۱۵۰', '۳۰۰'],
      ['۲', 'قند', '۱', '۹۰', '۹۰'],
      ['', 'جمع کل', '', '', '۳۹۰'],
    ])

    expect(out.kind).toBe('invoice')
    expect(out.fatal).toEqual([])
    expect(out).toMatchObject({ invoices: 1, refused: 0, total: 390 })
    expect(out.drafts[0]).toMatchObject({
      number: '234',
      date: '2026-10-11',
      partyName: 'احمد رحیمی',
    })
    expect(out.drafts[0]?.lines).toHaveLength(2)
  })

  it('⚠️ a form with a discount and tax under the table comes to what the paper says', () => {
    const out = importOf([
      ['فاکتور فروش', '', '', ''],
      ['شماره فاکتور:', '77', 'تاریخ:', '1405/07/19'],
      ['', '', '', ''],
      ['شرح کالا', 'تعداد', 'قیمت واحد', 'مبلغ ردیف'],
      ['چای', 4, 150, 600],
      ['قند', 4, 100, 400],
      ['جمع', '', '', 1000],
      ['تخفیف', '', '', 100],
      ['مالیات', '', '', 90],
      ['قابل پرداخت', '', '', 990],
    ])

    expect(out.fatal).toEqual([])
    // 600 + 400 = 1000; − 100 = 900; + 90 = 990. Not 1000.
    expect(out).toMatchObject({ invoices: 1, total: 990 })
    expect(out.drafts[0]).toMatchObject({
      subtotalMinor: 100_000,
      discountMinor: 10_000,
      taxMinor: 9_000,
      totalMinor: 99_000,
    })
  })

  it('⚠️ when the lines do not add up to the total the file states, the invoice is refused — not imported at our number', () => {
    const out = importOf([
      ['Invoice No', 'Date', 'Item', 'Qty', 'Price', 'Invoice Total'],
      // 2 × 500 = 1000, but the sheet says 990: a discount lives somewhere we
      // were not shown.
      ['9', '2026-10-01', 'Tea', 2, 500, 990],
    ])

    expect(out.invoices).toBe(0)
    expect(out.fatal).toEqual(['INVOICE_TOTAL_MISMATCH'])
  })

  it('⚠️ a form with NO number is still one invoice, not one per line', () => {
    const out = importOf([
      ['Invoice', '', ''],
      ['DATE:', '2026-10-09', ''],
      ['Bill To:', 'Karim Trading', ''],
      ['DESCRIPTION', '', 'AMOUNT'],
      ['Web design', '', 900],
      ['Hosting, one year', '', 120],
      ['TOTAL', '', 1020],
    ])

    expect(out.fatal).toEqual([])
    expect(out).toMatchObject({ invoices: 1, total: 1020 })
    expect(out.drafts[0]?.number).toBeNull()
    expect(out.drafts[0]?.lines).toHaveLength(2)
  })

  it('⚠️ two invoices that share a number but not a customer are two invoices, with two identities', () => {
    const first = importOf([
      ['Invoice No', 'Date', 'Customer', 'Amount'],
      ['1024', '2026-10-01', 'Acme', 500],
    ])
    const second = importOf([
      ['Invoice No', 'Date', 'Customer', 'Amount'],
      ['1024', '2025-03-01', 'Bharat', 80],
    ])
    expect(first.drafts[0]?.identity).not.toBe(second.drafts[0]?.identity)
    // And the same invoice read twice is the same.
    expect(
      importOf([
        ['Invoice No', 'Date', 'Customer', 'Amount'],
        ['1024', '2026-10-01', 'Acme', 500],
      ]).drafts[0]?.identity,
    ).toBe(first.drafts[0]?.identity)
  })

  it('columns with no names at all: read from what they hold', () => {
    const out = importOf([
      ['A', 'B', 'C', 'D', 'E'],
      ['1405/07/19', 'چای', 2, 150, 300],
      ['1405/07/19', 'قند', 1, 90, 90],
      ['1405/07/20', 'نمک', 3, 40, 120],
    ])

    // Nothing in the headers says «invoice», so the KIND is asked…
    expect(out.kind).toBeNull()
    // …and once the person says it is, the columns connect themselves.
    const table = parseDelimited(
      csv([
        ['A', 'B', 'C', 'D', 'E'],
        ['1405/07/19', 'چای', 2, 150, 300],
        ['1405/07/19', 'قند', 1, 90, 90],
        ['1405/07/20', 'نمک', 3, 40, 120],
      ]),
    )
    const mapping = inferMappingFromContent('invoice', table.headers, table.rows, {}).mapping
    expect(mapping).toEqual({ date: 0, quantity: 2, unitPrice: 3, lineTotal: 4 })
  })

  it('a subtotal line in the middle of a register does not become an invoice', () => {
    const out = importOf([
      ['شماره فاکتور', 'تاریخ', 'نام کالا', 'تعداد', 'فی', 'مبلغ'],
      ['1', '1405/07/19', 'چای', 2, 150, 300],
      ['', '', 'جمع', '', '', 300],
      ['2', '1405/07/20', 'قند', 1, 90, 90],
      ['', '', 'جمع کل', '', '', 390],
    ])
    expect(out.fatal).toEqual([])
    expect(out).toMatchObject({ invoices: 2, total: 390 })
  })
})

/* ─── Master-data sheets, as an accounting package's own sample files lay them out ───
 *
 * These five shapes are the sample import workbooks the owner supplied (ledger
 * and stock-item sheets from an accounting package), rebuilt here from their
 * header rows and a few of their rows. The real files were read by the real
 * reader on 11 Oct 2026; what is pinned below is what they need from the rules.
 */

/** A master-data sheet → its kind, and which of its rows would be imported. */
function masterOf(rows: (string | number)[][]) {
  const seen = inspectUpload({ filename: 'file.csv', text: csv(rows) })
  const kind = seen.detection.entity
  const table = parseDelimited(seen.content)
  const mapping: Record<string, number> = {}
  if (kind) {
    suggestMapping(kind, table.headers).forEach((hit, column) => {
      if (hit.targetField && hit.status === 'matched') mapping[hit.targetField] = column
    })
    Object.assign(
      mapping,
      inferMappingFromContent(kind, table.headers, table.rows, mapping).mapping,
    )
  }
  const checked = kind ? validateRows(kind, table.headers, table.rows, mapping) : null
  const codes: Record<string, number> = {}
  for (const finding of checked?.findings ?? [])
    codes[finding.code] = (codes[finding.code] ?? 0) + 1
  return {
    kind,
    mapping,
    codes,
    imported: (checked?.candidates ?? [])
      .filter((candidate) => candidate.importable)
      .map((candidate) => candidate.values[kind === 'product' ? 'name' : 'fullName']),
  }
}

describe('master-data sheets from an accounting package', () => {
  it('⚠️ a ledger sheet: only the debtors are customers — the supplier is named and left out', () => {
    const out = masterOf([
      ['Name', 'Group Name', 'PAN/IT No.'],
      ['ABC Company Limited', 'Sundry Debtors', 'BQFPP2978H'],
      ['National Traders', 'Sundry Creditors', 'ABCTY1234D'],
      ['Bright Soft', 'Sundry Debtors', 'GQFPI2978J'],
    ])

    expect(out.kind).toBe('customer')
    expect(out.mapping).toMatchObject({ fullName: 0, ledgerGroup: 1 })
    expect(out.imported).toEqual(['ABC Company Limited', 'Bright Soft'])
    expect(out.codes).toEqual({ ROW_NOT_A_CUSTOMER: 1 })
  })

  it('⚠️ «10.00$ = 800.00» is two amounts: the row is refused, not imported as some third number', () => {
    const out = masterOf([
      [
        'Name',
        'Group Name',
        'Ledger - Opening Balance',
        'Ledger Opening Balance - Dr/Cr',
        'State',
        'Country',
      ],
      [
        'Titan Corporation',
        'Sundry Debtors',
        '10.00$ = 800.00',
        'Dr',
        'Alabama',
        'United States of America',
      ],
      [
        'National Traders',
        'Sundry Debtors',
        '20.00$ = 1600.00',
        'Dr',
        'Alaska',
        'United States of America',
      ],
      [
        'United Traders',
        'Sundry Debtors',
        '100.00$ = 8000.00',
        'Dr',
        'California',
        'United States of America',
      ],
    ])

    expect(out.kind).toBe('customer')
    expect(out.mapping).toMatchObject({ openingBalance: 2, balanceSide: 3 })
    expect(out.imported).toEqual([])
    expect(out.codes).toEqual({ MONEY_UNREADABLE: 3 })
  })

  it('⚠️ a CREDIT opening balance is not imported as money the customer owes', () => {
    const out = masterOf([
      ['Name', 'Group Name', 'Ledger - Opening Balance', 'Ledger Opening Balance - Dr/Cr'],
      ['Titan Corporation', 'Sundry Debtors', '800.00', 'Dr'],
      ['National Traders', 'Sundry Debtors', '1600.00', 'Cr'],
      ['United Traders', 'Sundry Debtors', '8000.00', 'Dr'],
    ])

    expect(out.imported).toEqual(['Titan Corporation', 'United Traders'])
    expect(out.codes).toEqual({ OPENING_BALANCE_IS_CREDIT: 1 })
  })

  it('a party with several addresses on the rows under it is ONE party, and those rows say what they are', () => {
    const out = masterOf([
      [
        'Name',
        'Group Name',
        'Address',
        'Multiple Mailing Details - Address Type',
        'Multiple Mailing Details - Address',
      ],
      [
        'National Traders',
        'Sundry Debtors',
        'C-1502, Vipul Greens',
        'Address no.1',
        '102, 11th Cross Road',
      ],
      ['', '', '', 'Address no.2', '101, MG Road, Puri'],
      ['', '', '', 'Address no.3', '103, Vaibhav Khand'],
      ['Anish Pvt Ltd', 'Sundry Debtors', '5, Lake Road', 'Address no.1', '7, Hill Street'],
    ])

    expect(out.kind).toBe('customer')
    expect(out.imported).toEqual(['National Traders', 'Anish Pvt Ltd'])
    // Not «required field empty» twice — a continuation, said as one.
    expect(out.codes).toEqual({ ROW_CONTINUATION: 2 })
  })

  it('stock items with their bill of materials underneath: the items are products, the rows under them their formula', () => {
    const out = masterOf([
      [
        'Name',
        'Units',
        'Name of BOM',
        'Unit of manufacture',
        'BOM Component - Item Name',
        'BOM Component - Quantity',
      ],
      ['Stationary Hamper Type 1', 'Nos', 'Stationary Hamper Type 1', 1, 'Pen', 10],
      ['', '', '', '', 'Eraser', 5],
      ['', '', '', '', 'Pencil', 10],
      ['Gift Hamper for Kids', 'Nos', 'Gift Hamper for Kids', 1, 'Toy', 2],
    ])

    expect(out.kind).toBe('product')
    expect(out.mapping).toMatchObject({ name: 0, unit: 1, bomComponent: 4, bomQuantity: 5 })
    expect(out.imported).toEqual(['Stationary Hamper Type 1', 'Gift Hamper for Kids'])
    // The rows under an item are its components — said as that, and read into its formula.
    expect(out.codes).toEqual({ BOM_COMPONENT_ROW: 2 })
  })

  it('⚠️ a sheet of cost centres is not taken for customers: one column called «Name» decides nothing', () => {
    const out = masterOf([['Name'], ['Rahul'], ['Anish'], ['Deepak']])
    expect(out.kind).toBeNull()
    expect(out.imported).toEqual([])
  })
})
