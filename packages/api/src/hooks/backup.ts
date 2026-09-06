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
