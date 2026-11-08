// ============================================
// A pre-sale / pre-purchase in the journal (advances-02, owner request 8 Nov
// 2026): «show document» opens it on /invoices (its own type, narrowed to it),
// and «refund» gives back what is still unapplied — the same refund the
// party's deposits panel books (one Postgres function, the reversing entry).
//
// Only an advance gets these. A sales-order or session deposit keeps the
// plain «open source» link, and an advance already used up has no refund.
// ============================================

'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useAdvances, useRefundOrderDeposit } from '@hisabche/api'

import { useLocalePush } from '../../../../hooks/use-locale-push'
import { RefundDialog, refusalText } from '../../customers/customer-deposits-panel'

const LINK =
  'rounded text-xs text-[hsl(var(--color-primary))] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]'

export function AdvanceEntryActions({ depositId }: { depositId: string }) {
  const t = useTranslations()
  const tDeposits = useTranslations('customerDeposits')
  const push = useLocalePush()
  const preSale = useAdvances('pre_sale')
  const prePurchase = useAdvances('pre_purchase')
  const refund = useRefundOrderDeposit()
  const [refunding, setRefunding] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  const found = useMemo(() => {
    const sale = (preSale.data ?? []).find((row) => row.id === depositId)
    if (sale) return { deposit: sale, kind: 'pre_sale' as const }
    const purchase = (prePurchase.data ?? []).find((row) => row.id === depositId)
    if (purchase) return { deposit: purchase, kind: 'pre_purchase' as const }
    return null
  }, [preSale.data, prePurchase.data, depositId])

  if (!found) return null
  const { deposit, kind } = found

  return (
    <div className="flex flex-wrap items-center gap-3" data-advance-entry={kind}>
      <button
        type="button"
        className={LINK}
        onClick={() => push(`/invoices?type=${kind}&advance=${deposit.id}`)}
      >
        {t(
          kind === 'pre_sale'
            ? 'accounting.journal.showPreSale'
            : 'accounting.journal.showPrePurchase',
        )}
      </button>
      {deposit.remainingMinor > 0 ? (
        <button type="button" className={LINK} onClick={() => setRefunding(true)}>
          {t('accounting.journal.refundAdvance')}
        </button>
      ) : null}
      {message ? (
        <span
          role={message.tone === 'error' ? 'alert' : 'status'}
          className={
            message.tone === 'error'
              ? 'text-xs text-[hsl(var(--color-destructive))]'
              : 'text-xs text-[hsl(var(--color-success))]'
          }
        >
          {message.text}
        </span>
      ) : null}
      {refunding ? (
        <RefundDialog
          deposit={deposit}
          pending={refund.isPending}
          onClose={() => setRefunding(false)}
          onSubmit={(amountMinor, reason, method) => {
            setMessage(null)
            refund.mutate(
              {
                orderId: deposit.orderId,
                depositId: deposit.id,
                customerId: deposit.customerId,
                amountMinor,
                reason,
                method,
              },
              {
                onSuccess: () => {
                  setRefunding(false)
                  setMessage({ tone: 'ok', text: tDeposits('refundSuccess') })
                },
                onError: (error) =>
                  setMessage({
                    tone: 'error',
                    text: refusalText(error, tDeposits, tDeposits('refundFailed')),
                  }),
              },
            )
          }}
        />
      ) : null}
    </div>
  )
}
