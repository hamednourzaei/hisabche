// ============================================
// Mobile auth store
//
// The session model, role rules and persistence contract live in
// @hisabche/auth-core; this store only supplies the mobile adapter
// (expo-secure-store) and the network calls. No duplicated identity types.
// ============================================

import { create } from 'zustand'
import { registerTokenGetter, setOnUnauthorized, type ApiError } from '@hisabche/api'
import {
  sessionCan,
  type Capability,
  type LoginCredentials,
  type Session,
  type SignUpPayload,
} from '@hisabche/auth-core'

import { apiClient } from '../../shared/lib/api'
import { sessionStore } from '../../shared/lib/storage'

export interface AuthState {
  session: Session | null
  isAuthenticated: boolean
  isHydrated: boolean
  isLoading: boolean
  error: string | null

  hydrate: () => Promise<void>
  login: (input: LoginCredentials) => Promise<void>
  signup: (input: SignUpPayload) => Promise<void>
  logout: () => Promise<void>
  clearError: () => void
}

function toMessage(error: unknown): string {
  const apiError = error as Partial<ApiError>
  return apiError?.message ?? 'NETWORK_ERROR'
}

async function postAuth(path: '/auth/login' | '/auth/signup', body: object): Promise<Session> {
  const response = await apiClient.post<Session & { data?: Session }>(path, body)
  const payload = response.data
  return payload.data ?? payload
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  isAuthenticated: false,
  isHydrated: false,
  isLoading: false,
  error: null,

  hydrate: async () => {
    const session = await sessionStore.read()
    set({ session, isAuthenticated: session !== null, isHydrated: true })
  },

  login: async (input) => {
    set({ isLoading: true, error: null })
    try {
      const session = await postAuth('/auth/login', {
        email: input.email.trim(),
        password: input.password,
      })
      await sessionStore.write(session)
      set({ session, isAuthenticated: true, isLoading: false })
    } catch (error) {
      set({ isLoading: false, error: toMessage(error) })
      throw error
    }
  },

  signup: async (input) => {
    set({ isLoading: true, error: null })
    try {
      const session = await postAuth('/auth/signup', { ...input, email: input.email.trim() })
      await sessionStore.write(session)
      set({ session, isAuthenticated: true, isLoading: false })
    } catch (error) {
      set({ isLoading: false, error: toMessage(error) })
      throw error
    }
  },

  logout: async () => {
    if (get().session) await apiClient.post('/auth/logout', {}).catch(() => undefined)
    await sessionStore.clear()
    set({ session: null, isAuthenticated: false, isLoading: false, error: null })
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
// Wire the shared API client to this store (same contract as web)
// ============================================
registerTokenGetter(() => useAuthStore.getState().session?.token ?? null)

setOnUnauthorized(() => {
  void sessionStore.clear()
  useAuthStore.setState({ session: null, isAuthenticated: false })
})
