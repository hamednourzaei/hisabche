// apps/web/app/(dashboard)/constants/nav-items.ts
import {
  LayoutDashboard, Package, Receipt, BookOpen, Settings,
  Users, Kanban, Shield, Building2, Key,
  type LucideIcon
} from 'lucide-react'

export interface NavItem {
  id: 'dashboard' | 'godam' | 'faktoor' | 'baqidari' | 'hr' | 'projects' | 'audit' | 'permissions' | 'workspace' | 'settings'
  icon: LucideIcon
  labelKey: string
  descriptionKey: string
  path: string
  group?: string  // 🆕 گروه‌بندی
}

export interface NavGroup {
  id: string;
  labelKey: string;
  icon: LucideIcon;  // ← باید باشه
  items: NavItem[];
}

// 🆕 گروه‌بندی آیتم‌ها
export const NAV_ITEMS: NavItem[] = [
  // ── اصلی ──
  { id: 'dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard', descriptionKey: 'nav.dashboard.description', path: '/dashboard', group: 'main' },
  
  // ── فروش و موجودی ──
  { id: 'faktoor', icon: Receipt, labelKey: 'nav.faktoor', descriptionKey: 'nav.faktoor.description', path: '/invoices', group: 'sales' },
  { id: 'baqidari', icon: BookOpen, labelKey: 'nav.baqidari', descriptionKey: 'nav.baqidari.description', path: '/baqidari', group: 'sales' },
  { id: 'godam', icon: Package, labelKey: 'nav.godam', descriptionKey: 'nav.godam.description', path: '/godam', group: 'sales' },
  
  // ── تیم ──
  { id: 'hr', icon: Users, labelKey: 'nav.hr', descriptionKey: 'nav.hr.description', path: '/hr', group: 'team' },
  { id: 'projects', icon: Kanban, labelKey: 'nav.projects', descriptionKey: 'nav.projects.description', path: '/projects', group: 'team' },
  { id: 'workspace', icon: Building2, labelKey: 'workspace.title', descriptionKey: 'workspace.description', path: '/workspace', group: 'team' },
  
  // ── سیستم ──
  { id: 'permissions', icon: Key, labelKey: 'nav.permissions', descriptionKey: 'nav.permissions.description', path: '/permissions', group: 'system' },
  { id: 'audit', icon: Shield, labelKey: 'nav.audit', descriptionKey: 'nav.audit.description', path: '/audit', group: 'system' },
  { id: 'settings', icon: Settings, labelKey: 'nav.settings', descriptionKey: 'nav.settings.description', path: '/settings', group: 'system' },
] as const

// 🆕 گروه‌های منو
export const NAV_GROUPS: NavGroup[] = [
  { id: 'main', labelKey: 'nav.groups.main', icon: LayoutDashboard, items: NAV_ITEMS.filter(i => i.group === 'main') },
  { id: 'sales', labelKey: 'nav.groups.sales', icon: Receipt, items: NAV_ITEMS.filter(i => i.group === 'sales') },
  { id: 'team', labelKey: 'nav.groups.team', icon: Users, items: NAV_ITEMS.filter(i => i.group === 'team') },
  { id: 'system', labelKey: 'nav.groups.system', icon: Settings, items: NAV_ITEMS.filter(i => i.group === 'system') },
]

export type NavId = NavItem['id']
export const SYNC_INTERVAL_MS = 30_000

export const COMMAND_ITEMS = [
  { id: 'dashboard',    labelKey: 'nav.dashboard',    descriptionKey: 'nav.dashboard.description',    icon: '📊', shortcut: '', path: '/dashboard' },
  { id: 'new-invoice',  labelKey: 'quickInvoice.title', descriptionKey: 'quickInvoice.description', icon: '🧾', shortcut: 'N', path: '/quick-invoice' },
  { id: 'godam',        labelKey: 'nav.godam',        descriptionKey: 'nav.godam.description',        icon: '📦', shortcut: '', path: '/godam' },
  { id: 'invoices',     labelKey: 'nav.faktoor',      descriptionKey: 'nav.faktoor.description',      icon: '📑', shortcut: '', path: '/invoices' },
  { id: 'baqidari',     labelKey: 'nav.baqidari',     descriptionKey: 'nav.baqidari.description',     icon: '📒', shortcut: '', path: '/baqidari' },
  { id: 'customers',    labelKey: 'baqidari.addCustomer', descriptionKey: 'baqidari.addCustomerDesc', icon: '👤', shortcut: '', path: '/baqidari?add=true' },
  { id: 'hr',           labelKey: 'nav.hr',           descriptionKey: 'nav.hr.description',           icon: '👥', shortcut: '', path: '/hr' },
  { id: 'projects',     labelKey: 'nav.projects',     descriptionKey: 'nav.projects.description',     icon: '📋', shortcut: '', path: '/projects' },
  { id: 'permissions',  labelKey: 'nav.permissions',  descriptionKey: 'nav.permissions.description',  icon: '🔑', shortcut: '', path: '/permissions' },
  { id: 'audit',        labelKey: 'nav.audit',        descriptionKey: 'nav.audit.description',        icon: '🛡️', shortcut: '', path: '/audit' },
  { id: 'workspace',    labelKey: 'workspace.title',  descriptionKey: 'workspace.description',         icon: '🏢', shortcut: '', path: '/workspace' },
  { id: 'settings',     labelKey: 'nav.settings',     descriptionKey: 'nav.settings.description',     icon: '⚙️', shortcut: '', path: '/settings' },
  { id: 'sync',         labelKey: 'sync.title',       descriptionKey: 'sync.description',             icon: '🔄', shortcut: '', path: '/sync-center' },
] as const