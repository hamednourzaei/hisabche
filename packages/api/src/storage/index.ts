// ============================================
// Storage abstraction
//
// The API layer must not know whether it runs in a browser, on a device,
// or on a server. Consumers register a platform adapter once at startup:
//
//   web    → registerStorage(createWebStorage())
//   mobile → registerStorage(createSecureStoreAdapter())
//
// Until an adapter is registered, reads return null and writes are dropped,
// so the client keeps working (unauthenticated / default language).
// ============================================

export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export const STORAGE_KEYS = {
  language: 'hisabche-lang',
  token: 'hisabche-token',
  auth: 'hisabche-auth',
} as const

const nullStorage: KeyValueStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
}

let adapter: KeyValueStorage = nullStorage

export function registerStorage(storage: KeyValueStorage): void {
  adapter = storage
}

export function getStorage(): KeyValueStorage {
  return adapter
}

export function readStorage(key: string): string | null {
  try {
    return adapter.getItem(key)
  } catch {
    return null
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    adapter.setItem(key, value)
  } catch {
    // A failing adapter must never break a request.
  }
}

export function removeStorage(key: string): void {
  try {
    adapter.removeItem(key)
  } catch {
    // ignore
  }
}
