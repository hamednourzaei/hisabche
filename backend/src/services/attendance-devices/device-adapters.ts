// ============================================
// backend/src/services/attendance-devices/device-adapters.ts
//
// One contract every source of device events answers to: «here is what I
// received; give me the events in the one shape the core takes».
//
// ⚠️ THE REGISTRY LISTS ONLY WHAT HAS BEEN PROVEN. Today that is `generic` —
// the wire format this server defines itself (device-event.domain.ts), proven
// by its own tests. There is no ZKTeco, Suprema, Hikvision or Anviz entry:
// each speaks its own protocol, and an adapter written from a manual and
// never run against the terminal is a claim, not support. A brand is added
// here when its adapter has been run against a real device — and until then
// a terminal of that brand connects through a program beside it that speaks
// `generic`.
//
// The core (the database functions, the service, the screens) names no brand
// anywhere. Adding one touches this file and nothing else.
// ============================================

import { normalizeGenericBatch, type NormalizedDeviceEvent } from './device-event.domain'

export interface DeviceAdapter {
  /** The value a sender puts in `format`. */
  readonly format: string
  /** The whole batch normalised, or a DeviceEventError naming what is wrong. */
  normalize(events: unknown, context: { timeZone: string; now: Date }): NormalizedDeviceEvent[]
}

const generic: DeviceAdapter = { format: 'generic', normalize: normalizeGenericBatch }

export const DEVICE_ADAPTERS: readonly DeviceAdapter[] = [generic]

export const DEVICE_FORMATS = DEVICE_ADAPTERS.map((adapter) => adapter.format)

/** The adapter for a format, or null — an unknown format is refused, not guessed. */
export function adapterFor(format: string | undefined): DeviceAdapter | null {
  return DEVICE_ADAPTERS.find((adapter) => adapter.format === (format ?? 'generic')) ?? null
}
