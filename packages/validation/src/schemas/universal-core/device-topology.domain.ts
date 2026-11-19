// ============================================
// packages/validation/src/schemas/universal-core/device-topology.domain.ts
//
// PART 5 / Slice 6 — FLEXIBLE DEVICE TOPOLOGY CONTRACTS.
//
// These are CONTRACT-LEVEL roles only. PRIMARY_DEVICE is the only operational
// role in this release. LOCAL_SERVER and LAN_CLIENT are named so a future host
// can be built without a second business core or a second sync engine — naming
// them here does NOT advertise LAN capability.
// ============================================

export const DEVICE_ROLES = ['PRIMARY_DEVICE', 'LOCAL_SERVER', 'LAN_CLIENT'] as const
export type DeviceRole = (typeof DEVICE_ROLES)[number]

/** Only this role may own a standalone business database in this release. */
export const OPERATIONAL_ROLES: readonly DeviceRole[] = ['PRIMARY_DEVICE']

export interface DeviceTopologyFacts {
  readonly role: DeviceRole
  /** The device has its own local, durable business database. */
  readonly hasLocalDatabase: boolean
  /** A LAN host has been authenticated; required for a LAN client. */
  readonly authenticatedWithLocalServer: boolean
}

export interface TopologyDecision {
  readonly allowed: boolean
  readonly operational: boolean
  readonly reason: 'OK' | 'ROLE_NOT_OPERATIONAL' | 'NO_LOCAL_DATABASE' | 'NO_LAN_AUTHENTICATION'
}

export function evaluateDeviceTopology(facts: DeviceTopologyFacts): TopologyDecision {
  if (!facts.hasLocalDatabase) {
    return { allowed: false, operational: false, reason: 'NO_LOCAL_DATABASE' }
  }
  if (facts.role === 'LAN_CLIENT' && !facts.authenticatedWithLocalServer) {
    return { allowed: false, operational: false, reason: 'NO_LAN_AUTHENTICATION' }
  }
  return {
    allowed: true,
    operational: OPERATIONAL_ROLES.includes(facts.role),
    reason: 'OK',
  }
}
