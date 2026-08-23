// ============================================
// Customer and invoice metadata, on the SAME page as the grid.
//
// Selecting a customer used to be its own step in the wizard. It is a field,
// not a stage — so it lives beside the table where the user can see the
// invoice they are building while they pick.
// ============================================
'use client'

import { memo } from 'react'
import { User } from 'lucide-react'
import { SUPPORTED_CURRENCIES, type CurrencyCode, type InvoiceDraftCustomer } from '@hisabche/store'

import { CustomerPicker } from '../customer-picker'
import { Input } from '../input'
import { cn } from '../../../lib/utils'

export interface CustomerPanelProps {
  t: (key: string, fallback?: string) => string
  customer: InvoiceDraftCustomer | null
  onCustomerChange: (customer: InvoiceDraftCustomer | null) => void
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
const selectClass = cn(
  'h-10 w-full rounded-[var(--radius-md)] border border-[hsl(var(--border-default))]',
  'bg-[hsl(var(--surface-base))] px-3 text-sm text-[hsl(var(--fg-primary))]',
  'outline-none focus:border-[hsl(var(--color-primary))]',
)

/** `<input type="date">` wants `YYYY-MM-DD`; the draft stores full ISO. */
function toDateInput(iso: string | null): string {
  if (!iso) return ''
  const parsed = new Date(iso)
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10)
}

export const CustomerPanel = memo(function CustomerPanel({
  t,
  customer,
  onCustomerChange,
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
            {transactionType === 'purchase'
              ? t('invoiceBuilder.customer.supplier', 'انتخاب تأمین‌کننده')
              : t('invoiceBuilder.customer.select', 'انتخاب مشتری')}
          </span>
          {/* The picker's option type requires a phone string; the draft
              keeps it nullable because server data often omits it. */}
          <CustomerPicker
            value={customer ? { ...customer, phone: customer.phone ?? '' } : null}
            onChange={(next) =>
              onCustomerChange(next ? { id: next.id, name: next.name, phone: next.phone } : null)
            }
          />
        </div>

        <div>
          <label htmlFor="invoice-currency" className={fieldLabel}>
            {t('invoiceBuilder.customer.currency', 'ارز فاکتور')}
          </label>
          <select
            id="invoice-currency"
            value={currency}
            onChange={(e) => onCurrencyChange(e.target.value as CurrencyCode)}
            className={selectClass}
          >
            {SUPPORTED_CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {t(`currency.${code.toLowerCase()}`, code)}
              </option>
            ))}
          </select>
        </div>

        {/* One rate field per foreign currency actually in use. Shown, not
            hidden — a conversion the user cannot see is a lie about money. */}
        {foreignCurrencies.map((code) => (
          <div key={code}>
            <label htmlFor={`rate-${code}`} className={fieldLabel}>
              {t('invoiceBuilder.customer.rate', 'نرخ تبدیل')} —{' '}
              {`1 ${t(`currency.${code.toLowerCase()}`, code)}`}
            </label>
            <Input
              id={`rate-${code}`}
              inputMode="decimal"
              value={rates[code] ?? ''}
              onChange={(e) => onRateChange(code, e.target.value)}
              placeholder={t('invoiceBuilder.customer.ratePlaceholder', 'مثلاً ۵۹۵۰۰')}
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
            <label htmlFor="invoice-date" className={fieldLabel}>
              {t('invoiceBuilder.customer.date', 'تاریخ فاکتور')}
            </label>
            <Input
              id="invoice-date"
              type="date"
              value={toDateInput(date)}
              onChange={(e) =>
                onDateChange(
                  e.target.value
                    ? new Date(e.target.value).toISOString()
                    : new Date().toISOString(),
                )
              }
            />
          </div>
          <div>
            <label htmlFor="invoice-due-date" className={fieldLabel}>
              {t('invoiceBuilder.customer.dueDate', 'تاریخ سررسید')}
            </label>
            <Input
              id="invoice-due-date"
              type="date"
              value={toDateInput(dueDate)}
              onChange={(e) =>
                onDueDateChange(e.target.value ? new Date(e.target.value).toISOString() : null)
              }
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
            )}
          />
        </div>
      </div>
    </div>
  )
})

CustomerPanel.displayName = 'CustomerPanel'
