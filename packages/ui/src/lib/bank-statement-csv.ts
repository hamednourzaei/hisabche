// ============================================
// packages/ui/src/lib/bank-statement-csv.ts
//
// A bank's CSV export → the lines `POST /finance/bank/statements` takes.
//
// ---------------------------------------------------------------------------
// WHY A PARSER AND NOT A FORMAT
//
// Every bank exports differently: Iranian banks write Jalali dates with Persian
// digits and split money into «برداشت» and «واریز» columns; Afghan and foreign
// banks write Gregorian dates and one signed «Amount». ERPNext and Odoo both
// solve this with a column-mapping step rather than per-bank code, and so does
// this: the header row is read, each column is recognised by its name in
// Persian, Dari or English, and the person confirms the result before
// anything is sent.
//
// ---------------------------------------------------------------------------
// MONEY STAYS INTEGER (راهنمای سشن §۱٫۳)
//
// «1,234.50» is split on the decimal point as TEXT and scaled by the
// currency's fraction digits. No float ever holds an amount here.
//
// ⚠️ A row that cannot be read is REPORTED, never skipped: a statement
// silently missing one withdrawal reconciles to a wrong balance that looks
// right.
// ============================================

import { toGregorian } from 'jalaali-js'
import { toLatinDigits } from '@hisabche/formatting'

export type BankColumn = 'date' | 'description' | 'amount' | 'debit' | 'credit' | 'reference'

/** Header names each column is recognised by. Lower-cased, trimmed. */
const HEADER_NAMES: Record<BankColumn, string[]> = {
  date: [
    'date',
    'transaction date',
    'value date',
    'posting date',
    'تاریخ',
    'تاریخ تراکنش',
    'تاریخ سند',
  ],
  description: [
    'description',
    'details',
    'narrative',
    'memo',
    'شرح',
    'توضیحات',
    'شرح تراکنش',
    'بابت',
  ],
  amount: ['amount', 'value', 'مبلغ', 'مبلغ تراکنش'],
  debit: ['debit', 'withdrawal', 'withdrawals', 'money out', 'برداشت', 'بدهکار', 'مبلغ برداشت'],
  credit: ['credit', 'deposit', 'deposits', 'money in', 'واریز', 'بستانکار', 'مبلغ واریز'],
  reference: [
    'reference',
    'ref',
    'transaction id',
    'شماره پیگیری',
    'شماره سند',
    'کد پیگیری',
    'شماره مرجع',
  ],
}

export interface ParsedLine {
  onDate: string
  amountMinor: number
  description: string
  externalRef: string | null
}

export interface RowProblem {
  /** 1-based, as a spreadsheet numbers it (the header is row 1). */
  row: number
  reason: 'DATE' | 'AMOUNT' | 'BOTH_SIDES'
  raw: string
}

export type ParseResult =
  | {
      ok: true
      lines: ParsedLine[]
      problems: RowProblem[]
      columns: Partial<Record<BankColumn, number>>
    }
  | { ok: false; reason: 'EMPTY' | 'NO_DATE_COLUMN' | 'NO_AMOUNT_COLUMN' }

/** Split one CSV text into rows of cells: quotes, escaped quotes, CRLF, BOM. */
export function splitCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const src = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
      continue
    }
    if (ch === '"' && cell.length === 0) quoted = true
    else if (ch === delimiter) {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

/** The delimiter the header line uses most: comma, semicolon or tab. */
export function detectDelimiter(text: string): string {
  const header = text.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] ?? ''
  const counts = [',', ';', '\t'].map((d) => [d, header.split(d).length - 1] as const)
  counts.sort((a, b) => b[1] - a[1])
  return counts[0]![1] > 0 ? counts[0]![0] : ','
}

export function detectColumns(header: string[]): Partial<Record<BankColumn, number>> {
  const found: Partial<Record<BankColumn, number>> = {}
  header.forEach((raw, index) => {
    const name = toLatinDigits(raw).trim().toLowerCase().replace(/\s+/g, ' ')
    for (const column of Object.keys(HEADER_NAMES) as BankColumn[]) {
      if (found[column] === undefined && HEADER_NAMES[column].includes(name)) {
        found[column] = index
        return
      }
    }
  })
  return found
}

/**
 * A money cell → minor units, or null. Accepts Persian/Arabic digits, the
 * Persian thousands (٬) and decimal (٫) separators, a leading minus, and a
 * bank's «(1,000)» for a negative.
 */
export function parseAmountMinor(raw: string, digits: 0 | 2 | 3): number | null {
  let text = toLatinDigits(raw)
    .replace(/٫/g, '.')
    .replace(/[٬,\s\u200e\u200f]/g, '')
    .trim()
  if (text === '' || text === '-') return null
  let negative = false
  if (/^\(.*\)$/.test(text)) {
    negative = true
    text = text.slice(1, -1)
  }
  if (text.startsWith('-') || text.startsWith('−')) {
    negative = true
    text = text.slice(1)
  } else if (text.endsWith('-')) {
    negative = true
    text = text.slice(0, -1)
  }
  if (!/^\d+(\.\d+)?$/.test(text)) return null
  const [whole, fraction = ''] = text.split('.') as [string, string?]
  // More decimals than the currency has would need rounding — refuse instead.
  if (fraction.length > digits && /[1-9]/.test(fraction.slice(digits))) return null
  const minor = Number(whole) * 10 ** digits + Number((fraction + '000').slice(0, digits) || '0')
  if (!Number.isSafeInteger(minor)) return null
  return negative ? -minor : minor
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * A date cell → ISO `YYYY-MM-DD` (Gregorian — its destination is Postgres).
 * `YYYY/MM/DD` with a year below 1700 is Jalali (1403/05/12); `DD/MM/YYYY` is
 * read day-first, which is how every bank outside the US writes it.
 */
export function parseStatementDate(raw: string): string | null {
  const text = toLatinDigits(raw).trim().split(/[ T]/)[0] ?? ''
  let y: number
  let m: number
  let d: number
  const ymd = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(text)
  const dmy = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(text)
  if (ymd) [y, m, d] = [Number(ymd[1]), Number(ymd[2]), Number(ymd[3])]
  else if (dmy) [d, m, y] = [Number(dmy[1]), Number(dmy[2]), Number(dmy[3])]
  else return null
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  if (y < 1700) {
    const g = toGregorian(y, m, d)
    ;[y, m, d] = [g.gy, g.gm, g.gd]
  }
  const date = new Date(Date.UTC(y, m - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d)
    return null
  return `${y}-${pad(m)}-${pad(d)}`
}

export function parseBankStatementCsv(text: string, fractionDigits: 0 | 2 | 3): ParseResult {
  const rows = splitCsv(text, detectDelimiter(text))
  if (rows.length < 2) return { ok: false, reason: 'EMPTY' }
  const columns = detectColumns(rows[0]!)
  if (columns.date === undefined) return { ok: false, reason: 'NO_DATE_COLUMN' }
  if (columns.amount === undefined && columns.debit === undefined && columns.credit === undefined) {
    return { ok: false, reason: 'NO_AMOUNT_COLUMN' }
  }

  const lines: ParsedLine[] = []
  const problems: RowProblem[] = []
  const cell = (row: string[], column: BankColumn) => {
    const index = columns[column]
    return index === undefined ? '' : (row[index] ?? '').trim()
  }

  rows.slice(1).forEach((row, i) => {
    const rowNumber = i + 2
    const raw = row.join(' | ')
    const onDate = parseStatementDate(cell(row, 'date'))
    if (!onDate) {
      problems.push({ row: rowNumber, reason: 'DATE', raw })
      return
    }

    let amountMinor: number | null
    if (columns.amount !== undefined) {
      amountMinor = parseAmountMinor(cell(row, 'amount'), fractionDigits)
    } else {
      // Money out and money in, in two columns. Exactly one must be filled.
      const out = cell(row, 'debit') ? parseAmountMinor(cell(row, 'debit'), fractionDigits) : 0
      const into = cell(row, 'credit') ? parseAmountMinor(cell(row, 'credit'), fractionDigits) : 0
      if (out === null || into === null) amountMinor = null
      else if (out !== 0 && into !== 0) {
        problems.push({ row: rowNumber, reason: 'BOTH_SIDES', raw })
        return
      } else amountMinor = into - Math.abs(out)
    }
    if (amountMinor === null || amountMinor === 0) {
      problems.push({ row: rowNumber, reason: 'AMOUNT', raw })
      return
    }

    lines.push({
      onDate,
      amountMinor,
      description: cell(row, 'description').slice(0, 500),
      // Latin digits: the matcher compares it with the book's own reference.
      externalRef: toLatinDigits(cell(row, 'reference')).slice(0, 200) || null,
    })
  })

  return { ok: true, lines, problems, columns }
}
