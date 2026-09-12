// ============================================
// Desktop authentication — canonical UI, desktop session.
//
// The visual layer is `AuthShell` from `@hisabche/ui`, the same component the
// web login renders. This file used to hand-build its own email/password form;
// that was a second auth UI to keep in step with the web one by hand.
//
// What stays desktop-owned is everything below the surface, because it is not
// interchangeable with web's:
//
//   * `useAuthStore` here writes the session to the **OS credential store**
//     through the preload bridge. The web store persists to localStorage, so
//     mounting the canonical `AuthContainer` would have moved desktop
//     credentials into the renderer — a security regression, not a refactor.
//   * navigation is react-router, not Next.
//
// Hence: canonical presentation, desktop orchestration.
// ============================================

import React, { useCallback, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { AuthShell } from '@hisabche/ui'
import { loginSchema, signUpSchema, type LoginInput, type SignUpInput } from '@hisabche/validation'

import { useAuthStore } from './auth.store'

/**
 * `AuthShell` resolves copy through a `safeT`: a key lookup that falls back to
 * the supplied default rather than rendering the raw key.
 */
function useSafeT() {
  const t = useTranslations()

  return useCallback(
    (key: string, fallback?: string): string => {
      try {
        const value = t(key as Parameters<typeof t>[0])
        return value && value !== key ? value : (fallback ?? key)
      } catch {
        return fallback ?? key
      }
    },
    [t],
  )
}

export function LoginPage() {
  const st = useSafeT()
  const navigate = useNavigate()
  const location = useLocation()

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isLoading = useAuthStore((s) => s.isLoading)
  const serverError = useAuthStore((s) => s.error)
  const clearError = useAuthStore((s) => s.clearError)
  const login = useAuthStore((s) => s.login)
  const signup = useAuthStore((s) => s.signup)

  const [flipped, setFlipped] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const loginForm = useForm<LoginInput>({ resolver: zodResolver(loginSchema) })
  const signupForm = useForm<SignUpInput>({ resolver: zodResolver(signUpSchema) })

  /**
   * Honour `?redirect=` the way web does, so an invite link that bounces
   * through login still lands where it meant to instead of the dashboard.
   */
  const redirectTarget = new URLSearchParams(location.search).get('redirect') || '/'

  // Declared ABOVE the early return: a hook after it runs on one render and
  // not the next, and React throws once login flips isAuthenticated.
  const switchMode = useCallback(() => {
    clearError()
    setFlipped((value) => !value)
  }, [clearError])

  const togglePassword = useCallback(() => setShowPassword((value) => !value), [])

  if (isAuthenticated) return <Navigate to={redirectTarget} replace />

  const submitLogin = loginForm.handleSubmit(async (data) => {
    clearError()
    try {
      await login({ email: data.email, password: data.password })
      navigate(redirectTarget, { replace: true })
    } catch {
      // The store already holds the message; AuthShell renders `serverError`.
    }
  })

  const submitSignup = signupForm.handleSubmit(async (data) => {
    clearError()
    try {
      await signup(data)
      navigate(redirectTarget, { replace: true })
    } catch {
      // Same: surfaced through `serverError`.
    }
  })

  return (
    <AuthShell
      flipped={flipped}
      st={st}
      onSwitchMode={switchMode}
      loginProps={{
        st,
        serverError,
        isLoading,
        errors: loginForm.formState.errors,
        register: loginForm.register,
        watch: loginForm.watch,
        handleSubmit: loginForm.handleSubmit,
        showPassword,
        togglePassword,
        onSwitchMode: switchMode,
        onSubmit: submitLogin,
        // Demo sign-in is a marketing affordance on the public site; a desktop
        // install is already a deliberate download, so it has no place here.
        onDemoLogin: () => undefined,
      }}
      signupProps={{
        st,
        serverError,
        isLoading,
        errors: signupForm.formState.errors,
        register: signupForm.register,
        watch: signupForm.watch,
        handleSubmit: signupForm.handleSubmit,
        showPassword,
        togglePassword,
        onSwitchMode: switchMode,
        onSubmit: submitSignup,
        translateError: (key?: string) => (key ? st(key, key) : undefined),
      }}
    />
  )
}
