"use client"

import { useTranslation } from 'react-i18next'
import { Button } from '@hisabche/ui'
import type { ElementType } from 'react'

export interface NavItem {
  id: string
  icon: ElementType<any>
  label: string
  path: string
}

export function DashboardSidebar({
  items,
  activeNav,
  onNavigate,
}: {
  items: NavItem[]
  activeNav: string
  onNavigate: (id: string, path: string) => void
}) {
  const { t } = useTranslation()

  return (
    <aside className="hidden w-64 border-e border-[var(--hisab-border)] bg-[var(--hisab-card)] p-4 lg:flex lg:flex-col">
      <nav className="flex flex-col gap-1">
        {items.map((item) => (
          <Button
            key={item.id}
            variant={activeNav === item.id ? 'default' : 'ghost'}
            size="default"
            fullWidth
            onClick={() => onNavigate(item.id, item.path)}
            icon={<item.icon className="size-5" />}
            className="justify-start"
          >
            {t(item.label)}
          </Button>
        ))}
      </nav>
    </aside>
  )
}

export function BottomNav({
  items,
  activeNav,
  onNavigate,
}: {
  items: NavItem[]
  activeNav: string
  onNavigate: (id: string, path: string) => void
}) {
  const { t } = useTranslation()

  return (
    <nav className="sticky bottom-0 border-t border-[var(--hisab-border)] bg-[var(--hisab-background)] lg:hidden">
      <div className="flex justify-around px-2 py-2">
        {items.slice(0, 4).map((item) => (
          <Button
            key={item.id}
            variant={activeNav === item.id ? 'default' : 'ghost'}
            size="icon"
            onClick={() => onNavigate(item.id, item.path)}
            className="flex-col gap-0.5 h-auto py-1.5"
            aria-label={t(item.label)}
          >
            <item.icon className="size-5" />
            <span className="text-[10px]">{t(item.label)}</span>
          </Button>
        ))}
      </div>
    </nav>
  )
}