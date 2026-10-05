'use client'

// ============================================
// «داده و همگام‌سازی» — the overview and the three screens it used to link to,
// at one address: `/data-and-sync`.
//
//   overview   the status page (as it was)
//   details    one at a time behind a switch: «همگام‌سازی» (was /sync-center),
//              «تعارض‌ها» (was /conflicts), «انتقال داده» (was /data-migration)
//
// They read the same records — the sync queue, the open conflicts, the
// migrations — so they are one page (owner's standing order, 5 Oct 2026).
//
// ⚠️ A hub over the screens that already exist: `PageHub` mounts each
// container; nothing is fetched here.
// ============================================

import { lazy } from 'react'
import { useTranslations } from 'next-intl'
import { Activity, ListTree } from 'lucide-react'

import { PageHub } from '../../page-hub'
import { DataAndSyncContainer } from './data-and-sync-container'

const SyncCenterContainer = lazy(() =>
  import('../../sync-center/containers/sync-center-container').then((m) => ({
    default: m.SyncCenterContainer,
  })),
)
const ConflictsContainer = lazy(() =>
  import('../../conflicts/containers/conflicts-container').then((m) => ({
    default: m.ConflictsContainer,
  })),
)
const DataMigrationContainer = lazy(() =>
  import('../../data-migration/containers/data-migration-container').then((m) => ({
    default: m.DataMigrationContainer,
  })),
)

/** Section → the page it came from (its lock in `NAV_MODULE`, its menu entry). */
export const DATA_HUB_SOURCES = {
  sync: '/sync-center',
  conflicts: '/conflicts',
  migration: '/data-migration',
} as const

export function DataHubContainer() {
  return <DataHub />
}

function DataHub() {
  const t = useTranslations()
  return (
    <PageHub
      label={t('nav.data_and_sync')}
      sectionsLabel={t('dataHub.sectionsLabel')}
      loadingLabel={t('dataHub.loading')}
      tabs={[
        {
          id: 'overview',
          label: t('dataHub.tabs.overview'),
          icon: Activity,
          sections: [
            { id: 'status', label: t('nav.data_and_sync'), render: () => <DataAndSyncContainer /> },
          ],
        },
        {
          id: 'details',
          label: t('dataHub.tabs.details'),
          icon: ListTree,
          sections: [
            {
              id: 'sync',
              label: t('nav.sync'),
              source: DATA_HUB_SOURCES.sync,
              render: () => <SyncCenterContainer />,
            },
            {
              id: 'conflicts',
              label: t('nav.conflicts'),
              source: DATA_HUB_SOURCES.conflicts,
              render: () => <ConflictsContainer />,
            },
            {
              id: 'migration',
              label: t('nav.data_migration'),
              source: DATA_HUB_SOURCES.migration,
              render: () => <DataMigrationContainer />,
            },
          ],
        },
      ]}
    />
  )
}
