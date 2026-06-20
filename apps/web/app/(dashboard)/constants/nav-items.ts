import { LayoutDashboard, Package, Receipt, BookOpen, Settings, type LucideIcon, Building2 } from 'lucide-react'

export interface NavItem {
  id: 'dashboard' | 'godam' | 'faktoor' | 'baqidari' | 'settings' | 'workspace'
  icon: LucideIcon
  labelKey: string
  descriptionKey: string
  path: string
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard', descriptionKey: 'nav.dashboard.description', path: '/dashboard' },
  { id: 'godam', icon: Package, labelKey: 'nav.godam', descriptionKey: 'nav.godam.description', path: '/godam' },
  { id: 'faktoor', icon: Receipt, labelKey: 'nav.faktoor', descriptionKey: 'nav.faktoor.description', path: '/invoices' },
  { id: 'baqidari', icon: BookOpen, labelKey: 'nav.baqidari', descriptionKey: 'nav.baqidari.description', path: '/baqidari' },
  { id: 'workspace', icon: Building2, labelKey: 'workspace.title', descriptionKey: 'workspace.description', path: '/workspace' },
  { id: 'settings', icon: Settings, labelKey: 'nav.settings', descriptionKey: 'nav.settings.description', path: '/settings' },
] as const

export type NavId = NavItem['id']
export const SYNC_INTERVAL_MS = 30_000

export const COMMAND_ITEMS = [
  { id: 'dashboard',    labelKey: 'nav.dashboard',    descriptionKey: 'nav.dashboard.description',    icon: '📊', shortcut: '', path: '/dashboard' },
  { id: 'new-invoice',  labelKey: 'quickInvoice.title', descriptionKey: 'quickInvoice.description', icon: '🧾', shortcut: 'N', path: '/quick-invoice' },
  { id: 'godam',        labelKey: 'nav.godam',        descriptionKey: 'nav.godam.description',        icon: '📦', shortcut: '', path: '/godam' },
  { id: 'invoices',     labelKey: 'nav.faktoor',      descriptionKey: 'nav.faktoor.description',      icon: '📋', shortcut: '', path: '/invoices' },
  { id: 'baqidari',     labelKey: 'nav.baqidari',     descriptionKey: 'nav.baqidari.description',     icon: '📒', shortcut: '', path: '/baqidari' },
  { id: 'customers',    labelKey: 'baqidari.addCustomer', descriptionKey: 'baqidari.addCustomerDesc', icon: '👤', shortcut: '', path: '/baqidari?add=true' },
  { id: 'workspace',    labelKey: 'workspace.title',  descriptionKey: 'workspace.description',         icon: '🏢', shortcut: '', path: '/workspace' },
  { id: 'settings',     labelKey: 'nav.settings',     descriptionKey: 'nav.settings.description',     icon: '⚙️', shortcut: '', path: '/settings' },
  { id: 'sync',         labelKey: 'sync.title',       descriptionKey: 'sync.description',             icon: '🔄', shortcut: '', path: '/sync-center' },
] as const