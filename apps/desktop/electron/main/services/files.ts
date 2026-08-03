// ============================================
// Export to disk through the native save dialog.
// The renderer never receives a filesystem path it did not ask for.
// ============================================

import { dialog } from 'electron'
import { writeFile } from 'node:fs/promises'

export interface ExportInput {
  suggestedName: string
  content: string
  encoding: 'utf8' | 'base64'
  filters?: Array<{ name: string; extensions: string[] }> | undefined
}

export async function writeExport(input: ExportInput): Promise<string | null> {
  const result = await dialog.showSaveDialog({
    defaultPath: input.suggestedName,
    filters: input.filters ?? [{ name: 'All files', extensions: ['*'] }],
  })

  if (result.canceled || !result.filePath) return null

  await writeFile(result.filePath, Buffer.from(input.content, input.encoding))
  return result.filePath
}
