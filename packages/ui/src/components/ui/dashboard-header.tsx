"use client"

import { useCallback } from "react"
import { useTranslation } from "react-i18next"
import { useThemeStore } from "@hisabche/store"
import { changeLanguage, type SupportedLanguage } from "@hisabche/i18n"

// ─── SVG Icons ─────────────────────────────────────────
const SvgIcon = ({ d, size = 16 }: { d: React.ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none"
       stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">{d}</svg>
)

const IconGlobe  = <SvgIcon d={<g><circle cx="8" cy="8" r="6"/><path d="M2 8h12M8 2c1.8 2 1.8 10 0 12M8 2c-1.8 2-1.8 10 0 12"/></g>} />
const IconSun    = <SvgIcon d={<g><circle cx="8" cy="8" r="2.6"/><path d="M8 1.2v1.6M8 13.2v1.6M1.2 8h1.6M13.2 8h1.6M3.2 3.2l1.1 1.1M11.7 11.7l1.1 1.1M3.2 12.8l1.1-1.1M11.7 4.3l1.1-1.1"/></g>} />
const IconMoon   = <SvgIcon d="M13.2 9.4A5.4 5.4 0 0 1 6.6 2.8a5.4 5.4 0 1 0 6.6 6.6Z" />
const IconLogout = <SvgIcon d={<g><path d="M9.5 2H3.5v12h6"/><path d="M11 5.5 13.5 8 11 10.5M6.5 8h7"/></g>} />

// ─── Brand Mark ────────────────────────────────────────
function BrandMark() {
  return (
    <div className="w-7 h-7 xs:w-8 xs:h-8 rounded-lg bg-[var(--hisab-primary)] flex items-center justify-center shrink-0">
      <span className="text-white font-bold text-[10px] xs:text-xs">ح</span>
    </div>
  )
}

// ─── Sync Pill ─────────────────────────────────────────
function SyncPill({ lastSyncedAt, isOnline, isSyncing, pendingCount }: {
  lastSyncedAt: number | null; isOnline: boolean; isSyncing: boolean; pendingCount: number
}) {
  if (!isOnline) return <span className="sync-pill off">● آفلاین</span>
  if (isSyncing) return <span className="sync-pill syncing">◉ همگام‌سازی{pendingCount > 0 ? ` · ${pendingCount}` : ""}</span>
  if (lastSyncedAt) {
    const s = Math.floor((Date.now() - lastSyncedAt) / 1000)
    return <span className="sync-pill ok">● {s < 60 ? "لحظاتی پیش" : `${Math.floor(s / 60)} دقیقه پیش`}</span>
  }
  return null
}

// ─── DashboardHeader ────────────────────────────────────
interface DashboardHeaderProps {
  businessName?: string
  lastSyncedAt: number | null
  isOnline: boolean
  isSyncing: boolean
  pendingCount: number
  currentLang: string
  onLogout: () => void | Promise<void>
}

export function DashboardHeader({
  businessName, lastSyncedAt, isOnline, isSyncing, pendingCount, currentLang, onLogout,
}: DashboardHeaderProps) {
  const { t } = useTranslation()
  const { isDark, toggle } = useThemeStore()

  const toggleLang = useCallback(() => {
    changeLanguage((currentLang === "fa-AF" ? "fa-IR" : "fa-AF") as SupportedLanguage)
  }, [currentLang])

  return (
    <header className="dh border-b border-[var(--hisab-border)] backdrop-blur-lg ">
      <div className="dh-inner border-b border-[var(--hisab-border)]">
        {/* Left */}
        <div className="dh-left">
          <BrandMark />
          <div className="dh-brand-text">
            
            {businessName && <span className="dh-context">{businessName}</span>}
          </div>
          <span className="dh-sep" />
          <SyncPill lastSyncedAt={lastSyncedAt} isOnline={isOnline} isSyncing={isSyncing} pendingCount={pendingCount} />
        </div>

        {/* Right */}
        <div className="dh-right">
          <button type="button" onClick={toggleLang} aria-label="تغییر زبان" className="ghost-btn">
            {IconGlobe}
            <span className="lang-pill">{currentLang === "fa-AF" ? "FA" : "IR"}</span>
          </button>

          <button type="button" onClick={toggle} aria-label={isDark ? "حالت روشن" : "حالت تاریک"} className="ghost-btn">
            {isDark ? IconSun : IconMoon}
          </button>

          <button type="button" onClick={onLogout} aria-label="خروج" className="ghost-btn ghost-danger">
            {IconLogout}
            <span className="hidden lg:inline text-[11px] xs:text-xs">{t("auth.signOut")}</span>
          </button>
        </div>
      </div>
    </header>
  )
}