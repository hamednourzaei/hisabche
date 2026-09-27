'use client'

// ============================================
// packages/ui/src/components/ui/data-and-sync/containers/data-and-sync-container.tsx
//
// ---------------------------------------------------------------------------
// NAVIGATION IS INJECTED, NOT IMPORTED
//
// This container runs inside Next's router on web and React Router on desktop.
// Importing either would make the component mountable on exactly one of them,
// which is the thing `@hisabche/ui/screens` exists to prevent. So the page
// passes `onNavigate` and the shared component stays shared.
// ============================================

import { memo, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import {
  asList,
  useConflicts,
  useDuplicateCounts,
  useMigrations,
  useSyncOverview,
  type ConflictSummary,
} from '@hisabche/api'
import { useBackupStore, useSyncStore } from '@hisabche/store'

import { DataAndSyncView } from '../data-and-sync-view'

export interface DataAndSyncContainerProps {
  onNavigate: (path: string) => void
}

export const DataAndSyncContainer = memo(function DataAndSyncContainer({
  onNavigate,
}: DataAndSyncContainerProps) {
  const translate = useTranslations()
  const t = useCallback(
    (key: string, fallback?: string): string => {
      const value = translate(key as Parameters<typeof translate>[0])
      return value && value !== key ? value : (fallback ?? key)
    },
    [translate],
  )

  const { isOnline, isSyncing, pendingCount, lastSyncedAt } = useSyncStore()

  // `useOpenConflictCount` is not used here on purpose: it returns a bare
  // number and reports an unread count as 0, which is precisely the
  // distinction this page has to keep. The query itself carries the
  // difference between 'none' and 'not known'.
  const conflicts = useConflicts('open')
  const migrations = useMigrations()
  const lastBackupAt = useBackupStore((s) => s.lastBackupAt)
  const syncOverview = useSyncOverview()
  const duplicates = useDuplicateCounts()

  // A failed or in-flight count is `null`, never 0. The view renders the two
  // differently on purpose: "no conflicts" is a fact somebody may act on, and
  // "we could not check" is not.
  const conflictCount =
    // `data === undefined` also covers a query that never ran (a role without
    // access to the conflict queue): unknown, not «no conflicts».
    conflicts.isLoading || conflicts.isError || conflicts.data === undefined
      ? null
      : conflicts.data.length

  const handleRefresh = useCallback(() => {
    conflicts.refetch()
    migrations.refetch()
    syncOverview.refetch()
    duplicates.refetch()
  }, [conflicts, migrations, syncOverview, duplicates])

  return (
    <DataAndSyncView
      t={t}
      isOnline={isOnline}
      isSyncing={isSyncing}
      pendingCount={pendingCount}
      lastSyncedAt={lastSyncedAt}
      conflictCount={conflictCount}
      conflicts={conflictCount === null ? null : asList<ConflictSummary>(conflicts.data)}
      lastBackupAt={lastBackupAt}
      lastMigration={migrations.data?.[0] ?? null}
      migrationCount={migrations.data?.length ?? 0}
      syncOverview={syncOverview.isError ? null : (syncOverview.data ?? null)}
      duplicates={duplicates.isError ? null : (duplicates.data ?? null)}
      isLoading={migrations.isLoading}
      error={migrations.error ? (migrations.error as Error).message : null}
      onNavigate={onNavigate}
      onRefresh={handleRefresh}
    />
  )
})

DataAndSyncContainer.displayName = 'DataAndSyncContainer'
