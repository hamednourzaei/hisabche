"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import { Button } from "@hisabche/ui"
import { useAuthStore } from "@hisabche/store"
import { loginSchema, type LoginInput } from "@hisabche/validation"

// ─── Icons ─────────────────────────────────────────────
const IconMail = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" />
  </svg>
)
const IconLock = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
)
const IconUser = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
)
const IconStore = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 9l1-5h16l1 5M5 9v11h14V9M9 13h6" />
  </svg>
)
const IconPhone = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 16.92V21a1 1 0 0 1-1.11 1 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 3.18 4.11 1 1 0 0 1 4.18 3h4.09a1 1 0 0 1 1 .75 12.84 12.84 0 0 0 .7 2.81 1 1 0 0 1-.22 1.11L8 9a16 16 0 0 0 6 6l1.27-1.78a1 1 0 0 1 1.11-.22 12.84 12.84 0 0 0 2.81.7 1 1 0 0 1 .81 1z" />
  </svg>
)
const IconCheck = () => (
  <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)
const IconClock = () => (
  <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
)
const IconTruck = () => (
  <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
)
const IconSearch = () => (
  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)
const IconBell = () => (
  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
)
const IconFilter = () => (
  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
)
const IconDoc = () => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
  </svg>
)

// ─── i18n ──────────────────────────────────────────────
function useSafeT() {
  const { t } = useTranslation()
  return (key: string, fallback: string) => {
    const v = t(key)
    return v && v !== key ? v : fallback
  }
}

// ─── Signup schema ─────────────────────────────────────
const signupSchema = z.object({
  fullName: z.string().min(2, "signup.errors.fullName"),
  companyName: z.string().min(2, "signup.errors.companyName"),
  phone: z.string().optional().or(z.literal("")),
  email: z.string().min(1, "signup.errors.emailRequired").email("signup.errors.emailInvalid"),
  password: z.string().min(8, "signup.errors.passwordMin"),
})
type SignupInput = z.infer<typeof signupSchema>

// ═══════════════════════════════════════════════════════
// WORKSPACE PREVIEW — Orders + Pipeline (no numbers)
// ═══════════════════════════════════════════════════════
function WorkspacePreview({ st }: { st: ReturnType<typeof useSafeT> }) {

  const rows = [
    { id: 1, status: "paid",    hueA: 280, hueB: 320, w: 65 },
    { id: 2, status: "pending", hueA: 195, hueB: 220, w: 78 },
    { id: 3, status: "paid",    hueA: 25,  hueB: 10,  w: 52 },
    { id: 4, status: "shipped", hueA: 160, hueB: 180, w: 70 },
    { id: 5, status: "paid",    hueA: 340, hueB: 0,   w: 58 },
  ]

  const statusMap = {
    paid:    { cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/25", icon: <IconCheck />, label: st("preview.status.paid", "تکمیل") },
    pending: { cls: "bg-amber-500/15 text-amber-500 border-amber-500/25",       icon: <IconClock />, label: st("preview.status.pending", "در انتظار") },
    shipped: { cls: "bg-sky-500/15 text-sky-500 border-sky-500/25",             icon: <IconTruck />, label: st("preview.status.shipped", "در حال ارسال") },
  } as const

  return (
    <div className="relative w-full max-w-md flex flex-col gap-4">

      {/* ━━━ MAIN CARD: Orders / Documents ━━━ */}
      <div className="dashboard-reveal relative bg-[var(--hisab-card)]/90 border border-[var(--hisab-border)] rounded-2xl p-5 shadow-2xl backdrop-blur-xl overflow-hidden">

        {/* Top accent gradient */}
        <div className="absolute top-0 right-0 left-0 h-px bg-gradient-to-r from-transparent via-purple-500/40 to-transparent" />

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-purple-500/30 flex items-center justify-center text-purple-500">
              <IconDoc />
            </div>
            <div>
              <div className="text-sm font-bold text-[var(--hisab-foreground)] leading-tight">
                {st("preview.title", "سفارش‌ها و فاکتورها")}
              </div>
              <div className="text-[10px] text-[var(--hisab-muted-fg)] flex items-center gap-1 mt-0.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                </span>
                <span>{st("preview.synced", "همگام‌سازی زنده")}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[var(--hisab-muted-fg)]">
            <button className="p-1.5 rounded-lg hover:bg-[var(--hisab-input)]/40 transition-colors"><IconBell /></button>
            <button className="p-1.5 rounded-lg hover:bg-[var(--hisab-input)]/40 transition-colors"><IconFilter /></button>
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-1.5 mb-3 chips-reveal">
          <span className="px-2.5 py-1 text-[10px] font-medium rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 text-white shadow-sm">
            {st("preview.chip.all", "همه")}
          </span>
          <span className="px-2.5 py-1 text-[10px] font-medium rounded-full bg-[var(--hisab-input)]/40 text-[var(--hisab-muted-fg)] border border-[var(--hisab-border)]">
            {st("preview.chip.invoice", "فاکتور")}
          </span>
          <span className="px-2.5 py-1 text-[10px] font-medium rounded-full bg-[var(--hisab-input)]/40 text-[var(--hisab-muted-fg)] border border-[var(--hisab-border)]">
            {st("preview.chip.order", "سفارش")}
          </span>
          <span className="px-2.5 py-1 text-[10px] font-medium rounded-full bg-[var(--hisab-input)]/40 text-[var(--hisab-muted-fg)] border border-[var(--hisab-border)]">
            {st("preview.chip.customer", "مشتری")}
          </span>
        </div>

        {/* Search bar mockup */}
        <div className="search-reveal flex items-center gap-2 px-3 py-2 mb-3 rounded-xl bg-[var(--hisab-input)]/30 border border-[var(--hisab-border)]">
          <IconSearch />
          <div className="h-1.5 w-24 rounded-full bg-[var(--hisab-muted-fg)]/25" />
          <div className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-[var(--hisab-card)] border border-[var(--hisab-border)] text-[var(--hisab-muted-fg)] font-mono">⌘K</div>
        </div>

        {/* Rows */}
        <div className="space-y-0.5">
          {rows.map((row, i) => {
            const s = statusMap[row.status as keyof typeof statusMap]
            return (
              <div
                key={row.id}
                className="ledger-row group flex items-center gap-3 py-2 px-2 -mx-2 rounded-xl hover:bg-[var(--hisab-input)]/30 transition-colors"
                style={{ animationDelay: `${0.85 + i * 0.08}s` }}
              >
                {/* Avatar */}
                <div
                  className="w-8 h-8 rounded-full flex-shrink-0 ring-2 ring-[var(--hisab-card)] shadow-sm relative overflow-hidden"
                  style={{ background: `linear-gradient(135deg, hsl(${row.hueA} 75% 60%), hsl(${row.hueB} 75% 50%))` }}
                >
                  <div className="absolute inset-0 flex items-center justify-center text-white opacity-90">
                    <IconUser />
                  </div>
                </div>

                {/* Skeleton name */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="h-2 rounded-full bg-[var(--hisab-foreground)]/25" style={{ width: `${row.w}%` }} />
                  <div className="h-1.5 rounded-full bg-[var(--hisab-muted-fg)]/20" style={{ width: `${row.w * 0.55}%` }} />
                </div>

                {/* Status badge */}
                <div className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md border ${s.cls}`}>
                  {s.icon}
                  <span>{s.label}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ━━━ PIPELINE / WORKFLOW ━━━ */}
      <div className="pipeline-reveal relative bg-[var(--hisab-card)]/80 border border-[var(--hisab-border)] rounded-2xl p-4 backdrop-blur-xl shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] text-[var(--hisab-muted-fg)] uppercase tracking-[0.12em] font-semibold">
            {st("preview.workflow", "گردش کار")}
          </div>
          <div className="text-[10px] text-cyan-500 font-medium">
            {st("preview.workflowActive", "در مرحله: ارسال")}
          </div>
        </div>

        <div className="relative">
          <svg viewBox="0 0 280 28" className="w-full h-7" preserveAspectRatio="none">
            <defs>
              <linearGradient id="pipe-progress" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="rgb(168 85 247)" />
                <stop offset="100%" stopColor="rgb(6 182 212)" />
              </linearGradient>
            </defs>
            {/* Background dashed line */}
            <line x1="14" y1="14" x2="266" y2="14" stroke="currentColor" className="text-[var(--hisab-border)]" strokeWidth="1.5" strokeDasharray="3 4" />
            {/* Animated progress */}
            <line x1="14" y1="14" x2="194" y2="14" stroke="url(#pipe-progress)" strokeWidth="2" className="pipe-line" />
            {/* Nodes */}
            {[14, 74, 134, 194, 266].map((cx, i) => {
              const done = i <= 3
              return (
                <g key={i}>
                  {i === 3 && <circle cx={cx} cy={14} r="9" fill="rgb(6 182 212)" className="pipe-pulse" />}
                  <circle
                    cx={cx} cy={14} r="5"
                    fill={done ? "url(#pipe-progress)" : "var(--hisab-card)"}
                    stroke={done ? "transparent" : "hsl(var(--hisab-border))"}
                    strokeWidth="1.5"
                    className="pipe-node"
                    style={{ animationDelay: `${1.1 + i * 0.08}s` }}
                  />
                </g>
              )
            })}
          </svg>
          {/* Labels */}
          <div className="flex justify-between text-[10px] mt-1.5 px-0.5">
            <span className="text-[var(--hisab-foreground)] font-medium">{st("preview.stage.created", "ثبت")}</span>
            <span className="text-[var(--hisab-foreground)] font-medium">{st("preview.stage.approved", "تأیید")}</span>
            <span className="text-[var(--hisab-foreground)] font-medium">{st("preview.stage.packed", "بسته‌بندی")}</span>
            <span className="text-cyan-500 font-bold">{st("preview.stage.shipped", "ارسال")}</span>
            <span className="text-[var(--hisab-muted-fg)]">{st("preview.stage.delivered", "تحویل")}</span>
          </div>
        </div>
      </div>

      {/* ━━━ Feature pills ━━━ */}
      <div className="pills-reveal flex flex-wrap gap-2 justify-center">
        {[
          { label: st("preview.feature.inventory", "انبارداری"), hue: 280 },
          { label: st("preview.feature.crm", "مدیریت مشتری"), hue: 195 },
          { label: st("preview.feature.reports", "گزارش‌های زنده"), hue: 160 },
          { label: st("preview.feature.invoice", "فاکتور هوشمند"), hue: 25 },
        ].map((p) => (
          <span
            key={p.label}
            className="px-3 py-1.5 text-[11px] font-medium rounded-full bg-[var(--hisab-card)]/70 border backdrop-blur"
            style={{
              borderColor: `hsl(${p.hue} 70% 55% / 0.3)`,
              color: `hsl(${p.hue} 70% 60%)`,
            }}
          >
            {p.label}
          </span>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// LOGIN FORM
// ═══════════════════════════════════════════════════════
function LoginForm({ onSwitchMode, st }: { onSwitchMode: () => void; st: ReturnType<typeof useSafeT> }) {
  const router = useRouter()
  const login = useAuthStore((s) => s.login)
  const isLoading = useAuthStore((s) => s.isLoading)
  const serverError = useAuthStore((s) => s.error)
  const [showPassword, setShowPassword] = useState(false)

  const { register, handleSubmit, watch, formState: { errors } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })
  const emailValue = watch("email")
  const passwordValue = watch("password")

  const onSubmit = async (data: LoginInput) => {
    await login(data)
    const s = useAuthStore.getState()
    if (s.isAuthenticated && !s.error) router.push("/")
  }
  const handleDemoLogin = async () => {
    await login({ email: "demo@hisabche.com", password: "Demo1234" })
    const s = useAuthStore.getState()
    if (s.isAuthenticated && !s.error) router.push("/")
  }

  return (
    <div className="backdrop-blur-2xl bg-[var(--hisab-card)]/85 border border-[var(--hisab-border)] rounded-3xl p-6 sm:p-8 shadow-2xl">
      <div className="flex flex-col items-center mb-6 sm:mb-8">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-purple-500/20">ح</div>
        <h1 className="text-[var(--hisab-foreground)] text-xl font-bold mt-4">{st("auth.welcomeBack", "خوش آمدید")}</h1>
        <p className="text-[var(--hisab-muted-fg)] text-sm mt-1">{st("login.subtitle", "ورود به حساب کاربری")}</p>
      </div>

      {serverError && (
        <div className="mb-4 text-sm text-[var(--hisab-destructive)] bg-[var(--hisab-destructive)]/10 border border-[var(--hisab-destructive)]/20 p-3 rounded-xl" role="alert">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Email */}
        <div>
          <div className="relative">
            <input {...register("email")} type="email" autoComplete="email" disabled={isLoading}
              className="peer w-full h-12 px-4 pt-5 bg-[var(--hisab-input)]/50 border rounded-2xl text-[var(--hisab-foreground)] outline-none transition-all pr-10 disabled:opacity-50 focus:border-cyan-400/60"
              style={{ borderColor: errors.email ? "hsl(var(--hisab-destructive))" : undefined }}
              placeholder=" " dir="ltr" />
            <label className={`absolute right-10 transition-all pointer-events-none ${emailValue ? "top-1.5 text-[10px] text-cyan-300" : "top-3.5 text-sm text-[var(--hisab-muted-fg)]"}`}>
              {st("auth.email", "ایمیل")}
            </label>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--hisab-muted-fg)]"><IconMail /></span>
          </div>
          {errors.email && <p className="text-xs text-[var(--hisab-destructive)] mt-1.5">{errors.email.message}</p>}
        </div>

        {/* Password */}
        <div>
          <div className="relative">
            <input {...register("password")} type={showPassword ? "text" : "password"} autoComplete="current-password" disabled={isLoading}
              className="peer w-full h-12 px-4 pt-5 bg-[var(--hisab-input)]/50 border rounded-2xl text-[var(--hisab-foreground)] outline-none transition-all pr-10 pl-16 disabled:opacity-50 focus:border-cyan-400/60"
              style={{ borderColor: errors.password ? "hsl(var(--hisab-destructive))" : undefined }}
              placeholder=" " dir="ltr" />
            <label className={`absolute right-10 transition-all pointer-events-none ${passwordValue ? "top-1.5 text-[10px] text-cyan-300" : "top-3.5 text-sm text-[var(--hisab-muted-fg)]"}`}>
              {st("auth.password", "رمز عبور")}
            </label>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--hisab-muted-fg)]"><IconLock /></span>
            <button type="button" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-[var(--hisab-muted-fg)] hover:text-[var(--hisab-foreground)] transition-colors px-1">
              {showPassword ? st("login.hidePassword", "مخفی") : st("login.showPassword", "نمایش")}
            </button>
          </div>
          {errors.password && <p className="text-xs text-[var(--hisab-destructive)] mt-1.5">{errors.password.message}</p>}
        </div>

        <Button type="submit" loading={isLoading} fullWidth size="lg"
          className="!rounded-2xl !bg-gradient-to-r !from-purple-500 !to-cyan-500 !text-white !font-medium hover:!opacity-90 active:scale-[0.98] !mt-5">
          {st("auth.signIn", "ورود")}
        </Button>
        <Button type="button" variant="outline" fullWidth onClick={handleDemoLogin} disabled={isLoading} className="!rounded-2xl">
          {st("login.demoLogin", "ورود نمایشی")}
        </Button>
      </form>

      <p className="text-center text-xs text-[var(--hisab-muted-fg)] mt-6">
        {st("auth.noAccount", "حساب ندارید؟")}{" "}
        <button type="button" onClick={onSwitchMode} className="text-[var(--hisab-primary)] cursor-pointer hover:underline font-semibold">
          {st("auth.signUp", "ثبت‌نام کنید")}
        </button>
      </p>
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// SIGNUP FORM (unified style, fixed password toggle)
// ═══════════════════════════════════════════════════════
function SignupForm({ onSwitchMode, st }: { onSwitchMode: () => void; st: ReturnType<typeof useSafeT> }) {
  const router = useRouter()
  const { t } = useTranslation()
  const { login: signUp, isLoading, error: serverError } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)

  const { register, handleSubmit, watch, formState: { errors } } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: "", companyName: "", phone: "", email: "", password: "" },
  })

  const fullName    = watch("fullName")
  const companyName = watch("companyName")
  const phone       = watch("phone")
  const email       = watch("email")
  const password    = watch("password")

  const tr = (k?: string) => (k ? t(k, k) : undefined)

  const onSubmit = async (data: SignupInput) => {
    try {
      await signUp({ email: data.email, password: data.password })
      await new Promise((r) => setTimeout(r, 100))
      const s = useAuthStore.getState()
      if (s.isAuthenticated && !s.error) router.push("/")
    } catch { /* handled by store */ }
  }

  // Reusable field renderer (closes over hooks above)
  const field = (opts: {
  name: keyof SignupInput
  type: string
  label: string
  icon: React.ReactNode
  value: string | undefined
  err?: { message?: string } | undefined
  dir?: "ltr" | "rtl"
  autoComplete?: string
  rightSlot?: React.ReactNode
  extraPaddingLeft?: boolean
}) => (
    <div>
      <div className="relative">
        <input
          {...register(opts.name)}
          type={opts.type}
          autoComplete={opts.autoComplete}
          disabled={isLoading}
          dir={opts.dir ?? "ltr"}
          placeholder=" "
          className={`peer w-full h-12 px-4 pt-5 bg-[var(--hisab-input)]/50 border rounded-2xl text-[var(--hisab-foreground)] outline-none transition-all pr-10 disabled:opacity-50 focus:border-cyan-400/60 ${opts.extraPaddingLeft ? "pl-16" : ""}`}
          style={{ borderColor: opts.err ? "hsl(var(--hisab-destructive))" : undefined }}
        />
        <label className={`absolute right-10 transition-all pointer-events-none ${opts.value ? "top-1.5 text-[10px] text-cyan-300" : "top-3.5 text-sm text-[var(--hisab-muted-fg)]"}`}>
          {opts.label}
        </label>
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--hisab-muted-fg)]">{opts.icon}</span>
        {opts.rightSlot && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2">{opts.rightSlot}</div>
        )}
      </div>
      {opts.err?.message && <p className="text-xs text-[var(--hisab-destructive)] mt-1.5">{tr(opts.err.message)}</p>}
    </div>
  )

  return (
    <div className="backdrop-blur-2xl bg-[var(--hisab-card)]/85 border border-[var(--hisab-border)] rounded-3xl p-6 sm:p-8 shadow-2xl">
      <div className="flex flex-col items-center mb-6">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-purple-500/20">ح</div>
        <h1 className="text-[var(--hisab-foreground)] text-xl font-bold mt-4">{st("auth.createAccount", "ایجاد حساب جدید")}</h1>
        <p className="text-[var(--hisab-muted-fg)] text-sm mt-1">{st("signup.subtitle", "برای شروع کسب‌وکار خود ثبت‌نام کنید")}</p>
      </div>

      {serverError && (
        <div className="mb-4 text-sm text-[var(--hisab-destructive)] bg-[var(--hisab-destructive)]/10 border border-[var(--hisab-destructive)]/20 p-3 rounded-xl" role="alert">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5" noValidate>
        {field({ name: "fullName",    type: "text",     label: st("signup.fullName", "نام و نام خانوادگی"),    icon: <IconUser />,  value: fullName,    err: errors.fullName,    dir: "rtl" })}
        {field({ name: "companyName", type: "text",     label: st("signup.companyName", "نام شرکت / فروشگاه"), icon: <IconStore />, value: companyName, err: errors.companyName, dir: "rtl" })}
        {field({ name: "phone",       type: "tel",      label: st("signup.phone", "شماره تماس (اختیاری)"),       icon: <IconPhone />, value: phone,       err: errors.phone })}
        {field({ name: "email",       type: "email",    label: st("auth.email", "ایمیل"),                       icon: <IconMail />,  value: email,       err: errors.email,    autoComplete: "email" })}
        {field({
          name: "password",
          type: showPassword ? "text" : "password",
          label: st("auth.password", "رمز عبور"),
          icon: <IconLock />,
          value: password,
          err: errors.password,
          autoComplete: "new-password",
          extraPaddingLeft: true,
          rightSlot: (
            <button type="button" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}
              className="text-[11px] font-medium text-[var(--hisab-muted-fg)] hover:text-[var(--hisab-foreground)] transition-colors px-1">
              {showPassword ? st("login.hidePassword", "مخفی") : st("login.showPassword", "نمایش")}
            </button>
          ),
        })}

        <Button type="submit" loading={isLoading} fullWidth size="lg" aria-busy={isLoading}
          className="!rounded-2xl !bg-gradient-to-r !from-purple-500 !to-cyan-500 !text-white !font-medium hover:!opacity-90 active:scale-[0.98] !mt-5">
          {st("auth.createAccount", "ایجاد حساب")}
        </Button>
      </form>

      <p className="text-center text-xs text-[var(--hisab-muted-fg)] mt-6">
        {st("auth.haveAccount", "حساب دارید؟")}{" "}
        <button type="button" onClick={onSwitchMode} className="text-[var(--hisab-primary)] cursor-pointer hover:underline font-semibold">
          {st("auth.signIn", "ورود")}
        </button>
      </p>
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// MAIN SHELL
// ═══════════════════════════════════════════════════════
export default function AuthShell({ initialMode = "login" }: { initialMode?: "login" | "signup" }) {
  const st = useSafeT()
  const [flipped, setFlipped] = useState(initialMode === "signup")

  const handleSwitch = () => {
    const willFlip = !flipped
    setFlipped(willFlip)
    setTimeout(() => {
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", willFlip ? "/signup" : "/login")
      }
    }, 275)
  }

  return (
    <div className="relative min-h-screen flex flex-col lg:flex-row overflow-hidden bg-[var(--hisab-background)]" dir="rtl">

      {/* ═════════════ RIGHT (desktop only) — Workspace Preview ═════════════ */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center overflow-hidden">
        <div className="absolute inset-0 grid-drift" />
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute w-[620px] h-[620px] bg-purple-500/12 blur-[130px] rounded-full ambient-a top-[5%] right-[-120px]" />
          <div className="absolute w-[520px] h-[520px] bg-cyan-500/10 blur-[130px] rounded-full ambient-b bottom-[5%] left-[-120px]" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--hisab-background)]/50 via-transparent to-[var(--hisab-background)]/20 pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center px-8 xl:px-12 py-10 w-full max-w-lg">
          <div className="flex items-center gap-3 mb-6 brand-fade">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-white font-bold shadow-lg shadow-purple-500/25">ح</div>
            <div className="text-right">
              <div className="text-base font-bold text-[var(--hisab-foreground)] leading-tight">
                {st("auth.brandTitle", "حسابچه")}
              </div>
              <div className="text-[10px] text-[var(--hisab-muted-fg)] mt-0.5">
                {st("auth.brandSub", "سامانه مدیریت مالی هوشمند")}
              </div>
            </div>
          </div>

          <WorkspacePreview st={st} />

          <p className="text-xs text-[var(--hisab-muted-fg)] leading-relaxed mt-6 max-w-sm text-center brand-fade-late">
            {st("auth.tagline", "همه چیز در یک سامانه — فاکتور، انبار، مشتری و گزارش‌های لحظه‌ای")}
          </p>
        </div>
      </div>

      {/* ═════════════ MOBILE brand bar ═════════════ */}
      <div className="lg:hidden relative z-10 flex items-center justify-center pt-8 pb-2 px-6 brand-fade">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-white font-bold shadow-lg shadow-purple-500/30">ح</div>
          <div className="text-right">
            <div className="text-sm font-bold text-[var(--hisab-foreground)] leading-tight">
              {st("auth.brandTitle", "حسابچه")}
            </div>
            <div className="text-[10px] text-[var(--hisab-muted-fg)]">
              {st("auth.brandSubMobile", "مدیریت مالی هوشمند")}
            </div>
          </div>
        </div>
      </div>

      {/* ═════════════ FORM panel ═════════════ */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 relative">
        <div className="lg:hidden absolute inset-0 pointer-events-none">
          <div className="absolute w-[380px] h-[380px] bg-purple-500/10 blur-[100px] rounded-full ambient-a top-[-100px] right-[-100px]" />
          <div className="absolute w-[380px] h-[380px] bg-cyan-500/10 blur-[100px] rounded-full ambient-b bottom-[-100px] left-[-100px]" />
          <div className="lg:hidden absolute inset-0 grid-drift opacity-50" />
        </div>

        <div className="relative w-full max-w-md flip-perspective">
          <div className={`flip-inner ${flipped ? "is-flipped" : ""}`}>
            <div className="flip-face flip-front">
              <LoginForm onSwitchMode={handleSwitch} st={st} />
            </div>
            <div className="flip-face flip-back">
              <SignupForm onSwitchMode={handleSwitch} st={st} />
            </div>
          </div>
        </div>
      </div>

      
    </div>
  )
}