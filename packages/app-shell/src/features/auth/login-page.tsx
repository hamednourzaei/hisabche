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
import { useLocale, useTranslations } from 'next-intl'
import { AuthShell, LocalFirstRunForm } from '@hisabche/ui'
import { loginSchema, signUpSchema, type LoginInput, type SignUpInput } from '@hisabche/validation'
import { setAppEdition, setOfflineTokenMode, STORAGE_KEYS, writeStorage } from '@hisabche/api'

import { useAuthStore } from './auth.store'
import {
  createLocalWorkspace,
  lookupLocalWorkspace,
  offlineFailureMessage,
} from './offline-first-run'

/**
 * The device's own time zone.
 *
 * The business's time zone is a fact about the business, and the device's is
 * the best answer available at the first run — a shop in Herat sets its
 * phone to Kabul, and the books would then close their day at the wrong
 * midnight. `UTC` is the fallback, and it is said plainly rather than
 * guessed at.
 */
function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/**
 * Where the offline edition is in its own little journey.
 *
 * `idle` → the login screen as usual.
 * `checking` → the device is being asked whether a business already exists.
 * `firstRun` → it does not: the business is created here, on this device.
 * `creating` → the workspace is being written.
 * `checkFailed` / `createFailed` → it did not work, and the screen says so.
 */
type OfflinePhase = 'idle' | 'checking' | 'firstRun' | 'creating' | 'checkFailed' | 'createFailed'

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
  const lang = useLocale()
  const navigate = useNavigate()
  const location = useLocation()

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isLoading = useAuthStore((s) => s.isLoading)
  const serverError = useAuthStore((s) => s.error)
  const clearError = useAuthStore((s) => s.clearError)
  const login = useAuthStore((s) => s.login)
  const signup = useAuthStore((s) => s.signup)
  const startOfflineSession = useAuthStore((s) => s.startOfflineSession)

  const [flipped, setFlipped] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const [offlinePhase, setOfflinePhase] = useState<OfflinePhase>('idle')
  const [offlineError, setOfflineError] = useState<string | null>(null)
  const [businessName, setBusinessName] = useState('')
  const [businessCurrency, setBusinessCurrency] = useState<string | null>(null)
  // The device's zone is the PREFILL, not the answer — the person edits it.
  const [businessTimeZone, setBusinessTimeZone] = useState(() => deviceTimeZone())

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

  /**
   * Open the app on this device alone.
   *
   * ⚠️ WHAT USED TO HAPPEN HERE.
   *
   * The button read `/workspaces`, and if the list was empty it POSTED a
   * workspace named «کسب‌وکار من» in AFN — without asking, and without a
   * `slug`, which the shared schema requires, so the request was REFUSED
   * (400) and the answer was swallowed by `catch {}`. The person clicked
   * «نسخه‌ی محلی» and nothing happened, with no message.
   *
   * Now: the device is asked what it has; if it has a business, the session
   * opens; if it has none, the person is asked for the name and the books
   * currency and the business is created with those answers. A failure says
   * so, at the button.
   */
  const handleOfflineMode = useCallback(async () => {
    writeStorage(STORAGE_KEYS.edition, 'offline')
    setAppEdition('offline')
    setOfflineTokenMode(true)

    setOfflineError(null)
    setOfflinePhase('checking')

    try {
      const lookup = await lookupLocalWorkspace()

      if (lookup.kind === 'existing') {
        startOfflineSession(lookup.workspace)
        navigate(redirectTarget, { replace: true })
        return
      }

      // A fresh install: the business is made here, on this device.
      setOfflinePhase('firstRun')
    } catch (error) {
      setOfflineError(
        offlineFailureMessage(error, st('auth.offlineEditionFailed', 'نسخه‌ی محلی آماده نشد')),
      )
      setOfflinePhase('checkFailed')
    }
  }, [navigate, redirectTarget, startOfflineSession, st])

  /** Create the business on this device, then open the app as its owner. */
  const handleCreateBusiness = useCallback(async () => {
    const name = businessName.trim()
    if (!name || !businessCurrency) return

    const tz = businessTimeZone.trim()
    if (!tz) {
      setOfflineError(
        st('auth.offlineFirstRun.timeZoneRequired', 'انتخاب منطقه‌ی زمانی الزامی است'),
      )
      setOfflinePhase('createFailed')
      return
    }

    setOfflineError(null)
    setOfflinePhase('creating')

    try {
      const created = await createLocalWorkspace({
        name,
        baseCurrency: businessCurrency,
        timeZone: tz,
      })
      startOfflineSession(created)
      navigate(redirectTarget, { replace: true })
    } catch (error) {
      setOfflineError(
        offlineFailureMessage(
          error,
          st('auth.offlineFirstRun.failed', 'ساخت کسب‌وکار محلی ناموفق بود'),
        ),
      )
      setOfflinePhase('createFailed')
    }
  }, [
    businessCurrency,
    businessName,
    businessTimeZone,
    navigate,
    redirectTarget,
    startOfflineSession,
    st,
  ])

  // ⚠️ EVERY HOOK RUNS BEFORE ANY EARLY RETURN.
  //
  // The "already signed in" check used to sit above the two useCallbacks, so
  // the hook order changed the moment the session flipped — React's own
  // error, and the linter names it (react-hooks/rules-of-hooks). The returns
  // come after the hooks, in the order a person meets them.
  if (isAuthenticated) return <Navigate to={redirectTarget} replace />

  // The first run replaces the sign-in form: there is no account to sign in
  // to, and asking for a password nobody has would be a wall.
  if (
    offlinePhase === 'firstRun' ||
    offlinePhase === 'creating' ||
    offlinePhase === 'createFailed'
  ) {
    // The shell does not scroll the page (the app scrolls inside its own layout),
    // so this screen is its own scroll area — the currency list pushed «create»
    // below the window with no way to reach it.
    return (
      <div className="relative h-dvh overflow-y-auto p-6">
        <LocalFirstRunForm
          name={businessName}
          onNameChange={setBusinessName}
          currency={businessCurrency}
          onCurrencyChange={setBusinessCurrency}
          timeZone={businessTimeZone}
          onTimeZoneChange={setBusinessTimeZone}
          onSubmit={handleCreateBusiness}
          isSubmitting={offlinePhase === 'creating'}
          error={offlinePhase === 'createFailed' ? offlineError : null}
          lang={lang}
          t={st}
        />
      </div>
    )
  }

  return (
    <div className="relative min-h-screen">
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
      <div className="absolute bottom-3 start-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1">
        {/* ⚠️ THE FAILURE IS SHOWN HERE, NEXT TO THE BUTTON THAT FAILED. */}
        {offlinePhase === 'checkFailed' && offlineError && (
          <p role="alert" className="text-xs font-medium text-[hsl(var(--color-destructive))]">
            {offlineError}
          </p>
        )}
        <button
          type="button"
          onClick={handleOfflineMode}
          disabled={offlinePhase === 'checking'}
          className="text-xs text-[hsl(var(--fg-secondary))] hover:text-[hsl(var(--color-primary))] underline transition-colors focus:outline-none disabled:opacity-50"
        >
          {offlinePhase === 'checking'
            ? st('auth.offlineEditionPreparing', 'در حال آماده‌سازی…')
            : st('auth.offlineEdition', 'نسخه‌ی محلی (بدون اینترنت)')}
        </button>
      </div>
    </div>
  )
}
