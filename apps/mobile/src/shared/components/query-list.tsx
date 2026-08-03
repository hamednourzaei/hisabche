// ============================================
// List shell that renders the four required states
// (loading / error / empty / data) around a FlashList.
// ============================================

import React, { type ReactElement } from 'react'
import { RefreshControl, View } from 'react-native'
import { FlashList, type ListRenderItem } from '@shopify/flash-list'
import { useTranslation } from 'react-i18next'
import { EmptyState, ErrorState, MobileCard, Skeleton, useTheme } from '@hisabche/mobile-ui'

const SKELETON_ROWS = 6

export interface QueryListProps<T> {
  data: T[] | undefined
  renderItem: ListRenderItem<T>
  keyExtractor: (item: T, index: number) => string
  estimatedItemSize: number
  isLoading: boolean
  isRefetching?: boolean | undefined
  error?: unknown
  onRetry: () => void
  emptyTitle: string
  emptyDescription?: string | undefined
  emptyAction?: { label: string; onPress: () => void } | undefined
  header?: ReactElement | undefined
}

export function QueryList<T>({
  data,
  renderItem,
  keyExtractor,
  estimatedItemSize,
  isLoading,
  isRefetching = false,
  error,
  onRetry,
  emptyTitle,
  emptyDescription,
  emptyAction,
  header,
}: QueryListProps<T>) {
  const { t } = useTranslation('mobile')
  const { spacing, colors } = useTheme()

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
      ListHeaderComponent={header}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: 96 }}
      ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={onRetry} tintColor={colors.primary} />
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
