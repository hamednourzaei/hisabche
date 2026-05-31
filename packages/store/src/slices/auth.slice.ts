import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { signIn as supabaseSignIn, signOut as supabaseSignOut } from '../../../auth/src/'
import CryptoJS from 'crypto-js'

// ============================================
// ENCRYPTION
// ============================================
const ENCRYPTION_KEY = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || 'hisabche-dev-key-32-chars!!'

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
  createdAt: string
}

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isDemo: boolean
  isLoading: boolean
  hasHydrated: boolean
  error: string | null
  login: (c: { email: string; password: string }) => Promise<void>
  logout: () => Promise<void>
  initAuth: () => void
}

// ============================================
// STORE
// ============================================
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
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
          isAuthenticated: !!state.user,
        })
      },

      // =====================================
      // LOGIN
      // =====================================
      login: async (credentials) => {
        set({ isLoading: true, error: null })

        try {
          // Demo login
          if (credentials.email.trim() === 'demo@hisabche.com' && credentials.password === 'Demo1234') {
            const user: User = {
              id: 'demo-user-1',
              email: credentials.email,
              fullName: 'کاربر آزمایشی',
              businessName: 'فروشگاه نمونه',
              createdAt: new Date().toISOString(),
            }
            set({ user, isAuthenticated: true, isDemo: true, isLoading: false, error: null })
            return
          }

          // Real login
          const response = await supabaseSignIn(credentials.email.trim(), credentials.password)

          if (!response?.user?.id) {
            throw new Error('ایمیل یا رمز عبور اشتباه است')
          }

          const user: User = {
            id: response.user.id,
            email: response.user.email || credentials.email,
            fullName: response.user.user_metadata?.full_name || 'کاربر',
            businessName: response.user.user_metadata?.business_name,
            createdAt: response.user.created_at || new Date().toISOString(),
          }

          set({ user, isAuthenticated: true, isDemo: false, isLoading: false, error: null })
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'ورود ناموفق بود'
          set({ user: null, isAuthenticated: false, isDemo: false, isLoading: false, error: message })
        }
      },

      // =====================================
      // LOGOUT
      // =====================================
      logout: async () => {
        try {
          const state = get()
          if (!state.isDemo) {
            await supabaseSignOut()
          }
        } catch (err) {
          console.error('LOGOUT ERROR:', err)
        } finally {
          set({ user: null, isAuthenticated: false, isDemo: false, isLoading: false, error: null })
        }
      },
    }),
    {
      name: 'hisabche-auth',
      storage: typeof window !== 'undefined' ? createJSONStorage(() => encryptedStorage) : undefined,
      partialize: (s) => ({
        user: s.user,
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