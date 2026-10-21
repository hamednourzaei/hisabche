// ============================================
// Desktop auth store with security hardening.
//
// The session model, role rules and persistence contract live in
// @hisabche/auth-core; this store only supplies the desktop adapter
// (OS credential store via the preload bridge) and the network calls.
// ============================================

import { create } from 'zustand'
import {
  markTokenReady,
  readStorage,
  registerTokenGetter,
  setOnUnauthorized,
  setRefreshSession,
  STORAGE_KEYS,
  type ApiError,
} from '@hisabche/api'
import { signUpSchema, type SignUpInput } from '@hisabche/validation'
import {
  isSession,
  isSessionUsable,
  sessionCan,
  type Capability,
  type LoginCredentials,
  type AuthUser,
  type Session,
} from '@hisabche/auth-core'
import { useAuthStore as useSharedAuthStore, useWorkspaceStore } from '@hisabche/store'

import { apiClient } from '@/shared/lib/api'
import { bridge } from '@/shared/lib/bridge'
import { sessionStore } from '@/shared/lib/storage'
import { buildOfflineSession, type OfflineWorkspace } from './offline-session'

export interface AuthState {
  session: Session | null
  isAuthenticated: boolean
  isHydrated: boolean
  isLoading: boolean
  error: string | null
  isSessionValid: boolean

  hydrate: () => Promise<void>
  login: (input: LoginCredentials) => Promise<void>
  signup: (input: SignUpInput) => Promise<void>
  /**
   * Sign out.
   *
   * ⚠️ REFUSED while this account has changes on this device that were never
   * sent: the dialog opens instead, and the person chooses. `force` is that
   * choice — the changes and the data stay on the device for their owner.
   *
   * Returns whether the sign-out happened.
   */
  logout: (options?: { force?: boolean }) => Promise<boolean>
  /** How many of this account's changes are still unsent. */
  pendingLogoutCount: number
  /** Close the dialog without signing out. */
  dismissPendingLogout: () => void
  validateSession: () => Promise<boolean>
  refreshToken: () => Promise<void>
  clearError: () => void
  /**
   * Open the app as the local owner of a workspace on this device.
   *
   * ⚠️ THE ONE PLACE A LOCAL SESSION IS BUILT.
   *
   * The login page and this store used to build one each. Now both call
   * `buildOfflineSession()` (offline-session.ts) and this action, so the
   * first run and the restart after it cannot disagree about who the owner
   * is or what the session token is.
   */
  startOfflineSession: (workspace: OfflineWorkspace) => void
}

function toMessage(error: unknown): string {
  const apiError = error as Partial<ApiError>
  return apiError?.message ?? 'NETWORK_ERROR'
}

// ============================================
// The backend's Supabase-issued JWT already carries the user's id (`sub`)
// and email in its payload. Some /auth/login responses return an empty
// `user: {}` object even though the token itself has everything we need,
// so we fall back to decoding the token's claims to fill in the gaps.
// This mirrors what the web app effectively gets "for free" by talking
// to the Supabase client directly (packages/store/src/slices/auth.slice.ts).
//
// Note: this is NOT a security check. We are only reading the payload of
// a token we already received over an authenticated response; the server
// remains the source of truth and verifies the token on every request.
// ============================================
function decodeJwtPayload(token: string): { sub?: string; email?: string } {
  try {
    const base64Url = token.split('.')[1]
    if (!base64Url) return {}
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const json = atob(base64)
    return JSON.parse(json)
  } catch {
    return {}
  }
}

/** Fill in missing user.id / user.email from the JWT claims when the backend omits them. */
function hydrateUserFromToken(
  rawUser: Partial<Session['user']> | undefined,
  token: string,
): Session['user'] {
  const claims = decodeJwtPayload(token)
  return {
    ...rawUser,
    id: rawUser?.id ?? claims.sub ?? '',
    email: rawUser?.email ?? claims.email ?? '',
  } as Session['user']
}

async function postAuth(path: string, body: unknown): Promise<Session> {
  const response = await apiClient.post<
    | Session
    | {
        data?: Session
        user?: Session['user']
        token?: string
        access_token?: string
        refreshToken?: string
      }
  >(path, body)

  const payload = response.data

  if (
    payload &&
    typeof payload === 'object' &&
    'token' in payload &&
    typeof payload.token === 'string' &&
    'user' in payload &&
    payload.user
  ) {
    return {
      user: hydrateUserFromToken(payload.user, payload.token),
      token: payload.token,
      // ⚠️ KEPT NOW. The server has always sent it; this dropped it, so the
      // session could not outlive its one-hour access token.
      ...('refreshToken' in payload && typeof payload.refreshToken === 'string'
        ? { refreshToken: payload.refreshToken }
        : {}),
    }
  }

  if (
    payload &&
    typeof payload === 'object' &&
    'data' in payload &&
    payload.data &&
    isSession(payload.data)
  ) {
    return payload.data
  }

  if (
    payload &&
    typeof payload === 'object' &&
    'access_token' in payload &&
    typeof payload.access_token === 'string' &&
    'user' in payload &&
    payload.user
  ) {
    return {
      user: hydrateUserFromToken(payload.user, payload.access_token),
      token: payload.access_token,
    }
  }

  throw new Error('INVALID_SESSION_RESPONSE')
}
/**
 * Sign-up posts to the same envelope-shaped endpoint login does, so it reuses
 * the same normalisation rather than duplicating the three response shapes the
 * backend can return.
 */
async function postSignup(body: SignUpInput): Promise<Session> {
  return postAuth('/auth/signup', body)
}

/**
 * The changes on this device that belong to this account and were never sent.
 *
 * The rows of ANOTHER account are not counted: they are not this person's
 * work, and they are never sent by them.
 */
async function countPendingChanges(userId: string): Promise<number> {
  const device = bridge()
  if (!device) return 0
  try {
    const entries = await device.db.queue()
    return entries.filter((entry) => entry.userId === userId).length
  } catch {
    // A device that cannot be read must not stop the sign-out.
    return 0
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  isAuthenticated: false,
  isHydrated: false,
  isLoading: false,
  error: null,
  isSessionValid: false,
  pendingLogoutCount: 0,

  hydrate: async () => {
    try {
      const stored = await sessionStore.read()

      // ═══════════════════════════════════════════════════════════════════
      // ⚠️ A SHAPE CHECK CANNOT TELL YOU THE SESSION IS OVER.
      //
      // `isSession` asks whether the blob has a token, an id and an email. A
      // token issued last month has all three, so the app opened straight
      // onto the dashboard for someone who was no longer signed in — and the
      // login screen they were expecting never appeared.
      //
      // Online that shows up as every request 401ing behind a UI that
      // believes it is authenticated. Offline nothing corrects it at all.
      //
      // An expired session is treated exactly like a malformed one: dropped,
      // cleared from the store, and sent to `/login`. What it is NOT is an
      // error — a session ending is the ordinary passage of time, not a
      // fault, and telling the person their data was corrupt would be a lie.
      // ═══════════════════════════════════════════════════════════════════
      const hasShape = isSession(stored)
      // An expired access token with a refresh token is still usable — the
      // first request renews it (setRefreshSession below). See isSessionUsable.
      const isValid = isSessionUsable(stored)

      // ═══════════════════════════════════════════════════════════════════
      // ⚠️ THE VALIDATION RESULT IS THE GATE — IT USED TO BE DISCARDED.
      //
      // This read `isAuthenticated: session !== null`. `isSession` was called,
      // its answer stored in `isSessionValid` and used to pick an error
      // message — and then the gate ignored it and asked only whether the
      // secure store had returned ANYTHING.
      //
      // `RequireAuth` checks `isAuthenticated` alone, so any non-null blob on
      // disk — a truncated write, a session from an older shape, a file left
      // by a previous install — opened the app straight into the dashboard
      // with no token behind it. Every request then 401s against a UI that
      // believes it is signed in.
      //
      // A session that does not validate is not a session. It is dropped
      // rather than kept, so nothing downstream can read a `session` the app
      // has already decided not to trust, and the bad blob is cleared so the
      // next launch starts clean instead of failing the same way forever.
      // ═══════════════════════════════════════════════════════════════════
      if (stored !== null && !isValid) {
        await sessionStore.clear().catch(() => {
          // Best effort. Failing to clear must not stop the app booting to
          // the login screen, which is where it needs to be either way.
        })
      }

      const isOffline =
        (typeof window !== 'undefined' &&
          (window as { __hisabcheEdition?: string }).__hisabcheEdition === 'offline') ||
        readStorage(STORAGE_KEYS.edition) === 'offline'

      if (isOffline) {
        try {
          const res =
            await apiClient.get<Array<{ id: string; name: string; ownerId: string }>>('/workspaces')
          const workspaces = res.data
          if (Array.isArray(workspaces) && workspaces.length > 0) {
            const ws = workspaces[0]!
            const offlineSession: Session = buildOfflineSession({
              id: ws.id,
              name: ws.name,
              ownerId: ws.ownerId,
            })
            useWorkspaceStore.getState().setWorkspace(ws.id, ws.name)
            set({
              session: offlineSession,
              isAuthenticated: true,
              isHydrated: true,
              isSessionValid: true,
              error: null,
            })
            return
          }
        } catch (error) {
          // ⚠️ THE WORKSPACE COULD NOT BE READ.
          //
          // This is NOT "no workspace yet": it is a failed read, and the
          // difference matters. A failed read means the device database is
          // not answering, and continuing as if there were no business would
          // show an empty app and call it «your shop». The error is kept so
          // the screen can say what happened instead of showing nothing.
          set({
            isHydrated: true,
            error: toMessage(error),
            session: null,
            isAuthenticated: false,
            isSessionValid: false,
          })
          return
        }
      }

      set({
        session: isValid ? stored : null,
        isAuthenticated: isValid,
        isHydrated: true,
        isSessionValid: isValid,
        // Only an actual malformed payload is an error. An empty store is the
        // ordinary state of a machine nobody has signed in on yet.
        error: stored !== null && !hasShape ? 'INVALID_SESSION_DATA' : null,
      })
    } catch (error) {
      set({
        isHydrated: true,
        error: toMessage(error),
        session: null,
        isAuthenticated: false,
        isSessionValid: false,
      })
    } finally {
      /**
       * Hydration is finished — with a session or without one. Either way the API
       * client may stop holding requests back. `registerTokenGetter` no longer says
       * this: registering the getter happens at import, long before the stored
       * session has been read, and announcing readiness there was what sent the
       * first requests of a launch out with no Authorization header.
       */
      markTokenReady()
    }
  },

  validateSession: async () => {
    const state = get()
    if (!state.session) return false

    try {
      const response = await apiClient.post('/auth/validate', { token: state.session.token })
      const isValid = response.data.valid === true

      if (!isValid) {
        await sessionStore.clear()
        set({
          session: null,
          isAuthenticated: false,
          isSessionValid: false,
          error: 'SESSION_INVALID_OR_EXPIRED',
        })
      }

      set({ isSessionValid: isValid })
      return isValid
    } catch (error) {
      await sessionStore.clear()
      set({
        session: null,
        isAuthenticated: false,
        isSessionValid: false,
        error: toMessage(error),
      })
      return false
    }
  },

  refreshToken: async () => {
    const state = get()
    if (!state.session?.token) {
      throw new Error('NO_TOKEN_TO_REFRESH')
    }

    set({ isLoading: true, error: null })
    try {
      const response = await apiClient.post<{ token: string; refreshToken?: string }>(
        '/auth/refresh',
        { refreshToken: state.session.refreshToken },
      )

      const newSession: Session = {
        ...state.session,
        token: response.data.token,
        refreshToken: response.data.refreshToken ?? state.session.refreshToken,
        user: state.session.user,
      }

      await sessionStore.write(newSession)
      set({
        session: newSession,
        isSessionValid: true,
        isLoading: false,
        error: null,
      })
    } catch (error) {
      set({
        isLoading: false,
        error: toMessage(error),
      })
      throw error
    }
  },

  login: async (input) => {
    set({ isLoading: true, error: null })
    try {
      // Validate input format
      const email = input.email.trim()
      if (!email || !email.includes('@') || email.length > 254) {
        throw new Error('INVALID_EMAIL_FORMAT')
      }

      if (!input.password || typeof input.password !== 'string' || input.password.length < 8) {
        throw new Error('INVALID_PASSWORD_REQUIREMENTS')
      }

      const session = await postAuth('/auth/login', { email, password: input.password })

      if (!isSession(session)) {
        throw new Error('INVALID_SESSION_RESPONSE')
      }

      await sessionStore.write(session)
      set({
        session,
        isAuthenticated: true,
        isLoading: false,
        isSessionValid: true,
        error: null,
      })
    } catch (error) {
      set({
        isLoading: false,
        error: toMessage(error),
      })
      throw error
    }
  },

  // Validated with the shared `signUpSchema` — the same contract the backend
  // route and the web store use — then persisted through the same OS
  // credential store login writes to. No second token store.
  signup: async (input) => {
    set({ isLoading: true, error: null })
    try {
      const parsed = signUpSchema.safeParse({
        ...input,
        email: input.email.trim(),
        fullName: input.fullName.trim(),
      })

      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? 'INVALID_SIGNUP_INPUT')
      }

      const session = await postSignup(parsed.data)

      if (!isSession(session)) {
        throw new Error('INVALID_SESSION_RESPONSE')
      }

      await sessionStore.write(session)
      set({
        session,
        isAuthenticated: true,
        isLoading: false,
        isSessionValid: true,
        error: null,
      })
    } catch (error) {
      set({ isLoading: false, error: toMessage(error) })
      throw error
    }
  },

  /**
   * Open the app as the local owner of a workspace on this device.
   *
   * The session is BUILT by `buildOfflineSession()` and nowhere else, and
   * the active workspace is set in the same breath: a session without a
   * workspace is a session that every screen reads an empty business from.
   */
  startOfflineSession: (workspace: OfflineWorkspace) => {
    const session = buildOfflineSession(workspace)
    useWorkspaceStore.getState().setWorkspace(workspace.id, workspace.name)
    set({
      session,
      isAuthenticated: true,
      isHydrated: true,
      isSessionValid: true,
      isLoading: false,
      error: null,
    })
  },

  logout: async (options?: { force?: boolean }): Promise<boolean> => {
    const state = get()

    // ⚠️ THE OUTBOX IS CHECKED BEFORE THE SIGN-OUT. A change that exists
    // nowhere but this device must not disappear with the session — and the
    // person must not be trapped either: the dialog offers both ways out.
    if (!options?.force && state.session) {
      const pending = await countPendingChanges(state.session.user.id)
      if (pending > 0) {
        set({ pendingLogoutCount: pending })
        return false
      }
    }

    if (state.session) {
      try {
        await apiClient.post('/auth/logout', { token: state.session.token })
      } catch (error) {
        console.error('Logout API call failed:', error)
      }

      await sessionStore.clear()
    }

    set({
      session: null,
      isAuthenticated: false,
      isSessionValid: false,
      isLoading: false,
      error: null,
      pendingLogoutCount: 0,
    })

    return true
  },

  dismissPendingLogout: () => set({ pendingLogoutCount: 0 }),

  clearError: () => set({ error: null }),
}))

// ============================================
// Selectors
// ============================================
export const useCurrentUser = () => useAuthStore((s) => s.session?.user ?? null)

export function useCan(capability: Capability): boolean {
  return useAuthStore((s) => sessionCan(s.session, capability))
}

// ============================================
// Wire the shared API client to this store (same contract as web and mobile)
// ============================================
registerTokenGetter(() => useAuthStore.getState().session?.token ?? null)

setOnUnauthorized(() => {
  void sessionStore.clear()
  useAuthStore.setState({
    session: null,
    isAuthenticated: false,
    isSessionValid: false,
    error: 'UNAUTHORIZED',
  })
})

// ============================================
// ⚠️ NOTHING RENEWED A DESKTOP OR MOBILE SESSION.
//
// The API client asks this when a request answers 401; with nothing
// registered it answered "no" and signed the person out — an hour after every
// sign-in. Now the refresh token is exchanged for a new pair.
//
// Only a REFUSAL from the server ends the session. A request that never got an
// answer rethrows instead of returning null: returning null means "signed
// out", and a dropped connection is not that.
// ============================================
setRefreshSession(async () => {
  const session = useAuthStore.getState().session
  if (!session?.refreshToken) return null
  try {
    const { data } = await apiClient.post<{ token: string; refreshToken?: string }>(
      '/auth/refresh',
      { refreshToken: session.refreshToken },
    )
    const renewed: Session = {
      ...session,
      token: data.token,
      refreshToken: data.refreshToken ?? session.refreshToken,
    }
    await sessionStore.write(renewed)
    useAuthStore.setState({ session: renewed, isAuthenticated: true, isSessionValid: true })
    return renewed.token
  } catch (error) {
    if ((error as Partial<ApiError>)?.code === 'NETWORK_ERROR') throw error
    return null
  }
})

// ─── The signed-in person, for the shared UI ────────────────────────────────
//
// Windows and Android keep the session in THIS store; the screens in
// packages/ui read the person from `@hisabche/store` (the web's store). On the
// device that one never had a user, so `usePageLook` was never ready, every
// dashboard part stayed disabled, and the dashboard showed its loading cards
// forever while every other page loaded. Only the person is mirrored — the
// token stays here and the API client keeps reading it from here.
function mirrorSignedInUser(user: AuthUser | null): void {
  if (useSharedAuthStore.getState().user?.id === user?.id) return
  useSharedAuthStore.setState({ user })
}
mirrorSignedInUser(useAuthStore.getState().session?.user ?? null)
useAuthStore.subscribe((state) => mirrorSignedInUser(state.session?.user ?? null))
