'use client'

// ============================================
// packages/ui/src/components/ui/wallet/wallet-pay-option.tsx
//
// «Pay from the wallet» inside the billing upgrade form. Debit, request and
// activation are ONE server transaction (wallet_pay_subscription_upgrade), so
// success here means the plan is active — not «sent for review».
//
// ⚠️ It sends the plan and the wallet's currency, never an amount: the price
// is the server's. Whether the balance suffices is also the server's call
// (WALLET_INSUFFICIENT_FUNDS) — the client does no arithmetic on money.
//
// Rendered only for someone who may manage the business: the wallet answers
// 403 otherwise, and a disabled option they can never use is noise.
// ============================================

import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { usePayUpgradeFromWallet, useWallet } from '@hisabche/api'
import { localizePath } from '@hisabche/ui-contract'

import { useRouteLang } from '../../../hooks/use-locale-push'
import { Button } from '../button'
import { walletErrorText, walletMoney } from './wallet-format'

export function WalletPayOption({
  plan,
  interval,
  planCurrency,
}: {
  plan: 'pro' | 'enterprise'
  interval: 'month' | 'year'
  /** The currency the server declared for the plan's price. */
  planCurrency: string | undefined
}) {
  const t = useTranslations()
  const lang = useLocale()
  const routeLang = useRouteLang()
  const wallet = useWallet()
  const pay = usePayUpgradeFromWallet()

  // Not permitted, not configured, or still loading: the option is simply not
  // offered — the ordinary request form below still is.
  if (!wallet.data || !planCurrency) return null

  const balance = wallet.data.balances.find((b) => b.currency === planCurrency) ?? null

  if (pay.isSuccess) {
    return (
      <p
        role="status"
        className="rounded-xl bg-[hsl(var(--color-success)/0.1)] p-3 text-sm text-[hsl(var(--color-success))]"
      >
        {t('wallet.pay.done', { balance: walletMoney(pay.data.balanceAfter, planCurrency, lang) })}
      </p>
    )
  }

  return (
    <div
      className="space-y-2 rounded-xl border border-[hsl(var(--border-default))] p-3 text-sm"
      data-wallet-pay=""
    >
      <p className="font-medium">{t('wallet.pay.title')}</p>
      {balance && balance.balanceMinor > 0 ? (
        <>
          <p className="text-[hsl(var(--fg-secondary))]">
            {t('wallet.pay.balance', {
              balance: walletMoney(balance.balanceMinor, planCurrency, lang),
            })}
          </p>
          <Button
            type="button"
            disabled={pay.isPending}
            onClick={() => pay.mutate({ plan, interval, walletCurrency: planCurrency })}
          >
            {t('wallet.pay.button')}
          </Button>
        </>
      ) : (
        <p className="text-[hsl(var(--fg-secondary))]">
          {t('wallet.pay.noBalance', { currency: planCurrency })}{' '}
          <Link
            href={localizePath('/wallet', routeLang)}
            className="text-[hsl(var(--color-primary))] underline"
          >
            {t('wallet.pay.topUp')}
          </Link>
        </p>
      )}
      {pay.isError ? (
        <p role="alert" className="text-[hsl(var(--color-destructive))]">
          {walletErrorText(pay.error, t)}
        </p>
      ) : null}
    </div>
  )
}
