// ============================================
// backend/src/services/sync-overview.domain.ts
//
// Devices and failed changes, summarised from `sync_mutations` — the server's
// own record of every synced write (docs/sync-engine-migration.sql). Pure: the
// service feeds it rows; tests feed it numbers.
// ============================================

export interface MutationRow {
  mutation_id: string
  device_id: string | null
  entity_type: string
  entity_id: string | null
  operation: string
  status: 'applied' | 'rejected'
  error_code: string | null
  created_at: string
}

export interface DeviceSummary {
  deviceId: string
  lastSeenAt: string
  applied: number
  rejected: number
}

export interface SyncOverview {
  windowDays: number
  /** true when the window held more rows than were read — counts are a floor. */
  truncated: boolean
  devices: DeviceSummary[]
  failed: {
    count: number
    recent: Array<{
      mutationId: string
      entityType: string
      entityId: string | null
      operation: string
      errorCode: string | null
      deviceId: string | null
      at: string
    }>
  }
}

export function summariseSync(
  rows: MutationRow[],
  windowDays: number,
  truncated: boolean,
): SyncOverview {
  const devices = new Map<string, DeviceSummary>()
  const failed: SyncOverview['failed']['recent'] = []
  let failedCount = 0

  for (const row of rows) {
    const id = row.device_id && row.device_id.trim() ? row.device_id : 'unknown'
    const device = devices.get(id) ?? {
      deviceId: id,
      lastSeenAt: row.created_at,
      applied: 0,
      rejected: 0,
    }
    if (row.created_at > device.lastSeenAt) device.lastSeenAt = row.created_at
    if (row.status === 'applied') device.applied++
    else device.rejected++
    devices.set(id, device)

    if (row.status === 'rejected') {
      failedCount++
      failed.push({
        mutationId: row.mutation_id,
        entityType: row.entity_type,
        entityId: row.entity_id,
        operation: row.operation,
        errorCode: row.error_code,
        deviceId: row.device_id,
        at: row.created_at,
      })
    }
  }

  return {
    windowDays,
    truncated,
    devices: [...devices.values()].sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt)),
    failed: {
      count: failedCount,
      recent: failed.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 20),
    },
  }
}
