// ============================================
// List shell that renders the four required states
// (loading / error / empty / data) around a FlashList.
// ============================================

import React, { useCallback, type ReactElement } from 'react'
import { RefreshControl, View } from 'react-native'

import { FlashList, type ListRenderItem } from '@shopify/flash-list'
import { useTranslation } from 'react-i18next'
import {
  EmptyState,
  ErrorState,
  MobileCard,
  OfflineBanner,
  Skeleton,
  useTheme,
} from '@hisabche/mobile-ui'

import { useSyncRefresh } from '../../features/offline/use-sync-refresh'

const SKELETON_ROWS = 6

export interface QueryListProps<T> {
  data: T[] | undefined
  renderItem: ListRenderItem<T>
  keyExtractor: (item: T, index: number) => string
  estimatedItemSize: number
  isLoading: boolean
  error?: unknown
  /** The list's own refetch. Awaited by pull-to-refresh after the sync. */
  onRetry: () => unknown
  emptyTitle: string
  emptyDescription?: string | undefined
  emptyAction?: { label: string; onPress: () => void } | undefined
  header?: ReactElement | undefined
  /** Infinite scroll: asked for the next page when the end comes into view. */
  onEndReached?: (() => void) | undefined
  isFetchingMore?: boolean | undefined
}

export function QueryList<T>({
  data,
  renderItem,
  keyExtractor,
  estimatedItemSize,
  isLoading,
  error,
  onRetry,
  emptyTitle,
  emptyDescription,
  emptyAction,
  header,
  onEndReached,
  isFetchingMore = false,
}: QueryListProps<T>) {
  const { t } = useTranslation('mobile')
  const { spacing, colors } = useTheme()

  // Pull-to-refresh goes through the sync: pending writes first, then this
  // list's own query. Offline it re-reads nothing remote and says so.
  const refetch = useCallback(async () => {
    await onRetry()
  }, [onRetry])
  const { refreshing, onRefresh, offlineNotice } = useSyncRefresh(refetch)

  if (isLoading && !data) {
    return (
      <View style={{ padding: spacing.md, gap: spacing.sm }}>
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <MobileCard key={index}>
            <Skeleton height={16} width="60%" />
            <View style={{ height: spacing.sm }} />
            <Skeleton height={12} width="35%" />
          </MobileCard>
        ))}
      </View>
    )
  }

  if (error && !data) {
    return (
      <ErrorState
        title={t('common.error')}
        description={error instanceof Error ? error.message : undefined}
        retryLabel={t('common.retry')}
        onRetry={onRetry}
      />
    )
  }

  return (
    <FlashList
      data={data ?? []}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      estimatedItemSize={estimatedItemSize}
      ListHeaderComponent={
        offlineNotice ? (
          <View style={{ gap: spacing.sm }}>
            {header}
            <OfflineBanner
              offline
              pendingCount={0}
              offlineLabel={t('common.offlineLocalData')}
              pendingLabel=""
            />
          </View>
        ) : (
          header
        )
      }
      contentContainerStyle={{ padding: spacing.md, paddingBottom: 96 }}
      ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      ListFooterComponent={
        isFetchingMore ? (
          <View style={{ paddingVertical: spacing.md }}>
            <Skeleton height={16} width="40%" />
          </View>
        ) : null
      }
      refreshControl={
        <RefreshControl
          // Only the pull's own spinner: a background refetch must not pin
          // the indicator open, and offline it closes at once.
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
      ListEmptyComponent={
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          actionLabel={emptyAction?.label}
          onAction={emptyAction?.onPress}
        />
      }
    />
  )
}
