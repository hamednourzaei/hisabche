'use client'

// ============================================
// «صندوق» — the till a cash payment goes into or comes out of.
//
// ONE field, used wherever cash is recorded against an invoice: the invoice
// being created (sale or purchase), a payment added to an invoice later, and
// a customer's payment. Render it only while the method is cash — a transfer
// or a card never passed through a drawer.
//
// Its state is `useTillChoice`, held by the form that submits, so what is
// shown and what is sent are one value.
//
// ⚠️ «بدون صندوق» IS A REAL ANSWER: cash that never went through a till. The
// server then touches no till — it does not guess one from who is signed in.
// ⚠️ A FAILED READ IS NOT «NO TILLS». It is said, with a retry.
// ============================================

import type { TillChoiceState } from '../../../hooks/use-till-choice'
import { Button } from '../button'
import { Label } from '../label'
import { SelectField } from '../select-field'

type T = (key: string, fallback?: string) => string

/** SelectField has no empty value; this stands for «no till». */
const NO_TILL = 'none'

export interface TillSelectFieldProps {
  t: T
  choice: TillChoiceState
  /** 'in' = money received (a sale), 'out' = money paid (a purchase). */
  direction: 'in' | 'out'
  disabled?: boolean | undefined
}

export function TillSelectField({ t, choice, direction, disabled }: TillSelectFieldProps) {
  const chosen = choice.choices.find((row) => row.id === choice.tillSessionId)
  const label =
    direction === 'in'
      ? t('payment.till.into', 'به کدام صندوق می‌رود')
      : t('payment.till.outOf', 'از کدام صندوق پرداخت می‌شود')

  return (
    <div className="space-y-1" data-till-select>
      <Label>{label}</Label>
      {choice.failed ? (
        <div className="flex items-center gap-2">
          <p role="alert" className="text-xs text-[hsl(var(--color-destructive))]">
            {t('payment.till.failed', 'فهرست صندوق‌ها خوانده نشد.')}
          </p>
          <Button type="button" size="sm" variant="outline" onClick={choice.retry}>
            {t('common.retry', 'تلاش دوباره')}
          </Button>
        </div>
      ) : (
        <SelectField
          value={choice.tillSessionId || NO_TILL}
          onChange={(next) => choice.pick(next === NO_TILL ? '' : next)}
          disabled={Boolean(disabled) || choice.isLoading}
          data-field="tillSessionId"
          aria-label={label}
          className="w-full"
          options={[
            { value: NO_TILL, label: t('payment.till.none', 'بدون صندوق') },
            ...choice.choices.map((row) => ({
              value: row.id,
              label: `${row.label ?? t('payment.till.unnamed', 'صندوق بی‌نام')} · ${row.currency}`,
            })),
          ]}
        />
      )}
      {!choice.failed && !choice.isLoading && choice.choices.length === 0 ? (
        <p className="text-xs text-[hsl(var(--fg-tertiary))]">
          {t(
            'payment.till.noneOpen',
            'صندوق بازی برای این ارز نیست؛ این پول در هیچ صندوقی ثبت نمی‌شود.',
          )}
        </p>
      ) : null}
      {chosen?.atRate ? (
        <p className="text-xs text-[hsl(var(--fg-secondary))]" data-till-at-rate>
          {t(
            'payment.till.atRate',
            'این صندوق به ارز دفاتر است؛ مبلغ با نرخ تبدیلِ همین پرداخت در آن ثبت می‌شود.',
          )}
        </p>
      ) : null}
    </div>
  )
}
