// ============================================
// Main-process session storage adapter.
//
// The renderer persists the session through the preload bridge; the main
// process needs its own copy of the same contract so IPC handlers can check
// auth without crossing the bridge. Backed by the OS credential store
// (services/secure-store.ts → Electron safeStorage / DPAPI / Keychain).
// ============================================

import { createSessionStore, type SessionStore } from '@hisabche/auth-core'
import { secureGet, secureSet, secureDelete } from '../../main/services/secure-store'

const SESSION_KEY = 'hisabche.session'

const secureBackend = {
  get: (key: string): string | null => secureGet(key),
  set: (key: string, value: string): void => secureSet(key, value),
  remove: (key: string): void => secureDelete(key),
}

export const sessionStore: SessionStore = createSessionStore(secureBackend, SESSION_KEY)
