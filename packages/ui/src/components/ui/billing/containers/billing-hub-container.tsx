'use client'

// ============================================
// «اشتراک و کیف پول» — the plan, the wallet that pays for it and the referrals
// that fill the wallet, at one address: `/billing`.
//
//   plan    the subscription (the page as it was)
//   money   one at a time behind a switch: «کیف پول» (was /wallet),
//           «معرفی» (was /referrals)
//
// One money trail — a referral credits the wallet, the wallet pays the plan —
// so it is one page (owner's standing order, 5 Oct 2026).
//
// ⚠️ A hub over the screens that already exist: `PageHub` mounts each
// container; nothing is fetched here.
// ============================================

import { lazy } from 'react'
import { useTranslations } from 'next-intl'
import { CreditCard, Wallet } from 'lucide-react'

import { PageHub } from '../../page-hub'
import { BillingContainer } from './BillingContainer'

const WalletContainer = lazy(() =>
  import('../../wallet/wallet-container').then((m) => ({ default: m.WalletContainer })),
)
const ReferralsContainer = lazy(() =>
  import('../../referrals/containers/referrals-container').then((m) => ({
    default: m.ReferralsContainer,
  })),
)

/** Section → the page it came from (its menu entry, and its lock if it has one). */
export const BILLING_HUB_SOURCES = { wallet: '/wallet', referrals: '/referrals' } as const

export function BillingHubContainer() {
  return <BillingHub />
}

function BillingHub() {
  const t = useTranslations()
  return (
    <PageHub
      label={t('nav.billing')}
      sectionsLabel={t('billingHub.sectionsLabel')}
      loadingLabel={t('billingHub.loading')}
      tabs={[
        {
          id: 'plan',
          label: t('billingHub.tabs.plan'),
          icon: CreditCard,
          sections: [{ id: 'plan', label: t('nav.billing'), render: () => <BillingContainer /> }],
        },
        {
          id: 'money',
          label: t('billingHub.tabs.money'),
          icon: Wallet,
          sections: [
            {
              id: 'wallet',
              label: t('nav.wallet'),
              source: BILLING_HUB_SOURCES.wallet,
              render: () => <WalletContainer />,
            },
            {
              id: 'referrals',
              label: t('nav.referrals'),
              source: BILLING_HUB_SOURCES.referrals,
              render: () => <ReferralsContainer />,
            },
          ],
        },
      ]}
    />
  )
}
