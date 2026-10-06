// ============================================
// packages/ui/src/lib/menu/nav-items.ts
//
// The web/desktop *renderer* view of the navigation contract.
//
// The destinations, their copy, their grouping and the command palette live in
// `@hisabche/ui-contract` — a package with no DOM and no React, so mobile can
// import the same data. This file adds only what a lucide-based renderer needs:
// an icon component per entry. Nothing here decides what the product's
// navigation *is*; change `ui-contract/src/navigation.ts` for that.
// ============================================

import {
  LayoutDashboard,
  PlusCircle,
  Wallet,
  Boxes,
  TrendingUp,
  Users,
  BookOpen,
  Kanban,
  Factory,
  ClipboardCheck,
  Settings,
  Bell,
  RefreshCw,
  EllipsisVertical,
  History,
  Calculator,
  CreditCard,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
  DatabaseZap,
  Store,
  LineChart,
} from 'lucide-react'
import {
  COMMAND_CONTRACT,
  MORE_GROUPS_CONTRACT,
  NAV_CONTRACT,
  SYNC_INTERVAL_MS,
  type CommandItemContract,
  type NavGroupId,
  type NavId,
  type NavItemContract,
} from '@hisabche/ui-contract'

export type { NavId, NavGroupId }
export type CommandItem = CommandItemContract
export { SYNC_INTERVAL_MS }

export interface NavItem extends NavItemContract {
  icon: LucideIcon
}

export interface NavGroup {
  id: NavGroupId
  labelKey: string
  icon: LucideIcon
  items: NavItem[]
}

/** Icon per destination. Exhaustive over `NavId`, so a new entry cannot be
 *  added to the contract without the compiler asking for its icon here. */
const NAV_ICONS: Record<NavId, LucideIcon> = {
  today: LayoutDashboard,
  sell: PlusCircle,
  'get-paid': Wallet,
  stock: Boxes,
  money: TrendingUp,
  buyers: BookOpen,
  // G1: 'team' removed with the /human-resources entry — 'coworkers' below
  // is the People destination now.
  production: Factory,
  approvals: ClipboardCheck,
  settings: Settings,
  // `history` is declared in the contract's id union but has no destination
  // yet; the map stays exhaustive so adding one needs no icon archaeology.
  history: History,
  events: Bell,
  sync: RefreshCw,
  till: Calculator,
  // NOT `Database`: Next's package-import optimizer resolves that particular
  // lucide name to a module namespace rather than the component, and React
  // rejects it — taking the whole sidebar down on every page. `DatabaseZap`
  // and the rest resolve correctly; this one does not.
  // G1: 'customer-list' and 'product-list' removed with their nav entries.
  'data-and-sync': RefreshCw,
  coworkers: Wallet,
  billing: CreditCard,
  'market-seller': Store,
  analysis: LineChart,
  governance: ShieldCheck,
  assistant: Sparkles,
}

const GROUP_ICONS: Record<Exclude<NavGroupId, 'primary'>, LucideIcon> = {
  people: Users,
  work: Kanban,
  system: Settings,
}

function withIcon(item: NavItemContract): NavItem {
  return { ...item, icon: NAV_ICONS[item.id] }
}

export const NAV_ITEMS: NavItem[] = NAV_CONTRACT.map(withIcon)

// آیتم‌های همیشه-دیده — کارهای هر روزِ یک فروشنده
export const PRIMARY_ITEMS: NavItem[] = NAV_ITEMS.filter((i) => i.group === 'primary')

// گروه‌های کم‌استفاده — فقط داخل «بیشتر»
export const MORE_GROUPS: NavGroup[] = MORE_GROUPS_CONTRACT.map((group) => ({
  id: group.id,
  labelKey: group.labelKey,
  icon: GROUP_ICONS[group.id],
  items: group.items.map(withIcon),
}))

// آیکون دکمه «بیشتر»
export const MORE_ICON = EllipsisVertical

// Command palette — همان واژگانِ ناوبری، بدون تکرار مقصد.
export const COMMAND_ITEMS: CommandItem[] = [...COMMAND_CONTRACT]

/** Whether a destination is locked for someone with these blocked modules (see ui-contract NAV_MODULE). */
export { isNavLocked, isRouteDenied } from '@hisabche/ui-contract'
