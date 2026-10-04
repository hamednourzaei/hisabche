'use client'

// ============================================
// «فهرست‌های قیمت» — price lists (#19), on the same screen as promotions:
// both decide the price a product is suggested at, and one place to look is
// better than two.
//
// A list is a named set of product prices in ONE currency. A customer on the
// list is offered those prices when a product is picked on a sale invoice;
// promotions then apply on top.
//
// ⚠️ EVERY PRICE HAS ITS CURRENCY (the list's, chosen when it is made) AND ITS
// UNIT (the product's, shown beside the field) — a bare number is not a price.
// ⚠️ A product that is not on the list keeps its own price.
// ⚠️ A list is retired, a price is taken off — nothing is deleted, and no
// invoice already written changes.
// ⚠️ «Not set up», «failed» and «none yet» are three different sentences.
// ============================================

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { formatNumber } from '@hisabche/formatting'
import { useCurrencyStore } from '@hisabche/store'
import { CURRENCY_CODES, priceListInputSchema, type SavedPriceList } from '@hisabche/validation'
import {
  apiErrorMessage,
  asList,
  type Unit,
  useAssignPriceList,
  useCustomers,
  usePriceList,
  usePriceLists,
  useProducts,
  useSavePriceList,
  useSetPriceListActive,
  useSetPriceListItems,
  useUnits,
} from '@hisabche/api'

import { cn } from '../../../lib/utils'
import { productPrice, readProducts } from '../../../lib/invoices/products'
import { useDateFormat } from '../../../hooks/use-date-format'
import { useIntlLocale } from '../../../hooks/use-intl-locale'
import { Button } from '../button'
import { JalaliDatePicker } from '../jalali-datepicker'
import { SelectField } from '../select-field'
import { unitLabel as labelOfUnit } from '../units/unit-select'

/** Server and schema refusals with a translation. Anything else: the general message. */
export const PRICE_LIST_ERROR_CODES = [
  'PRICE_LIST_NAME_TAKEN',
  'PRICE_LIST_WINDOW_INVERTED',
  'PRICE_LIST_PRODUCT_NOT_FOUND',
  'PRICE_LIST_PRODUCT_TWICE',
  'PRICE_LIST_PRICE_TOO_SMALL',
  'PRICE_LIST_RETIRED',
  'PRICE_LISTS_MIGRATION_PENDING',
] as const

const card =
  'rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]'
const field =
  'h-10 w-full rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-3 text-sm text-[hsl(var(--fg-primary))] outline-none focus:border-[hsl(var(--color-primary))]'
const label = 'block text-xs text-[hsl(var(--fg-secondary))]'
const danger = 'text-sm text-[hsl(var(--color-destructive))]'
const faint = 'text-xs text-[hsl(var(--fg-tertiary))]'

type ErrorText = (error: unknown) => string

export function PriceListsPanel() {
  const t = useTranslations('priceLists')
  const locale = useIntlLocale()
  const { date } = useDateFormat()
  const lists = usePriceLists()
  const setActive = useSetPriceListActive()
  const [adding, setAdding] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  const errorText: ErrorText = (error) => {
    const raw = apiErrorMessage(error, '')
    const code = PRICE_LIST_ERROR_CODES.find((known) => raw.includes(known))
    return code ? t(`errors.${code}`) : t('errors.general')
  }
  const status = (lists.error as { response?: { status?: number } } | null)?.response?.status
  const count = (value: number) => formatNumber(value, locale, 0)

  const window = (list: SavedPriceList) =>
    list.validFrom || list.validTo
      ? `${list.validFrom ? date(list.validFrom) : '…'} – ${list.validTo ? date(list.validTo) : '…'}`
      : t('always')

  return (
    <section className="space-y-3" aria-labelledby="price-lists-title">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="price-lists-title" className="text-lg font-bold text-[hsl(var(--fg-primary))]">
            {t('title')}
          </h2>
          <p className="mt-1 text-sm text-[hsl(var(--fg-tertiary))]">{t('subtitle')}</p>
        </div>
        {!adding ? (
          <Button variant="outline" onClick={() => setAdding(true)}>
            {t('add')}
          </Button>
        ) : null}
      </header>

      {adding ? <PriceListForm onDone={() => setAdding(false)} errorText={errorText} /> : null}

      {lists.isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-xl bg-[hsl(var(--surface-muted))] motion-reduce:animate-none"
            />
          ))}
        </div>
      ) : lists.error || !lists.data ? (
        <p role="alert" className={cn(card, 'p-4', danger)}>
          {status === 403 ? t('forbidden') : errorText(lists.error)}
        </p>
      ) : lists.data.length === 0 ? (
        <p className={cn(card, 'p-6 text-center text-sm text-[hsl(var(--fg-secondary))]')}>
          {t('empty')}
        </p>
      ) : (
        <ul className="space-y-2">
          {lists.data.map((list) => (
            <li key={list.id} className={cn(card, 'p-4')}>
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-[hsl(var(--fg-primary))]">
                    {list.name}
                    <span
                      dir="ltr"
                      className="rounded-full bg-[hsl(var(--color-primary)/0.1)] px-2 py-0.5 text-xs text-[hsl(var(--color-primary))]"
                    >
                      {list.currency}
                    </span>
                    {!list.isActive ? (
                      <span className="rounded-full bg-[hsl(var(--surface-muted))] px-2 py-0.5 text-xs text-[hsl(var(--fg-secondary))]">
                        {t('retired')}
                      </span>
                    ) : null}
                  </p>
                  <p className={cn('mt-1', faint)}>
                    {t('productCount', { count: count(list.itemCount) })}
                    {' · '}
                    {t('customerCount', { count: count(list.customerCount) })}
                    {' · '}
                    {window(list)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-expanded={openId === list.id}
                  onClick={() => setOpenId(openId === list.id ? null : list.id)}
                >
                  {openId === list.id ? t('close') : t('open')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={setActive.isPending && setActive.variables?.id === list.id}
                  onClick={() => setActive.mutate({ id: list.id, isActive: !list.isActive })}
                >
                  {list.isActive ? t('retire') : t('reactivate')}
                </Button>
              </div>
              {openId === list.id ? <PriceListEditor list={list} errorText={errorText} /> : null}
            </li>
          ))}
        </ul>
      )}
      {setActive.error ? (
        <p role="alert" className={danger}>
          {errorText(setActive.error)}
        </p>
      ) : null}
      <p className={faint}>{t('note')}</p>
    </section>
  )
}

function PriceListForm({ onDone, errorText }: { onDone: () => void; errorText: ErrorText }) {
  const t = useTranslations('priceLists')
  const tCurrency = useTranslations('currency')
  const primaryCurrency = useCurrencyStore((s) => s.primaryCurrency)
  const save = useSavePriceList()

  const [name, setName] = useState('')
  const [currency, setCurrency] = useState<string>(primaryCurrency)
  const [validFrom, setValidFrom] = useState('')
  const [validTo, setValidTo] = useState('')
  const [problem, setProblem] = useState<string | null>(null)

  const submit = () => {
    const parsed = priceListInputSchema.safeParse({
      name,
      currency,
      validFrom: validFrom || null,
      validTo: validTo || null,
    })
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      const code = PRICE_LIST_ERROR_CODES.find((known) => known === first?.message)
      setProblem(code ? t(`errors.${code}`) : t('errors.incomplete'))
      return
    }
    setProblem(null)
    save.mutate(parsed.data, { onSuccess: onDone })
  }

  return (
    <div className={cn(card, 'space-y-4 p-4')}>
      <h3 className="font-semibold text-[hsl(var(--fg-primary))]">{t('newTitle')}</h3>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1">
          <span className={label}>{t('name')}</span>
          <input
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            placeholder={t('namePlaceholder')}
            className={field}
          />
        </label>
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
        <div className="space-y-1" data-field="validFrom">
          <span className={label}>{t('validFrom')}</span>
          <JalaliDatePicker value={validFrom} onChange={setValidFrom} placeholder={t('noLimit')} />
        </div>
        <div className="space-y-1" data-field="validTo">
          <span className={label}>{t('validTo')}</span>
          <JalaliDatePicker value={validTo} onChange={setValidTo} placeholder={t('noLimit')} />
        </div>
      </div>
      <p className={faint}>{t('currencyHint')}</p>

      {problem || save.error ? (
        <p role="alert" className={danger}>
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
    </div>
  )
}

/** The prices on one list and the customers who buy on it. */
function PriceListEditor({ list, errorText }: { list: SavedPriceList; errorText: ErrorText }) {
  const t = useTranslations('priceLists')
  const units = useUnits()
  const locale = useIntlLocale()
  const detail = usePriceList(list.id)
  const setItems = useSetPriceListItems()
  const assign = useAssignPriceList()
  const money = (value: number) => `${formatNumber(value, locale, 2)} ${list.currency}`
  // A unit this business does not have is shown as itself, never as another unit.
  const unitLabel = (code: string | null) => {
    const unit = asList<Unit>(units.data?.units).find((row) => row.code === code)
    return unit ? labelOfUnit(unit) : (code ?? '')
  }

  if (detail.isLoading) return <p className={cn('mt-3', faint)}>{t('loading')}</p>
  if (detail.error || !detail.data) {
    return (
      <p role="alert" className={cn('mt-3', danger)}>
        {errorText(detail.error)}
      </p>
    )
  }
  const { items, customers } = detail.data

  return (
    <div className="mt-4 grid gap-4 border-t border-[hsl(var(--border-default))] pt-4 lg:grid-cols-2">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">{t('prices')}</h3>
        {items.length === 0 ? (
          <p className={faint}>{t('noPrices')}</p>
        ) : (
          <ul className="divide-y divide-[hsl(var(--border-default))]">
            {items.map((item) => (
              <li key={item.productId} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate text-[hsl(var(--fg-primary))]">
                  {item.name}
                </span>
                <span className="tabular-nums text-[hsl(var(--fg-primary))]">
                  {money(item.unitPrice)}
                  {item.unit ? <span className={faint}> / {unitLabel(item.unit)}</span> : null}
                </span>
                <span className={cn('tabular-nums', faint)}>
                  {t('ownPrice', { price: formatNumber(item.ownPrice, locale, 2) })}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={setItems.isPending}
                  onClick={() =>
                    setItems.mutate({
                      id: list.id,
                      items: [{ productId: item.productId, unitPrice: null }],
                    })
                  }
                >
                  {t('takeOff')}
                </Button>
              </li>
            ))}
          </ul>
        )}
        <AddPrice
          list={list}
          onList={new Set(items.map((item) => item.productId))}
          pending={setItems.isPending}
          unitLabel={unitLabel}
          onAdd={(productId, unitPrice) =>
            setItems.mutate({ id: list.id, items: [{ productId, unitPrice }] })
          }
        />
        {setItems.error ? (
          <p role="alert" className={danger}>
            {errorText(setItems.error)}
          </p>
        ) : null}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">{t('customers')}</h3>
        {customers.length === 0 ? (
          <p className={faint}>{t('noCustomers')}</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {customers.map((customer) => (
              <li key={customer.id}>
                <button
                  type="button"
                  disabled={assign.isPending}
                  onClick={() => assign.mutate({ customerId: customer.id, priceListId: null })}
                  className="rounded-full bg-[hsl(var(--color-primary)/0.1)] px-2 py-0.5 text-xs text-[hsl(var(--color-primary))]"
                  aria-label={`${t('takeOff')}: ${customer.name}`}
                >
                  {customer.name} ×
                </button>
              </li>
            ))}
          </ul>
        )}
        {list.isActive ? (
          <AddCustomer
            onList={new Set(customers.map((customer) => customer.id))}
            pending={assign.isPending}
            onAdd={(customerId) => assign.mutate({ customerId, priceListId: list.id })}
          />
        ) : (
          <p className={faint}>{t('retiredNoCustomers')}</p>
        )}
        <p className={faint}>{t('oneListPerCustomer')}</p>
        {assign.error ? (
          <p role="alert" className={danger}>
            {errorText(assign.error)}
          </p>
        ) : null}
      </div>
    </div>
  )
}

/** Search a product, type its price in the list's currency, add it. */
function AddPrice({
  list,
  onList,
  pending,
  unitLabel,
  onAdd,
}: {
  list: SavedPriceList
  onList: ReadonlySet<string>
  pending: boolean
  unitLabel: (unit: string | null) => string
  onAdd: (productId: string, unitPrice: number) => void
}) {
  const t = useTranslations('priceLists')
  const locale = useIntlLocale()
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState<{ id: string; name: string; unit: string | null } | null>(
    null,
  )
  const [price, setPrice] = useState('')
  const products = useProducts({ search: search.trim(), limit: 20 })
  const found = readProducts(products.data).filter((product) => !onList.has(product.id))
  const value = Number(price)
  const valid = price.trim() !== '' && Number.isFinite(value) && value > 0

  if (picked) {
    return (
      <div className="space-y-2 rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] p-3">
        <p className="text-sm font-medium text-[hsl(var(--fg-primary))]">{picked.name}</p>
        <label className="block space-y-1">
          <span className={label}>
            {picked.unit
              ? t('priceForUnit', { currency: list.currency, unit: unitLabel(picked.unit) })
              : t('priceIn', { currency: list.currency })}
          </span>
          <input
            name="unitPrice"
            inputMode="decimal"
            dir="ltr"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            className={cn(field, 'tabular-nums')}
          />
        </label>
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={!valid || pending}
            onClick={() => {
              onAdd(picked.id, value)
              setPicked(null)
              setPrice('')
              setSearch('')
            }}
          >
            {t('addPrice')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPicked(null)}>
            {t('cancel')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2 rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] p-3">
      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={t('searchProduct')}
        aria-label={t('searchProduct')}
        className={field}
      />
      {products.isError ? (
        <p role="alert" className="text-xs text-[hsl(var(--color-destructive))]">
          {t('searchFailed')}
        </p>
      ) : products.isFetching ? (
        <p className={faint}>{t('searching')}</p>
      ) : found.length === 0 ? (
        <p className={faint}>{t('nothingFound')}</p>
      ) : (
        <ul className="max-h-40 space-y-1 overflow-y-auto">
          {found.map((product) => (
            <li key={product.id}>
              <button
                type="button"
                onClick={() =>
                  setPicked({ id: product.id, name: product.name, unit: product.unit ?? null })
                }
                className="flex w-full items-center justify-between gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-start text-sm hover:bg-[hsl(var(--surface-muted))]"
              >
                <span className="min-w-0 truncate">{product.name}</span>
                <span className={cn('shrink-0 tabular-nums', faint)}>
                  {formatNumber(productPrice(product), locale, 2)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function AddCustomer({
  onList,
  pending,
  onAdd,
}: {
  onList: ReadonlySet<string>
  pending: boolean
  onAdd: (customerId: string) => void
}) {
  const t = useTranslations('priceLists')
  const [search, setSearch] = useState('')
  const customers = useCustomers({
    page: 1,
    limit: 20,
    sortDirection: 'desc',
    search: search.trim(),
  })
  const found = (customers.data?.customers ?? []).filter(
    (customer) => !onList.has(customer.id as string),
  )

  return (
    <div className="space-y-2 rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] p-3">
      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={t('searchCustomer')}
        aria-label={t('searchCustomer')}
        className={field}
      />
      {customers.isError ? (
        <p role="alert" className="text-xs text-[hsl(var(--color-destructive))]">
          {t('searchFailed')}
        </p>
      ) : customers.isFetching ? (
        <p className={faint}>{t('searching')}</p>
      ) : found.length === 0 ? (
        <p className={faint}>{t('nothingFound')}</p>
      ) : (
        <ul className="max-h-40 space-y-1 overflow-y-auto">
          {found.map((customer) => (
            <li key={customer.id as string}>
              <button
                type="button"
                disabled={pending}
                onClick={() => onAdd(customer.id as string)}
                className="w-full rounded-[var(--radius-sm)] px-2 py-1.5 text-start text-sm hover:bg-[hsl(var(--surface-muted))]"
              >
                {customer.fullName}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
