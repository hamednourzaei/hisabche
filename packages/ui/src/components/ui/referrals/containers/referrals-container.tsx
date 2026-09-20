'use client'

// ============================================
// packages/ui/src/components/ui/referrals/containers/referrals-container.tsx
//
// Every data hook lives here; the view takes props only.
// ============================================

import { memo, useCallback } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { apiErrorMessage, referralLink, useReferralOverview } from '@hisabche/api'

import { ReferralsView } from '../referrals-view'

export const ReferralsContainer = memo(function ReferralsContainer() {
  const tOriginal = useTranslations()
  const locale = useLocale()

  const t = useCallback(
    (key: string, fallback?: string): string => {
      const value = tOriginal(key as Parameters<typeof tOriginal>[0])
      return value && value !== key ? value : (fallback ?? key)
    },
    [tOriginal],
  )

  const { data, isLoading, error, refetch } = useReferralOverview()

  return (
    <ReferralsView
      t={t}
      locale={locale}
      isLoading={isLoading}
      // ⚠️ An error is not an empty programme. A failed request must not read
      // as «nobody joined with your link».
      error={
        error
          ? apiErrorMessage(error, t('referral.loadError', 'دریافت اطلاعات معرفی انجام نشد.'))
          : null
      }
      onRetry={() => void refetch()}
      code={data?.code ?? null}
      // The link is built from the browser's own origin — the same build
      // serves staging and the desktop app.
      link={referralLink(data?.code ?? null, locale)}
      summary={
        data?.summary ?? {
          referredCount: 0,
          activeCount: 0,
          thisMonthMinor: 0,
          totalMinor: 0,
          pendingMinor: 0,
          currency: null,
          currencies: [],
          payoutThresholdMinor: 0,
        }
      }
      referrals={data?.referrals ?? []}
      terms={
        data?.terms ?? {
          rateBps: 0,
          signupDiscountBps: 0,
          periodLimit: 0,
          attributionWindowDays: 0,
          payoutThresholdMinor: 0,
        }
      }
    />
  )
})

ReferralsContainer.displayName = 'ReferralsContainer'
