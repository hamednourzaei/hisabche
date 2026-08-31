// ============================================
// backend/src/services/migration/migration.domain.ts
//
// Bringing a business that already exists into Hisabche.
//
// ---------------------------------------------------------------------------
// EVERYTHING HERE TREATS THE FILE AS HOSTILE
//
// An uploaded export is not data — it is a claim about data, written by
// software nobody here controls, edited by hand, and saved in whatever the
// author's spreadsheet felt like using that day. Nothing in this file trusts
// a header name, a delimiter, a decimal separator, a date order, or the idea
// that a row has the number of cells its header promised.
//
// This module is pure on purpose. It never reads the database and never
// writes one, so every hostile shape a real export can take is reachable from
// a test rather than only from production.
//
// ---------------------------------------------------------------------------
// WHY NO XLSX AND NO SQL DUMP YET
//
// The roadmap lists both. Neither is offered by the UI, because a format may
// not be advertised before its parser, its validator and its security
// controls actually exist. Restoring a PostgreSQL dump can execute code the
// dump's author chose; that is an isolated-parser problem, not a "call a
// library" problem. Delimited UTF-8 text is what is genuinely safe today, and
// claiming more would be the fake import the directive forbids.
// ============================================

/* ─── What a migration can carry ──────────────────────────────────────────── */

/**
 * Only the two catalogue entities.
 *
 * Invoices and payments are deliberately absent. A row in a spreadsheet is not
 * a journal entry, and turning one into a posting without the ledger's own
 * service would create a second financial truth — the thing the whole
 * architecture exists to prevent. Customers and products post nothing.
 */
export const MIGRATION_ENTITIES = ['customer', 'product'] as const
export type MigrationEntity = (typeof MIGRATION_ENTITIES)[number]

export const MIGRATION_STATUSES = [
  'uploaded',
  'scanning',
  'scanned',
  'mapping',
  'validating',
  'ready',
  'importing',
  'reconciling',
  'completed',
  'completed_with_warnings',
  'failed',
  'cancelled',
] as const
export type MigrationStatus = (typeof MIGRATION_STATUSES)[number]

/** Formats the parser actually handles. Nothing else may be offered. */
export const MIGRATION_SOURCE_TYPES = ['csv', 'tsv'] as const
export type MigrationSourceType = (typeof MIGRATION_SOURCE_TYPES)[number]

/* ─── Intake limits ───────────────────────────────────────────────────────── */

/**
 * Ceilings, not guesses.
 *
 * The byte cap is checked on the decoded text rather than on a Content-Length
 * header, because a header is a claim by the sender. The cell cap exists
 * because rows × columns, not bytes, is what a parser has to hold.
 */
export const INTAKE_LIMITS = {
  maxBytes: 8 * 1024 * 1024,
  maxRows: 50_000,
  maxColumns: 120,
  maxCells: 1_500_000,
  maxFieldChars: 4_000,
} as const

export interface IntakeRejection {
  code:
    | 'FILE_EMPTY'
    | 'FILE_TOO_LARGE'
    | 'TOO_MANY_ROWS'
    | 'TOO_MANY_COLUMNS'
    | 'TOO_MANY_CELLS'
    | 'BINARY_CONTENT'
    | 'NO_HEADER_ROW'
  detail?: string
}

/**
 * Is this text something the parser may look at at all?
 *
 * The binary check is the one that matters. A user who picks the .xlsx instead
 * of the .csv gets a sentence explaining that, rather than a parse that
 * "succeeds" and reports eleven thousand customers named after ZIP headers.
 * The filename is never consulted — an extension is a claim, and OWASP's
 * upload guidance is explicit that content, not name, decides.
 */
export function checkIntake(text: string): IntakeRejection | null {
  if (text.length === 0) return { code: 'FILE_EMPTY' }

  const bytes = Buffer.byteLength(text, 'utf8')
  if (bytes > INTAKE_LIMITS.maxBytes) {
    return { code: 'FILE_TOO_LARGE', detail: `${bytes}` }
  }

  // A NUL byte, or the local-file header of a ZIP container (xlsx, ods, and
  // every office format that is a zip in a trench coat).
  if (text.includes('\u0000') || text.slice(0, 2) === 'PK') {
    return { code: 'BINARY_CONTENT' }
  }

  return null
}

/* ─── Parsing ─────────────────────────────────────────────────────────────── */

export interface ParsedTable {
  delimiter: string
  headers: string[]
  rows: string[][]
  /** Rows whose cell count did not match the header. Never silently dropped. */
  raggedRows: number[]
}

const DELIMITERS = [',', ';', '\t', '|'] as const

/**
 * Pick the delimiter by counting it OUTSIDE quotes on the header line.
 *
 * Counting inside quotes is how `"Ahmadi, Karim"` turns a one-column export
 * into a two-column one. Semicolon comes up constantly: a spreadsheet saved in
 * a locale whose decimal mark is a comma writes CSV with semicolons, and a
 * good share of local business exports arrive that way.
 */
export function detectDelimiter(firstLine: string): string {
  let best = ','
  let bestCount = 0

  for (const candidate of DELIMITERS) {
    let count = 0
    let quoted = false

    for (let index = 0; index < firstLine.length; index += 1) {
      const char = firstLine[index]
      if (char === '"') {
        quoted = !quoted
        continue
      }
      if (!quoted && char === candidate) count += 1
    }

    if (count > bestCount) {
      best = candidate
      bestCount = count
    }
  }

  return best
}

/**
 * RFC 4180 with the concessions reality requires: a BOM, CRLF or LF, doubled
 * quotes inside quoted fields, and newlines inside quoted fields.
 *
 * A ragged row is RECORDED, not dropped and not padded silently. "Silently
 * skip records" is on the forbidden list, and a row with a missing cell is
 * usually a stray delimiter in an address — something the user can fix once
 * they are told which row.
 */
export function parseDelimited(input: string, delimiter?: string): ParsedTable {
  // A leading BOM would otherwise become part of the first header name, and
  // then that header matches no mapping rule and the whole first column looks
  // unrecognised.
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input

  const firstBreak = text.search(/\r?\n/)
  const firstLine = firstBreak === -1 ? text : text.slice(0, firstBreak)
  const sep = delimiter ?? detectDelimiter(firstLine)

  const records: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  const endField = () => {
    row.push(
      field.length > INTAKE_LIMITS.maxFieldChars
        ? field.slice(0, INTAKE_LIMITS.maxFieldChars)
        : field,
    )
    field = ''
  }
  const endRow = () => {
    endField()
    // A trailing newline produces one final empty row; that is punctuation,
    // not a record.
    if (!(row.length === 1 && row[0] === '')) records.push(row)
    row = []
  }

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!

    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          quoted = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"' && field === '') {
      quoted = true
    } else if (char === sep) {
      endField()
    } else if (char === '\n') {
      endRow()
    } else if (char === '\r') {
      // Swallowed; the \n that follows ends the row.
    } else {
      field += char
    }
  }

  if (field !== '' || row.length > 0) endRow()

  const headerRow = records.shift() ?? []
  const headers = headerRow.map((cell) => cell.trim())

  const raggedRows: number[] = []
  const rows: string[][] = []

  records.forEach((record, index) => {
    if (record.length !== headers.length) raggedRows.push(index)
    // Padded so a mapping never reads past the end, but the row stays in the
    // ragged list so the user is told.
    const padded = [...record]
    while (padded.length < headers.length) padded.push('')
    rows.push(padded.slice(0, headers.length))
  })

  return { delimiter: sep, headers, rows, raggedRows }
}

/** Shape checks that need the parse result rather than the raw text. */
export function checkParsed(table: ParsedTable): IntakeRejection | null {
  if (table.headers.length === 0 || table.headers.every((header) => header === '')) {
    return { code: 'NO_HEADER_ROW' }
  }
  if (table.headers.length > INTAKE_LIMITS.maxColumns) {
    return { code: 'TOO_MANY_COLUMNS', detail: `${table.headers.length}` }
  }
  if (table.rows.length > INTAKE_LIMITS.maxRows) {
    return { code: 'TOO_MANY_ROWS', detail: `${table.rows.length}` }
  }
  if (table.rows.length * table.headers.length > INTAKE_LIMITS.maxCells) {
    return { code: 'TOO_MANY_CELLS' }
  }
  return null
}

/* ─── Normalisation ───────────────────────────────────────────────────────── */

/** Persian and Arabic-Indic digits, which every local export is full of. */
const DIGIT_MAP: Record<string, string> = {
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
}

export function normalizeDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (digit) => DIGIT_MAP[digit] ?? digit)
}

/**
 * Whitespace, Unicode form, and the invisible characters that make two
 * identical-looking names fail an equality check.
 *
 * The zero-width non-joiner matters here rather than being pedantry: Persian
 * writes it inside ordinary words, and one export having it where another does
 * not is the single most common reason a duplicate is missed.
 */
export function normalizeText(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\u200b-\u200f\u202a-\u202e\u2060\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * A comparison key. Lower-cased and stripped, never stored as the value.
 *
 * Underscores, slashes and dots become spaces rather than vanishing, so
 * `customer_phone_number` keys as three words. Deleting them instead would
 * glue the words together and make token-boundary matching — the thing that
 * stops the alias `customer` claiming a phone column — impossible.
 */
export function comparisonKey(value: string): string {
  return normalizeDigits(normalizeText(value))
    .toLowerCase()
    .replace(/[_/\\.]+/g, ' ')
    .replace(/[,'"`،؛()[\]-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizePhone(value: string): string {
  const digits = normalizeDigits(normalizeText(value)).replace(/[^\d+]/g, '')
  if (digits === '') return ''
  // Local mobile numbers arrive as 07…, +937…, 00937… and 937… — all the same
  // phone. Reduced to a national 0-prefixed form so duplicate detection sees
  // one customer rather than four.
  if (digits.startsWith('+93')) return `0${digits.slice(3)}`
  if (digits.startsWith('0093')) return `0${digits.slice(4)}`
  if (digits.startsWith('93') && digits.length >= 11) return `0${digits.slice(2)}`
  return digits
}

export function normalizeEmail(value: string): string {
  return normalizeText(value).toLowerCase()
}

export interface MoneyParse {
  ok: boolean
  minor?: number
  reason?: 'EMPTY' | 'NOT_A_NUMBER' | 'AMBIGUOUS_SEPARATOR' | 'TOO_LARGE'
}

/**
 * A written amount into integer minor units.
 *
 * Never through `parseFloat` on the raw cell. `1,234.50` and `1.234,50` are the
 * same money written by two locales, and a float parse reads the second as
 * one-point-two. The rule used is the LAST separator: whichever of `.` or `,`
 * appears last, with one to two digits after it, is the decimal mark. When
 * only one separator is present and it has exactly three digits after it, it
 * is a thousands group, not a decimal — `1,500` is fifteen hundred.
 *
 * Genuine ambiguity is REFUSED rather than guessed. Money the importer is not
 * sure about is money the user must look at.
 */
export function parseMoneyMinor(raw: string, scale = 2): MoneyParse {
  const text = normalizeDigits(normalizeText(raw))
  if (text === '') return { ok: false, reason: 'EMPTY' }

  const negative = /^\(.*\)$/.test(text) || text.trimStart().startsWith('-')
  const body = text.replace(/[()\s+-]/g, '').replace(/[^\d.,]/g, '')
  if (body === '' || !/\d/.test(body)) return { ok: false, reason: 'NOT_A_NUMBER' }

  const lastDot = body.lastIndexOf('.')
  const lastComma = body.lastIndexOf(',')
  let decimalAt = -1

  if (lastDot >= 0 && lastComma >= 0) {
    decimalAt = Math.max(lastDot, lastComma)
  } else if (lastDot >= 0 || lastComma >= 0) {
    const only = Math.max(lastDot, lastComma)
    const after = body.length - only - 1
    if (after === 3 && only > 0) {
      // `1,500` / `1.500` — a thousands group.
      decimalAt = -1
    } else if (after >= 1 && after <= 2) {
      decimalAt = only
    } else {
      return { ok: false, reason: 'AMBIGUOUS_SEPARATOR' }
    }
  }

  const whole = (decimalAt === -1 ? body : body.slice(0, decimalAt)).replace(/[.,]/g, '')
  const fraction = decimalAt === -1 ? '' : body.slice(decimalAt + 1).replace(/[.,]/g, '')

  if (!/^\d*$/.test(whole) || !/^\d*$/.test(fraction)) return { ok: false, reason: 'NOT_A_NUMBER' }

  const padded = (fraction + '0'.repeat(scale)).slice(0, scale)
  const combined = `${whole || '0'}${padded}`
  const minor = Number(combined)

  if (!Number.isSafeInteger(minor)) return { ok: false, reason: 'TOO_LARGE' }
  return { ok: true, minor: negative ? -minor : minor }
}

export interface DateParse {
  ok: boolean
  iso?: string
  reason?: 'EMPTY' | 'UNPARSEABLE' | 'AMBIGUOUS_ORDER' | 'OUT_OF_RANGE'
}

/**
 * A written date into an ISO calendar date.
 *
 * `31/12/2024` is unambiguous — no month is 31 — but `03/04/2024` is two
 * different days depending on who exported it, and the roadmap is explicit
 * that it must not be interpreted silently. So `dayFirst` is a DECLARED fact
 * about the source, and when it is unknown and the digits do not settle it,
 * the row is refused rather than guessed.
 */
export function parseDateIso(raw: string, dayFirst?: boolean): DateParse {
  const text = normalizeDigits(normalizeText(raw))
  if (text === '') return { ok: false, reason: 'EMPTY' }

  const build = (year: number, month: number, day: number): DateParse => {
    if (month < 1 || month > 12 || day < 1 || day > 31) return { ok: false, reason: 'OUT_OF_RANGE' }
    if (year < 1900 || year > 2200) return { ok: false, reason: 'OUT_OF_RANGE' }
    const back = new Date(Date.UTC(year, month - 1, day))
    // Rejects 31 February, which the range check above cannot see.
    if (back.getUTCMonth() !== month - 1 || back.getUTCDate() !== day) {
      return { ok: false, reason: 'OUT_OF_RANGE' }
    }
    return { ok: true, iso: back.toISOString().slice(0, 10) }
  }

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text)
  if (iso) return build(Number(iso[1]), Number(iso[2]), Number(iso[3]))

  const parts = /^(\d{1,4})[/.-](\d{1,2})[/.-](\d{1,4})$/.exec(text)
  if (!parts) return { ok: false, reason: 'UNPARSEABLE' }

  const a = Number(parts[1])
  const b = Number(parts[2])
  const c = Number(parts[3])

  if (a > 31) return build(a, b, c) // yyyy/mm/dd
  if (c <= 31) return { ok: false, reason: 'AMBIGUOUS_ORDER' } // no year anywhere
  if (a > 12) return build(c, b, a) // dd/mm/yyyy, settled by the digits
  if (b > 12) return build(c, a, b) // mm/dd/yyyy, settled by the digits
  if (dayFirst === undefined) return { ok: false, reason: 'AMBIGUOUS_ORDER' }
  return dayFirst ? build(c, b, a) : build(c, a, b)
}

const TRUE_WORDS = new Set(['1', 'true', 'yes', 'y', 'بله', 'فعال'])
const FALSE_WORDS = new Set(['0', 'false', 'no', 'n', 'خیر', 'نه', 'غیرفعال'])

export function parseBoolean(raw: string): boolean | null {
  const text = comparisonKey(raw)
  if (TRUE_WORDS.has(text)) return true
  if (FALSE_WORDS.has(text)) return false
  return null
}
