import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import CryptoJS from 'crypto-js'
import { registerTokenGetter } from '@hisabche/api'
import { setOnUnauthorized } from '@hisabche/api'

// ============================================
// ENCRYPTION
// ============================================
const ENCRYPTION_KEY =
  process.env.NEXT_PUBLIC_ENCRYPTION_KEY || 'hisabche-dev-key-32-chars!!'

const encryptedStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null
    try {
      const encrypted = localStorage.getItem(key)
      if (!encrypted) return null
      const bytes = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY)
      return bytes.toString(CryptoJS.enc.Utf8)
    } catch {
      localStorage.removeItem(key)
      return null
    }
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === 'undefined') return
    const encrypted = CryptoJS.AES.encrypt(value, ENCRYPTION_KEY).toString()
    localStorage.setItem(key, encrypted)
  },
  removeItem: (key: string): void => {
    if (typeof window === 'undefined') return
    localStorage.removeItem(key)
  },
}

// ============================================
// Clear auth storage
// ============================================
function clearAuthStorage() {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem('hisabche-auth')
  } catch {}
}

// ============================================
// TYPES
// ============================================
export interface User {
  id: string
  email: string
  fullName: string
  businessName?: string
  avatarUrl?: string
  createdAt: string
}

export interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isDemo: boolean
  isLoading: boolean
  hasHydrated: boolean
  error: string | null

  login: (credentials: { email: string; password: string }) => Promise<void>
  signup: (data: {
    email: string
    password: string
    fullName: string
    businessName?: string
  }) => Promise<void>
  logout: () => Promise<void>
  initAuth: () => void
  clearError: () => void
}

// ============================================
// API BASE URL
// ============================================
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:10000'

// ============================================
// API calls
// ============================================
async function apiLogin(email: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'ورود ناموفق بود')
  }

  return res.json() as Promise<{ user: User; token: string }>
}

async function apiSignup(data: {
  email: string
  password: string
  fullName: string
  businessName?: string
}) {
  const res = await fetch(`${API_BASE}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'ثبت‌نام ناموفق بود')
  }

  return res.json() as Promise<{ user: User; token: string }>
}

async function apiLogout(token: string) {
  await fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  }).catch(() => {})
}

// ============================================
// STORE
// ============================================
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isDemo: false,
      isLoading: false,
      hasHydrated: false,
      error: null,

      initAuth: () => {
        const state = get()
        set({
          hasHydrated: true,
          isAuthenticated: !!state.user && !!state.token,
        })
      },

      clearError: () => set({ error: null }),

      login: async (credentials) => {
        set({ isLoading: true, error: null })

        try {
          if (
            credentials.email.trim() === 'demo@hisabche.com' &&
            credentials.password === 'Demo1234'
          ) {
            const user: User = {
              id: 'demo-user-1',
              email: credentials.email,
              fullName: 'کاربر آزمایشی',
              businessName: 'فروشگاه نمونه',
              createdAt: new Date().toISOString(),
            }
            set({
              user,
              token: 'demo-token',
              isAuthenticated: true,
              isDemo: true,
              isLoading: false,
              error: null,
            })
            return
          }

          const result = await apiLogin(
            credentials.email.trim(),
            credentials.password
          )

          set({
            user: result.user,
            token: result.token,
            isAuthenticated: true,
            isDemo: false,
            isLoading: false,
            error: null,
          })
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : 'ورود ناموفق بود'
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isDemo: false,
            isLoading: false,
            error: message,
          })
        }
      },

      // ✅ signup: فقط بعد از success پاک می‌کنیم
      signup: async (data) => {
        set({ isLoading: true, error: null })

        try {
          const result = await apiSignup(data)

          // ✅ اول success، بعد clear
          clearAuthStorage()

          set({
            user: result.user,
            token: result.token,
            isAuthenticated: true,
            isDemo: false,
            isLoading: false,
            error: null,
          })
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : 'ثبت‌نام ناموفق بود'
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isDemo: false,
            isLoading: false,
            error: message,
          })
        }
      },

      logout: async () => {
        try {
          const state = get()
          if (!state.isDemo && state.token) {
            await apiLogout(state.token)
          }
        } catch (err) {
          console.error('LOGOUT ERROR:', err)
        } finally {
          clearAuthStorage()

          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isDemo: false,
            isLoading: false,
            error: null,
          })
        }
      },
    }),
    {
      name: 'hisabche-auth',
      storage:
        typeof window !== 'undefined'
          ? createJSONStorage(() => encryptedStorage)
          : undefined,
      partialize: (s) => ({
        user: s.user,
        token: s.token,
        isDemo: s.isDemo,
      }),
      onRehydrateStorage: () => () => {
        queueMicrotask(() => {
          useAuthStore.getState().initAuth()
        })
      },
    }
  )
)

// ============================================
// ✅ Register token getter + onUnauthorized
//    فقط یک بار، هنگام import ماژول
// ============================================
if (typeof window !== 'undefined') {
  registerTokenGetter(() => useAuthStore.getState().token)

  setOnUnauthorized(() => {
    // ✅ فقط state رو پاک می‌کنیم، logout API call نمی‌کنیم
    clearAuthStorage()
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isDemo: false,
      error: null,
    })
  })
}