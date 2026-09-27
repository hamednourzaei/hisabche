'use client'

// ============================================
// packages/ui/src/components/ui/data-and-sync/containers/data-and-sync-container.tsx
//
// ---------------------------------------------------------------------------
// NAVIGATION IS OWNED HERE, NOT INJECTED
//
// It used to arrive as an `onNavigate` prop, on the theory that importing a
// router would tie the screen to one host. It does not: the shared shell build
// aliases `next/navigation` to its React Router shim, and `useLocalePush` adds
// the `[lang]` prefix only where one exists. Every page passed the identical
// function, and a server `page.tsx` cannot pass a function at all.
// ============================================

import { memo, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useLocalePush } from '../../../../hooks/use-locale-push'
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

export const DataAndSyncContainer = memo(function DataAndSyncContainer() {
  const onNavigate = useLocalePush()
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
