// ============================================
// Invoice detail — items, totals, payment status, share as text.
// ============================================

import React, { useCallback } from 'react'
import { ScrollView, Share, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useInvoice } from '@hisabche/api'
import type { CurrencyCode } from '@hisabche/store'
import type { InvoiceItem, InvoiceStatus } from '@hisabche/validation'
import { Button, ErrorState, MobileCard, Skeleton, StatusChip, Text, useTheme } from '@hisabche/mobile-ui'

import { AppScreen } from '../../../shared/components/app-screen'
import { ScreenHeader } from '../../../shared/components/screen-header'
import { formatCurrency, formatDate, formatNumber } from '../../../shared/lib/format'
import { useCurrency } from '../../settings/preferences.store'

export function InvoiceDetailScreen() {
  const { t } = useTranslation('mobile')
  const { spacing } = useTheme()
  const { id } = useLocalSearchParams<{ id: string }>()
  const fallbackCurrency = useCurrency()

  const query = useInvoice(id)
  const invoice = query.data
  const currency = ((invoice?.currency as CurrencyCode) ?? fallbackCurrency) as CurrencyCode

  const onShare = useCallback(() => {
    if (!invoice) return
    const lines = [
      `${t('sales.invoiceNumber')}: ${invoice.invoiceNumber}`,
      `${t('sales.grandTotal')}: ${formatCurrency(invoice.total ?? 0, currency)}`,
      formatDate(invoice.date),
    ]
    void Share.share({ message: lines.join('\n') })
  }, [currency, invoice, t])

  if (query.isLoading) {
    return (
      <AppScreen>
        <ScreenHeader title={t('sales.title')} />
        <View style={{ padding: spacing.md, gap: spacing.sm }}>
          <Skeleton height={80} />
          <Skeleton height={140} />
        </View>
      </AppScreen>
    )
  }

  if (query.isError || !invoice) {
    return (
      <AppScreen>
        <ScreenHeader title={t('sales.title')} />
        <ErrorState
          title={t('common.error')}
          retryLabel={t('common.retry')}
          onRetry={query.refetch}
        />
      </AppScreen>
    )
  }

  const status = (invoice.status ?? 'pending') as InvoiceStatus

  return (
    <AppScreen>
      <ScreenHeader title={invoice.invoiceNumber} subtitle={formatDate(invoice.date)} />

      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
        <MobileCard>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text variant="display">{formatCurrency(invoice.total ?? 0, currency)}</Text>
            <StatusChip
              label={t(`sales.status${status.charAt(0).toUpperCase()}${status.slice(1)}`, {
                defaultValue: status,
              })}
              tone={status === 'paid' || status === 'completed' ? 'success' : 'warning'}
            />
          </View>
          <Text variant="caption" tone="secondary" style={{ marginTop: spacing.xs }}>
            {`${t('sales.paid')}: ${formatCurrency(invoice.paidAmount ?? 0, currency)}`}
          </Text>
        </MobileCard>

        <View style={{ gap: spacing.sm }}>
          <Text variant="heading">{t('sales.items')}</Text>
          {((invoice.items ?? []) as InvoiceItem[]).map((item, index) => (
            <MobileCard key={`${item.productName}-${index}`} padding="sm">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong" numberOfLines={1}>
                    {item.productName}
                  </Text>
                  <Text variant="caption" tone="secondary">
                    {`${formatNumber(item.quantity)} × ${formatCurrency(item.unitPrice, currency)}`}
                  </Text>
                </View>
                <Text variant="bodyStrong">{formatCurrency(item.totalPrice, currency)}</Text>
              </View>
            </MobileCard>
          ))}
        </View>

        <Button label={t('common.share')} variant="ghost" fullWidth onPress={onShare} />
      </ScrollView>
    </AppScreen>
  )
}
