import { create } from 'zustand'

import {
  persist,
  createJSONStorage,
} from 'zustand/middleware'

import {
  signIn as supabaseSignIn,
  signOut as supabaseSignOut,
} from '../../../auth/src/'

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

  login: (c: {
    email: string
    password: string
  }) => Promise<void>

  logout: () => Promise<void>

  initAuth: () => void
}

export const useAuthStore =
  create<AuthState>()(
    persist(
      (set, get) => ({
        // =====================================
        // STATE
        // =====================================

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

            isAuthenticated:
              !!state.user,
          })
        },

        // =====================================
        // LOGIN
        // =====================================

        login: async (
          credentials
        ) => {
          set({
            isLoading: true,

            error: null,
          })

          try {
            // =====================================
            // DEMO LOGIN
            // =====================================

            if (
              credentials.email.trim() ===
                'demo@hisabche.com' &&
              credentials.password ===
                'Demo1234'
            ) {
              const user: User = {
                id: 'demo-user-1',

                email:
                  credentials.email,

                fullName:
                  'کاربر آزمایشی',

                businessName:
                  'فروشگاه نمونه',

                createdAt:
                  new Date().toISOString(),
              }

              set({
                user,

                isAuthenticated: true,

                isDemo: true,

                isLoading: false,

                error: null,
              })

              return
            }

            // =====================================
            // REAL LOGIN
            // =====================================

            const response =
              await supabaseSignIn(
                credentials.email.trim(),
                credentials.password
              )

            console.log(
              'SUPABASE LOGIN:',
              response
            )

            // =====================================
            // VALIDATE RESPONSE
            // =====================================

            if (
              !response ||
              !response.user ||
              !response.user.id
            ) {
              throw new Error(
                'ایمیل یا رمز عبور اشتباه است'
              )
            }

            // =====================================
            // BUILD USER
            // =====================================

            const user: User = {
              id: response.user.id,

              email:
                response.user.email ||
                credentials.email,

              fullName:
                response.user
                  .user_metadata
                  ?.full_name ||
                'کاربر',

              businessName:
                response.user
                  .user_metadata
                  ?.business_name,

              createdAt:
                response.user
                  .created_at ||
                new Date().toISOString(),
            }

            // =====================================
            // SUCCESS
            // =====================================

            set({
              user,

              isAuthenticated: true,

              isDemo: false,

              isLoading: false,

              error: null,
            })
          } catch (err: any) {
            console.error(
              'LOGIN ERROR:',
              err
            )

            set({
              user: null,

              isAuthenticated: false,

              isDemo: false,

              isLoading: false,

              error:
                err?.message ||
                'ورود ناموفق بود',
            })
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
            console.error(
              'LOGOUT ERROR:',
              err
            )
          } finally {
            set({
              user: null,

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
          typeof window !==
          'undefined'
            ? createJSONStorage(
                () => localStorage
              )
            : undefined,

        partialize: (s) => ({
          user: s.user,

          isDemo: s.isDemo,
        }),

        onRehydrateStorage: () => () => {
  // همیشه initAuth رو فراخوانی کن، چه persisted data باشه چه نباشه
  // queueMicrotask تضمین می‌کنه که useAuthStore کاملاً ساخته شده
  queueMicrotask(() => {
    useAuthStore.getState().initAuth()
  })
},
      }
    )
  )