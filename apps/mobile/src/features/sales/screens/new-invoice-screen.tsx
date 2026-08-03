// ============================================
// Create invoice — customer picker, line items, offline-capable submit.
// ============================================

import React, { useCallback, useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Button, Input, MobileCard, Text, useTheme } from '@hisabche/mobile-ui'

import { AppScreen } from '../../../shared/components/app-screen'
import { ScreenHeader } from '../../../shared/components/screen-header'
import { formatCurrency } from '../../../shared/lib/format'
import { useCurrency } from '../../settings/preferences.store'
import { CustomerPickerSheet } from '../components/customer-picker-sheet'
import { LineItemRow } from '../components/line-item-row'
import { useSubmitInvoice } from '../hooks/use-create-invoice'
import { useInvoiceDraft } from '../hooks/use-invoice-draft'

export function NewInvoiceScreen() {
  const { t } = useTranslation('mobile')
  const { spacing, colors } = useTheme()
  const router = useRouter()
  const currency = useCurrency()

  const draft = useInvoiceDraft()
  const { submit, isSubmitting } = useSubmitInvoice()

  const [pickerOpen, setPickerOpen] = useState(false)
  const [itemName, setItemName] = useState('')
  const [itemQty, setItemQty] = useState('1')
  const [itemPrice, setItemPrice] = useState('')

  const onAddItem = useCallback(() => {
    const quantity = Number(itemQty)
    const unitPrice = Number(itemPrice)
    if (!itemName.trim() || quantity <= 0 || unitPrice <= 0) return

    draft.addItem({ productName: itemName.trim(), quantity, unitPrice, discount: 0 })
    setItemName('')
    setItemQty('1')
    setItemPrice('')
  }, [draft, itemName, itemPrice, itemQty])

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
      <ScreenHeader title={t('sales.newInvoice')} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
        >
          <MobileCard onPress={() => setPickerOpen(true)}>
            <Text variant="label" tone="secondary">
              {t('sales.customer')}
            </Text>
            <Text variant="bodyStrong" style={{ marginTop: spacing.xs }}>
              {draft.customerName ?? t('sales.selectCustomer')}
            </Text>
          </MobileCard>

          <MobileCard>
            <Text variant="label" tone="secondary">
              {t('sales.addItem')}
            </Text>
            <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
              <Input value={itemName} onChangeText={setItemName} label={t('sales.items')} />
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Input
                    value={itemQty}
                    onChangeText={setItemQty}
                    label={t('sales.quantity')}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 2 }}>
                  <Input
                    value={itemPrice}
                    onChangeText={setItemPrice}
                    label={t('sales.unitPrice')}
                    keyboardType="numeric"
                  />
                </View>
              </View>
              <Button
                label={t('sales.addItem')}
                variant="ghost"
                onPress={onAddItem}
                icon={<Ionicons name="add" size={18} color={colors.fgPrimary} />}
              />
            </View>
          </MobileCard>

          {draft.items.map((item) => (
            <LineItemRow
              key={item.key}
              item={item}
              currency={currency}
              onRemove={() => draft.removeItem(item.key)}
            />
          ))}

          <MobileCard>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="label" tone="secondary">
                {t('sales.grandTotal')}
              </Text>
              <Text variant="heading">{formatCurrency(draft.total, currency)}</Text>
            </View>
          </MobileCard>

          <Button
            label={t('common.save')}
            size="lg"
            fullWidth
            loading={isSubmitting}
            onPress={onSubmit}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <CustomerPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(customer) => {
          draft.setCustomer(customer.id, customer.fullName)
          setPickerOpen(false)
        }}
      />
    </AppScreen>
  )
}
