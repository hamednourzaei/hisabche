// ============================================
// Customer profile header — avatar, name, balance in one hero block.
// ============================================

import React, { memo } from 'react'
import { View } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { CurrencyCode } from '@hisabche/store'
import { Avatar, MobileCard, Money, Skeleton, StatusChip, Text, useTheme } from '@hisabche/mobile-ui'

import { currencySign, formatAmount } from '../../../shared/lib/format'

export interface CustomerProfileHeaderProps {
  fullName: string
  phone?: string | undefined
  /** Positive means the customer owes money. */
  balance: number
  currency: CurrencyCode
  loading?: boolean | undefined
}

export const CustomerProfileHeader = memo(function CustomerProfileHeader({
  fullName,
  phone,
  balance,
  currency,
  loading = false,
}: CustomerProfileHeaderProps) {
  const { t } = useTranslation('mobile')
  const { spacing } = useTheme()

  const owes = balance > 0
  const settled = balance === 0

  return (
    <MobileCard padding="xl" elevated="md">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
        <Avatar name={fullName} size={56} />

        <View style={{ flex: 1, gap: 3 }}>
          <Text variant="title" numberOfLines={1}>
            {fullName}
          </Text>
          <Text variant="caption" tone="tertiary">
            {phone ?? '—'}
          </Text>
        </View>
      </View>

      <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
        <Text variant="label" tone="secondary">
          {settled ? t('customers.settled') : owes ? t('customers.debt') : t('customers.credit')}
        </Text>

        {loading ? (
          <Skeleton height={36} width="60%" />
        ) : (
          <Money
            amount={formatAmount(Math.abs(balance))}
            sign={currencySign(currency)}
            size="large"
            tone={settled ? 'primary' : owes ? 'warning' : 'success'}
          />
        )}

        <View style={{ alignSelf: 'flex-start', marginTop: spacing.xs }}>
          <StatusChip
            label={settled ? t('customers.settled') : owes ? t('customers.debt') : t('customers.credit')}
            tone={settled ? 'success' : owes ? 'warning' : 'info'}
          />
        </View>
      </View>
    </MobileCard>
  )
})
