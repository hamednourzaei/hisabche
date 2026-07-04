"use client";

import { cn } from "@/lib/utils";
import { NotificationBell } from "./notification-bell";
/* ═══════════════════════════════════════════════════════════════════════════
   DashboardHeader v2 — Hisabche Design Language
   Zero hardcoded colors — all tokens from design system
   Zero inline styles — all Tailwind classes
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── SVG Icons ─────────────────────────────────────────────────────────────

const SvgIcon = ({
  d,
  size = 16,
}: {
  d: React.ReactNode;
  size?: number;
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {d}
  </svg>
);

const IconGlobe = (
  <SvgIcon
    d={
      <g>
        <circle cx="8" cy="8" r="6" />
        <path d="M2 8h12M8 2c1.8 2 1.8 10 0 12M8 2c-1.8 2-1.8 10 0 12" />
      </g>
    }
  />
);

const IconSun = (
  <SvgIcon
    d={
      <g>
        <circle cx="8" cy="8" r="2.6" />
        <path d="M8 1.2v1.6M8 13.2v1.6M1.2 8h1.6M13.2 8h1.6M3.2 3.2l1.1 1.1M11.7 11.7l1.1 1.1M3.2 12.8l1.1-1.1M11.7 4.3l1.1-1.1" />
      </g>
    }
  />
);

const IconMoon = (
  <SvgIcon d="M13.2 9.4A5.4 5.4 0 0 1 6.6 2.8a5.4 5.4 0 1 0 6.6 6.6Z" />
);

const IconLogout = (
  <SvgIcon
    d={
      <g>
        <path d="M9.5 2H3.5v12h6" />
        <path d="M11 5.5 13.5 8 11 10.5M6.5 8h7" />
      </g>
    }
  />
);

// ─── Brand Mark ────────────────────────────────────────────────────────────

function BrandMark() {
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--gradient-brand)] xs:h-8 xs:w-8">
      <span className="text-[10px] font-bold text-white xs:text-xs">ح</span>
    </div>
  );
}

// ─── Sync Pill ─────────────────────────────────────────────────────────────

function SyncPill({
  lastSyncedAt,
  isOnline,
  isSyncing,
  pendingCount,
}: {
  lastSyncedAt: number | null;
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
}) {
  if (!isOnline) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
          "bg-[hsl(var(--color-warning)/0.12)] text-[hsl(var(--color-warning))]",
          "border border-[hsl(var(--color-warning)/0.2)]",
        )}
      >
        <span className="size-1.5 rounded-full bg-[hsl(var(--color-warning))]" aria-hidden="true" />
        آفلاین
      </span>
    );
  }

  if (isSyncing) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
          "bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))]",
          "border border-[hsl(var(--color-primary)/0.2)]",
        )}
      >
        <span className="size-1.5 rounded-full bg-[hsl(var(--color-primary))] animate-pulse" aria-hidden="true" />
        همگام‌سازی
        {pendingCount > 0 ? ` · ${pendingCount}` : ""}
      </span>
    );
  }

  if (lastSyncedAt) {
    const s = Math.floor((Date.now() - lastSyncedAt) / 1000);
    const label = s < 60 ? "لحظاتی پیش" : `${Math.floor(s / 60)} دقیقه پیش`;

    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
          "bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]",
          "border border-[hsl(var(--color-success)/0.2)]",
        )}
      >
        <span className="size-1.5 rounded-full bg-[hsl(var(--color-success))]" aria-hidden="true" />
        {label}
      </span>
    );
  }

  return null;
}

// ─── Header ────────────────────────────────────────────────────────────────

interface HeaderProps {
  variant?: "landing" | "dashboard";
  appName: string;
  businessName?: string;
  lastSyncedAt?: number | null;
  isOnline?: boolean;
  isSyncing?: boolean;
  pendingCount?: number;
  currentLang?: string;
  isDark?: boolean;
  signInLabel: string;
  signOutLabel: string;
  onToggleTheme: () => void;
  onToggleLang: () => void;
  onLogout?: () => void;
  onNavigateLogin: () => void;
}

export function DashboardHeader({
  variant = "dashboard",
  appName,
  businessName,
  lastSyncedAt = null,
  isOnline = true,
  isSyncing = false,
  pendingCount = 0,
  currentLang = "fa-AF",
  isDark = false,
  signInLabel,
  signOutLabel,
  onToggleTheme,
  onToggleLang,
  onLogout,
  onNavigateLogin,
}: HeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full",
        "border-b border-[hsl(var(--border-default))]",
        "bg-[hsl(var(--surface-base)/0.7)] backdrop-blur-xl",
        "motion-reduce:backdrop-blur-none",
      )}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-14">
        {/* Start: Brand + Info */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <BrandMark />

          {variant === "dashboard" && (
            <>
              <div className="hidden min-w-0 flex-col sm:flex">
                <span className="truncate text-sm font-bold text-[hsl(var(--fg-primary))]">
                  {appName}
                </span>
                {businessName && (
                  <span className="truncate text-[10px] text-[hsl(var(--fg-tertiary))]">
                    {businessName}
                  </span>
                )}
              </div>
              <span className="mx-1 hidden h-6 w-px bg-[hsl(var(--border-default))] sm:block" />
              <SyncPill
                lastSyncedAt={lastSyncedAt}
                isOnline={isOnline}
                isSyncing={isSyncing}
                pendingCount={pendingCount}
              />
            </>
          )}

          {variant === "landing" && (
            <span className="text-sm font-bold text-[hsl(var(--fg-primary))]">
              {appName}
            </span>
          )}
        </div>

        {/* End: Actions */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Language Toggle */}
          <button
            type="button"
            onClick={onToggleLang}
            aria-label="تغییر زبان"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5",
              "text-[hsl(var(--fg-secondary))]",
              "hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]",
              "transition-colors duration-150",
              "motion-reduce:transition-none",
            )}
          >
            {IconGlobe}
            <span className="hidden sm:inline text-[11px] font-medium">
              {currentLang === "fa-AF" ? "FA" : "IR"}
            </span>
          </button>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? "حالت روشن" : "حالت تاریک"}
            className={cn(
              "inline-flex items-center rounded-lg p-1.5",
              isDark
                ? "text-[hsl(var(--color-warning))]"
                : "text-[hsl(var(--fg-secondary))]",
              "hover:bg-[hsl(var(--surface-muted))]",
              "transition-colors duration-150",
              "motion-reduce:transition-none",
            )}
          >
            {isDark ? IconSun : IconMoon}
          </button>
{variant === "dashboard" && <NotificationBell />}
          {/* Logout (dashboard) */}
          {variant === "dashboard" && (
            <button
              type="button"
              onClick={onLogout}
              aria-label="خروج"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5",
                "text-[hsl(var(--fg-secondary))]",
                "hover:bg-[hsl(var(--color-destructive)/0.1)] hover:text-[hsl(var(--color-destructive))]",
                "transition-colors duration-150",
                "motion-reduce:transition-none",
              )}
            >
              
              {IconLogout}
              <span className="hidden text-[11px] lg:inline">
                {signOutLabel}
              </span>
            </button>
          )}

          {/* Login CTA (landing) */}
          {variant === "landing" && (
            <button
              type="button"
              onClick={onNavigateLogin}
              className={cn(
                "rounded-full px-4 py-2",
                "text-xs font-bold text-white",
                "bg-[var(--gradient-brand)]",
                "transition-all duration-200",
                "hover:brightness-110",
                "active:scale-95",
                "motion-reduce:transition-none",
              )}
            >
              {signInLabel}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}