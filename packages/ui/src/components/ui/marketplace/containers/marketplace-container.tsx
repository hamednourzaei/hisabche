'use client'

// ============================================
// packages/ui/src/components/ui/marketplace/containers/marketplace-container.tsx
//
// Every data hook of the marketplace screen lives here; the view takes props
// only. `initialApp` opens one listing directly (the web page passes ?app=).
// ============================================

import { memo, useCallback, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import type { AppCategory } from '@hisabche/validation'
import {
  useDeleteAppReview,
  useMarketplaceApp,
  useMarketplaceApps,
  useReportApp,
  useSaveAppReview,
} from '@hisabche/api'

import { useDateFormat } from '../../../../hooks/use-date-format'
import { oauthErrorMessage } from '../../../../lib/oauth-labels'
import { useToast } from '../../toast-provider'
import { MarketplaceView, type MarketplaceState } from '../marketplace-view'

function stateOf(isLoading: boolean, error: unknown): MarketplaceState {
  if (isLoading) return 'loading'
  if (!error) return 'ready'
  const status = (error as { response?: { status?: number } } | null)?.response?.status
  // 503 = the marketplace migration has not run; 404 = no such listing (or not
  // published). Neither is «there are no apps».
  if (status === 503) return 'not-configured'
  if (status === 404) return 'not-found'
  return 'error'
}

export const MarketplaceContainer = memo(function MarketplaceContainer({
  initialApp,
}: {
  initialApp?: string | undefined
}) {
  const tOriginal = useTranslations()
  const t = useCallback(
    (key: string, fallback?: string): string => {
      const value = tOriginal(key as Parameters<typeof tOriginal>[0])
      return value && value !== key ? value : (fallback ?? key)
    },
    [tOriginal],
  )
  const { dateTime } = useDateFormat()
  // The reader's language, for number and money formatting only.
  const locale = useLocale()
  const toast = useToast()

  const [category, setCategory] = useState<AppCategory | 'all'>('all')
  const [query, setQuery] = useState('')
  // The search waits for the typing to stop.
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 300)
    return () => clearTimeout(id)
  }, [query])

  const [selected, setSelected] = useState<string | null>(initialApp ?? null)
  const [reportDone, setReportDone] = useState<'new' | 'duplicate' | null>(null)

  const list = useMarketplaceApps({ category, q: debounced })
  const detail = useMarketplaceApp(selected)
  const saveReview = useSaveAppReview()
  const deleteReview = useDeleteAppReview()
  const report = useReportApp()

  const failed = useCallback(
    (error: unknown) => toast.error(oauthErrorMessage(t, error, t('developer.actionFailed'))),
    [toast, t],
  )

  const appId = detail.data?.id ?? null

  return (
    <MarketplaceView
      t={t}
      lang={locale}
      formatDate={dateTime}
      category={category}
      onCategory={setCategory}
      query={query}
      onQuery={setQuery}
      listState={stateOf(list.isLoading, list.error)}
      apps={list.data ?? []}
      onOpen={(slugOrId) => {
        setReportDone(null)
        saveReview.reset()
        setSelected(slugOrId)
      }}
      selected={selected}
      onBack={() => setSelected(null)}
      detailState={stateOf(detail.isLoading, detail.error)}
      detail={detail.data ?? null}
      savingReview={saveReview.isPending}
      reviewError={
        saveReview.error
          ? oauthErrorMessage(t, saveReview.error, t('developer.actionFailed'))
          : null
      }
      onSaveReview={(input) => {
        if (!appId) return
        saveReview.mutate(
          { appId, ...input },
          { onSuccess: () => toast.success(t('marketplace.reviewSaved')) },
        )
      }}
      onDeleteReview={() => {
        if (appId) deleteReview.mutate(appId, { onError: failed })
      }}
      reporting={report.isPending}
      reportDone={reportDone}
      onReport={(input) => {
        if (!appId) return
        report.mutate(
          { appId, ...input },
          {
            onSuccess: (out) => setReportDone(out.duplicate ? 'duplicate' : 'new'),
            onError: failed,
          },
        )
      }}
      onRetry={() => {
        void list.refetch()
        if (selected) void detail.refetch()
      }}
    />
  )
})

MarketplaceContainer.displayName = 'MarketplaceContainer'
