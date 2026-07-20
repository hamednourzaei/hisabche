"use client";

import type { ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { PhoneInput } from "../phone-input";
import React from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   AuthShell v14 — i18n-ready + Fixed Signup Card Background
   ✅ Fixed dark background on signup card
   ✅ Memoized sub-components
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── Icons ─────────────────────────────────────────────────────────────────

const IconArrowBack = () => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const IconMail = ({ className }: { className?: string }) => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </svg>
);

const IconLock = ({ className }: { className?: string }) => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

const IconUser = ({ className }: { className?: string }) => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const IconStore = ({ className }: { className?: string }) => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
    <path d="M3 9l1-5h16l1 5M5 9v11h14V9M9 13h6" />
  </svg>
);

const IconCheck = () => (
  <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconClock = () => (
  <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const IconTruck = () => (
  <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="1" y="3" width="15" height="13" />
    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
    <circle cx="5.5" cy="18.5" r="2.5" />
    <circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
);

const IconSearch = () => (
  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const IconBell = () => (
  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const IconFilter = () => (
  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

const IconDoc = () => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

const IconEye = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconEyeOff = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const SpinnerIcon = () => (
  <svg className="size-4 me-2 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
    <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" className="opacity-75" />
  </svg>
);

// ─── Types ─────────────────────────────────────────────────────────────────

type SafeT = (key: string, fallback: string) => string;
type AnyForm = any;

// ─── Helpers ───────────────────────────────────────────────────────────────

function getLocaleFromPathname(pathname: string): string {
  const match = pathname.match(/^\/(fa-IR|fa-AF|en)/);
  return match?.[1] ?? "fa-IR";
}

// ─── Sub-components ───────────────────────────────────────────────────────

function BackButton() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const isRTL = locale === "fa-IR" || locale === "fa-AF";
  const homePath = locale === "fa-IR" ? "/" : `/${locale}`;
  return (
    <button
      type="button"
      onClick={() => router.push(homePath)}
      className={cn(
        "absolute top-4 z-20",
        isRTL ? "start-4" : "end-4",
        "inline-flex items-center justify-center rounded-xl p-2",
        "bg-[hsl(var(--surface-elevated)/0.9)] border border-[hsl(var(--border-default))]",
        "text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]",
        "backdrop-blur-md transition-all duration-200 shadow-sm"
      )}
      aria-label="Back to home"
    >
      <span className={isRTL ? "rotate-0" : "rotate-180"}>
        <IconArrowBack />
      </span>
    </button>
  );
}

const BrandLogo = ({ size = "md", st }: { size?: "sm" | "md"; st: SafeT }) => {
  const dim = size === "sm" 
    ? "w-10 h-10 text-base rounded-xl" 
    : "w-14 h-14 text-xl rounded-2xl";
  return (
    <div
      className={cn("flex items-center justify-center text-white font-bold shadow-lg", dim)}
      style={{ background: "linear-gradient(135deg, hsl(var(--color-primary)), hsl(195 90% 50%))" }}
    >
      {st("app.name", "حسابچه").charAt(0)}
    </div>
  );
};

const ErrorBanner = ({ message }: { message: string }) => {
  return (
    <div
      className="mb-4 text-sm text-[hsl(var(--color-destructive))] bg-[hsl(var(--color-destructive)/0.08)] border border-[hsl(var(--color-destructive)/0.2)] p-3 rounded-xl flex items-start gap-2"
      role="alert"
    >
      <span className="shrink-0 mt-px opacity-60">⚠</span>
      <span>{message}</span>
    </div>
  );
};

const PasswordToggle = ({
  show,
  onToggle,
  st,
}: {
  show: boolean;
  onToggle: () => void;
  st: SafeT;
}) => {
  return (
    <button
      type="button"
      onClick={onToggle}
      tabIndex={-1}
      aria-label={show ? st("auth.hidePassword", "مخفی کردن رمز") : st("auth.showPassword", "نمایش رمز")}
      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[hsl(var(--fg-tertiary))] hover:text-[hsl(var(--fg-primary))] hover:bg-[hsl(var(--surface-muted))] transition-colors text-[11px] font-medium"
    >
      {show ? <IconEyeOff /> : <IconEye />}
    </button>
  );
};

const PrimaryButton = ({
  isLoading,
  label,
  type = "submit",
  onClick,
}: {
  isLoading: boolean;
  label: string;
  type?: "submit" | "button";
  onClick?: () => void;
}) => {
  return (
    <button
      type={type}
      disabled={isLoading}
      onClick={onClick}
      className="w-full inline-flex items-center justify-center rounded-2xl px-6 py-3 text-sm font-bold text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
      style={{ background: "linear-gradient(135deg, hsl(var(--color-primary)), hsl(195 90% 50%))" }}
    >
      {isLoading && <SpinnerIcon />}
      {label}
    </button>
  );
};

// ─── Field Component ──────────────────────────────────────────────────────

const inputBase =
  "w-full h-11 px-4 bg-[hsl(var(--surface-base))] border-2 border-[hsl(var(--border-default))] rounded-2xl text-[hsl(var(--fg-primary))] outline-none disabled:opacity-50 transition-[border-color,box-shadow] duration-200 auth-input";
const inputFocus = "focus:border-[hsl(var(--color-primary))] focus:shadow-[0_0_0_4px_hsl(var(--color-primary)/0.12)]";
const inputHover = "hover:border-[hsl(var(--border-strong))]";

interface FieldProps {
  id: string;
  label: string;
  icon: ReactNode;
  error?: { message?: string } | undefined;
  children: ReactNode;
  rightSlot?: ReactNode | undefined;
  hasRightSlot?: boolean | undefined;
  translateError?: ((k?: string) => string | undefined) | undefined;
}

function Field({ icon, error, children, rightSlot, hasRightSlot, translateError }: FieldProps) {
  const errMsg = translateError ? translateError(error?.message) : error?.message;
  const child = children as React.ReactElement;
  const hasValue = typeof child?.props?.value === "string" ? child.props.value.length > 0 : !!child?.props?.value;

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <span className="absolute start-3 top-1/2 -translate-y-1/2 text-[hsl(var(--fg-tertiary))] z-10 pointer-events-none" aria-hidden="true">
          {icon}
        </span>
        <div className={cn(hasRightSlot && "[&>input]:pe-14")}>
          {React.cloneElement(child, { className: cn(child.props.className, hasValue && "has-value") })}
        </div>
        {rightSlot && <div className="absolute end-2 top-1/2 -translate-y-1/2 z-10">{rightSlot}</div>}
      </div>
      {errMsg && (
        <p className="text-xs text-[hsl(var(--color-destructive))] px-1" role="alert">
          {errMsg}
        </p>
      )}
    </div>
  );
}

function PhoneField({
  value,
  onChange,
  placeholder,
  disabled,
  error,
  translateError,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  disabled: boolean | undefined;
  error?: { message?: string } | undefined;
  translateError?: (k?: string) => string | undefined;
}) {
  const errMsg = translateError ? translateError(error?.message) : error?.message;
  return (
    <div className="space-y-1.5">
      <PhoneInput
        value={value || ""}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        defaultCountry="+93"
      />
      {errMsg && (
        <p className="text-xs text-[hsl(var(--color-destructive))] px-1" role="alert">
          {errMsg}
        </p>
      )}
    </div>
  );
}

// ─── WorkspacePreview ─────────────────────────────────────────────────────

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
      <div className="preview-card-1 relative bg-[hsl(var(--surface-elevated)/0.9)] border border-[hsl(var(--border-default))] rounded-2xl p-5 shadow-2xl backdrop-blur-xl overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[hsl(var(--color-primary)/0.5)] to-transparent" />
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
          <div className="flex items-center gap-1 text-[hsl(var(--fg-tertiary))]">
            <button type="button" className="p-1.5 rounded-lg hover:bg-[hsl(var(--surface-muted))] transition-colors" aria-label={st("notifications.bell", "اعلان‌ها")}>
              <IconBell />
            </button>
            <button type="button" className="p-1.5 rounded-lg hover:bg-[hsl(var(--surface-muted))] transition-colors" aria-label={st("action.filter", "فیلتر")}>
              <IconFilter />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          <span
            className="px-2.5 py-1 text-[10px] font-medium rounded-full text-white shadow-sm"
            style={{ background: "linear-gradient(135deg, hsl(var(--color-primary)), hsl(195 90% 50%))" }}
          >
            {st("preview.chip.all", "همه")}
          </span>
          {[st("preview.chip.invoice", "فاکتور"), st("preview.chip.order", "سفارش"), st("preview.chip.customer", "مشتری")].map((l) => (
            <span key={l} className="px-2.5 py-1 text-[10px] font-medium rounded-full bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-tertiary))] border border-[hsl(var(--border-default))]">
              {l}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-xl bg-[hsl(var(--surface-muted)/0.5)] border border-[hsl(var(--border-default))]">
          <span className="text-[hsl(var(--fg-tertiary))]">
            <IconSearch />
          </span>
          <div className="h-1.5 w-24 rounded-full bg-[hsl(var(--fg-tertiary)/0.2)]" />
          <div className="ms-auto text-[9px] px-1.5 py-0.5 rounded bg-[hsl(var(--surface-elevated))] border border-[hsl(var(--border-default))] text-[hsl(var(--fg-tertiary))] font-mono">
            ⌘K
          </div>
        </div>

        <div className="space-y-0.5">
          {rows.map((r, i) => {
            const s = statusMap[r.status];
            return (
              <div
                key={r.id}
                className="stagger-row group flex items-center gap-3 py-2 px-2 -mx-2 rounded-xl hover:bg-[hsl(var(--surface-muted))] transition-colors"
                style={{ animationDelay: `${0.3 + i * 0.08}s` }}
              >
                <div
                  className="w-8 h-8 rounded-full shrink-0 ring-2 ring-[hsl(var(--surface-elevated))] shadow-sm relative overflow-hidden"
                  style={{ background: `linear-gradient(135deg, hsl(${r.hueA} 75% 60%), hsl(${r.hueB} 75% 50%))` }}
                >
                  <div className="absolute inset-0 flex items-center justify-center text-white opacity-90">
                    <IconUser />
                  </div>
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="h-2 rounded-full bg-[hsl(var(--fg-primary)/0.22)]" style={{ width: `${r.w}%` }} />
                  <div className="h-1.5 rounded-full bg-[hsl(var(--fg-tertiary)/0.18)]" style={{ width: `${r.w * 0.55}%` }} />
                </div>
                <div className={cn("flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md border shrink-0", s.cls)}>
                  {s.icon}
                  <span>{s.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="preview-card-2 relative bg-[hsl(var(--surface-elevated)/0.8)] border border-[hsl(var(--border-default))] rounded-2xl p-4 backdrop-blur-xl shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] text-[hsl(var(--fg-tertiary))] uppercase tracking-[0.12em] font-semibold">
            {st("preview.workflow", "گردش کار")}
          </div>
          <div className="text-[10px] text-[hsl(var(--color-primary))] font-medium">
            {st("preview.workflowActive", "در مرحله: ارسال")}
          </div>
        </div>
        <div className="relative">
          <svg viewBox="0 0 280 28" className="w-full h-7" preserveAspectRatio="none">
            <defs>
              <linearGradient id="pipe-progress" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="hsl(var(--color-primary))" />
                <stop offset="100%" stopColor="hsl(195 90% 50%)" />
              </linearGradient>
            </defs>
            <line x1="14" y1="14" x2="266" y2="14" stroke="hsl(var(--border-default))" strokeWidth="1.5" strokeDasharray="3 4" />
            <line x1="14" y1="14" x2="194" y2="14" stroke="url(#pipe-progress)" strokeWidth="2" />
            {[14, 74, 134, 194, 266].map((cx, i) => {
              const done = i <= 3;
              return (
                <g key={i}>
                  {i === 3 && <circle cx={cx} cy={14} r="9" fill="hsl(195 90% 50%)" className="pipe-pulse" />}
                  <circle
                    cx={cx}
                    cy={14}
                    r="5"
                    fill={done ? "url(#pipe-progress)" : "hsl(var(--surface-elevated))"}
                    stroke={done ? "transparent" : "hsl(var(--border-default))"}
                    strokeWidth="1.5"
                  />
                </g>
              );
            })}
          </svg>
          <div className="flex justify-between text-[10px] mt-1.5 px-0.5">
            <span className="text-[hsl(var(--fg-secondary))] font-medium">{st("preview.stage.created", "ثبت")}</span>
            <span className="text-[hsl(var(--fg-secondary))] font-medium">{st("preview.stage.approved", "تأیید")}</span>
            <span className="text-[hsl(var(--fg-secondary))] font-medium">{st("preview.stage.packed", "بسته‌بندی")}</span>
            <span className="text-[hsl(var(--color-primary))] font-bold">{st("preview.stage.shipped", "ارسال")}</span>
            <span className="text-[hsl(var(--fg-tertiary))]">{st("preview.stage.delivered", "تحویل")}</span>
          </div>
        </div>
      </div>

      <div className="preview-chips flex flex-wrap gap-2 justify-center">
        {[
          { label: st("preview.feature.inventory", "انبارداری"), hue: 280 },
          { label: st("preview.feature.crm", "مدیریت مشتری"), hue: 195 },
          { label: st("preview.feature.reports", "گزارش‌های زنده"), hue: 160 },
          { label: st("preview.feature.invoice", "فاکتور هوشمند"), hue: 25 },
        ].map((p) => (
          <span
            key={p.label}
            className="px-3 py-1.5 text-[11px] font-medium rounded-full bg-[hsl(var(--surface-elevated)/0.7)] border backdrop-blur"
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
  );
}

// ─── LoginForm ─────────────────────────────────────────────────────────────

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

function LoginForm({
  st,
  serverError,
  isLoading,
  errors,
  register,
  showPassword,
  togglePassword,
  onSwitchMode,
  onSubmit,
  onDemoLogin,
}: LoginFormProps) {
  return (
    <div className="relative bg-[hsl(var(--surface-elevated)/0.95)] border border-[hsl(var(--border-default))] rounded-3xl p-6 sm:p-8 shadow-2xl">
      <BackButton />
      <div className="flex flex-col items-center mb-6 sm:mb-8">
        <BrandLogo st={st} />
        <h1 className="text-[hsl(var(--fg-primary))] text-xl font-bold mt-4">
          {st("auth.welcomeBack", "خوش آمدید")}
        </h1>
        <p className="text-[hsl(var(--fg-secondary))] text-sm mt-1">
          {st("login.subtitle", "ورود به حساب کاربری")}
        </p>
      </div>

      {serverError && <ErrorBanner message={serverError} />}

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field
          id="login-email"
          label={st("auth.email", "ایمیل")}
          icon={<IconMail />}
          error={errors.email}
        >
          <input
            {...register("email")}
            id="login-email"
            type="email"
            autoComplete="email"
            disabled={isLoading}
            placeholder={st("auth.email", "ایمیل")}
            dir="ltr"
            className={cn(
              inputBase,
              inputFocus,
              inputHover,
              "ps-12",
              errors.email && "border-[hsl(var(--color-destructive))] focus:shadow-[0_0_0_4px_hsl(var(--color-destructive)/0.1)]"
            )}
          />
        </Field>

        <Field
          id="login-password"
          label={st("auth.password", "رمز عبور")}
          icon={<IconLock />}
          error={errors.password}
          hasRightSlot
          rightSlot={<PasswordToggle show={showPassword} onToggle={togglePassword} st={st} />}
        >
          <input
            {...register("password")}
            id="login-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            disabled={isLoading}
            placeholder={st("auth.password", "رمز عبور")}
            dir="ltr"
            className={cn(
              inputBase,
              inputFocus,
              inputHover,
              "ps-10 pe-14",
              errors.password && "border-[hsl(var(--color-destructive))] focus:shadow-[0_0_0_4px_hsl(var(--color-destructive)/0.1)]"
            )}
          />
        </Field>

        <div className="text-end">
          <a href="/forgot-password" className="text-xs text-[hsl(var(--color-primary))] hover:underline">
            {st("auth.forgotPassword", "رمز عبور را فراموش کردید؟")}
          </a>
        </div>

        <div className="space-y-2 pt-1">
          <PrimaryButton isLoading={isLoading} label={st("auth.signIn", "ورود")} />
          <button
            type="button"
            onClick={onDemoLogin}
            disabled={isLoading}
            className="w-full inline-flex items-center justify-center rounded-2xl px-6 py-3 text-sm font-medium border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] transition-colors duration-150 disabled:opacity-40"
          >
            {st("login.demoLogin", "ورود نمایشی")}
          </button>
        </div>
      </form>

      <p className="text-center text-xs text-[hsl(var(--fg-secondary))] mt-6">
        {st("auth.noAccount", "حساب ندارید؟")}{" "}
        <button
          type="button"
          onClick={onSwitchMode}
          className="text-[hsl(var(--color-primary))] hover:underline font-semibold"
        >
          {st("auth.signUp", "ثبت‌نام کنید")}
        </button>
      </p>
    </div>
  );
}

// ─── SignupForm ────────────────────────────────────────────────────────────

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

// ─── SignupForm ────────────────────────────────────────────────────────────

function SignupForm({
  st,
  serverError,
  isLoading,
  errors,
  register,
  watch,
  showPassword,
  togglePassword,
  onSwitchMode,
  onSubmit,
  translateError,
}: SignupFormProps) {
  const fields: SignupFieldOpts[] = [
    {
      name: "fullName",
      type: "text",
      label: st("signup.fullName", "نام و نام خانوادگی"),
      icon: <IconUser />,
      value: watch("fullName"),
      err: errors.fullName,
      dir: "rtl",
    },
    {
      name: "businessName",
      type: "text",
      label: st("signup.businessName", "نام شرکت / فروشگاه"),
      icon: <IconStore />,
      value: watch("businessName"),
      err: errors.businessName,
      dir: "rtl",
    },
    {
      name: "email",
      type: "email",
      label: st("auth.email", "ایمیل"),
      icon: <IconMail />,
      value: watch("email"),
      err: errors.email,
      autoComplete: "email",
    },
    {
      name: "password",
      type: showPassword ? "text" : "password",
      label: st("auth.password", "رمز عبور"),
      icon: <IconLock />,
      value: watch("password"),
      err: errors.password,
      autoComplete: "new-password",
      rightSlot: <PasswordToggle show={showPassword} onToggle={togglePassword} st={st} />,
    },
  ];

  return (
    <div className="relative bg-[hsl(var(--surface-elevated)/0.95)] border border-[hsl(var(--border-default))] rounded-3xl p-6 sm:p-8 shadow-2xl">
      <BackButton />
      <div className="flex flex-col items-center mb-6 sm:mb-8">
        <BrandLogo size="sm" st={st} />
        <h1 className="text-[hsl(var(--fg-primary))] text-lg font-bold mt-3">
          {st("auth.createAccount", "ایجاد حساب جدید")}
        </h1>
        <p className="text-[hsl(var(--fg-secondary))] text-xs mt-0.5">
          {st("signup.subtitle", "برای شروع کسب‌وکار خود ثبت‌نام کنید")}
        </p>
      </div>

      {serverError && <ErrorBanner message={serverError} />}

      <form onSubmit={onSubmit} className="space-y-3" noValidate>
        {fields.map((f) => (
          <Field
            key={f.name}
            id={`signup-${f.name}`}
            label={f.label}
            icon={f.icon}
            error={f.err}
            hasRightSlot={!!f.rightSlot}
            rightSlot={f.rightSlot}
            translateError={translateError}
          >
            <input
              {...register(f.name)}
              id={`signup-${f.name}`}
              type={f.type}
              autoComplete={f.autoComplete}
              disabled={isLoading}
              placeholder={f.label}
              dir={f.dir ?? "ltr"}
              className={cn(
                inputBase,
                inputFocus,
                inputHover,
                "ps-10 pe-4",
                f.rightSlot && "pe-14",
                f.err && "border-[hsl(var(--color-destructive))] focus:shadow-[0_0_0_4px_hsl(var(--color-destructive)/0.1)]"
              )}
            />
          </Field>
        ))}

        <PhoneField
          value={watch("phone") || ""}
          onChange={(val) => {
            const { ref, name, ...rest } = register("phone");
            rest.onChange({ target: { value: val, name: "phone" } });
          }}
          placeholder={st("signup.phone", "شماره تماس")}
          disabled={isLoading}
          error={errors.phone}
          translateError={translateError}
        />

        <div className="pt-2">
          <PrimaryButton isLoading={isLoading} label={st("auth.createAccount", "ایجاد حساب")} />
        </div>
      </form>

      {/* ✅ اضافه شدن pb-1 برای رفع فاصله خاکستری پایین */}
      <p className="text-center text-[11px] text-[hsl(var(--fg-secondary))] ">
        {st("auth.haveAccount", "حساب دارید؟")}{" "}
        <button
          type="button"
          onClick={onSwitchMode}
          className="text-[hsl(var(--color-primary))] hover:underline font-semibold mt-1"
        >
          {st("auth.signIn", "ورود")}
        </button>
      </p>
    </div>
  );
}

// ─── AuthShell ─────────────────────────────────────────────────────────────

interface AuthShellProps {
  flipped: boolean;
  st: SafeT;
  loginProps: LoginFormProps;
  signupProps: SignupFormProps;
  onSwitchMode: () => void;
}

export function AuthShell({
  flipped,
  st,
  loginProps,
  signupProps,
  onSwitchMode,
}: AuthShellProps) {
  return (
    <div className="relative min-h-screen flex flex-col lg:flex-row overflow-hidden bg-[hsl(var(--surface-base))]" dir="rtl">
      {/* Left Panel - Workspace Preview */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center overflow-hidden">
        <div className="absolute inset-0 grid-drift" />
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute w-[620px] h-[620px] bg-[hsl(var(--color-primary)/0.1)] blur-[140px] rounded-full top-[5%] end-[-120px]" />
          <div className="absolute w-[520px] h-[520px] bg-[hsl(195_90%_50%/0.08)] blur-[140px] rounded-full bottom-[5%] start-[-120px]" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--surface-base)/0.6)] via-transparent to-[hsl(var(--surface-base)/0.2)] pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center px-8 xl:px-12 py-10 w-full max-w-lg">
          <WorkspacePreview st={st} />
          <p className="text-xs text-[hsl(var(--fg-secondary))] leading-relaxed mt-6 max-w-sm text-center">
            {st("auth.tagline", "همه چیز در یک سامانه")}
          </p>
        </div>
      </div>

      {/* Mobile Brand Bar */}
      <div className="lg:hidden relative z-10 flex items-center justify-center pt-8 pb-2 px-6">
        <div className="flex items-center gap-2.5">
          <BrandLogo size="sm" st={st} />
          <div className="text-end">
            <div className="text-sm font-bold text-[hsl(var(--fg-primary))] leading-tight">
              {st("auth.brandTitle", "حسابچه")}
            </div>
            <div className="text-[10px] text-[hsl(var(--fg-tertiary))]">
              {st("auth.brandSubMobile", "مدیریت مالی هوشمند")}
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Auth Forms */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 relative">
        <div className="lg:hidden absolute inset-0 pointer-events-none">
          <div className="absolute w-[380px] h-[380px] bg-[hsl(var(--color-primary)/0.08)] blur-[100px] rounded-full top-[-100px] end-[-100px]" />
          <div className="absolute w-[380px] h-[380px] bg-[hsl(195_90%_50%/0.08)] blur-[100px] rounded-full bottom-[-100px] start-[-100px]" />
          <div className="absolute inset-0 grid-drift opacity-30" />
        </div>

        <div className="relative w-full max-w-md flip-perspective">
          <div className={cn("flip-inner", flipped && "is-flipped")}>
            <div className="flip-face flip-front">
              <LoginForm {...loginProps} onSwitchMode={onSwitchMode} />
            </div>
            <div className="flip-face flip-back">
              <SignupForm {...signupProps} onSwitchMode={onSwitchMode} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}