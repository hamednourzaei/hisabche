// ============================================
// packages/ui/src/lib/export.ts
//
// Browser download. The file BYTES are produced by `@hisabche/formatting`,
// which has no DOM — so mobile, desktop and the server emit the same bytes for
// the same rows instead of each re-deriving escaping, the UTF-8 BOM or the
// xlsx zip.
// ============================================

import { buildXlsx, toCSV, type CsvColumn, type XlsxSheet } from '@hisabche/formatting'

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function exportToCSV<T>(data: T[], columns: CsvColumn<T>[], filename: string) {
  const csv = toCSV(data, columns)
  if (!csv) return

  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${filename}.csv`)
}

/** A real .xlsx a person can open in Excel — see `buildXlsx`. */
export function exportToXlsx(sheets: XlsxSheet[], filename: string): void {
  const bytes = buildXlsx(sheets)
  downloadBlob(
    new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `${filename}.xlsx`,
  )
}

/** Markdown text as a .md file. An empty document downloads nothing. */
export function exportToMarkdown(text: string, filename: string): void {
  if (!text) return
  downloadBlob(new Blob([text], { type: 'text/markdown;charset=utf-8' }), `${filename}.md`)
}
