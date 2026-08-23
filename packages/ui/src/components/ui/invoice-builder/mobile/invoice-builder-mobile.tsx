// ============================================
// STEP 1 of invoice creation, on a phone.
//
// A different INTERACTION MODEL, not a narrower table. The desktop grid is a
// spreadsheet because a mouse can work one; a phone gets a short vertical
// workflow — type, items, customer, settings, total — with the money and the
// forward action pinned in the thumb zone.
//
// It shares everything that matters with the desktop view: the same draft
// store, the same column configuration, the same `summarize()` output, the
// same validation. This file decides ORDER and EMPHASIS. It decides nothing
// about money.
// ============================================
'use client'

import { memo, useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronLeft,
  MoreVertical,
  Plus,
  Receipt,
  Settings2,
  UserPlus,
} from 'lucide-react'
import {
  COLUMN,
  hasCellValue,
  isForeignMoneyColumn,
  type GridMoneyContext,
  type InvoiceColumn,
  type InvoiceGridRow,
  type InvoiceSummary,
} from '@hisabche/validation'
import { formatNumber } from '@hisabche/formatting'
import { SUPPORTED_CURRENCIES, type CurrencyCode, type InvoiceDraftCustomer } from '@hisabche/store'

import { Button } from '../../button'
import { CustomerPicker } from '../../customer-picker'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../dropdown-menu'
import { JalaliDatePicker } from '../../jalali-datepicker'
import { NumberStepper } from '../../number-stepper'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../select'
import { cn } from '../../../../lib/utils'
import { InvoiceItemCard } from './invoice-item-card'

export interface InvoiceBuilderMobileProps {
  t: (key: string, fallback?: string) => string
  locale: string
  columns: readonly InvoiceColumn[]
  rows: readonly InvoiceGridRow[]
  ctx: GridMoneyContext
  summary: InvoiceSummary
  invalidRowIds: ReadonlySet<string>
  issues: string[]

  customers: readonly InvoiceDraftCustomer[]
  transactionType: 'sale' | 'purchase'
  currency: CurrencyCode
  rates: Partial<Record<CurrencyCode, string>>
  date: string
  dueDate: string | null
  notes: string
  discountValue: string
  discountType: 'fixed' | 'percentage'
  taxRate: string

  onAddCustomer: (customer: InvoiceDraftCustomer) => void
  onRemoveCustomer: (id: string) => void
  onTransactionTypeChange: (type: 'sale' | 'purchase') => void
  onCurrencyChange: (currency: CurrencyCode) => void
  onRateChange: (currency: CurrencyCode, value: string) => void
  onDateChange: (value: string) => void
  onDueDateChange: (value: string | null) => void
  onNotesChange: (value: string) => void
  onDiscountValueChange: (value: string) => void
  onDiscountTypeChange: (type: 'fixed' | 'percentage') => void
  onTaxRateChange: (value: string) => void

  onAddRow: () => void
  onEditRow: (rowId: string) => void
  onDuplicateRow: (rowId: string) => void
  onRemoveRow: (rowId: string) => void
  onOpenColumns: () => void

  onBack: () => void
  onContinue: () => void
  savingDraft: boolean
}

const sectionTitle = 'text-sm font-semibold text-[hsl(var(--fg-primary))]'
const fieldLabel = 'mb-1.5 block text-sm font-medium text-[hsl(var(--fg-secondary))]'
const fieldShell = cn(
  'flex h-12 items-center rounded-[var(--radius-md)] border px-3',
  'border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))]',
  'focus-within:border-[hsl(var(--color-primary))]',
  'transition-colors duration-150 motion-reduce:transition-none',
)

function toDateValue(iso: string | null): string {
  if (!iso) return ''
  const parsed = new Date(iso)
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10)
}

function fromDateValue(value: string): string | null {
  if (!value) return null
  const parsed = new Date(`${value}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

export const InvoiceBuilderMobile = memo(function InvoiceBuilderMobile({
  t,
  locale,
  columns,
  rows,
  ctx,
  summary,
  invalidRowIds,
  issues,
  customers,
  transactionType,
  currency,
  rates,
  date,
  dueDate,
  notes,
  discountValue,
  discountType,
  taxRate,
  onAddCustomer,
  onRemoveCustomer,
  onTransactionTypeChange,
  onCurrencyChange,
  onRateChange,
  onDateChange,
  onDueDateChange,
  onNotesChange,
  onDiscountValueChange,
  onDiscountTypeChange,
  onTaxRateChange,
  onAddRow,
  onEditRow,
  onDuplicateRow,
  onRemoveRow,
  onOpenColumns,
  onBack,
  onContinue,
  savingDraft,
}: InvoiceBuilderMobileProps) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [dueDateShown, setDueDateShown] = useState(dueDate !== null)

  // A trailing blank row is a spreadsheet affordance. On a card list it is a
  // meaningless empty card, so only started lines are shown and «افزودن» is
  // the way to make a new one.
  const items = useMemo(
    () => rows.filter((row) => Object.values(row.values).some((v) => v.trim())),
    [rows],
  )

  const foreignCurrencies = useMemo(() => {
    const set = new Set<CurrencyCode>()
    for (const column of columns) {
      if (isForeignMoneyColumn(column, ctx) && column.currency) set.add(column.currency)
    }
    return [...set]
  }, [columns, ctx])

  const parties = customers ?? []
  const currencyName = t(`currency.${currency.toLowerCase()}`, currency)
  const blocked = issues.length > 0

  const handleAdd = () => {
    onAddRow()
    // The new row is always last; opening its editor immediately is what makes
    // «افزودن» a single decision instead of add-then-hunt-for-it.
    const nextId = rows[rows.length - 1]?.id
    if (nextId && !hasCellValue(rows[rows.length - 1]?.values[COLUMN.description])) {
      onEditRow(nextId)
    }
  }

  return (
    <div className="min-w-0 pb-40">
      {/* ── Header: back + title + overflow. No breadcrumb, no top CTA. ── */}
      <header className="-mx-4 mb-4 flex items-center gap-1 border-b border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-1 py-1">
        <button
          type="button"
          onClick={onBack}
          aria-label={t('common.back', 'بازگشت')}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))]"
        >
          {/* Back points the way the text runs, so in RTL it points right. */}
          <ChevronLeft className="size-5 rtl:rotate-180" aria-hidden="true" />
        </button>

        <h1 className="min-w-0 flex-1 truncate text-base font-bold text-[hsl(var(--fg-primary))]">
          {t('invoiceBuilder.new', 'فاکتور جدید')}
        </h1>

        {savingDraft ? (
          <span className="shrink-0 px-2 text-[11px] text-[hsl(var(--fg-tertiary))]">
            {t('common.saving', 'در حال ذخیره…')}
          </span>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t('invoiceBuilder.toolbar.columnOps', 'عملیات ستون‌ها')}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))]"
            >
              <MoreVertical className="size-5" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onOpenColumns}>
              <Settings2 className="size-4" aria-hidden="true" />
              {t('invoiceBuilder.mobile.manageColumns', 'مدیریت ستون‌ها')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* ── Invoice type ─────────────────────────────────────────────── */}
      <section className="mb-5">
        <h2 className={cn(sectionTitle, 'mb-2')}>
          {t('invoiceBuilder.customer.type', 'نوع فاکتور')}
        </h2>
        <div
          role="radiogroup"
          aria-label={t('invoiceBuilder.customer.type', 'نوع فاکتور')}
          className="grid grid-cols-2 gap-2"
        >
          {(['sale', 'purchase'] as const).map((type) => {
            const active = transactionType === type
            return (
              <button
                key={type}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onTransactionTypeChange(type)}
                className={cn(
                  'flex h-12 items-center justify-center gap-2 rounded-[var(--radius-md)] border text-sm',
                  'transition-colors duration-150 motion-reduce:transition-none',
                  // Selection is carried by border + weight + a mark, not by
                  // colour alone.
                  active
                    ? 'border-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary)/0.1)] font-bold text-[hsl(var(--color-primary))]'
                    : 'border-[hsl(var(--border-default))] font-medium text-[hsl(var(--fg-secondary))]',
                )}
              >
                {active ? <span aria-hidden="true">✓</span> : null}
                {t(`invoices.type.${type}`, type === 'sale' ? 'فروش' : 'خرید')}
              </button>
            )
          })}
        </div>
      </section>

      {/* ── Items ────────────────────────────────────────────────────── */}
      <section className="mb-5">
        <h2 className={cn(sectionTitle, 'mb-2')}>
          {t('invoiceBuilder.mobile.itemsTitle', 'اقلام فاکتور')}
        </h2>

        {items.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] border border-dashed border-[hsl(var(--border-default))] p-6 text-center">
            <Receipt
              className="mx-auto mb-3 size-8 text-[hsl(var(--fg-tertiary))]"
              aria-hidden="true"
            />
            <p className="mb-1 text-sm font-semibold text-[hsl(var(--fg-primary))]">
              {t('invoiceBuilder.mobile.emptyTitle', 'هنوز قلمی به فاکتور اضافه نشده')}
            </p>
            <p className="mb-4 text-xs text-[hsl(var(--fg-secondary))]">
              {t(
                'invoiceBuilder.mobile.emptyDescription',
                'برای شروع، اولین کالا یا خدمت را اضافه کنید.',
              )}
            </p>
            <Button onClick={handleAdd} className="h-12 gap-2">
              <Plus className="size-4" aria-hidden="true" />
              {t('invoiceBuilder.mobile.addItem', 'افزودن کالا یا خدمت')}
            </Button>
          </div>
        ) : (
          <>
            <ul className="space-y-3">
              {items.map((row, index) => (
                <InvoiceItemCard
                  key={row.id}
                  t={t}
                  locale={locale}
                  index={index}
                  row={row}
                  columns={columns}
                  ctx={ctx}
                  invalid={invalidRowIds.has(row.id)}
                  onEdit={() => onEditRow(row.id)}
                  onDuplicate={() => onDuplicateRow(row.id)}
                  onRemove={() => onRemoveRow(row.id)}
                />
              ))}
            </ul>

            <Button
              variant="outline"
              onClick={handleAdd}
              fullWidth
              className="mt-2.5 h-12 gap-2 border-dashed"
            >
              <Plus className="size-4" aria-hidden="true" />
              {t('invoiceBuilder.mobile.addItem', 'افزودن کالا یا خدمت')}
            </Button>
          </>
        )}
      </section>

      {/* ── Customer ─────────────────────────────────────────────────── */}
      <section className="mb-5">
        <h2 className={cn(sectionTitle, 'mb-2')}>
          {transactionType === 'purchase'
            ? t('invoiceBuilder.customer.supplier', 'انتخاب تأمین‌کننده')
            : t('invoiceBuilder.mobile.customerTitle', 'اطلاعات مشتری')}
        </h2>

        <div className="rounded-[var(--radius-lg)] border border-[hsl(var(--border-default))] p-3">
          {parties.length ? (
            <ul className="mb-2 flex flex-wrap gap-1.5">
              {parties.map((customer, index) => (
                <li
                  key={customer.id}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs',
                    index === 0
                      ? 'border-[hsl(var(--color-primary)/0.4)] bg-[hsl(var(--color-primary)/0.1)] text-[hsl(var(--color-primary))]'
                      : 'border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))]',
                  )}
                >
                  <span className="max-w-[10rem] truncate">{customer.name}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveCustomer(customer.id)}
                    aria-label={`${t('invoiceBuilder.customer.remove', 'حذف از فاکتور')} — ${customer.name}`}
                    className="inline-flex size-6 items-center justify-center rounded-full hover:bg-[hsl(var(--surface-muted))]"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <CustomerPicker
            value={null}
            onChange={(next) => {
              if (!next) return
              onAddCustomer({ id: next.id, name: next.name, phone: next.phone })
            }}
            placeholder={
              parties.length
                ? t('invoiceBuilder.customer.addAnother', 'افزودن مشتری دیگر…')
                : t('invoiceBuilder.customer.select', 'انتخاب مشتری')
            }
          />

          {parties.length === 0 ? (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-[hsl(var(--fg-tertiary))]">
              <UserPlus className="size-3" aria-hidden="true" />
              {t('invoiceBuilder.mobile.customerOptional', 'انتخاب مشتری اختیاری است')}
            </p>
          ) : null}
        </div>
      </section>

      {/* ── Optional settings, folded away ───────────────────────────── */}
      <section className="mb-5">
        <button
          type="button"
          onClick={() => setSettingsOpen((v) => !v)}
          aria-expanded={settingsOpen}
          className="flex min-h-[48px] w-full items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] px-3"
        >
          <span className={sectionTitle}>
            {t('invoiceBuilder.mobile.settingsTitle', 'تنظیمات فاکتور')}
          </span>
          <ChevronDown
            className={cn(
              'size-4 text-[hsl(var(--fg-tertiary))]',
              'transition-transform duration-150 motion-reduce:transition-none',
              settingsOpen && 'rotate-180',
            )}
            aria-hidden="true"
          />
        </button>

        {settingsOpen ? (
          <div className="mt-3 space-y-4 rounded-[var(--radius-lg)] border border-[hsl(var(--border-default))] p-3">
            <div>
              <span className={fieldLabel}>
                {t('invoiceBuilder.customer.currency', 'ارز فاکتور')}
              </span>
              <Select value={currency} onValueChange={(v) => onCurrencyChange(v as CurrencyCode)}>
                <SelectTrigger aria-label={t('invoiceBuilder.customer.currency', 'ارز فاکتور')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_CURRENCIES.map((code) => (
                    <SelectItem key={code} value={code}>
                      {t(`currency.${code.toLowerCase()}`, code)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {foreignCurrencies.map((code) => (
              <div key={code}>
                <span className={fieldLabel}>
                  {t('invoiceBuilder.customer.rate', 'نرخ تبدیل')} —{' '}
                  {`1 ${t(`currency.${code.toLowerCase()}`, code)}`}
                </span>
                <NumberStepper
                  value={rates[code] ?? ''}
                  onValueChange={(v) => onRateChange(code, v)}
                  step={500}
                  min={0}
                  groupThousands
                  aria-label={t('invoiceBuilder.customer.rate', 'نرخ تبدیل')}
                  className={fieldShell}
                  inputClassName="text-base"
                />
              </div>
            ))}

            <div>
              <span className={fieldLabel}>
                {t('invoiceBuilder.customer.date', 'تاریخ فاکتور')}
              </span>
              <JalaliDatePicker
                value={toDateValue(date)}
                onChange={(v) => onDateChange(fromDateValue(v) ?? new Date().toISOString())}
              />
            </div>

            {/* An unused due date is an empty field taking a whole row. It is
                offered, not imposed. */}
            {dueDateShown || dueDate ? (
              <div>
                <span className={fieldLabel}>
                  {t('invoiceBuilder.customer.dueDate', 'تاریخ سررسید')}
                </span>
                <JalaliDatePicker
                  value={toDateValue(dueDate)}
                  onChange={(v) => onDueDateChange(fromDateValue(v))}
                />
              </div>
            ) : (
              <Button
                variant="ghost"
                onClick={() => setDueDateShown(true)}
                className="h-11 gap-1.5 px-0"
              >
                <Plus className="size-4" aria-hidden="true" />
                {t('invoiceBuilder.customer.dueDate', 'تاریخ سررسید')}
              </Button>
            )}

            <div>
              <span className={fieldLabel}>{t('invoiceBuilder.summary.discount', 'تخفیف کل')}</span>
              <div className="flex items-center gap-2">
                <NumberStepper
                  value={discountValue}
                  onValueChange={onDiscountValueChange}
                  step={discountType === 'percentage' ? 1 : 1000}
                  min={0}
                  {...(discountType === 'percentage' ? { max: 100 } : {})}
                  groupThousands={discountType === 'fixed'}
                  aria-label={t('invoiceBuilder.summary.discount', 'تخفیف کل')}
                  className={cn(fieldShell, 'flex-1')}
                  inputClassName="text-base"
                />
                <div className="flex shrink-0 rounded-[var(--radius-md)] bg-[hsl(var(--surface-muted))] p-1">
                  {(['fixed', 'percentage'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      aria-pressed={discountType === type}
                      onClick={() => onDiscountTypeChange(type)}
                      className={cn(
                        'min-h-[40px] min-w-[44px] rounded-[var(--radius-sm)] px-2 text-xs font-medium',
                        discountType === type
                          ? 'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--fg-primary))] shadow-sm'
                          : 'text-[hsl(var(--fg-tertiary))]',
                      )}
                    >
                      {type === 'fixed' ? currencyName : '٪'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <span className={fieldLabel}>
                {t('invoiceBuilder.summary.taxRate', 'مالیات (درصد)')}
              </span>
              <NumberStepper
                value={taxRate}
                onValueChange={onTaxRateChange}
                step={1}
                min={0}
                max={100}
                suffix="٪"
                aria-label={t('invoiceBuilder.summary.taxRate', 'مالیات (درصد)')}
                className={fieldShell}
                inputClassName="text-base"
              />
            </div>

            <div>
              <label htmlFor="invoice-notes-mobile" className={fieldLabel}>
                {t('invoiceBuilder.customer.notes', 'توضیحات')}
              </label>
              <textarea
                id="invoice-notes-mobile"
                rows={3}
                value={notes}
                onChange={(e) => onNotesChange(e.target.value)}
                className={cn(
                  'min-h-[88px] w-full rounded-[var(--radius-md)] border p-3 text-base',
                  'border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))]',
                  'text-[hsl(var(--fg-primary))] outline-none',
                  'focus:border-[hsl(var(--color-primary))]',
                  'transition-colors duration-150 motion-reduce:transition-none',
                )}
              />
            </div>
          </div>
        ) : null}
      </section>

      {/* ── Summary ──────────────────────────────────────────────────── */}
      <section className="mb-4 rounded-[var(--radius-lg)] border border-[hsl(var(--border-default))] p-3">
        <dl className="space-y-2 text-sm">
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-[hsl(var(--fg-secondary))]">
              {t('invoiceBuilder.summary.subtotal', 'جمع مبلغ')}
            </dt>
            <dd dir="ltr" className="tabular-nums text-[hsl(var(--fg-primary))]">
              {formatNumber(summary.subtotal, locale, ctx.precision)}
            </dd>
          </div>

          {summary.discountTotal > 0 ? (
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-[hsl(var(--fg-secondary))]">
                {t('invoiceBuilder.summary.discount', 'تخفیف کل')}
              </dt>
              <dd dir="ltr" className="tabular-nums text-[hsl(var(--color-destructive))]">
                −{formatNumber(summary.discountTotal, locale, ctx.precision)}
              </dd>
            </div>
          ) : null}

          {summary.taxTotal > 0 ? (
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-[hsl(var(--fg-secondary))]">
                {t('invoiceBuilder.summary.taxTotal', 'مبلغ مالیات')}
              </dt>
              <dd dir="ltr" className="tabular-nums text-[hsl(var(--fg-primary))]">
                {formatNumber(summary.taxTotal, locale, ctx.precision)}
              </dd>
            </div>
          ) : null}

          {summary.foreignTotals.map((entry) => (
            <div key={entry.currency} className="flex items-baseline justify-between gap-2">
              <dt className="text-[hsl(var(--fg-secondary))]">
                {t('invoiceBuilder.summary.foreignTotal', 'جمع')} (
                {t(`currency.${entry.currency.toLowerCase()}`, entry.currency)})
              </dt>
              <dd dir="ltr" className="tabular-nums text-[hsl(var(--fg-secondary))]">
                {formatNumber(entry.amount, locale, entry.currency === 'USD' ? 2 : 0)}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {issues.length ? (
        <ul
          role="alert"
          className="mb-4 space-y-1 rounded-[var(--radius-md)] border border-[hsl(var(--color-destructive)/0.4)] bg-[hsl(var(--color-destructive)/0.06)] p-3 text-xs text-[hsl(var(--color-destructive))]"
        >
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : null}

      {/* ── Sticky total + forward action, in the thumb zone ─────────── */}
      <div
        className={cn(
          'fixed inset-x-0 z-40 border md:hidden',
          // Sits ON TOP of the global bottom nav rather than under it. The bar
          // is offset by the nav's own height so the two stack instead of
          // overlapping, and it keeps its bottom corners square where it meets
          // the nav — only the top is rounded, so it reads as a sheet rising
          // from the bar rather than a floating rectangle.
          'bottom-[var(--bottom-nav-h,0px)]',
          'rounded-t-[var(--radius-lg)] border-[hsl(var(--border-default))]',
          'bg-[hsl(var(--surface-elevated))] shadow-[0_-4px_16px_hsl(var(--surface-base)/0.6)]',
          'px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]',
        )}
      >
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <span className="text-sm text-[hsl(var(--fg-secondary))]">
            {t('invoiceBuilder.summary.payable', 'مبلغ قابل پرداخت')}
          </span>
          <span dir="ltr" className="text-xl font-bold tabular-nums text-[hsl(var(--fg-primary))]">
            {`${formatNumber(summary.total, locale, ctx.precision)} ${currencyName}`}
          </span>
        </div>
        <Button
          variant="success"
          onClick={onContinue}
          disabled={blocked}
          fullWidth
          className="h-12 gap-1.5 text-base"
        >
          {t('invoiceBuilder.mobile.continue', 'پیش‌نمایش و ادامه')}
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
})

InvoiceBuilderMobile.displayName = 'InvoiceBuilderMobile'
