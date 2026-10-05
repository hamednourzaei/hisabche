'use client'

// ============================================
// packages/ui/src/components/ui/expiry/containers/expiry-container.tsx
// ============================================

import { memo, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import {
  apiErrorMessage,
  asList,
  useBatches,
  useExpiryReport,
  useUpdateBatchDates,
  useWarehouseOverview,
  type StockBatch,
} from '@hisabche/api'

import { useLocalePush } from '../../../../hooks/use-locale-push'
import { ExpiryView } from '../expiry-view'

export const ExpiryContainer = memo(function ExpiryContainer() {
  const translate = useTranslations()
  const t = useCallback(
    (key: string, fallback?: string): string => {
      const value = translate(key as Parameters<typeof translate>[0])
      return value && value !== key ? value : (fallback ?? key)
    },
    [translate],
  )
  const push = useLocalePush()

  const report = useExpiryReport()
  const batches = useBatches()
  const warehouses = useWarehouseOverview()
  const updateDates = useUpdateBatchDates()

  const handleRefresh = useCallback(() => {
    report.refetch()
    batches.refetch()
  }, [batches, report])

  // The mutation invalidates every expiry read, so the table, the four figures
  // and the product's own expiry panel all follow the new date.
  const { mutateAsync } = updateDates
  const handleSaveExpiry = useCallback(
    async (batchId: string, expiryDate: string | null) => {
      try {
        await mutateAsync({ batchId, expiryDate })
      } catch (err) {
        throw new Error(
          apiErrorMessage(err, t('expiry.save_failed', 'ذخیره نشد. دوباره تلاش کنید.')),
          { cause: err },
        )
      }
    },
    [mutateAsync, t],
  )

  // The same product page a row of the warehouse table opens.
  const openProduct = useCallback((productId: string) => push(`/warehouse/${productId}`), [push])

  return (
    <ExpiryView
      t={t}
      report={report.data ?? null}
      batches={asList<StockBatch>(batches.data)}
      warehouses={asList<{ id: string; name: string }>(warehouses.data?.warehouses)}
      isLoading={report.isLoading}
      error={report.error ? (report.error as Error).message : null}
      isSaving={updateDates.isPending}
      onSaveExpiry={handleSaveExpiry}
      onOpenProduct={openProduct}
      onRefresh={handleRefresh}
    />
  )
})

ExpiryContainer.displayName = 'ExpiryContainer'
