'use client'

import { useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { z } from 'zod'
import { useAuthStore, type User } from '@hisabche/store'
import { loginSchema, type LoginInput } from '@hisabche/validation'
// ⚠️ RELATIVE, NOT THE PACKAGE BARREL.
//
// This file lives INSIDE `@hisabche/ui`. Importing from the package by name
// makes the barrel depend on this module and this module depend on the barrel
// — a cycle whose evaluation order is decided by the bundler. When it puts the
// barrel first, every `const` this file needs is still in its temporal dead
// zone and the app throws
//
//     ReferenceError: Cannot access '…' before initialization
//
// from inside whichever hook runs first. It is stable until the export list in
// `index.ts` changes, and then it moves — which is exactly the kind of fault
// that appears to come from an unrelated edit.
//
// A file inside a package never imports that package by name.
import { AuthShell } from '../AuthShell'

/* ═══════════════════════════════════════════════════════════
   AuthContainer v3 — Full backend-auth migration
   ✅ Removed direct supabaseClient.auth calls
   ✅ Using useAuthStore().login() + useAuthStore().signup()
   ═══════════════════════════════════════════════════════════ */

const signupSchema = z.object({
  fullName: z.string().min(2, 'signup.errors.fullName'),
  businessName: z.string().min(2, 'signup.errors.businessName'),
  phone: z.string().optional().or(z.literal('')),
  email: z.string().min(1, 'signup.errors.emailRequired').email('signup.errors.emailInvalid'),
  password: z.string().min(8, 'signup.errors.passwordMin'),
})
type SignupInput = z.infer<typeof signupSchema>

function useSafeT() {
  const t = useTranslations()
  return (key: string, fallback: string) => {
    const v = t(key)
    return v && v !== key ? v : fallback
  }
}

export function AuthContainer({ initialMode = 'login' }: { initialMode?: 'login' | 'signup' }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations()
  const st = useSafeT()
  const [flipped, setFlipped] = useState(initialMode === 'signup')

  // ✅ FIX: قبلاً بعد از لاگین/ثبت‌نام همیشه به /dashboard می‌رفت و
  // پارامتر redirect (مثلاً /accept-invite?token=...) نادیده گرفته
  // می‌شد — یعنی کاربری که از لینک دعوت وارد ثبت‌نام می‌شد هرگز به
  // مرحله‌ی پذیرش دعوت برنمی‌گشت و در workspace خودش owner می‌ماند.
  const redirectTarget = searchParams.get('redirect') || '/dashboard'

  // ─── Switch mode ──────────────────────────────
  const handleSwitch = useCallback(() => {
    setFlipped((prev) => !prev)
    setTimeout(() => {
      const currentFlipped = !flipped
      if (currentFlipped) {
        router.replace('/signup', { scroll: false })
      } else {
        router.replace('/login', { scroll: false })
      }
    }, 650)
  }, [flipped, router])

  // ─── Login form ────────────────────────────────
  const loginForm = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })
  const [loginShowPassword, setLoginShowPassword] = useState(false)
  const loginStore = useAuthStore()

  const onLoginSubmit = loginForm.handleSubmit(async (data: LoginInput) => {
    // ✅ FIX: استفاده از useAuthStore().login() به جای supabaseClient مستقیم
    await loginStore.login(data)

    const s = useAuthStore.getState()
    if (s.isAuthenticated && !s.error) {
      router.push(redirectTarget)
    }
  })

  const onDemoLogin = useCallback(async () => {
    await loginStore.login({
      email: 'demo@hisabche.com',
      password: 'Demo1234',
    })
    const s = useAuthStore.getState()
    if (s.isAuthenticated && !s.error) {
      router.push(redirectTarget)
    }
  }, [loginStore, router, redirectTarget])

  const loginProps = {
    st,
    serverError: loginStore.error,
    isLoading: loginStore.isLoading,
    errors: loginForm.formState.errors as Record<string, { message?: string } | undefined>,
    register: loginForm.register as any,
    watch: loginForm.watch as any,
    handleSubmit: loginForm.handleSubmit as any,
    showPassword: loginShowPassword,
    togglePassword: () => setLoginShowPassword(!loginShowPassword),
    onSwitchMode: handleSwitch,
    onSubmit: onLoginSubmit as any,
    onDemoLogin,
  }

  // ─── Signup form ───────────────────────────────
  const signupForm = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: '',
      businessName: '',
      phone: '',
      email: '',
      password: '',
    },
  })
  const [signupShowPassword, setSignupShowPassword] = useState(false)
  const signupStore = useAuthStore()

  const onSignupSubmit = signupForm.handleSubmit(async (data: SignupInput) => {
    // ✅ FIX: استفاده از useAuthStore().signup() به جای supabaseClient.auth.signUp()
    await signupStore.signup({
      email: data.email,
      password: data.password,
      fullName: data.fullName,
      businessName: data.businessName,
    })

    const s = useAuthStore.getState()
    if (s.isAuthenticated && !s.error) {
      router.push(redirectTarget)
    }
  })

  const translateError = (k?: string) => (k ? t(k) : undefined)

  const signupProps = {
    st,
    serverError: signupStore.error,
    isLoading: signupStore.isLoading,
    errors: signupForm.formState.errors as Record<string, { message?: string } | undefined>,
    register: signupForm.register as any,
    watch: signupForm.watch as any,
    handleSubmit: signupForm.handleSubmit as any,
    showPassword: signupShowPassword,
    togglePassword: () => setSignupShowPassword(!signupShowPassword),
    onSwitchMode: handleSwitch,
    onSubmit: onSignupSubmit as any,
    translateError,
  }

  return (
    <AuthShell
      flipped={flipped}
      st={st}
      loginProps={loginProps}
      signupProps={signupProps}
      onSwitchMode={handleSwitch}
    />
  )
}
