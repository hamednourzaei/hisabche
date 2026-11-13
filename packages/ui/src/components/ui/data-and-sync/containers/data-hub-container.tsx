'use client'

// ============================================
// «داده و همگام‌سازی» — ONE tab at one address: `/data-and-sync`
// (owner request, 9 Nov 2026: «?tab=details کامل حذف می‌شود»).
//
//   status     the overview, with the full-data download and the sync tools
//              (was /sync-center) under it — backup history, recent activity
//              and network status were removed
//   conflicts  was /conflicts
//   migration  was /data-migration
//
// They read the same records — the sync queue, the open conflicts, the
// migrations — so they are one page (owner's standing order, 5 Oct 2026).
//
// ⚠️ A hub over the screens that already exist: `PageHub` mounts each
// container; nothing is fetched here.
// ============================================

import { lazy } from 'react'
import { useTranslations } from 'next-intl'
import { Activity } from 'lucide-react'
import { useMyCapabilities } from '@hisabche/api'
import { isNavLocked } from '@hisabche/ui-contract'

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
const SnapshotsSection = lazy(() =>
  import('../../erp-core/snapshots-section').then((m) => ({ default: m.SnapshotsSection })),
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
  const capabilities = useMyCapabilities().data
  const blocked = capabilities?.blockedModules ?? []
  // Snapshots are manager and up on the server; the role here only decides
  // whether to OFFER the section (the server still checks every request).
  const mayTakeSnapshots = ['owner', 'admin', 'manager'].includes(capabilities?.role ?? '')
  const syncLocked = isNavLocked(DATA_HUB_SOURCES.sync, blocked)
  return (
    <PageHub
      lookId="data"
      label={t('nav.data_and_sync')}
      sectionsLabel={t('dataHub.sectionsLabel')}
      loadingLabel={t('dataHub.loading')}
      tabs={[
        {
          id: 'overview',
          label: t('dataHub.tabs.overview'),
          icon: Activity,
          sections: [
            {
              id: 'status',
              label: t('nav.data_and_sync'),
              render: () => (
                <div className="space-y-6">
                  <DataAndSyncContainer />
                  {/* The old /sync-center keeps its own lock. */}
                  {syncLocked ? null : <SyncCenterContainer />}
                </div>
              ),
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
            ...(mayTakeSnapshots
              ? [
                  {
                    id: 'snapshots',
                    label: t('dataHub.snapshots'),
                    render: () => <SnapshotsSection />,
                  },
                ]
              : []),
          ],
        },
      ]}
    />
  )
}
