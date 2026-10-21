// ============================================
// Reading an .xlsx workbook into rows of text — one reader for every runtime.
//
// The server (Node), the Windows app's local engine (Node) and the Android
// app's local engine (Hermes) all read a workbook HERE, so a file reads the
// same way online and offline (offline xlsx import, 21 Oct 2026).
//
// An .xlsx file is a ZIP of XML parts. The three this needs are the shared
// string table, the style table (to tell a date from a number) and the sheets.
//
// ⚠️ NO NODE BUILT-INS. Bytes are a `Uint8Array` (a Node Buffer is one too),
// text is `TextDecoder`, and the one inflate step is `fflate` — pure JS. The
// first version used `node:zlib` and `Buffer` methods; Hermes has neither, so
// offline Excel import was refused on the phone.
//
// WHAT IT DOES NOT DO, and says so:
//   • .xls (the old binary format) is refused by name, with the way out;
//   • formulas are read as the value Excel last computed, never evaluated;
//   • ZIP64 and encrypted workbooks are refused.
//
// Pure: bytes in, rows out. No database, no clock.
// ============================================

import { Inflate } from 'fflate'

/** What a file brought in for import may hold — one set of limits everywhere. */
export const INTAKE_LIMITS = {
  maxBytes: 8 * 1024 * 1024,
  maxRows: 50_000,
  maxColumns: 120,
  maxCells: 1_500_000,
  maxFieldChars: 4_000,
} as const

export type XlsxRejection =
  'XLSX_NOT_A_WORKBOOK' | 'XLSX_OLD_FORMAT' | 'XLSX_ENCRYPTED' | 'XLSX_TOO_LARGE' | 'XLSX_NO_SHEET'

export class XlsxError extends Error {
  constructor(public readonly code: XlsxRejection) {
    super(code)
    this.name = 'XlsxError'
  }
}

export interface XlsxSheet {
  name: string
  /** Every row as text, ragged rows padded to the widest. Empty rows dropped. */
  rows: string[][]
}

/** What one part may inflate to. A workbook that needs more is not a ledger export. */
const MAX_PART_BYTES = 64 * 1024 * 1024
/** How many sheets a workbook may list. */
const MAX_SHEETS = 60

const utf8 = new TextDecoder('utf-8')

/* ─── Bytes ───────────────────────────────────────────────────────────────── */

const u16 = (file: Uint8Array, at: number): number => file[at]! | (file[at + 1]! << 8)
const u32 = (file: Uint8Array, at: number): number =>
  (file[at]! | (file[at + 1]! << 8) | (file[at + 2]! << 16) | (file[at + 3]! << 24)) >>> 0

/** Does `file` contain `text` written as UTF-16LE (the OLE stream names)? */
function containsUtf16(file: Uint8Array, text: string): boolean {
  const needle = new Uint8Array(text.length * 2)
  for (let index = 0; index < text.length; index++) needle[index * 2] = text.charCodeAt(index)
  outer: for (let at = 0; at <= file.length - needle.length; at++) {
    for (let k = 0; k < needle.length; k++) if (file[at + k] !== needle[k]) continue outer
    return true
  }
  return false
}

/* ─── ZIP ─────────────────────────────────────────────────────────────────── */

interface ZipEntry {
  method: number
  compressedSize: number
  localOffset: number
}

function readDirectory(file: Uint8Array): Map<string, ZipEntry> {
  // The old binary format starts with the OLE signature, not «PK».
  if (file.length >= 8 && u32(file, 0) === 0xe011cfd0) {
    // An encrypted .xlsx is ALSO an OLE container; either way it cannot be read.
    throw new XlsxError(
      containsUtf16(file, 'EncryptedPackage') ? 'XLSX_ENCRYPTED' : 'XLSX_OLD_FORMAT',
    )
  }
  if (file.length < 22 || u32(file, 0) !== 0x04034b50) {
    throw new XlsxError('XLSX_NOT_A_WORKBOOK')
  }

  // End-of-central-directory: searched backwards past an optional comment.
  let end = -1
  for (let at = file.length - 22; at >= Math.max(0, file.length - 22 - 0xffff); at--) {
    if (u32(file, at) === 0x06054b50) {
      end = at
      break
    }
  }
  if (end < 0) throw new XlsxError('XLSX_NOT_A_WORKBOOK')

  const count = u16(file, end + 10)
  let at = u32(file, end + 16)
  if (count === 0xffff || at === 0xffffffff) throw new XlsxError('XLSX_TOO_LARGE')

  const entries = new Map<string, ZipEntry>()
  for (let index = 0; index < count; index++) {
    if (at + 46 > file.length || u32(file, at) !== 0x02014b50) {
      throw new XlsxError('XLSX_NOT_A_WORKBOOK')
    }
    const nameLength = u16(file, at + 28)
    const extraLength = u16(file, at + 30)
    const commentLength = u16(file, at + 32)
    const name = utf8.decode(file.subarray(at + 46, at + 46 + nameLength))
    entries.set(name, {
      method: u16(file, at + 10),
      compressedSize: u32(file, at + 20),
      localOffset: u32(file, at + 42),
    })
    at += 46 + nameLength + extraLength + commentLength
  }
  return entries
}

/**
 * Inflate one part, refusing past MAX_PART_BYTES.
 *
 * The zip-bomb guard: a few kilobytes of zeros inflate to gigabytes, and the
 * size in the header is only a claim — so the output is counted as it comes.
 */
function inflatePart(packed: Uint8Array): Uint8Array {
  const chunks: Uint8Array[] = []
  let total = 0
  let tooLarge = false
  const inflater = new Inflate((chunk) => {
    total += chunk.length
    if (total > MAX_PART_BYTES) {
      tooLarge = true
      throw new XlsxError('XLSX_TOO_LARGE')
    }
    chunks.push(chunk)
  })
  try {
    inflater.push(packed, true)
  } catch {
    throw new XlsxError(tooLarge ? 'XLSX_TOO_LARGE' : 'XLSX_NOT_A_WORKBOOK')
  }
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

/**
 * A part with the namespace prefixes taken off its TAG names.
 *
 * Excel writes `<row>`; some libraries that produce workbooks write
 * `<x:row>`. Both are the same element. Without this such a workbook read as
 * having no rows at all, and was refused as empty — a wrong reason, for a
 * file that opens perfectly well. Attributes (`r:id`) are left as they are.
 */
function readPart(file: Uint8Array, entries: Map<string, ZipEntry>, name: string): string | null {
  const xml = readRawPart(file, entries, name)
  return xml === null ? null : xml.replace(/<(\/?)[A-Za-z][A-Za-z0-9]*:/g, '<$1')
}

function readRawPart(
  file: Uint8Array,
  entries: Map<string, ZipEntry>,
  name: string,
): string | null {
  const entry = entries.get(name)
  if (!entry) return null

  const at = entry.localOffset
  if (at + 30 > file.length || u32(file, at) !== 0x04034b50) {
    throw new XlsxError('XLSX_NOT_A_WORKBOOK')
  }
  const start = at + 30 + u16(file, at + 26) + u16(file, at + 28)
  const packed = file.subarray(start, start + entry.compressedSize)

  if (entry.method === 0) {
    if (packed.length > MAX_PART_BYTES) throw new XlsxError('XLSX_TOO_LARGE')
    return utf8.decode(packed)
  }
  if (entry.method !== 8) throw new XlsxError('XLSX_NOT_A_WORKBOOK')
  return utf8.decode(inflatePart(packed))
}

/* ─── XML ─────────────────────────────────────────────────────────────────── */

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

function decodeXml(text: string): string {
  return (
    text
      .replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-z]+);/g, (whole, body: string) => {
        if (body.startsWith('#x')) return String.fromCodePoint(parseInt(body.slice(2), 16))
        if (body.startsWith('#')) return String.fromCodePoint(parseInt(body.slice(1), 10))
        return NAMED[body] ?? whole
      })
      // Excel writes a control character inside a cell as _xHHHH_.
      .replace(/_x([0-9a-fA-F]{4})_/g, (_whole, hex: string) =>
        String.fromCharCode(parseInt(hex, 16)),
      )
  )
}

const attribute = (tag: string, name: string): string | null =>
  new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? null

/** The text of every `<t>` run in a string item, phonetic guides left out. */
function textRuns(xml: string): string {
  const withoutPhonetic = xml.replace(/<rPh[\s>][\s\S]*?<\/rPh>/g, '')
  let out = ''
  for (const run of withoutPhonetic.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) {
    out += decodeXml(run[1] ?? '')
  }
  return out
}

function sharedStrings(xml: string | null): string[] {
  if (!xml) return []
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)].map((item) => textRuns(item[1] ?? ''))
}

/* ─── Dates ───────────────────────────────────────────────────────────────── */

// Built-in number formats that mean a date or a date-time.
const BUILT_IN_DATES = new Set([
  14, 15, 16, 17, 22, 27, 28, 29, 30, 31, 34, 35, 36, 50, 51, 52, 53, 54, 55, 56, 57, 58,
])

/** A custom format is a date when it names a day, month or year outside quotes and brackets. */
function isDateFormat(code: string): boolean {
  const bare = code
    .replace(/"[^"]*"/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\\./g, '')
  return /[dmy]/i.test(bare) && !/^[#0?,.\s%E+-]*$/i.test(bare)
}

/** For each cell style index: does it show its number as a date? */
function dateStyles(xml: string | null): boolean[] {
  if (!xml) return []
  const custom = new Map<number, string>()
  for (const tag of xml.matchAll(/<numFmt\s[^>]*>/g)) {
    const id = Number(attribute(tag[0], 'numFmtId'))
    custom.set(id, decodeXml(attribute(tag[0], 'formatCode') ?? ''))
  }
  const cellXfs = /<cellXfs[\s>][\s\S]*?<\/cellXfs>/.exec(xml)?.[0] ?? ''
  return [...cellXfs.matchAll(/<xf\s[^>]*>/g)].map((tag) => {
    const id = Number(attribute(tag[0], 'numFmtId') ?? 0)
    const code = custom.get(id)
    return code !== undefined ? isDateFormat(code) : BUILT_IN_DATES.has(id)
  })
}

/**
 * An Excel serial day as `YYYY-MM-DD` (and the time, when there is one).
 *
 * Day 1 is 1 January 1900 and Excel believes 1900 was a leap year, so every
 * serial from 61 up is one day ahead of the real calendar — hence the epoch of
 * 30 December 1899. The 1904 system (old Mac workbooks) starts 1,462 days later.
 */
export function serialToIso(serial: number, date1904: boolean): string {
  const days = Math.floor(serial)
  const epoch = Date.UTC(1899, 11, 30) + (date1904 ? 1462 : 0) * 86_400_000
  const day = new Date(epoch + days * 86_400_000).toISOString().slice(0, 10)

  const seconds = Math.round((serial - days) * 86_400)
  if (seconds === 0 || seconds === 86_400) return day
  const hh = String(Math.floor(seconds / 3600)).padStart(2, '0')
  const mm = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')
  return `${day} ${hh}:${mm}`
}

/** A stored number without the binary-float tail (`1.1000000000000001` → `1.1`). */
function tidyNumber(raw: string): string {
  const value = Number(raw)
  if (!Number.isFinite(value)) return raw
  return String(Number(value.toPrecision(15)))
}

/* ─── Sheets ──────────────────────────────────────────────────────────────── */

function columnIndex(reference: string): number {
  let index = 0
  for (const char of reference) {
    const code = char.charCodeAt(0)
    if (code < 65 || code > 90) break
    index = index * 26 + (code - 64)
  }
  return index - 1
}

function readSheet(
  xml: string,
  strings: string[],
  styles: boolean[],
  date1904: boolean,
): string[][] {
  const rows: string[][] = []
  let cells = 0
  let width = 0

  for (const rowMatch of xml.matchAll(/<row[\s>][\s\S]*?<\/row>/g)) {
    const row: string[] = []
    let next = 0

    for (const cell of rowMatch[0].matchAll(/<c(\s[^>]*?)?(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const tag = cell[1] ?? ''
      const body = cell[2] ?? ''
      const reference = attribute(tag, 'r')
      const column = reference ? columnIndex(reference) : next
      next = column + 1
      if (column < 0) continue
      if (column >= INTAKE_LIMITS.maxColumns) throw new XlsxError('XLSX_TOO_LARGE')

      const type = attribute(tag, 't')
      const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1]
      let text = ''

      if (type === 'inlineStr') text = textRuns(body)
      else if (raw === undefined) text = ''
      else if (type === 's') text = strings[Number(raw)] ?? ''
      else if (type === 'str' || type === 'e') text = decodeXml(raw)
      else if (type === 'b') text = raw === '1' ? 'true' : 'false'
      else if (styles[Number(attribute(tag, 's') ?? -1)] && raw !== '') {
        text = serialToIso(Number(raw), date1904)
      } else text = tidyNumber(raw)

      while (row.length < column) row.push('')
      row[column] = text.slice(0, INTAKE_LIMITS.maxFieldChars)
    }

    if (row.every((value) => value.trim() === '')) continue

    cells += row.length
    if (rows.length >= INTAKE_LIMITS.maxRows + 1 || cells > INTAKE_LIMITS.maxCells) {
      throw new XlsxError('XLSX_TOO_LARGE')
    }
    width = Math.max(width, row.length)
    rows.push(row)
  }

  for (const row of rows) while (row.length < width) row.push('')
  return rows
}

/** Is this the start of a ZIP (an .xlsx) rather than text? */
export function looksLikeWorkbook(file: Uint8Array): boolean {
  return file.length >= 4 && file[0] === 0x50 && file[1] === 0x4b
}

/**
 * Every sheet of a workbook, in the order the workbook lists them.
 *
 * @throws XlsxError with a code the caller can translate
 */
export function readXlsx(file: Uint8Array): XlsxSheet[] {
  if (file.length > INTAKE_LIMITS.maxBytes) throw new XlsxError('XLSX_TOO_LARGE')

  const entries = readDirectory(file)
  const workbook = readPart(file, entries, 'xl/workbook.xml')
  if (!workbook) throw new XlsxError('XLSX_NOT_A_WORKBOOK')

  const relations = new Map<string, string>()
  for (const tag of (readPart(file, entries, 'xl/_rels/workbook.xml.rels') ?? '').matchAll(
    /<Relationship\s[^>]*>/g,
  )) {
    const id = attribute(tag[0], 'Id')
    const target = attribute(tag[0], 'Target')
    if (id && target) {
      relations.set(id, target.startsWith('/') ? target.slice(1) : `xl/${target}`)
    }
  }

  const strings = sharedStrings(readPart(file, entries, 'xl/sharedStrings.xml'))
  const styles = dateStyles(readPart(file, entries, 'xl/styles.xml'))
  const date1904 = /<workbookPr\s[^>]*date1904="(?:1|true)"/.test(workbook)

  const sheets: XlsxSheet[] = []
  const listed = [...workbook.matchAll(/<sheet\s[^>]*>/g)]
  // A workbook of thousands of sheets is not a ledger; it is a way to keep the
  // reader busy for ever.
  if (listed.length > MAX_SHEETS) throw new XlsxError('XLSX_TOO_LARGE')
  for (const tag of listed) {
    const path = relations.get(attribute(tag[0], 'r:id') ?? '')
    const xml = path ? readPart(file, entries, path) : null
    // A chart sheet or a missing part has no rows to give.
    if (!xml || !path?.includes('worksheets/')) continue
    sheets.push({
      name: decodeXml(attribute(tag[0], 'name') ?? ''),
      rows: readSheet(xml, strings, styles, date1904),
    })
  }

  if (sheets.length === 0) throw new XlsxError('XLSX_NO_SHEET')
  return sheets
}

/**
 * Rows as comma-separated text, so a workbook enters the same pipeline a CSV
 * does — one parser, one set of limits, one set of findings.
 */
export function rowsToCsv(rows: readonly (readonly string[])[]): string {
  return rows
    .map((row) =>
      row
        .map((value) => (/[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value))
        .join(','),
    )
    .join('\n')
}
