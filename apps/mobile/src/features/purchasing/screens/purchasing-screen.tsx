// ============================================
// Purchasing — the mobile rendering of the web purchase-orders table.
//
// Same data (`usePurchaseOrders`), same action (`useReceiveGoods`), same copy
// keys as `packages/ui/components/ui/purchasing`. The table becomes a card list
// because a six-column table is unreadable at 390pt, but every column the web
// table shows is present: supplier, order date, expected delivery, item count,
// status, and the receive-goods action.
// ============================================

import React, { useCallback } from 'react'
import { View } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { usePurchaseOrders, useReceiveGoods, type PurchaseOrder } from '@hisabche/api'
import { Button, MobileCard, StatusChip, Text, useTheme } from '@hisabche/mobile-ui'
import type { BadgeTone } from '@hisabche/mobile-ui'

import { AppScreen } from '../../../shared/components/app-screen'
import { QueryList } from '../../../shared/components/query-list'
import { NavScreenHeader } from '../../../shared/components/nav-screen-header'
import { formatDate } from '../../../shared/lib/format'

/** Same three states the web badge map paints, in the mobile tone vocabulary. */
const STATUS_TONE: Record<string, BadgeTone> = {
  pending: 'warning',
  received: 'success',
  cancelled: 'destructive',
}

export function PurchasingScreen() {
  const { t } = useTranslation('common')
  const { t: tMobile } = useTranslation('mobile')
  const { spacing } = useTheme()
  const router = useRouter()

  const { data, isLoading, isRefetching, error, refetch } = usePurchaseOrders()
  const { mutate: receiveGoods, isPending, variables: receivingId } = useReceiveGoods()

  const onReceive = useCallback((id: string) => receiveGoods(id), [receiveGoods])

  const renderOrder = useCallback(
    ({ item }: { item: PurchaseOrder }) => {
      const receiving = isPending && receivingId === item.id

      return (
        <MobileCard padding="lg">
          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="legal" tone="tertiary">
                  {t('purchasing.supplier')}
                </Text>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {item.supplier?.name ?? '—'}
                </Text>
              </View>
              <StatusChip
                label={t(`purchasing.status.${item.status}`)}
                tone={STATUS_TONE[item.status] ?? 'neutral'}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <Field label={t('purchasing.orderDate')} value={formatDate(item.orderDate)} />
              <Field
                label={t('purchasing.expectedDeliveryDate')}
                value={item.expectedDeliveryDate ? formatDate(item.expectedDeliveryDate) : '—'}
              />
              <Field label={t('purchasing.itemsCount')} value={String(item.items?.length ?? 0)} />
            </View>

            {item.status === 'pending' ? (
              <Button
                testID={`receive-${item.id}`}
                label={t('purchasing.receiveGoods')}
                size="sm"
                variant="secondary"
                loading={receiving}
                onPress={() => onReceive(item.id)}
              />
            ) : null}
          </View>
        </MobileCard>
      )
    },
    [isPending, onReceive, receivingId, spacing, t],
  )

  return (
    <AppScreen>
      <NavScreenHeader id="buy" />

      <QueryList<PurchaseOrder>
        data={data}
        estimatedItemSize={148}
        isLoading={isLoading}
        isRefetching={isRefetching}
        error={error}
        onRetry={refetch}
        keyExtractor={(item, index) => item.id ?? `po-${index}`}
        emptyTitle={t('purchasing.empty')}
        emptyAction={{
          label: t('purchasing.recordPurchase'),
          onPress: () => router.push('/(tabs)/quick-invoice?type=purchase'),
        }}
        renderItem={renderOrder}
      />
    </AppScreen>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text variant="legal" tone="tertiary" numberOfLines={1}>
        {label}
      </Text>
      <Text variant="caption" numberOfLines={1}>
        {value}
      </Text>
    </View>
  )
}
