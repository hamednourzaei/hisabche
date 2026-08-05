import React, { memo } from 'react'
import { View } from 'react-native'
import type { Customer } from '@hisabche/validation'
import type { CurrencyCode } from '@hisabche/store'
import { Avatar, MobileCard, Money, StatusChip, Text, useTheme } from '@hisabche/mobile-ui'

import { currencySign, formatAmount } from '../../../shared/lib/format'

export interface CustomerRowProps {
  customer: Customer
  currency: CurrencyCode
  balanceLabel: (balance: number) => string
  onPress: (id: string) => void
}

export const CustomerRow = memo(function CustomerRow({
  customer,
  currency,
  balanceLabel,
  onPress,
}: CustomerRowProps) {
  const { spacing } = useTheme()
  const balance = customer.openingBalance ?? 0

  return (
    <MobileCard onPress={() => onPress(customer.id ?? '')} padding="lg">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Avatar name={customer.fullName} size={40} />

        <View style={{ flex: 1, gap: 3 }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {customer.fullName}
          </Text>
          <Text variant="legal" tone="tertiary">
            {customer.phone ?? '—'}
          </Text>
        </View>

        <View style={{ alignItems: 'flex-end', gap: spacing.sm }}>
          <Money
            amount={formatAmount(Math.abs(balance))}
            sign={currencySign(currency)}
            size="inline"
            tone={balance > 0 ? 'warning' : balance < 0 ? 'success' : 'primary'}
          />
          <StatusChip
            label={balanceLabel(balance)}
            tone={balance > 0 ? 'warning' : balance < 0 ? 'info' : 'success'}
          />
        </View>
      </View>
    </MobileCard>
  )
})
