// ============================================
// apps/web/app/(dashboard)/constants/nav-items.ts
// ============================================

import {
  LayoutDashboard, Package, Receipt, BookOpen, Settings,
  Users, Kanban, Shield, Building2, Key, EllipsisVertical,
  Calculator, Handshake, Factory, ShoppingCart,
  type LucideIcon
} from 'lucide-react'

export interface NavItem {
  id: 'dashboard' | 'warehouse' | 'invoices' | 'customers' | 'human-resources' | 'projects' | 'audit' | 'permissions' | 'workspace' | 'settings' | 'accounting' | 'crm' | 'manufacturing' | 'purchasing'
  icon: LucideIcon
  labelKey: string
  descriptionKey: string
  path: string
  group?: 'main' | 'sales' | 'team' | 'system' | 'business'
}

export interface NavGroup {
  id: string;
  labelKey: string;
  icon: LucideIcon;
  items: NavItem[];
}

export const NAV_ITEMS: NavItem[] = [
  // ─── اصلی ───
  { id: 'dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard', descriptionKey: 'nav.dashboard.description', path: '/dashboard', group: 'main' },

  // ─── فروش و موجودی ───
  { id: 'invoices', icon: Receipt, labelKey: 'nav.invoices', descriptionKey: 'nav.invoices.description', path: '/invoices', group: 'sales' },
  { id: 'customers', icon: BookOpen, labelKey: 'nav.customers', descriptionKey: 'nav.customers.description', path: '/customers', group: 'sales' },
  { id: 'warehouse', icon: Package, labelKey: 'nav.warehouse', descriptionKey: 'nav.warehouse.description', path: '/warehouse', group: 'sales' },  // ← تغییر

  // ─── تیم ───
  { id: 'human-resources', icon: Users, labelKey: 'nav.humanResources', descriptionKey: 'nav.humanResources.description', path: '/human-resources', group: 'team' },  // ← تغییر
  { id: 'projects', icon: Kanban, labelKey: 'nav.projects', descriptionKey: 'nav.projects.description', path: '/projects', group: 'team' },
  { id: 'workspace', icon: Building2, labelKey: 'workspace.title', descriptionKey: 'workspace.description', path: '/workspace', group: 'team' },

  // ─── کسب‌وکار ───
  { id: 'accounting', icon: Calculator, labelKey: 'nav.accounting', descriptionKey: 'nav.accounting.description', path: '/accounting', group: 'business' },
  { id: 'crm', icon: Handshake, labelKey: 'nav.crm', descriptionKey: 'nav.crm.description', path: '/crm', group: 'business' },
  { id: 'manufacturing', icon: Factory, labelKey: 'nav.manufacturing', descriptionKey: 'nav.manufacturing.description', path: '/manufacturing', group: 'business' },
  { id: 'purchasing', icon: ShoppingCart, labelKey: 'nav.purchasing', descriptionKey: 'nav.purchasing.description', path: '/purchasing', group: 'business' },

  // ─── سیستم ───
  { id: 'permissions', icon: Key, labelKey: 'nav.permissions', descriptionKey: 'nav.permissions.description', path: '/permissions', group: 'system' },
  { id: 'audit', icon: Shield, labelKey: 'nav.audit', descriptionKey: 'nav.audit.description', path: '/audit', group: 'system' },
  { id: 'settings', icon: Settings, labelKey: 'nav.settings', descriptionKey: 'nav.settings.description', path: '/settings', group: 'system' },
] as const

// آیتم‌های اصلی (بدون گروه‌بندی — همیشه نمایش داده می‌شوند)
export const PRIMARY_ITEMS: NavItem[] = NAV_ITEMS.filter(
  (i) => i.group === 'main' || i.group === 'sales'
)

// گروه‌های پنهان (فقط تو «بیشتر» نمایش داده می‌شوند)
export const MORE_GROUPS: NavGroup[] = [
  { id: 'business', labelKey: 'nav.groups.business', icon: Calculator, items: NAV_ITEMS.filter((i) => i.group === 'business') },
  { id: 'team', labelKey: 'nav.groups.team', icon: Users, items: NAV_ITEMS.filter((i) => i.group === 'team') },
  { id: 'system', labelKey: 'nav.groups.system', icon: Settings, items: NAV_ITEMS.filter((i) => i.group === 'system') },
]

// آیکون دکمه «بیشتر»
export const MORE_ICON = EllipsisVertical

export type NavId = NavItem['id']
export const SYNC_INTERVAL_MS = 30_000

export const COMMAND_ITEMS = [
  { id: 'dashboard',    labelKey: 'nav.dashboard',    descriptionKey: 'nav.dashboard.description',    icon: '📊', shortcut: '', path: '/dashboard' },
  { id: 'new-invoice',  labelKey: 'quickInvoice.title', descriptionKey: 'quickInvoice.description', icon: '🧾', shortcut: 'N', path: '/quick-invoice' },
  { id: 'warehouse',    labelKey: 'nav.warehouse',    descriptionKey: 'nav.warehouse.description',    icon: '📦', shortcut: '', path: '/warehouse' },  // ← تغییر
  { id: 'invoices',     labelKey: 'nav.invoices',      descriptionKey: 'nav.invoices.description',      icon: '📑', shortcut: '', path: '/invoices' },
  { id: 'customers',     labelKey: 'nav.customers',     descriptionKey: 'nav.customers.description',     icon: '📒', shortcut: '', path: '/customers' },
  { id: 'customers',    labelKey: 'customers.addCustomer', descriptionKey: 'customers.addCustomerDesc', icon: '👤', shortcut: '', path: '/customers?add=true' },
  { id: 'human-resources', labelKey: 'nav.humanResources', descriptionKey: 'nav.humanResources.description', icon: '👥', shortcut: '', path: '/human-resources' },  // ← تغییر
  { id: 'projects',     labelKey: 'nav.projects',     descriptionKey: 'nav.projects.description',     icon: '📋', shortcut: '', path: '/projects' },
  { id: 'accounting',   labelKey: 'nav.accounting',   descriptionKey: 'nav.accounting.description',   icon: '🧮', shortcut: '', path: '/accounting' },
  { id: 'crm',          labelKey: 'nav.crm',          descriptionKey: 'nav.crm.description',          icon: '🤝', shortcut: '', path: '/crm' },
  { id: 'manufacturing', labelKey: 'nav.manufacturing', descriptionKey: 'nav.manufacturing.description', icon: '🏭', shortcut: '', path: '/manufacturing' },
  { id: 'purchasing',   labelKey: 'nav.purchasing',   descriptionKey: 'nav.purchasing.description',   icon: '🛒', shortcut: '', path: '/purchasing' },
  { id: 'permissions',  labelKey: 'nav.permissions',  descriptionKey: 'nav.permissions.description',  icon: '🔑', shortcut: '', path: '/permissions' },
  { id: 'audit',        labelKey: 'nav.audit',        descriptionKey: 'nav.audit.description',        icon: '🛡️', shortcut: '', path: '/audit' },
  { id: 'workspace',    labelKey: 'workspace.title',  descriptionKey: 'workspace.description',         icon: '🏢', shortcut: '', path: '/workspace' },
  { id: 'settings',     labelKey: 'nav.settings',     descriptionKey: 'nav.settings.description',     icon: '⚙️', shortcut: '', path: '/settings' },
  { id: 'sync',         labelKey: 'sync.title',       descriptionKey: 'sync.description',             icon: '🔄', shortcut: '', path: '/sync-center' },
] as const