'use client'

// ============================================
// «لغو جلسه» — cancelling, with the money stated BEFORE the confirmation.
//
// ⚠️ THE CONSEQUENCE COMES FROM THE ROW THE LIST ALREADY HOLDS. Nothing here
// re-reads a ledger, guesses a balance, or mutates a ledger row: a delivered
// package session is reversed by the SERVER's compensating entry, and this
// dialog only says so.
//
// ⚠️ A BILLED SERVICE IS NOT CANCELLED. `invoice` settlement → the action is
// disabled with the explanation, because the API answers
// `DELIVERED_INVOICE_CORRECTION_REQUIRED`; the correction belongs to the
// invoice, not to a cancellation that would leave the bill standing.
//
// ⚠️ A CANCELLATION SAYS WHY. The reason is required here, required by the domain
// (`CANCELLATION_REASON_REQUIRED`), required by the database function, and kept on
// the session (`cancellation_reason`) - so what this dialog collects is stored, not
// thrown away. A replay of a cancellation that already happened asks for nothing.
// ============================================

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useCancelServiceDeliverySession } from '@hisabche/api'

import { Button } from '../button'
import { Labeled } from './service-delivery-fields'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../dialog'
import {
  cancellable,
  cancellationEffect,
  cancellationReasonMissing,
  type CancellationEffect,
  type ServiceSessionRow,
} from './service-delivery-model'
import { serviceDeliveryErrorCode, serviceDeliveryErrorKey } from './service-delivery-errors'

/** Why the confirm button is not offered — null means «go ahead». */
function blockedReason(effect: CancellationEffect): 'invoice' | 'creditMissing' | 'status' | null {
  if (effect === 'invoice_blocked') return 'invoice'
  if (effect === 'credit_missing') return 'creditMissing'
  return null
}

export interface ServiceSessionCancelDialogProps {
  open: boolean
  onClose: () => void
  session: ServiceSessionRow | null
}

export function ServiceSessionCancelDialog({
  open,
  onClose,
  session,
}: ServiceSessionCancelDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent data-service-session-cancel>
        {session ? <CancelBody session={session} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function CancelBody({ session, onClose }: { session: ServiceSessionRow; onClose: () => void }) {
  const tOriginal = useTranslations()
  const t = (key: string, fallback?: string): string => {
    try {
      const value = tOriginal(key as never)
      return value === key ? (fallback ?? key) : value
    } catch {
      return fallback ?? key
    }
  }

  const cancel = useCancelServiceDeliverySession()
  const [refusalCode, setRefusalCode] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)

  const effect = cancellationEffect(session)
  const notCancellable = !cancellable(session.status)
  const blocked = blockedReason(effect)
  const refused = serviceDeliveryErrorKey(refusalCode ?? undefined)

  const consequence =
    effect === 'package_reversal'
      ? t(
          'serviceDelivery.cancel.effectPackage',
          'اعتبار بستهٔ مصرف‌شده با یک ثبت برگشتی تازه به مشتری برمی‌گردد؛ هیچ سطری پاک یا تغییر داده نمی‌شود.',
        )
      : effect === 'free'
        ? t('serviceDelivery.cancel.effectFree', 'این جلسه رایگان بود؛ لغو آن اثر مالی ندارد.')
        : effect === 'invoice_blocked'
          ? t(
              'serviceDelivery.cancel.effectInvoice',
              'این خدمت روی یک فاکتور حساب شده است؛ برای اصلاح آن باید فاکتور اصلاح شود، نه جلسه لغو شود.',
            )
          : effect === 'credit_missing'
            ? t(
                'serviceDelivery.cancel.effectCreditMissing',
                'ثبت مصرف اعتبار این جلسه پیدا نشد؛ سرور لغو را نمی‌پذیرد.',
              )
            : t(
                'serviceDelivery.cancel.effectNothing',
                'این جلسه هنوز تحویل نشده است؛ لغو آن هیچ اثر مالی ندارد.',
              )

  const submit = () => {
    setRefusalCode(null)
    setTouched(true)
    if (cancellationReasonMissing(reason)) return
    cancel.mutate(
      { id: session.id, reason: reason.trim() },
      {
        onSuccess: () => onClose(),
        onError: (error) => setRefusalCode(serviceDeliveryErrorCode(error) ?? 'unknown'),
      },
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('serviceDelivery.cancel.title', 'لغو جلسه')}</DialogTitle>
        <DialogDescription>
          {t(
            'serviceDelivery.cancel.help',
            'قبل از تأیید، اثر مالی این لغو را بخوانید. لغو قابل بازگشت نیست.',
          )}
        </DialogDescription>
      </DialogHeader>

      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-xs text-[hsl(var(--fg-secondary))]">
            {t('serviceDelivery.fields.customer', 'مشتری')}
          </dt>
          <dd className="font-medium">
            {session.customerName ?? t('serviceDelivery.unknown.customer', 'نام مشتری خوانده نشد')}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[hsl(var(--fg-secondary))]">
            {t('serviceDelivery.fields.service', 'خدمت')}
          </dt>
          <dd className="font-medium">
            {session.serviceName ?? t('serviceDelivery.unknown.service', 'نام خدمت خوانده نشد')}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[hsl(var(--fg-secondary))]">
            {t('serviceDelivery.columns.status', 'وضعیت')}
          </dt>
          <dd>{t(`serviceDelivery.status.${session.status}`, session.status)}</dd>
        </div>
        <div>
          <dt className="text-xs text-[hsl(var(--fg-secondary))]">
            {t('serviceDelivery.columns.settlement', 'تسویه')}
          </dt>
          <dd>
            {t(`serviceDelivery.settlement.${session.settlementMethod}`, session.settlementMethod)}
          </dd>
        </div>
      </dl>

      <p
        data-cancel-effect={effect}
        className={
          blocked
            ? 'rounded-[var(--radius-md)] bg-[hsl(var(--color-destructive)/0.08)] px-3 py-2 text-sm text-[hsl(var(--color-destructive))]'
            : 'rounded-[var(--radius-md)] bg-[hsl(var(--surface-muted))] px-3 py-2 text-sm text-[hsl(var(--fg-primary))]'
        }
      >
        {notCancellable
          ? t('serviceDelivery.cancel.statusBlocked', 'این جلسه در وضعیتی نیست که لغو شود.')
          : consequence}
      </p>

      {!notCancellable && blocked === null ? (
        <Labeled
          label={t('serviceDelivery.cancel.reason', 'دلیل لغو')}
          error={
            touched && cancellationReasonMissing(reason)
              ? t('serviceDelivery.cancel.reasonRequired', 'دلیل لغو را بنویسید.')
              : undefined
          }
          hint={t(
            'serviceDelivery.cancel.reasonHint',
            'این دلیل روی جلسه ذخیره می‌شود و بعداً در جزئیات دیده می‌شود.',
          )}
        >
          <textarea
            name="reason"
            value={reason}
            onChange={(event) => {
              setReason(event.target.value)
              setRefusalCode(null)
            }}
            rows={2}
            className="w-full rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-3 py-2 text-sm"
          />
        </Labeled>
      ) : null}

      {refusalCode ? (
        <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
          {t(refused, 'این لغو انجام نشد')}
        </p>
      ) : null}

      <DialogFooter className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={cancel.isPending}>
          {t('serviceDelivery.actions.close', 'بستن')}
        </Button>
        <Button
          variant="destructive"
          onClick={submit}
          disabled={
            notCancellable ||
            blocked !== null ||
            cancel.isPending ||
            cancellationReasonMissing(reason)
          }
        >
          {cancel.isPending
            ? t('serviceDelivery.actions.saving', 'در حال ذخیره…')
            : t('serviceDelivery.cancel.confirm', 'لغو جلسه')}
        </Button>
      </DialogFooter>
    </>
  )
}
