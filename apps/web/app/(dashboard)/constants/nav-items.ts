import { LayoutDashboard, Package, Receipt, BookOpen, Settings } from 'lucide-react'
import type { ElementType } from 'react'

export interface NavItem {
  id: 'dashboard' | 'godam' | 'faktoor' | 'baqidari' | 'settings'
  icon: ElementType<any>
  label: string
  description: string
  path: string
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'nav.dashboard', description: 'nav.dashboard.description', path: '/' },
  { id: 'godam', icon: Package, label: 'nav.godam', description: 'nav.godam.description', path: '/godam' },
  { id: 'faktoor', icon: Receipt, label: 'nav.faktoor', description: 'nav.faktoor.description', path: '/invoices' },
  { id: 'baqidari', icon: BookOpen, label: 'nav.baqidari', description: 'nav.baqidari.description', path: '/baqidari' },
  { id: 'settings', icon: Settings, label: 'nav.settings', description: 'nav.settings.description', path: '/settings' },
] as const

export type NavId = NavItem['id']
export const SYNC_INTERVAL_MS = 30_000