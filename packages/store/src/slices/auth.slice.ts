import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import CryptoJS from 'crypto-js'

// ============================================
// ENCRYPTION (بدون تغییر)
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

  // Actions
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
// HELPERS: API calls (جایگزین supabase مستقیم)
// ============================================
async function apiLogin(email: string, password: string) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
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
  const res = await fetch(`${API_BASE}/api/auth/signup`, {
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
  await fetch(`${API_BASE}/api/auth/logout`, {
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

      // =====================================
      // INIT AUTH
      // =====================================
      initAuth: () => {
        const state = get()
        set({
          hasHydrated: true,
          isAuthenticated: !!state.user && !!state.token,
        })
      },

      // =====================================
      // CLEAR ERROR
      // =====================================
      clearError: () => set({ error: null }),

      // =====================================
      // LOGIN
      // =====================================
      login: async (credentials) => {
        set({ isLoading: true, error: null })

        try {
          // Demo login — بدون تغییر
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

          // ✅ FIX: API call به بک‌اند به جای supabase مستقیم
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

      // =====================================
      // SIGNUP (جدید)
      // =====================================
      signup: async (data) => {
        set({ isLoading: true, error: null })

        try {
          // ✅ FIX: API call به بک‌اند به جای supabase.auth.signUp مستقیم
          const result = await apiSignup(data)

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

      // =====================================
      // LOGOUT
      // =====================================
      logout: async () => {
        try {
          const state = get()
          if (!state.isDemo && state.token) {
            // ✅ FIX: API call به بک‌اند به جای supabase.auth.signOut
            await apiLogout(state.token)
          }
        } catch (err) {
          console.error('LOGOUT ERROR:', err)
        } finally {
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