// ============================================
// backend/src/__tests__/maintenance-mode.test.ts
//
// V63 #68 — the owner's maintenance switch over `SERVICE_READ_ONLY`.
//
// The cases that matter: a customer's write is refused while it is on; the
// way back in (sign-in) and out (the admin routes) stays open; a database
// that is genuinely not writable still blocks everything; and a failed read
// of the switch keeps the last known value instead of silently opening up.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const flagRow: {
  value: { is_enabled: boolean; description: string; updated_at: string } | null
  error: { code: string; message: string } | null
} = {
  value: null,
  error: null,
}
const fromCalls: string[] = []

vi.mock('../db', () => ({
  supabase: {
    from: (table: string) => {
      fromCalls.push(table)
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: flagRow.value, error: flagRow.error }),
        upsert: async (row: { is_enabled: boolean; description: string; updated_at: string }) => {
          flagRow.value = {
            is_enabled: row.is_enabled,
            description: row.description,
            updated_at: row.updated_at,
          }
          return { error: null }
        },
      }
      return chain
    },
  },
}))

import {
  MAINTENANCE_FLAG_KEY,
  enableMaintenanceRefresh,
  isReservedFlagKey,
  maintenanceSnapshot,
  noteRequestForMaintenance,
  refreshMaintenanceFlag,
  resetMaintenanceForTesting,
  setMaintenance,
  writeBlockReason,
} from '../runtime/maintenance-mode'
import { getServiceModeState, isWriteBlocked, setServiceModeInput } from '../runtime/service-mode'

beforeEach(() => {
  resetMaintenanceForTesting()
  setServiceModeInput({ primaryWritable: true, replicaLagExceeded: false, underPressure: false })
  flagRow.value = null
  flagRow.error = null
  fromCalls.length = 0
})

afterEach(() => {
  resetMaintenanceForTesting()
})

describe('maintenance switch', () => {
  it('blocks a customer write while on, and lets reads through', async () => {
    await setMaintenance({ enabled: true, reason: 'Database upgrade' })
    expect(getServiceModeState().mode).toBe('read_only')
    expect(isWriteBlocked()).toBe(true)
    expect(writeBlockReason('POST', '/api/invoices')).toBe('maintenance')
    expect(writeBlockReason('DELETE', '/api/customers/1')).toBe('maintenance')
    expect(writeBlockReason('GET', '/api/invoices')).toBeNull()
  })

  it('keeps the way in and out open: sign-in and every admin route', async () => {
    await setMaintenance({ enabled: true, reason: 'Database upgrade' })
    expect(writeBlockReason('POST', '/api/auth/login')).toBeNull()
    expect(writeBlockReason('POST', '/api/auth/refresh')).toBeNull()
    expect(writeBlockReason('POST', '/api/admin/security/step-up')).toBeNull()
    expect(writeBlockReason('PUT', '/api/admin/ops/maintenance')).toBeNull()
    // Signing up is a write that maintenance pauses.
    expect(writeBlockReason('POST', '/api/auth/signup')).toBe('maintenance')
  })

  it('a database that is not writable blocks everything, admin included', () => {
    setServiceModeInput({ primaryWritable: false })
    expect(writeBlockReason('PUT', '/api/admin/ops/maintenance')).toBe('primary_unavailable')
  })

  it('turning it off reopens writes', async () => {
    await setMaintenance({ enabled: true, reason: 'Database upgrade' })
    await setMaintenance({ enabled: false, reason: 'Upgrade finished' })
    expect(writeBlockReason('POST', '/api/invoices')).toBeNull()
    expect(maintenanceSnapshot()).toMatchObject({
      enabled: false,
      reason: 'Upgrade finished',
      readable: true,
    })
  })

  it('a failed read keeps the last known value and says it could not read', async () => {
    await setMaintenance({ enabled: true, reason: 'Database upgrade' })
    flagRow.error = { code: '57014', message: 'timeout' }
    const state = await refreshMaintenanceFlag()
    expect(state.enabled).toBe(true)
    expect(state.readable).toBe(false)
    expect(writeBlockReason('POST', '/api/invoices')).toBe('maintenance')
  })

  it('a request does not read the row until start() enabled the refresh', () => {
    noteRequestForMaintenance(Date.now())
    expect(fromCalls).toEqual([])
    enableMaintenanceRefresh()
    noteRequestForMaintenance(Date.now() + 60_000)
    expect(fromCalls).toEqual(['feature_flags'])
  })

  it('the reserved key is recognised whatever its case', () => {
    expect(isReservedFlagKey(MAINTENANCE_FLAG_KEY.toUpperCase())).toBe(true)
    expect(isReservedFlagKey('new_invoice_builder')).toBe(false)
  })

  it('index.ts uses the same decision and only start() enables the refresh', () => {
    const index = readFileSync(join(__dirname, '..', 'index.ts'), 'utf8')
    expect(index).toContain("writeBlockReason(request.method, pathOnly ?? '')")
    const start = index.slice(index.indexOf('async function start()'))
    expect(start).toContain('enableMaintenanceRefresh()')
    const build = index.slice(
      index.indexOf('export async function buildServer'),
      index.indexOf('async function start()'),
    )
    expect(build).not.toContain('enableMaintenanceRefresh()')
  })
})
