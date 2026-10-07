'use client'

import { memo, useState, useEffect, useRef, useSyncExternalStore } from 'react'
import { cn } from '../../lib/utils'
import { roleTone } from '../../lib/role-tone'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { BrandMark } from './brand-mark'
import { NotificationBell } from './notification-bell'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
// ⚠️ `d` here is the svg's CHILDREN, not a path string. The moon was passed
// the bare string, which renders as an invisible text node inside `<svg>` —
// in light mode the theme button was an empty square.
const IconMoon = <SvgIcon d={<path d="M13.2 9.4A5.4 5.4 0 0 1 6.6 2.8a5.4 5.4 0 1 0 6.6 6.6Z" />} />

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
    // eslint-disable-next-line react-hooks/purity
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
            'absolute start-0 top-full z-50 mt-1.5 min-w-[140px] overflow-hidden',
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
                <span className="ms-auto text-[hsl(var(--color-primary))]">
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
  /**
   * The signed-in person's workspace role, used ONLY to colour `appSubtitle`
   * and to label it.
   *
   * ⚠️ IT AUTHORIZES NOTHING. `null`/absent means «not known» or «not
   * unambiguous» (several memberships) — never «no role» — and the label is
   * simply left uncoloured. Every actual permission is decided server-side
   * from the workspace the request names; a role that travelled to a browser
   * is a value the browser can edit.
   */
  role?: string | null | undefined
  /** Localized name for `role`, e.g. «مالک». The package holds no strings. */
  roleLabel?: string | undefined
  /** The signed-in person's address, shown in the account menu. */
  userEmail?: string | undefined
  userName?: string | undefined
  /**
   * Collapse/expand the sidebar. Both are passed together or neither: without
   * a handler the control is not rendered, rather than rendered inert.
   */
  isSidebarCollapsed?: boolean | undefined
  onToggleSidebar?: (() => void) | undefined
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
  /**
   * The workspace's people, me FIRST — the caller decides the order because
   * it is the caller that knows which user is signed in.
   */
  people?: readonly HeaderPerson[] | undefined
  /** The server's `people.presence.read`. Absent means the list is withheld. */
  canSeePeople?: boolean | undefined
  isLoadingPeople?: boolean | undefined
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
 * ⚠️ THE «سازمان: …» CHIP USED TO BE HERE, AND IT IS GONE ON PURPOSE.
 *
 * It repeated the business name that the sidebar already shows, next to a
 * dropdown of team members that NO CALLER EVER PASSED — so in practice it was
 * a bordered box restating one word, taking the widest slot in the header from
 * the search. The account menu beside it already answers «who am I, and how do
 * I sign out», which is what people opened it for.
 */

/**
 * Per-role colour for the «پنل مدیریت» label.
 *
 * The map itself moved to `lib/role-tone.ts` when the recent-activities feed
 * needed the same colours: two copies of a palette drift, and the same person
 * ends up two colours on one screen.
 */

/**
 * What the app calls itself here, tinted by who is looking at it.
 *
 * ⚠️ AN UNKNOWN ROLE IS UNCOLOURED, NOT «viewer». Falling back to the lowest
 * role would read as a statement about the account — someone with full access
 * would see themselves described as view-only while the role was still
 * loading. No colour says «not known», which is the truth.
 */
export interface HeaderPerson {
  /** The auth user id — what presence is keyed by. */
  userId: string | null
  name: string
  email?: string | undefined
  roleLabel?: string | undefined
  /** True only while a socket of theirs is open. */
  isOnline: boolean
  /** ISO time they came online; absent when they are not. */
  onlineSince?: string | undefined
}

/**
 * The identity pill, and everything behind it.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ ONE MENU, NOT TWO.
 *
 * Sign-out used to live behind a separate avatar at the other end of the bar,
 * so the header had two places that were both «you»: this pill said which role
 * you had, the avatar said which account you were in, and neither mentioned
 * the other. They are merged here on the owner's instruction — the pill opens
 * the menu, and the avatar is gone.
 *
 * ⚠️ THE ROSTER IS A PERMISSION, AND ITS ABSENCE IS EXPLAINED.
 *
 * `canSeePeople` is the server's `people.presence.read`. Without it the menu
 * still works — it is where sign-out is — and simply says the list is not
 * available, rather than rendering an empty section that reads as «nobody is
 * online».
 */
const IdentityMenu = memo(function IdentityMenu({
  subtitle,
  role,
  roleLabel,
  userName,
  userEmail,
  signOutLabel,
  onLogout,
  people,
  canSeePeople,
  isLoadingPeople,
  isOnline,
  t,
}: {
  subtitle: string
  role?: string | null | undefined
  roleLabel?: string | undefined
  userName?: string | undefined
  userEmail?: string | undefined
  signOutLabel: string
  onLogout?: (() => void) | undefined
  /** Me first, then colleagues — the caller decides the order. */
  people?: readonly HeaderPerson[] | undefined
  canSeePeople?: boolean | undefined
  isLoadingPeople?: boolean | undefined
  /** This device's connection — the dot on the pill. */
  isOnline: boolean
  t: (key: string) => string
}) {
  const tone = roleTone(role)
  const roster = people ?? []
  const onlineCount = roster.filter((person) => person.isOnline).length

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('nav.account')}
        className={cn(
          'inline-flex h-7 shrink-0 items-center gap-2 rounded-lg px-2.5 text-[11px] font-medium',
          'transition-colors hover:brightness-95 motion-reduce:transition-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]',
          tone,
        )}
      >
        {/* ONE dot: the person's own connection, where they look for who they
            are — green online, red offline — with the number of colleagues
            online beside it. The count used to carry a second green dot of its
            own, and two identical dots read as a duplicate.

            The count is realtime presence: offline it is a snapshot from
            before the connection dropped, so it is shown only while online —
            the red dot is then the whole message. Text for screen readers — a
            colour alone is not a message (راهنمای سشن §۷٫۵). */}
        {/* Its own padded block, so the dot does not touch the label beside it. */}
        <span
          className="inline-flex shrink-0 items-center gap-1.5 px-1.5 py-0.5 tabular-nums"
          data-connection-group=""
        >
          <span
            aria-hidden="true"
            data-connection={isOnline ? 'online' : 'offline'}
            className={cn(
              'inline-block size-2 shrink-0 rounded-full align-middle transition-colors motion-reduce:transition-none',
              isOnline ? 'bg-[hsl(var(--color-success))]' : 'bg-[hsl(var(--color-destructive))]',
            )}
          />
          {/* The count is only meaningful to someone allowed to see the list. */}
          {isOnline && canSeePeople && onlineCount > 0 ? (
            <span
              data-online-count=""
              className="inline-flex min-w-5 items-center justify-center rounded-full bg-[hsl(var(--fg-primary)/0.12)] px-1.5 py-px leading-4"
            >
              {onlineCount}
            </span>
          ) : null}
        </span>
        <span className="sr-only">{isOnline ? t('sync.online') : t('sync.offline')}</span>
        <span className="truncate">{subtitle}</span>
        {roleLabel ? (
          <>
            <span aria-hidden="true" className="opacity-40">
              ·
            </span>
            <span className="truncate">{roleLabel}</span>
          </>
        ) : null}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72">
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

        <p className="px-2 py-1 text-[11px] font-semibold text-[hsl(var(--fg-tertiary))]">
          {t('people.whoIsOnline')}
        </p>

        {!canSeePeople ? (
          // ⚠️ Said out loud. An empty section here would read as «nobody is
          // online», which is a statement about colleagues rather than about
          // this account's permissions.
          <p className="px-2 pb-2 text-[11px] text-[hsl(var(--fg-tertiary))]">
            {t('people.presenceNotAllowed')}
          </p>
        ) : isLoadingPeople ? (
          <p className="px-2 pb-2 text-[11px] text-[hsl(var(--fg-tertiary))]">
            {t('common.loading')}
          </p>
        ) : roster.length === 0 ? (
          <p className="px-2 pb-2 text-[11px] text-[hsl(var(--fg-tertiary))]">
            {t('people.noColleagues')}
          </p>
        ) : (
          <ul className="max-h-64 overflow-y-auto pb-1">
            {roster.map((person, index) => (
              <li
                key={person.userId ?? `${person.name}-${index}`}
                className="flex items-center gap-2 px-2 py-1.5"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'size-2 shrink-0 rounded-full',
                    person.isOnline
                      ? 'bg-[hsl(var(--color-success))]'
                      : 'bg-[hsl(var(--border-strong))]',
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs text-[hsl(var(--fg-primary))]">
                    {person.name}
                  </span>
                  {person.roleLabel ? (
                    <span className="block truncate text-[10px] text-[hsl(var(--fg-tertiary))]">
                      {person.roleLabel}
                    </span>
                  ) : null}
                </span>
                {/* ⚠️ «آفلاین» rather than a last-seen time: presence knows
                    only that the socket is closed, not when it closed. A
                    made-up «۲ ساعت پیش» would be a fact nobody measured. */}
                <span
                  className={cn(
                    'shrink-0 text-[10px]',
                    person.isOnline
                      ? 'text-[hsl(var(--color-success))]'
                      : 'text-[hsl(var(--fg-tertiary))]',
                  )}
                >
                  {person.isOnline ? t('people.online') : t('people.offline')}
                </span>
              </li>
            ))}
          </ul>
        )}

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
IdentityMenu.displayName = 'IdentityMenu'

/**
 * Collapse or expand the sidebar.
 *
 * ⚠️ THE ICON IS CHOSEN, NOT MIRRORED. `PanelLeftClose` under `dir="rtl"` is
 * still a panel on the LEFT while the sidebar is on the RIGHT, and flipping it
 * with `scale-x-[-1]` makes it point the wrong way the moment the state
 * changes. So the direction is read explicitly and the icon that actually
 * matches the sidebar's edge is rendered — in Persian and Dari «باز» points
 * left, in English it points right.
 */
const SidebarToggle = memo(function SidebarToggle({
  collapsed,
  onToggle,
  label,
}: {
  collapsed: boolean
  onToggle: () => void
  label: string
}) {
  const [node, setNode] = useState<HTMLElement | null>(null)
  const isRtl = useIsRtl(node)

  // Expanding always points AWAY from the sidebar's edge; collapsing points
  // toward it. Two booleans, one icon — no transform anywhere.
  const pointsStart = collapsed ? !isRtl : isRtl
  const Icon = pointsStart ? PanelLeftOpen : PanelLeftClose

  return (
    <button
      ref={setNode}
      type="button"
      onClick={onToggle}
      aria-label={label}
      aria-expanded={!collapsed}
      title={label}
      className={cn(
        'hidden shrink-0 items-center justify-center rounded-lg p-1.5 lg:inline-flex',
        'text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--surface-muted))]',
        'hover:text-[hsl(var(--fg-primary))]',
        'transition-colors duration-150 motion-reduce:transition-none',
      )}
    >
      <Icon className="size-[18px]" aria-hidden="true" />
    </button>
  )
})
SidebarToggle.displayName = 'SidebarToggle'

/**
 * The writing direction THIS BUTTON is actually rendered in.
 *
 * ⚠️ NOT `document.documentElement.dir`, AND NOT THE LANGUAGE PROP.
 *
 * The dashboard sets `dir` on its own wrapper, not on `<html>` — reading the
 * root would have returned `ltr` on a Persian dashboard and pointed the arrow
 * the wrong way, which is exactly the flip this is meant to prevent. And the
 * language prop says which LANGUAGE, not which direction; the two part company
 * for any locale added later.
 *
 * `getComputedStyle().direction` answers the only question that matters: which
 * side is the sidebar on, here, now.
 */
function useIsRtl(node: HTMLElement | null): boolean {
  const [isRtl, setIsRtl] = useState(false)

  useEffect(() => {
    // After mount only. Touching layout during render makes the server and the
    // first client render disagree, and React 19 discards the whole tree on a
    // hydration mismatch — for a header, the page flashes empty.
    if (!node) return

    const read = () => setIsRtl(getComputedStyle(node).direction === 'rtl')
    read()

    const root = node.ownerDocument.documentElement
    const observer = new MutationObserver(read)
    observer.observe(root, { attributes: true, attributeFilter: ['dir', 'lang'] })
    // The dashboard's own wrapper is where `dir` actually lives.
    const scope = node.closest('[dir]')
    if (scope && scope !== root) {
      observer.observe(scope, { attributes: true, attributeFilter: ['dir'] })
    }

    return () => observer.disconnect()
  }, [node])

  return isRtl
}

// ✅ DashboardHeader با memo
export const DashboardHeader = memo(function DashboardHeader({
  variant = 'dashboard',
  appName,
  appSubtitle,
  role,
  roleLabel,
  people,
  canSeePeople,
  isLoadingPeople,
  userEmail,
  userName,
  isSidebarCollapsed,
  onToggleSidebar,
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
          The search used to sit in the end-hand cluster with the language,
          theme and sign-out controls, which made a five-item row where the one
          thing people reach for most was the narrowest. It is its own region
          now and takes the space that is left. `max-w-6xl` is gone with it —
          the header spans the window, because the sidebar beside it does. */}
      <div className="flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-5">
        {/* ── Identity ── */}
        <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-2.5">
          {variant === 'dashboard' && onToggleSidebar ? (
            <SidebarToggle
              collapsed={Boolean(isSidebarCollapsed)}
              onToggle={onToggleSidebar}
              label={t(isSidebarCollapsed ? 'nav.expandSidebar' : 'nav.collapseSidebar')}
            />
          ) : null}

          {/* ⚠️ THE MARK AND THE NAME ARE MOBILE-ONLY ON THE DASHBOARD.
              From `lg` up the sidebar is on screen with the same mark and the
              same word directly beneath this row — two «حسابچه» a centimetre
              apart, paid for out of the search's width. Below `lg` the sidebar
              is replaced by the bottom bar and the header is the only place
              the app is named, so there it stays. The landing page has no
              sidebar at all and keeps both unconditionally. */}
          {variant === 'dashboard' && (
            <>
              <span className="lg:hidden">
                <BrandMark alt={appName} />
              </span>
              <span className="hidden truncate text-sm font-semibold text-[hsl(var(--fg-primary))] sm:inline lg:hidden">
                {appName}
              </span>

              {appSubtitle ? (
                <IdentityMenu
                  subtitle={appSubtitle}
                  role={role}
                  roleLabel={roleLabel}
                  userName={userName}
                  userEmail={userEmail}
                  signOutLabel={signOutLabel}
                  onLogout={onLogout}
                  people={people}
                  canSeePeople={canSeePeople}
                  isLoadingPeople={isLoadingPeople}
                  isOnline={isOnline}
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

          {variant === 'landing' && <BrandMark alt={appName} />}
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
              // ⚠️ یک رنگ برای هر دو تم کار نمی‌کند. کهربایی روی زمینه‌ی تیره
              // خوانا است (خورشید)، ولی روی زمینه‌ی روشن تقریباً محو می‌شد
              // (گزارش کاربر). در تم روشن ماه با رنگ متن اصلی و یک زمینه‌ی
              // ملایم کشیده می‌شود تا همیشه دیده شود.
              isDark
                ? 'text-[hsl(var(--color-warning))] hover:bg-[hsl(var(--surface-muted))]'
                : 'bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-primary))] hover:bg-[hsl(var(--border-default))]',
              'transition-colors duration-150',
              'motion-reduce:transition-none',
            )}
          >
            {isDark ? IconSun : IconMoon}
          </button>
          <div id="global-page-customizer-slot"></div>
          {variant === 'dashboard' && <NotificationBell />}
          {/* ⚠️ NO SECOND «YOU» AT THIS END OF THE BAR. The account menu used
              to sit here as an avatar while the pill at the other end said the
              role — two controls for one identity. They are one control now,
              on the pill; see `IdentityMenu`. */}
          {variant === 'landing' && (
            <button
              type="button"
              onClick={onNavigateLogin}
              className={cn(
                'rounded-full px-4 py-2',
                'text-xs font-bold text-white',
                'bg-[image:var(--gradient-brand)]',
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
