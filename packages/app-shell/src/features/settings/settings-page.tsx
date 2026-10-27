// ============================================
// Settings — account, language, currency, local database status, updates.
// ============================================

import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LogOut } from 'lucide-react'

import { Badge, Button, Card, cn } from '@/components/ui/primitives'
import { SelectField, useDisplayBasis } from '@hisabche/ui'
import {
  IndustryProfileSection,
  SettingsHubContainer,
  SettingsPage as SharedSettingsPage,
} from '@hisabche/ui/screens'
import { useAuthStore as useSharedAuthStore } from '@hisabche/store'
import { apiClient } from '@/shared/lib/api'
import { LogoutPendingDialog } from '@/components/layout/logout-pending-dialog'
import { useAuthStore, useCurrentUser } from '@/features/auth/auth.store'
import { bridge } from '@/shared/lib/bridge'
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

  // ⚠️ ONE currency preference, the product's own (`useCurrencyStore`). This card
  // used to keep a currency of its own in the shell's UI store: it started at AFN
  // whatever the business chose in onboarding (a gold business read «AFN» here),
  // nothing read it, and changing it changed nothing.
  //
  // What it offers and what it means is `useDisplayBasis`: the books currency
  // until the person picks another, and only currencies that have a rate.
  const display = useDisplayBasis()

  const [info, setInfo] = useState<AppInfo | null>(null)

  /**
   * Offline/online both go through the SAME `/auth/profile` contract: the
   * local engine registers that route too, so this handler does not choose a
   * transport. The session is updated after the write so the effective profile,
   * defaults and dashboard order change without a restart.
   */
  const saveIndustry = async (businessTypes: string[]): Promise<void> => {
    await apiClient.patch('/auth/profile', { businessTypes })
    useAuthStore.setState((state) =>
      state.session
        ? { session: { ...state.session, user: { ...state.session.user, businessTypes } } }
        : {},
    )
    const shared = useSharedAuthStore.getState().user
    if (shared) useSharedAuthStore.setState({ user: { ...shared, businessTypes } })
  }

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
        <div className="space-y-4">
          <IndustryProfileSection
            businessTypes={user?.businessTypes ?? []}
            canEdit
            onSave={saveIndustry}
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card>
              <h2 className="mb-3 text-sm font-bold">{t('nav.settings')}</h2>

              {/* The site's own dropdown, as every other choice in the product. */}
              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="text-[hsl(var(--fg-secondary))]">
                    {t('sync.displayCurrency')}
                  </span>
                  <SelectField
                    value={display.basis}
                    // The books currency is «no choice made» — stored as null, so a later
                    // change of the books currency is followed rather than pinned.
                    onChange={(next) => display.setBasis(next === display.base ? null : next)}
                    options={display.availableBases.map((code) => ({ value: code, label: code }))}
                    aria-label={t('sync.displayCurrency')}
                  />
                </label>
              </div>
            </Card>

            <Card>
              <h2 className="mb-3 text-sm font-bold">{t('sync.title')}</h2>

              <div className="flex flex-col gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[hsl(var(--fg-secondary))]">
                    {t('sync.deviceDatabase')}
                  </span>
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
        </div>
      }
    />
  )
}
