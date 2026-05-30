"use client"

const SvgIcon = ({ d, size = 16 }: { d: React.ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none"
       stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">{d}</svg>
)

const IconGlobe  = <SvgIcon d={<g><circle cx="8" cy="8" r="6"/><path d="M2 8h12M8 2c1.8 2 1.8 10 0 12M8 2c-1.8 2-1.8 10 0 12"/></g>} />
const IconSun    = <SvgIcon d={<g><circle cx="8" cy="8" r="2.6"/><path d="M8 1.2v1.6M8 13.2v1.6M1.2 8h1.6M13.2 8h1.6M3.2 3.2l1.1 1.1M11.7 11.7l1.1 1.1M3.2 12.8l1.1-1.1M11.7 4.3l1.1-1.1"/></g>} />
const IconMoon   = <SvgIcon d="M13.2 9.4A5.4 5.4 0 0 1 6.6 2.8a5.4 5.4 0 1 0 6.6 6.6Z" />
const IconLogout = <SvgIcon d={<g><path d="M9.5 2H3.5v12h6"/><path d="M11 5.5 13.5 8 11 10.5M6.5 8h7"/></g>} />

function BrandMark() {
  return (
    <div className="w-7 h-7 xs:w-8 xs:h-8 rounded-lg bg-[var(--hisab-primary)] flex items-center justify-center shrink-0">
      <span className="text-white font-bold text-[10px] xs:text-xs">ح</span>
    </div>
  )
}

function SyncPill({ lastSyncedAt, isOnline, isSyncing, pendingCount }: {
  lastSyncedAt: number | null; isOnline: boolean; isSyncing: boolean; pendingCount: number
}) {
  if (!isOnline) return <span className="sync-pill off">● آفلاین</span>
  if (isSyncing) return <span className="sync-pill syncing">● همگام‌سازی{pendingCount > 0 ? ` · ${pendingCount}` : ""}</span>
  if (lastSyncedAt) {
    const s = Math.floor((Date.now() - lastSyncedAt) / 1000)
    return <span className="sync-pill ok">● {s < 60 ? "لحظاتی پیش" : `${Math.floor(s / 60)} دقیقه پیش`}</span>
  }
  return null
}

interface HeaderProps {
  variant?: "landing" | "dashboard"
  appName: string
  businessName?: string
  lastSyncedAt?: number | null
  isOnline?: boolean
  isSyncing?: boolean
  pendingCount?: number
  currentLang?: string
  isDark?: boolean
  signInLabel: string
  signOutLabel: string
  onToggleTheme: () => void
  onToggleLang: () => void
  onLogout?: () => void
  onNavigateLogin: () => void
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
    <header className="sticky top-0 z-50 w-full border-b border-[var(--hisab-border)] bg-[var(--hisab-background)]/70 backdrop-blur-xl">
      <div className="mx-auto flex h-12 sm:h-14 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <BrandMark />
          {variant === "dashboard" && (
            <>
              <div className="hidden sm:flex flex-col min-w-0">
                <span className="text-sm font-bold text-[var(--hisab-foreground)] truncate">{appName}</span>
                {businessName && <span className="text-[10px] text-[var(--hisab-muted-fg)] truncate">{businessName}</span>}
              </div>
              <span className="hidden sm:block w-px h-6 bg-[var(--hisab-border)] mx-1" />
              <SyncPill lastSyncedAt={lastSyncedAt} isOnline={isOnline} isSyncing={isSyncing} pendingCount={pendingCount} />
            </>
          )}
          {variant === "landing" && (
            <span className="font-bold text-sm text-[var(--hisab-foreground)]">{appName}</span>
          )}
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          {variant === "dashboard" && (
            <>
              <button
                type="button"
                onClick={onToggleLang}
                aria-label="تغییر زبان"
                className="ghost-btn"
              >
                {IconGlobe}
                <span className="lang-pill hidden sm:inline">{currentLang === "fa-AF" ? "FA" : "IR"}</span>
              </button>
              <button
                type="button"
                onClick={onToggleTheme}
                aria-label={isDark ? "حالت روشن" : "حالت تاریک"}
                className="ghost-btn"
              >
                {isDark ? IconSun : IconMoon}
              </button>
              <button type="button" onClick={onLogout} aria-label="خروج" className="ghost-btn ghost-danger">
                {IconLogout}
                <span className="hidden lg:inline text-[11px]">{signOutLabel}</span>
              </button>
            </>
          )}
          {variant === "landing" && (
            <>
              <button
                type="button"
                onClick={onToggleLang}
                aria-label="تغییر زبان"
                className="ghost-btn"
              >
                {IconGlobe}
                <span className="lang-pill hidden sm:inline">{currentLang === "fa-AF" ? "FA" : "IR"}</span>
              </button>
              <button
  type="button"
  onClick={onToggleTheme}
  aria-label={isDark ? "حالت روشن" : "حالت تاریک"}
  className="ghost-btn"
>
  <span style={{ color: isDark ? '#fbbf24' : '#475569', display: 'inline-flex' }}>
    {isDark ? IconSun : IconMoon}
  </span>
</button>
              <button onClick={onNavigateLogin}
                className="rounded-lg bg-[var(--hisab-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--hisab-primary)]/90 transition-all active:scale-95">
                {signInLabel}
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}