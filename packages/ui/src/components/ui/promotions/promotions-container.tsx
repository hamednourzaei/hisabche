'use client'

// ============================================
// «تخفیف‌ها» — the promotions of the business (#114–#117).
//
// A promotion lowers the suggested price of a sale line when a product is
// picked on an invoice. This screen makes one and retires one.
//
// ⚠️ A FIXED AMOUNT ALWAYS HAS ITS CURRENCY, chosen here — «50 off» with no
// currency is not an amount, and it is never applied to an invoice in another
// currency.
// ⚠️ There is no edit and no delete: a changed rule is a NEW promotion, and the
// old one is retired, so the price on an old invoice still reads as it did.
// ⚠️ «Not set up», «failed» and «none yet» are three different sentences.
//
// Price lists (#19) sit under the promotions on this screen — both decide the
// price a product is suggested at (see price-lists-panel.tsx).
// ============================================

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { formatNumber } from '@hisabche/formatting'
import { useCurrencyStore } from '@hisabche/store'
import {
  CURRENCY_CODES,
  promotionInputSchema,
  type PromotionInput,
  type SavedPromotion,
} from '@hisabche/validation'
import {
  apiErrorMessage,
  useCustomers,
  useProducts,
  usePromotions,
  useSavePromotion,
  useSetPromotionActive,
} from '@hisabche/api'

import { cn } from '../../../lib/utils'
import { readProducts } from '../../../lib/invoices/products'
import { useDateFormat } from '../../../hooks/use-date-format'
import { useIntlLocale } from '../../../hooks/use-intl-locale'
import { Button } from '../button'
import { DataTable, matchesSearch, type TableColumn } from '../data-table'
import { JalaliDatePicker } from '../jalali-datepicker'
import { SegmentedControl } from '../segmented-control'
import { SelectField } from '../select-field'
import { PriceListsPanel } from './price-lists-panel'

/** Server and schema refusals with a translation. Anything else: the general message. */
export const PROMOTION_ERROR_CODES = [
  'PROMOTION_PERCENT_OVER_100',
  'PROMOTION_CURRENCY_REQUIRED',
  'PROMOTION_WINDOW_INVERTED',
  'PROMOTION_PRODUCT_NOT_FOUND',
  'PROMOTION_CUSTOMER_NOT_FOUND',
  'PROMOTIONS_MIGRATION_PENDING',
] as const

const card =
  'rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]'
const field =
  'h-10 w-full rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-3 text-sm text-[hsl(var(--fg-primary))] outline-none focus:border-[hsl(var(--color-primary))]'
const label = 'block text-xs text-[hsl(var(--fg-secondary))]'

interface Picked {
  id: string
  name: string
}

export function PromotionsContainer() {
  const t = useTranslations('promotions')
  const locale = useIntlLocale()
  const { date } = useDateFormat()
  const promotions = usePromotions()
  const setActive = useSetPromotionActive()
  const [adding, setAdding] = useState(false)
  const [search, setSearch] = useState('')
  // Promotions and price lists are two lists; one is on screen at a time.
  const [section, setSection] = useState<'promotions' | 'lists'>('promotions')
  // The shared table speaks whole keys with a fallback; this screen's own `t`
  // is scoped. Same catalogue, and a missing column label never throws.
  const translateAll = useTranslations()
  const tableT = (key: string, fallback?: string): string => {
    try {
      const value = translateAll(key as Parameters<typeof translateAll>[0])
      return value && value !== key ? value : (fallback ?? key)
    } catch {
      return fallback ?? key
    }
  }

  const errorText = (error: unknown): string => {
    const raw = apiErrorMessage(error, '')
    const code = PROMOTION_ERROR_CODES.find((known) => raw.includes(known))
    return code ? t(`errors.${code}`) : t('errors.general')
  }
  const status = (promotions.error as { response?: { status?: number } } | null)?.response?.status

  const scope = (promotion: SavedPromotion) =>
    [
      promotion.productIds
        ? t('scopeProducts', { count: formatNumber(promotion.productIds.length, locale, 0) })
        : t('allProducts'),
      promotion.customerIds
        ? t('scopeCustomers', { count: formatNumber(promotion.customerIds.length, locale, 0) })
        : t('allCustomers'),
    ].join(' · ')

  const window = (promotion: SavedPromotion) =>
    promotion.validFrom || promotion.validTo
      ? `${promotion.validFrom ? date(promotion.validFrom) : '…'} – ${promotion.validTo ? date(promotion.validTo) : '…'}`
      : t('always')
  const amount = (promotion: SavedPromotion) =>
    promotion.kind === 'percentage'
      ? `${formatNumber(promotion.value, locale, 2)}٪`
      : `${formatNumber(promotion.value, locale, 2)} ${promotion.currency ?? ''}`

  // The same table the invoice list uses: search, saved views, column settings.
  const columns: TableColumn<SavedPromotion>[] = [
    {
      id: 'name',
      labelKey: 'promotions.name',
      labelFallback: 'نام',
      locked: true,
      sortValue: (promotion) => promotion.name,
      render: (promotion) => (
        <span className="font-medium text-[hsl(var(--fg-primary))]">{promotion.name}</span>
      ),
    },
    {
      id: 'value',
      labelKey: 'promotions.columns.value',
      labelFallback: 'مقدار',
      sortValue: (promotion) => promotion.value,
      render: (promotion) => <span className="tabular-nums">{amount(promotion)}</span>,
    },
    {
      id: 'scope',
      labelKey: 'promotions.columns.scope',
      labelFallback: 'برای',
      showFrom: 'md',
      render: (promotion) => (
        <span className="text-[hsl(var(--fg-secondary))]">
          {scope(promotion)}
          {promotion.stacking === 'stacking' ? ` · ${t('stacks')}` : ''}
        </span>
      ),
    },
    {
      id: 'validity',
      labelKey: 'promotions.columns.validity',
      labelFallback: 'اعتبار',
      showFrom: 'md',
      sortValue: (promotion) => promotion.validTo ?? '',
      render: (promotion) => (
        <span className="text-[hsl(var(--fg-secondary))]">{window(promotion)}</span>
      ),
    },
    {
      id: 'status',
      labelKey: 'promotions.columns.status',
      labelFallback: 'وضعیت',
      sortValue: (promotion) => (promotion.isActive ? 0 : 1),
      render: (promotion) => (
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs',
            promotion.isActive
              ? 'bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]'
              : 'bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-secondary))]',
          )}
        >
          {promotion.isActive ? t('active') : t('retired')}
        </span>
      ),
    },
    {
      id: 'actions',
      labelKey: 'promotions.columns.actions',
      labelFallback: 'عملیات',
      locked: true,
      align: 'end',
      render: (promotion) => (
        <Button
          size="sm"
          variant="outline"
          disabled={setActive.isPending && setActive.variables?.id === promotion.id}
          onClick={() => setActive.mutate({ id: promotion.id, isActive: !promotion.isActive })}
        >
          {promotion.isActive ? t('retire') : t('reactivate')}
        </Button>
      ),
    },
  ]
  const rows = useMemo(
    () => (promotions.data ?? []).filter((promotion) => matchesSearch(search, [promotion.name])),
    [promotions.data, search],
  )

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 px-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))]">{t('title')}</h1>
          <p className="mt-1 text-sm text-[hsl(var(--fg-tertiary))]">{t('subtitle')}</p>
        </div>
        {section === 'promotions' && !adding ? (
          <Button onClick={() => setAdding(true)}>{t('add')}</Button>
        ) : null}
      </header>

      <SegmentedControl
        branch
        label={t('sectionsLabel')}
        value={section}
        onChange={setSection}
        options={[
          { value: 'promotions', label: t('sections.promotions') },
          { value: 'lists', label: t('sections.lists') },
        ]}
      />

      {section === 'lists' ? <PriceListsPanel /> : null}

      {section === 'promotions' && adding ? (
        <PromotionForm onDone={() => setAdding(false)} errorText={errorText} />
      ) : null}

      {section !== 'promotions' ? null : promotions.isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-[hsl(var(--surface-muted))]" />
          ))}
        </div>
      ) : promotions.error || !promotions.data ? (
        <p role="alert" className={cn(card, 'p-4 text-sm text-[hsl(var(--color-destructive))]')}>
          {status === 403 ? t('forbidden') : errorText(promotions.error)}
        </p>
      ) : promotions.data.length === 0 ? (
        <p className={cn(card, 'p-6 text-center text-sm text-[hsl(var(--fg-secondary))]')}>
          {t('empty')}
        </p>
      ) : (
        <DataTable
          tableId="promotions"
          t={tableT}
          rows={rows}
          columns={columns}
          rowKey={(promotion) => promotion.id}
          searchValue={search}
          onSearchChange={setSearch}
          minWidthClass="min-w-[420px] sm:min-w-[640px]"
          emptyState={
            <p className="p-6 text-center text-sm text-[hsl(var(--fg-secondary))]">
              {t('nothingFound')}
            </p>
          }
        />
      )}
      {section === 'promotions' && setActive.error ? (
        <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
          {errorText(setActive.error)}
        </p>
      ) : null}
      {section === 'promotions' ? (
        <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('note')}</p>
      ) : null}
    </div>
  )
}

function PromotionForm({
  onDone,
  errorText,
}: {
  onDone: () => void
  errorText: (error: unknown) => string
}) {
  const t = useTranslations('promotions')
  const tCurrency = useTranslations('currency')
  const primaryCurrency = useCurrencyStore((s) => s.primaryCurrency)
  const save = useSavePromotion()

  const [name, setName] = useState('')
  const [kind, setKind] = useState<PromotionInput['kind']>('percentage')
  const [value, setValue] = useState('')
  const [currency, setCurrency] = useState<string>(primaryCurrency)
  const [stacking, setStacking] = useState(false)
  const [products, setProducts] = useState<Picked[]>([])
  const [customers, setCustomers] = useState<Picked[]>([])
  const [validFrom, setValidFrom] = useState('')
  const [validTo, setValidTo] = useState('')
  const [problem, setProblem] = useState<string | null>(null)

  const submit = () => {
    const parsed = promotionInputSchema.safeParse({
      name,
      kind,
      value: Number(value),
      currency: kind === 'fixed_amount' ? currency : null,
      stacking: stacking ? 'stacking' : 'exclusive',
      productIds: products.length > 0 ? products.map((item) => item.id) : null,
      customerIds: customers.length > 0 ? customers.map((item) => item.id) : null,
      validFrom: validFrom || null,
      validTo: validTo || null,
    })
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      const code = PROMOTION_ERROR_CODES.find((known) => known === first?.message)
      setProblem(code ? t(`errors.${code}`) : t('errors.incomplete'))
      return
    }
    setProblem(null)
    save.mutate(parsed.data, { onSuccess: onDone })
  }

  return (
    <section className={cn(card, 'space-y-4 p-4')}>
      <h2 className="font-semibold text-[hsl(var(--fg-primary))]">{t('newTitle')}</h2>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1">
          <span className={label}>{t('name')}</span>
          <input
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            className={field}
          />
        </label>
        <div className="space-y-1">
          <span className={label}>{t('kind')}</span>
          <SelectField
            name="kind"
            data-field="kind"
            aria-label={t('kind')}
            value={kind}
            onChange={(next) => setKind(next as PromotionInput['kind'])}
            options={[
              { value: 'percentage', label: t('kinds.percentage') },
              { value: 'fixed_amount', label: t('kinds.fixed_amount') },
            ]}
            className={field}
          />
        </div>
        <label className="space-y-1">
          <span className={label}>{kind === 'percentage' ? t('percent') : t('amount')}</span>
          <input
            name="value"
            inputMode="decimal"
            dir="ltr"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className={cn(field, 'tabular-nums')}
          />
        </label>
        {kind === 'fixed_amount' ? (
          <div className="space-y-1">
            <span className={label}>{t('currency')}</span>
            <SelectField
              name="currency"
              data-field="currency"
              aria-label={t('currency')}
              value={currency}
              onChange={setCurrency}
              options={CURRENCY_CODES.map((code) => ({
                value: code,
                label: `${tCurrency(code.toLowerCase())} (${code})`,
              }))}
              className={field}
            />
          </div>
        ) : null}
        <div className="space-y-1" data-field="validFrom">
          <span className={label}>{t('validFrom')}</span>
          <JalaliDatePicker value={validFrom} onChange={setValidFrom} placeholder={t('noLimit')} />
        </div>
        <div className="space-y-1" data-field="validTo">
          <span className={label}>{t('validTo')}</span>
          <JalaliDatePicker value={validTo} onChange={setValidTo} placeholder={t('noLimit')} />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <ScopePicker kind="products" picked={products} onChange={setProducts} />
        <ScopePicker kind="customers" picked={customers} onChange={setCustomers} />
      </div>

      <label className="flex items-start gap-2 text-sm text-[hsl(var(--fg-primary))]">
        <input
          type="checkbox"
          name="stacking"
          checked={stacking}
          onChange={(event) => setStacking(event.target.checked)}
          className="mt-1"
        />
        <span>
          {t('stackingLabel')}
          <span className="block text-xs text-[hsl(var(--fg-tertiary))]">{t('stackingHint')}</span>
        </span>
      </label>

      {problem || save.error ? (
        <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
          {problem ?? errorText(save.error)}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button disabled={save.isPending} onClick={submit}>
          {t('save')}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          {t('cancel')}
        </Button>
      </div>
    </section>
  )
}

/** «Everything», or a searched-and-ticked list. Nothing picked = everything. */
function ScopePicker({
  kind,
  picked,
  onChange,
}: {
  kind: 'products' | 'customers'
  picked: Picked[]
  onChange: (next: Picked[]) => void
}) {
  const t = useTranslations('promotions')
  const [search, setSearch] = useState('')
  const term = search.trim()
  // With nothing typed these are the first twenty — a place to start from.
  const products = useProducts({ search: term, limit: 20 })
  const customers = useCustomers({ page: 1, limit: 20, sortDirection: 'desc', search: term })

  const found: Picked[] =
    kind === 'products'
      ? readProducts(products.data).map((product) => ({ id: product.id, name: product.name }))
      : (customers.data?.customers ?? []).map((customer) => ({
          id: customer.id as string,
          name: customer.fullName,
        }))
  const loading = kind === 'products' ? products.isFetching : customers.isFetching
  const failed = kind === 'products' ? products.isError : customers.isError
  const has = (id: string) => picked.some((item) => item.id === id)

  return (
    <div className="space-y-2 rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] p-3">
      <p className="text-sm font-medium text-[hsl(var(--fg-primary))]">
        {t(kind === 'products' ? 'forProducts' : 'forCustomers')}
      </p>
      <p className="text-xs text-[hsl(var(--fg-tertiary))]">
        {picked.length === 0
          ? t(kind === 'products' ? 'allProducts' : 'allCustomers')
          : t(kind === 'products' ? 'onlyTheseProducts' : 'onlyTheseCustomers')}
      </p>

      {picked.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {picked.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onChange(picked.filter((other) => other.id !== item.id))}
                className="rounded-full bg-[hsl(var(--color-primary)/0.1)] px-2 py-0.5 text-xs text-[hsl(var(--color-primary))]"
                aria-label={`${t('remove')}: ${item.name}`}
              >
                {item.name} ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={t(kind === 'products' ? 'searchProduct' : 'searchCustomer')}
        aria-label={t(kind === 'products' ? 'searchProduct' : 'searchCustomer')}
        className={field}
      />
      {failed ? (
        <p role="alert" className="text-xs text-[hsl(var(--color-destructive))]">
          {t('searchFailed')}
        </p>
      ) : loading ? (
        <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('searching')}</p>
      ) : found.length === 0 ? (
        <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('nothingFound')}</p>
      ) : (
        <ul className="max-h-40 space-y-1 overflow-y-auto">
          {found
            .filter((item) => !has(item.id))
            .map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onChange([...picked, item])}
                  className="w-full rounded-[var(--radius-sm)] px-2 py-1.5 text-start text-sm hover:bg-[hsl(var(--surface-muted))]"
                >
                  {item.name}
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}
