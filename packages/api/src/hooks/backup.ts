// ============================================
// packages/api/src/hooks/backup.ts
//
// G7 — the workspace's real data, for download.
//
// The settings button used to serialise `useBackupStore()` — the list of
// previous backup entries in localStorage. This fetches the actual rows.
//
// ⚠️ NOT a `useQuery`. A backup is expensive, it is only wanted when someone
// presses the button, and caching it would hand a second click a file that is
// silently out of date. It is a function the click calls.
// ============================================

import { useCallback } from 'react'

import apiClient from '../lib/client'

export interface WorkspaceBackupMeta {
  workspaceId: string
  exportedAt: string
  schemaVersion: string
  /** Always false — there is no import path, and the file says so. */
  restorable: boolean
  /** Tables cut short by the server's per-table cap. */
  truncatedTables: string[]
  /** Tables that could not be read, with the reason. */
  failedTables: { name: string; error: string }[]
  totalRows: number
}

export interface WorkspaceBackup {
  meta: WorkspaceBackupMeta
  data: Record<string, unknown[]>
}

/**
 * Fetch the workspace backup.
 *
 * Owner-only on the server: a member without the role gets a 403 carrying
 * `BACKUP_FORBIDDEN`, which the caller shows rather than swallowing.
 */
export function useWorkspaceBackup() {
  return useCallback(async (): Promise<WorkspaceBackup> => {
    const { data } = await apiClient.get<WorkspaceBackup>('/workspaces/backup')
    return data
  }, [])
}

export type BackupFileFormat = 'md' | 'xlsx'

/**
 * Download the backup as Markdown or Excel (Pro and Enterprise — the server
 * decides, answering 402 BACKUP_FORMAT_REQUIRES_PLAN otherwise).
 *
 * Saved through a temporary object URL from inside the click handler, so no
 * document is read during render.
 */
export function useDownloadWorkspaceBackup() {
  return useCallback(async (format: BackupFileFormat): Promise<void> => {
    const response = await apiClient.get<Blob>('/workspaces/backup', {
      params: { format },
      responseType: 'blob',
    })
    const stamp = new Date().toISOString().slice(0, 10)
    const url = URL.createObjectURL(response.data)
    try {
      const link = document.createElement('a')
      link.href = url
      link.download = `hisabche-backup-${stamp}.${format}`
      document.body.appendChild(link)
      link.click()
      link.remove()
    } finally {
      // Released on the next tick: some browsers start the save asynchronously.
      setTimeout(() => URL.revokeObjectURL(url), 0)
    }
  }, [])
}
