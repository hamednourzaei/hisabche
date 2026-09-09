'use client'

import { memo, useState, useRef, useEffect, useCallback, useId } from 'react'
import { cn } from '../../lib/utils'
import type { ElementType, ReactElement } from 'react'
import { useAuthStore } from '@hisabche/store'
import { useTranslations } from 'next-intl'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip'

/* ═══════════════════════════════════════════════════════════════════════════
   DashboardSidebar v7.3 — Memoized · Performance Optimized
   ✅ memo برای همه کامپوننت‌ها
   ═══════════════════════════════════════════════════════════════════════════ */

export interface NavItem {
  id: string
  icon: ElementType
  label: string
  path: string
  badge?: number
}

export interface NavGroup {
  id: string
  label: string
  icon: ElementType
  items: NavItem[]
}

function isPathActive(currentPath: string, itemPath: string): boolean {
  // Locales are fa/af/en (see apps/web/app/[lang]/i18n-config.ts). `fa` is the
  // default and unprefixed (localePrefix: 'as-needed'), `af`/`en` are prefixed.
  const normalized = currentPath.replace(/^\/(fa|af|en)(?=\/|$)/, '') || '/'
  if (normalized === itemPath) return true
  if (normalized.startsWith(itemPath + '/')) return true
  if (normalized.startsWith(itemPath + '?')) return true
  return false
}

const ICON_PATHS: Record<string, ReactElement> = {
  dashboard: (
    <g>
      <path d="M3 10.5 10 4l7 6.5" />
      <path d="M5 9.5V16h10V9.5" />
    </g>
  ),
  warehouse: (
    <g>
      <path d="M3 7 10 4l7 3v6l-7 3-7-3z" />
      <path d="M3 7l7 3 7-3M10 10v6" />
    </g>
  ),
  invoices: (
    <g>
      <path d="M5 3h7l3 3v11H5z" />
      <path d="M12 3v3h3" />
      <path d="M7.5 9h5M7.5 12h5M7.5 15h3" />
    </g>
  ),
  customers: (
    <g>
      <circle cx="8" cy="8" r="2.8" />
      <path d="M3.5 16c.6-2.4 2.4-3.6 4.5-3.6s3.9 1.2 4.5 3.6" />
      <circle cx="14.5" cy="7.5" r="2.2" />
      <path d="M13 12.4c2 0 3.4 1.1 4 3.1" />
    </g>
  ),
  settings: (
    <g>
      <circle cx="10" cy="10" r="2.4" />
      <path d="M10 3v2M10 15v2M3 10h2M15 10h2M5.2 5.2l1.4 1.4M13.4 13.4l1.4 1.4M5.2 14.8l1.4-1.4M13.4 6.6l1.4-1.4" />
    </g>
  ),
}

// ✅ SidebarIcon با memo
const SidebarIcon = memo(function SidebarIcon({
  id,
  active,
  size = 18,
}: {
  id: string
  active: boolean
  size?: number
}) {
  const path = ICON_PATHS[id]
  if (!path) return null
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn(
        'shrink-0 transition-colors duration-200 motion-reduce:transition-none',
        active
          ? 'text-[hsl(var(--color-primary))]'
          : 'text-[hsl(var(--fg-tertiary))] group-hover:text-[hsl(var(--fg-secondary))]',
      )}
    >
      {path}
    </svg>
  )
})
SidebarIcon.displayName = 'SidebarIcon'

// ✅ ItemIcon با memo
const ItemIcon = memo(function ItemIcon({
  item,
  active,
  size = 18,
}: {
  item: NavItem
  active: boolean
  size?: number
}) {
  if (ICON_PATHS[item.id]) return <SidebarIcon id={item.id} active={active} size={size} />

  // A destination whose icon did not resolve must not take the whole shell
  // down with it. React renders `undefined` as "Element type is invalid" and
  // the error boundary swallows the entire sidebar — so one missing glyph
  // becomes a blank application, on every page, with a message that names no
  // destination. Falling back keeps the app usable and says which id is at
  // fault, which is the difference between a five-minute fix and an hour.
  // `typeof === 'object'` is not enough. Next's package-import optimizer
  // rewrites a named lucide import into a deep import, and for some names it
  // hands back the MODULE NAMESPACE rather than the component — an object,
  // truthy, and rejected by React with a message that names no destination.
  // A real component is a function, or an object carrying `$$typeof`
  // (memo/forwardRef).
  const Icon = item.icon as unknown
  const isRenderable =
    typeof Icon === 'function' || (typeof Icon === 'object' && Icon !== null && '$$typeof' in Icon)

  if (!isRenderable) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[nav] no icon resolved for destination "${item.id}"`)
    }
    return <span aria-hidden="true" style={{ width: size, height: size }} />
  }

  const Render = Icon as ElementType
  return (
    <Render
      className={cn(
        'shrink-0 transition-colors duration-200 motion-reduce:transition-none',
        active
          ? 'text-[hsl(var(--color-primary))]'
          : 'text-[hsl(var(--fg-tertiary))] group-hover:text-[hsl(var(--fg-secondary))]',
      )}
      style={{ width: size, height: size }}
    />
  )
})
ItemIcon.displayName = 'ItemIcon'

// ─── Desktop Sidebar ─────────────────────────────────────────────────────────
//
// ⚠️ «بیشتر» IS GONE, AND THAT WAS THE WHOLE PROBLEM.
//
// Every destination outside the daily five lived behind one button labelled
// «بیشتر», which opened an ABSOLUTELY POSITIONED panel floating over the rest
// of the sidebar. That panel could not extend the sidebar's scroll area, so it
// needed a hand-tuned `max-height`, its own click-outside listener and its own
// Escape handler — and on a laptop screen the last groups still fell past the
// bottom edge where the sidebar's own scrollbar could not reach them.
//
// Twenty-six destinations behind one word that names none of them is not
// navigation. Somebody looking for «بانک» had no reason to guess it was there.
//
// The groups are now rows in the sidebar itself: click one and its
// destinations open BENEATH it, in the document, where the scrollbar works.
// Everything the panel needed — the height cap, the outside-click listener,
// the Escape handler, the z-index — is deleted, because a section of a
// scrolling list needs none of it.

/** How many groups may stand open at once. */
const OPEN_LIMIT = Infinity

/** One destination row. */
const NavRow = memo(function NavRow({
  item,
  isActive,
  nested,
  onClick,
  collapsed = false,
}: {
  item: NavItem
  isActive: boolean
  nested: boolean
  onClick: () => void
  collapsed?: boolean
}) {
  // ⚠️ `> 0`, not `!= null`. A badge says «something is waiting for you»; a
  // grey circle reading «۰» says the opposite while still drawing the eye.
  const badge = item.badge != null && item.badge > 0 ? item.badge : null

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        'group relative flex w-full items-center gap-2.5 rounded-lg text-start text-sm',
        'transition-colors duration-150 motion-reduce:transition-none',
        // ⚠️ ONE ROW, ALWAYS. 36px and `truncate` below: on a laptop the long
        // Persian labels used to wrap onto a second line, so rows had two
        // different heights and the list read as ragged rather than as a list.
        //
        // ⚠️ `shrink-0` IS LOAD-BEARING. The nav is a flex COLUMN, so with the
        // default `flex-shrink: 1` every row gives up height once the content
        // is taller than the container — open three groups at once and the
        // five permanent rows at the top squeezed shorter and shorter until
        // they were unreadable, while the list still did not scroll. Fixed
        // height plus `shrink-0` makes the overflow become scroll, which is
        // what the `overflow-y-auto` on the nav was always for.
        'h-9 shrink-0',
        // ⚠️ THE LABEL IS THE ONLY THING THE ICON HAD. Collapsed, `title` and
        // `aria-label` carry it — an unlabelled icon button is unusable with a
        // screen reader and a guess with a mouse.
        collapsed ? 'justify-center px-0' : 'px-3',
        !collapsed && nested && 'ps-9',
        isActive
          ? 'bg-[hsl(var(--color-primary)/0.10)] font-semibold text-[hsl(var(--color-primary))]'
          : 'text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]',
      )}
    >
      {/* A hairline, not a glow. On a screen holding a trial balance, a
          navigation row that pulses competes with the numbers. */}
      {isActive ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-1.5 end-0 w-[3px] rounded-full bg-[hsl(var(--color-primary))]"
        />
      ) : null}

      <ItemIcon item={item} active={isActive} size={nested ? 16 : 18} />
      {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}

      {badge != null && !collapsed ? (
        <span
          className={cn(
            'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
            'bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))]',
          )}
        >
          {badge}
        </span>
      ) : null}
    </button>
  )
})
NavRow.displayName = 'NavRow'

/**
 * A group row that opens its destinations beneath itself.
 *
 * ⚠️ AUTO-OPENS WHEN IT HOLDS THE CURRENT PAGE, even if the person closed it.
 * Landing on `/bank` from a bookmark with «کارها» collapsed would otherwise
 * show a sidebar where nothing is highlighted, which reads as «you are
 * nowhere». Their own toggle still wins while they stay inside the group.
 */
const NavGroupRow = memo(function NavGroupRow({
  group,
  activeNav,
  open,
  onToggle,
  onNavigate,
}: {
  group: NavGroup
  activeNav: string
  open: boolean
  onToggle: () => void
  onNavigate: (id: string, path: string) => void
}) {
  const contentId = useId()
  const hasActive = group.items.some((item) => isPathActive(activeNav, item.path))
  const GroupIcon = group.icon

  return (
    // `shrink-0` again: the wrapper is also a flex child of the nav column.
    <div className="flex shrink-0 flex-col">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={contentId}
        className={cn(
          // `shrink-0` for the same reason as the destination rows above.
          'flex h-9 w-full shrink-0 items-center gap-2.5 rounded-lg px-3 text-start text-sm',
          'transition-colors duration-150 motion-reduce:transition-none',
          hasActive && !open
            ? 'text-[hsl(var(--color-primary))]'
            : 'text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]',
        )}
      >
        <GroupIcon className="size-[18px] shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate font-medium">{group.label}</span>

        {/* Where you are, when the group that holds it is shut. Without this,
            closing a group hides the only sign of the current page. */}
        {hasActive && !open ? (
          <span
            aria-hidden="true"
            className="size-1.5 shrink-0 rounded-full bg-[hsl(var(--color-primary))]"
          />
        ) : null}

        <svg
          width={14}
          height={14}
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={cn(
            'shrink-0 transition-transform duration-150 motion-reduce:transition-none',
            open ? 'rotate-0' : 'ltr:-rotate-90 rtl:rotate-90',
          )}
        >
          <path d="M5 7.5l5 5 5-5" />
        </svg>
      </button>

      {/* ⚠️ `grid-template-rows` 0fr→1fr, not `height: auto`.
          Height cannot be transitioned from a measured value without a layout
          read every frame. The inner wrapper needs `overflow-hidden` or the
          content spills while the row is still collapsing.

          ⚠️ `hidden` on the list, not just zero height: a collapsed group is
          invisible but still focusable, so Tab walked through fifteen rows
          that were not on screen and a screen reader read them all out. */}
      <div
        id={contentId}
        className={cn(
          'grid transition-[grid-template-rows] duration-150 ease-out',
          'motion-reduce:transition-none',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-0.5 py-0.5" hidden={!open}>
            {group.items.map((item) => (
              <NavRow
                key={item.id}
                item={item}
                isActive={isPathActive(activeNav, item.path)}
                nested
                onClick={() => onNavigate(item.id, item.path)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
})
NavGroupRow.displayName = 'NavGroupRow'

/**
 * A red «!» beside the app name when this account has no name to show.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ IT SAYS WHO CAN FIX IT, BECAUSE THAT IS NOT THE SAME PERSON.
 *
 * An owner sets their own name and their business's name, and the mark takes
 * them to the settings page that holds both. A member does NOT: their name is
 * whatever the owner typed when adding them, and there is no field for it in
 * their own settings. Telling a member to «go set your name» sends them
 * looking for a control that does not exist for them — so for them the mark is
 * not a button, and the text names the owner instead.
 *
 * ⚠️ AN UNKNOWN ROLE SHOWS NOTHING. `role` is `null` while /auth/me is in
 * flight and for anyone with several memberships. Guessing «owner» would put a
 * red mark and an instruction in front of someone who cannot act on either.
 */
const MissingNameMark = memo(function MissingNameMark({
  user,
  t,
  onOpenSettings,
}: {
  user: { fullName?: string | null; businessName?: string | null; role?: string | null } | null
  t: (key: string) => string
  onOpenSettings?: () => void
}) {
  // ⚠️ TRIMMED. A profile saved with a space in the name field is not a name,
  // and `Boolean(' ')` is `true`.
  const hasName = Boolean(user?.fullName?.trim())
  const hasBusiness = Boolean(user?.businessName?.trim())
  const role = user?.role ?? null

  if (!user || role === null || (hasName && hasBusiness)) return null

  const isOwner = role === 'owner'

  const what =
    !hasName && !hasBusiness
      ? t('nav.missingBoth')
      : !hasName
        ? t('nav.missingYourName')
        : t('nav.missingBusinessName')

  const hint = isOwner ? t('nav.missingFixOwner') : t('nav.missingFixStaff')

  const mark = (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex size-4 shrink-0 items-center justify-center rounded-full',
        'text-[10px] font-bold leading-none',
        'bg-[hsl(var(--color-destructive)/0.14)] text-[hsl(var(--color-destructive))]',
      )}
    >
      !
    </span>
  )

  const body = (
    <TooltipContent side="bottom" align="start" className="max-w-[15rem] leading-relaxed">
      <p className="font-medium">{what}</p>
      <p className="mt-1 text-[hsl(var(--fg-secondary))]">{hint}</p>
    </TooltipContent>
  )

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          {isOwner && onOpenSettings ? (
            <button
              type="button"
              onClick={onOpenSettings}
              aria-label={`${what} — ${hint}`}
              className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-destructive)/0.5)]"
            >
              {mark}
            </button>
          ) : (
            // Not a button for a member: there is nothing behind it for them.
            // A control that opens nothing is worse than a plain mark.
            <span tabIndex={0} role="img" aria-label={`${what} — ${hint}`} className="rounded-full">
              {mark}
            </span>
          )}
        </TooltipTrigger>
        {body}
      </Tooltip>
    </TooltipProvider>
  )
})
MissingNameMark.displayName = 'MissingNameMark'

export const DashboardSidebar = memo(function DashboardSidebar({
  primaryItems,
  moreGroups,
  activeNav,
  onNavigate,
  collapsed = false,
  onExpand,
  onOpenSettings,
}: {
  primaryItems: NavItem[]
  moreGroups: NavGroup[]
  /** Kept so existing callers compile; there is no «More» button to put it on. */
  moreIcon?: ElementType
  activeNav: string
  onNavigate: (id: string, path: string) => void
  /** Icon rail. The toggle lives in the header, so the state is the shell's. */
  collapsed?: boolean
  /**
   * Re-open the rail. A group cannot show its children in 64px, so clicking
   * one while collapsed expands the sidebar instead of silently doing nothing.
   */
  onExpand?: (() => void) | undefined
  /** Where the owner goes to fix a missing name. */
  onOpenSettings?: (() => void) | undefined
}) {
  const t = useTranslations()
  const user = useAuthStore((s) => s.user)

  // Only the groups the person has explicitly toggled. Everything else follows
  // the route, which is what makes «open the group holding this page» work
  // without fighting them.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})

  return (
    <aside
      aria-label={t('nav.mainNav')}
      className={cn(
        'sticky top-0 hidden h-screen shrink-0 lg:flex lg:flex-col',
        // ⚠️ A WIDTH, NOT A TRANSFORM. Sliding the rail with `translate-x`
        // leaves it occupying its old 240px in the layout, so the content
        // beside it does not reclaim the space — which is the entire point of
        // collapsing it.
        collapsed ? 'w-16' : 'w-60',
        'transition-[width] duration-200 motion-reduce:transition-none',
        'border-e border-[hsl(var(--border-default))]',
        'bg-[hsl(var(--surface-base))]',
      )}
    >
      {/* ── Header ──
          ⚠️ 64px, matching the app header beside it. It used to be a 64px logo
          with padding above and below — about 140px of a 768px laptop screen
          spent on a picture, which is most of a group's worth of rows. */}
      <div
        className={cn(
          'flex h-16 shrink-0 items-center border-b border-[hsl(var(--border-default))]',
          collapsed ? 'justify-center px-2' : 'gap-2.5 px-4',
        )}
      >
        <img
          src="/logo-icon.png"
          alt=""
          aria-hidden="true"
          className="size-9 shrink-0 object-contain"
        />

        {/* ⚠️ THE BUSINESS NAME USED TO BE A SECOND LINE HERE, AND IS GONE.
            It was the same string the header repeated three centimetres to the
            right in the «سازمان: …» chip. One of the two had to go; this is the
            one nobody clicks. What remains is the thing the person can ACT on:
            a name that was never set. */}
        {!collapsed && (
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-[hsl(var(--fg-primary))]">
              {t('app.name')}
            </span>
            <MissingNameMark user={user} t={t} {...(onOpenSettings ? { onOpenSettings } : {})} />
          </div>
        )}
      </div>

      {/* ── Navigation ──
          Only this scrolls, so the header stays put and the scrollbar belongs
          to the list rather than to a floating panel. */}
      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain p-3">
        {primaryItems.map((item) => (
          <NavRow
            key={item.id}
            item={item}
            isActive={isPathActive(activeNav, item.path)}
            nested={false}
            collapsed={collapsed}
            onClick={() => onNavigate(item.id, item.path)}
          />
        ))}

        {moreGroups.length > 0 ? (
          <div className="my-1.5 h-px shrink-0 bg-[hsl(var(--border-default))]" />
        ) : null}

        {moreGroups.map((group) => {
          const hasActive = group.items.some((item) => isPathActive(activeNav, item.path))
          const open = overrides[group.id] ?? hasActive

          // ⚠️ COLLAPSED, A GROUP IS A BUTTON THAT RE-OPENS THE RAIL.
          // Its children are labels, and there is no room for a label — an
          // accordion that expands into 64px of nothing looks broken. So the
          // click does the only useful thing: gives the labels somewhere to go,
          // and opens the group once they are back.
          if (collapsed) {
            const Icon = group.icon
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => {
                  setOverrides((prev) => ({ ...prev, [group.id]: true }))
                  onExpand?.()
                }}
                aria-label={group.label}
                title={group.label}
                className={cn(
                  'group flex h-9 w-full shrink-0 items-center justify-center rounded-lg',
                  'transition-colors duration-150 motion-reduce:transition-none',
                  hasActive
                    ? 'bg-[hsl(var(--color-primary)/0.10)] text-[hsl(var(--color-primary))]'
                    : 'text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]',
                )}
              >
                {Icon ? <Icon className="size-[18px] shrink-0" aria-hidden="true" /> : null}
              </button>
            )
          }

          return (
            <NavGroupRow
              key={group.id}
              group={group}
              activeNav={activeNav}
              open={open}
              onToggle={() => setOverrides((prev) => ({ ...prev, [group.id]: !open }))}
              onNavigate={onNavigate}
            />
          )
        })}
      </nav>
    </aside>
  )
})

DashboardSidebar.displayName = 'DashboardSidebar'

// ─── Mobile BottomNav ───────────────────────────────────────────────────────

const NAV_HEIGHT_PX = 56
const NAV_OFFSET_PX = 16
const NAV_GAP_PX = 8
const POPOVER_BOTTOM = `calc(${NAV_HEIGHT_PX + NAV_OFFSET_PX + NAV_GAP_PX}px + env(safe-area-inset-bottom, 0px))`
const BACKDROP_BOTTOM = `calc(${NAV_HEIGHT_PX + NAV_OFFSET_PX}px + env(safe-area-inset-bottom, 0px))`

/**
 * How tall the "more" panel may grow.
 *
 * `100dvh` — the DYNAMIC viewport height — because on mobile Safari and Chrome
 * the address bar shrinks and grows, and `100vh` is the LARGEST it ever gets.
 * Sizing to `vh` means the bottom of the panel sits under the browser chrome
 * exactly when the bar is showing.
 *
 * The subtraction leaves room for the nav bar the panel sits above, its gap,
 * and a margin at the top so the panel never looks welded to the status bar.
 */
const MORE_PANEL_MAX_HEIGHT = `calc(100dvh - ${NAV_HEIGHT_PX + NAV_OFFSET_PX + NAV_GAP_PX + 24}px - env(safe-area-inset-bottom, 0px) - env(safe-area-inset-top, 0px))`

export const BottomNav = memo(function BottomNav({
  primaryItems,
  moreGroups,
  moreIcon: MoreIcon,
  activeNav,
  onNavigate,
}: {
  primaryItems: NavItem[]
  moreGroups: NavGroup[]
  moreIcon: ElementType
  activeNav: string
  onNavigate: (id: string, path: string) => void
}) {
  const t = useTranslations()
  const [isMoreOpen, setIsMoreOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const moreBtnRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()

  const hasMoreActive = moreGroups.some((g) => g.items.some((i) => isPathActive(activeNav, i.path)))

  const closeAndRestoreFocus = useCallback(() => {
    setIsMoreOpen(false)
    moreBtnRef.current?.focus()
  }, [])

  const handleItemSelect = useCallback(
    (id: string, path: string) => {
      setIsMoreOpen(false)
      onNavigate(id, path)
    },
    [onNavigate],
  )

  useEffect(() => {
    if (!isMoreOpen) return
    function handleClickOutside(e: TouchEvent | MouseEvent) {
      const target = e.target as Node
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        moreBtnRef.current &&
        !moreBtnRef.current.contains(target)
      ) {
        setIsMoreOpen(false)
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
    }, 10)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [isMoreOpen])

  useEffect(() => {
    if (!isMoreOpen) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeAndRestoreFocus()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isMoreOpen, closeAndRestoreFocus])

  useEffect(() => {
    if (isMoreOpen && popoverRef.current) {
      const firstItem = popoverRef.current.querySelector<HTMLButtonElement>('[role="menuitem"]')
      firstItem?.focus()
    }
  }, [isMoreOpen])

  return (
    <>
      <nav
        aria-label={t('nav.mobileNav')}
        className="fixed bottom-4 inset-x-4 z-modal max-w-[480px] mx-auto lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div
          className={cn(
            'relative h-14 rounded-2xl',
            'border border-[hsl(var(--color-primary)/0.18)]',
            'bg-[hsl(var(--surface-elevated)/0.98)] backdrop-blur-md',
            'shadow-lg',
          )}
        >
          <ul
            className="flex flex-row items-stretch h-full m-0 p-0 list-none"
            style={{ gap: '2px', paddingInline: '8px', direction: 'rtl' } as React.CSSProperties}
          >
            {primaryItems.map((item) => {
              const isActive = isPathActive(activeNav, item.path)
              return (
                <li key={item.id} className="flex-1 flex-shrink-0 min-w-0 h-full">
                  <button
                    type="button"
                    onClick={() => handleItemSelect(item.id, item.path)}
                    className={cn(
                      'relative flex flex-col items-center justify-center w-full h-full',
                      'transition-all duration-150 motion-reduce:transition-none',
                      isActive
                        ? 'text-[hsl(var(--color-primary))]'
                        : 'text-[hsl(var(--fg-tertiary))] active:text-[hsl(var(--fg-secondary))]',
                    )}
                    aria-current={isActive ? 'page' : undefined}
                    aria-label={item.label}
                  >
                    <div
                      className={cn(
                        'absolute start-1/2 -translate-x-1/2 h-[3px] rounded-full bg-[var(--gradient-brand)]',
                        'transition-all duration-150 ease-out',
                        isActive ? 'w-8 opacity-100' : 'w-0 opacity-0',
                      )}
                      style={{ top: -1 }}
                    />
                    <div
                      className={cn(
                        'transition-transform duration-150 motion-reduce:transition-none',
                        isActive && '-translate-y-0.5 scale-110',
                      )}
                    >
                      <ItemIcon item={item} active={isActive} size={20} />
                    </div>
                    <span
                      className={cn(
                        'mt-0.5 truncate max-w-[64px] transition-all duration-150',
                        isActive ? 'font-semibold' : 'font-normal',
                      )}
                      style={{ fontSize: 10 }}
                    >
                      {item.label}
                    </span>
                  </button>
                </li>
              )
            })}
            <li className="w-px self-stretch my-2 bg-[hsl(var(--border-default))] opacity-30 flex-shrink-0" />
            <li className="flex-1 flex-shrink-0 min-w-0 h-full">
              <button
                ref={moreBtnRef}
                type="button"
                onClick={() => setIsMoreOpen((p) => !p)}
                className={cn(
                  'relative flex flex-col items-center justify-center w-full h-full rounded-xl',
                  'transition-all duration-150 motion-reduce:transition-none',
                  isMoreOpen
                    ? 'bg-[hsl(var(--color-primary)/0.10)] text-[hsl(var(--color-primary))]'
                    : hasMoreActive
                      ? 'text-[hsl(var(--color-primary))]'
                      : 'text-[hsl(var(--fg-tertiary))] active:text-[hsl(var(--fg-secondary))]',
                )}
                aria-expanded={isMoreOpen}
                aria-haspopup="true"
                aria-controls={isMoreOpen ? menuId : undefined}
                aria-label={t('nav.more')}
              >
                {hasMoreActive && !isMoreOpen && (
                  <span className="absolute bottom-1.5 w-1 h-1 rounded-full bg-[hsl(var(--color-primary))]" />
                )}
                <div
                  className={cn(
                    'transition-transform duration-150 motion-reduce:transition-none',
                    isMoreOpen && 'scale-110',
                  )}
                >
                  <MoreIcon className="size-[20px]" />
                </div>
                <span
                  className={cn(
                    'mt-0.5 transition-all duration-150',
                    isMoreOpen ? 'font-semibold' : 'font-normal',
                  )}
                  style={{ fontSize: 10 }}
                >
                  {t('nav.more')}
                </span>
              </button>
            </li>
          </ul>
        </div>
      </nav>

      {isMoreOpen && (
        <>
          <div
            ref={popoverRef}
            id={menuId}
            role="menu"
            aria-label={t('nav.more')}
            className={cn(
              'fixed inset-x-4 z-popover max-w-[480px] mx-auto lg:hidden',
              'animate-in slide-in-from-bottom-2 fade-in-0 duration-200 motion-reduce:animate-none',
            )}
            style={{ bottom: POPOVER_BOTTOM }}
          >
            <div
              className={cn(
                'rounded-2xl overflow-hidden',
                'border border-[hsl(var(--border-default))]',
                'bg-[hsl(var(--surface-elevated)/0.99)] backdrop-blur-xl',
                'shadow-xl shadow-black/10',
                // The panel is anchored to the BOTTOM and grows upward. With no
                // ceiling it grew past the top of the screen on a phone, and
                // the first groups — the ones a person scrolled for — were
                // simply unreachable.
                //
                // A column with a capped height and a scrolling body keeps the
                // header and the close button pinned while the list moves.
                'flex flex-col',
              )}
              style={{ maxHeight: MORE_PANEL_MAX_HEIGHT }}
            >
              <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-[hsl(var(--border-default))] opacity-70">
                <span className="text-xs font-semibold text-[hsl(var(--fg-secondary))]">
                  {t('nav.more')}
                </span>
                <button
                  type="button"
                  onClick={closeAndRestoreFocus}
                  className="p-1 rounded-lg text-[hsl(var(--fg-tertiary))] active:text-[hsl(var(--fg-primary))] active:bg-[hsl(var(--surface-muted))]"
                  aria-label={t('action.close')}
                >
                  <svg
                    width={16}
                    height={16}
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                  >
                    <path d="M5 5l10 10M15 5L5 15" />
                  </svg>
                </button>
              </div>
              {/* `overscroll-contain` stops a flick at the end of this list
                  from scrolling the page behind it, which on a phone reads as
                  the menu dragging the whole screen. */}
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain py-1.5">
                {moreGroups.map((group, idx) => (
                  <div key={group.id}>
                    <div className="flex items-center gap-2 px-4 pt-2 pb-1">
                      <span className="text-[10px] font-semibold text-[hsl(var(--fg-tertiary))] tracking-wide">
                        {group.label}
                      </span>
                      <span className="flex-1 h-px bg-[hsl(var(--border-default))] opacity-30" />
                    </div>
                    <div className="py-0.5">
                      {group.items.map((item) => {
                        const isActive = isPathActive(activeNav, item.path)
                        return (
                          <button
                            key={item.id}
                            type="button"
                            role="menuitem"
                            onClick={() => handleItemSelect(item.id, item.path)}
                            className={cn(
                              'w-full flex items-center gap-3 px-4 py-2.5 min-h-11',
                              'transition-colors duration-150',
                              isActive
                                ? 'bg-[hsl(var(--color-primary)/0.08)] text-[hsl(var(--color-primary))] font-semibold'
                                : 'text-[hsl(var(--fg-primary))] active:bg-[hsl(var(--surface-muted))]',
                            )}
                            aria-current={isActive ? 'page' : undefined}
                          >
                            <span
                              className={cn(
                                'transition-transform duration-150 motion-reduce:transition-none',
                                isActive && 'scale-110',
                              )}
                            >
                              <ItemIcon item={item} active={isActive} size={18} />
                            </span>
                            <span className="flex-1 text-sm text-start truncate">{item.label}</span>
                            {isActive && (
                              <svg
                                width={16}
                                height={16}
                                viewBox="0 0 20 20"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2.5}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="text-[hsl(var(--color-primary))] shrink-0"
                              >
                                <path d="M5 10l3.5 3.5L15 7" />
                              </svg>
                            )}
                          </button>
                        )
                      })}
                    </div>
                    {idx < moreGroups.length - 1 && (
                      <div className="mx-4 my-1 h-px bg-[hsl(var(--border-default))] opacity-30" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div
            className="fixed inset-0 z-modal-backdrop lg:hidden"
            style={{ bottom: BACKDROP_BOTTOM }}
            onTouchStart={closeAndRestoreFocus}
            onMouseDown={closeAndRestoreFocus}
            aria-hidden="true"
          />
        </>
      )}
    </>
  )
})

BottomNav.displayName = 'BottomNav'
