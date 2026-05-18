"use client"

import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Badge, SyncStatus } from '@hisabche/ui'
import { useThemeStore } from '@hisabche/store'
import { changeLanguage, type SupportedLanguage } from '@hisabche/i18n'
import { Languages, Sun, Moon, LogOut } from 'lucide-react'

interface DashboardHeaderProps {
  businessName?: string | undefined
  lastSyncedAt: number | null
  isOnline: boolean
  isSyncing: boolean
  pendingCount: number
  currentLang: string
  onLogout: () => void | Promise<void>
}

export function DashboardHeader({
  businessName,
  lastSyncedAt,
  isOnline,
  isSyncing,
  pendingCount,
  currentLang,
  onLogout,
}: DashboardHeaderProps) {
  const { t } = useTranslation()
  const { isDark, toggle } = useThemeStore()

  const toggleLang = useCallback(() => {
    const next = (currentLang === 'fa-AF' ? 'fa-IR' : 'fa-AF') as SupportedLanguage
    changeLanguage(next)
  }, [currentLang])

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--hisab-border)] bg-[var(--hisab-background)]/80 backdrop-blur-sm">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--hisab-primary)] flex items-center justify-center">
            <span className="text-white font-bold text-sm">ح</span>
          </div>
          <h1 className="text-lg font-bold text-[var(--hisab-foreground)]">{t('app.name')}</h1>
          <Badge variant="success" size="sm">{businessName ?? t('nav.dashboard')}</Badge>
          <SyncStatus lastSyncedAt={lastSyncedAt} isOnline={isOnline} isSyncing={isSyncing} pendingCount={pendingCount} />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" onClick={toggleLang}><Languages className="size-4" /></Button>
          <Button variant="ghost" size="icon-sm" onClick={toggle}>{isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}</Button>
          <Button variant="ghost" size="sm" onClick={onLogout} icon={<LogOut className="size-4" />}>{t('auth.signOut')}</Button>
        </div>
      </div>
    </header>
  )
}