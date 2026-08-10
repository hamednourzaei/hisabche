// ============================================
// Invoice detail — items, totals, payment status, share as text.
// ============================================

import React, { useCallback } from 'react'
import { ScrollView, Share, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useInvoice } from '@hisabche/api'
import { buildInvoiceShareMessage, buildInvoiceShareUrl } from '@hisabche/ui-contract'
import type { CurrencyCode } from '@hisabche/store'
import type { InvoiceItem, InvoiceStatus } from '@hisabche/validation'
import {
  Button,
  ErrorState,
  MobileCard,
  Skeleton,
  StatusChip,
  Text,
  useTheme,
} from '@hisabche/mobile-ui'

import { AppScreen } from '../../../shared/components/app-screen'
import { useCommonT } from '../../../shared/i18n/use-common-t'
import { WEB_BASE_URL } from '../../../shared/lib/api'
import { ScreenHeader } from '../../../shared/components/screen-header'
import { formatCurrency, formatDate, formatNumber } from '../../../shared/lib/format'
import { useCurrency } from '../../settings/preferences.store'

export function InvoiceDetailScreen() {
  const { t, i18n } = useTranslation('mobile')
  const tCommon = useCommonT()
  const { spacing } = useTheme()
  const { id } = useLocalSearchParams<{ id: string }>()
  const fallbackCurrency = useCurrency()

  const query = useInvoice(id)
  const invoice = query.data
  const currency = ((invoice?.currency as CurrencyCode) ?? fallbackCurrency) as CurrencyCode

  // Same wording and the same public link the web list shares, so a customer
  // receiving an invoice cannot tell which device sent it. The link opens
  // without signing in when the invoice has a public token.
  const onShare = useCallback(() => {
    if (!invoice) return

    const message = buildInvoiceShareMessage(
      {
        invoiceNumber: invoice.invoiceNumber ?? '',
        formattedTotal: formatCurrency(invoice.total ?? 0, currency),
        shareUrl: buildInvoiceShareUrl(
          WEB_BASE_URL,
          i18n.language,
          invoice.id,
          (invoice as { publicToken?: string | null }).publicToken,
        ),
      },
      tCommon,
    )

    void Share.share({ message })
  }, [currency, i18n.language, invoice, tCommon])

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

  // On a sale the counterparty is the buyer; on a purchase it is the seller.
  // Same field, different word — matching the web invoice document.
  const isPurchase = (invoice.type ?? 'sale') === 'purchase'
  const partyLabel = isPurchase ? t('sales.supplier') : t('sales.customer')
  const partyName = invoice.customerName ?? invoice.customer?.full_name ?? ''

  return (
    <AppScreen>
      <ScreenHeader
        title={invoice.invoiceNumber}
        subtitle={`${isPurchase ? t('sales.purchase') : t('sales.sale')} · ${formatDate(invoice.date)}`}
      />

      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
        <MobileCard>
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
          >
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
          {partyName ? (
            <Text variant="caption" tone="secondary" style={{ marginTop: spacing.xs }}>
              {`${partyLabel}: ${partyName}`}
            </Text>
          ) : null}
        </MobileCard>

        <View style={{ gap: spacing.sm }}>
          <Text variant="heading">{t('sales.items')}</Text>
          {((invoice.items ?? []) as InvoiceItem[]).map((item, index) => {
            // "10 گرم طلا" is quantity=10 unit=gram; "1 گردنبند، ۱۲٫۵ گرم" is
            // quantity=1 unit=piece weightGrams=12.5. Two distinct concepts —
            // render both rather than collapsing them.
            const unitLabel =
              item.unit === 'custom'
                ? (item.unitLabel ?? '')
                : t(`units.${item.unit ?? 'piece'}`, { defaultValue: '' })

            const quantityLine = `${formatNumber(item.quantity)}${unitLabel ? ` ${unitLabel}` : ''} × ${formatCurrency(item.unitPrice, currency)}`
            const details = item.details ?? []

            return (
              <MobileCard key={`${item.productName}-${index}`} padding="sm">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong" numberOfLines={1}>
                      {item.productName}
                    </Text>
                    <Text variant="caption" tone="secondary">
                      {quantityLine}
                    </Text>
                    {item.weightGrams ? (
                      <Text variant="caption" tone="tertiary">
                        {`${t('sales.weightGrams')}: ${formatNumber(item.weightGrams)}`}
                      </Text>
                    ) : null}
                  </View>
                  <Text variant="bodyStrong">{formatCurrency(item.totalPrice, currency)}</Text>
                </View>

                {details.length > 0 ? (
                  <View style={{ marginTop: spacing.sm, gap: 2 }}>
                    <Text variant="caption" tone="tertiary">
                      {t('sales.details')}
                    </Text>
                    {details.map((detail, detailIndex) => (
                      <View
                        key={`${detail.title}-${detailIndex}`}
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          gap: spacing.sm,
                        }}
                      >
                        <Text
                          variant="caption"
                          tone="secondary"
                          numberOfLines={1}
                          style={{ flex: 1 }}
                        >
                          {detail.title}
                        </Text>
                        <Text variant="caption" tone="secondary">
                          {`${formatNumber(detail.quantity)} × ${formatCurrency(detail.amount, currency)}`}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </MobileCard>
            )
          })}
        </View>

        <Button label={t('common.share')} variant="ghost" fullWidth onPress={onShare} />
      </ScrollView>
    </AppScreen>
  )
}
