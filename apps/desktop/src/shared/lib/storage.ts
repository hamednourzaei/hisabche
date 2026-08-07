// ============================================
// Desktop storage adapters.
//
// @hisabche/api defines the KeyValueStorage contract; here it is backed by the
// OS credential store through the preload bridge. Reads are synchronous, so a
// memory cache is hydrated once at startup and written through on every set.
// ============================================

import { registerStorage, STORAGE_KEYS, type KeyValueStorage } from '@hisabche/api'
import { createSessionStore, type SessionStore } from '@hisabche/auth-core'

import { bridge } from './bridge'

const SESSION_KEY = 'hisabche.session'
const cache = new Map<string, string>()

export const desktopStorage: KeyValueStorage = {
  getItem: (key) => cache.get(key) ?? null,
  setItem: (key, value) => {
    cache.set(key, value)
    void bridge()?.secure.set(key, value)
  },
  removeItem: (key) => {
    cache.delete(key)
    void bridge()?.secure.delete(key)
  },
}

const secureBackend = {
  get: (key: string) => (bridge()?.secure.get(key) ?? Promise.resolve(null)).catch(() => null),
  set: async (key: string, value: string) => {
    await bridge()?.secure.set(key, value)
  },
  remove: async (key: string) => {
    await bridge()?.secure.delete(key)
  },
}

export const sessionStore: SessionStore = createSessionStore(secureBackend, SESSION_KEY)

/** Register the adapter and warm the sync cache. Call once, before render. */
export async function initStorage(): Promise<void> {
  registerStorage(desktopStorage)

  const keys = [STORAGE_KEYS.language, STORAGE_KEYS.token]
  await Promise.all(
    keys.map(async (key) => {
      const value = await secureBackend.get(key)
      if (value !== null) cache.set(key, value)
    }),
  )
}
