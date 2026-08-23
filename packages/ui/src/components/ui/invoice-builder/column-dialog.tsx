// ============================================
// Add / edit a column.
//
// The whole trade-specific surface of the product lives behind this one
// dialog: «وزن», «عیار», «IMEI», «متراژ», «ساعت کار» are all just a title, a
// type and a couple of switches. Nothing downstream knows what they mean.
// ============================================
'use client'

import { memo, useEffect, useState } from 'react'
import {
  canAggregate,
  currencyPrecision,
  customColumnId,
  type InvoiceColumn,
  type InvoiceColumnType,
  COLUMN_TYPES,
} from '@hisabche/validation'
import { SUPPORTED_CURRENCIES, type CurrencyCode } from '@hisabche/store'

import { Button } from '../button'
import { Input } from '../input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../dialog'
import { Switch } from '../switch'
import { cn } from '../../../lib/utils'

const TYPE_FALLBACK: Record<InvoiceColumnType, string> = {
  text: 'متن',
  integer: 'عدد صحیح',
  decimal: 'عدد اعشاری',
  currency: 'مبلغ',
  percent: 'درصد',
  date: 'تاریخ',
  select: 'انتخابی',
  boolean: 'بله / خیر',
  computed: 'محاسباتی',
}

/** `computed` is derived by the engine — a user cannot author one. */
const AUTHORABLE_TYPES = COLUMN_TYPES.filter((type) => type !== 'computed')

export interface ColumnDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  t: (key: string, fallback?: string) => string
  /** Present when editing; absent when adding. */
  column: InvoiceColumn | null
  existingColumns: readonly InvoiceColumn[]
  invoiceCurrency: CurrencyCode
  onSubmit: (column: InvoiceColumn) => void
}

export const ColumnDialog = memo(function ColumnDialog({
  open,
  onOpenChange,
  t,
  column,
  existingColumns,
  invoiceCurrency,
  onSubmit,
}: ColumnDialogProps) {
  const editing = column !== null

  const [label, setLabel] = useState('')
  const [type, setType] = useState<InvoiceColumnType>('text')
  const [currency, setCurrency] = useState<CurrencyCode>(invoiceCurrency)
  const [suffix, setSuffix] = useState('')
  const [precision, setPrecision] = useState('2')
  const [aggregate, setAggregate] = useState(false)
  const [optionsText, setOptionsText] = useState('')
  const [defaultValue, setDefaultValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Reload the form whenever the dialog opens on a different column, so
  // editing «عیار» never shows the last column's settings.
  useEffect(() => {
    if (!open) return
    setError(null)
    setLabel(column?.label ?? '')
    setType(column?.type ?? 'text')
    setCurrency(column?.currency ?? invoiceCurrency)
    setSuffix(column?.suffix ?? '')
    setPrecision(String(column?.precision ?? 2))
    setAggregate(column?.aggregate ?? false)
    setOptionsText((column?.options ?? []).join('\n'))
    setDefaultValue(column?.defaultValue ?? '')
  }, [open, column, invoiceCurrency])

  const numeric = canAggregate(type)

  const handleSubmit = () => {
    const title = label.trim()
    if (!title) {
      setError(t('invoiceBuilder.column.titleRequired', 'عنوان ستون الزامی است'))
      return
    }
    const duplicate = existingColumns.some((c) => c.id !== column?.id && c.label.trim() === title)
    if (duplicate) {
      setError(t('invoiceBuilder.column.duplicateTitle', 'ستونی با همین عنوان وجود دارد'))
      return
    }

    const options = optionsText
      .split('\n')
      .map((o) => o.trim())
      .filter(Boolean)

    if (type === 'select' && options.length === 0) {
      setError(
        t('invoiceBuilder.column.optionsRequired', 'برای ستون انتخابی حداقل یک گزینه لازم است'),
      )
      return
    }

    const resolvedPrecision =
      type === 'currency'
        ? currencyPrecision(currency)
        : type === 'integer'
          ? 0
          : Math.min(6, Math.max(0, parseInt(precision, 10) || 0))

    const next: InvoiceColumn = {
      id: column?.id ?? customColumnId(title, existingColumns),
      label: title,
      type,
      // A user-authored column is never system: it carries no field the
      // invoice needs to exist, so it must stay deletable.
      system: column?.system ?? false,
      visible: column?.visible ?? true,
      aggregate: numeric && aggregate,
      precision: resolvedPrecision,
      ...(type === 'currency' ? { currency } : {}),
      ...(suffix.trim() ? { suffix: suffix.trim() } : {}),
      ...(type === 'select' ? { options } : {}),
      ...(defaultValue.trim() ? { defaultValue: defaultValue.trim() } : {}),
      ...(column?.labelKey ? { labelKey: column.labelKey } : {}),
    }

    onSubmit(next)
    onOpenChange(false)
  }

  const fieldLabel = 'mb-1.5 block text-xs font-medium text-[hsl(var(--fg-secondary))]'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editing
              ? t('invoiceBuilder.column.editTitle', 'ویرایش ستون')
              : t('invoiceBuilder.column.addTitle', 'افزودن ستون')}
          </DialogTitle>
          <DialogDescription>
            {t(
              'invoiceBuilder.column.description',
              'ستون دلخواه کسب‌وکار خودتان را بسازید — سیستم به معنای آن کاری ندارد.',
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label htmlFor="column-title" className={fieldLabel}>
              {t('invoiceBuilder.column.title', 'عنوان ستون')}
            </label>
            <Input
              id="column-title"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t('invoiceBuilder.column.titlePlaceholder', 'مثلاً: وزن خالص')}
            />
          </div>

          <div>
            <label htmlFor="column-type" className={fieldLabel}>
              {t('invoiceBuilder.column.type', 'نوع ستون')}
            </label>
            <select
              id="column-type"
              value={type}
              onChange={(e) => setType(e.target.value as InvoiceColumnType)}
              disabled={editing && column?.system}
              className={cn(
                'h-10 w-full rounded-[var(--radius-md)] border border-[hsl(var(--border-default))]',
                'bg-[hsl(var(--surface-base))] px-3 text-sm text-[hsl(var(--fg-primary))]',
                'outline-none focus:border-[hsl(var(--color-primary))]',
                'disabled:opacity-50',
              )}
            >
              {AUTHORABLE_TYPES.map((value) => (
                <option key={value} value={value}>
                  {t(`invoiceBuilder.columnType.${value}`, TYPE_FALLBACK[value])}
                </option>
              ))}
            </select>
          </div>

          {type === 'currency' ? (
            <div>
              <label htmlFor="column-currency" className={fieldLabel}>
                {t('invoiceBuilder.column.currency', 'ارز ستون')}
              </label>
              <select
                id="column-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                className={cn(
                  'h-10 w-full rounded-[var(--radius-md)] border border-[hsl(var(--border-default))]',
                  'bg-[hsl(var(--surface-base))] px-3 text-sm text-[hsl(var(--fg-primary))]',
                  'outline-none focus:border-[hsl(var(--color-primary))]',
                )}
              >
                {SUPPORTED_CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {t(`currency.${code.toLowerCase()}`, code)}
                  </option>
                ))}
              </select>
              {currency !== invoiceCurrency ? (
                <p className="mt-1.5 text-[11px] leading-relaxed text-[hsl(var(--fg-tertiary))]">
                  {t(
                    'invoiceBuilder.column.foreignCurrencyNote',
                    'این ستون در ارز دیگری است. جمع آن جداگانه گزارش می‌شود و بدون نرخ تبدیل، در مبلغ نهایی فاکتور محاسبه نمی‌شود.',
                  )}
                </p>
              ) : null}
            </div>
          ) : null}

          {type === 'select' ? (
            <div>
              <label htmlFor="column-options" className={fieldLabel}>
                {t('invoiceBuilder.column.options', 'گزینه‌ها (هر خط یک گزینه)')}
              </label>
              <textarea
                id="column-options"
                rows={3}
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
                className={cn(
                  'w-full rounded-[var(--radius-md)] border border-[hsl(var(--border-default))]',
                  'bg-[hsl(var(--surface-base))] p-3 text-sm text-[hsl(var(--fg-primary))]',
                  'outline-none focus:border-[hsl(var(--color-primary))]',
                )}
              />
            </div>
          ) : null}

          {type === 'decimal' || type === 'percent' ? (
            <div>
              <label htmlFor="column-precision" className={fieldLabel}>
                {t('invoiceBuilder.column.precision', 'تعداد رقم اعشار')}
              </label>
              <Input
                id="column-precision"
                value={precision}
                inputMode="numeric"
                onChange={(e) => setPrecision(e.target.value)}
              />
            </div>
          ) : null}

          {type !== 'boolean' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="column-suffix" className={fieldLabel}>
                  {t('invoiceBuilder.column.suffix', 'واحد نمایشی')}
                </label>
                <Input
                  id="column-suffix"
                  value={suffix}
                  onChange={(e) => setSuffix(e.target.value)}
                  placeholder={t('invoiceBuilder.column.suffixPlaceholder', 'گرم، ساعت، متر')}
                />
              </div>
              <div>
                <label htmlFor="column-default" className={fieldLabel}>
                  {t('invoiceBuilder.column.defaultValue', 'مقدار پیش‌فرض')}
                </label>
                <Input
                  id="column-default"
                  value={defaultValue}
                  onChange={(e) => setDefaultValue(e.target.value)}
                />
              </div>
            </div>
          ) : null}

          {numeric ? (
            <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[hsl(var(--fg-primary))]">
                  {t('invoiceBuilder.column.aggregate', 'محاسبه جمع ستون')}
                </p>
                <p className="text-[11px] text-[hsl(var(--fg-tertiary))]">
                  {t(
                    'invoiceBuilder.column.aggregateHint',
                    'در ردیف «جمع ستون‌ها» نمایش داده می‌شود',
                  )}
                </p>
              </div>
              <Switch checked={aggregate} onCheckedChange={setAggregate} />
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="text-xs text-[hsl(var(--color-destructive))]">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel', 'انصراف')}
          </Button>
          <Button onClick={handleSubmit}>
            {editing ? t('common.save', 'ذخیره') : t('common.add', 'افزودن')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})

ColumnDialog.displayName = 'ColumnDialog'
