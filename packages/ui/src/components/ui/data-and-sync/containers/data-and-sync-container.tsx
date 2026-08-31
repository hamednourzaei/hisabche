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
import { useConflicts, useMigrations } from '@hisabche/api'
import { useSyncStore } from '@hisabche/store'

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

  // A failed or in-flight count is `null`, never 0. The view renders the two
  // differently on purpose: "no conflicts" is a fact somebody may act on, and
  // "we could not check" is not.
  const conflictCount =
    conflicts.isLoading || conflicts.isError ? null : (conflicts.data?.length ?? 0)

  const handleRefresh = useCallback(() => {
    conflicts.refetch()
    migrations.refetch()
  }, [conflicts, migrations])

  return (
    <DataAndSyncView
      t={t}
      isOnline={isOnline}
      isSyncing={isSyncing}
      pendingCount={pendingCount}
      lastSyncedAt={lastSyncedAt}
      conflictCount={conflictCount}
      lastMigration={migrations.data?.[0] ?? null}
      migrationCount={migrations.data?.length ?? 0}
      isLoading={migrations.isLoading}
      error={migrations.error ? (migrations.error as Error).message : null}
      onNavigate={onNavigate}
      onRefresh={handleRefresh}
    />
  )
})

DataAndSyncContainer.displayName = 'DataAndSyncContainer'
