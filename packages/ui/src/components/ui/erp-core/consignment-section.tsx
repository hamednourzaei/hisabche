'use client'
// ============================================
// «امانی» — consignment lots (V61 B.2.10). Warehouse hub › stock › `?view=consignments`.
//
// ⚠️ A REGISTER, NOT A STOCK MOVEMENT. A lot records goods we hold for a
// supplier (in) or goods a partner holds for us (out). The server writes one
// row; stock, cost and the ledger do not move. The screen says so in its
// first sentence — a reader must never think «I recorded it, so stock is in».
// ============================================
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  useConsignmentLots,
  useCreateConsignmentLot,
  type ConsignmentDirection,
  type ConsignmentLot,
} from '@hisabche/api'
import { CURRENCY_CODES } from '@hisabche/validation'

import { useBookCurrency } from '../../../hooks/use-book-currency'
import { useDateFormat } from '../../../hooks/use-date-format'
import { Button } from '../button'
import { DataTable, type TableColumn } from '../data-table'
import { EmptyState } from '../empty-state'
import { Input } from '../input'
import { useToast } from '../toast-provider'
import {
  LabeledSelect,
  typedMinor,
  useCustomerOptions,
  useMoneyText,
  useProductOptions,
  useWarehouseOptions,
} from '../business-packs/pack-shared'
import {
  QueryState,
  erpCard,
  optionText,
  fieldLabel,
  refusalText,
  useTableLabel,
} from './erp-shared'

export const CONSIGNMENT_ERROR_CODES = [
  'CONSIGNMENT_PARTY_NOT_FOUND',
  'CONSIGNMENT_WAREHOUSE_NOT_FOUND',
  'CONSIGNMENT_PRODUCT_NOT_FOUND',
] as const

export function ConsignmentSection() {
  const t = useTranslations('erpCore.consignment')
  const tr = (key: string): string => t(key as Parameters<typeof t>[0])
  const label = useTableLabel()
  const toast = useToast()
  const { date } = useDateFormat()
  const money = useMoneyText()
  const bookCurrency = useBookCurrency()
  const parties = useCustomerOptions()
  const warehouses = useWarehouseOptions()
  const products = useProductOptions('goods')

  const lots = useConsignmentLots()
  const create = useCreateConsignmentLot()

  const [direction, setDirection] = useState<ConsignmentDirection>('in')
  const [party, setParty] = useState('')
  const [warehouse, setWarehouse] = useState('')
  const [product, setProduct] = useState('')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [currency, setCurrency] = useState('')
  const [search, setSearch] = useState('')

  const chosenCurrency = currency || bookCurrency || ''
  const nameOf = optionText

  const needle = search.trim().toLowerCase()
  const rows = (lots.data ?? []).filter((lot) =>
    needle
      ? `${nameOf(products, lot.product_id)} ${nameOf(parties, lot.party_id)}`
          .toLowerCase()
          .includes(needle)
      : true,
  )

  const columns: TableColumn<ConsignmentLot>[] = [
    {
      id: 'product',
      labelKey: 'erpCore.consignment.columns.product',
      labelFallback: 'کالا',
      locked: true,
      render: (lot) => nameOf(products, lot.product_id),
    },
    {
      id: 'direction',
      labelKey: 'erpCore.consignment.columns.direction',
      labelFallback: 'نوع',
      render: (lot) => tr(`direction.${lot.direction}`),
    },
    {
      id: 'party',
      labelKey: 'erpCore.consignment.columns.party',
      labelFallback: 'طرف',
      render: (lot) => nameOf(parties, lot.party_id),
    },
    {
      id: 'warehouse',
      labelKey: 'erpCore.consignment.columns.warehouse',
      labelFallback: 'انبار',
      render: (lot) => nameOf(warehouses, lot.warehouse_id),
    },
    {
      id: 'quantity',
      labelKey: 'erpCore.consignment.columns.quantity',
      labelFallback: 'مقدار',
      render: (lot) => Number(lot.quantity),
      sortValue: (lot) => Number(lot.quantity),
    },
    {
      id: 'price',
      labelKey: 'erpCore.consignment.columns.price',
      labelFallback: 'قیمت توافقی',
      render: (lot) => money(Number(lot.unit_agreed_price_minor), lot.currency),
    },
    {
      id: 'status',
      labelKey: 'erpCore.consignment.columns.status',
      labelFallback: 'وضعیت',
      render: (lot) => tr(`status.${lot.status}`),
    },
    {
      id: 'created',
      labelKey: 'erpCore.consignment.columns.created',
      labelFallback: 'تاریخ',
      render: (lot) => date(lot.created_at),
      sortValue: (lot) => lot.created_at,
    },
  ]

  const submit = () => {
    const qty = Number(quantity)
    const priceMinor = typedMinor(price, chosenCurrency)
    if (!party || !warehouse || !product || !(qty > 0) || priceMinor === null || !chosenCurrency) {
      toast.error(tr('errors.formIncomplete'))
      return
    }
    create.mutate(
      {
        direction,
        party_id: party,
        warehouse_id: warehouse,
        product_id: product,
        quantity: qty,
        unit_agreed_price_minor: priceMinor,
        currency: chosenCurrency,
      },
      {
        onSuccess: () => {
          setQuantity('')
          setPrice('')
          toast.success(tr('saved'))
        },
        onError: (e) => toast.error(refusalText(e, CONSIGNMENT_ERROR_CODES, tr)),
      },
    )
  }

  return (
    <div className="space-y-4 p-4">
      <p className="text-sm text-[hsl(var(--fg-secondary))]">{tr('intro')}</p>
      <div className={erpCard}>
        <LabeledSelect
          name="direction"
          label={tr('form.direction')}
          value={direction}
          onChange={(v) => setDirection(v === 'out' ? 'out' : 'in')}
          options={[
            { value: 'in', label: tr('direction.in') },
            { value: 'out', label: tr('direction.out') },
          ]}
        />
        <LabeledSelect
          name="party_id"
          label={tr('form.party')}
          value={party}
          onChange={setParty}
          options={parties}
        />
        <LabeledSelect
          name="warehouse_id"
          label={tr('form.warehouse')}
          value={warehouse}
          onChange={setWarehouse}
          options={warehouses}
        />
        <LabeledSelect
          name="product_id"
          label={tr('form.product')}
          value={product}
          onChange={setProduct}
          options={products}
        />
        <label className={fieldLabel}>
          {tr('form.quantity')}
          <Input
            name="quantity"
            inputMode="decimal"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </label>
        <label className={fieldLabel}>
          {tr('form.price')}
          <Input
            name="unit_agreed_price_minor"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </label>
        <LabeledSelect
          name="currency"
          label={tr('form.currency')}
          value={chosenCurrency}
          onChange={setCurrency}
          options={CURRENCY_CODES.map((code) => ({ value: code, label: code }))}
        />
        <div className="flex items-end sm:col-span-2">
          <Button size="sm" disabled={create.isPending} onClick={submit}>
            {tr('form.save')}
          </Button>
        </div>
      </div>

      <QueryState
        isLoading={lots.isLoading}
        isError={lots.isError}
        onRetry={() => void lots.refetch()}
        loadingText={tr('loading')}
        errorText={tr('loadFailed')}
        retryText={tr('retry')}
      >
        <DataTable
          tableId="warehouse-consignments"
          t={label}
          rows={rows}
          columns={columns}
          rowKey={(lot) => lot.id}
          searchValue={search}
          onSearchChange={setSearch}
          emptyState={<EmptyState title={tr('emptyTitle')} description={tr('emptyDescription')} />}
        />
      </QueryState>
    </div>
  )
}
