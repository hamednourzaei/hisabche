// ============================================
// backend/src/services/workspace/backup-formats.ts
//
// The workspace backup (backup.service.ts) as a file a person can open:
//   • Markdown — one section and one table per data set, readable anywhere
//   • Excel (.xlsx) — one sheet per data set
//
// ⚠️ THE FILE FORMATS THEMSELVES LIVE IN `@hisabche/formatting`
// (`table-export.ts`): the stored zip, the crc32, the XML parts and the pipe
// escaping. The browser and the Windows app write the same files for the
// tables on their own screens, and three writers would drift — an .xlsx this
// route produces and one the product page produces must open the same way.
// This file only turns a `WorkspaceBackup` into those calls.
// ============================================

import { buildXlsx, columnsOf, markdownTable } from '@hisabche/formatting'

import type { WorkspaceBackup } from './backup.service'

export function backupToMarkdown(backup: WorkspaceBackup): string {
  const lines: string[] = [
    '# Hisabche backup',
    '',
    `- Workspace: \`${backup.meta.workspaceId}\``,
    `- Exported at: ${backup.meta.exportedAt}`,
    `- Rows: ${backup.meta.totalRows}`,
    `- Schema version: ${backup.meta.schemaVersion}`,
  ]
  if (backup.meta.truncatedTables.length > 0) {
    lines.push(`- ⚠️ Cut at the row cap: ${backup.meta.truncatedTables.join(', ')}`)
  }
  for (const failed of backup.meta.failedTables) {
    lines.push(`- ⚠️ Not exported: ${failed.name} (${failed.error})`)
  }
  for (const [name, rows] of Object.entries(backup.data)) {
    lines.push('', `## ${name} (${rows.length})`, '')
    if (rows.length === 0) {
      lines.push('_empty_')
      continue
    }
    const columns = columnsOf(rows)
    lines.push(
      markdownTable(
        columns,
        rows.map((row) => columns.map((column) => (row as Record<string, unknown>)[column])),
      ),
    )
  }
  return lines.join('\n') + '\n'
}

export function backupToXlsx(backup: WorkspaceBackup): Buffer {
  const entries = Object.entries(backup.data)
  const meta: unknown[] = [
    { key: 'workspaceId', value: backup.meta.workspaceId },
    { key: 'exportedAt', value: backup.meta.exportedAt },
    { key: 'totalRows', value: backup.meta.totalRows },
    { key: 'truncatedTables', value: backup.meta.truncatedTables.join(', ') },
    {
      key: 'failedTables',
      value: backup.meta.failedTables.map((f) => `${f.name}: ${f.error}`).join('; '),
    },
  ]
  const sheets = [
    { name: 'backup', rows: meta },
    ...entries.map(([name, rows]) => ({ name, rows })),
  ]
  return Buffer.from(buildXlsx(sheets))
}
