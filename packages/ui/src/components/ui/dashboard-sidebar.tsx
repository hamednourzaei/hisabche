'use client'

import { memo, useState, useRef, useEffect, useCallback, useId, useMemo } from 'react'
import { ChevronLeft, LayoutGrid, X } from 'lucide-react'
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

/** Rail: icons only. Expanded, it carries the domain names too. */
const RAIL_WIDTH = 68
const RAIL_WIDTH_EXPANDED = 220
/** The contextual panel — wide enough for the longest destination name. */
const PANEL_WIDTH = 264

/** The synthesised domain holding the daily destinations. */
const PRIMARY_SECTION = 'primary'

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

interface SidebarState {
  /** Rail shows names as well as icons. */
  railExpanded: boolean
  /** The contextual panel is showing. */
  panelOpen: boolean
  /** The domain the person chose. `null` = follow the current route. */
  section: string | null
}

const DEFAULT_STATE: SidebarState = { railExpanded: false, panelOpen: true, section: null }

/**
 * The sidebar's shape, persisted per browser.
 *
 * ⚠️ READ IN AN EFFECT, NOT DURING RENDER. The server has no `localStorage`, so
 * seeding state from it renders one HTML on the server and another on the
 * client, and React discards the whole tree with a hydration error. Every first
 * paint therefore uses the defaults and the stored shape applies on the next
 * tick.
 *
 * ⚠️ `section` IS DELIBERATELY NOT PERSISTED. A domain chosen last Tuesday is
 * not where the reader is today — restoring it would open the app showing a
 * list that has nothing to do with the page on screen. Only the SHAPE is
 * remembered; the content follows the route until the rail is clicked.
 */
function useSidebarState(): [SidebarState, (patch: Partial<SidebarState>) => void] {
  const [state, setStateRaw] = useState<SidebarState>(DEFAULT_STATE)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SIDEBAR_STORAGE_KEY)
      if (!raw) return
      const stored = JSON.parse(raw) as Partial<SidebarState>
      setStateRaw((prev) => ({
        ...prev,
        railExpanded: stored.railExpanded === true,
        // `!== false` rather than `=== true`: the panel is open by DEFAULT, and
        // a stored object written before this key existed must not close it.
        panelOpen: stored.panelOpen !== false,
      }))
    } catch {
      // Private mode, blocked site data, or a value from an older shape.
      // None of these are a reason to fail to render a navigation bar.
    }
  }, [])

  const setState = useCallback((patch: Partial<SidebarState>) => {
    setStateRaw((prev) => {
      const next = { ...prev, ...patch }
      try {
        window.localStorage.setItem(
          SIDEBAR_STORAGE_KEY,
          JSON.stringify({ railExpanded: next.railExpanded, panelOpen: next.panelOpen }),
        )
      } catch {
        // The preference is a convenience; losing it must not break navigating.
      }
      return next
    })
  }, [])

  return [state, setState]
}

/** One destination. Collapsed, its tooltip is the only label there is.
 *  Exported because the documentation sidebar renders through this exact
 *  component — the two menus look identical because they ARE identical. */
export const SidebarItem = memo(function SidebarItem({
  item,
  isActive,
  collapsed,
  nested,
  href,
  onClick,
}: {
  item: NavItem
  isActive: boolean
  collapsed: boolean
  nested: boolean
  /**
   * Render as a link rather than a button.
   *
   * ⚠️ A `<button>` IS NOT A LINK. It cannot be opened in a new tab, it has no
   * URL to copy, and a crawler does not follow it — which for the public
   * documentation means every article would be an orphan reachable only by
   * typing its address. The dashboard has no such need (it is `noindex` and
   * navigates through the router), so this stays optional and the dashboard
   * keeps its buttons.
   */
  href?: string
  /** Receives the event so a link variant can honour a modified click. */
  onClick: (event: React.MouseEvent<HTMLElement>) => void
}) {
  // ⚠️ `> 0`, not `!= null`. A badge is there to say «something is waiting for
  // you»; a grey circle reading «۰» says the opposite while still drawing the
  // eye, and every destination with a counter wore one permanently.
  const badge = item.badge != null && item.badge > 0 ? item.badge : null

  const Tag = href ? 'a' : 'button'

  const button = (
    <Tag
      // `type` is meaningless on an anchor and React warns about it.
      {...(href ? { href } : { type: 'button' as const })}
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
    </Tag>
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
 * A domain, as the rail understands it.
 *
 * `primary` is synthesised from `primaryItems` so the rail has one shape to
 * iterate: the daily destinations are a domain like any other, they simply
 * happen to be the first one and the one a new workspace opens on.
 */
interface RailSection {
  id: string
  label: string
  icon: ElementType
  items: NavItem[]
}

/** The rail: one icon per domain. */
const SidebarRail = memo(function SidebarRail({
  sections,
  activeSectionId,
  activeNav,
  expanded,
  onSelect,
  onToggle,
  toggleLabel,
}: {
  sections: RailSection[]
  activeSectionId: string
  activeNav: string
  expanded: boolean
  onSelect: (id: string) => void
  onToggle: () => void
  toggleLabel: string
}) {
  return (
    <div
      style={{ width: expanded ? RAIL_WIDTH_EXPANDED : RAIL_WIDTH }}
      className={cn(
        'flex h-full shrink-0 flex-col',
        'border-e border-[hsl(var(--border-default))]',
        'bg-[hsl(var(--surface-base))]',
        'transition-[width] duration-200 ease-out motion-reduce:transition-none',
      )}
    >
      {/* The toggle sits in its own row at the top, aligned with the panel's
          header, so the two columns share one horizontal rule rather than each
          starting at a different height. */}
      <div className="flex h-14 shrink-0 items-center justify-center border-b border-[hsl(var(--border-default))]">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onToggle}
              aria-label={toggleLabel}
              aria-expanded={expanded}
              className={cn(
                'flex size-10 items-center justify-center rounded-xl',
                'text-[hsl(var(--fg-tertiary))] transition-colors',
                'hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]',
                'motion-reduce:transition-none',
              )}
            >
              {/* One chevron, rotated — not two icons. `rtl:rotate-180` puts it
                  the right way round in Persian without a second asset. */}
              <ChevronLeft
                aria-hidden="true"
                className={cn(
                  'size-[18px] transition-transform duration-200 rtl:rotate-180',
                  'motion-reduce:transition-none',
                  expanded && 'rotate-180 rtl:rotate-0',
                )}
              />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">{toggleLabel}</TooltipContent>
        </Tooltip>
      </div>

      <nav
        aria-label={toggleLabel}
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain p-2"
      >
        {sections.map((section) => {
          const Icon = section.icon
          const isCurrent = section.id === activeSectionId
          // A domain that CONTAINS the current page, which is not the same as
          // the one being browsed: someone can open «سامانه» in the panel
          // while still sitting on an invoice.
          const holdsActive = section.items.some((item) => isPathActive(activeNav, item.path))

          const button = (
            <button
              type="button"
              onClick={() => onSelect(section.id)}
              aria-current={isCurrent ? 'true' : undefined}
              // ⚠️ ALWAYS LABELLED, NOT ONLY WHEN COLLAPSED.
              //
              // A collapsed rail button contains an icon and nothing else. Its
              // name came from the tooltip — which Radix renders into a portal
              // ONLY while the pointer is over it, so to a screen reader every
              // one of these was an unnamed button. The label is also what
              // `getByRole('button', { name })` finds, which is how this was
              // caught at all.
              aria-label={section.label}
              className={cn(
                'group relative flex h-11 w-full items-center rounded-xl',
                'text-sm font-medium transition-colors duration-150',
                'motion-reduce:transition-none',
                expanded ? 'gap-3 px-2.5' : 'justify-center px-0',
                isCurrent
                  ? 'bg-[hsl(var(--color-primary)/0.10)] text-[hsl(var(--color-primary))]'
                  : 'text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]',
              )}
            >
              {isCurrent ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-y-2.5 end-0 w-[3px] rounded-full bg-[hsl(var(--color-primary))]"
                />
              ) : null}

              <span className="flex size-8 shrink-0 items-center justify-center">
                <Icon className="size-[18px]" aria-hidden="true" />
              </span>

              {expanded ? <span className="truncate">{section.label}</span> : null}

              {/* ⚠️ Where you ARE, when it is not where you are LOOKING.
                  Without this, browsing another domain leaves no trace of the
                  page actually open, and the rail claims you are somewhere you
                  are not. */}
              {holdsActive && !isCurrent ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    'size-1.5 shrink-0 rounded-full bg-[hsl(var(--color-primary))]',
                    expanded ? 'ms-auto' : 'absolute end-2 top-2.5',
                  )}
                />
              ) : null}
            </button>
          )

          if (expanded) return <div key={section.id}>{button}</div>

          return (
            <Tooltip key={section.id}>
              <TooltipTrigger asChild>{button}</TooltipTrigger>
              <TooltipContent side="right">{section.label}</TooltipContent>
            </Tooltip>
          )
        })}
      </nav>
    </div>
  )
})
SidebarRail.displayName = 'SidebarRail'

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
  const [state, setState] = useSidebarState()

  const sections = useMemo<RailSection[]>(
    () => [
      // Synthesised, so the rail iterates ONE shape. The daily destinations are
      // a domain like any other — the first one, and the one a workspace opens
      // on — rather than a special case threaded through every branch below.
      { id: PRIMARY_SECTION, label: t('nav.groups.main'), icon: LayoutGrid, items: primaryItems },
      ...moreGroups.map((group) => ({
        id: group.id,
        label: group.label,
        icon: group.icon,
        items: group.items,
      })),
    ],
    [primaryItems, moreGroups, t],
  )

  /**
   * ⚠️ THE ROUTE WINS UNTIL THE PERSON CHOOSES.
   *
   * `state.section` is null until the rail is clicked, and the panel follows
   * the current page — so navigating from an invoice to a bank statement moves
   * the panel with you. Once a domain is picked deliberately it stays picked,
   * because browsing «سامانه» while sitting on an invoice is a thing people do
   * on purpose and having the panel snap back would make it impossible.
   */
  const sectionOfRoute =
    sections.find((section) => section.items.some((item) => isPathActive(activeNav, item.path)))
      ?.id ?? PRIMARY_SECTION

  const activeSectionId = state.section ?? sectionOfRoute
  const activeSection = sections.find((s) => s.id === activeSectionId) ?? sections[0]!

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'b' && event.key !== 'B') return
      if (!(event.metaKey || event.ctrlKey)) return
      if (isTypingTarget(event.target)) return
      event.preventDefault()
      setState({ panelOpen: !state.panelOpen })
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [state.panelOpen, setState])

  const railToggleLabel = state.railExpanded ? t('nav.collapseSidebar') : t('nav.expandSidebar')
  const panelToggleLabel = state.panelOpen ? t('nav.collapseSidebar') : t('nav.expandSidebar')

  return (
    <TooltipProvider delayDuration={200}>
      <div className="sticky top-0 hidden h-screen shrink-0 lg:flex" aria-label={t('nav.mainNav')}>
        <SidebarRail
          sections={sections}
          activeSectionId={activeSectionId}
          activeNav={activeNav}
          expanded={state.railExpanded}
          onSelect={(id) =>
            // Choosing a domain always opens the panel: selecting one and
            // seeing nothing happen (because it was closed) is the kind of
            // dead click that makes people stop using a control.
            setState({ section: id, panelOpen: true })
          }
          onToggle={() => setState({ railExpanded: !state.railExpanded })}
          toggleLabel={railToggleLabel}
        />

        {/* ── The contextual panel ── */}
        <aside
          style={{ width: state.panelOpen ? PANEL_WIDTH : 0 }}
          className={cn(
            'flex h-full flex-col overflow-hidden',
            'border-e border-[hsl(var(--border-default))]',
            'bg-[hsl(var(--surface-base))]',
            'transition-[width] duration-200 ease-out motion-reduce:transition-none',
          )}
        >
          {/* ⚠️ `w-[var]` on a fixed inner width, not on the aside's children.
              The aside animates to 0, and content that reflows while it does
              produces a visible squeeze of every label. A fixed-width inner
              layer slides behind the edge instead. */}
          {/* ⚠️ `hidden`, NOT JUST ZERO WIDTH.
              A panel animated to `width: 0` under `overflow-hidden` is
              invisible but still in the document: Tab walked through every
              destination in it and a screen reader read them all out. `hidden`
              takes them out of both. The width transition still runs on the
              `aside`, so closing still animates — the content simply leaves
              first, which is the correct order for something being removed. */}
          <div
            hidden={!state.panelOpen}
            style={{ width: PANEL_WIDTH }}
            className="flex h-full flex-col"
          >
            <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-[hsl(var(--border-default))] px-3">
              <div className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-[11px] text-[hsl(var(--fg-tertiary))]">
                  {user?.businessName || user?.fullName || t('app.name')}
                </span>
                <span className="truncate text-sm font-semibold text-[hsl(var(--fg-primary))]">
                  {activeSection.label}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setState({ panelOpen: false })}
                aria-label={panelToggleLabel}
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-lg',
                  'text-[hsl(var(--fg-tertiary))] transition-colors',
                  'hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]',
                  'motion-reduce:transition-none',
                )}
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain p-2">
              {activeSection.items.map((item) => (
                <SidebarItem
                  key={item.id}
                  item={item}
                  isActive={isPathActive(activeNav, item.path)}
                  collapsed={false}
                  nested={false}
                  onClick={() => onNavigate(item.id, item.path)}
                />
              ))}
            </nav>
          </div>
        </aside>

        {/* ── Reopening ──
            ⚠️ WITHOUT THIS THE PANEL IS A ONE-WAY DOOR. Closing it leaves the
            rail, and the rail's own toggle changes its WIDTH, not the panel —
            so the only way back was to pick a domain, which also navigates the
            panel somewhere you may not have wanted. A thin strip on the closed
            edge puts it back exactly as it was. */}
        {state.panelOpen ? null : (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setState({ panelOpen: true })}
                aria-label={panelToggleLabel}
                className={cn(
                  'group flex w-3 shrink-0 items-center justify-center',
                  'border-e border-[hsl(var(--border-default))]',
                  'bg-[hsl(var(--surface-base))] transition-colors',
                  'hover:bg-[hsl(var(--surface-muted))] motion-reduce:transition-none',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'h-8 w-[2px] rounded-full bg-transparent transition-colors',
                    'group-hover:bg-[hsl(var(--color-primary)/0.4)]',
                    'motion-reduce:transition-none',
                  )}
                />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{panelToggleLabel}</TooltipContent>
          </Tooltip>
        )}
      </div>
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
