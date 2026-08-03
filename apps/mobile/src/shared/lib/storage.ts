// ============================================
// Mobile storage adapters
//
// `@hisabche/api` defines the KeyValueStorage contract; this file supplies
// the device implementation (expo-secure-store, Keychain / Keystore backed).
//
// SecureStore is async-only, while the API client reads synchronously inside
// its request interceptor. A write-through memory cache bridges the two:
// hydrated once at startup, then kept in step with every write.
// ============================================

import * as SecureStore from 'expo-secure-store'
import { registerStorage, STORAGE_KEYS, type KeyValueStorage } from '@hisabche/api'
import { createSessionStore, type SessionStore } from '@hisabche/auth-core'

const SESSION_KEY = 'hisabche.session'

// SecureStore keys accept only alphanumerics, ".", "-" and "_".
const toSecureKey = (key: string): string => key.replace(/[^A-Za-z0-9._-]/g, '_')

const cache = new Map<string, string>()

export const secureStorage: KeyValueStorage = {
  getItem: (key) => cache.get(key) ?? null,
  setItem: (key, value) => {
    cache.set(key, value)
    void SecureStore.setItemAsync(toSecureKey(key), value).catch(() => undefined)
  },
  removeItem: (key) => {
    cache.delete(key)
    void SecureStore.deleteItemAsync(toSecureKey(key)).catch(() => undefined)
  },
}

/** Async key/value backend used for values that are never read synchronously. */
export const secureBackend = {
  get: (key: string) => SecureStore.getItemAsync(toSecureKey(key)).catch(() => null),
  set: async (key: string, value: string) => {
    await SecureStore.setItemAsync(toSecureKey(key), value).catch(() => undefined)
  },
  remove: async (key: string) => {
    await SecureStore.deleteItemAsync(toSecureKey(key)).catch(() => undefined)
  },
}

export const sessionStore: SessionStore = createSessionStore(secureBackend, SESSION_KEY)

/** Register the adapter and warm the sync cache. Call once, before render. */
export async function initStorage(): Promise<void> {
  registerStorage(secureStorage)

  const keys = [STORAGE_KEYS.language, STORAGE_KEYS.token]
  await Promise.all(
    keys.map(async (key) => {
      const value = await secureBackend.get(key)
      if (value !== null) cache.set(key, value)
    })
  )
}
