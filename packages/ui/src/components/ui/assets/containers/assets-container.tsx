'use client'

// ============================================
// packages/ui/src/components/ui/assets/containers/assets-container.tsx
// ============================================

import { memo, useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  useAssetSchedule,
  useAssets,
  usePostDepreciation,
  type DepreciationRunResult,
} from '@hisabche/api'
import { AssetsView } from '../assets-view'

export const AssetsContainer = memo(function AssetsContainer() {
  const translate = useTranslations()
  const t = (key: string, fallback?: string): string => {
    const value = translate(key as Parameters<typeof translate>[0])
    return value && value !== key ? value : (fallback ?? key)
  }

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [lastRun, setLastRun] = useState<DepreciationRunResult | null>(null)

  const assets = useAssets()
  const schedule = useAssetSchedule(selectedId ?? '')
  const postDepreciation = usePostDepreciation()

  const handleRun = useCallback(() => {
    setActionError(null)
    postDepreciation.mutate(
      {},
      {
        onSuccess: (result) => setLastRun(result),
        onError: (err) => {
          const message =
            (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
            (err as Error)?.message
          setActionError(message ?? null)
        },
      },
    )
  }, [postDepreciation])

  const handleRefresh = useCallback(() => {
    setActionError(null)
    assets.refetch()
    if (selectedId) schedule.refetch()
  }, [assets, schedule, selectedId])

  return (
    <AssetsView
      t={t}
      assets={assets.data ?? []}
      selectedId={selectedId}
      schedule={schedule.data ?? []}
      isLoading={assets.isLoading}
      isScheduleLoading={Boolean(selectedId) && schedule.isLoading}
      error={assets.error ? (assets.error as Error).message : null}
      actionError={actionError}
      isBusy={postDepreciation.isPending}
      lastRun={lastRun}
      onSelect={setSelectedId}
      onRunDepreciation={handleRun}
      onRefresh={handleRefresh}
    />
  )
})

AssetsContainer.displayName = 'AssetsContainer'
