// ============================================
// Create invoice — customer and product chosen in bottom sheets,
// never on a pushed page. Offline-capable submit.
// ============================================

import React, { useCallback, useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import {
  Avatar,
  Button,
  MobileCard,
  Money,
  SectionHeader,
  Text,
  useTheme,
} from '@hisabche/mobile-ui'

import { AppScreen } from '../../../shared/components/app-screen'
import { ScreenHeader } from '../../../shared/components/screen-header'
import { currencySign, formatAmount } from '../../../shared/lib/format'
import { useCurrency } from '../../settings/preferences.store'
import { CustomerPickerSheet } from '../components/customer-picker-sheet'
import { LineItemDetailEditor } from '../components/line-item-detail-editor'
import { LineItemRow } from '../components/line-item-row'
import { TransactionTypeSwitch } from '../components/transaction-type-switch'
import { ProductPickerSheet } from '../components/product-picker-sheet'
import { useSubmitInvoice } from '../hooks/use-create-invoice'
import { useInvoiceDraft } from '../hooks/use-invoice-draft'

export function NewInvoiceScreen() {
  const { t } = useTranslation('mobile')
  const { spacing, colors } = useTheme()
  const router = useRouter()
  const currency = useCurrency()

  const draft = useInvoiceDraft()
  const { submit, isSubmitting } = useSubmitInvoice()

  const [customerOpen, setCustomerOpen] = useState(false)
  const [productOpen, setProductOpen] = useState(false)

  const onSubmit = useCallback(async () => {
    if (draft.items.length === 0) {
      Alert.alert(t('sales.noItems'))
      return
    }

    try {
      const result = await submit(draft.build(currency))
      Alert.alert(result.queued ? t('sales.savedOffline') : t('sales.created'))
      router.back()
    } catch (error) {
      Alert.alert(t('common.error'), error instanceof Error ? error.message : undefined)
    }
  }, [currency, draft, router, submit, t])

  return (
    <AppScreen>
      <ScreenHeader
        title={
          draft.transactionType === 'purchase'
            ? t('sales.newPurchase', 'خرید جدید')
            : t('sales.newInvoice')
        }
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 140 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* فروش / خرید — same form, same engine, different semantics. */}
          <TransactionTypeSwitch
            value={draft.transactionType}
            onChange={draft.setTransactionType}
          />

          <MobileCard onPress={() => setCustomerOpen(true)} padding="lg">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Avatar name={draft.customerName ?? '?'} size={40} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="legal" tone="tertiary">
                  {draft.transactionType === 'purchase'
                    ? t('sales.supplier', 'فروشنده')
                    : t('sales.customer')}
                </Text>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {draft.customerName ??
                    (draft.transactionType === 'purchase'
                      ? t('sales.selectSupplier', 'انتخاب فروشنده')
                      : t('sales.selectCustomer'))}
                </Text>
              </View>
              <Ionicons name="chevron-back" size={18} color={colors.fgTertiary} />
            </View>
          </MobileCard>

          <View>
            <SectionHeader
              title={t('sales.items')}
              actionLabel={t('sales.addItem')}
              actionTestID="add-item"
              onAction={() => setProductOpen(true)}
            />

            {draft.items.length === 0 ? (
              <MobileCard variant="muted" elevated="none" padding="lg">
                <Text variant="caption" tone="tertiary" style={{ textAlign: 'center' }}>
                  {t('sales.noItems')}
                </Text>
              </MobileCard>
            ) : (
              <View style={{ gap: spacing.sm }}>
                {draft.items.map((item, index) => (
                  <View key={item.key}>
                    <LineItemRow
                      testID={`line-item-${index}`}
                      item={item}
                      currency={currency}
                      onRemove={() => draft.removeItem(item.key)}
                    />
                    {/* Optional components — collapsed until asked for, so a
                        simple sale stays a single compact row. */}
                    <LineItemDetailEditor item={item} onChange={draft.updateItem} />
                  </View>
                ))}
              </View>
            )}
          </View>

          <MobileCard padding="lg" elevated="md">
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text variant="label" tone="secondary" style={{ flex: 1 }}>
                {t('sales.grandTotal')}
              </Text>
              <Money
                amount={formatAmount(draft.total)}
                sign={currencySign(currency)}
                size="large"
              />
            </View>
          </MobileCard>

          <Button
            testID="invoice-save"
            label={t('common.save')}
            size="lg"
            fullWidth
            loading={isSubmitting}
            onPress={onSubmit}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <CustomerPickerSheet
        visible={customerOpen}
        onClose={() => setCustomerOpen(false)}
        onSelect={(customer) => {
          draft.setCustomer(customer.id, customer.fullName)
          setCustomerOpen(false)
        }}
      />

      <ProductPickerSheet
        visible={productOpen}
        onClose={() => setProductOpen(false)}
        onSelect={(product) => {
          draft.addItem({ ...product, discount: 0 })
          setProductOpen(false)
        }}
      />
    </AppScreen>
  )
}
