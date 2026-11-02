'use client'

// ============================================
// «بازپرداخت به مشتری» — the three answers a refund needs: how, how much, from which till.
//
// ONE set of fields, used by the return form (pay back right away) and by the refund
// dialog (pay back later). The till is only asked for cash — a transfer never passed
// through a drawer — and «no till» is a real answer, exactly as on every other cash form.
// ============================================

import type { TillChoiceState } from '../../../hooks/use-till-choice'
import { Input } from '../input'
import { SelectField } from '../select-field'
import { TillSelectField } from '../till/till-select-field'

type T = (key: string, fallback?: string) => string

export interface RefundFieldsProps {
  /** Looks a key up under `invoices.` with a fallback. */
  tr: (key: string, fallback: string) => string
  /** The shared `t` the till field takes (its keys live under `payment.till`). */
  t: T
  method: 'cash' | 'bank'
  onMethod: (method: 'cash' | 'bank') => void
  amount: string
  onAmount: (amount: string) => void
  /** «at most …», already formatted with its currency. */
  maxText: string
  till: TillChoiceState
  disabled?: boolean | undefined
}

export function RefundFields({
  tr,
  t,
  method,
  onMethod,
  amount,
  onAmount,
  maxText,
  till,
  disabled,
}: RefundFieldsProps) {
  const small = 'mb-1 block text-xs text-[hsl(var(--fg-secondary))]'
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div>
        <label className={small}>{tr('refundMethod', 'روش پرداخت')}</label>
        <SelectField
          name="refundMethod"
          data-field="refundMethod"
          value={method}
          disabled={Boolean(disabled)}
          onChange={(value) => onMethod(value as 'cash' | 'bank')}
          options={[
            { value: 'cash', label: tr('refundCash', 'نقد') },
            { value: 'bank', label: tr('refundBank', 'بانک / حواله') },
          ]}
        />
      </div>
      <div>
        <label className={small}>
          {tr('refundAmount', 'مبلغ بازپرداخت')} ({tr('refundUpTo', 'حداکثر قابل پرداخت')} {maxText}
          )
        </label>
        <Input
          type="number"
          min="0"
          step="any"
          name="refundAmount"
          data-field="refundAmount"
          disabled={disabled}
          value={amount}
          onChange={(event) => onAmount(event.target.value)}
        />
      </div>
      {method === 'cash' ? (
        <div className="sm:col-span-2">
          <TillSelectField t={t} choice={till} direction="out" disabled={disabled} />
        </div>
      ) : null}
    </div>
  )
}
