// ============================================
// backend/src/services/migration/inspect.domain.ts
//
// The first look at an uploaded file, before any job exists: turn it into the
// text the import pipeline already understands, and say what it seems to hold.
//
// Writes nothing and remembers nothing. A workbook becomes CSV text here so it
// goes down the SAME path as a CSV from then on — one parser, one set of
// limits, one set of findings — instead of growing a second import beside the
// first.
// ============================================

import { detectEntity, type EntityDetection } from './detect-entity.domain'
import {
  checkIntake,
  checkParsed,
  comparisonKey,
  parseDelimited,
  readRecords,
} from './migration.domain'
import { ENTITY_FIELDS, headerKey } from './migration.entities'
import { readXlsx, rowsToCsv, XlsxError } from './xlsx.domain'

/** One sheet of a workbook, ready to be imported on its own. */
export interface SheetInspection {
  name: string
  sourceType: 'csv' | 'tsv'
  content: string
  headers: string[]
  rowCount: number
  skippedRows: number
  /** «Total», «جمع کل», a discount line: rows that sum the table, left out. */
  summaryRows: number
  /** Fields read from labelled cells above the table (a printed-invoice form). */
  formFields: string[]
  detection: EntityDetection
}

export interface UploadInspection {
  /** What the rest of the pipeline is given. A workbook arrives as `csv`. */
  sourceType: 'csv' | 'tsv'
  content: string
  /** Set for a workbook: the FIRST readable sheet, and the ones that are not tables. */
  sheet: { name: string; ignored: string[] } | null
  /** Every readable sheet of a workbook, in its order. Empty for a text file. */
  sheets: SheetInspection[]
  headers: string[]
  rowCount: number
  /** Lines above the header row (a title, a date, a logo cell) that were left out. */
  skippedRows: number
  summaryRows: number
  formFields: string[]
  detection: EntityDetection
}

export class InspectionError extends Error {
  constructor(public readonly code: string) {
    super(code)
    this.name = 'InspectionError'
  }
}

/** Every column name the importer knows, in any of the three languages. */
const KNOWN_HEADERS = new Set(
  Object.values(ENTITY_FIELDS)
    .flat()
    .flatMap((spec) => [spec.key, ...spec.aliases])
    .map(headerKey),
)

/** How far down a sheet a header row is looked for. */
const HEADER_SEARCH_ROWS = 20

/**
 * Which row holds the column names.
 *
 * Real spreadsheets rarely start with them: there is a shop name, a report
 * title, a «from … to …» line, an empty row, and THEN the table. Taking row
 * one as the header turned the shop name into the only column and every
 * column name into a data row.
 *
 * The header is the first row, within the top of the sheet, with the most
 * cells that are column names this importer knows — at least two of them.
 * When no row qualifies the answer is 0: an unfamiliar file is read as
 * written, and the person maps its columns by hand.
 */
export function findHeaderRow(rows: readonly (readonly string[])[]): number {
  let best = 0
  let bestHits = 1
  for (let index = 0; index < Math.min(rows.length, HEADER_SEARCH_ROWS); index++) {
    const hits = (rows[index] ?? []).filter((cell) => KNOWN_HEADERS.has(headerKey(cell))).length
    if (hits > bestHits) {
      best = index
      bestHits = hits
    }
  }
  return best
}

/* ─── Lines that sum the table ────────────────────────────────────────────── */

const SUMMARY_WORDS = new Set(
  [
    'total',
    'grand total',
    'sub total',
    'subtotal',
    'net total',
    'sum',
    'discount',
    'tax',
    'vat',
    'جمع',
    'جمع کل',
    'مجموع',
    'جمع صفحه',
    'جمع نهایی',
    'مبلغ کل',
    'قابل پرداخت',
    'تخفیف',
    'مالیات',
  ].map(comparisonKey),
)

const isNumberCell = (cell: string): boolean =>
  /^[\d۰-۹٠-٩.,٫٬\s()%+-]+$/.test(cell) && /[\d۰-۹٠-٩]/.test(cell)

/**
 * A row that says «Total 1,020» rather than selling anything.
 *
 * Printed invoices and registers end (and are sometimes interrupted) with
 * them. Read as data they are either refused for having no date, or — worse
 * — imported as one more line, doubling the invoice. So a row is left out
 * when one cell IS a summary word and every other filled cell is a number.
 * A row with any other text in it is kept: «جمع» can be part of a real name.
 */
function isSummaryRow(row: readonly string[]): boolean {
  const filled = row.map((cell) => cell.trim()).filter((cell) => cell !== '')
  if (filled.length < 2) return false
  const labels = filled.filter((cell) =>
    SUMMARY_WORDS.has(comparisonKey(cell.replace(/[:：]/g, ''))),
  )
  return labels.length === 1 && filled.every((cell) => labels.includes(cell) || isNumberCell(cell))
}

/* ─── A printed-invoice form ──────────────────────────────────────────────── */

const FORM_LABELS: Array<{ field: string; header: string; labels: Set<string> }> = [
  {
    field: 'invoiceNumber',
    header: 'Invoice Number',
    labels: new Set(
      [
        'invoice',
        'invoice no',
        'invoice number',
        'invoice #',
        'bill no',
        'number',
        'no',
        'شماره فاکتور',
        'شماره',
        'شماره سند',
        'نمبر بل',
        'نمبر فاکتور',
      ].map(comparisonKey),
    ),
  },
  {
    field: 'date',
    header: 'Date',
    labels: new Set(
      ['date', 'invoice date', 'تاریخ', 'تاریخ فاکتور', 'تاریخ صدور', 'تاریخ صدور فاکتور'].map(
        comparisonKey,
      ),
    ),
  },
  {
    field: 'customerName',
    header: 'Customer Name',
    labels: new Set(
      [
        'bill to',
        'customer',
        'customer name',
        'buyer',
        'client',
        'sold to',
        'نام خریدار',
        'خریدار',
        'مشتری',
        'نام مشتری',
        'صورتحساب برای',
      ].map(comparisonKey),
    ),
  },
]

const labelOf = (cell: string): string => comparisonKey(cell.replace(/[:：]/g, ''))

/**
 * The date, number and customer written ABOVE the table of a printed invoice.
 *
 * A shopkeeper's invoice in a spreadsheet is usually the paper one redrawn:
 * «DATE: 2026-10-09», «Bill To: …», and under them a table of lines with no
 * date column at all. Dropping those rows as «a title» threw away the only
 * date the invoice has. Each label found is turned into a column holding
 * that one value on every row — which is exactly what the form means.
 *
 * A value is the text after the colon in the same cell, or else the next
 * filled cell on the row that is not itself a label. A field the table
 * already has a column for is left to the table.
 */
function liftFormFields(
  above: readonly (readonly string[])[],
  header: readonly string[],
): Array<{ field: string; header: string; value: string }> {
  const headerKeys = new Set(header.map(comparisonKey))
  const isLabel = (cell: string) => FORM_LABELS.some((entry) => entry.labels.has(labelOf(cell)))
  const lifted: Array<{ field: string; header: string; value: string }> = []

  for (const row of above) {
    for (let index = 0; index < row.length; index++) {
      const cell = (row[index] ?? '').trim()
      if (cell === '') continue

      const colon = cell.search(/[:：]/)
      const inline = colon > 0 ? cell.slice(colon + 1).trim() : ''
      const label = labelOf(inline !== '' ? cell.slice(0, colon) : cell)
      const entry = FORM_LABELS.find((candidate) => candidate.labels.has(label))
      if (!entry || lifted.some((done) => done.field === entry.field)) continue
      // The table says it itself: leave it to the table.
      if ([...entry.labels].some((known) => headerKeys.has(known))) continue

      let value = inline
      for (let next = index + 1; value === '' && next < row.length; next++) {
        const candidate = (row[next] ?? '').trim()
        if (candidate === '') continue
        if (isLabel(candidate)) break
        value = candidate
      }
      if (value !== '') lifted.push({ field: entry.field, header: entry.header, value })
    }
  }
  return lifted
}

const FORM_AMOUNTS: Array<{ field: string; header: string; labels: Set<string> }> = [
  {
    field: 'invoiceDiscount',
    header: 'Invoice Discount',
    labels: new Set(['discount', 'تخفیف', 'جمع تخفیف', 'تخفیف کل'].map(comparisonKey)),
  },
  {
    field: 'invoiceTax',
    header: 'Invoice Tax',
    labels: new Set(
      ['tax', 'vat', 'مالیات', 'ارزش افزوده', 'مالیات بر ارزش افزوده'].map(comparisonKey),
    ),
  },
  {
    field: 'total',
    header: 'Invoice Total',
    labels: new Set(
      ['total', 'grand total', 'net total', 'جمع کل', 'مبلغ کل', 'قابل پرداخت', 'جمع نهایی'].map(
        comparisonKey,
      ),
    ),
  },
]

/**
 * The discount, tax and total written UNDER the table of a printed invoice.
 *
 * They were being left out with the other summing lines — which made the
 * imported invoice the sum of its lines, whatever the paper said. A form's
 * discount and tax are part of what is owed, and its total is the check that
 * everything was read: each becomes a column on the document.
 *
 * Only for a FORM (one document on the sheet). In a register, a «جمع» line is
 * a page total over many invoices and belongs to none of them.
 */
function liftFormAmounts(
  summaries: readonly (readonly string[])[],
): Array<{ field: string; header: string; value: string }> {
  const lifted: Array<{ field: string; header: string; value: string }> = []
  for (const row of summaries) {
    const filled = row.map((cell) => cell.trim()).filter((cell) => cell !== '')
    const label = filled.find((cell) => !isNumberCell(cell))
    const value = filled.find((cell) => isNumberCell(cell))
    if (!label || !value) continue
    const entry = FORM_AMOUNTS.find((candidate) => candidate.labels.has(labelOf(label)))
    if (!entry || lifted.some((done) => done.field === entry.field)) continue
    lifted.push({ field: entry.field, header: entry.header, value: value.replace(/%/g, '') })
  }
  return lifted
}

/** One table — a CSV, or one sheet of a workbook — made ready for the pipeline. */
/* ─── A report grouped under a name ───────────────────────────────────────── */

const TOTAL_LINE = /^(grand\s+total|sub\s*total|total|جمع|مجموع)(\s|$|:)/i

/**
 * «Sales by Customer Detail», as accounting packages print it:
 *
 *            Date        Num   Item    Qty  Amount
 *     Ahmad Trading
 *            01/15/2026  1001  Tea     10   1,500
 *            01/15/2026  1001  Sugar   5    450
 *     Total for Ahmad Trading                1,950
 *     Bilal & Sons
 *            …
 *
 * The first column has no name, a row holding ONLY that column names the
 * group, and the rows under it leave it blank. Read flat, every line had no
 * customer at all. Here the group's name is carried onto each of its rows, the
 * group and «Total for …» rows are dropped, and the nameless column gets the
 * name the report's title gives it.
 *
 * What it does not guess: when the title does not say what the groups are,
 * the column is called «Group» and is left for a person to connect.
 */
function liftGroupRows(
  header: readonly string[],
  body: readonly (readonly string[])[],
  above: readonly (readonly string[])[],
): { header: string[]; body: string[][]; dropped: number } | null {
  if ((header[0] ?? '').trim() !== '') return null
  const onlyFirst = (row: readonly string[]) =>
    (row[0] ?? '').trim() !== '' && row.slice(1).every((cell) => cell.trim() === '')
  const groups = body.filter(onlyFirst).length
  const details = body.filter(
    (row) => (row[0] ?? '').trim() === '' && row.some((cell) => cell.trim() !== ''),
  ).length
  if (groups === 0 || details === 0) return null

  const title = above.flat().join(' ').toLowerCase()
  const label = /customer|client|مشتری/.test(title)
    ? 'Customer'
    : /supplier|vendor|تأمین|تامین|فروشنده/.test(title)
      ? 'Supplier'
      : /item|product|کالا|جنس/.test(title)
        ? 'Item'
        : 'Group'

  const out: string[][] = []
  let current = ''
  let dropped = 0
  for (const row of body) {
    const first = (row[0] ?? '').trim()
    if (onlyFirst(row)) {
      // A bare «TOTAL» closing the report is not the next group.
      if (TOTAL_LINE.test(first)) dropped += 1
      else current = first
      continue
    }
    if (first !== '') {
      if (TOTAL_LINE.test(first)) dropped += 1
      else out.push([...row])
      continue
    }
    if (row.every((cell) => cell.trim() === '')) continue
    out.push([current, ...row.slice(1)])
  }
  return { header: [label, ...header.slice(1)], body: out, dropped }
}

function inspectTable(text: string, type: 'csv' | 'tsv') {
  let content = text
  let sourceType = type

  const rejection = checkIntake(content)
  if (rejection) throw new InspectionError(`MIGRATION_${rejection.code}`)

  let table = parseDelimited(content, sourceType === 'tsv' ? '\t' : undefined)

  // What is handed on is the TABLE: it starts at its header row, carries the
  // form's labelled values as columns, and has no summing lines in it — so the
  // scan, the dry run and the commit all read the same thing this look did.
  // ⚠️ Every record at its OWN width. The parse above cuts each row to the
  // width of the first line — which, in a report, is a one-cell title.
  const raw = readRecords(content, sourceType === 'tsv' ? '\t' : undefined).records
  const width = raw.reduce((most, record) => Math.max(most, record.length), 0)
  const all = raw.map((record) => {
    const padded = record.map((cell) => cell.trim())
    while (padded.length < width) padded.push('')
    return padded
  })
  const skippedRows = findHeaderRow(all)
  const grouped = liftGroupRows(
    all[skippedRows] ?? [],
    all.slice(skippedRows + 1),
    all.slice(0, skippedRows),
  )
  const header = grouped?.header ?? all[skippedRows] ?? []
  const body = grouped?.body ?? all.slice(skippedRows + 1)
  const lines = body.filter((row) => !isSummaryRow(row))
  const summaryRows = body.length - lines.length + (grouped?.dropped ?? 0)
  const form = liftFormFields(all.slice(0, skippedRows), header)

  if (form.length > 0) {
    // The sheet is ONE printed invoice: what is written under its table is
    // part of it …
    const headerKeys = new Set(header.map(comparisonKey))
    for (const entry of liftFormAmounts(body.filter((row) => isSummaryRow(row)))) {
      // … unless the table already has that column (a «مبلغ کل» per line).
      if (
        !headerKeys.has(comparisonKey(entry.header)) &&
        !form.some((done) => done.field === entry.field)
      ) {
        form.push(entry)
      }
    }
    // … and its rows are one document even when it carries no number. Without
    // this mark each line of the form became an invoice of its own.
    if (!form.some((entry) => entry.field === 'invoiceNumber')) {
      form.push({ field: 'groupKey', header: 'Invoice Group', value: 'form' })
    }
  }

  if (skippedRows > 0 || summaryRows > 0 || form.length > 0 || grouped) {
    content = rowsToCsv([
      [...header, ...form.map((entry) => entry.header)],
      ...lines.map((row) => [...row, ...form.map((entry) => entry.value)]),
    ])
    sourceType = 'csv'
    table = parseDelimited(content)
  }

  const shape = checkParsed(table)
  if (shape) throw new InspectionError(`MIGRATION_${shape.code}`)

  return {
    sourceType,
    content,
    headers: table.headers,
    rowCount: table.rows.length,
    skippedRows,
    summaryRows,
    formFields: form.map((entry) => entry.field),
    detection: detectEntity(table.headers, table.rows),
  }
}
export function inspectUpload(input: {
  filename: string
  text?: string | undefined
  base64?: string | undefined
}): UploadInspection {
  if (input.base64 === undefined) {
    return {
      ...inspectTable(input.text ?? '', /\.tsv$/i.test(input.filename) ? 'tsv' : 'csv'),
      sheet: null,
      sheets: [],
    }
  }

  let workbook
  try {
    workbook = readXlsx(Buffer.from(input.base64, 'base64'))
  } catch (error) {
    if (error instanceof XlsxError) throw new InspectionError(`MIGRATION_${error.code}`)
    throw error
  }

  // ⚠️ EVERY sheet that holds a table, each looked at on its own. A workbook
  // with customers on one sheet, products on the next and sales on a third
  // is three imports — and used to be one, with the other two sheets named
  // and dropped. A sheet that cannot be read as a table (a chart page, a
  // page of notes) is listed as ignored, never silently skipped.
  const sheets: SheetInspection[] = []
  const ignored: string[] = []
  let firstError: InspectionError | null = null

  for (const candidate of workbook) {
    if (candidate.rows.length === 0) continue
    try {
      const seen = inspectTable(rowsToCsv(candidate.rows), 'csv')
      // A heading with nothing under it is a page of notes, not a table.
      if (seen.rowCount === 0) ignored.push(candidate.name)
      else sheets.push({ name: candidate.name, ...seen })
    } catch (error) {
      if (!(error instanceof InspectionError)) throw error
      firstError ??= error
      ignored.push(candidate.name)
    }
  }

  const first = sheets[0]
  if (!first) throw firstError ?? new InspectionError('MIGRATION_FILE_EMPTY')

  return {
    sourceType: first.sourceType,
    content: first.content,
    headers: first.headers,
    rowCount: first.rowCount,
    skippedRows: first.skippedRows,
    summaryRows: first.summaryRows,
    formFields: first.formFields,
    detection: first.detection,
    sheet: { name: first.name, ignored },
    sheets,
  }
}
