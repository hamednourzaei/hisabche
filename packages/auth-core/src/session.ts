// ============================================
// Session persistence contract.
//
// auth-core defines *what* a session is and how it is validated;
// each platform supplies *where* it is stored:
//   web    → localStorage adapter
//   mobile → expo-secure-store adapter
// ============================================

import type { Session } from './types'

export interface SessionStore {
  read(): Promise<Session | null>
  write(session: Session): Promise<void>
  clear(): Promise<void>
}

export function isSession(value: unknown): value is Session {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<Session>
  return (
    typeof candidate.token === 'string' &&
    candidate.token.length > 0 &&
    typeof candidate.user?.id === 'string' &&
    typeof candidate.user?.email === 'string'
  )
}

/** Parse a persisted payload, returning null on anything malformed. */
export function parseSession(raw: string | null): Session | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return isSession(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function serializeSession(session: Session): string {
  return JSON.stringify(session)
}

/**
 * Build a SessionStore from a key/value backend.
 * `get` / `set` / `remove` may be sync or async.
 */
export function createSessionStore(backend: {
  get(key: string): Promise<string | null> | string | null
  set(key: string, value: string): Promise<void> | void
  remove(key: string): Promise<void> | void
}, key = 'hisabche.session'): SessionStore {
  return {
    read: async () => parseSession(await backend.get(key)),
    write: async (session) => {
      await backend.set(key, serializeSession(session))
    },
    clear: async () => {
      await backend.remove(key)
    },
  }
}
