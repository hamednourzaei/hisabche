import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import CryptoJS from 'crypto-js'
import type { AuthUser } from '@hisabche/auth-core'
import { registerTokenGetter } from '@hisabche/api'
import { setOnUnauthorized, setRefreshSession } from '@hisabche/api'
import { useWorkspaceStore } from './workspace.slice'

// ============================================
// ENCRYPTION
// ============================================
// Guarded: the Electron renderer has no `process`, and an unguarded read here
// threw at module scope — which took the whole app down before it rendered.
// The literal `process.env.NEXT_PUBLIC_…` text must stay intact so Next can
// still substitute it at build time.
const ENCRYPTION_KEY =
  (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_ENCRYPTION_KEY : undefined) ||
  'hisabche-dev-key-32-chars!!'

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
// ✅ مدل هویت از @hisabche/auth-core می‌آید تا وب و موبایل یک تعریف
// مشترک داشته باشند (قبلاً این interface اینجا و در اپ موبایل تکرار می‌شد).
export type User = AuthUser

export interface AuthState {
  user: User | null
  token: string | null
  /** Exchanged at /auth/refresh when the one-hour access token expires. */
  refreshToken: string | null
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
  // ✅ ویرایش پروفایل — endpoint سمت سرور (PATCH /api/auth/profile) از قبل
  // وجود داشت ولی هیچ‌جای فرانت صدایش نمی‌زد، پس فیلدها فقط خواندنی بودند.
  updateProfile: (input: {
    fullName?: string
    businessName?: string
    avatarUrl?: string
    /** Written once on completion; see docs/onboarding-server-state-migration.sql. */
    onboardingCompleted?: boolean
    businessTypes?: string[]
    storeSize?: string
    businessNote?: string
  }) => Promise<void>
  initAuth: () => void
  clearError: () => void
}

// ============================================
// API BASE URL
// ============================================
const API_BASE =
  (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_API_URL : undefined) ||
  'http://localhost:10000'

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

  return res.json() as Promise<{ user: User; token: string; refreshToken?: string }>
}

async function apiRefresh(refreshToken: string) {
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })
  if (!res.ok) return null
  return res.json() as Promise<{ token: string; refreshToken: string }>
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

  return res.json() as Promise<{ user: User; token: string; refreshToken?: string }>
}

async function apiLogout(token: string) {
  await fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: '{}', // ✅ بدنه خالی ولی معتبر
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
      refreshToken: null,
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

        // Refresh the stored user from the server.
        //
        // The whole user object is persisted, so a session created before a
        // field existed keeps a blob without it — and nothing ever filled the
        // gap, because logging in was the only place the user was written. That
        // is why "تاریخ عضویت" showed "-" indefinitely: `createdAt` was simply
        // absent from an old cached user, and no amount of reloading helped.
        //
        // Deliberately not awaited: hydration must not block the first paint.
        // A failure leaves the cached user alone — being offline should not look
        // like being signed out.
        if (!state.token) return

        void fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${state.token}` },
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((payload: { user?: User } | null) => {
            const fresh = payload?.user
            if (!fresh) return

            // Merge rather than replace: local-only fields set elsewhere in the
            // session should survive a refresh.
            set((current) => ({
              user: current.user ? { ...current.user, ...fresh } : fresh,
            }))
          })
          .catch(() => {
            /* offline or transient — keep the cached user */
          })
      },

      updateProfile: async (input) => {
        const { token, user } = get()
        if (!token || !user) throw new Error('NOT_AUTHENTICATED')

        set({ isLoading: true, error: null })
        try {
          const res = await fetch(`${API_BASE}/auth/profile`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(input),
          })

          if (!res.ok) {
            const detail = await res.json().catch(() => null)
            throw new Error(detail?.error || 'PROFILE_UPDATE_FAILED')
          }

          // پاسخ سرور ممکن است کاربر کامل را برنگرداند؛ مقادیر ارسالی را
          // روی کاربر فعلی merge می‌کنیم تا UI بلافاصله به‌روز شود.
          const payload = await res.json().catch(() => null)
          const updated = payload && payload.user ? payload.user : {}
          set({
            user: { ...user, ...input, ...updated },
            isLoading: false,
          })
        } catch (err) {
          set({
            isLoading: false,
            error: err instanceof Error ? err.message : 'PROFILE_UPDATE_FAILED',
          })
          throw err
        }
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

          const result = await apiLogin(credentials.email.trim(), credentials.password)

          set({
            user: result.user,
            token: result.token,
            refreshToken: result.refreshToken ?? null,
            isAuthenticated: true,
            isDemo: false,
            isLoading: false,
            error: null,
          })
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'ورود ناموفق بود'
          set({
            user: null,
            token: null,
            refreshToken: null,
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
            refreshToken: result.refreshToken ?? null,
            isAuthenticated: true,
            isDemo: false,
            isLoading: false,
            error: null,
          })
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'ثبت‌نام ناموفق بود'
          set({
            user: null,
            token: null,
            refreshToken: null,
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

          // ✅ FIX: workspaceId قبلاً در localStorage می‌ماند و بعد از
          // لاگین با حساب دیگر در همان مرورگر، هنوز به workspace کاربر
          // قبلی اشاره می‌کرد (باعث خطای "Access denied" هنگام دعوت
          // عضو جدید می‌شد).
          useWorkspaceStore.persist.clearStorage()
          useWorkspaceStore.setState({
            workspaceId: null,
            workspaceName: '',
            members: [],
            invites: [],
            currentUserRole: 'member',
          })

          set({
            user: null,
            token: null,
            refreshToken: null,
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
        typeof window !== 'undefined' ? createJSONStorage(() => encryptedStorage) : undefined,
      partialize: (s) => ({
        user: s.user,
        token: s.token,
        refreshToken: s.refreshToken,
        isDemo: s.isDemo,
      }),
      onRehydrateStorage: () => () => {
        queueMicrotask(() => {
          useAuthStore.getState().initAuth()
        })
      },
    },
  ),
)

// ============================================
// ✅ Register token getter + onUnauthorized
//    فقط یک بار، هنگام import ماژول
// ============================================
if (typeof window !== 'undefined') {
  registerTokenGetter(() => useAuthStore.getState().token)

  setRefreshSession(async () => {
    const { refreshToken, isDemo } = useAuthStore.getState()
    if (!refreshToken || isDemo) return null
    const renewed = await apiRefresh(refreshToken)
    if (!renewed?.token) return null
    useAuthStore.setState({ token: renewed.token, refreshToken: renewed.refreshToken })
    return renewed.token
  })

  setOnUnauthorized(() => {
    // ✅ فقط state رو پاک می‌کنیم، logout API call نمی‌کنیم
    clearAuthStorage()
    useAuthStore.setState({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isDemo: false,
      error: null,
    })
  })
}
