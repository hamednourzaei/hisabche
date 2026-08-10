// ============================================
// CSV serialisation.
//
// Lives here, not in `packages/ui`, because the only DOM-bound part of an
// export is the download itself. Web triggers an anchor click, desktop writes
// through the Electron bridge and mobile writes a file and shares it — but all
// three must produce byte-identical content, or the same invoice list exports
// differently depending on which device the user happened to open.
// ============================================

export interface CsvColumn<T> {
  key: keyof T
  label: string
}

/**
 * Excel on Windows reads a CSV as the system codepage unless the file opens
 * with a UTF-8 byte-order mark. Without it, every Persian and Dari string in
 * the export arrives as mojibake — which is most of this product's data.
 */
export const UTF8_BOM = '﻿'

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return '""'
  return `"${String(value).replace(/"/g, '""')}"`
}

/**
 * Serialise rows to CSV text, BOM included.
 *
 * Returns an empty string for an empty row set so callers can treat "nothing to
 * export" as a falsy result rather than writing a header-only file.
 */
export function toCSV<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  if (!rows || rows.length === 0) return ''

  const header = columns.map((column) => escapeCell(column.label)).join(',')
  const body = rows.map((row) => columns.map((column) => escapeCell(row[column.key])).join(','))

  return UTF8_BOM + [header, ...body].join('\n')
}

/** `invoices-2026-08-10` — stable across platforms, so exports sort together. */
export function csvFilename(prefix: string, date: Date): string {
  return `${prefix}-${date.toISOString().split('T')[0]}`
}
