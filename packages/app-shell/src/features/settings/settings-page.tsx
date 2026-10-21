// ============================================
// Settings — account, language, currency, local database status, updates.
// ============================================

import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LogOut } from 'lucide-react'

import { Badge, Button, Card, cn } from '@/components/ui/primitives'
import { SelectField } from '@hisabche/ui'
import { SettingsHubContainer, SettingsPage as SharedSettingsPage } from '@hisabche/ui/screens'
import { LogoutPendingDialog } from '@/components/layout/logout-pending-dialog'
import { useAuthStore, useCurrentUser } from '@/features/auth/auth.store'
import { bridge } from '@/shared/lib/bridge'
import { CURRENCY_CODES } from '@/shared/lib/currency'
import { useUiStore } from '@/shared/stores/ui.store'
import type { AppInfo } from '@hisabche/app-bridge'

import { UpdateSection } from './update-section'

/** The same hub as the web, around this renderer's own settings screen. */
export default function SettingsPage() {
  return <SettingsHubContainer general={renderDesktopSettings} />
}

const renderDesktopSettings = () => <DesktopSettings />

function DesktopSettings() {
  const { t } = useTranslation('desktop')
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

  // ⚠️ THE SAME PAGE AS THE WEB (owner, 21 Oct 2026). Only two parts are
  // this device's own: the account card (sign-out asks about unsent offline
  // changes) and the device cards (display currency, local database,
  // version, updates). Language is the shared «زبان برنامه» section.
  return (
    <SharedSettingsPage
      accountSlot={
        <Card>
          <h2 className="mb-3 text-sm font-bold">{t('auth.title')}</h2>
          <p className="text-sm">{user?.fullName ?? '—'}</p>
          <p className="text-xs text-[hsl(var(--fg-secondary))]">{user?.email ?? '—'}</p>

          <Button variant="danger" size="sm" className="mt-4" onClick={() => void logout()}>
            <LogOut size={14} />
            {t('common.logout')}
          </Button>
          <LogoutPendingDialog />
        </Card>
      }
      deviceSlot={
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <h2 className="mb-3 text-sm font-bold">{t('nav.settings')}</h2>

            {/* The site's own dropdown, as every other choice in the product. */}
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-[hsl(var(--fg-secondary))]">{t('sync.displayCurrency')}</span>
                <SelectField
                  value={currency}
                  onChange={(next) => setCurrency(next as (typeof CURRENCY_CODES)[number])}
                  options={CURRENCY_CODES.map((code) => ({ value: code, label: code }))}
                  aria-label={t('sync.displayCurrency')}
                />
              </label>
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-bold">{t('sync.title')}</h2>

            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-[hsl(var(--fg-secondary))]">{t('sync.deviceDatabase')}</span>
                <Badge tone={info?.databaseReady ? 'success' : 'warning'}>
                  {info?.databaseReady ? t('sync.dbReady') : t('sync.localOnly')}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[hsl(var(--fg-secondary))]">{t('sync.appVersion')}</span>
                <span className={cn('tabular-nums')}>{info?.version ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[hsl(var(--fg-secondary))]">{t('sync.platform')}</span>
                <span>{info?.platform ?? '—'}</span>
              </div>
            </div>
          </Card>

          {/* ⚠️ The «تازه‌سازی» button that used to sit inside the card above is
            gone. It called a main-process function that returned `void`, so it
            could report nothing — see `update-section.tsx`. */}
          <UpdateSection />
        </div>
      }
    />
  )
}
