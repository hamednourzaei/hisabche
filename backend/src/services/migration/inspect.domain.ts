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
import { checkIntake, checkParsed, comparisonKey, parseDelimited } from './migration.domain'
import { ENTITY_FIELDS } from './migration.entities'
import { readXlsx, rowsToCsv, XlsxError } from './xlsx.domain'

/** One sheet of a workbook, ready to be imported on its own. */
export interface SheetInspection {
  name: string
  sourceType: 'csv' | 'tsv'
  content: string
  headers: string[]
  rowCount: number
  skippedRows: number
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
    .map(comparisonKey),
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
    const hits = (rows[index] ?? []).filter((cell) => KNOWN_HEADERS.has(comparisonKey(cell))).length
    if (hits > bestHits) {
      best = index
      bestHits = hits
    }
  }
  return best
}

/** One table — a CSV, or one sheet of a workbook — made ready for the pipeline. */
function inspectTable(text: string, type: 'csv' | 'tsv') {
  let content = text
  let sourceType = type

  const rejection = checkIntake(content)
  if (rejection) throw new InspectionError(`MIGRATION_${rejection.code}`)

  let table = parseDelimited(content, sourceType === 'tsv' ? '\t' : undefined)

  // Title lines above the table are dropped, and the text handed on starts
  // at the header — so the scan, the dry run and the commit all read the
  // same table this look did.
  const skippedRows = findHeaderRow([table.headers, ...table.rows])
  if (skippedRows > 0) {
    content = rowsToCsv([table.headers, ...table.rows].slice(skippedRows))
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
    detection: first.detection,
    sheet: { name: first.name, ignored },
    sheets,
  }
}
