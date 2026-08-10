// ============================================
// packages/ui/src/lib/export.ts
//
// Browser download. The CSV text itself is produced by `@hisabche/formatting`,
// which has no DOM — so mobile and desktop emit the same bytes for the same
// rows instead of each re-deriving escaping and the UTF-8 BOM.
// ============================================

import { toCSV, type CsvColumn } from '@hisabche/formatting'

export function exportToCSV<T>(data: T[], columns: CsvColumn<T>[], filename: string) {
  const csv = toCSV(data, columns)
  if (!csv) return

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
