// ============================================
// The offline first run — what the device has, and what it is asked.
//
// ⚠️ WHY THIS IS A MODULE AND NOT THE PAGE.
//
// The page is React; a test that mounts it needs a DOM, a router and a
// store. The two facts that matter — «does this device already have a
// business?» and «what does the local engine answer when it is asked to
// make one?» — are decisions, not pixels, and they are decided here where
// they can be checked without a screen.
//
// The page owns the phases (which panel is on screen) and the navigation;
// this owns the two calls and the message a failure becomes.
// ============================================

import { apiErrorMessage } from '@hisabche/api'

import { apiClient } from '@/shared/lib/api'
import type { OfflineWorkspace } from './offline-session'

/** What the device holds. */
export type LocalWorkspaceLookup =
  { kind: 'existing'; workspace: OfflineWorkspace } | { kind: 'empty' }

export interface CreateLocalWorkspaceInput {
  name: string
  /** The books currency the person chose. Never a default. */
  baseCurrency: string
  /** The device's own time zone. */
  timeZone: string
}

/**
 * Ask the local engine what is on this device.
 *
 * A FAILED READ THROWS. It is not «no business yet»: the difference is the
 * whole point — one is a fresh install and the other is a device whose
 * database is not answering, and telling the person their shop is empty
 * would be a lie.
 */
export async function lookupLocalWorkspace(): Promise<LocalWorkspaceLookup> {
  const res = await apiClient.get<OfflineWorkspace[]>('/workspaces')
  const list = Array.isArray(res.data) ? res.data : []
  const first = list[0]
  return first ? { kind: 'existing', workspace: first } : { kind: 'empty' }
}

/**
 * Create the business on this device.
 *
 * The name and the books currency are the person's answers; the engine
 * writes them. There is no default currency to fall back on: the device
 * might not trade in Afghani at all.
 */
export async function createLocalWorkspace(
  input: CreateLocalWorkspaceInput,
): Promise<OfflineWorkspace> {
  const res = await apiClient.post<OfflineWorkspace>('/workspaces', {
    name: input.name.trim(),
    baseCurrency: input.baseCurrency,
    timeZone: input.timeZone,
  })
  return res.data
}

/**
 * The message a failure is shown as.
 *
 * ⚠️ NEVER AN EMPTY STRING AND NEVER SILENT.
 *
 * `apiErrorMessage` reads the engine's own answer (the validation text, the
 * refusal code); the fallback is only used when there is no answer at all.
 */
export function offlineFailureMessage(error: unknown, fallback: string): string {
  return apiErrorMessage(error, fallback)
}
