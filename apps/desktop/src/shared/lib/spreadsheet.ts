// ============================================
// CSV / Excel import and export through the native file dialogs.
// SheetJS runs in the renderer; only bytes cross the IPC bridge.
//
// SheetJS is ~858 kB and was statically imported here, which pulled it into
// the chunk of every page that offers an Export button (accounting, customers,
// products) — paid on navigation by every user, spent by the few who export.
// It is now loaded on first use. Both entry points are already async, so the
// dynamic import needs no signature change and no caller change.
// ============================================

import { bridge } from './bridge'

export type Row = Record<string, string | number>

type SheetJs = typeof import('xlsx')

/**
 * Resolve SheetJS on demand. The module registry caches the module, so the
 * second export in a session costs nothing.
 */
const loadSheetJs = (): Promise<SheetJs> => import('xlsx')

/** Write rows to .xlsx (or .csv by extension) via the save dialog. */
export async function exportRows(
  suggestedName: string,
  rows: readonly Row[],
): Promise<string | null> {
  const desktop = bridge()
  if (!desktop || rows.length === 0) return null

  const XLSX = await loadSheetJs()

  const sheet = XLSX.utils.json_to_sheet([...rows])
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, 'Data')

  const binary = XLSX.write(book, { bookType: 'xlsx', type: 'base64' }) as string

  return desktop.files.export({
    suggestedName,
    content: binary,
    encoding: 'base64',
    filters: [
      { name: 'Excel', extensions: ['xlsx'] },
      { name: 'CSV', extensions: ['csv'] },
    ],
  })
}

/** Read the first sheet of a chosen .xlsx / .csv file. */
export async function importRows(): Promise<Row[] | null> {
  const desktop = bridge()
  if (!desktop) return null

  const file = await desktop.files.import(['xlsx', 'xls', 'csv'])
  if (!file) return null

  const XLSX = await loadSheetJs()

  const book = XLSX.read(file.content, { type: 'base64' })
  const first = book.SheetNames[0]
  if (!first) return []

  const sheet = book.Sheets[first]
  if (!sheet) return []

  return XLSX.utils.sheet_to_json<Row>(sheet)
}
