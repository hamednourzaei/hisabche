// ============================================
// backend/src/runtime/maintenance-mode.ts
//
// V63 #68 — the owner's maintenance switch over the existing read-only mode
// (`service-mode.ts` → the `SERVICE_READ_ONLY` 503 in `index.ts`).
//
// WHERE THE SWITCH LIVES. The backend is stateless (owner, 9 Nov): a value in
// process memory would pause writes on one instance and not the others. The
// switch is one reserved row in the existing `feature_flags` table — no new
// table, no migration. Each process mirrors it, re-reading at most every
// `REFRESH_MS` on the first request after the window (lazy: there is no
// process timer — `job-authority-guard.test.ts`).
//
// ⚠️ THE GENERIC FLAG EDITOR MUST NOT REACH THIS ROW. Product › features runs on
// `product.flags.write`; maintenance needs `operations.maintenance.write` and a
// step-up. `admin-ops` refuses the reserved key (`isReservedFlagKey`).
//
// ⚠️ THE WAY OUT IS NEVER BEHIND THE SWITCH. While maintenance is on, admin
// routes and sign-in stay writable — otherwise the admin who turned it on
// could not sign in again, pass step-up, or turn it off. A database that is
// genuinely not writable (`primaryWritable: false`) still blocks everything.
//
// Refresh starts only from `start()` (`enableMaintenanceRefresh`), so the
// tests that build a server never read a row they did not seed.
// ============================================

import { supabase } from '../db'
import { getServiceModeState, setServiceModeInput } from './service-mode'

export const MAINTENANCE_FLAG_KEY = 'platform.maintenance_read_only'

const REFRESH_MS = 10_000

export interface MaintenanceState {
  enabled: boolean
  reason: string | null
  /** When the row last changed — the time the switch was set. */
  changedAt: string | null
  /** `false` when the row could not be read; `enabled` then keeps the last known value. */
  readable: boolean
  readAt: string | null
}

let state: MaintenanceState = {
  enabled: false,
  reason: null,
  changedAt: null,
  readable: false,
  readAt: null,
}
let lastReadMs = 0
let inflight: Promise<MaintenanceState> | null = null
let refreshEnabled = false

/** Prefixes that stay writable while maintenance is on (the way back in and out). */
const EXEMPT_PREFIXES = ['/api/admin/'] as const
const EXEMPT_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/logout',
  '/api/auth/mfa/verify',
])

export function isReservedFlagKey(key: string): boolean {
  return key.trim().toLowerCase() === MAINTENANCE_FLAG_KEY
}

export function isMaintenanceExempt(path: string): boolean {
  return EXEMPT_PATHS.has(path) || EXEMPT_PREFIXES.some((prefix) => path.startsWith(prefix))
}

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/**
 * Why this request may not write, or `null`. A database that is not writable
 * wins over maintenance (nothing is exempt from that one).
 */
export function writeBlockReason(
  method: string,
  path: string,
): 'primary_unavailable' | 'maintenance' | null {
  if (!WRITE_METHODS.has(method)) return null
  const mode = getServiceModeState()
  if (!mode.primaryWritable) return 'primary_unavailable'
  if (mode.maintenance && !isMaintenanceExempt(path)) return 'maintenance'
  return null
}

export function maintenanceSnapshot(): MaintenanceState {
  return { ...state }
}

/** Called once from `start()`; before it, no request reads the flag on its own. */
export function enableMaintenanceRefresh(): void {
  refreshEnabled = true
}

/** The onRequest hook's call: refresh in the background when the copy is stale. */
export function noteRequestForMaintenance(nowMs: number = Date.now()): void {
  if (!refreshEnabled || inflight || nowMs - lastReadMs < REFRESH_MS) return
  void refreshMaintenanceFlag().catch(() => undefined)
}

/** Read the row and mirror it into the service mode. A failed read keeps the last value. */
export async function refreshMaintenanceFlag(): Promise<MaintenanceState> {
  if (inflight) return inflight
  inflight = (async () => {
    lastReadMs = Date.now()
    const { data, error } = await supabase
      .from('feature_flags')
      .select('is_enabled, description, updated_at')
      .eq('key', MAINTENANCE_FLAG_KEY)
      .maybeSingle()
    const readAt = new Date().toISOString()
    if (error) {
      state = { ...state, readable: false, readAt }
      return { ...state }
    }
    const row = data as {
      is_enabled?: boolean
      description?: string | null
      updated_at?: string
    } | null
    state = {
      enabled: row?.is_enabled === true,
      reason: row?.description ?? null,
      changedAt: row?.updated_at ?? null,
      readable: true,
      readAt,
    }
    setServiceModeInput({ maintenance: state.enabled })
    return { ...state }
  })()
  try {
    return await inflight
  } finally {
    inflight = null
  }
}

/**
 * Turn maintenance on or off. Writes the reserved row, then mirrors it on
 * THIS process at once; the other instances follow within `REFRESH_MS`.
 */
export async function setMaintenance(params: {
  enabled: boolean
  reason: string
}): Promise<MaintenanceState> {
  const now = new Date().toISOString()
  const { error } = await supabase.from('feature_flags').upsert(
    {
      key: MAINTENANCE_FLAG_KEY,
      name: 'Maintenance — read-only',
      description: params.reason,
      is_enabled: params.enabled,
      rollout_percentage: params.enabled ? 100 : 0,
      platforms: [],
      countries: [],
      is_beta: false,
      updated_at: now,
    },
    { onConflict: 'key' },
  )
  if (error) throw new Error(`Failed to save the maintenance switch: ${error.message}`)
  return refreshMaintenanceFlag()
}

/** Test-only reset. */
export function resetMaintenanceForTesting(): void {
  state = { enabled: false, reason: null, changedAt: null, readable: false, readAt: null }
  lastReadMs = 0
  inflight = null
  refreshEnabled = false
  setServiceModeInput({ maintenance: false })
}
