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
export function createSessionStore(
  backend: {
    get(key: string): Promise<string | null> | string | null
    set(key: string, value: string): Promise<void> | void
    remove(key: string): Promise<void> | void
  },
  key = 'hisabche.session',
): SessionStore {
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

// ══════════════════════════════════════════════════════════════════════════
// ⚠️ `isSession` IS A SHAPE CHECK, AND A SHAPE CHECK CANNOT EXPIRE.
//
// A token issued months ago still has a string `token`, a `user.id` and a
// `user.email`, so it passes `isSession` exactly as a fresh one does. The
// desktop app read it at launch, set `isAuthenticated: true`, and opened on
// the dashboard — for someone whose session had ended. Nothing said so: the
// screens render, and every request behind them 401s.
//
// Offline it is worse, because no 401 ever arrives to correct the mistake.
// The app simply sits there, signed in to nothing.
// ══════════════════════════════════════════════════════════════════════════

/**
 * The token's `exp` claim, in milliseconds, or `null` when there is no claim
 * to read.
 *
 * ⚠️ This reads a payload we already hold; it is NOT a security check. The
 * server verifies the signature on every request and stays the only authority
 * on whether a token is good. All this decides is which screen to open on.
 */
export function sessionExpiresAt(session: Session): number | null {
  const payload = session.token.split('.')[1]
  if (!payload) return null

  try {
    const claims: unknown = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    const exp = (claims as { exp?: unknown }).exp
    return typeof exp === 'number' ? exp * 1000 : null
  } catch {
    return null
  }
}

/**
 * Whether the stored session has already ended.
 *
 * ⚠️ A token with NO `exp` claim is not expired. We cannot read an end date
 * that was never written, and guessing one would sign a real person out of a
 * session that is still good (§12). Only a date in the past is an answer.
 */
export function isSessionExpired(session: Session, now: number = Date.now()): boolean {
  const expiresAt = sessionExpiresAt(session)
  return expiresAt !== null && expiresAt <= now
}

/**
 * Whether a stored session may open the app.
 *
 * ⚠️ An expired ACCESS token is not an ended session while a refresh token can
 * renew it. Treating it as one signed every desktop and mobile user out an
 * hour after sign-in, and offline deleted the session from the device.
 */
export function isSessionUsable(value: unknown, now: number = Date.now()): value is Session {
  if (!isSession(value)) return false
  if (!isSessionExpired(value, now)) return true
  return typeof value.refreshToken === 'string' && value.refreshToken.length > 0
}
