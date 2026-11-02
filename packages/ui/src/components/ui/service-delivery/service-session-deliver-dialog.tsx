'use client'

// ============================================
// «تحویل خدمت» — the financial step.
//
// ⚠️ SETTLEMENT IS THE FIRST QUESTION, AND IT IS ANSWERED HERE, NOT AT CREATE.
// The session carries a *default*; the real choice — which package, which
// invoice, why it is free — belongs to the person in front of the customer.
// Nothing in this dialog infers one, and nothing switches one when the first
// answer cannot be honoured: the server refuses, and the refusal is shown.
//
// ⚠️ AN INVOICE IS LINKED, NEVER CREATED. The picker lists this customer's own
// existing invoices. «Create an invoice» leaves for the invoice screen.
//
// ⚠️ A DELIVERED SESSION IS NOT DELIVERABLE AGAIN. The button is not offered;
// the body is replaced by the reason, because a replayed server delivery is a
// no-op and a second credit consumption is the bug this prevents.
//
// ⚠️ `expectedUpdatedAt` GOES WITH EVERY REQUEST. A dialog opened on a stale
// row is refused (`SESSION_CHANGED`) instead of overwriting someone's change.
//
// ⚠️ THE BUTTON IS NOT THE CONTROL. Insufficient credit disables it, and the
// server's own `INSUFFICIENT_PACKAGE_CREDIT` is still rendered if it happens.
// ============================================

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  useDeliverServiceDeliverySession,
  useInvoices,
  usePackageCreditBalance,
} from '@hisabche/api'

import { Button } from '../button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../dialog'
import { NumberField } from '../capability/capability-kit'
import type { SelectFieldOption } from '../select-field'
import { useDateFormat } from '../../../hooks/use-date-format'
import { Labeled, SelectInput } from './service-delivery-fields'
import {
  deliveryBlocked,
  SETTLEMENT_METHODS,
  type ServiceSessionRow,
  type SettlementMethod,
} from './service-delivery-model'
import { serviceDeliveryErrorCode, serviceDeliveryErrorKey } from './service-delivery-errors'

export interface ServiceSessionDeliverDialogProps {
  open: boolean
  onClose: () => void
  /** The row the list already holds. Never re-read one by id: no such endpoint is in the matrix. */
  session: ServiceSessionRow | null
  /** Package product id → name. A missing entry is «نام بسته خوانده نشد», never a blank picker. */
  packageNameById: ReadonlyMap<string, string>
  /** This host keeps an outbox: a delivery is written here first and sent afterwards. */
  syncAvailable: boolean
  /** Leave for the invoice screen — the only place an invoice is created. */
  onOpenInvoices: () => void
  /** Re-read the list after a refusal about a stale row. */
  onReload: () => void
}

type DeliverField = 'settlementMethod' | 'packageProductId' | 'invoiceId' | 'reason'

/** Which control a refusal belongs to. The SENTENCE always comes from our catalog. */
const FIELD_BY_CODE: Record<string, DeliverField> = {
  SETTLEMENT_PACKAGE_REQUIRED: 'packageProductId',
  INSUFFICIENT_PACKAGE_CREDIT: 'packageProductId',
  SETTLEMENT_INVOICE_REQUIRED: 'invoiceId',
  SETTLEMENT_INVOICE_INVALID: 'invoiceId',
  SETTLEMENT_REASON_REQUIRED: 'reason',
}

export function ServiceSessionDeliverDialog({
  open,
  onClose,
  session,
  packageNameById,
  syncAvailable,
  onOpenInvoices,
  onReload,
}: ServiceSessionDeliverDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent data-service-session-deliver className="max-h-[90vh] overflow-y-auto">
        {session ? (
          <DeliverBody
            session={session}
            packageNameById={packageNameById}
            syncAvailable={syncAvailable}
            onOpenInvoices={onOpenInvoices}
            onReload={onReload}
            onClose={onClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function DeliverBody({
  session,
  packageNameById,
  syncAvailable,
  onOpenInvoices,
  onReload,
  onClose,
}: {
  session: ServiceSessionRow
  packageNameById: ReadonlyMap<string, string>
  syncAvailable: boolean
  onOpenInvoices: () => void
  onReload: () => void
  onClose: () => void
}) {
  const tOriginal = useTranslations()
  const t = (key: string, fallback?: string): string => {
    try {
      const value = tOriginal(key as never)
      return value === key ? (fallback ?? key) : value
    } catch {
      return fallback ?? key
    }
  }
  const dates = useDateFormat()

  const balance = usePackageCreditBalance(session.customerId)
  const invoices = useInvoices({
    customerId: session.customerId,
    page: 1,
    limit: 100,
    sortDirection: 'desc',
  })
  const deliver = useDeliverServiceDeliverySession()

  // ⚠️ STARTS EMPTY. The session's default is a suggestion, not an answer:
  // pre-selecting it would let a delivery be recorded without anyone choosing
  // how it is settled — the exact inference this dialog exists to prevent.
  const [settlement, setSettlement] = useState<SettlementMethod | ''>('')
  const [packageProductId, setPackageProductId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [invoiceId, setInvoiceId] = useState('')
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<Partial<Record<DeliverField, string>>>({})
  const [refusalCode, setRefusalCode] = useState<string | null>(null)
  const [refusalField, setRefusalField] = useState<DeliverField | null>(null)

  const balances = balance.data?.balances ?? []
  const selectedBalance = balances.find((entry) => entry.packageProductId === packageProductId)
  const balanceUnread = balance.isError
  const balanceUnknown =
    settlement === 'package_credit' && Boolean(packageProductId) && selectedBalance === undefined
  const insufficient =
    settlement === 'package_credit' &&
    selectedBalance !== undefined &&
    selectedBalance.balance < quantity

  const invoiceRows = invoices.data?.invoices ?? []
  const invoiceOptions: SelectFieldOption[] = invoiceRows.map((invoice) => ({
    value: invoice.id ?? '',
    label: [
      invoice.invoiceNumber ?? (invoice.id ?? '').slice(0, 8),
      invoice.date ? dates.date(invoice.date) : null,
    ]
      .filter((part): part is string => Boolean(part))
      .join(' · '),
    keywords: invoice.status ?? undefined,
  }))

  const packageOptions: SelectFieldOption[] = balances.map((entry) => {
    const name = packageNameById.get(entry.packageProductId)
    return {
      value: entry.packageProductId,
      label: `${name ?? t('serviceDelivery.unknown.package', 'نام بسته خوانده نشد')} — ${entry.balance}`,
    }
  })

  const settlementOptions: SelectFieldOption[] = SETTLEMENT_METHODS.map((method) => ({
    value: method,
    label: t(`serviceDelivery.settlement.${method}`, method),
  }))

  const blocked = deliveryBlocked(session.status)
  const refusalKey = serviceDeliveryErrorKey(refusalCode ?? undefined)

  const fieldError = (field: DeliverField): string | undefined =>
    errors[field] ?? (refusalField === field ? t(refusalKey, 'این تسویه انجام نشد') : undefined)

  const submit = () => {
    const next: Partial<Record<DeliverField, string>> = {}
    if (!settlement) {
      next.settlementMethod = t(
        'serviceDelivery.deliver.settlementRequired',
        'روش تسویه را انتخاب کنید',
      )
    }
    if (settlement === 'package_credit') {
      if (!packageProductId) {
        next.packageProductId = t(
          'serviceDelivery.deliver.packageRequired',
          'بستهٔ اعتباری را انتخاب کنید',
        )
      } else if (balanceUnread) {
        next.packageProductId = t(
          'serviceDelivery.deliver.balanceUnread',
          'موجودی بسته‌ها خوانده نشد؛ بدون آن تحویل ثبت نمی‌شود',
        )
      } else if (balanceUnknown) {
        next.packageProductId = t(
          'serviceDelivery.deliver.balanceUnknown',
          'این بسته در حساب مشتری نیست',
        )
      } else if (insufficient) {
        next.packageProductId = t(
          'serviceDelivery.deliver.insufficient',
          'اعتبار این بسته برای این تعداد کافی نیست',
        )
      }
    }
    if (settlement === 'invoice' && !invoiceId) {
      next.invoiceId = t('serviceDelivery.deliver.invoiceRequired', 'فاکتور مشتری را انتخاب کنید')
    }
    if (settlement === 'complementary' && !reason.trim()) {
      next.reason = t('serviceDelivery.deliver.reasonRequired', 'دلیل رایگان‌بودن خدمت را بنویسید')
    }

    setErrors(next)
    if (Object.keys(next).length > 0 || !settlement) return

    setRefusalCode(null)
    setRefusalField(null)

    deliver.mutate(
      {
        id: session.id,
        settlementMethod: settlement,
        ...(settlement === 'package_credit' ? { packageProductId, quantity } : {}),
        ...(settlement === 'invoice' ? { invoiceId } : {}),
        ...(settlement === 'complementary' ? { reason: reason.trim() } : {}),
        ...(session.updatedAt ? { expectedUpdatedAt: session.updatedAt } : {}),
      },
      {
        onSuccess: () => onClose(),
        onError: (error) => {
          const code = serviceDeliveryErrorCode(error)
          setRefusalCode(code ?? 'unknown')
          setRefusalField(code ? (FIELD_BY_CODE[code] ?? null) : null)
        },
      },
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('serviceDelivery.deliver.title', 'تحویل خدمت')}</DialogTitle>
        <DialogDescription>
          {blocked
            ? t(
                'serviceDelivery.deliver.blocked',
                'این جلسه در وضعیتی نیست که بتوان تحویلش داد؛ فقط جلسه‌ی زمان‌بندی‌شده یا در حال انجام تحویل می‌شود.',
              )
            : t(
                'serviceDelivery.deliver.help',
                'با تحویل، تسویه ثبت می‌شود: اعتبار بسته مصرف می‌شود، جلسه به یک فاکتور موجود مشتری وصل می‌شود، یا رایگان با دلیل ثبت می‌شود.',
              )}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3">
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-xs text-[hsl(var(--fg-secondary))]">
              {t('serviceDelivery.fields.customer', 'مشتری')}
            </dt>
            <dd className="font-medium">
              {session.customerName ??
                t('serviceDelivery.unknown.customer', 'نام مشتری خوانده نشد')}
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
              {t('serviceDelivery.fields.date', 'تاریخ')}
            </dt>
            <dd dir="ltr" className="tabular-nums">
              {session.sessionDate} · {session.startTime}–{session.endTime}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[hsl(var(--fg-secondary))]">
              {t('serviceDelivery.columns.status', 'وضعیت')}
            </dt>
            <dd>{t(`serviceDelivery.status.${session.status}`, session.status)}</dd>
          </div>
        </dl>

        <SelectInput
          label={t('serviceDelivery.fields.settlement', 'روش تسویه')}
          name="settlementMethod"
          value={settlement}
          onChange={(value) => {
            setSettlement(value as SettlementMethod | '')
            setErrors({})
            setRefusalCode(null)
            setRefusalField(null)
          }}
          options={settlementOptions}
          placeholder={t('serviceDelivery.deliver.chooseSettlement', 'انتخاب کنید…')}
          error={fieldError('settlementMethod')}
          hint={t(
            'serviceDelivery.deliver.settlementHint',
            'تسویه همین‌جا انتخاب می‌شود؛ پیش‌فرض جلسه فقط یک پیشنهاد بود.',
          )}
        />

        {settlement === 'package_credit' ? (
          <>
            <SelectInput
              label={t('serviceDelivery.fields.package', 'بستهٔ اعتباری')}
              name="packageProductId"
              value={packageProductId}
              onChange={(value) => {
                setPackageProductId(value)
                setRefusalCode(null)
              }}
              options={packageOptions}
              searchable
              searchPlaceholder={t('serviceDelivery.fields.search', 'جست‌وجو…')}
              noResultsText={t('serviceDelivery.fields.noResults', 'چیزی پیدا نشد')}
              placeholder={t('serviceDelivery.deliver.choosePackage', 'انتخاب بسته…')}
              error={fieldError('packageProductId')}
              hint={
                balanceUnread
                  ? t(
                      'serviceDelivery.deliver.balanceUnread',
                      'موجودی بسته‌ها خوانده نشد؛ بدون آن تحویل ثبت نمی‌شود',
                    )
                  : balances.length === 0
                    ? t(
                        'serviceDelivery.deliver.noPackages',
                        'این مشتری هیچ حساب بستهٔ اعتباری ندارد',
                      )
                    : selectedBalance
                      ? t('serviceDelivery.deliver.balanceIs', 'موجودی این بسته: {count}').replace(
                          '{count}',
                          String(selectedBalance.balance),
                        )
                      : t(
                          'serviceDelivery.deliver.balanceFromServer',
                          'موجودی را سرور می‌گوید؛ این صفحه آن را حساب نمی‌کند.',
                        )
              }
            />

            <NumberField
              label={t('serviceDelivery.fields.quantity', 'تعداد')}
              value={quantity}
              onChange={setQuantity}
              min={1}
            />

            {insufficient ? (
              <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
                {t(
                  'serviceDelivery.deliver.insufficient',
                  'اعتبار این بسته برای این تعداد کافی نیست',
                )}
              </p>
            ) : null}
          </>
        ) : null}

        {settlement === 'invoice' ? (
          <>
            <SelectInput
              label={t('serviceDelivery.fields.invoice', 'فاکتور مشتری')}
              name="invoiceId"
              value={invoiceId}
              onChange={(value) => {
                setInvoiceId(value)
                setRefusalCode(null)
              }}
              options={invoiceOptions}
              searchable
              searchPlaceholder={t('serviceDelivery.fields.search', 'جست‌وجو…')}
              noResultsText={t('serviceDelivery.fields.noResults', 'چیزی پیدا نشد')}
              placeholder={t('serviceDelivery.deliver.chooseInvoice', 'انتخاب فاکتور…')}
              error={fieldError('invoiceId')}
              hint={t(
                'serviceDelivery.deliver.invoiceLinks',
                'این جلسه به فاکتور انتخاب‌شده وصل می‌شود؛ فاکتور تازه‌ای ساخته نمی‌شود.',
              )}
            />
            {invoices.isError ? (
              <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
                {t(
                  'serviceDelivery.deliver.invoicesUnread',
                  'فهرست فاکتورهای این مشتری خوانده نشد',
                )}
              </p>
            ) : invoices.isLoading ? (
              <p className="text-xs text-[hsl(var(--fg-tertiary))]">
                {t('serviceDelivery.loading', 'در حال بارگذاری…')}
              </p>
            ) : invoiceRows.length === 0 ? (
              <p className="text-xs text-[hsl(var(--fg-secondary))]">
                {t(
                  'serviceDelivery.deliver.noInvoices',
                  'این مشتری فاکتور ثبت‌شده‌ای ندارد. برای ساخت فاکتور به صفحه‌ی فاکتورها بروید؛ از این‌جا فاکتور ساخته نمی‌شود.',
                )}{' '}
                <button
                  type="button"
                  onClick={onOpenInvoices}
                  className="underline underline-offset-2"
                >
                  {t('serviceDelivery.deliver.openInvoices', 'صفحه‌ی فاکتورها')}
                </button>
              </p>
            ) : null}
          </>
        ) : null}

        {settlement === 'complementary' ? (
          <Labeled
            label={t('serviceDelivery.fields.reason', 'دلیل رایگان‌بودن')}
            error={fieldError('reason')}
            hint={t(
              'serviceDelivery.deliver.reasonHint',
              'خدمت رایگان بدون دلیل ثبت نمی‌شود؛ این دلیل روی جلسه ذخیره می‌شود.',
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

        {syncAvailable ? (
          <p className="rounded-[var(--radius-md)] bg-[hsl(var(--surface-muted))] px-3 py-2 text-xs text-[hsl(var(--fg-secondary))]">
            {t(
              'serviceDelivery.deliver.deviceFirst',
              'تحویل ابتدا روی همین دستگاه ثبت می‌شود و سپس برای سرور فرستاده می‌شود؛ تا تأیید سرور، ستون «ارسال به سرور» در صف است.',
            )}
          </p>
        ) : null}

        {refusalCode ? (
          <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
            {t(refusalKey, 'این تحویل انجام نشد')}
            {refusalCode === 'SESSION_CHANGED' ? (
              <>
                {' '}
                <button
                  type="button"
                  onClick={() => {
                    onReload()
                    onClose()
                  }}
                  className="underline underline-offset-2"
                >
                  {t('serviceDelivery.deliver.reload', 'بازخوانی فهرست')}
                </button>
              </>
            ) : null}
          </p>
        ) : null}
      </div>

      <DialogFooter className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={deliver.isPending}>
          {t('serviceDelivery.actions.close', 'بستن')}
        </Button>
        <Button
          onClick={submit}
          disabled={blocked || deliver.isPending || insufficient || balanceUnknown}
        >
          {deliver.isPending
            ? t('serviceDelivery.actions.saving', 'در حال ذخیره…')
            : t('serviceDelivery.deliver.confirm', 'ثبت تحویل')}
        </Button>
      </DialogFooter>
    </>
  )
}
