// ============================================
// Customer picker — bottom sheet backed by the shared customers query.
// Built on RN Modal (no extra gesture dependency).
// ============================================

import React, { useMemo, useState } from 'react'
import { Modal, Pressable, View } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useTranslation } from 'react-i18next'
import { useCustomers } from '@hisabche/api'
import type { Customer } from '@hisabche/validation'
import { MobileCard, SearchBar, Skeleton, Text, useTheme } from '@hisabche/mobile-ui'

export interface PickedCustomer {
  id: string
  fullName: string
}

export interface CustomerPickerSheetProps {
  visible: boolean
  onClose: () => void
  onSelect: (customer: PickedCustomer) => void
}

export function CustomerPickerSheet({ visible, onClose, onSelect }: CustomerPickerSheetProps) {
  const { t } = useTranslation('mobile')
  const { colors, spacing, radius } = useTheme()
  const [search, setSearch] = useState('')

  const filters = useMemo(
    () => ({ page: 1, limit: 30, sortDirection: 'desc' as const, search }),
    [search]
  )
  const query = useCustomers(filters)

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: colors.scrim }} onPress={onClose} />

      <View
        style={{
          height: '70%',
          backgroundColor: colors.surfaceBase,
          borderTopLeftRadius: radius['2xl'],
          borderTopRightRadius: radius['2xl'],
          paddingTop: spacing.sm,
        }}
      >
        <View style={{ paddingHorizontal: spacing.md }}>
          <Text variant="heading">{t('sales.selectCustomer')}</Text>
        </View>

        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder={t('common.search')}
          clearAccessibilityLabel={t('common.clear')}
        />

        {query.isLoading ? (
          <View style={{ padding: spacing.md, gap: spacing.sm }}>
            <Skeleton height={48} />
            <Skeleton height={48} />
            <Skeleton height={48} />
          </View>
        ) : (
          <FlashList<Customer>
            data={query.data?.customers ?? []}
            estimatedItemSize={64}
            keyExtractor={(item) => item.id ?? item.fullName}
            contentContainerStyle={{ padding: spacing.md }}
            ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
            renderItem={({ item }) => (
              <MobileCard
                padding="sm"
                onPress={() => onSelect({ id: item.id ?? '', fullName: item.fullName })}
              >
                <Text variant="bodyStrong">{item.fullName}</Text>
                {item.phone ? (
                  <Text variant="caption" tone="secondary">
                    {item.phone}
                  </Text>
                ) : null}
              </MobileCard>
            )}
          />
        )}
      </View>
    </Modal>
  )
}
