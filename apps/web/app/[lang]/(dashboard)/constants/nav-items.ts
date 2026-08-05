// ============================================
// apps/web/app/[lang]/(dashboard)/constants/nav-items.ts
//
// Intent-driven navigation.
// Every entry answers one sentence: "I came here because I want to ___".
// Primary = the six things a shop owner does every day.
// Secondary = everything they do occasionally, grouped by who/what it is about.
//
// Paths are limited to routes that actually exist under (dashboard)/.
// ============================================

import {
  LayoutDashboard, PlusCircle, Wallet, Boxes, ShoppingCart, TrendingUp,
  Users, BookOpen, Handshake, Kanban, Factory, ClipboardCheck,
  Settings, Key, Bell, RefreshCw, EllipsisVertical,
  type LucideIcon
} from 'lucide-react'

export type NavId =
  // primary — daily intents
  | 'today' | 'sell' | 'get-paid' | 'stock' | 'buy' | 'money'
  // secondary — people
  | 'buyers' | 'follow-up' | 'team'
  // secondary — work
  | 'projects' | 'production' | 'approvals'
  // secondary — system
  | 'settings' | 'access' | 'history' | 'events' | 'sync'

export type NavGroupId = 'primary' | 'people' | 'work' | 'system'

export interface NavItem {
  id: NavId
  icon: LucideIcon
  /** Used by the command palette, which renders a text glyph rather than a component. */
  emoji: string
  labelKey: string
  descriptionKey: string
  path: string
  group: NavGroupId
}

export interface NavGroup {
  id: NavGroupId
  labelKey: string
  icon: LucideIcon
  items: NavItem[]
}

export const NAV_ITEMS: NavItem[] = [
  // ─── کارهای هر روز ───
  { id: 'today',    icon: LayoutDashboard, emoji: '☀️', labelKey: 'nav.today',   descriptionKey: 'nav.today_description',   path: '/dashboard',     group: 'primary' },
  { id: 'sell',     icon: PlusCircle,      emoji: '➕', labelKey: 'nav.sell',    descriptionKey: 'nav.sell_description',    path: '/quick-invoice', group: 'primary' },
  { id: 'get-paid', icon: Wallet,          emoji: '💰', labelKey: 'nav.getPaid', descriptionKey: 'nav.getPaid_description', path: '/invoices',      group: 'primary' },
  { id: 'stock',    icon: Boxes,           emoji: '📦', labelKey: 'nav.stock',   descriptionKey: 'nav.stock_description',   path: '/warehouse',     group: 'primary' },
  { id: 'buy',      icon: ShoppingCart,    emoji: '🛒', labelKey: 'nav.buy',     descriptionKey: 'nav.buy_description',     path: '/purchasing',    group: 'primary' },
  { id: 'money',    icon: TrendingUp,      emoji: '📈', labelKey: 'nav.money',   descriptionKey: 'nav.money_description',   path: '/accounting',    group: 'primary' },

  // ─── مردم ───
  { id: 'buyers',    icon: BookOpen,  emoji: '📒', labelKey: 'nav.buyers',    descriptionKey: 'nav.buyers_description',    path: '/customers',       group: 'people' },
  { id: 'follow-up', icon: Handshake, emoji: '🤝', labelKey: 'nav.followUp',  descriptionKey: 'nav.followUp_description',  path: '/crm',             group: 'people' },
  { id: 'team',      icon: Users,     emoji: '👥', labelKey: 'nav.team',      descriptionKey: 'nav.team_description',      path: '/human-resources', group: 'people' },

  // ─── کارها ───
  { id: 'projects',   icon: Kanban,  emoji: '📋', labelKey: 'nav.projects',   descriptionKey: 'nav.projects_description',   path: '/projects',      group: 'work' },
  { id: 'production', icon: Factory, emoji: '🏭', labelKey: 'nav.production', descriptionKey: 'nav.production_description', path: '/manufacturing', group: 'work' },
  { id: 'approvals',  icon: ClipboardCheck, emoji: '✅', labelKey: 'nav.approvals', descriptionKey: 'nav.approvals_description', path: '/approvals', group: 'work' },

  // ─── تنظیمات و امنیت ───
  { id: 'settings', icon: Settings,  emoji: '⚙️', labelKey: 'nav.settings', descriptionKey: 'nav.settings_description', path: '/settings',    group: 'system' },
  { id: 'access',   icon: Key,       emoji: '🔑', labelKey: 'nav.access',   descriptionKey: 'nav.access_description',   path: '/permissions', group: 'system' },
  { id: 'events',   icon: Bell,      emoji: '🔔', labelKey: 'nav.events',   descriptionKey: 'nav.events_description',   path: '/activities',  group: 'system' },
  { id: 'sync',     icon: RefreshCw, emoji: '🔄', labelKey: 'nav.sync',     descriptionKey: 'nav.sync_description',     path: '/sync-center', group: 'system' },
]

// آیتم‌های همیشه-دیده — کارهای هر روزِ یک فروشنده
export const PRIMARY_ITEMS: NavItem[] = NAV_ITEMS.filter((i) => i.group === 'primary')

// گروه‌های کم‌استفاده — فقط داخل «بیشتر»
export const MORE_GROUPS: NavGroup[] = [
  { id: 'people', labelKey: 'nav.groups.people', icon: Users,    items: NAV_ITEMS.filter((i) => i.group === 'people') },
  { id: 'work',   labelKey: 'nav.groups.work',   icon: Kanban,   items: NAV_ITEMS.filter((i) => i.group === 'work') },
  { id: 'system', labelKey: 'nav.groups.system', icon: Settings, items: NAV_ITEMS.filter((i) => i.group === 'system') },
]

// آیکون دکمه «بیشتر»
export const MORE_ICON = EllipsisVertical

export const SYNC_INTERVAL_MS = 30_000

// Command palette — همان واژگانِ ناوبری، بدون تکرار مقصد.
// تنها موردی که در ناوبری نیست، «افزودن خریدار» است چون یک عمل است، نه یک مقصد.
export interface CommandItem {
  id: string
  labelKey: string
  descriptionKey: string
  icon: string
  shortcut: string
  path: string
}

export const COMMAND_ITEMS: CommandItem[] = [
  ...NAV_ITEMS.map((item) => ({
    id: item.id as string,
    labelKey: item.labelKey,
    descriptionKey: item.descriptionKey,
    icon: item.emoji,
    shortcut: item.id === 'sell' ? 'N' : '',
    path: item.path,
  })),
  {
    id: 'add-buyer',
    labelKey: 'nav.addBuyer',
    descriptionKey: 'nav.addBuyer_description',
    icon: '👤',
    shortcut: '',
    path: '/customers?add=true',
  },
]
