"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslation } from "react-i18next"
import { Button } from "@hisabche/ui"
import { useAuthStore } from "@hisabche/store"
import { loginSchema, type LoginInput } from "@hisabche/validation"

// ─── Icons ─────────────────────────────────────────────
const IconMail = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>
  </svg>
)
const IconLock = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>
  </svg>
)

// ─── Safe translation ─────────────────────────────────
function useSafeT() {
  const { t } = useTranslation()
  return (key: string, fallback: string) => t(key) === key || !t(key) ? fallback : t(key)
}

// ─── Login Page ────────────────────────────────────────
export default function LoginClient() {
  const router = useRouter()
  const st = useSafeT()
  const login = useAuthStore((s) => s.login)
  const isLoading = useAuthStore((s) => s.isLoading)
  const serverError = useAuthStore((s) => s.error)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  const emailValue = watch("email")
  const passwordValue = watch("password")

  // ✅ Only redirect on success
  const onSubmit = async (data: LoginInput) => {
    await login(data)
    // useAuthStore.isAuthenticated will be true if login succeeded
    const state = useAuthStore.getState()
    if (state.isAuthenticated && !state.error) {
      router.push("/")
    }
  }

  // ✅ Demo login with redirect guard
  const handleDemoLogin = async () => {
    await login({ email: "demo@hisabche.com", password: "Demo1234" })
    const state = useAuthStore.getState()
    if (state.isAuthenticated && !state.error) {
      router.push("/")
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[var(--hisab-background)]" dir="rtl">

      {/* Animated blobs */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute w-[600px] h-[600px] bg-purple-500/10 blur-[120px] rounded-full animate-blob top-[-200px] right-[-200px]" />
        <div className="absolute w-[500px] h-[500px] bg-cyan-500/10 blur-[120px] rounded-full animate-blob2 bottom-[-200px] left-[-200px]" />
        <div className="absolute w-[400px] h-[400px] bg-pink-500/10 blur-[120px] rounded-full animate-blob3 top-[30%] left-[20%]" />
      </div>

      {/* Glass Card */}
      <div className="relative w-full max-w-md mx-4">
        <div className="backdrop-blur-2xl bg-[var(--hisab-card)]/80 border border-[var(--hisab-border)] rounded-3xl p-8 shadow-2xl">

          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-white font-bold text-xl shadow-lg">
              ح
            </div>
            <h1 className="text-[var(--hisab-foreground)] text-xl font-bold mt-4">
              {st("auth.welcomeBack", "خوش آمدید")}
            </h1>
            <p className="text-[var(--hisab-muted-fg)] text-sm">
              {st("login.subtitle", "ورود به حساب کاربری")}
            </p>
          </div>

          {/* Server Error */}
          {serverError && (
            <div
              className="mb-4 text-sm text-[var(--hisab-destructive)] bg-[var(--hisab-destructive)]/10 border border-[var(--hisab-destructive)]/20 p-3 rounded-xl"
              role="alert"
            >
              {serverError}
            </div>
          )}

          {/* FORM */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

            {/* EMAIL */}
            <div>
              <div className="relative">
                <input
                  {...register("email")}
                  type="email"
                  autoComplete="email"
                  disabled={isLoading}
                  className="peer w-full h-12 px-4 pt-5 bg-[var(--hisab-input)]/50 border rounded-2xl text-[var(--hisab-foreground)] outline-none transition-all pr-10 disabled:opacity-50"
                  style={{ borderColor: errors.email ? "hsl(var(--hisab-destructive))" : "hsl(var(--hisab-border))" }}
                  placeholder=" "
                  dir="ltr"
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? "email-error" : undefined}
                />
                <label className={`absolute right-10 transition-all pointer-events-none
                  ${emailValue ? "top-1.5 text-[10px] text-cyan-300" : "top-3.5 text-sm text-[var(--hisab-muted-fg)]"}
                `}>
                  {st("auth.email", "ایمیل")}
                </label>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--hisab-muted-fg)]">
                  <IconMail />
                </span>
              </div>
              {errors.email && (
                <p id="email-error" className="text-xs text-[var(--hisab-destructive)] mt-1.5" role="alert">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* PASSWORD */}
            <div>
              <div className="relative">
                <input
                  {...register("password")}
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  disabled={isLoading}
                  className="peer w-full h-12 px-4 pt-5 bg-[var(--hisab-input)]/50 border rounded-2xl text-[var(--hisab-foreground)] outline-none transition-all pr-10 pl-14 disabled:opacity-50"
                  style={{ borderColor: errors.password ? "hsl(var(--hisab-destructive))" : "hsl(var(--hisab-border))" }}
                  placeholder=" "
                  dir="ltr"
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? "password-error" : undefined}
                />
                <label className={`absolute right-10 transition-all pointer-events-none
                  ${passwordValue ? "top-1.5 text-[10px] text-cyan-300" : "top-3.5 text-sm text-[var(--hisab-muted-fg)]"}
                `}>
                  {st("auth.password", "رمز عبور")}
                </label>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--hisab-muted-fg)]">
                  <IconLock />
                </span>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-[var(--hisab-muted-fg)] hover:text-[var(--hisab-foreground)] transition-colors"
                >
                  {showPassword ? st("login.hidePassword", "مخفی") : st("login.showPassword", "نمایش")}
                </button>
              </div>
              {errors.password && (
                <p id="password-error" className="text-xs text-[var(--hisab-destructive)] mt-1.5" role="alert">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Submit */}
            <Button
              type="submit"
              loading={isLoading}
              fullWidth
              size="lg"
              className="!rounded-2xl !bg-gradient-to-r !from-purple-500 !to-cyan-500 !text-white !font-medium hover:!opacity-90 active:scale-[0.98]"
            >
              {st("auth.signIn", "ورود")}
            </Button>

            {/* Demo */}
            <Button
              type="button"
              variant="outline"
              fullWidth
              onClick={handleDemoLogin}
              disabled={isLoading}
              className="!rounded-2xl"
            >
              {st("login.demoLogin", "ورود نمایشی")}
            </Button>
          </form>

          {/* Footer */}
          <p className="text-center text-xs text-[var(--hisab-muted-fg)] mt-6">
            {st("auth.noAccount", "حساب ندارید؟")}{" "}
            <span className="text-[var(--hisab-primary)] cursor-pointer hover:underline">
              {st("auth.signUp", "ثبت‌نام کنید")}
            </span>
          </p>

        </div>
      </div>

      {/* Animations — inline style (no globals needed for login page) */}
      <style>{`
        @keyframes blob {
          0%   { transform: translate(0px, 0px) scale(1); }
          33%  { transform: translate(30px, -50px) scale(1.1); }
          66%  { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob  { animation: blob 12s infinite; }
        .animate-blob2 { animation: blob 16s infinite; }
        .animate-blob3 { animation: blob 20s infinite; }
      `}</style>
    </div>
  )
}