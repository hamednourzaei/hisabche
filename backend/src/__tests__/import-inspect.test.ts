// ============================================
// The first look at an uploaded file: reading a workbook, and saying what it
// holds — so nobody has to tell the system «these are customers».
//
// The workbooks here are built in the test, byte by byte, the way Excel lays
// them out: a ZIP whose parts are the shared strings, the styles and a sheet.
// That keeps the fixtures readable and means there is no binary file in the
// repository whose contents nobody can review.
// ============================================

import { deflateRawSync } from 'node:zlib'

import { describe, expect, it } from 'vitest'

import {
  detectEntity,
  inspectUpload,
  InspectionError,
  readXlsx,
  rowsToCsv,
  serialToIso,
  XlsxError,
} from '../services/migration'

/* ─── A minimal ZIP writer ────────────────────────────────────────────────── */

function zip(parts: Record<string, string>): Buffer {
  const locals: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0

  for (const [name, text] of Object.entries(parts)) {
    const nameBytes = Buffer.from(name, 'utf8')
    const packed = deflateRawSync(Buffer.from(text, 'utf8'))

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(8, 8)
    local.writeUInt32LE(packed.length, 18)
    local.writeUInt16LE(nameBytes.length, 26)
    locals.push(local, nameBytes, packed)

    const entry = Buffer.alloc(46)
    entry.writeUInt32LE(0x02014b50, 0)
    entry.writeUInt16LE(8, 10)
    entry.writeUInt32LE(packed.length, 20)
    entry.writeUInt16LE(nameBytes.length, 28)
    entry.writeUInt32LE(offset, 42)
    central.push(entry, nameBytes)

    offset += 30 + nameBytes.length + packed.length
  }

  const directory = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(Object.keys(parts).length, 8)
  end.writeUInt16LE(Object.keys(parts).length, 10)
  end.writeUInt32LE(directory.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, directory, end])
}

type Cell = string | number | { date: number } | null

/** A workbook with one sheet per entry; strings go through the shared table. */
function workbook(sheets: Record<string, Cell[][]>, options: { date1904?: boolean } = {}): Buffer {
  const strings: string[] = []
  const escape = (text: string) =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const letter = (index: number) => String.fromCharCode(65 + index)

  const parts: Record<string, string> = {}
  const names = Object.keys(sheets)

  names.forEach((name, sheetIndex) => {
    const rows = (sheets[name] ?? [])
      .map((row, rowIndex) => {
        const cells = row
          .map((cell, column) => {
            const ref = `${letter(column)}${rowIndex + 1}`
            if (cell === null) return ''
            if (typeof cell === 'number') return `<c r="${ref}"><v>${cell}</v></c>`
            if (typeof cell === 'object') return `<c r="${ref}" s="1"><v>${cell.date}</v></c>`
            let at = strings.indexOf(cell)
            if (at < 0) at = strings.push(cell) - 1
            return `<c r="${ref}" t="s"><v>${at}</v></c>`
          })
          .join('')
        return `<row r="${rowIndex + 1}">${cells}</row>`
      })
      .join('')
    parts[`xl/worksheets/sheet${sheetIndex + 1}.xml`] =
      `<worksheet><sheetData>${rows}</sheetData></worksheet>`
  })

  parts['xl/workbook.xml'] =
    `<workbook>${options.date1904 ? '<workbookPr date1904="1"/>' : ''}<sheets>` +
    names
      .map(
        (name, index) =>
          `<sheet name="${escape(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
      )
      .join('') +
    '</sheets></workbook>'
  parts['xl/_rels/workbook.xml.rels'] =
    '<Relationships>' +
    names
      .map(
        (_name, index) =>
          `<Relationship Id="rId${index + 1}" Target="worksheets/sheet${index + 1}.xml"/>`,
      )
      .join('') +
    '</Relationships>'
  parts['xl/sharedStrings.xml'] =
    `<sst>${strings.map((text) => `<si><t>${escape(text)}</t></si>`).join('')}</sst>`
  // Style 0 is a plain number, style 1 the built-in short date.
  parts['xl/styles.xml'] =
    '<styleSheet><cellXfs><xf numFmtId="0"/><xf numFmtId="14"/></cellXfs></styleSheet>'

  return zip(parts)
}

/* ─── Reading a workbook ──────────────────────────────────────────────────── */

describe('reading an .xlsx workbook', () => {
  it('gives back the text, the numbers and the dates of each sheet', () => {
    const sheets = readXlsx(
      workbook({
        مشتریان: [
          ['نام مشتری', 'تلفن', 'مانده'],
          ['احمد & پسران', '0700123456', 1250.5],
        ],
        فروش: [
          ['تاریخ', 'مبلغ'],
          [{ date: 46_296 }, 4000],
        ],
      }),
    )

    expect(sheets.map((sheet) => sheet.name)).toEqual(['مشتریان', 'فروش'])
    expect(sheets[0]?.rows).toEqual([
      ['نام مشتری', 'تلفن', 'مانده'],
      ['احمد & پسران', '0700123456', '1250.5'],
    ])
    // Serial 46296 is 1 October 2026 — a date cell is a date, not «46296».
    expect(sheets[1]?.rows[1]).toEqual(['2026-10-01', '4000'])
  })

  it('⚠️ counts serial days the way Excel does, in both date systems', () => {
    // Worked by hand: 1 → 1900-01-01 … 59 → 1900-02-28, and Excel's phantom
    // 29 February 1900 makes everything from 61 on one day «late».
    expect(serialToIso(61, false)).toBe('1900-03-01')
    expect(serialToIso(45_658, false)).toBe('2025-01-01')
    expect(serialToIso(45_658.75, false)).toBe('2025-01-01 18:00')
    // The 1904 system starts 1,462 days later.
    expect(serialToIso(45_658 - 1462, true)).toBe('2025-01-01')
  })

  it('does not print the binary tail of a stored number', () => {
    const [sheet] = readXlsx(
      workbook({ s: [['قیمت'], [1.1000000000000001], [0.30000000000000004]] }),
    )
    expect(sheet?.rows.slice(1)).toEqual([['1.1'], ['0.3']])
  })

  it('pads short rows and skips blank ones', () => {
    const [sheet] = readXlsx(
      workbook({
        s: [
          ['a', 'b', 'c'],
          [null, null, null],
          ['x', null, null],
        ],
      }),
    )
    expect(sheet?.rows).toEqual([
      ['a', 'b', 'c'],
      ['x', '', ''],
    ])
  })

  it('⚠️ refuses what it cannot read, by name', () => {
    const code = (file: Buffer) => {
      try {
        readXlsx(file)
        return 'read'
      } catch (error) {
        return error instanceof XlsxError ? error.code : 'threw something else'
      }
    }
    // The old binary .xls starts with the OLE signature.
    const ole = Buffer.concat([
      Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
      Buffer.alloc(64),
    ])
    expect(code(ole)).toBe('XLSX_OLD_FORMAT')
    expect(code(Buffer.from('نام,تلفن\nاحمد,0700'))).toBe('XLSX_NOT_A_WORKBOOK')
    expect(code(zip({ 'readme.txt': 'not a workbook' }))).toBe('XLSX_NOT_A_WORKBOOK')
  })

  it('quotes what CSV needs quoted, so a cell with a comma stays one cell', () => {
    expect(rowsToCsv([['a,b', 'he said "hi"', 'plain']])).toBe('"a,b","he said ""hi""",plain')
  })
})

/* ─── Saying what a file holds ────────────────────────────────────────────── */

describe('detecting what a file holds', () => {
  it('customers, from Persian headers and a column of phone numbers', () => {
    const seen = detectEntity(
      ['نام مشتری', 'تلفن', 'آدرس'],
      [
        ['احمد', '0700123456', 'کابل'],
        ['محمود', '0799111222', 'هرات'],
        ['کریم', '0788000111', 'مزار'],
      ],
    )
    expect(seen.entity).toBe('customer')
    expect(seen.confidence).toBe('high')
    expect(seen.evidence.customer).toContain('تلفن')
  })

  it('products, from English headers', () => {
    const seen = detectEntity(['Product Name', 'SKU', 'Barcode', 'Stock', 'Sell Price'], [])
    expect(seen.entity).toBe('product')
    expect(seen.confidence).toBe('high')
  })

  it('⚠️ invoices, even though every line names a customer and a product', () => {
    // An invoice export carries a customer column AND a product column. It is
    // still a list of documents, and reading it as either of the other two
    // would import the same shopkeeper once per sale.
    const seen = detectEntity(
      ['شماره فاکتور', 'تاریخ فاکتور', 'نام مشتری', 'نام کالا', 'تعداد', 'فی', 'مبلغ کل'],
      [
        ['1001', '2026-10-01', 'احمد', 'چای', '2', '150', '300'],
        ['1001', '2026-10-01', 'احمد', 'قند', '1', '90', '90'],
        ['1002', '2026-10-02', 'کریم', 'چای', '5', '150', '750'],
      ],
    )
    expect(seen.entity).toBe('invoice')
    expect(seen.confidence).toBe('high')
    expect(seen.scores.invoice).toBeGreaterThan(seen.scores.customer + 2)
  })

  it('⚠️ does not choose when the headers say nothing', () => {
    const seen = detectEntity(['ستون ۱', 'ستون ۲'], [['الف', 'ب']])
    expect(seen.entity).toBeNull()
    expect(seen.confidence).toBe('low')
  })

  it('⚠️ does not choose when two kinds are close', () => {
    // One strong word each: «could be either» is not «is the first one».
    const seen = detectEntity(['نام مشتری', 'نام کالا'], [])
    expect(seen.entity).toBeNull()
  })

  it('a date column alone does not make a customer list an invoice list', () => {
    const seen = detectEntity(
      ['نام مشتری', 'موبایل', 'تاریخ ثبت'],
      [
        ['احمد', '0700123456', '2026-01-01'],
        ['محمود', '0799111222', '2026-02-01'],
        ['کریم', '0788000111', '2026-03-01'],
      ],
    )
    expect(seen.entity).toBe('customer')
    expect(seen.scores.invoice).toBe(0)
  })

  it('«unit» in a header is a word, not three letters inside another one', () => {
    expect(detectEntity(['community'], []).scores.product).toBe(0)
  })
})

/* ─── The two together ────────────────────────────────────────────────────── */

describe('inspecting an upload', () => {
  it('a workbook comes out as CSV text with its kind, and names the sheets it skipped', () => {
    const file = workbook({
      کالاها: [
        ['نام کالا', 'بارکد', 'موجودی', 'قیمت فروش'],
        ['چای', '6260000000011', 40, 150],
      ],
      یادداشت: [['این شیت خوانده نمی‌شود']],
    })

    const seen = inspectUpload({ filename: 'انبار.xlsx', base64: file.toString('base64') })

    expect(seen.sourceType).toBe('csv')
    expect(seen.content).toBe('نام کالا,بارکد,موجودی,قیمت فروش\nچای,6260000000011,40,150')
    expect(seen.sheet).toEqual({ name: 'کالاها', ignored: ['یادداشت'] })
    expect(seen.rowCount).toBe(1)
    expect(seen.detection.entity).toBe('product')
  })

  it('⚠️ a workbook with three sheets is three tables, each with its own kind', () => {
    const file = workbook({
      مشتریان: [
        ['نام مشتری', 'تلفن'],
        ['احمد', '0700123456'],
      ],
      کالاها: [
        ['نام کالا', 'بارکد', 'موجودی'],
        ['چای', '6260000000011', 40],
      ],
      فروش: [
        ['گزارش فروش'],
        ['شماره فاکتور', 'تاریخ فاکتور', 'مبلغ کل'],
        ['1001', { date: 46_296 }, 390],
      ],
    })

    const seen = inspectUpload({ filename: 'همه.xlsx', base64: file.toString('base64') })

    expect(
      seen.sheets.map((sheet) => [sheet.name, sheet.detection.entity, sheet.rowCount]),
    ).toEqual([
      ['مشتریان', 'customer', 1],
      ['کالاها', 'product', 1],
      ['فروش', 'invoice', 1],
    ])
    // Each sheet carries its own text, starting at its own header row.
    expect(seen.sheets[2]?.content).toBe('شماره فاکتور,تاریخ فاکتور,مبلغ کل\n1001,2026-10-01,390')
    expect(seen.sheets[2]?.skippedRows).toBe(1)
    // The top level is still the first sheet, for a caller that reads only one.
    expect(seen.detection.entity).toBe('customer')
    expect(seen.content).toBe(seen.sheets[0]?.content)
  })

  it('a CSV is passed through untouched', () => {
    const text = 'نام مشتری,تلفن\nاحمد,0700123456'
    const seen = inspectUpload({ filename: 'customers.csv', text })
    expect(seen.content).toBe(text)
    expect(seen.sheet).toBeNull()
    expect(seen.headers).toEqual(['نام مشتری', 'تلفن'])
  })

  it('an old .xls is refused with a code the screen can explain', () => {
    const ole = Buffer.concat([
      Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
      Buffer.alloc(64),
    ])
    expect(() => inspectUpload({ filename: 'old.xls', base64: ole.toString('base64') })).toThrow(
      InspectionError,
    )
    expect(() => inspectUpload({ filename: 'old.xls', base64: ole.toString('base64') })).toThrow(
      'MIGRATION_XLSX_OLD_FORMAT',
    )
  })
})
