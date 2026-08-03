import React, { memo } from 'react'
import { View } from 'react-native'
import type { InvoiceWithCustomer } from '@hisabche/api'
import type { InvoiceStatus } from '@hisabche/validation'
import type { CurrencyCode } from '@hisabche/store'
import { Avatar, MobileCard, Money, StatusChip, Text, useTheme, type BadgeTone } from '@hisabche/mobile-ui'

import { currencySign, formatAmount, formatDate } from '../../../shared/lib/format'

const TONE_BY_STATUS: Record<InvoiceStatus, BadgeTone> = {
  paid: 'success',
  completed: 'success',
  pending: 'warning',
  partial: 'info',
  overdue: 'destructive',
  cancelled: 'neutral',
}

export interface InvoiceRowProps {
  invoice: InvoiceWithCustomer
  currency: CurrencyCode
  statusLabel: string
  onPress: (id: string) => void
}

export const InvoiceRow = memo(function InvoiceRow({
  invoice,
  currency,
  statusLabel,
  onPress,
}: InvoiceRowProps) {
  const { spacing } = useTheme()
  const status = (invoice.status ?? 'pending') as InvoiceStatus
  const title = invoice.customerName ?? invoice.customer?.full_name ?? invoice.invoiceNumber

  return (
    <MobileCard onPress={() => onPress(invoice.id ?? '')} padding="lg">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Avatar name={title} size={40} />

        <View style={{ flex: 1, gap: 3 }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {title}
          </Text>
          <Text variant="legal" tone="tertiary">
            {`${invoice.invoiceNumber} · ${formatDate(invoice.date)}`}
          </Text>
        </View>

        <View style={{ alignItems: 'flex-end', gap: spacing.sm }}>
          <Money
            amount={formatAmount(invoice.total ?? 0)}
            sign={currencySign((invoice.currency as CurrencyCode) ?? currency)}
            size="inline"
          />
          <StatusChip label={statusLabel} tone={TONE_BY_STATUS[status] ?? 'neutral'} />
        </View>
      </View>
    </MobileCard>
  )
})
