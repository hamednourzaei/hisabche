// ============================================
// Settings — account, language, currency, local database status, updates.
// ============================================

import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LogOut } from 'lucide-react'

import { Badge, Button, Card, cn } from '@/components/ui/primitives'
import { PageHeader } from '@/components/layout/page-header'
import { useAuthStore, useCurrentUser } from '@/features/auth/auth.store'
import { bridge } from '@/shared/lib/bridge'
import { setDesktopLanguage, supportedLanguages, type SupportedLanguage } from '@/shared/i18n'
import { CURRENCY_CODES } from '@/shared/lib/currency'
import { useUiStore } from '@/shared/stores/ui.store'
import type { AppInfo } from '../../../electron/shared/ipc-contract'

export default function SettingsPage() {
  const { t, i18n } = useTranslation('desktop')
  const user = useCurrentUser()
  const logout = useAuthStore((s) => s.logout)

  const currency = useUiStore((s) => s.currency)
  const setCurrency = useUiStore((s) => s.setCurrency)

  const [info, setInfo] = useState<AppInfo | null>(null)

  useEffect(() => {
    let cancelled = false
    void bridge()
      ?.app.info()
      .then((value) => {
        if (!cancelled) setInfo(value)
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [])

  const changeLanguage = useCallback(async (lang: SupportedLanguage) => {
    await setDesktopLanguage(lang)
  }, [])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title={t('nav.settings')} />

      <div className="grid grid-cols-2 gap-4 overflow-y-auto p-4">
        <Card>
          <h2 className="mb-3 text-sm font-bold">{t('auth.title')}</h2>
          <p className="text-sm">{user?.fullName ?? '—'}</p>
          <p className="text-xs text-[hsl(var(--fg-secondary))]">{user?.email ?? '—'}</p>

          <Button variant="danger" size="sm" className="mt-4" onClick={() => void logout()}>
            <LogOut size={14} />
            {t('common.logout')}
          </Button>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-bold">{t('nav.settings')}</h2>

          <div className="mb-4 flex flex-wrap gap-2">
            {supportedLanguages.map((lang) => (
              <Button
                key={lang.code}
                size="sm"
                variant={i18n.language === lang.code ? 'primary' : 'outline'}
                onClick={() => void changeLanguage(lang.code)}
              >
                {lang.nativeName}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {CURRENCY_CODES.map((code) => (
              <Button
                key={code}
                size="sm"
                variant={currency === code ? 'primary' : 'outline'}
                onClick={() => setCurrency(code)}
              >
                {code}
              </Button>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-bold">{t('sync.title')}</h2>

          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[hsl(var(--fg-secondary))]">SQLite</span>
              <Badge tone={info?.databaseReady ? 'success' : 'warning'}>
                {info?.databaseReady ? 'ready' : t('sync.localOnly')}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[hsl(var(--fg-secondary))]">version</span>
              <span className={cn('tabular-nums')}>{info?.version ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[hsl(var(--fg-secondary))]">platform</span>
              <span>{info?.platform ?? '—'}</span>
            </div>
          </div>

          <Button
            size="sm"
            variant="secondary"
            className="mt-4"
            onClick={() => void bridge()?.app.checkUpdates()}
          >
            {t('common.refresh')}
          </Button>
        </Card>
      </div>
    </div>
  )
}
