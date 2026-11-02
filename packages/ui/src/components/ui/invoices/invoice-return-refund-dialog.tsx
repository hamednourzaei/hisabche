'use client'

// ============================================
// «ثبت بازپرداخت» — pay the customer back, later, against a return that already exists.
//
// A return and the cash paid back for it are two events. The return form can pay straight
// away; this dialog is for the rest: the customer comes back for their money next week, or
// takes it in two parts. Each press is one payment OUT to the customer through the payment
// core; what is left to pay back is the server's figure (`refundableMinor`), never worked
// out here.
// ============================================

import { memo, useState } from 'react'
import { apiErrorMessage, useRefundInvoiceReturn } from '@hisabche/api'
import { fractionDigits, type KnownCurrency } from '@hisabche/formatting'
import { Banknote } from 'lucide-react'
import { useActionAvailability } from '../../../lib/capability/use-action-availability'
import { useNumberFormat } from '../../../hooks/use-number-format'
import { useTillChoice } from '../../../hooks/use-till-choice'
import { Button } from '../button'
import { CloudRequiredNotice } from '../cloud-required-notice'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../dialog'
import { RefundFields } from './invoice-return-refund-fields'

export interface RefundTarget {
  id: string
  returnNumber: string
  /** Minor units of the invoice currency: what can still be paid back. */
  refundableMinor: number
}

export interface InvoiceReturnRefundDialogProps {
  invoiceId: string
  currency: string
  target: RefundTarget | null
  onOpenChange: (open: boolean) => void
  t?: ((key: string, fallback?: string) => string) | undefined
}

export const InvoiceReturnRefundDialog = memo(function InvoiceReturnRefundDialog({
  invoiceId,
  currency,
  target,
  onOpenChange,
  t,
}: InvoiceReturnRefundDialogProps) {
  const availability = useActionAvailability('invoice.return_refund')
  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        {availability.requiresOnline ? (
          <CloudRequiredNotice
            variant="inline"
            title={t?.('invoices.refundTitle', 'بازپرداخت به مشتری') ?? 'بازپرداخت به مشتری'}
            onDismiss={() => onOpenChange(false)}
          />
        ) : target ? (
          // Keyed by the return: a different return starts from its own figures, with no reset effect.
          <RefundForm
            key={target.id}
            invoiceId={invoiceId}
            currency={currency}
            target={target}
            onClose={() => onOpenChange(false)}
            t={t}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
})

function RefundForm({
  invoiceId,
  currency,
  target,
  onClose,
  t,
}: {
  invoiceId: string
  currency: string
  target: RefundTarget
  onClose: () => void
  t: ((key: string, fallback?: string) => string) | undefined
}) {
  const refund = useRefundInvoiceReturn(invoiceId)
  const fmt = useNumberFormat()
  const till = useTillChoice(currency || undefined)
  const tr = (key: string, fallback: string) => t?.(`invoices.${key}`, fallback) ?? fallback
  const tt = (key: string, fallback?: string) => t?.(key, fallback) ?? fallback ?? key

  const digits = currency ? (fractionDigits(currency as KnownCurrency) ?? 2) : 2
  const factor = 10 ** digits
  const [method, setMethod] = useState<'cash' | 'bank'>('cash')
  const [amount, setAmount] = useState(String(target.refundableMinor / factor))
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    try {
      await refund.mutateAsync({
        returnId: target.id,
        amount: Number(amount),
        method,
        ...(method === 'cash' && till.tillSessionId ? { tillSessionId: till.tillSessionId } : {}),
      })
      onClose()
    } catch (cause) {
      const message = apiErrorMessage(cause, '')
      setError(
        message.includes('REFUND_PAID_NOT_SETTLED')
          ? tr(
              'refundPaidNotSettled',
              'پرداخت انجام شد ولی ثبت نهایی نشد. با پشتیبانی تماس بگیرید؛ دوباره پرداخت نکنید.',
            )
          : message.includes('REFUND_EXCEEDS_REFUNDABLE')
            ? tr('refundExceeds', 'مبلغ بازپرداخت از حد مجاز بیشتر است.')
            : message.includes('REFUND_MIGRATION_05_REQUIRED')
              ? tr(
                  'returnMigrationNeeded',
                  'کسورات روی سرور فعال نشده است. با پشتیبانی تماس بگیرید.',
                )
              : message || tr('refundFailed', 'بازپرداخت انجام نشد'),
      )
    }
  }

  const value = Number(amount)
  const valid =
    Number.isFinite(value) && value > 0 && Math.round(value * factor) <= target.refundableMinor

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Banknote className="h-5 w-5 text-[hsl(var(--color-primary))]" />
          {tr('refundTitle', 'بازپرداخت به مشتری')} · #{target.returnNumber}
        </DialogTitle>
      </DialogHeader>
      <div className="py-3">
        <RefundFields
          tr={tr}
          t={tt}
          method={method}
          onMethod={setMethod}
          amount={amount}
          onAmount={setAmount}
          maxText={`${fmt(target.refundableMinor / factor, digits)} ${currency}`.trim()}
          till={till}
          disabled={refund.isPending}
        />
      </div>
      {error ? (
        <p role="alert" className="text-xs text-[hsl(var(--color-destructive))]">
          {error}
        </p>
      ) : null}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t?.('common.cancel', 'انصراف') ?? 'انصراف'}
        </Button>
        <Button onClick={submit} disabled={!valid || refund.isPending}>
          {tr('refundSubmit', 'پرداخت به مشتری')}
        </Button>
      </DialogFooter>
    </>
  )
}
