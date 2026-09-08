'use client'

import { memo, useState, useRef, useEffect, useCallback, useId } from 'react'
import { ChevronDown, PanelLeft } from 'lucide-react'
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
  /**
   * Optional so this same item can render a docs article, which has no icon.
   * The dashboard's own entries always carry one — `NAV_ICONS` in
   * `lib/menu/nav-items.ts` is exhaustive over `NavId`, so the compiler still
   * asks for an icon there.
   */
  icon?: ElementType
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

export function isPathActive(currentPath: string, itemPath: string): boolean {
  // Locales are fa/af/en (see apps/web/app/[lang]/i18n-config.ts) and
  // `localePrefix` is 'always', so every path carries one. Stripping it is
  // still conditional because desktop's hash router serves unprefixed paths.
  //
  // ⚠️ The `+ '/'` and `+ '?'` are what stop a FALSE PREFIX MATCH:
  // plain `startsWith('/accounting')` would light «حسابداری» up on
  // `/accounting-workspace`, which is a different destination in this very
  // sidebar.
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
  // Deliberately absent — a docs article, say. Nothing to reserve room for.
  if (item.icon === undefined) return null

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
// ⚠️ WHAT THIS REPLACED, AND WHY
//
// The desktop sidebar used to be five primary destinations plus a «More»
// button that opened an ABSOLUTELY POSITIONED panel over the rest of the
// sidebar, holding the other twenty-five. That panel could not extend the
// sidebar's scroll area, so it needed a hand-tuned `max-height` and its own
// click-outside and Escape handling, and a person looking for «بانک» had to
// know it was hidden behind a word that names nothing.
//
// Twenty-five destinations behind one unlabelled door is not navigation.
//
// They are now collapsible GROUPS in the sidebar body, which is where the
// contract already said they belong — `MORE_GROUPS_CONTRACT` has grouped them
// as people/work/system all along and only the desktop renderer ignored it.
// The panel, its outside-click listener, its Escape listener and its height
// cap are all gone: a group that is part of the scrolling document needs none
// of them.
//
// «More» still exists on MOBILE, where a bottom bar genuinely cannot hold
// thirty destinations. See `BottomNav` below — it is deliberately unchanged.

/** Where the expanded/collapsed choice is remembered. */
export const SIDEBAR_STORAGE_KEY = 'hisabche.sidebar.state'

const SIDEBAR_WIDTH_EXPANDED = 240
const SIDEBAR_WIDTH_COLLAPSED = 72

/**
 * Is `event` coming from somewhere a person is typing?
 *
 * ⚠️ Without this, Ctrl/Cmd+B collapses the sidebar while someone is writing a
 * customer note — and in a `contenteditable` it also races the browser's own
 * bold shortcut. A global shortcut that fires inside a text field is a bug, not
 * a feature.
 */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

/**
 * The expanded/collapsed choice, persisted per browser.
 *
 * ⚠️ READ IN AN EFFECT, NOT DURING RENDER. The server has no `localStorage`, so
 * seeding state from it directly renders one HTML on the server and another on
 * the client, and React discards the whole tree with a hydration error. Every
 * first paint is therefore expanded, and a collapsed preference applies on the
 * next tick — which is why the width transition is suppressed until the stored
 * value has been read, so a collapsed user does not watch the sidebar slide
 * shut on every page load.
 */
function useSidebarCollapsed(): [boolean, (next: boolean) => void, boolean] {
  const [collapsed, setCollapsed] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'collapsed')
    } catch {
      // Private mode, or site data blocked. Not a reason to fail to render.
    }
    setHydrated(true)
  }, [])

  const set = useCallback((next: boolean) => {
    setCollapsed(next)
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? 'collapsed' : 'expanded')
    } catch {
      // The preference is a convenience; losing it must not break navigating.
    }
  }, [])

  return [collapsed, set, hydrated]
}

/** One destination. Collapsed, its tooltip is the only label there is.
 *  Exported because the documentation sidebar renders through this exact
 *  component — the two menus look identical because they ARE identical. */
export const SidebarItem = memo(function SidebarItem({
  item,
  isActive,
  collapsed,
  nested,
  onClick,
}: {
  item: NavItem
  isActive: boolean
  collapsed: boolean
  nested: boolean
  onClick: () => void
}) {
  // ⚠️ `> 0`, not `!= null`. A badge is there to say «something is waiting for
  // you»; a grey circle reading «۰» says the opposite while still drawing the
  // eye, and every destination with a counter wore one permanently.
  const badge = item.badge != null && item.badge > 0 ? item.badge : null

  const button = (
    <button
      type="button"
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'group relative flex w-full items-center rounded-lg text-start text-sm',
        'transition-colors duration-150 motion-reduce:transition-none',
        // 40px tall, and never narrower than its icon when collapsed.
        collapsed ? 'h-10 justify-center px-0' : 'h-10 gap-2.5 px-3',
        nested && !collapsed && 'ps-9',
        isActive
          ? 'bg-[hsl(var(--color-primary)/0.10)] font-semibold text-[hsl(var(--color-primary))]'
          : 'text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]',
      )}
    >
      {/* ⚠️ A HAIRLINE, NOT A GLOW.
          This used to be a 3px bar with `shadow-[0_0_8px_…]` and the icon
          scaled to 110%. On a screen holding a trial balance, a navigation
          item that pulses and grows competes with the numbers. */}
      {isActive ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-2 end-0 w-[3px] rounded-full bg-[hsl(var(--color-primary))]"
        />
      ) : null}

      <ItemIcon item={item} active={isActive} size={nested && !collapsed ? 16 : 18} />

      {collapsed ? null : (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {badge != null ? (
            <span
              className={cn(
                'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                'bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))]',
              )}
            >
              {badge}
            </span>
          ) : null}
        </>
      )}

      {/* Collapsed, the label is gone but the count still has to be visible —
          a dot, because two digits do not fit on a 72px rail. */}
      {collapsed && badge != null ? (
        <span
          aria-hidden="true"
          className="absolute end-3 top-2 size-1.5 rounded-full bg-[hsl(var(--color-primary))]"
        />
      ) : null}
    </button>
  )

  if (!collapsed) return button

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      {/* ⚠️ RADIX SIDES ARE PHYSICAL — there is no `start`/`end` here, and
          hardcoding `right` would put every tooltip off-screen in Persian.
          `avoidCollisions` (on by default) does the work: the collapsed
          sidebar is 72px against the edge of the viewport, so in RTL there is
          no room on the right and Radix flips to the left on its own. In LTR
          the whole page is to the right and it never flips. */}
      <TooltipContent side="right">
        {item.label}
        {badge != null ? ` (${badge})` : ''}
      </TooltipContent>
    </Tooltip>
  )
})
SidebarItem.displayName = 'SidebarItem'

/**
 * A domain group — «مشتری‌ها», «کارها», «سامانه».
 *
 * ⚠️ AUTO-OPENS WHEN IT HOLDS THE CURRENT PAGE, even if the person closed it.
 * Landing on `/bank` from a bookmark with «کارها» collapsed would otherwise
 * show a sidebar where nothing is highlighted, which reads as «you are
 * nowhere». The user's own toggle still wins for as long as they stay inside
 * the group — `override` is only cleared by them.
 */
const SidebarGroup = memo(function SidebarGroup({
  group,
  activeNav,
  collapsed,
  open,
  onToggle,
  onNavigate,
}: {
  group: NavGroup
  activeNav: string
  collapsed: boolean
  open: boolean
  onToggle: () => void
  onNavigate: (id: string, path: string) => void
}) {
  const contentId = useId()
  const hasActive = group.items.some((item) => isPathActive(activeNav, item.path))

  // Collapsed there is no room for a group header, so the group becomes a
  // divider and its items stand on their own with tooltips. A flyout would be
  // a second navigation surface to build, test and keep in step; a tooltipped
  // icon is already unambiguous.
  if (collapsed) {
    return (
      <div className="flex flex-col gap-0.5 border-t border-[hsl(var(--border-default))] pt-1.5">
        {group.items.map((item) => (
          <SidebarItem
            key={item.id}
            item={item}
            isActive={isPathActive(activeNav, item.path)}
            collapsed
            nested={false}
            onClick={() => onNavigate(item.id, item.path)}
          />
        ))}
      </div>
    )
  }

  const GroupIcon = group.icon

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={contentId}
        className={cn(
          'flex h-9 w-full items-center gap-2.5 rounded-lg px-3 text-start',
          'text-xs font-semibold tracking-wide',
          'transition-colors duration-150 motion-reduce:transition-none',
          hasActive && !open
            ? 'text-[hsl(var(--color-primary))]'
            : 'text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-secondary))]',
        )}
      >
        <GroupIcon className="size-4 shrink-0" aria-hidden="true" />
        <span className="flex-1 truncate">{group.label}</span>
        {/* A dot when the current page is inside a closed group — otherwise
            closing a group hides the only sign of where you are. */}
        {hasActive && !open ? (
          <span
            aria-hidden="true"
            className="size-1.5 shrink-0 rounded-full bg-[hsl(var(--color-primary))]"
          />
        ) : null}
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'size-3.5 shrink-0 transition-transform duration-150 motion-reduce:transition-none',
            open ? 'rotate-0' : 'rtl:rotate-90 ltr:-rotate-90',
          )}
        />
      </button>

      {/* ⚠️ `grid-template-rows` 0fr→1fr, not `height: auto`.
          Height cannot be transitioned from a measured value without either a
          layout read on every frame or a JS-driven height, and both cost more
          than this does. The child needs `overflow-hidden` or its content
          spills while the row is still collapsing. */}
      <div
        id={contentId}
        className={cn(
          'grid transition-[grid-template-rows] duration-150 ease-out',
          'motion-reduce:transition-none',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-0.5 pt-0.5" hidden={!open}>
            {group.items.map((item) => (
              <SidebarItem
                key={item.id}
                item={item}
                isActive={isPathActive(activeNav, item.path)}
                collapsed={false}
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
SidebarGroup.displayName = 'SidebarGroup'

export const DashboardSidebar = memo(function DashboardSidebar({
  primaryItems,
  moreGroups,
  activeNav,
  onNavigate,
}: {
  primaryItems: NavItem[]
  moreGroups: NavGroup[]
  /** Kept for the callers that also render `BottomNav`; the desktop sidebar no
   *  longer has a «More» button to put it on. */
  moreIcon?: ElementType
  activeNav: string
  onNavigate: (id: string, path: string) => void
}) {
  const t = useTranslations()
  const user = useAuthStore((s) => s.user)
  const [collapsed, setCollapsed, hydrated] = useSidebarCollapsed()

  // Only the groups the person has explicitly toggled. Everything else follows
  // the current route, which is what makes «auto-open the active group» work
  // without fighting the user.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})

  const toggleGroup = useCallback((id: string, next: boolean) => {
    setOverrides((prev) => ({ ...prev, [id]: next }))
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'b' && event.key !== 'B') return
      if (!(event.metaKey || event.ctrlKey)) return
      if (isTypingTarget(event.target)) return
      event.preventDefault()
      setCollapsed(!collapsed)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [collapsed, setCollapsed])

  const toggleLabel = collapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        aria-label={t('nav.mainNav')}
        style={{ width: collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED }}
        className={cn(
          'sticky top-0 hidden h-screen shrink-0 lg:flex lg:flex-col',
          'border-e border-[hsl(var(--border-default))]',
          'bg-[hsl(var(--surface-base))]',
          // ⚠️ No transition until the stored preference has been applied, or
          // a collapsed user watches it slide shut on every single page load.
          hydrated && 'transition-[width] duration-150 ease-out motion-reduce:transition-none',
        )}
      >
        {/* ── Header ── */}
        <div
          className={cn(
            'flex shrink-0 items-center gap-2.5 border-b border-[hsl(var(--border-default))]',
            collapsed ? 'h-16 justify-center px-0' : 'h-16 px-4',
          )}
        >
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <img
                  src="/logo-icon.png"
                  alt={t('app.name')}
                  className="size-9 shrink-0 object-contain"
                />
              </TooltipTrigger>
              <TooltipContent side="right">
                {user?.businessName || user?.fullName || t('app.name')}
              </TooltipContent>
            </Tooltip>
          ) : (
            <>
              <img
                src="/logo-icon.png"
                alt=""
                aria-hidden="true"
                className="size-9 shrink-0 object-contain"
              />
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-semibold text-[hsl(var(--fg-primary))]">
                  {t('app.name')}
                </span>
                {/* Real data only. When there is no business name yet there is
                    no second line — an invented one would be worse than none. */}
                {user?.businessName || user?.fullName ? (
                  <span className="truncate text-[11px] text-[hsl(var(--fg-tertiary))]">
                    {user.businessName || user.fullName}
                  </span>
                ) : null}
              </div>
            </>
          )}
        </div>

        {/* ── Navigation ──
            Only this scrolls, so the header and the footer stay put. */}
        <nav
          className={cn(
            'flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain py-3',
            collapsed ? 'px-3' : 'px-3',
          )}
        >
          {primaryItems.map((item) => (
            <SidebarItem
              key={item.id}
              item={item}
              isActive={isPathActive(activeNav, item.path)}
              collapsed={collapsed}
              nested={false}
              onClick={() => onNavigate(item.id, item.path)}
            />
          ))}

          <div className="mt-2 flex flex-col gap-1">
            {moreGroups.map((group) => {
              const hasActive = group.items.some((item) => isPathActive(activeNav, item.path))
              const open = overrides[group.id] ?? hasActive
              return (
                <SidebarGroup
                  key={group.id}
                  group={group}
                  activeNav={activeNav}
                  collapsed={collapsed}
                  open={open}
                  onToggle={() => toggleGroup(group.id, !open)}
                  onNavigate={onNavigate}
                />
              )
            })}
          </div>
        </nav>

        {/* ── Footer ── */}
        <div
          className={cn(
            'shrink-0 border-t border-[hsl(var(--border-default))] p-3',
            collapsed && 'flex justify-center',
          )}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setCollapsed(!collapsed)}
                aria-label={toggleLabel}
                aria-expanded={!collapsed}
                className={cn(
                  'flex h-9 items-center rounded-lg text-sm',
                  'text-[hsl(var(--fg-tertiary))] transition-colors duration-150',
                  'hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]',
                  'motion-reduce:transition-none',
                  collapsed ? 'w-9 justify-center' : 'w-full gap-2.5 px-3',
                )}
              >
                <PanelLeft aria-hidden="true" className="size-[18px] shrink-0 rtl:rotate-180" />
                {collapsed ? null : <span className="truncate">{toggleLabel}</span>}
              </button>
            </TooltipTrigger>
            {/* Only useful when there is no visible label. */}
            {collapsed ? <TooltipContent side="right">{toggleLabel}</TooltipContent> : null}
          </Tooltip>
        </div>

        {/* ── Rail ──
            The full-height edge of the sidebar is a second, much larger target
            for the same toggle. `end-0` and `translate-x` are logical, so it
            sits on the inner edge in both directions. It is `aria-hidden`
            because it duplicates the footer button, which is the accessible
            one — announcing the same action twice is noise. */}
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => setCollapsed(!collapsed)}
          title={toggleLabel}
          className={cn(
            'absolute inset-y-0 end-0 w-3 translate-x-1/2 cursor-pointer',
            'after:absolute after:inset-y-0 after:start-1/2 after:w-[2px]',
            'after:-translate-x-1/2 after:bg-transparent',
            'hover:after:bg-[hsl(var(--color-primary)/0.35)]',
            'after:transition-colors after:duration-150 motion-reduce:after:transition-none',
          )}
        />
      </aside>
    </TooltipProvider>
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
