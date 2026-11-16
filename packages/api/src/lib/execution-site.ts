// ============================================
// Where an operation runs: on this device, or on the server.
//
// ⚠️ THE ANSWER DEPENDS ON THE HOST AND ON THE DATA IT HOLDS — NEVER ON THE
// HARDWARE. A weak phone holding the same rows computes the same integers as a
// strong one, so nothing here may read a device class, memory or
// `runtime-policy` (guard: execution-site-not-device-class.test.ts).
//
// `device` only when all of these hold:
//   1. a host registered a readiness check (the web build never does);
//   2. a workspace is active;
//   3. the host says it is ready for THIS operation in THIS workspace — which
//      is where the edition (the offline edition already runs everything
//      locally, through the transport itself) and the pulled tables are judged.
//
// This module imports nothing but the active workspace on purpose: every hook
// reads it, and a decision that dragged the HTTP client in would make each of
// their tests mock the client's whole surface.
// ============================================

import { getActiveWorkspaceId } from './active-workspace'

export type DeviceOperation = 'invoice.create' | 'payment.record' | 'invoice.return'

export type ExecutionSite = 'device' | 'server'

type DeviceReadinessCheck = (workspaceId: string, operation: DeviceOperation) => boolean

let readiness: DeviceReadinessCheck | null = null

/** Registered by the host once its SQLite and sync engine are up; the web build never registers. */
export function registerDeviceReadiness(check: DeviceReadinessCheck): void {
  readiness = check
}

export function executionSiteFor(operation: DeviceOperation): ExecutionSite {
  if (!readiness) return 'server'
  const workspaceId = getActiveWorkspaceId()
  if (!workspaceId) return 'server'
  return readiness(workspaceId, operation) ? 'device' : 'server'
}

/** Test seam: forget the host. */
export function resetDeviceReadiness(): void {
  readiness = null
}
