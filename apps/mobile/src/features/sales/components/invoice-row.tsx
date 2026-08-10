import React, { memo } from 'react'
import { View } from 'react-native'
import type { InvoiceWithCustomer } from '@hisabche/api'
import type { InvoiceStatus } from '@hisabche/validation'
import type { CurrencyCode } from '@hisabche/store'
import {
  Avatar,
  MobileCard,
  Money,
  StatusChip,
  Text,
  useTheme,
  type BadgeTone,
} from '@hisabche/mobile-ui'

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
  /**
   * Label for `invoice.type` — فروش or خرید. The list mixes both, so the row
   * has to say which one it is; without it a purchase reads as a sale.
   */
  typeLabel: string
  onPress: (id: string) => void
  /** Long-press enters selection mode — the native bulk-action affordance. */
  onLongPress?: (() => void) | undefined
  selected?: boolean | undefined
}

export const InvoiceRow = memo(function InvoiceRow({
  invoice,
  currency,
  statusLabel,
  typeLabel,
  onPress,
  onLongPress,
  selected = false,
}: InvoiceRowProps) {
  const { spacing } = useTheme()
  const status = (invoice.status ?? 'pending') as InvoiceStatus
  const isPurchase = (invoice.type ?? 'sale') === 'purchase'
  // Every link in this chain is optional at runtime: a purchase may carry a
  // supplier rather than a customer, and an offline-queued invoice has no
  // number yet. Ending on a dash keeps the row readable instead of blank.
  const title = invoice.customerName ?? invoice.customer?.full_name ?? invoice.invoiceNumber ?? '—'

  return (
    <MobileCard
      onPress={() => onPress(invoice.id ?? '')}
      onLongPress={onLongPress}
      selected={selected}
      padding="lg"
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Avatar name={title} size={40} />

        <View style={{ flex: 1, gap: 3 }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {title}
          </Text>
          <Text variant="legal" tone="tertiary">
            {`${invoice.invoiceNumber} · ${formatDate(invoice.date)}`}
          </Text>
          <StatusChip label={typeLabel} tone={isPurchase ? 'info' : 'neutral'} />
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
