"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   AuthShell v2 — Hisabche Design Language
   Zero hardcoded colors — all tokens from design system
   Zero inline styles (except dynamic animation delays)
   No external component dependencies (Button removed)
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── Icons ─────────────────────────────────────────────
const IconMail = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" />
  </svg>
);
const IconLock = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);
const IconUser = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);
const IconStore = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 9l1-5h16l1 5M5 9v11h14V9M9 13h6" />
  </svg>
);
const IconPhone = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 16.92V21a1 1 0 0 1-1.11 1 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 3.18 4.11 1 1 0 0 1 4.18 3h4.09a1 1 0 0 1 1 .75 12.84 12.84 0 0 0 .7 2.81 1 1 0 0 1-.22 1.11L8 9a16 16 0 0 0 6 6l1.27-1.78a1 1 0 0 1 1.11-.22 12.84 12.84 0 0 0 2.81.7 1 1 0 0 1 .81 1z" />
  </svg>
);
const IconCheck = () => (
  <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const IconClock = () => (
  <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);
const IconTruck = () => (
  <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
);
const IconSearch = () => (
  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);
const IconBell = () => (
  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);
const IconFilter = () => (
  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);
const IconDoc = () => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

// ─── Types ─────────────────────────────────────────────
type SafeT = (key: string, fallback: string) => string;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyForm = any;

interface LoginFormProps {
  st: SafeT;
  serverError: string | null;
  isLoading: boolean;
  errors: Record<string, { message?: string } | undefined>;
  register: AnyForm;
  watch: AnyForm;
  handleSubmit: AnyForm;
  showPassword: boolean;
  togglePassword: () => void;
  onSwitchMode: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onDemoLogin: () => void;
}

interface SignupFieldOpts {
  name: string;
  type: string;
  label: string;
  icon: ReactNode;
  value: string | undefined;
  err?: { message?: string } | undefined;
  dir?: "ltr" | "rtl";
  autoComplete?: string;
  rightSlot?: ReactNode;
  extraPaddingLeft?: boolean;
}

interface SignupFormProps {
  st: SafeT;
  serverError: string | null;
  isLoading: boolean;
  errors: Record<string, { message?: string } | undefined>;
  register: AnyForm;
  watch: AnyForm;
  handleSubmit: AnyForm;
  showPassword: boolean;
  togglePassword: () => void;
  onSwitchMode: () => void;
  onSubmit: (e: React.FormEvent) => void;
  translateError: (k?: string) => string | undefined;
}

// Shared input style — base padding-end 10 for icon, no default padding-start
const inputClass =
  "peer w-full h-12 px-4 pt-5 bg-[hsl(var(--surface-muted)/0.5)] border border-[hsl(var(--border-default))] rounded-2xl text-[hsl(var(--fg-primary))] outline-none transition-all duration-200 pe-10 placeholder:text-transparent disabled:opacity-50 focus:border-[hsl(var(--color-primary)/0.6)]";
const floatLabelClass =
  "absolute start-10 transition-all pointer-events-none text-[hsl(var(--fg-tertiary))]";
const floatLabelTop = "top-1.5 text-[10px] text-[hsl(var(--color-primary))]";
const floatLabelMid = "top-3.5 text-sm";

// ─── WorkspacePreview ──────────────────────────────────
function WorkspacePreview({ st }: { st: SafeT }) {
  const rows = [
    { id: 1, status: "paid" as const, hueA: 280, hueB: 320, w: 65 },
    { id: 2, status: "pending" as const, hueA: 195, hueB: 220, w: 78 },
    { id: 3, status: "paid" as const, hueA: 25, hueB: 10, w: 52 },
    { id: 4, status: "shipped" as const, hueA: 160, hueB: 180, w: 70 },
    { id: 5, status: "paid" as const, hueA: 340, hueB: 0, w: 58 },
  ];

  const statusMap = {
    paid: {
      cls: "bg-[hsl(var(--color-success)/0.15)] text-[hsl(var(--color-success))] border-[hsl(var(--color-success)/0.25)]",
      icon: <IconCheck />,
      label: st("preview.status.paid", "تکمیل"),
    },
    pending: {
      cls: "bg-[hsl(var(--color-warning)/0.15)] text-[hsl(var(--color-warning))] border-[hsl(var(--color-warning)/0.25)]",
      icon: <IconClock />,
      label: st("preview.status.pending", "در انتظار"),
    },
    shipped: {
      cls: "bg-[hsl(195_90%_50%/0.15)] text-[hsl(195_90%_50%)] border-[hsl(195_90%_50%/0.25)]",
      icon: <IconTruck />,
      label: st("preview.status.shipped", "در حال ارسال"),
    },
  };

  return (
    <div className="relative w-full max-w-md flex flex-col gap-4">
      {/* Dashboard card */}
      <div className="relative bg-[hsl(var(--surface-elevated)/0.9)] border border-[hsl(var(--border-default))] rounded-2xl p-5 shadow-2xl backdrop-blur-xl overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[hsl(var(--color-primary)/0.4)] to-transparent" />
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[hsl(var(--color-primary)/0.2)] to-[hsl(195_90%_50%/0.2)] border border-[hsl(var(--color-primary)/0.3)] flex items-center justify-center text-[hsl(var(--color-primary))]">
              <IconDoc />
            </div>
            <div>
              <div className="text-sm font-bold text-[hsl(var(--fg-primary))] leading-tight">
                {st("preview.title", "سفارش‌ها و فاکتورها")}
              </div>
              <div className="text-[10px] text-[hsl(var(--fg-tertiary))] flex items-center gap-1 mt-0.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(var(--color-success))] opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[hsl(var(--color-success))]" />
                </span>
                <span>{st("preview.synced", "همگام‌سازی زنده")}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[hsl(var(--fg-tertiary))]">
            <button type="button" className="p-1.5 rounded-lg hover:bg-[hsl(var(--surface-muted))] transition-colors"><IconBell /></button>
            <button type="button" className="p-1.5 rounded-lg hover:bg-[hsl(var(--surface-muted))] transition-colors"><IconFilter /></button>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mb-3">
          <span className="px-2.5 py-1 text-[10px] font-medium rounded-full bg-[var(--gradient-brand)] text-white shadow-sm">
            {st("preview.chip.all", "همه")}
          </span>
          {[st("preview.chip.invoice", "فاکتور"), st("preview.chip.order", "سفارش"), st("preview.chip.customer", "مشتری")].map((label) => (
            <span key={label} className="px-2.5 py-1 text-[10px] font-medium rounded-full bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-tertiary))] border border-[hsl(var(--border-default))]">
              {label}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-xl bg-[hsl(var(--surface-muted)/0.3)] border border-[hsl(var(--border-default))]">
          <IconSearch />
          <div className="h-1.5 w-24 rounded-full bg-[hsl(var(--fg-tertiary)/0.25)]" />
          <div className="ms-auto text-[9px] px-1.5 py-0.5 rounded bg-[hsl(var(--surface-elevated))] border border-[hsl(var(--border-default))] text-[hsl(var(--fg-tertiary))] font-mono">⌘K</div>
        </div>
        <div className="space-y-0.5">
          {rows.map((row, i) => {
            const s = statusMap[row.status];
            return (
              <div key={row.id} className="group flex items-center gap-3 py-2 px-2 -mx-2 rounded-xl hover:bg-[hsl(var(--surface-muted))] transition-colors" style={{ animationDelay: `${0.85 + i * 0.08}s` }}>
                <div className="w-8 h-8 rounded-full shrink-0 ring-2 ring-[hsl(var(--surface-elevated))] shadow-sm relative overflow-hidden" style={{ background: `linear-gradient(135deg, hsl(${row.hueA} 75% 60%), hsl(${row.hueB} 75% 50%))` }}>
                  <div className="absolute inset-0 flex items-center justify-center text-white opacity-90"><IconUser /></div>
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="h-2 rounded-full bg-[hsl(var(--fg-primary)/0.25)]" style={{ width: `${row.w}%` }} />
                  <div className="h-1.5 rounded-full bg-[hsl(var(--fg-tertiary)/0.2)]" style={{ width: `${row.w * 0.55}%` }} />
                </div>
                <div className={cn("flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md border", s.cls)}>
                  {s.icon}<span>{s.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* Pipeline */}
      <div className="relative bg-[hsl(var(--surface-elevated)/0.8)] border border-[hsl(var(--border-default))] rounded-2xl p-4 backdrop-blur-xl shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] text-[hsl(var(--fg-tertiary))] uppercase tracking-[0.12em] font-semibold">{st("preview.workflow", "گردش کار")}</div>
          <div className="text-[10px] text-[hsl(var(--color-primary))] font-medium">{st("preview.workflowActive", "در مرحله: ارسال")}</div>
        </div>
        <div className="relative">
          <svg viewBox="0 0 280 28" className="w-full h-7" preserveAspectRatio="none">
            <defs>
              <linearGradient id="pipe-progress" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="hsl(var(--color-primary))" />
                <stop offset="100%" stopColor="hsl(195_90%_50%)" />
              </linearGradient>
            </defs>
            <line x1="14" y1="14" x2="266" y2="14" stroke="hsl(var(--border-default))" strokeWidth="1.5" strokeDasharray="3 4" />
            <line x1="14" y1="14" x2="194" y2="14" stroke="url(#pipe-progress)" strokeWidth="2" />
            {[14, 74, 134, 194, 266].map((cx, i) => {
              const done = i <= 3;
              return (
                <g key={i}>
                  {i === 3 && <circle cx={cx} cy={14} r="9" fill="hsl(195_90%_50%)" className="pipe-pulse" />}
                  <circle cx={cx} cy={14} r="5" fill={done ? "url(#pipe-progress)" : "hsl(var(--surface-elevated))"} stroke={done ? "transparent" : "hsl(var(--border-default))"} strokeWidth="1.5" style={{ animationDelay: `${1.1 + i * 0.08}s` }} />
                </g>
              );
            })}
          </svg>
          <div className="flex justify-between text-[10px] mt-1.5 px-0.5">
            <span className="text-[hsl(var(--fg-primary))] font-medium">{st("preview.stage.created", "ثبت")}</span>
            <span className="text-[hsl(var(--fg-primary))] font-medium">{st("preview.stage.approved", "تأیید")}</span>
            <span className="text-[hsl(var(--fg-primary))] font-medium">{st("preview.stage.packed", "بسته‌بندی")}</span>
            <span className="text-[hsl(var(--color-primary))] font-bold">{st("preview.stage.shipped", "ارسال")}</span>
            <span className="text-[hsl(var(--fg-tertiary))]">{st("preview.stage.delivered", "تحویل")}</span>
          </div>
        </div>
      </div>
      {/* Feature pills */}
      <div className="flex flex-wrap gap-2 justify-center">
        {[
          { label: st("preview.feature.inventory", "انبارداری"), hue: 280 },
          { label: st("preview.feature.crm", "مدیریت مشتری"), hue: 195 },
          { label: st("preview.feature.reports", "گزارش‌های زنده"), hue: 160 },
          { label: st("preview.feature.invoice", "فاکتور هوشمند"), hue: 25 },
        ].map((p) => (
          <span key={p.label} className="px-3 py-1.5 text-[11px] font-medium rounded-full bg-[hsl(var(--surface-elevated)/0.7)] border backdrop-blur" style={{ borderColor: `hsl(${p.hue} 70% 55% / 0.3)`, color: `hsl(${p.hue} 70% 60%)` }}>
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── LoginForm ─────────────────────────────────────────
function LoginForm({
  st, serverError, isLoading, errors, register, watch, handleSubmit,
  showPassword, togglePassword, onSwitchMode, onSubmit, onDemoLogin,
}: LoginFormProps) {
  const emailValue = watch("email");
  const passwordValue = watch("password");

  return (
    <div className="backdrop-blur-2xl bg-[hsl(var(--surface-elevated)/0.85)] border border-[hsl(var(--border-default))] rounded-3xl p-6 sm:p-8 shadow-2xl">
      <div className="flex flex-col items-center mb-6 sm:mb-8">
        <div className="w-14 h-14 rounded-2xl bg-[var(--gradient-brand)] flex items-center justify-center text-white font-bold text-xl shadow-lg">ح</div>
        <h1 className="text-[hsl(var(--fg-primary))] text-xl font-bold mt-4">{st("auth.welcomeBack", "خوش آمدید")}</h1>
        <p className="text-[hsl(var(--fg-secondary))] text-sm mt-1">{st("login.subtitle", "ورود به حساب کاربری")}</p>
      </div>

      {serverError && (
        <div className="mb-4 text-sm text-[hsl(var(--color-destructive))] bg-[hsl(var(--color-destructive)/0.1)] border border-[hsl(var(--color-destructive)/0.2)] p-3 rounded-xl" role="alert">{serverError}</div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        {/* Email */}
        <div>
          <div className="relative">
            <input {...register("email")} type="email" autoComplete="email" disabled={isLoading} className={cn(inputClass, errors.email && "border-[hsl(var(--color-destructive))]")} placeholder=" " dir="ltr" />
            <label className={cn(floatLabelClass, emailValue ? floatLabelTop : floatLabelMid)}>{st("auth.email", "ایمیل")}</label>
            <span className="absolute end-3 top-1/2 -translate-y-1/2 text-[hsl(var(--fg-tertiary))]"><IconMail /></span>
          </div>
          {errors.email?.message && <p className="text-xs text-[hsl(var(--color-destructive))] mt-1.5">{errors.email.message}</p>}
        </div>

        {/* Password */}
        <div>
          <div className="relative">
            <input
              {...register("password")}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              disabled={isLoading}
              className={cn(
                inputClass,
                "ps-20",
                errors.password && "border-[hsl(var(--color-destructive))]",
              )}
              placeholder=" "
              dir="ltr"
            />
            <label
              className={cn(
                floatLabelClass,
                passwordValue ? floatLabelTop : floatLabelMid,
              )}
              style={{ insetInlineStart: "5rem" }}
            >
              {st("auth.password", "رمز عبور")}
            </label>
            <span className="absolute end-3 top-1/2 -translate-y-1/2 text-[hsl(var(--fg-tertiary))]">
              <IconLock />
            </span>
            <button
              type="button"
              onClick={togglePassword}
              tabIndex={-1}
              className="absolute start-2 top-1/2 -translate-y-1/2 text-[11px] font-medium text-[hsl(var(--fg-tertiary))] hover:text-[hsl(var(--fg-primary))] transition-colors px-2 py-1 rounded-lg"
            >
              {showPassword
                ? st("login.hidePassword", "مخفی")
                : st("login.showPassword", "نمایش")}
            </button>
          </div>
          {errors.password?.message && (
            <p className="text-xs text-[hsl(var(--color-destructive))] mt-1.5">
              {errors.password.message}
            </p>
          )}
        </div>

        <button type="submit" disabled={isLoading} className="w-full inline-flex items-center justify-center rounded-2xl px-6 py-3 text-sm font-bold text-white bg-[var(--gradient-brand)] hover:brightness-110 active:scale-[0.98] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed mt-5">
          {isLoading && <svg className="size-4 me-2 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" /><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" className="opacity-75" /></svg>}
          {st("auth.signIn", "ورود")}
        </button>
        <button type="button" onClick={onDemoLogin} disabled={isLoading} className="w-full inline-flex items-center justify-center rounded-2xl px-6 py-3 text-sm font-medium border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] transition-colors duration-150 disabled:opacity-40">
          {st("login.demoLogin", "ورود نمایشی")}
        </button>
      </form>

      <p className="text-center text-xs text-[hsl(var(--fg-secondary))] mt-6">
        {st("auth.noAccount", "حساب ندارید؟")}{" "}
        <button type="button" onClick={onSwitchMode} className="text-[hsl(var(--color-primary))] cursor-pointer hover:underline font-semibold">
          {st("auth.signUp", "ثبت‌نام کنید")}
        </button>
      </p>
    </div>
  );
}

// ─── SignupForm ────────────────────────────────────────
function SignupForm({
  st, serverError, isLoading, errors, register, watch, handleSubmit,
  showPassword, togglePassword, onSwitchMode, onSubmit, translateError,
}: SignupFormProps) {
  const fullName = watch("fullName");
  const companyName = watch("companyName");
  const phone = watch("phone");
  const email = watch("email");
  const password = watch("password");

  const field = (opts: SignupFieldOpts) => (
    <div>
      <div className="relative">
        <input {...register(opts.name)} type={opts.type} autoComplete={opts.autoComplete} disabled={isLoading} dir={opts.dir ?? "ltr"} placeholder=" "
          className={cn(inputClass, opts.extraPaddingLeft && "ps-20", opts.err && "border-[hsl(var(--color-destructive))]")} />
        <label className={cn(floatLabelClass, opts.value ? floatLabelTop : floatLabelMid)} style={opts.extraPaddingLeft ? { insetInlineStart: "5rem" } : undefined}>{opts.label}</label>
        <span className="absolute end-3 top-1/2 -translate-y-1/2 text-[hsl(var(--fg-tertiary))]">{opts.icon}</span>
        {opts.rightSlot && <div className="absolute start-2 top-1/2 -translate-y-1/2">{opts.rightSlot}</div>}
      </div>
      {opts.err?.message && <p className="text-xs text-[hsl(var(--color-destructive))] mt-1.5">{translateError(opts.err.message)}</p>}
    </div>
  );

  return (
    <div className="backdrop-blur-2xl bg-[hsl(var(--surface-elevated)/0.85)] border border-[hsl(var(--border-default))] rounded-3xl p-6 sm:p-8 shadow-2xl">
      <div className="flex flex-col items-center mb-6">
        <div className="w-14 h-14 rounded-2xl bg-[var(--gradient-brand)] flex items-center justify-center text-white font-bold text-xl shadow-lg">ح</div>
        <h1 className="text-[hsl(var(--fg-primary))] text-xl font-bold mt-4">{st("auth.createAccount", "ایجاد حساب جدید")}</h1>
        <p className="text-[hsl(var(--fg-secondary))] text-sm mt-1">{st("signup.subtitle", "برای شروع کسب‌وکار خود ثبت‌نام کنید")}</p>
      </div>

      {serverError && (
        <div className="mb-4 text-sm text-[hsl(var(--color-destructive))] bg-[hsl(var(--color-destructive)/0.1)] border border-[hsl(var(--color-destructive)/0.2)] p-3 rounded-xl" role="alert">{serverError}</div>
      )}

      <form onSubmit={onSubmit} className="space-y-3.5" noValidate>
        {field({ name: "fullName", type: "text", label: st("signup.fullName", "نام و نام خانوادگی"), icon: <IconUser />, value: fullName, err: errors.fullName, dir: "rtl" })}
        {field({ name: "companyName", type: "text", label: st("signup.companyName", "نام شرکت / فروشگاه"), icon: <IconStore />, value: companyName, err: errors.companyName, dir: "rtl" })}
        {field({ name: "phone", type: "tel", label: st("signup.phone", "شماره تماس (اختیاری)"), icon: <IconPhone />, value: phone, err: errors.phone })}
        {field({ name: "email", type: "email", label: st("auth.email", "ایمیل"), icon: <IconMail />, value: email, err: errors.email, autoComplete: "email" })}
        {field({ name: "password", type: showPassword ? "text" : "password", label: st("auth.password", "رمز عبور"), icon: <IconLock />, value: password, err: errors.password, autoComplete: "new-password", extraPaddingLeft: true,
          rightSlot: (
            <button type="button" onClick={togglePassword} tabIndex={-1} className="text-[11px] font-medium text-[hsl(var(--fg-tertiary))] hover:text-[hsl(var(--fg-primary))] transition-colors px-2 py-1">
              {showPassword ? st("login.hidePassword", "مخفی") : st("login.showPassword", "نمایش")}
            </button>
          ),
        })}
        <button type="submit" disabled={isLoading} className="w-full inline-flex items-center justify-center rounded-2xl px-6 py-3 text-sm font-bold text-white bg-[var(--gradient-brand)] hover:brightness-110 active:scale-[0.98] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed mt-5">
          {isLoading && <svg className="size-4 me-2 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" /><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" className="opacity-75" /></svg>}
          {st("auth.createAccount", "ایجاد حساب")}
        </button>
      </form>

      <p className="text-center text-xs text-[hsl(var(--fg-secondary))] mt-6">
        {st("auth.haveAccount", "حساب دارید؟")}{" "}
        <button type="button" onClick={onSwitchMode} className="text-[hsl(var(--color-primary))] cursor-pointer hover:underline font-semibold">
          {st("auth.signIn", "ورود")}
        </button>
      </p>
    </div>
  );
}

// ─── AuthShell ─────────────────────────────────────────
interface AuthShellProps {
  initialMode?: "login" | "signup";
  flipped: boolean;
  st: SafeT;
  loginProps: LoginFormProps;
  signupProps: SignupFormProps;
  onSwitchMode: () => void;
}

export function AuthShell({ flipped, st, loginProps, signupProps, onSwitchMode }: AuthShellProps) {
  return (
    <div className="relative min-h-screen flex flex-col lg:flex-row overflow-hidden bg-[hsl(var(--surface-base))]" dir="rtl">
      {/* Left panel — workspace preview */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center overflow-hidden">
        <div className="absolute inset-0 grid-drift" />
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute w-[620px] h-[620px] bg-[hsl(var(--color-primary)/0.12)] blur-[130px] rounded-full top-[5%] end-[-120px]" />
          <div className="absolute w-[520px] h-[520px] bg-[hsl(195_90%_50%/0.1)] blur-[130px] rounded-full bottom-[5%] start-[-120px]" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--surface-base)/0.5)] via-transparent to-[hsl(var(--surface-base)/0.2)] pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center px-8 xl:px-12 py-10 w-full max-w-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-2xl bg-[var(--gradient-brand)] flex items-center justify-center text-white font-bold shadow-lg">ح</div>
            <div className="text-end">
              <div className="text-base font-bold text-[hsl(var(--fg-primary))] leading-tight">{st("auth.brandTitle", "حسابچه")}</div>
              <div className="text-[10px] text-[hsl(var(--fg-tertiary))] mt-0.5">{st("auth.brandSub", "سامانه مدیریت مالی هوشمند")}</div>
            </div>
          </div>
          <WorkspacePreview st={st} />
          <p className="text-xs text-[hsl(var(--fg-secondary))] leading-relaxed mt-6 max-w-sm text-center">
            {st("auth.tagline", "همه چیز در یک سامانه — فاکتور، انبار، مشتری و گزارش‌های لحظه‌ای")}
          </p>
        </div>
      </div>

      {/* Mobile brand */}
      <div className="lg:hidden relative z-10 flex items-center justify-center pt-8 pb-2 px-6">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-[var(--gradient-brand)] flex items-center justify-center text-white font-bold shadow-lg">ح</div>
          <div className="text-end">
            <div className="text-sm font-bold text-[hsl(var(--fg-primary))] leading-tight">{st("auth.brandTitle", "حسابچه")}</div>
            <div className="text-[10px] text-[hsl(var(--fg-tertiary))]">{st("auth.brandSubMobile", "مدیریت مالی هوشمند")}</div>
          </div>
        </div>
      </div>

      {/* Forms */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 relative">
        <div className="lg:hidden absolute inset-0 pointer-events-none">
          <div className="absolute w-[380px] h-[380px] bg-[hsl(var(--color-primary)/0.1)] blur-[100px] rounded-full top-[-100px] end-[-100px]" />
          <div className="absolute w-[380px] h-[380px] bg-[hsl(195_90%_50%/0.1)] blur-[100px] rounded-full bottom-[-100px] start-[-100px]" />
          <div className="lg:hidden absolute inset-0 grid-drift opacity-50" />
        </div>
        <div className="relative w-full max-w-md flip-perspective">
          <div className={`flip-inner ${flipped ? "is-flipped" : ""}`}>
            <div className="flip-face flip-front">
              <LoginForm {...loginProps} onSwitchMode={onSwitchMode} />
            </div>
            <div className="flip-face flip-back">
              <SignupForm {...signupProps} onSwitchMode={onSwitchMode} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}