'use client'
// ============================================
// «استعلام قیمت» — requests for quotation and supplier quotations
// (V61 B.2.13), with the agreed prices of a purchase contract (B.2.14).
// Warehouse hub › stock › `?view=rfqs`.
//
// ⚠️ «Choose» marks one quotation chosen, the RFQ's others rejected and the
// RFQ awarded — one database transaction (`rfq_choose_quotation`). It records
// NO purchase: the purchase invoice is recorded from the invoice builder, the
// one place purchases live (CLAUDE.md «دو خط موازی»). The screen says so.
// ⚠️ Totals are compared only WITHIN a currency — a cheaper number in another
// currency is not cheaper.
// ============================================
import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  useAddQuotation,
  useChooseQuotation,
  useContracts,
  useCreateRfq,
  usePurchaseContractPrices,
  useRfqs,
  useSavePurchaseContractPrice,
  type PurchaseContractPrice,
  type Rfq,
  type SupplierQuotation,
} from '@hisabche/api'
import { CURRENCY_CODES } from '@hisabche/validation'
import { toIsoDay } from '@hisabche/formatting'

import { useBookCurrency } from '../../../hooks/use-book-currency'
import { useDateFormat } from '../../../hooks/use-date-format'
import { Button } from '../button'
import { DataTable, type TableColumn } from '../data-table'
import { EmptyState } from '../empty-state'
import { Input } from '../input'
import { JalaliDatePicker } from '../jalali-datepicker'
import { SegmentedControl } from '../segmented-control'
import { useToast } from '../toast-provider'
import {
  LabeledSelect,
  typedMinor,
  useCustomerOptions,
  useMoneyText,
  useProductOptions,
} from '../business-packs/pack-shared'
import { QueryState, erpCard, fieldLabel, refusalText, useTableLabel } from './erp-shared'

export const RFQ_ERROR_CODES = [
  'RFQ_NOT_OPEN',
  'QUOTATION_NOT_OPEN',
  'QUOTATION_EXPIRED',
  'RFQ_SUPPLIER_NOT_FOUND',
  'RFQ_PRODUCT_NOT_FOUND',
  'RFQ_CHOOSE_NOT_INSTALLED',
  'CONTRACT_NOT_FOUND',
  'CONTRACT_SUPPLIER_MISMATCH',
  'CONTRACT_PRICE_CURRENCY_MISMATCH',
  'CONTRACT_PRICE_DATES_REVERSED',
] as const

const RFQ_VIEWS = ['requests', 'contractPrices'] as const
type RfqView = (typeof RFQ_VIEWS)[number]

/** The lowest total of each currency among the RFQ's still-open quotations. */
export function lowestByCurrency(quotations: readonly SupplierQuotation[]): Map<string, string> {
  const best = new Map<string, SupplierQuotation>()
  for (const q of quotations) {
    if (q.status !== 'submitted') continue
    const current = best.get(q.currency)
    if (!current || Number(q.total_minor) < Number(current.total_minor)) best.set(q.currency, q)
  }
  return new Map([...best].map(([currency, q]) => [currency, q.id]))
}

interface DraftLine {
  productId: string
  quantity: string
  price: string
}

export function RfqSection() {
  const t = useTranslations('erpCore.rfq')
  const tr = (key: string): string => t(key as Parameters<typeof t>[0])
  const [view, setView] = useState<RfqView>('requests')
  return (
    <div className="space-y-4 p-4">
      <p className="text-sm text-[hsl(var(--fg-secondary))]">{tr('intro')}</p>
      <SegmentedControl
        label={tr('viewLabel')}
        options={RFQ_VIEWS.map((value) => ({ value, label: tr(`views.${value}`) }))}
        value={view}
        onChange={setView}
      />
      {view === 'requests' ? <RfqRequests /> : <ContractPrices />}
    </div>
  )
}

function RfqRequests() {
  const t = useTranslations('erpCore.rfq')
  const tr = (key: string): string => t(key as Parameters<typeof t>[0])
  const label = useTableLabel()
  const toast = useToast()
  const { date } = useDateFormat()
  const money = useMoneyText()
  const bookCurrency = useBookCurrency()
  const suppliers = useCustomerOptions()
  const products = useProductOptions('goods')

  const rfqs = useRfqs()
  const createRfq = useCreateRfq()
  const addQuotation = useAddQuotation()
  const choose = useChooseQuotation()

  const [title, setTitle] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [supplier, setSupplier] = useState('')
  const [currency, setCurrency] = useState('')
  const [validUntil, setValidUntil] = useState(() => toIsoDay(new Date()))
  const [leadTime, setLeadTime] = useState('0')
  const [lines, setLines] = useState<DraftLine[]>([{ productId: '', quantity: '1', price: '' }])

  const chosenCurrency = currency || bookCurrency || ''
  const supplierName = (id: string) =>
    suppliers.find((s) => s.value === id)?.label ?? id.slice(0, 8)
  const open = (rfqs.data ?? []).find((r) => r.id === openId) ?? null
  const errorText = (e: unknown) => refusalText(e, RFQ_ERROR_CODES, tr)

  const rows = useMemo(
    () =>
      (rfqs.data ?? []).filter((r) =>
        search.trim() ? r.title.toLowerCase().includes(search.trim().toLowerCase()) : true,
      ),
    [rfqs.data, search],
  )

  const columns: TableColumn<Rfq>[] = [
    {
      id: 'title',
      labelKey: 'erpCore.rfq.columns.title',
      labelFallback: 'عنوان',
      locked: true,
      render: (r) => r.title,
      sortValue: (r) => r.title,
    },
    {
      id: 'status',
      labelKey: 'erpCore.rfq.columns.status',
      labelFallback: 'وضعیت',
      render: (r) => tr(`rfqStatus.${r.status}`),
    },
    {
      id: 'quotations',
      labelKey: 'erpCore.rfq.columns.quotations',
      labelFallback: 'پیشنهادها',
      render: (r) => r.supplier_quotations.length,
      sortValue: (r) => r.supplier_quotations.length,
    },
    {
      id: 'created',
      labelKey: 'erpCore.rfq.columns.created',
      labelFallback: 'تاریخ',
      render: (r) => date(r.created_at),
      sortValue: (r) => r.created_at,
    },
    {
      id: 'actions',
      labelKey: 'erpCore.rfq.columns.actions',
      labelFallback: 'اقدام',
      locked: true,
      render: (r) => (
        <Button size="sm" variant="outline" onClick={() => setOpenId(r.id)}>
          {tr('open')}
        </Button>
      ),
    },
  ]

  const best = open ? lowestByCurrency(open.supplier_quotations) : new Map<string, string>()
  const quotationColumns: TableColumn<SupplierQuotation>[] = [
    {
      id: 'supplier',
      labelKey: 'erpCore.rfq.columns.supplier',
      labelFallback: 'تأمین‌کننده',
      locked: true,
      render: (q) => supplierName(q.supplier_id),
    },
    {
      id: 'total',
      labelKey: 'erpCore.rfq.columns.total',
      labelFallback: 'جمع',
      render: (q) => (
        <span>
          {money(Number(q.total_minor), q.currency)}
          {best.get(q.currency) === q.id ? (
            <span className="ms-2 rounded bg-[hsl(var(--color-success)/0.12)] px-1.5 text-xs text-[hsl(var(--color-success))]">
              {tr('lowest')}
            </span>
          ) : null}
        </span>
      ),
      sortValue: (q) => Number(q.total_minor),
    },
    {
      id: 'validUntil',
      labelKey: 'erpCore.rfq.columns.validUntil',
      labelFallback: 'معتبر تا',
      render: (q) => date(q.valid_until),
    },
    {
      id: 'leadTime',
      labelKey: 'erpCore.rfq.columns.leadTime',
      labelFallback: 'زمان تحویل (روز)',
      render: (q) => q.lead_time_days,
    },
    {
      id: 'status',
      labelKey: 'erpCore.rfq.columns.status',
      labelFallback: 'وضعیت',
      render: (q) => tr(`quotationStatus.${q.status}`),
    },
    {
      id: 'actions',
      labelKey: 'erpCore.rfq.columns.actions',
      labelFallback: 'اقدام',
      locked: true,
      render: (q) =>
        open?.status === 'open' && q.status === 'submitted' ? (
          <Button
            size="sm"
            disabled={choose.isPending}
            onClick={() =>
              choose.mutate(q.id, {
                onSuccess: () => toast.success(tr('chosen')),
                onError: (e) => toast.error(errorText(e)),
              })
            }
          >
            {tr('choose')}
          </Button>
        ) : null,
    },
  ]

  const submitRfq = () => {
    if (!title.trim()) {
      toast.error(tr('errors.titleRequired'))
      return
    }
    createRfq.mutate(
      { title: title.trim() },
      {
        onSuccess: (row) => {
          setTitle('')
          setOpenId(row.id)
          toast.success(tr('created'))
        },
        onError: (e) => toast.error(errorText(e)),
      },
    )
  }

  const submitQuotation = () => {
    if (!open) return
    const parsed = lines.map((l) => ({
      product_id: l.productId,
      quantity: Number(l.quantity),
      unit_price_minor: typedMinor(l.price, chosenCurrency),
    }))
    const complete =
      supplier &&
      chosenCurrency &&
      parsed.length > 0 &&
      parsed.every(
        (l) =>
          l.product_id && l.quantity > 0 && l.unit_price_minor !== null && l.unit_price_minor >= 0,
      )
    if (!complete) {
      toast.error(tr('errors.quotationIncomplete'))
      return
    }
    addQuotation.mutate(
      {
        rfqId: open.id,
        supplier_id: supplier,
        currency: chosenCurrency,
        valid_until: validUntil,
        lead_time_days: Math.max(0, Math.round(Number(leadTime) || 0)),
        lines: parsed.map((l) => ({
          product_id: l.product_id,
          quantity: l.quantity,
          unit_price_minor: l.unit_price_minor ?? 0,
        })),
      },
      {
        onSuccess: () => {
          setLines([{ productId: '', quantity: '1', price: '' }])
          toast.success(tr('quotationSaved'))
        },
        onError: (e) => toast.error(errorText(e)),
      },
    )
  }

  const setLine = (index: number, patch: Partial<DraftLine>) =>
    setLines((all) => all.map((l, i) => (i === index ? { ...l, ...patch } : l)))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-[hsl(var(--border-default))] p-4">
        <label className={`${fieldLabel} min-w-[16rem] flex-1`}>
          {tr('form.title')}
          <Input name="title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <Button size="sm" disabled={createRfq.isPending} onClick={submitRfq}>
          {tr('form.create')}
        </Button>
      </div>

      <QueryState
        isLoading={rfqs.isLoading}
        isError={rfqs.isError}
        onRetry={() => void rfqs.refetch()}
        loadingText={tr('loading')}
        errorText={tr('loadFailed')}
        retryText={tr('retry')}
      >
        <DataTable
          tableId="warehouse-rfqs"
          t={label}
          rows={rows}
          columns={columns}
          rowKey={(r) => r.id}
          searchValue={search}
          onSearchChange={setSearch}
          emptyState={<EmptyState title={tr('emptyTitle')} description={tr('emptyDescription')} />}
        />
      </QueryState>

      {open ? (
        <section className="space-y-3 rounded-2xl border border-[hsl(var(--border-default))] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{open.title}</h3>
            <Button size="sm" variant="outline" onClick={() => setOpenId(null)}>
              {tr('close')}
            </Button>
          </div>
          <p className="text-xs text-[hsl(var(--fg-secondary))]">{tr('chooseHint')}</p>
          <DataTable
            tableId="warehouse-rfq-quotations"
            t={label}
            rows={open.supplier_quotations}
            columns={quotationColumns}
            rowKey={(q) => q.id}
            paginate={false}
            emptyState={<EmptyState title={tr('noQuotations')} />}
          />

          {open.status === 'open' ? (
            <div className={erpCard}>
              <LabeledSelect
                name="supplier_id"
                label={tr('form.supplier')}
                value={supplier}
                onChange={setSupplier}
                options={suppliers}
              />
              <LabeledSelect
                name="currency"
                label={tr('form.currency')}
                value={chosenCurrency}
                onChange={setCurrency}
                options={CURRENCY_CODES.map((code) => ({ value: code, label: code }))}
              />
              <div className={fieldLabel} data-field="valid_until">
                {tr('form.validUntil')}
                <JalaliDatePicker value={validUntil} onChange={setValidUntil} />
              </div>
              <label className={fieldLabel}>
                {tr('form.leadTime')}
                <Input
                  name="lead_time_days"
                  inputMode="numeric"
                  value={leadTime}
                  onChange={(e) => setLeadTime(e.target.value)}
                />
              </label>
              {lines.map((line, index) => (
                <div key={index} className="grid gap-2 sm:col-span-3 sm:grid-cols-4">
                  <LabeledSelect
                    name={`lines.${index}.product_id`}
                    label={tr('form.product')}
                    value={line.productId}
                    onChange={(v) => setLine(index, { productId: v })}
                    options={products}
                  />
                  <label className={fieldLabel}>
                    {tr('form.quantity')}
                    <Input
                      name={`lines.${index}.quantity`}
                      inputMode="decimal"
                      value={line.quantity}
                      onChange={(e) => setLine(index, { quantity: e.target.value })}
                    />
                  </label>
                  <label className={fieldLabel}>
                    {tr('form.unitPrice')}
                    <Input
                      name={`lines.${index}.unit_price_minor`}
                      inputMode="decimal"
                      value={line.price}
                      onChange={(e) => setLine(index, { price: e.target.value })}
                    />
                  </label>
                  <div className="flex items-end">
                    {lines.length > 1 ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setLines((all) => all.filter((_, i) => i !== index))}
                      >
                        {tr('form.removeLine')}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap gap-2 sm:col-span-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setLines((all) => [...all, { productId: '', quantity: '1', price: '' }])
                  }
                >
                  {tr('form.addLine')}
                </Button>
                <Button size="sm" disabled={addQuotation.isPending} onClick={submitQuotation}>
                  {tr('form.saveQuotation')}
                </Button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}

function ContractPrices() {
  const t = useTranslations('erpCore.rfq')
  const tr = (key: string): string => t(key as Parameters<typeof t>[0])
  const label = useTableLabel()
  const toast = useToast()
  const { date } = useDateFormat()
  const money = useMoneyText()
  const suppliers = useCustomerOptions()
  const products = useProductOptions('goods')
  const contracts = useContracts()
  const prices = usePurchaseContractPrices()
  const save = useSavePurchaseContractPrice()

  const [contractId, setContractId] = useState('')
  const [productId, setProductId] = useState('')
  const [price, setPrice] = useState('')
  const [validFrom, setValidFrom] = useState(() => toIsoDay(new Date()))
  const [validTo, setValidTo] = useState(() => toIsoDay(new Date()))

  // The contract decides the supplier and the currency: a price is agreed WITH
  // that party, in that contract's currency (the server checks both).
  const contractRows = (contracts.data ?? []).map((c) => ({
    id: String(c.id ?? ''),
    title: String(c.title ?? ''),
    partyId: String(c.customer_id ?? ''),
    currency: String(c.currency ?? ''),
  }))
  const contract = contractRows.find((c) => c.id === contractId) ?? null
  const productName = (id: string) => products.find((p) => p.value === id)?.label ?? id.slice(0, 8)
  const partyName = (id: string) => suppliers.find((s) => s.value === id)?.label ?? id.slice(0, 8)

  const columns: TableColumn<PurchaseContractPrice>[] = [
    {
      id: 'product',
      labelKey: 'erpCore.rfq.columns.product',
      labelFallback: 'کالا',
      locked: true,
      render: (p) => productName(p.product_id),
    },
    {
      id: 'supplier',
      labelKey: 'erpCore.rfq.columns.supplier',
      labelFallback: 'تأمین‌کننده',
      render: (p) => partyName(p.supplier_id),
    },
    {
      id: 'price',
      labelKey: 'erpCore.rfq.columns.agreedPrice',
      labelFallback: 'قیمت توافقی',
      render: (p) => money(Number(p.agreed_unit_price_minor), p.currency),
    },
    {
      id: 'period',
      labelKey: 'erpCore.rfq.columns.period',
      labelFallback: 'اعتبار',
      render: (p) => `${date(p.valid_from)} – ${date(p.valid_to)}`,
    },
  ]

  const submit = () => {
    const minor = contract ? typedMinor(price, contract.currency) : null
    if (!contract || !contract.currency || !productId || minor === null) {
      toast.error(tr('errors.priceIncomplete'))
      return
    }
    save.mutate(
      {
        contract_id: contract.id,
        supplier_id: contract.partyId,
        product_id: productId,
        agreed_unit_price_minor: minor,
        currency: contract.currency,
        valid_from: validFrom,
        valid_to: validTo,
      },
      {
        onSuccess: () => {
          setPrice('')
          toast.success(tr('priceSaved'))
        },
        onError: (e) => toast.error(refusalText(e, RFQ_ERROR_CODES, tr)),
      },
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-[hsl(var(--fg-secondary))]">{tr('contractHint')}</p>
      <div className={erpCard}>
        <LabeledSelect
          name="contract_id"
          label={tr('form.contract')}
          value={contractId}
          onChange={setContractId}
          options={contractRows.map((c) => ({
            value: c.id,
            label: `${c.title} — ${partyName(c.partyId)}`,
          }))}
        />
        <LabeledSelect
          name="product_id"
          label={tr('form.product')}
          value={productId}
          onChange={setProductId}
          options={products}
        />
        <label className={fieldLabel}>
          {tr('form.agreedPrice')}
          {contract?.currency ? ` (${contract.currency})` : ''}
          <Input
            name="agreed_unit_price_minor"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </label>
        <div className={fieldLabel} data-field="valid_from">
          {tr('form.validFrom')}
          <JalaliDatePicker value={validFrom} onChange={setValidFrom} />
        </div>
        <div className={fieldLabel} data-field="valid_to">
          {tr('form.validTo')}
          <JalaliDatePicker value={validTo} onChange={setValidTo} />
        </div>
        <div className="flex items-end">
          <Button size="sm" disabled={save.isPending} onClick={submit}>
            {tr('form.savePrice')}
          </Button>
        </div>
      </div>

      <QueryState
        isLoading={prices.isLoading}
        isError={prices.isError}
        onRetry={() => void prices.refetch()}
        loadingText={tr('loading')}
        errorText={tr('loadFailed')}
        retryText={tr('retry')}
      >
        <DataTable
          tableId="warehouse-contract-prices"
          t={label}
          rows={prices.data ?? []}
          columns={columns}
          rowKey={(p) => p.id}
          emptyState={<EmptyState title={tr('noPrices')} description={tr('noPricesDescription')} />}
        />
      </QueryState>
    </div>
  )
}
