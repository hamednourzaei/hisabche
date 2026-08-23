// ============================================
// Customer and invoice metadata, on the SAME page as the grid.
//
// Selecting a customer used to be its own step in the wizard. It is a field,
// not a stage — so it lives beside the table where the user can see the
// invoice they are building while they pick.
//
// MULTIPLE CUSTOMERS
//
// The invoice table has ONE `customer_id`. That is the party the receivable
// belongs to, and it is what every statement, ageing report and balance in the
// product is derived from. So the first selected customer is the invoice's
// customer — really, relationally — and any further ones are recorded on the
// invoice as additional named parties. They are shown on the document and kept
// with the record, but they do not each get their own receivable, because the
// schema has no join table to hang one on. Splitting a balance across parties
// needs a real migration; inventing it in the UI would put a number in front of
// a shopkeeper that no ledger backs.
// ============================================
'use client'

import { memo } from 'react'
import { User, X } from 'lucide-react'
import { SUPPORTED_CURRENCIES, type CurrencyCode, type InvoiceDraftCustomer } from '@hisabche/store'

import { CustomerPicker } from '../customer-picker'
import { JalaliDatePicker } from '../jalali-datepicker'
import { NumberStepper } from '../number-stepper'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../select'
import { cn } from '../../../lib/utils'

export interface CustomerPanelProps {
  t: (key: string, fallback?: string) => string
  /** First entry is the invoice's own customer — see the file header. */
  customers: readonly InvoiceDraftCustomer[]
  onAddCustomer: (customer: InvoiceDraftCustomer) => void
  onRemoveCustomer: (id: string) => void
  transactionType: 'sale' | 'purchase'
  onTransactionTypeChange: (type: 'sale' | 'purchase') => void
  currency: CurrencyCode
  onCurrencyChange: (currency: CurrencyCode) => void
  /** Currencies used by a column but not the invoice's own. */
  foreignCurrencies: readonly CurrencyCode[]
  rates: Partial<Record<CurrencyCode, string>>
  onRateChange: (currency: CurrencyCode, value: string) => void
  date: string
  onDateChange: (value: string) => void
  dueDate: string | null
  onDueDateChange: (value: string | null) => void
  notes: string
  onNotesChange: (value: string) => void
}

const fieldLabel = 'mb-1.5 block text-xs font-medium text-[hsl(var(--fg-secondary))]'

/** The date picker speaks Gregorian `YYYY-MM-DD`; the draft keeps full ISO. */
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

export const CustomerPanel = memo(function CustomerPanel({
  t,
  customers,
  onAddCustomer,
  onRemoveCustomer,
  transactionType,
  onTransactionTypeChange,
  currency,
  onCurrencyChange,
  foreignCurrencies,
  rates,
  onRateChange,
  date,
  onDateChange,
  dueDate,
  onDueDateChange,
  notes,
  onNotesChange,
}: CustomerPanelProps) {
  const isPurchase = transactionType === 'purchase'

  return (
    <div className="rounded-[var(--radius-lg)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]">
      <div className="flex items-center gap-2 border-b border-[hsl(var(--border-default))] px-4 py-3">
        <User className="size-4 text-[hsl(var(--color-primary))]" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
          {t('invoiceBuilder.customer.title', 'اطلاعات مشتری و فاکتور')}
        </h2>
      </div>

      <div className="space-y-4 p-4">
        {/* sale | purchase decides the direction of the money. Never inferred
            from the route — it is sent explicitly with the invoice. */}
        <div
          role="radiogroup"
          aria-label={t('invoiceBuilder.customer.type', 'نوع فاکتور')}
          className="grid grid-cols-2 gap-1 rounded-[var(--radius-md)] bg-[hsl(var(--surface-muted))] p-1"
        >
          {(['sale', 'purchase'] as const).map((type) => (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={transactionType === type}
              onClick={() => onTransactionTypeChange(type)}
              className={cn(
                'rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-medium',
                'transition-colors duration-150 motion-reduce:transition-none',
                transactionType === type
                  ? 'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--fg-primary))] shadow-sm'
                  : 'text-[hsl(var(--fg-secondary))] hover:text-[hsl(var(--fg-primary))]',
              )}
            >
              {t(`invoices.type.${type}`, type === 'sale' ? 'فروش' : 'خرید')}
            </button>
          ))}
        </div>

        <div>
          <span className={fieldLabel}>
            {isPurchase
              ? t('invoiceBuilder.customer.supplier', 'انتخاب تأمین‌کننده')
              : t('invoiceBuilder.customer.select', 'انتخاب مشتری')}
          </span>

          {/* Chips for everyone already on the invoice. The first is marked,
              because the first is the one the receivable belongs to. */}
          {customers.length ? (
            <ul className="mb-2 flex flex-wrap gap-1.5">
              {customers.map((customer, index) => (
                <li
                  key={customer.id}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs',
                    index === 0
                      ? 'border-[hsl(var(--color-primary)/0.4)] bg-[hsl(var(--color-primary)/0.1)] text-[hsl(var(--color-primary))]'
                      : 'border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))]',
                  )}
                >
                  <span className="max-w-[9rem] truncate">{customer.name}</span>
                  {index === 0 ? (
                    <span className="text-[10px] opacity-80">
                      {t('invoiceBuilder.customer.primary', 'اصلی')}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onRemoveCustomer(customer.id)}
                    aria-label={t('invoiceBuilder.customer.remove', 'حذف از فاکتور')}
                    className="rounded-full p-0.5 hover:bg-[hsl(var(--surface-muted))]"
                  >
                    <X className="size-3" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {/* The same shared picker used everywhere else in the product. It
              stays on "nothing selected" so it always reads as "add another". */}
          <CustomerPicker
            value={null}
            onChange={(next) => {
              if (!next) return
              onAddCustomer({ id: next.id, name: next.name, phone: next.phone })
            }}
            placeholder={
              customers.length
                ? t('invoiceBuilder.customer.addAnother', 'افزودن مشتری دیگر…')
                : t('invoiceBuilder.customer.select', 'انتخاب مشتری')
            }
          />

          {customers.length > 1 ? (
            <p className="mt-1.5 text-[11px] leading-relaxed text-[hsl(var(--fg-tertiary))]">
              {t(
                'invoiceBuilder.customer.multiNote',
                'حساب این فاکتور به نام مشتری «اصلی» ثبت می‌شود؛ بقیه به‌عنوان طرف‌های همراه روی فاکتور می‌آیند.',
              )}
            </p>
          ) : null}
        </div>

        <div>
          <span className={fieldLabel}>{t('invoiceBuilder.customer.currency', 'ارز فاکتور')}</span>
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

        {/* One rate field per foreign currency actually in use. Shown, not
            hidden — a conversion the user cannot see is a lie about money. */}
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
              placeholder={t('invoiceBuilder.customer.ratePlaceholder', 'مثلاً ۵۹۵۰۰')}
              className={cn(
                'h-11 rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] px-2',
                'bg-[hsl(var(--surface-base))]',
                'focus-within:border-[hsl(var(--color-primary))]',
              )}
            />
            <p className="mt-1 text-[11px] text-[hsl(var(--fg-tertiary))]">
              {t(
                'invoiceBuilder.customer.rateHint',
                'بدون نرخ، مبالغ این ارز جداگانه گزارش می‌شوند و در مبلغ نهایی محاسبه نمی‌شوند.',
              )}
            </p>
          </div>
        ))}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <span className={fieldLabel}>{t('invoiceBuilder.customer.date', 'تاریخ فاکتور')}</span>
            <JalaliDatePicker
              value={toDateValue(date)}
              onChange={(v) => onDateChange(fromDateValue(v) ?? new Date().toISOString())}
            />
          </div>
          <div>
            <span className={fieldLabel}>
              {t('invoiceBuilder.customer.dueDate', 'تاریخ سررسید')}
            </span>
            <JalaliDatePicker
              value={toDateValue(dueDate)}
              onChange={(v) => onDueDateChange(fromDateValue(v))}
            />
          </div>
        </div>

        <div>
          <label htmlFor="invoice-notes" className={fieldLabel}>
            {t('invoiceBuilder.customer.notes', 'توضیحات')}
          </label>
          <textarea
            id="invoice-notes"
            rows={3}
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            className={cn(
              'w-full rounded-[var(--radius-md)] border border-[hsl(var(--border-default))]',
              'bg-[hsl(var(--surface-base))] p-3 text-sm text-[hsl(var(--fg-primary))]',
              'outline-none focus:border-[hsl(var(--color-primary))]',
              'transition-colors duration-150 motion-reduce:transition-none',
            )}
          />
        </div>
      </div>
    </div>
  )
})

CustomerPanel.displayName = 'CustomerPanel'
