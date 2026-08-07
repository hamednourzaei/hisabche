// ============================================
// Desktop auth store with security hardening.
//
// The session model, role rules and persistence contract live in
// @hisabche/auth-core; this store only supplies the desktop adapter
// (OS credential store via the preload bridge) and the network calls.
// ============================================

import { create } from 'zustand'
import { registerTokenGetter, setOnUnauthorized, type ApiError } from '@hisabche/api'
import {
  isSession,
  sessionCan,
  type Capability,
  type LoginCredentials,
  type Session,
} from '@hisabche/auth-core'

import { apiClient } from '@/shared/lib/api'
import { sessionStore } from '@/shared/lib/storage'

export interface AuthState {
  session: Session | null
  isAuthenticated: boolean
  isHydrated: boolean
  isLoading: boolean
  error: string | null
  isSessionValid: boolean

  hydrate: () => Promise<void>
  login: (input: LoginCredentials) => Promise<void>
  logout: () => Promise<void>
  validateSession: () => Promise<boolean>
  refreshToken: () => Promise<void>
  clearError: () => void
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

async function postLogin(body: LoginCredentials): Promise<Session> {
  const response = await apiClient.post<
    | Session
    | {
        data?: Session
        user?: Session['user']
        token?: string
        access_token?: string
      }
  >('/auth/login', body)

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
export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  isAuthenticated: false,
  isHydrated: false,
  isLoading: false,
  error: null,
  isSessionValid: false,

  hydrate: async () => {
    try {
      const session = await sessionStore.read()
      const isValid = isSession(session)
      set({
        session,
        isAuthenticated: session !== null,
        isHydrated: true,
        isSessionValid: isValid,
        error: isValid ? null : 'INVALID_SESSION_DATA',
      })
    } catch (error) {
      set({
        isHydrated: true,
        error: toMessage(error),
        session: null,
        isAuthenticated: false,
        isSessionValid: false,
      })
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
      const response = await apiClient.post<{ token: string }>('/auth/refresh', {
        token: state.session.token,
      })

      const newSession: Session = {
        ...state.session,
        token: response.data.token,
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

      const session = await postLogin({ email, password: input.password })

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

  logout: async () => {
    const state = get()
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
    })
  },

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
