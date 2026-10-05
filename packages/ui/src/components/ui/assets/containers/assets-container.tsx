'use client'

// ============================================
// packages/ui/src/components/ui/assets/containers/assets-container.tsx
// ============================================

import { memo, useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  asList,
  useAssetSchedule,
  useAssets,
  usePostDepreciation,
  useCreateAsset,
  useDisposeAsset,
  type CreateAssetInput,
  type DepreciationRunResult,
  type FixedAsset,
  type ScheduleRow,
  apiErrorMessage,
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
  const createAsset = useCreateAsset()
  const disposeAsset = useDisposeAsset()
  const { mutateAsync: saveAsset } = createAsset
  const { mutateAsync: saveDisposal } = disposeAsset

  // The dialog shows what the server said — never a swallowed error.
  const handleCreate = async (input: CreateAssetInput) => {
    try {
      const created = await saveAsset(input)
      setSelectedId(created.id)
    } catch (err) {
      throw new Error(apiErrorMessage(err, t('common.saveError', 'انجام نشد')), { cause: err })
    }
  }
  const handleDispose = async (input: {
    assetId: string
    onDate: string
    proceedsMinor: number
  }) => {
    try {
      await saveDisposal(input)
    } catch (err) {
      throw new Error(apiErrorMessage(err, t('common.saveError', 'انجام نشد')), { cause: err })
    }
  }

  const handleRun = useCallback(() => {
    setActionError(null)
    postDepreciation.mutate(
      {},
      {
        onSuccess: (result) => setLastRun(result),
        onError: (err) => {
          const message = apiErrorMessage(err, t('common.saveError', 'انجام نشد'))
          setActionError(message)
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
      assets={asList<FixedAsset>(assets.data)}
      selectedId={selectedId}
      schedule={asList<ScheduleRow>(schedule.data)}
      isLoading={assets.isLoading}
      isScheduleLoading={Boolean(selectedId) && schedule.isLoading}
      scheduleError={selectedId && schedule.error ? (schedule.error as Error).message : null}
      error={assets.error ? (assets.error as Error).message : null}
      actionError={actionError}
      isBusy={postDepreciation.isPending}
      lastRun={lastRun}
      onSelect={setSelectedId}
      onRunDepreciation={handleRun}
      onRefresh={handleRefresh}
      onCreate={handleCreate}
      onDispose={handleDispose}
      isSaving={createAsset.isPending || disposeAsset.isPending}
    />
  )
})

AssetsContainer.displayName = 'AssetsContainer'
