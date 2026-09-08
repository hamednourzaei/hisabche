'use client'

import { memo, useState, useEffect, useRef, useSyncExternalStore } from 'react'
import { cn } from '../../lib/utils'
import { ChevronDown } from 'lucide-react'
import { NotificationBell } from './notification-bell'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu'
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
/**
 * A subscription that never fires.
 *
 * `useSyncExternalStore` needs one, and "has the client mounted yet" never
 * changes after it flips. Module-level so the identity is stable: a new
 * function on each render would make the hook resubscribe every time.
 */
const subscribeToNothing = () => () => {}

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
  // True only after the first client render. `useSyncExternalStore` is the
  // sanctioned way to ask this: it returns the server snapshot during SSR and
  // the client snapshot afterwards, with no effect and no extra render pass.
  const mounted = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  )

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
  // ⚠️ Nothing time-relative renders before hydration.
  //
  // `Date.now()` during render is a hydration mismatch waiting to happen: the
  // server renders "just now", the client renders a fraction of a second later
  // and may produce "1 minute ago". React sees two different strings for the
  // same node and throws #418 — `args[]=text`, a TEXT mismatch, which is
  // exactly what the production console reported.
  //
  // Returning null until mounted means the server and the first client render
  // agree (both empty), and the pill appears on the second render with a value
  // computed entirely on the client. A shifting timestamp is client state; it
  // was never server-renderable.
  if (lastSyncedAt && mounted) {
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
  /**
   * What the app calls itself under its own name — «پنل مدیریت».
   *
   * A separate prop rather than a literal because the header is rendered by
   * web, desktop and the docs shell, and this package holds no strings.
   */
  // `| undefined` throughout this block: `exactOptionalPropertyTypes` is on,
  // so `prop?: string` REJECTS an explicitly-passed `undefined` — and every
  // one of these is passed as `value || undefined` by the caller, which is
  // how it says «there is no business name» rather than inventing one.
  appSubtitle?: string | undefined
  /** The business, from real data. Absent means it is not known — not «—». */
  organizationName?: string | undefined
  /** The signed-in person's address, shown in the account menu. */
  userEmail?: string | undefined
  userName?: string | undefined
  /**
   * People in this workspace, for the organization menu.
   *
   * ⚠️ NOT A PERMISSION CHECK. Passing an empty list is what hides the list;
   * the caller decides who may see it, and the SERVER decides who may fetch
   * it. A header is never a security boundary — see `packages/ui`'s rule that
   * the workspace is the only boundary and it is enforced server-side.
   */
  organizationMembers?: { id: string; name: string; role?: string }[] | undefined
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

/** Initials for an avatar, from whatever identity is actually known. */
function initialsOf(name?: string, email?: string): string {
  const source = (name ?? '').trim() || (email ?? '').trim()
  if (!source) return '؟'
  // An email has no meaningful second word — «h.nourzaei@gmail.com» would give
  // «HG» from the domain, which names nothing.
  if (!name?.trim() && source.includes('@')) return source[0]!.toUpperCase()
  const parts = source.split(/\s+/).filter(Boolean)
  return parts
    .slice(0, 2)
    .map((part) => part[0]!)
    .join('')
    .toUpperCase()
}

/**
 * «سازمان: نام شرکت», and the people in it.
 *
 * ⚠️ THE LIST IS NOT AN ACCESS CONTROL. It renders whatever `members` holds;
 * an empty list simply shows the organization name with no menu. Who is
 * allowed to READ that list is decided by the endpoint that produces it, on
 * the server, where it cannot be bypassed by opening devtools. A header that
 * hides a control is a courtesy, never a boundary.
 */
const OrganizationMenu = memo(function OrganizationMenu({
  organizationName,
  members,
  t,
}: {
  organizationName: string
  members: { id: string; name: string; role?: string }[]
  t: (key: string) => string
}) {
  const label = (
    <>
      <span className="hidden text-[hsl(var(--fg-tertiary))] sm:inline">
        {t('nav.organization')}
      </span>
      <span className="truncate font-medium text-[hsl(var(--fg-primary))]">{organizationName}</span>
    </>
  )

  const shell = cn(
    'inline-flex h-9 max-w-[10rem] items-center gap-1.5 rounded-xl px-2.5 text-xs',
    'border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]',
    'transition-colors motion-reduce:transition-none',
  )

  // Nothing to open. A dropdown arrow on a menu with no items is a promise the
  // control cannot keep, so it is not rendered.
  if (members.length === 0) {
    return <div className={shell}>{label}</div>
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          shell,
          'hover:border-[hsl(var(--border-strong))] hover:bg-[hsl(var(--surface-muted))]',
        )}
      >
        {label}
        <ChevronDown
          className="size-3.5 shrink-0 text-[hsl(var(--fg-tertiary))]"
          aria-hidden="true"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel>{t('nav.teamMembers')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {members.map((member) => (
          <DropdownMenuItem key={member.id} className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate">{member.name}</span>
            {member.role ? (
              <span className="shrink-0 text-[10px] text-[hsl(var(--fg-tertiary))]">
                {member.role}
              </span>
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
})
OrganizationMenu.displayName = 'OrganizationMenu'

/** The avatar, the address behind it, and sign-out. */
const AccountMenu = memo(function AccountMenu({
  userName,
  userEmail,
  signOutLabel,
  onLogout,
  t,
}: {
  // `| undefined` explicitly: `exactOptionalPropertyTypes` is on, so an
  // optional prop and a prop that may be `undefined` are different types.
  userName?: string | undefined
  userEmail?: string | undefined
  signOutLabel: string
  onLogout?: (() => void) | undefined
  t: (key: string) => string
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('nav.account')}
        className={cn(
          // 40px — a touch target, not a 24px circle.
          'flex size-10 items-center justify-center rounded-full',
          'text-xs font-semibold',
          'bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-secondary))]',
          'transition-colors hover:bg-[hsl(var(--color-primary)/0.12)]',
          'hover:text-[hsl(var(--color-primary))] motion-reduce:transition-none',
        )}
      >
        {initialsOf(userName, userEmail)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="px-2 py-1.5">
          {userName ? (
            <p className="truncate text-sm font-medium text-[hsl(var(--fg-primary))]">{userName}</p>
          ) : null}
          {userEmail ? (
            // `dir="ltr"` — an address is Latin text and renders in the wrong
            // visual order inside an RTL block.
            <p dir="ltr" className="truncate text-start text-xs text-[hsl(var(--fg-tertiary))]">
              {userEmail}
            </p>
          ) : null}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onLogout}
          className="text-[hsl(var(--color-destructive))] focus:text-[hsl(var(--color-destructive))]"
        >
          {signOutLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
})
AccountMenu.displayName = 'AccountMenu'

// ✅ DashboardHeader با memo
export const DashboardHeader = memo(function DashboardHeader({
  variant = 'dashboard',
  appName,
  appSubtitle,
  organizationName,
  userEmail,
  userName,
  organizationMembers,
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
      {/* ⚠️ THREE REGIONS, NOT TWO.
          The search used to sit in the right-hand cluster with the language,
          theme and sign-out controls, which made a five-item row where the one
          thing people reach for most was the narrowest. It is its own region
          now and takes the space that is left. `max-w-6xl` is gone with it —
          the header spans the window, because the sidebar beside it does. */}
      <div className="flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-5">
        {/* ── Identity ── */}
        <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-2.5">
          <BrandMark alt={appName} />
          {variant === 'dashboard' && (
            <>
              <div className="hidden min-w-0 flex-col leading-tight sm:flex">
                <span className="truncate text-sm font-semibold text-[hsl(var(--fg-primary))]">
                  {appName}
                </span>
                {appSubtitle ? (
                  <span className="truncate text-[11px] text-[hsl(var(--fg-tertiary))]">
                    {appSubtitle}
                  </span>
                ) : null}
              </div>

              {/* Real data only: with no business name there is no control,
                  rather than a button reading «سازمان: —». */}
              {organizationName ? (
                <OrganizationMenu
                  organizationName={organizationName}
                  members={organizationMembers ?? []}
                  t={t}
                />
              ) : null}

              <span className="mx-0.5 hidden h-6 w-px bg-[hsl(var(--border-default))] xl:block" />
              <div className="hidden xl:block">
                <SyncPill
                  lastSyncedAt={lastSyncedAt}
                  isOnline={isOnline}
                  isSyncing={isSyncing}
                  pendingCount={pendingCount}
                  t={t}
                />
              </div>
            </>
          )}
          {variant === 'landing' && (
            <span className="text-sm font-bold text-[hsl(var(--fg-primary))]">{appName}</span>
          )}
        </div>

        {/* ── Search ──
            `min-w-0` so the flex item may shrink below its content instead of
            pushing the controls off the end of a narrow window. */}
        <div className="flex min-w-0 flex-1 justify-center">{searchSlot}</div>

        {/* ── Controls ── */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
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
            /* ⚠️ SIGN-OUT IS NO LONGER A BARE BUTTON IN THE BAR.
               It sat one mis-aimed click from the theme toggle, with only an
               icon and a label that appeared at `lg`. Behind the avatar it
               takes a deliberate two steps, and the menu is also where the
               signed-in address belongs — there was previously nowhere at all
               to see which account you were in. */
            <AccountMenu
              userName={userName}
              userEmail={userEmail}
              signOutLabel={signOutLabel}
              onLogout={onLogout}
              t={t}
            />
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
