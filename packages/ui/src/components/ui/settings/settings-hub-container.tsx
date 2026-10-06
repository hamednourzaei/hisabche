'use client'

// ============================================
// «تنظیمات» — the business's own settings and what is connected to it, at one
// address: `/settings`.
//
//   general        the settings page (as it was)
//   integrations   one at a time behind a switch: «توسعه‌دهندگان» — keys,
//                  webhooks and apps (was /developers) — and «بازار برنامه‌ها»
//                  (was /marketplace), which installs the same apps
//
// The two came in because they read and write the same records — API keys and
// app installations (owner's standing order, 5 Oct 2026: fewer routes).
//
// ⚠️ A hub over the screens that already exist: `PageHub` mounts each
// container; nothing is fetched here.
// ============================================

import { lazy, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Plug, Settings } from 'lucide-react'

import { PageHub } from '../page-hub'
import { SettingsPage } from './settings-page'

const DevelopersContainer = lazy(() =>
  import('../developers/containers/developers-container').then((m) => ({
    default: m.DevelopersContainer,
  })),
)
const MarketplaceContainer = lazy(() =>
  import('../marketplace/containers/marketplace-container').then((m) => ({
    default: m.MarketplaceContainer,
  })),
)

/** Section → the page it came from. */
export const SETTINGS_HUB_SOURCES = {
  developers: '/developers',
  marketplace: '/marketplace',
} as const

export interface SettingsHubProps {
  /**
   * The settings screen of this renderer. The web's is the default; the desktop
   * shell passes its own (local database, updates), so both get the same hub.
   */
  general?: (() => ReactNode) | undefined
}

const webSettings = () => <SettingsPage />

export function SettingsHubContainer({ general = webSettings }: SettingsHubProps) {
  return <SettingsHub general={general} />
}

function SettingsHub({ general }: { general: () => ReactNode }) {
  const t = useTranslations()
  return (
    <PageHub
      lookId="settings"
      label={t('nav.settings')}
      sectionsLabel={t('settingsHub.sectionsLabel')}
      loadingLabel={t('settingsHub.loading')}
      tabs={[
        {
          id: 'general',
          label: t('settingsHub.tabs.general'),
          icon: Settings,
          sections: [{ id: 'general', label: t('nav.settings'), render: general }],
        },
        {
          id: 'integrations',
          label: t('settingsHub.tabs.integrations'),
          icon: Plug,
          sections: [
            {
              id: 'developers',
              label: t('settingsHub.sections.developers'),
              source: SETTINGS_HUB_SOURCES.developers,
              render: () => <DevelopersContainer />,
            },
            {
              id: 'marketplace',
              label: t('settingsHub.sections.marketplace'),
              source: SETTINGS_HUB_SOURCES.marketplace,
              render: () => <MarketplaceContainer />,
            },
          ],
        },
      ]}
    />
  )
}
