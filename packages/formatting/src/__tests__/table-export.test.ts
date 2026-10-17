// ============================================
// A table as a file.
//
// The one thing an accountant does with an export is open it — so the .xlsx
// must be a real zip Excel accepts, with every entry's crc32 right, and the
// Markdown must survive a value containing a pipe. Node's own zlib.crc32 is
// the oracle for the zip: this writer and Node must agree on every entry.
// ============================================

import { crc32 as nodeCrc32 } from 'node:zlib'
import { describe, expect, it } from 'vitest'

import { buildXlsx, cellText, columnsOf, markdownTable } from '../table-export'

const decoder = new TextDecoder()

function decode(bytes: Uint8Array): string {
  return decoder.decode(bytes)
}

/** Walk the local headers of a stored zip — the file as a reader sees it. */
function zipEntries(zip: Uint8Array): Array<{ name: string; data: Uint8Array; crc: number }> {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength)
  const entries: Array<{ name: string; data: Uint8Array; crc: number }> = []
  let at = 0
  while (at + 30 <= zip.byteLength && view.getUint32(at, true) === 0x04034b50) {
    const crc = view.getUint32(at + 14, true)
    const size = view.getUint32(at + 18, true)
    const nameLength = view.getUint16(at + 26, true)
    expect(view.getUint16(at + 8, true), 'stored, not deflated').toBe(0)
    const name = decode(zip.subarray(at + 30, at + 30 + nameLength))
    const data = zip.subarray(at + 30 + nameLength, at + 30 + nameLength + size)
    entries.push({ name, data, crc })
    at += 30 + nameLength + size
  }
  expect(at, 'the walk ends exactly at the central directory').toBeLessThanOrEqual(zip.byteLength)
  return entries
}

describe('columnsOf', () => {
  it('is the union of the keys in first-seen order, across uneven rows', () => {
    expect(columnsOf([{ a: 1, b: 2 }, { b: 3, c: 4 }, null, 'x'])).toEqual(['a', 'b', 'c'])
    expect(columnsOf([])).toEqual([])
  })
})

describe('cellText', () => {
  it('null and undefined are empty, an object is JSON, a number is itself', () => {
    expect(cellText(null)).toBe('')
    expect(cellText(undefined)).toBe('')
    expect(cellText({ a: 1 })).toBe('{"a":1}')
    expect(cellText(1200.5)).toBe('1200.5')
  })
})

describe('markdownTable', () => {
  it('a pipe or a newline in a value cannot break the table', () => {
    const md = markdownTable(['name', 'note'], [['شال', 'a | b\nc']])
    expect(md).toBe(['| name | note |', '| --- | --- |', '| شال | a \\| b c |'].join('\n'))
  })

  it('null is an empty cell, and a backslash stays a backslash', () => {
    const md = markdownTable(['a', 'b'], [[null, 'C:\\temp']])
    expect(md).toBe(['| a | b |', '| --- | --- |', '|  | C:\\\\temp |'].join('\n'))
  })

  it('a header with a pipe is escaped too', () => {
    expect(markdownTable(['a|b'], []).split('\n')[0]).toBe('| a\\|b |')
  })
})

describe('buildXlsx', () => {
  const bytes = buildXlsx([
    {
      name: 'invoices',
      rows: [{ id: 'i1', total: 30000, note: '=HYPERLINK("x")' }],
    },
    { name: 'کالاها', rows: [{ نام: 'شال', تعداد: 5 }] },
  ])

  it('is a zip whose first bytes are the local file header signature', () => {
    expect(bytes[0]).toBe(0x50)
    expect(bytes[1]).toBe(0x4b)
    expect(bytes[2]).toBe(0x03)
    expect(bytes[3]).toBe(0x04)
  })

  it("every entry's crc32 and size is what Node itself computes", () => {
    for (const entry of zipEntries(bytes)) {
      expect(nodeCrc32(entry.data) >>> 0, entry.name).toBe(entry.crc)
      expect(entry.data.length, entry.name).toBeGreaterThan(0)
    }
  })

  it('carries the parts an .xlsx must have, one sheet per data set', () => {
    const names = zipEntries(bytes).map((entry) => entry.name)
    expect(names).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels',
      'xl/worksheets/sheet1.xml',
      'xl/worksheets/sheet2.xml',
    ])
  })

  it('writes numbers as numbers and never as formulas', () => {
    const sheet = zipEntries(bytes).find((entry) => entry.name === 'xl/worksheets/sheet1.xml')!
    const xml = decode(sheet.data)
    expect(xml).toContain('<c r="B2"><v>30000</v></c>')
    expect(xml).toContain('=HYPERLINK(&quot;x&quot;)')
    expect(xml).not.toContain('<f>')
  })

  it('keeps Persian text byte-for-byte through the UTF-8 round trip', () => {
    const sheet = zipEntries(bytes).find((entry) => entry.name === 'xl/worksheets/sheet2.xml')!
    const xml = decode(sheet.data)
    expect(xml).toContain('شال')
    expect(xml).toContain('<t xml:space="preserve">نام</t>')
    expect(xml).toContain('<c r="B2"><v>5</v></c>')
  })

  it('drops a control character XML forbids, rather than shipping a file Excel refuses', () => {
    const withControl = buildXlsx([{ name: 's', rows: [{ note: 'a\u0001b' }] }])
    const sheet = zipEntries(withControl).find(
      (entry) => entry.name === 'xl/worksheets/sheet1.xml',
    )!
    expect(decode(sheet.data)).toContain('ab')
    expect(decode(sheet.data)).not.toContain('\u0001')
  })

  it("sheet names follow Excel's rules: ≤ 31 characters, no []:*?/\\, unique", () => {
    const long = 'x'.repeat(40)
    const sheet = buildXlsx([
      { name: long, rows: [{ a: 1 }] },
      { name: `bad/name:${long}`, rows: [{ a: 1 }] },
      { name: long, rows: [{ a: 1 }] },
    ])
    const workbook = zipEntries(sheet).find((entry) => entry.name === 'xl/workbook.xml')!
    const names = [...decode(workbook.data).matchAll(/<sheet name="([^"]+)"/g)].map((m) => m[1]!)
    expect(names).toHaveLength(3)
    for (const name of names) {
      expect(name.length).toBeLessThanOrEqual(31)
      expect(name).not.toMatch(/[[\]:*?/\\]/)
    }
    expect(new Set(names).size).toBe(3)
  })

  it('names the first sheet with its own name, not «sheet1»', () => {
    const workbook = zipEntries(bytes).find((entry) => entry.name === 'xl/workbook.xml')!
    expect(decode(workbook.data)).toContain('<sheet name="invoices"')
  })
})
