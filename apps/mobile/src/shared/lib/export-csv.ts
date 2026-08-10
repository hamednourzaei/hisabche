// ============================================
// CSV export for mobile.
//
// The bytes come from `toCSV` in `@hisabche/formatting` — the same function web
// and desktop serialise with — so an invoice list exported from a phone opens
// identically to one exported from the browser, BOM and escaping included.
// Only the delivery is platform-specific: a phone has no download folder, so
// the file is written to the app cache and handed to the system share sheet.
// ============================================

import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { toCSV, type CsvColumn } from '@hisabche/formatting'

export type ExportResult = 'shared' | 'empty' | 'unavailable'

/**
 * Write `rows` as CSV and open the share sheet.
 *
 * Returns `'empty'` when there is nothing to export and `'unavailable'` when
 * the device has no share target, so the caller can say which happened rather
 * than failing silently.
 */
export async function shareAsCSV<T>(
  rows: readonly T[],
  columns: readonly CsvColumn<T>[],
  filename: string,
): Promise<ExportResult> {
  const csv = toCSV(rows, columns)
  if (!csv) return 'empty'

  if (!(await Sharing.isAvailableAsync())) return 'unavailable'

  const uri = `${FileSystem.cacheDirectory}${filename}.csv`
  await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 })

  await Sharing.shareAsync(uri, {
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
    dialogTitle: filename,
  })

  return 'shared'
}
