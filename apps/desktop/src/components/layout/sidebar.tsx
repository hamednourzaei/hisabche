// ============================================
// Sidebar — collapsible sections, keyboard reachable, RTL aware.
// Collapsed state persists so the app reopens the way it was left.
// ============================================

import React, { memo, useCallback } from 'react'
import { NavLink } from 'react-router-dom'
import { useTranslations } from 'next-intl'
import { ChevronsLeft, ChevronsRight, type LucideIcon } from 'lucide-react'
import { PRIMARY_ITEMS, MORE_GROUPS, type NavItem as SharedNavItem } from '@hisabche/ui/menu'

import { cn } from '@/components/ui/primitives'
import { useUiStore } from '@/shared/stores/ui.store'

interface NavItem {
  to: string
  labelKey: string
  icon: LucideIcon
}

interface NavSection {
  id: string
  items: readonly NavItem[]
}

// Sections come from the shared navigation contract, so desktop and web offer
// the same destinations under the same labels. Only the routes desktop actually
// mounts are shown — the rest of the web surface has no desktop screen yet, and
// listing a dead link is worse than omitting it.
const DESKTOP_ROUTES = new Set([
  '/dashboard',
  '/quick-invoice',
  '/invoices',
  '/warehouse',
  '/purchasing',
  '/accounting',
  '/customers',
  '/activities',
  '/sync-center',
  '/settings',
])

/** Desktop mounts the dashboard at `/`; the shared contract calls it `/dashboard`. */
function toDesktopPath(path: string): string {
  return path === '/dashboard' ? '/' : path
}

function toNavItem(item: SharedNavItem): NavItem {
  return { to: toDesktopPath(item.path), labelKey: item.labelKey, icon: item.icon }
}

const SECTIONS: readonly NavSection[] = [
  { id: 'primary', items: PRIMARY_ITEMS.filter((i) => DESKTOP_ROUTES.has(i.path)).map(toNavItem) },
  ...MORE_GROUPS.map((group) => ({
    id: group.id,
    items: group.items.filter((i) => DESKTOP_ROUTES.has(i.path)).map(toNavItem),
  })).filter((section) => section.items.length > 0),
]

const SidebarLink = memo(function SidebarLink({
  item,
  collapsed,
}: {
  item: NavItem
  collapsed: boolean
}) {
  const t = useTranslations()
  const label = t(item.labelKey)
  const Icon = item.icon

  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          'flex h-9 items-center gap-3 rounded-[var(--radius-sm)] px-2.5 text-sm transition-colors',
          isActive
            ? 'bg-[hsl(var(--color-primary)/0.14)] text-[hsl(var(--color-primary))]'
            : 'text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))]',
          collapsed && 'justify-center px-0',
        )
      }
    >
      <Icon size={17} aria-hidden />
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  )
})

export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const toggle = useUiStore((s) => s.toggleSidebar)

  const width = collapsed ? 'var(--sidebar-width-collapsed)' : 'var(--sidebar-width)'
  const onToggle = useCallback(() => toggle(), [toggle])

  return (
    <aside
      className="flex shrink-0 flex-col border-e border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))]"
      style={{ width }}
    >
      <div className="flex h-[var(--toolbar-height)] items-center gap-2 px-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[hsl(var(--color-primary))] text-[hsl(var(--color-primary-fg))]">
          <span className="text-sm font-bold">ح</span>
        </div>
        {!collapsed && <span className="truncate text-sm font-bold">Hisabche</span>}
      </div>

      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto p-2">
        {SECTIONS.map((section) => (
          <div key={section.id} className="flex flex-col gap-0.5">
            {section.items.map((item) => (
              <SidebarLink key={item.to} item={item} collapsed={collapsed} />
            ))}
          </div>
        ))}
      </nav>

      <button
        type="button"
        onClick={onToggle}
        aria-label="toggle sidebar"
        className="flex h-9 items-center justify-center border-t border-[hsl(var(--border-default))] text-[hsl(var(--fg-tertiary))] hover:text-[hsl(var(--fg-primary))]"
      >
        {collapsed ? <ChevronsLeft size={16} /> : <ChevronsRight size={16} />}
      </button>
    </aside>
  )
}
