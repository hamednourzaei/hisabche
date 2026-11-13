'use client'

// ============================================
// packages/ui/src/components/ui/invoices/invoice-returns-dialog.tsx
//
// Invoice Returns Dialog (Option 18 / Returns)
// Lands in: Sales -> Invoices Detail
//
// ONE return per invoice, with as many items as the customer brings back. For each item:
// how many, the condition of the goods, and where they go. For the document: why, what the
// shop keeps (percent of the goods or a fixed amount, each with a reason), and — if the
// invoice was paid — whether to pay the customer back now.
//
// The figures shown are an ESTIMATE from the same rules the database applies
// (`previewReturn`); the server answers with the amount that is booked.
//
// The return is recorded on the device too; only the refund section asks `invoice.return_refund`
// and renders a note (the refund dialog: `<CloudRequiredNotice />`)
// when executed under offline edition.
// ============================================

import { memo, useCallback, useMemo, useState } from 'react'
import {
  apiErrorCode,
  apiErrorMessage,
  useCreateInvoiceReturn,
  useExchangeInvoice,
  useMyCapabilities,
  useRefundInvoiceReturn,
} from '@hisabche/api'
import { fractionDigits, toIsoDay, type KnownCurrency } from '@hisabche/formatting'
import { useAuthStore } from '@hisabche/store'
import {
  canonicalIndustryTypes,
  DEDUCTION_REASONS,
  previewReturn,
  refundableMinor,
  RETURN_CONDITIONS,
  returnPolicyFor,
  type DeductionReason,
  type RestockChoice,
  type ReturnCondition,
  type ReturnDeductionRequest,
  type ReturnReason,
  unitSchema,
} from '@hisabche/validation'
import { Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useActionAvailability } from '../../../lib/capability/use-action-availability'
import { useNumberFormat } from '../../../hooks/use-number-format'
import { useTillChoice } from '../../../hooks/use-till-choice'
import { Button } from '../button'
import { Checkbox } from '../checkbox'
import { CloudRequiredNotice } from '../cloud-required-notice'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../dialog'
import { Input } from '../input'
import { SelectField, type SelectFieldOption } from '../select-field'
import { RefundFields } from './invoice-return-refund-fields'
import { InvoiceExchangeField } from './invoice-exchange-field'

export interface ReturnInvoiceItemOption {
  id?: string | undefined
  /** The product the line sold — what an exchange offers other models of (V64 §5.8). */
  productId?: string | null | undefined
  unit?: string | null | undefined
  productName?: string | undefined
  product_name?: string | undefined
  quantity?: number | undefined
  unitPrice?: number | undefined
  discount?: number | undefined
}

/** What the invoice owes and has been paid: the preview and the refund option need it. */
export interface ReturnInvoiceMoney {
  currency: string
  taxTotal: number
  total: number
  paidAmount: number
}

export interface InvoiceReturnsDialogProps {
  invoiceId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  items?: readonly ReturnInvoiceItemOption[] | undefined
  invoice?: ReturnInvoiceMoney | undefined
  t?: ((key: string, fallback?: string) => string) | undefined
}

interface Row {
  on: boolean
  qty: string
  condition: ReturnCondition
  destination: RestockChoice
  /** The model given in exchange; '' = an ordinary return of this line. */
  replacement: string
}

interface DeductionDraft {
  key: number
  reason: DeductionReason
  mode: 'percent' | 'fixed'
  value: string
  note: string
}

const maxQuantityOf = (item: ReturnInvoiceItemOption) => Math.max(1, item.quantity ?? 1)

/** How many of this item the person means to return: 0 when it is not ticked or the number is not one. */
function pickedQuantity(row: Row | undefined, item: ReturnInvoiceItemOption): number {
  if (!row?.on) return 0
  const value = Number(row.qty)
  return Number.isFinite(value) && value > 0 ? Math.min(value, maxQuantityOf(item)) : 0
}

/** Every item un-ticked (or ticked, when it is the only one), in the default condition of the trade. */
function initialRows(
  lines: readonly ReturnInvoiceItemOption[],
  policy: ReturnType<typeof returnPolicyFor>,
): Record<string, Row> {
  return Object.fromEntries(
    lines.map((item) => [
      item.id as string,
      {
        on: lines.length === 1,
        qty: String(Math.max(1, item.quantity ?? 1)),
        condition: 'sealed' as ReturnCondition,
        destination: policy.defaultDestination('sealed'),
        replacement: '',
      },
    ]),
  )
}

const CONDITION_KEY: Record<ReturnCondition, [string, string]> = {
  sealed: ['conditionSealed', 'سالم و در بسته‌بندی اصلی'],
  opened: ['conditionOpened', 'بازشده ولی سالم'],
  used: ['conditionUsed', 'استفاده‌شده'],
  damaged: ['conditionDamaged', 'آسیب‌دیده'],
  defective: ['conditionDefective', 'معیوب'],
  incomplete: ['conditionIncomplete', 'ناقص'],
}

const DEDUCTION_KEY: Record<DeductionReason, [string, string]> = {
  return_fee: ['deductionReturnFee', 'کارمزد مرجوعی'],
  repackaging: ['deductionRepackaging', 'بسته‌بندی مجدد'],
  damage: ['deductionDamage', 'آسیب‌دیدگی'],
  usage: ['deductionUsage', 'استفاده از کالا'],
  missing_parts: ['deductionMissingParts', 'کسری قطعات'],
  agreed: ['deductionAgreed', 'کسر توافقی'],
  other: ['deductionOther', 'سایر (با توضیح)'],
}

/** A server refusal with a sentence of its own; anything else falls back to the server's text. */
const ERROR_SENTENCE: Array<[string, string, string]> = [
  [
    'INVOICE_ALREADY_RETURNED',
    'returnAlreadyDone',
    'برای این فاکتور قبلاً مرجوعی ثبت شده است و فقط یک‌بار ممکن است.',
  ],
  [
    'RETURN_DEDUCTION_EXCEEDS_BASE',
    'returnErrDeductionExceeds',
    'مجموع کسورات از مبلغ کالای برگشتی بیشتر است.',
  ],
  ['RETURN_DEDUCTION_NOTE_REQUIRED', 'returnErrNoteRequired', 'برای کسر «سایر» توضیح لازم است.'],
  [
    'RETURN_DEDUCTION_',
    'returnErrDeductionInvalid',
    'یکی از کسورات معتبر نیست؛ درصد یا مبلغ را بررسی کنید.',
  ],
  ['RETURN_LINES_REQUIRED', 'returnErrNoLines', 'حداقل یک قلم را برای مرجوعی انتخاب کنید.'],
  [
    'RETURN_STOCK_DECISION_NOT_PERMITTED',
    'returnErrStockDecision',
    'برگرداندن کالا به انبار یا حذف آن از انبار نیاز به مجوز مدیر یا مالک دارد.',
  ],
  [
    'SCRAP_COST_UNKNOWN',
    'returnErrScrapCostUnknown',
    'بهای خرید این کالا ثبت نشده است؛ ضرر آن قابل محاسبه نیست و ضایعات تأیید نمی‌شود.',
  ],
  [
    'RETURN_MIGRATION_05_REQUIRED',
    'returnMigrationNeeded',
    'کسورات روی سرور فعال نشده است. با پشتیبانی تماس بگیرید.',
  ],
  [
    'RETURN_FUNCTION_MISSING',
    'returnNotReady',
    'مرجوعی هنوز روی سرور فعال نشده است. با پشتیبانی تماس بگیرید.',
  ],
]

/**
 * The shell only decides «online or not». The form is mounted by the dialog content, so every
 * opening starts from a fresh form — nothing is carried over from the last one and no effect
 * has to reset it.
 */
export const InvoiceReturnsDialog = memo(function InvoiceReturnsDialog({
  invoiceId,
  open,
  onOpenChange,
  items,
  invoice,
  t,
}: InvoiceReturnsDialogProps) {
  const availability = useActionAvailability('invoice.returns')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        {availability.requiresOnline ? (
          <CloudRequiredNotice
            variant="inline"
            title={t?.('invoices.returnInvoice', 'ثبت مرجوعی فاکتور') ?? 'ثبت مرجوعی فاکتور'}
            onDismiss={() => onOpenChange(false)}
          />
        ) : (
          <ReturnForm
            invoiceId={invoiceId}
            onClose={() => onOpenChange(false)}
            items={items}
            invoice={invoice}
            t={t}
          />
        )}
      </DialogContent>
    </Dialog>
  )
})

interface ReturnFormProps {
  invoiceId: string
  onClose: () => void
  items: readonly ReturnInvoiceItemOption[] | undefined
  invoice: ReturnInvoiceMoney | undefined
  t: ((key: string, fallback?: string) => string) | undefined
}

function ReturnForm({ invoiceId, onClose, items, invoice, t }: ReturnFormProps) {
  const createReturn = useCreateInvoiceReturn(invoiceId)
  const refund = useRefundInvoiceReturn(invoiceId)
  // An exchange is a return plus a new sale in one request; it needs the server.
  const exchange = useExchangeInvoice()
  const exchangeOnline = useActionAvailability('invoice.exchange').requiresOnline
  // The return itself is recorded on the device; paying the customer back needs the server.
  const canRefund = !useActionAvailability('invoice.return_refund').requiresOnline
  const fmt = useNumberFormat()
  const tr = useCallback(
    (key: string, fallback: string) => t?.(`invoices.${key}`, fallback) ?? fallback,
    [t],
  )

  // The default destination of goods in each condition follows the trades this business chose.
  const businessTypes = useAuthStore((state) => state.user?.businessTypes)
  const policy = useMemo(
    () => returnPolicyFor(canonicalIndustryTypes(businessTypes ?? []).known),
    [businessTypes],
  )

  // C5: a sound return needs only the return permission; WRITING GOODS OFF (scrap -> inventory loss) is a stock decision.
  const mayScrap = useMyCapabilities().can('stock.adjust') === true

  const currency = invoice?.currency ?? ''
  const digits = currency ? (fractionDigits(currency as KnownCurrency) ?? 2) : 2
  const factor = 10 ** digits

  const lines = useMemo(() => (items ?? []).filter((item) => item.id), [items])

  const [returnNumber, setReturnNumber] = useState('')
  const [reason, setReason] = useState<ReturnReason>('customer_change_of_mind')
  const [notes, setNotes] = useState('')
  const [rows, setRows] = useState<Record<string, Row>>(() => initialRows(lines, policy))
  const [deductions, setDeductions] = useState<DeductionDraft[]>([])
  const [refundNow, setRefundNow] = useState(false)
  const [refundMethod, setRefundMethod] = useState<'cash' | 'bank'>('cash')
  const [refundAmount, setRefundAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<string | null>(null)
  const till = useTillChoice(currency || undefined)
  const tt = (key: string, fallback?: string) => t?.(key, fallback) ?? fallback ?? key

  const patchRow = (id: string, patch: Partial<Row>) =>
    setRows((current) => ({ ...current, [id]: { ...current[id]!, ...patch } }))

  const maxOf = maxQuantityOf
  const qtyOf = (id: string, item: ReturnInvoiceItemOption) => pickedQuantity(rows[id], item)

  const requests: ReturnDeductionRequest[] = useMemo(
    () =>
      deductions.map((entry) => ({
        reason: entry.reason,
        mode: entry.mode,
        ...(entry.mode === 'percent'
          ? { percent: Number(entry.value) }
          : { amount: Number(entry.value) }),
        ...(entry.note.trim() ? { note: entry.note.trim() } : {}),
      })),
    [deductions],
  )

  const preview = useMemo(
    () =>
      previewReturn({
        items: lines.map((item) => ({
          id: item.id as string,
          quantity: item.quantity ?? 0,
          unitPrice: item.unitPrice ?? 0,
          discount: item.discount ?? 0,
        })),
        picked: Object.fromEntries(
          lines.map((item) => [item.id as string, pickedQuantity(rows[item.id as string], item)]),
        ),
        invoiceTax: invoice?.taxTotal ?? 0,
        deductions: requests,
        fractionDigits: digits,
      }),
    [lines, rows, requests, invoice?.taxTotal, digits],
  )

  const pickedCount = lines.filter((item) => qtyOf(item.id as string, item) > 0).length
  // Exchange mode: at least one returned line is swapped for another model. The customer's
  // credit then pays for the replacement, so cash refunds and deductions do not apply.
  const exchanging = lines.some(
    (item) => qtyOf(item.id as string, item) > 0 && Boolean(rows[item.id as string]?.replacement),
  )
  const money = (minor: number) => `${fmt(minor / factor, digits)} ${currency}`.trim()

  // What could be paid back in cash right now, by the same rule the database applies.
  const refundable = invoice
    ? refundableMinor({
        netCreditMinor: preview.creditMinor,
        invoiceTotalMinor: Math.round(invoice.total * factor),
        invoicePaidMinor: Math.round(invoice.paidAmount * factor),
        refundedMinor: 0,
      })
    : 0

  const sentence = (cause: unknown): string => {
    const code = apiErrorCode(cause)
    const message = apiErrorMessage(cause, '')
    const hit = ERROR_SENTENCE.find(([needle]) => code === needle || message.includes(needle))
    if (hit) return tr(hit[1], hit[2])
    return `${message || tr('returnFailed', 'ثبت مرجوعی انجام نشد')}${code ? ` (${code})` : ''}`
  }

  const submit = async () => {
    const number = returnNumber.trim()
    if (!number) return
    if (pickedCount === 0) {
      setError(tr('returnErrNoLines', 'حداقل یک قلم را برای مرجوعی انتخاب کنید.'))
      return
    }
    if (!exchanging && preview.error) {
      setError(
        preview.error === 'RETURN_DEDUCTION_EXCEEDS_BASE'
          ? tr('returnErrDeductionExceeds', 'مجموع کسورات از مبلغ کالای برگشتی بیشتر است.')
          : preview.error === 'RETURN_DEDUCTION_NOTE_REQUIRED'
            ? tr('returnErrNoteRequired', 'برای کسر «سایر» توضیح لازم است.')
            : tr(
                'returnErrDeductionInvalid',
                'یکی از کسورات معتبر نیست؛ درصد یا مبلغ را بررسی کنید.',
              ),
      )
      return
    }

    // C5: the server refuses a scrap without stock.adjust; say so BEFORE sending, naming the way out.
    if (
      !mayScrap &&
      lines.some(
        (item) =>
          qtyOf(item.id as string, item) > 0 && rows[item.id as string]?.destination === 'scrap',
      )
    ) {
      setError(
        tr(
          'returnErrStockDecision',
          'برگرداندن کالا به انبار یا حذف آن از انبار نیاز به مجوز مدیر یا مالک دارد.',
        ),
      )
      return
    }

    setError(null)
    if (exchanging) {
      const picked = lines.filter((item) => qtyOf(item.id as string, item) > 0)
      try {
        await exchange.mutateAsync({
          invoiceId,
          returnNumber: number,
          returnDate: toIsoDay(new Date()),
          reasonCode: reason,
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          returnedLines: picked.map((item) => {
            const row = rows[item.id as string]!
            return {
              originalLineId: item.id as string,
              quantity: qtyOf(item.id as string, item),
              restockChoice: row.destination,
              conditionCode: row.condition,
            }
          }),
          // The same quantity, at the price of the original line: an even swap of models.
          replacementItems: picked.flatMap((item) => {
            const row = rows[item.id as string]!
            if (!row.replacement || !item.productId) return []
            const unit = unitSchema.safeParse(item.unit)
            return [
              {
                productId: item.productId,
                variantId: row.replacement,
                productName: item.productName ?? item.product_name ?? '',
                quantity: qtyOf(item.id as string, item),
                unitPrice: item.unitPrice ?? 0,
                ...(unit.success ? { unit: unit.data } : {}),
              },
            ]
          }),
          paymentMethod: 'credit',
          paidAmount: 0,
        })
      } catch (cause) {
        setError(sentence(cause))
        return
      }
      setOutcome(
        tr(
          'exchangeDone',
          'تعویض ثبت شد: کالای برگشتی به حساب مشتری برگشت و فاکتور کالای جایگزین با همان مبلغ صادر شد.',
        ),
      )
      return
    }
    let created: Awaited<ReturnType<typeof createReturn.mutateAsync>>
    try {
      created = await createReturn.mutateAsync({
        returnType: 'sale_return',
        returnNumber: number,
        returnDate: toIsoDay(new Date()),
        reasonCode: reason,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(requests.length > 0 ? { deductions: requests } : {}),
        lines: lines
          .filter((item) => qtyOf(item.id as string, item) > 0)
          .map((item) => {
            const row = rows[item.id as string]!
            return {
              originalLineId: item.id as string,
              quantity: qtyOf(item.id as string, item),
              restockChoice: row.destination,
              reasonCode: reason,
              conditionCode: row.condition,
            }
          }),
      })
    } catch (cause) {
      setError(sentence(cause))
      return
    }

    // The return exists and the invoice has had its one return. If paying the customer back
    // fails now, the form must not look «unsaved»: it says what happened and where to retry.
    const amount = Number(refundAmount)
    if (canRefund && refundNow && refundable > 0 && amount > 0) {
      try {
        await refund.mutateAsync({
          returnId: created.id,
          amount,
          method: refundMethod,
          ...(refundMethod === 'cash' && till.tillSessionId
            ? { tillSessionId: till.tillSessionId }
            : {}),
        })
      } catch (cause) {
        const message = apiErrorMessage(cause, '')
        setOutcome(
          `${tr(
            'refundReturnedButNotPaid',
            'مرجوعی ثبت شد، ولی بازپرداخت انجام نشد. از همان بخش مرجوعی‌ها دوباره تلاش کنید:',
          )} ${
            message.includes('REFUND_PAID_NOT_SETTLED')
              ? tr(
                  'refundPaidNotSettled',
                  'پرداخت انجام شد ولی ثبت نهایی نشد. با پشتیبانی تماس بگیرید؛ دوباره پرداخت نکنید.',
                )
              : message.includes('REFUND_EXCEEDS_REFUNDABLE')
                ? tr('refundExceeds', 'مبلغ بازپرداخت از حد مجاز بیشتر است.')
                : message || tr('refundFailed', 'بازپرداخت انجام نشد')
          }`,
        )
        return
      }
    }
    onClose()
  }

  const reasonOptions: SelectFieldOption[] = [
    ['defective', 'reasonDefective', 'معیوب / خرابی کالا'],
    ['wrong_item', 'reasonWrongItem', 'ارسال اشتباه'],
    ['customer_change_of_mind', 'reasonChangeOfMind', 'انصراف مشتری'],
    ['damaged_in_transit', 'reasonDamaged', 'آسیب در حمل و نقل'],
    ['expired', 'reasonExpired', 'انقضای تاریخ مصرف'],
    ['other', 'reasonOther', 'سایر موارد'],
  ].map(([value, key, fallback]) => ({
    value: value as string,
    label: tr(key as string, fallback as string),
  }))

  const conditionOptions: SelectFieldOption[] = RETURN_CONDITIONS.map((value) => ({
    value,
    label: tr(CONDITION_KEY[value][0], CONDITION_KEY[value][1]),
  }))
  const destinationOptions: SelectFieldOption[] = [
    {
      value: 'restock',
      label: tr('restockChoiceRestock', 'برگشت به انبار (افزایش موجودی)'),
    },
    {
      value: 'scrap',
      label: tr('restockChoiceScrap', 'اسقاط / ضایعات (بدون افزایش موجودی)'),
      disabled: !mayScrap,
    },
  ]
  const deductionReasonOptions: SelectFieldOption[] = DEDUCTION_REASONS.map((value) => ({
    value,
    label: tr(DEDUCTION_KEY[value][0], DEDUCTION_KEY[value][1]),
  }))
  const modeOptions: SelectFieldOption[] = [
    { value: 'percent', label: tr('deductionPercent', 'درصد از مبلغ کالا') },
    { value: 'fixed', label: tr('deductionFixed', 'مبلغ ثابت') },
  ]

  const label = 'mb-1 block text-sm font-medium text-[hsl(var(--fg-primary))]'

  return outcome ? (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <RotateCcw className="h-5 w-5 text-[hsl(var(--color-primary))]" />
          {tr('returnInvoice', 'ثبت مرجوعی فاکتور')}
        </DialogTitle>
      </DialogHeader>
      <p role="alert" className="py-3 text-sm text-[hsl(var(--color-warning))]">
        {outcome}
      </p>
      <DialogFooter>
        <Button onClick={onClose}>{t?.('common.close', 'بستن') ?? 'بستن'}</Button>
      </DialogFooter>
    </>
  ) : (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <RotateCcw className="h-5 w-5 text-[hsl(var(--color-primary))]" />
          {tr('returnInvoice', 'ثبت مرجوعی فاکتور')}
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4 py-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={label}>{tr('returnNumber', 'شماره برگه مرجوعی')}</label>
            <Input
              name="returnNumber"
              data-field="returnNumber"
              value={returnNumber}
              onChange={(event) => setReturnNumber(event.target.value)}
              placeholder="RET-1001"
            />
          </div>
          <div>
            <label className={label}>{tr('returnDocumentReason', 'علت مرجوعی')}</label>
            <SelectField
              name="reasonCode"
              data-field="reasonCode"
              value={reason}
              onChange={(value) => setReason(value as ReturnReason)}
              options={reasonOptions}
            />
          </div>
        </div>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
            {tr('returnItemsTitle', 'اقلام مرجوعی')}
          </h3>
          <ul className="space-y-2">
            {lines.map((item, index) => {
              const id = item.id as string
              const row = rows[id]
              if (!row) return null
              return (
                <li
                  key={id}
                  className="space-y-2 rounded-xl border border-[hsl(var(--border-default))] p-3"
                >
                  <label className="flex items-center gap-2 text-sm text-[hsl(var(--fg-primary))]">
                    <Checkbox
                      checked={row.on}
                      onCheckedChange={(checked) => patchRow(id, { on: checked === true })}
                      aria-label={tr('returnPickLine', 'برگشت این قلم')}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {item.productName || item.product_name || `${index + 1}`}
                    </span>
                    <span className="shrink-0 text-xs text-[hsl(var(--fg-tertiary))] tabular-nums">
                      {fmt(item.quantity ?? 1, 3)}
                    </span>
                  </label>
                  {row.on ? (
                    <div className="grid gap-2 sm:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-xs text-[hsl(var(--fg-secondary))]">
                          {tr('returnQtyMax', 'تعداد (حداکثر')} {fmt(maxOf(item), 3)})
                        </label>
                        <Input
                          type="number"
                          min="0"
                          max={maxOf(item)}
                          name={`quantity-${id}`}
                          data-field={`quantity-${id}`}
                          value={row.qty}
                          onChange={(event) => patchRow(id, { qty: event.target.value })}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-[hsl(var(--fg-secondary))]">
                          {tr('returnCondition', 'وضعیت کالا')}
                        </label>
                        <SelectField
                          name={`condition-${id}`}
                          data-field={`condition-${id}`}
                          value={row.condition}
                          onChange={(value) =>
                            patchRow(id, {
                              condition: value as ReturnCondition,
                              destination: policy.defaultDestination(value as ReturnCondition),
                            })
                          }
                          options={conditionOptions}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-[hsl(var(--fg-secondary))]">
                          {tr('returnDestination', 'مقصد کالا')}
                        </label>
                        <SelectField
                          name={`destination-${id}`}
                          data-field={`destination-${id}`}
                          value={row.destination}
                          onChange={(value) =>
                            patchRow(id, { destination: value as RestockChoice })
                          }
                          options={destinationOptions}
                        />
                        {!mayScrap ? (
                          <p className="mt-1 text-xs text-[hsl(var(--fg-secondary))]">
                            {tr(
                              'returnScrapNeedsPermission',
                              'اسقاط کالا نیاز به مجوز «تعدیل موجودی» دارد؛ از مدیر یا مالک بخواهید.',
                            )}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  {row.on && item.productId ? (
                    <InvoiceExchangeField
                      productId={item.productId}
                      value={row.replacement}
                      onChange={(value) => patchRow(id, { replacement: value })}
                      disabled={exchangeOnline}
                      tr={tr}
                    />
                  ) : null}
                </li>
              )
            })}
          </ul>
          {exchangeOnline ? (
            <p className="text-xs text-[hsl(var(--fg-secondary))]">
              {tr(
                'exchangeOnlineOnly',
                'تعویض کالا فقط آنلاین انجام می‌شود؛ مرجوعی عادی همچنان ثبت می‌شود.',
              )}
            </p>
          ) : null}
          {exchanging ? (
            <p role="note" className="text-xs text-[hsl(var(--fg-secondary))]">
              {tr(
                'exchangeNote',
                'در تعویض، اعتبار کالای برگشتی صرف کالای جایگزین می‌شود؛ کسورات و بازپرداخت نقدی اعمال نمی‌شود.',
              )}
            </p>
          ) : null}
        </section>

        <section className="space-y-2" hidden={exchanging}>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
              {tr('deductionsTitle', 'کسورات (آنچه فروشگاه نگه می‌دارد)')}
            </h3>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setDeductions((current) => [
                  ...current,
                  {
                    key: (current.at(-1)?.key ?? 0) + 1,
                    reason: 'return_fee',
                    mode: 'percent',
                    value: '',
                    note: '',
                  },
                ])
              }
            >
              <Plus className="me-1 size-4" aria-hidden="true" />
              {tr('deductionAdd', 'افزودن کسر')}
            </Button>
          </div>
          {deductions.map((entry) => {
            const patch = (change: Partial<DeductionDraft>) =>
              setDeductions((current) =>
                current.map((row) => (row.key === entry.key ? { ...row, ...change } : row)),
              )
            return (
              <div
                key={entry.key}
                className="grid items-end gap-2 rounded-xl border border-[hsl(var(--border-default))] p-3 sm:grid-cols-[1fr_1fr_8rem_auto]"
              >
                <div>
                  <label className="mb-1 block text-xs text-[hsl(var(--fg-secondary))]">
                    {tr('deductionReason', 'علت کسر')}
                  </label>
                  <SelectField
                    name={`deduction-reason-${entry.key}`}
                    data-field={`deduction-reason-${entry.key}`}
                    value={entry.reason}
                    onChange={(value) => patch({ reason: value as DeductionReason })}
                    options={deductionReasonOptions}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[hsl(var(--fg-secondary))]">
                    {tr('deductionMode', 'نوع کسر')}
                  </label>
                  <SelectField
                    name={`deduction-mode-${entry.key}`}
                    data-field={`deduction-mode-${entry.key}`}
                    value={entry.mode}
                    onChange={(value) => patch({ mode: value as 'percent' | 'fixed' })}
                    options={modeOptions}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[hsl(var(--fg-secondary))]">
                    {entry.mode === 'percent'
                      ? tr('deductionValuePercent', 'درصد')
                      : `${tr('deductionValueAmount', 'مبلغ')} ${currency}`.trim()}
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    name={`deduction-value-${entry.key}`}
                    data-field={`deduction-value-${entry.key}`}
                    value={entry.value}
                    onChange={(event) => patch({ value: event.target.value })}
                  />
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={tr('deductionRemove', 'حذف این کسر')}
                  onClick={() =>
                    setDeductions((current) => current.filter((row) => row.key !== entry.key))
                  }
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
                <div className="sm:col-span-4">
                  <Input
                    name={`deduction-note-${entry.key}`}
                    data-field={`deduction-note-${entry.key}`}
                    value={entry.note}
                    onChange={(event) => patch({ note: event.target.value })}
                    placeholder={tr('deductionNote', 'توضیح')}
                  />
                </div>
              </div>
            )
          })}
        </section>

        <div>
          <label className={label}>{tr('returnNotes', 'توضیحات')}</label>
          <Input
            name="notes"
            data-field="notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>

        <section
          aria-label={tr('summaryTitle', 'پیش‌نمایش محاسبه')}
          className="space-y-1 rounded-xl bg-[hsl(var(--surface-muted))] p-3 text-sm"
        >
          <Line
            label={tr('summaryGoods', 'جمع کالاهای برگشتی')}
            value={money(preview.subtotalMinor)}
          />
          {preview.discountMinor > 0 ? (
            <Line
              label={tr('summaryDiscount', 'تخفیف')}
              value={`− ${money(preview.discountMinor)}`}
            />
          ) : null}
          {preview.taxMinor > 0 ? (
            <Line label={tr('summaryTax', 'مالیات برگشتی')} value={money(preview.taxMinor)} />
          ) : null}
          {preview.deductionMinor > 0 ? (
            <Line
              label={tr('summaryDeductions', 'کسورات')}
              value={`− ${money(preview.deductionMinor)}`}
            />
          ) : null}
          <Line
            strong
            label={tr('summaryCredit', 'مبلغ قابل استرداد به مشتری')}
            value={money(preview.creditMinor)}
          />
          <p className="pt-1 text-xs text-[hsl(var(--fg-tertiary))]">
            {tr('summaryEstimate', 'این رقم تخمینی است؛ مبلغ نهایی را سرور محاسبه و ثبت می‌کند.')}
          </p>
        </section>

        <section className="space-y-2" hidden={exchanging}>
          <h3 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
            {tr('refundTitle', 'بازپرداخت به مشتری')}
          </h3>
          {!canRefund ? (
            <p className="text-xs text-[hsl(var(--fg-secondary))]">
              {tr(
                'refundOnlineOnly',
                'پرداخت پول به مشتری فقط آنلاین انجام می‌شود. مرجوعی ثبت می‌شود و بعد از همگام‌سازی، بازپرداخت را از همین فاکتور انجام بده.',
              )}
            </p>
          ) : refundable > 0 ? (
            <>
              <label className="flex items-center gap-2 text-sm text-[hsl(var(--fg-primary))]">
                <Checkbox
                  checked={refundNow}
                  onCheckedChange={(checked) => {
                    const on = checked === true
                    setRefundNow(on)
                    if (on && !refundAmount) setRefundAmount(String(refundable / factor))
                  }}
                  aria-label={tr('refundNow', 'همین حالا به مشتری پرداخت شود')}
                />
                {tr('refundNow', 'همین حالا به مشتری پرداخت شود')}
              </label>
              {refundNow ? (
                <RefundFields
                  tr={tr}
                  t={tt}
                  method={refundMethod}
                  onMethod={setRefundMethod}
                  amount={refundAmount}
                  onAmount={setRefundAmount}
                  maxText={money(refundable)}
                  till={till}
                  disabled={refund.isPending}
                />
              ) : null}
            </>
          ) : (
            <p className="text-xs text-[hsl(var(--fg-secondary))]">
              {tr(
                'refundNotDue',
                'این فاکتور پرداخت نشده است؛ مبلغ مرجوعی فقط از بدهی مشتری کم می‌شود و پولی برگردانده نمی‌شود.',
              )}
            </p>
          )}
        </section>
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
        <Button
          onClick={submit}
          disabled={
            !returnNumber.trim() ||
            pickedCount === 0 ||
            createReturn.isPending ||
            refund.isPending ||
            exchange.isPending
          }
        >
          {exchanging
            ? tr('submitExchange', 'ثبت تعویض')
            : tr('submitReturn', 'ثبت و اعمال مرجوعی')}
        </Button>
      </DialogFooter>
    </>
  )
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={
        strong
          ? 'flex items-center justify-between gap-3 border-t border-[hsl(var(--border-default))] pt-1 font-semibold text-[hsl(var(--fg-primary))]'
          : 'flex items-center justify-between gap-3 text-[hsl(var(--fg-secondary))]'
      }
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}
