// ============================================
// packages/validation/src/schemas/sync-identity.ts
//
// Shared identity helper for sync clients across web, desktop, and mobile.
// 1. Produces a persistent deviceId stored once per installation (sync & async).
// 2. Derives a stable, deterministic UUID batchId from outbox entry IDs across retries.
// ============================================

export interface DeviceIdStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface AsyncDeviceIdStorage {
  getItem(key: string): Promise<string | null> | string | null
  setItem(key: string, value: string): Promise<void> | void
}

const STORAGE_KEY = 'hisabche_sync_device_id'

/**
 * The page's `localStorage`, when there is one. Read through `globalThis` with
 * a structural type: this file is imported by the Electron MAIN process, whose
 * tsconfig has no DOM lib, so `window` and `Storage` do not exist there.
 */
interface LocalStorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function browserStorage(): LocalStorageLike | undefined {
  return (globalThis as { localStorage?: LocalStorageLike }).localStorage
}
let cachedDeviceId: string | null = null

export function _resetCachedDeviceIdForTesting(): void {
  cachedDeviceId = null
}

function generateSecureDeviceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    bytes[6] = (bytes[6]! & 0x0f) | 0x40 // v4
    bytes[8] = (bytes[8]! & 0x3f) | 0x80 // RFC4122 variant
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
  }
  // When standard crypto is missing (e.g. older Hermes without polyfill):
  // Generate a valid RFC4122 v4 UUID from a high-entropy seed
  return deriveStableBatchId(`device-${Date.now()}-${Math.random()}`)
}

/**
 * Derives a stable, deterministic RFC4122 UUID from an outbox entry's
 * client id or mutation id. Retries of the same entry receive the exact same batchId.
 * Older queue entries with non-UUID IDs (e.g. integer or prefix strings)
 * are deterministically mapped to a valid RFC4122 UUID.
 */
export function deriveStableBatchId(seed: string): string {
  if (!seed) return '00000000-0000-4000-8000-000000000001'

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (uuidRegex.test(seed)) {
    return seed.toLowerCase()
  }

  // Deterministic 128-bit hash to valid RFC4122 v4 UUID
  let h1 = 0xdeadbeef
  let h2 = 0x41c64e6d
  let h3 = 0x9e3779b9
  let h4 = 0x85ebca6b
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
    h3 = Math.imul(h3 ^ ch, 3812015801)
    h4 = Math.imul(h4 ^ ch, 2246822507)
  }

  const toHex = (n: number) => (n >>> 0).toString(16).padStart(8, '0')
  const hex = toHex(h1) + toHex(h2) + toHex(h3) + toHex(h4)

  const part1 = hex.slice(0, 8)
  const part2 = hex.slice(8, 12)
  const part3 = '4' + hex.slice(13, 16)
  const part4 = '8' + hex.slice(17, 20)
  const part5 = hex.slice(20, 32)
  return `${part1}-${part2}-${part3}-${part4}-${part5}`
}

/**
 * Synchronous persistent device ID accessor for synchronous storages (e.g. web localStorage).
 */
export function getPersistentDeviceId(storage?: DeviceIdStorage): string {
  if (cachedDeviceId) return cachedDeviceId

  if (storage) {
    try {
      const stored = storage.getItem(STORAGE_KEY)
      if (typeof stored === 'string' && stored.length > 0) {
        cachedDeviceId = stored
        return stored
      }
    } catch {
      // ignore
    }
  } else if (browserStorage() !== undefined) {
    try {
      const stored = browserStorage()?.getItem(STORAGE_KEY) ?? null
      if (stored) {
        cachedDeviceId = stored
        return stored
      }
    } catch {
      // ignore
    }
  }

  const generated = generateSecureDeviceId()
  cachedDeviceId = generated

  if (storage) {
    try {
      storage.setItem(STORAGE_KEY, generated)
    } catch {
      // ignore
    }
  } else if (browserStorage() !== undefined) {
    try {
      browserStorage()?.setItem(STORAGE_KEY, generated)
    } catch {
      // ignore
    }
  }

  return generated
}

/**
 * Asynchronous persistent device ID accessor for async storages (e.g. React Native AsyncStorage).
 * Awaits getItem/setItem, caches result, and tolerates storage errors by generating once per process.
 */
export async function getPersistentDeviceIdAsync(storage?: AsyncDeviceIdStorage): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId

  if (storage) {
    try {
      const stored = await storage.getItem(STORAGE_KEY)
      if (typeof stored === 'string' && stored.length > 0) {
        cachedDeviceId = stored
        return stored
      }
    } catch {
      // ignore storage error, proceed to generate
    }
  } else if (browserStorage() !== undefined) {
    try {
      const stored = browserStorage()?.getItem(STORAGE_KEY) ?? null
      if (stored) {
        cachedDeviceId = stored
        return stored
      }
    } catch {
      // ignore
    }
  }

  const generated = generateSecureDeviceId()
  cachedDeviceId = generated

  if (storage) {
    try {
      await storage.setItem(STORAGE_KEY, generated)
    } catch {
      // ignore storage write failure
    }
  } else if (browserStorage() !== undefined) {
    try {
      browserStorage()?.setItem(STORAGE_KEY, generated)
    } catch {
      // ignore
    }
  }

  return generated
}
