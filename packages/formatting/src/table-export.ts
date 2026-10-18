// ============================================
// packages/formatting/src/table-export.ts
//
// A table of records as a file: Markdown text and a real .xlsx.
//
// ⚠️ A REAL .xlsx, WITH NO LIBRARY. An .xlsx is a zip of a few XML files.
// Written here with an uncompressed ("stored") zip and a hand-rolled crc32,
// so the same code runs on the server, in the browser and in the Windows app —
// the backup export and the per-table exports are one writer, not two that
// drift. Cells are inline strings or numbers; nothing is a formula, so a value
// starting with «=» is text, not an instruction (no CSV/formula injection).
// ============================================

// ─── Values as file text ───────────────────────────────────────────────────

/** Union of keys across rows, in first-seen order. */
export function columnsOf(rows: readonly unknown[]): string[] {
  const seen = new Set<string>()
  for (const row of rows) {
    if (row && typeof row === 'object') for (const key of Object.keys(row)) seen.add(key)
  }
  return [...seen]
}

/** One value as file text: null/undefined are empty, an object is JSON. */
export function cellText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

// ─── Markdown ──────────────────────────────────────────────────────────────

/** Pipes and newlines cannot break a table cell; a backslash stays visible. */
export function mdEscape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

/** The header, the separator and one line per row — the whole table. */
export function markdownTable(
  headers: readonly string[],
  rows: ReadonlyArray<readonly unknown[]>,
): string {
  const head = `| ${headers.map(mdEscape).join(' | ')} |`
  const separator = `| ${headers.map(() => '---').join(' | ')} |`
  const body = rows.map((row) => `| ${row.map((value) => mdEscape(cellText(value))).join(' | ')} |`)
  return [head, separator, ...body].join('\n')
}

// ─── .xlsx ────────────────────────────────────────────────────────────────

export interface XlsxSheet {
  /** The sheet's tab name; Excel's own rules are applied to it. */
  name: string
  rows: readonly unknown[]
}

/** CRC-32 (IEEE), the checksum every zip entry carries. Table built once. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i += 1) c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const encoder = new TextEncoder()

function utf8(text: string): Uint8Array {
  return encoder.encode(text)
}

/**
 * Drops C0 control characters other than tab, newline and carriage return —
 * XML 1.0 forbids them, and one would make Excel refuse the whole file.
 */
function withoutControlChars(text: string): string {
  let out = ''
  for (const ch of text) {
    const code = ch.charCodeAt(0)
    if (code >= 0x20 || code === 0x09 || code === 0x0a || code === 0x0d) out += ch
  }
  return out
}

function xmlEscape(text: string): string {
  return withoutControlChars(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function columnName(index: number): string {
  let name = ''
  let n = index + 1
  while (n > 0) {
    const rem = (n - 1) % 26
    name = String.fromCharCode(65 + rem) + name
    n = Math.floor((n - 1) / 26)
  }
  return name
}

function cellXml(ref: string, value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value))
    return `<c r="${ref}"><v>${value}</v></c>`
  const text = cellText(value)
  if (text === '') return ''
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(text)}</t></is></c>`
}

function sheetXml(rows: readonly unknown[]): string {
  const columns = columnsOf(rows)
  const out: string[] = []
  const header = columns.map((c, i) => cellXml(`${columnName(i)}1`, c)).join('')
  out.push(`<row r="1">${header}</row>`)
  rows.forEach((row, r) => {
    const record = row as Record<string, unknown>
    const cells = columns.map((c, i) => cellXml(`${columnName(i)}${r + 2}`, record[c])).join('')
    out.push(`<row r="${r + 2}">${cells}</row>`)
  })
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<sheetData>${out.join('')}</sheetData></worksheet>`
  )
}

/** Excel's rules: ≤ 31 characters, none of []:*?/\ , unique. */
function sheetNames(names: readonly string[]): string[] {
  const used = new Set<string>()
  return names.map((raw) => {
    const base = raw.replace(/[[\]:*?/\\]/g, '_').slice(0, 28) || 'sheet'
    let name = base
    for (let i = 2; used.has(name.toLowerCase()); i += 1) name = `${base}_${i}`
    used.add(name.toLowerCase())
    return name
  })
}

// ─── Zip ──────────────────────────────────────────────────────────────────

interface ZipEntry {
  name: string
  data: Uint8Array
}

function writeU16(target: Uint8Array, offset: number, value: number): void {
  target[offset] = value & 0xff
  target[offset + 1] = (value >>> 8) & 0xff
}

function writeU32(target: Uint8Array, offset: number, value: number): void {
  target[offset] = value & 0xff
  target[offset + 1] = (value >>> 8) & 0xff
  target[offset + 2] = (value >>> 16) & 0xff
  target[offset + 3] = (value >>> 24) & 0xff
}

// No return annotation on purpose: `Uint8Array<ArrayBuffer>` is TypeScript ≥5.7
// syntax and the mobile host type-checks this file with 5.3. Inferred from
// `new Uint8Array(size)`, it is still `Uint8Array<ArrayBuffer>` on 5.9.
function concat(parts: readonly Uint8Array[]) {
  let size = 0
  for (const part of parts) size += part.length
  const out = new Uint8Array(size)
  let at = 0
  for (const part of parts) {
    out.set(part, at)
    at += part.length
  }
  return out
}

/** A minimal zip: every entry stored (no compression), UTF-8 names. */
function zip(files: readonly ZipEntry[]) {
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0
  for (const file of files) {
    const name = utf8(file.name)
    const crc = crc32(file.data)
    const local = new Uint8Array(30)
    writeU32(local, 0, 0x04034b50)
    writeU16(local, 4, 20) // version needed
    writeU16(local, 6, 0x0800) // UTF-8 names
    writeU16(local, 8, 0) // stored
    // 10..13: time and date stay zero — the bytes must not depend on the clock
    writeU32(local, 14, crc)
    writeU32(local, 18, file.data.length)
    writeU32(local, 22, file.data.length)
    writeU16(local, 26, name.length)
    // 28: extra field length stays zero
    locals.push(local, name, file.data)

    const central = new Uint8Array(46)
    writeU32(central, 0, 0x02014b50)
    writeU16(central, 4, 20) // version made by
    writeU16(central, 6, 20) // version needed
    writeU16(central, 8, 0x0800) // UTF-8 names
    writeU16(central, 10, 0) // stored
    // 12..15: time and date stay zero
    writeU32(central, 16, crc)
    writeU32(central, 20, file.data.length)
    writeU32(central, 24, file.data.length)
    writeU16(central, 28, name.length)
    // 30..41: extra, comment, disk and attributes stay zero
    writeU32(central, 42, offset)
    centrals.push(central, name)
    offset += 30 + name.length + file.data.length
  }
  let centralSize = 0
  for (const central of centrals) centralSize += central.length
  const end = new Uint8Array(22)
  writeU32(end, 0, 0x06054b50)
  // 4, 6: this disk and the central directory's disk stay zero
  writeU16(end, 8, files.length)
  writeU16(end, 10, files.length)
  writeU32(end, 12, centralSize)
  writeU32(end, 16, offset)
  // 20: archive comment length stays zero
  return concat([...locals, ...centrals, end])
}

// ─── Workbook ─────────────────────────────────────────────────────────────

/**
 * One sheet per data set: the sheet's own XML, the workbook and the parts zip.
 *
 * Returns an `ArrayBuffer`-backed view, so a browser can hand it straight to
 * `new Blob([...])` — a `SharedArrayBuffer` view would be refused there and
 * TypeScript says so.
 */
export function buildXlsx(sheets: readonly XlsxSheet[]) {
  const names = sheetNames(sheets.map((sheet) => sheet.name))

  const workbook =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
    names
      .map((n, i) => `<sheet name="${xmlEscape(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join('') +
    '</sheets></workbook>'
  const workbookRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    names
      .map(
        (_n, i) =>
          `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
      )
      .join('') +
    '</Relationships>'
  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    names
      .map(
        (_n, i) =>
          `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
      )
      .join('') +
    '</Types>'
  const rootRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>'

  return zip([
    { name: '[Content_Types].xml', data: utf8(contentTypes) },
    { name: '_rels/.rels', data: utf8(rootRels) },
    { name: 'xl/workbook.xml', data: utf8(workbook) },
    { name: 'xl/_rels/workbook.xml.rels', data: utf8(workbookRels) },
    ...sheets.map((sheet, i) => ({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      data: utf8(sheetXml(sheet.rows)),
    })),
  ])
}
