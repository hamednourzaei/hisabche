'use client'

import { memo, useState, useEffect, useRef } from 'react'
import { cn } from '../../lib/utils'
import { NotificationBell } from './notification-bell'
import { useTranslations } from 'next-intl'

/* ═══════════════════════════════════════════════════════════════════════════
   DashboardHeader v5 — Memoized · Performance Optimized
   ✅ memo برای همه کامپوننت‌ها
   ═══════════════════════════════════════════════════════════════════════════ */

const SvgIcon = ({ d, size = 16 }: { d: React.ReactNode; size?: number }) => (
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
)

const IconSun = (
  <SvgIcon
    d={
      <g>
        <circle cx="8" cy="8" r="2.6" />
        <path d="M8 1.2v1.6M8 13.2v1.6M1.2 8h1.6M13.2 8h1.6M3.2 3.2l1.1 1.1M11.7 11.7l1.1 1.1M3.2 12.8l1.1-1.1M11.7 4.3l1.1-1.1" />
      </g>
    }
  />
)
const IconMoon = <SvgIcon d="M13.2 9.4A5.4 5.4 0 0 1 6.6 2.8a5.4 5.4 0 1 0 6.6 6.6Z" />
const IconLogout = (
  <SvgIcon
    d={
      <g>
        <path d="M9.5 2H3.5v12h6" />
        <path d="M11 5.5 13.5 8 11 10.5M6.5 8h7" />
      </g>
    }
  />
)

/**
 * The product mark.
 *
 * The same `/logo-icon.png` the sidebar shows, not a letter tile. Two marks
 * for one product read as two products, and the tile was a placeholder that
 * outlived the real logo. `onError` falls back to the tile so a missing file
 * degrades to the old look instead of a broken-image icon.
 */
const BrandMark = memo(function BrandMark({ alt }: { alt: string }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--gradient-brand)]">
        <span className="text-xs font-bold text-white">ح</span>
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo-icon.png"
      alt={alt}
      onError={() => setFailed(true)}
      className="h-8 w-8 shrink-0 object-contain"
    />
  )
})
BrandMark.displayName = 'BrandMark'

// ✅ SyncPill با memo
const SyncPill = memo(function SyncPill({
  lastSyncedAt,
  isOnline,
  isSyncing,
  pendingCount,
  t,
}: {
  lastSyncedAt: number | null
  isOnline: boolean
  isSyncing: boolean
  pendingCount: number
  t: (key: string) => string
}) {
  if (!isOnline) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
          'bg-[hsl(var(--color-warning)/0.12)] text-[hsl(var(--color-warning))]',
          'border border-[hsl(var(--color-warning)/0.2)]',
        )}
      >
        <span className="size-1.5 rounded-full bg-[hsl(var(--color-warning))]" aria-hidden="true" />
        {t('sync.offline')}
      </span>
    )
  }
  if (isSyncing) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
          'bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))]',
          'border border-[hsl(var(--color-primary)/0.2)]',
        )}
      >
        <span
          className="size-1.5 rounded-full bg-[hsl(var(--color-primary))] animate-pulse"
          aria-hidden="true"
        />
        {t('sync.syncing')}
        {pendingCount > 0 ? ` · ${pendingCount}` : ''}
      </span>
    )
  }
  if (lastSyncedAt) {
    const s = Math.floor((Date.now() - lastSyncedAt) / 1000)
    const label =
      s < 60 ? t('sync.justNow') : t('sync.minutesAgo').replace('{m}', String(Math.floor(s / 60)))
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
          'bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]',
          'border border-[hsl(var(--color-success)/0.2)]',
        )}
      >
        <span className="size-1.5 rounded-full bg-[hsl(var(--color-success))]" aria-hidden="true" />
        {label}
      </span>
    )
  }
  return null
})
SyncPill.displayName = 'SyncPill'

const LANGUAGES = [
  { code: 'af', label: 'دری', nativeLabel: 'دری', flag: '🇦🇫' },
  { code: 'fa', label: 'فارسی', nativeLabel: 'فارسی', flag: '🇮🇷' },
  { code: 'en', label: 'English', nativeLabel: 'English', flag: '🇬🇧' },
]

// ✅ LanguageSelect با memo
const LanguageSelect = memo(function LanguageSelect({
  currentLang,
  onChange,
}: {
  currentLang: string
  onChange: (lang: string) => void
}) {
  const t = useTranslations()
  const [isOpen, setIsOpen] = useState(false)
  const selected = LANGUAGES.find((l) => l.code === currentLang) ?? LANGUAGES[0]
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={t('settings.changeLanguage')}
        className={cn(
          'inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5',
          'text-[11px] font-medium',
          'bg-[hsl(var(--surface-muted)/0.5)]',
          'text-[hsl(var(--fg-secondary))]',
          'border border-[hsl(var(--border-default))]',
          'hover:border-[hsl(var(--color-primary)/0.3)]',
          'hover:bg-[hsl(var(--surface-muted))]',
          'transition-all duration-150',
          'motion-reduce:transition-none',
        )}
      >
        <span className="text-sm">{selected?.flag ?? '🌐'}</span>
        <span className="hidden sm:inline">{selected?.nativeLabel ?? t('settings.language')}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn('transition-transform duration-150', isOpen && 'rotate-180')}
        >
          <path d="M2.5 4.5L6 8L9.5 4.5" />
        </svg>
      </button>
      {isOpen && (
        <div
          className={cn(
            'absolute left-0 top-full z-50 mt-1.5 min-w-[140px] overflow-hidden',
            'rounded-xl border border-[hsl(var(--border-default))]',
            'bg-[hsl(var(--surface-elevated))]',
            'shadow-lg shadow-[hsl(var(--surface-base)/0.3)]',
            'animate-fade-in-up',
          )}
        >
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => {
                onChange(lang.code)
                setIsOpen(false)
              }}
              className={cn(
                'flex w-full items-center gap-3 px-3.5 py-2.5 text-xs',
                'transition-colors duration-100',
                'hover:bg-[hsl(var(--surface-muted))]',
                lang.code === currentLang && 'bg-[hsl(var(--color-primary)/0.08)]',
                'text-[hsl(var(--fg-primary))]',
              )}
            >
              <span className="text-base">{lang.flag}</span>
              <span>{lang.nativeLabel}</span>
              {lang.code === currentLang && (
                <span className="mr-auto text-[hsl(var(--color-primary))]">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="3 8 6.5 11.5 13 5" />
                  </svg>
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
})
LanguageSelect.displayName = 'LanguageSelect'

interface HeaderProps {
  variant?: 'landing' | 'dashboard'
  appName: string
  lastSyncedAt?: number | null
  isOnline?: boolean
  isSyncing?: boolean
  pendingCount?: number
  currentLang?: string
  isDark?: boolean
  signInLabel: string
  signOutLabel: string
  onToggleTheme: () => void
  onToggleLang: (lang: string) => void
  /** جستجوی سراسری — کنار انتخاب زبان رندر می‌شود. */
  searchSlot?: React.ReactNode
  onLogout?: () => void
  onNavigateLogin: () => void
}

// ✅ DashboardHeader با memo
export const DashboardHeader = memo(function DashboardHeader({
  variant = 'dashboard',
  appName,
  lastSyncedAt = null,
  isOnline = true,
  isSyncing = false,
  pendingCount = 0,
  currentLang = 'AF',
  isDark = false,
  signInLabel,
  signOutLabel,
  onToggleTheme,
  onToggleLang,
  onLogout,
  onNavigateLogin,
  searchSlot,
}: HeaderProps) {
  const t = useTranslations()

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full',
        'border-b border-[hsl(var(--border-default))]',
        'bg-[hsl(var(--surface-base)/0.7)] backdrop-blur-xl',
        'motion-reduce:backdrop-blur-none',
      )}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-14">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <BrandMark alt={appName} />
          {variant === 'dashboard' && (
            <>
              <div className="hidden min-w-0 flex-col sm:flex">
                <span className="truncate text-sm font-bold text-[hsl(var(--fg-primary))]">
                  {appName}
                </span>
              </div>
              <span className="mx-1 hidden h-6 w-px bg-[hsl(var(--border-default))] sm:block" />
              <SyncPill
                lastSyncedAt={lastSyncedAt}
                isOnline={isOnline}
                isSyncing={isSyncing}
                pendingCount={pendingCount}
                t={t}
              />
            </>
          )}
          {variant === 'landing' && (
            <span className="text-sm font-bold text-[hsl(var(--fg-primary))]">{appName}</span>
          )}
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          {searchSlot}
          <LanguageSelect currentLang={currentLang} onChange={onToggleLang} />
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? t('settings.lightMode') : t('settings.darkMode')}
            className={cn(
              'inline-flex items-center rounded-lg p-1.5',
              // آیکون در هر دو تم زرد کهربایی می‌ماند — قبلاً در حالت لایت
              // خاکستری می‌شد و بین بقیه‌ی آیکون‌ها گم بود.
              'text-[hsl(var(--color-warning))]',
              'hover:bg-[hsl(var(--surface-muted))]',
              'transition-colors duration-150',
              'motion-reduce:transition-none',
            )}
          >
            {isDark ? IconSun : IconMoon}
          </button>
          {variant === 'dashboard' && <NotificationBell />}
          {variant === 'dashboard' && (
            <button
              type="button"
              onClick={onLogout}
              aria-label={t('auth.signOut')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5',
                'text-[hsl(var(--fg-secondary))]',
                'hover:bg-[hsl(var(--color-destructive)/0.1)] hover:text-[hsl(var(--color-destructive))]',
                'transition-colors duration-150',
                'motion-reduce:transition-none',
              )}
            >
              {IconLogout}
              <span className="hidden text-[11px] lg:inline">{signOutLabel}</span>
            </button>
          )}
          {variant === 'landing' && (
            <button
              type="button"
              onClick={onNavigateLogin}
              className={cn(
                'rounded-full px-4 py-2',
                'text-xs font-bold text-white',
                'bg-[var(--gradient-brand)]',
                'transition-all duration-200',
                'hover:brightness-110',
                'active:scale-95',
                'motion-reduce:transition-none',
              )}
            >
              {signInLabel}
            </button>
          )}
        </div>
      </div>
    </header>
  )
})

DashboardHeader.displayName = 'DashboardHeader'
