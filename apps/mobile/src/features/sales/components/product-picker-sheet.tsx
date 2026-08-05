// ============================================
// Product picker — searches real inventory and returns a priced line item.
// Quantity is chosen inside the sheet, so adding an item never leaves the page.
// ============================================

import React, { useCallback, useMemo, useState } from 'react'
import { View } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useTranslation } from 'react-i18next'
import { useProducts } from '@hisabche/api'
import type { Product } from '@hisabche/validation'
import {
  BottomSheet,
  Button,
  MobileCard,
  Money,
  SearchBar,
  Skeleton,
  StatusChip,
  Text,
  useTheme,
} from '@hisabche/mobile-ui'

import { currencySign, formatAmount, formatNumber } from '../../../shared/lib/format'
import { useCurrency } from '../../settings/preferences.store'
import { stockLevel } from '../../inventory/components/product-row'

export interface PickedProduct {
  productId: string | undefined
  productName: string
  unitPrice: number
  quantity: number
}

export interface ProductPickerSheetProps {
  visible: boolean
  onClose: () => void
  onSelect: (product: PickedProduct) => void
}

export function ProductPickerSheet({ visible, onClose, onSelect }: ProductPickerSheetProps) {
  const { t } = useTranslation('mobile')
  const { spacing, colors } = useTheme()
  const currency = useCurrency()

  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Product | null>(null)
  const [quantity, setQuantity] = useState(1)

  const query = useProducts(useMemo(() => ({ page: 1, limit: 40, search }), [search]))

  const confirm = useCallback(() => {
    if (!selected) return
    onSelect({
      productId: selected.id,
      productName: selected.name,
      unitPrice: selected.sellPrice ?? 0,
      quantity,
    })
    setSelected(null)
    setQuantity(1)
    setSearch('')
  }, [onSelect, quantity, selected])

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t('sales.addItem')}
      height={0.8}
      testID="product-picker"
    >
      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholder={t('common.search')}
        clearAccessibilityLabel={t('common.clear')}
      />

      {query.isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton height={56} />
          <Skeleton height={56} />
          <Skeleton height={56} />
        </View>
      ) : (
        <FlashList<Product>
          data={query.data?.products ?? []}
          estimatedItemSize={72}
          keyExtractor={(item, index) => item.id ?? `product-${index}`}
          contentContainerStyle={{ padding: spacing.lg }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          renderItem={({ item, index }) => {
            const active = selected?.id === item.id
            const level = stockLevel(item.quantity ?? 0, item.minStockLevel ?? 0)

            return (
              <MobileCard
                variant={active ? 'outlined' : 'muted'}
                elevated="none"
                padding="md"
                testID={`product-option-${index}`}
                onPress={() => setSelected(item)}
                style={active ? { borderColor: colors.primary } : undefined}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text variant="bodyStrong" numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text variant="legal" tone="tertiary">
                      {`${formatNumber(item.quantity ?? 0)} ${t('common.unit')}`}
                    </Text>
                  </View>

                  <Money
                    amount={formatAmount(item.sellPrice ?? 0)}
                    sign={currencySign(currency)}
                    size="inline"
                  />
                  <StatusChip
                    label={t(`inventory.${level}`)}
                    tone={level === 'inStock' ? 'success' : level === 'lowStock' ? 'warning' : 'destructive'}
                  />
                </View>
              </MobileCard>
            )
          }}
        />
      )}

      {selected ? (
        <View
          style={{
            gap: spacing.md,
            padding: spacing.lg,
            borderTopWidth: 1,
            borderTopColor: colors.borderDefault,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Text variant="label" tone="secondary" style={{ flex: 1 }} numberOfLines={1}>
              {selected.name}
            </Text>
            <Button
              label="−"
              size="sm"
              variant="secondary"
              onPress={() => setQuantity((current) => Math.max(1, current - 1))}
            />
            <Text variant="numeric">{formatNumber(quantity)}</Text>
            <Button
              label="+"
              size="sm"
              variant="secondary"
              onPress={() => setQuantity((current) => current + 1)}
            />
          </View>

          <Button testID="confirm-item" label={t('sales.addItem')} size="lg" fullWidth onPress={confirm} />
        </View>
      ) : null}
    </BottomSheet>
  )
}
