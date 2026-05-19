import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { createClient } from '@supabase/supabase-js'

// ─── Supabase client (direct — no @hisabche/auth needed) ──
const supabase = createClient(
  typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_SUPABASE_URL || '') : '',
  typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '') : ''
)

const supabaseSignIn = (email: string, password: string) =>
  supabase.auth.signInWithPassword({ email, password })

const supabaseSignOut = () => supabase.auth.signOut()

// ─── Types ────────────────────────────────────────────────
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

// ─── Store ────────────────────────────────────────────────
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isDemo: false,
      isLoading: false,
      hasHydrated: false,
      error: null,

      initAuth: () => {
        const state = get()
        set({ hasHydrated: true, isAuthenticated: !!state.user })
      },

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
          const { data, error } = await supabaseSignIn(credentials.email.trim(), credentials.password)


          if (error || !data?.user) {
  throw new Error('ایمیل یا رمز عبور اشتباه است')
}

          const user: User = {
  id: data.user.id,
  email: data.user.email || credentials.email,
  fullName: data.user.user_metadata?.full_name || 'کاربر',
  businessName: data.user.user_metadata?.business_name,
  createdAt: data.user.created_at || new Date().toISOString(),
}
          set({ user, isAuthenticated: true, isDemo: false, isLoading: false, error: null })
        } catch (err: any) {
          console.error('LOGIN ERROR:', err)
          set({ user: null, isAuthenticated: false, isDemo: false, isLoading: false, error: err?.message || 'ورود ناموفق بود' })
        }
      },

      logout: async () => {
        try {
          const state = get()
          if (!state.isDemo) await supabaseSignOut()
        } catch (err) {
          console.error('LOGOUT ERROR:', err)
        } finally {
          set({ user: null, isAuthenticated: false, isDemo: false, isLoading: false, error: null })
        }
      },
    }),
    {
      name: 'hisabche-auth',
      storage: typeof window !== 'undefined' ? createJSONStorage(() => localStorage) : undefined,
      partialize: (s) => ({ user: s.user, isDemo: s.isDemo }),
      onRehydrateStorage: () => (state) => {
        if (!state) return
        state.initAuth()
      },
    }
  )
)