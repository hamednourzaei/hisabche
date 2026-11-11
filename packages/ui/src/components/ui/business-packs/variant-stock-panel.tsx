'use client'

// ============================================
// Clothing / footwear on the product page (QA document §5, 10 Nov 2026).
//
//   • «ساخت جدول سایز و رنگ» — S M L XL × black, white in one go; cells the
//     product already has are skipped;
//   • stock per variant, per warehouse, and what each sold;
//   • totals per value of one attribute (all size L, whatever the colour);
//   • put stock on a variant: «از موجودی کالا» (assign — total unchanged),
//     «ورود تازه» (receive), «کسر» (remove).
// ============================================

import { useMemo, useState } from 'react'
import { Grid3x3, PackagePlus } from 'lucide-react'
import { useCreateVariantMatrix, useMoveVariantStock, useVariantStock } from '@hisabche/api'
import {
  checkVariantAtpAvailability,
  totalsByAttribute,
  VARIANT_STOCK_MODES,
  type VariantStockMode,
} from '@hisabche/validation'

import { Button } from '../button'
import { Input } from '../input'
import { SelectField } from '../select-field'
import { DataTable, type TableColumn } from '../data-table'
import { useToast } from '../toast-provider'
import { typedNumber } from '../../../lib/typed-number'
import { refusalText } from '../../../lib/refusal-text'
import { labelOf, NotReady, packCard, usePackT, useWarehouseOptions } from './pack-shared'

type Line = NonNullable<ReturnType<typeof useVariantStock>['data']>['variants'][number]

/** «S, M, L» or «S M L» → ['S','M','L']. */
function valuesOf(text: string): string[] {
  return text
    .split(/[,،\n]+|\s{1,}/)
    .map((v) => v.trim())
    .filter(Boolean)
}

export function VariantStockPanel({
  productId,
  skuPrefix,
}: {
  productId: string
  skuPrefix: string
}) {
  const t = usePackT()
  const toast = useToast()
  const stock = useVariantStock(productId)
  const matrix = useCreateVariantMatrix(productId)
  const move = useMoveVariantStock(productId)
  const warehouses = useWarehouseOptions()

  const [gridOpen, setGridOpen] = useState(false)
  const [axis1, setAxis1] = useState({ name: t('variantStock.size', 'سایز'), values: '' })
  const [axis2, setAxis2] = useState({ name: t('variantStock.colour', 'رنگ'), values: '' })

  const [moving, setMoving] = useState<Line | null>(null)
  const [mode, setMode] = useState<VariantStockMode>('assign')
  const [quantity, setQuantity] = useState('')
  const [warehouseId, setWarehouseId] = useState<string>('')

  const data = stock.data
  const attributeNames = useMemo(
    () => [...new Set((data?.variants ?? []).flatMap((v) => v.attributes.map((a) => a.name)))],
    [data?.variants],
  )
  const [totalsBy, setTotalsBy] = useState<string>('')
  const totalsAttribute = totalsBy || attributeNames[0] || ''
  const totals = useMemo(
    () => (totalsAttribute ? totalsByAttribute(data?.variants ?? [], totalsAttribute) : []),
    [data?.variants, totalsAttribute],
  )

  const createGrid = () => {
    const axes = [axis1, axis2]
      .map((a) => ({ name: a.name.trim(), values: valuesOf(a.values) }))
      .filter((a) => a.name && a.values.length > 0)
    if (axes.length === 0) return
    matrix.mutate(
      { axes, skuPrefix: skuPrefix || 'SKU' },
      {
        onSuccess: (result) => {
          toast.success(`${t('variantStock.gridDone', 'مدل ساخته شد')}: ${result.created}`)
          setGridOpen(false)
        },
        onError: (error) =>
          toast.error(
            refusalText(
              error,
              t,
              'variantStock',
              [
                'VARIANT_MATRIX_TOO_LARGE',
                'VARIANT_MATRIX_DUPLICATE_VALUE',
                'CAPABILITY_NOT_ENABLED',
              ],
              t('variantStock.gridFailed', 'جدول مدل‌ها ساخته نشد'),
            ),
          ),
      },
    )
  }

  const amount = typedNumber(quantity)
  const needsWarehouse = warehouses.length > 0 && !warehouseId
  const submitMove = () => {
    if (!moving || amount === null || amount <= 0 || needsWarehouse) return
    move.mutate(
      {
        variantId: moving.variantId,
        mode,
        quantity: amount,
        ...(warehouseId ? { warehouseId } : {}),
      },
      {
        onSuccess: () => {
          toast.success(t('variantStock.moved', 'موجودی مدل ثبت شد'))
          setMoving(null)
          setQuantity('')
        },
        onError: (error) =>
          toast.error(
            refusalText(
              error,
              t,
              'variantStock',
              [
                'VARIANT_STOCK_NOT_ENOUGH_UNASSIGNED',
                'VARIANT_STOCK_NOT_ENOUGH',
                'VARIANT_STOCK_NOT_READY',
                'PRODUCT_WAREHOUSE_REQUIRED',
              ],
              t('variantStock.moveFailed', 'موجودی مدل ثبت نشد'),
            ),
          ),
      },
    )
  }

  const columns: TableColumn<Line>[] = [
    {
      id: 'variant',
      labelKey: 'variantStock.variant',
      labelFallback: 'مدل',
      locked: true,
      render: (row) => (
        <span>
          {row.attributes.map((a) => a.value).join(' · ') || row.sku}
          <span className="ms-2 font-mono text-xs text-[hsl(var(--fg-tertiary))]">{row.sku}</span>
        </span>
      ),
    },
    {
      id: 'onHand',
      labelKey: 'variantStock.onHand',
      labelFallback: 'موجودی',
      align: 'end',
      sortValue: (row) => row.onHand,
      render: (row) => (
        <span className={row.onHand < 0 ? 'text-[hsl(var(--color-destructive))]' : ''}>
          {row.onHand}
        </span>
      ),
    },
    {
      id: 'atp',
      labelKey: 'variantStock.atp',
      labelFallback: 'قابل فروش (ATP)',
      align: 'end',
      render: (row) => {
        const holds = data?.reservations ?? []
        const reserved = holds
          .filter((h) => h.variantId === row.variantId && h.status === 'active')
          .reduce((s, h) => s + h.quantity, 0)
        const atpAvailable =
          checkVariantAtpAvailability({
            demands: [
              {
                variantId: row.variantId,
                warehouseId: row.byWarehouse[0]?.warehouseId ?? 'default',
                quantity: 1,
              },
            ],
            stock: row.byWarehouse.map((w) => ({
              variantId: row.variantId,
              warehouseId: w.warehouseId ?? 'default',
              quantity: w.quantity,
            })),
            activeReservations: holds,
          }) === null
        const atpQty = Math.max(0, row.onHand - reserved)
        return (
          <span
            className={
              !atpAvailable
                ? 'text-[hsl(var(--color-warning))] font-medium'
                : 'text-[hsl(var(--fg-primary))]'
            }
          >
            {atpQty}
            {reserved > 0 ? ` (${t('variantStock.reserved', 'رزرو')}: ${reserved})` : ''}
          </span>
        )
      },
    },
    {
      id: 'byWarehouse',
      labelKey: 'variantStock.byWarehouse',
      labelFallback: 'در انبارها',
      showFrom: 'md',
      render: (row) =>
        row.byWarehouse.length === 0
          ? '—'
          : row.byWarehouse.map((w) => (
              <span key={w.warehouseId ?? 'none'} className="me-2 whitespace-nowrap text-xs">
                {w.warehouseId
                  ? labelOf(warehouses, w.warehouseId)
                  : t('variantStock.noWarehouse', 'بدون انبار')}
                : {w.quantity}
              </span>
            )),
    },
    {
      id: 'sold',
      labelKey: 'variantStock.sold',
      labelFallback: 'فروخته‌شده',
      align: 'end',
      sortValue: (row) => row.sold,
      render: (row) => row.sold,
    },
    {
      id: 'actions',
      labelKey: 'variantStock.actions',
      labelFallback: 'کار',
      locked: true,
      render: (row) => (
        <Button size="sm" variant="outline" onClick={() => setMoving(row)}>
          <PackagePlus className="h-4 w-4" aria-hidden />
          {t('variantStock.move', 'موجودی')}
        </Button>
      ),
    },
  ]

  return (
    <section className={packCard} data-guide="variant-stock">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
            {t('variantStock.title', 'مدل‌ها (سایز و رنگ) و موجودی هر مدل')}
          </h3>
          {data?.ready ? (
            <p className="text-xs text-[hsl(var(--fg-secondary))]">
              {t('variantStock.total', 'موجودی کل کالا')}: {data.productOnHand} —{' '}
              {t('variantStock.unassigned', 'روی هیچ مدلی نیست')}: {data.unassigned}
            </p>
          ) : null}
        </div>
        <Button size="sm" variant="outline" onClick={() => setGridOpen((v) => !v)}>
          <Grid3x3 className="h-4 w-4" aria-hidden />
          {t('variantStock.grid', 'ساخت جدول سایز و رنگ')}
        </Button>
      </div>

      {gridOpen ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[[axis1, setAxis1] as const, [axis2, setAxis2] as const].map(
            ([axis, setAxis], index) => (
              <div key={index} className="space-y-1 text-sm">
                <Input
                  name={`axis${index}Name`}
                  value={axis.name}
                  onChange={(e) => setAxis({ ...axis, name: e.target.value })}
                  aria-label={t('variantStock.axisName', 'نام ویژگی')}
                />
                <Input
                  name={`axis${index}Values`}
                  value={axis.values}
                  placeholder={
                    index === 0 ? 'S M L XL' : t('variantStock.colourExample', 'مشکی سفید')
                  }
                  onChange={(e) => setAxis({ ...axis, values: e.target.value })}
                  aria-label={t('variantStock.axisValues', 'مقدارها (با فاصله یا ویرگول)')}
                />
              </div>
            ),
          )}
          <div className="sm:col-span-2 flex items-center justify-between gap-2">
            <p className="text-xs text-[hsl(var(--fg-secondary))]">
              {t(
                'variantStock.gridHint',
                'هر ترکیب یک مدل با کد جدا می‌شود؛ مدل‌هایی که از قبل هست تکرار نمی‌شوند.',
              )}
            </p>
            <Button size="sm" onClick={createGrid} disabled={matrix.isPending}>
              {t('variantStock.createGrid', 'ساخت مدل‌ها')}
            </Button>
          </div>
        </div>
      ) : null}

      {stock.isError ? (
        <p role="alert" className="mt-3 text-sm text-[hsl(var(--color-destructive))]">
          {t('variantStock.loadFailed', 'موجودی مدل‌ها خوانده نشد؛ این «صفر» نیست.')}
        </p>
      ) : data && !data.ready ? (
        <div className="mt-3">
          <NotReady t={t} migration="variant-stock-01" />
        </div>
      ) : data && data.variants.length > 0 ? (
        <div className="mt-4 space-y-4">
          <DataTable
            tableId="variant-stock"
            t={t}
            rows={data.variants}
            columns={columns}
            rowKey={(row) => row.variantId}
          />
          {attributeNames.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-[hsl(var(--fg-secondary))]">
                  {t('variantStock.totalsBy', 'جمع بر اساس')}
                </span>
                <SelectField
                  name="totalsBy"
                  value={totalsAttribute}
                  onChange={setTotalsBy}
                  options={attributeNames.map((name) => ({ value: name, label: name }))}
                />
              </div>
              <ul className="flex flex-wrap gap-2 text-xs">
                {totals.map((row) => (
                  <li
                    key={row.value}
                    className="rounded-lg border border-[hsl(var(--border-default))] px-2 py-1"
                  >
                    <b>{row.value}</b> — {t('variantStock.onHand', 'موجودی')} {row.onHand} ·{' '}
                    {t('variantStock.sold', 'فروخته‌شده')} {row.sold}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : data ? (
        <p className="mt-3 text-sm text-[hsl(var(--fg-secondary))]">
          {t('variantStock.none', 'این کالا هنوز مدلی ندارد. با «ساخت جدول سایز و رنگ» شروع کنید.')}
        </p>
      ) : null}

      {moving ? (
        <div className="mt-4 grid gap-3 rounded-xl border border-[hsl(var(--border-default))] p-3 sm:grid-cols-4">
          <p className="sm:col-span-4 text-sm font-medium">
            {moving.attributes.map((a) => a.value).join(' · ') || moving.sku}
          </p>
          <SelectField
            name="mode"
            value={mode}
            onChange={(v) => setMode(v as VariantStockMode)}
            options={VARIANT_STOCK_MODES.map((value) => ({
              value,
              label: t(`variantStock.modes.${value}`, value),
            }))}
          />
          <Input
            name="quantity"
            inputMode="decimal"
            value={quantity}
            placeholder={t('variantStock.quantity', 'تعداد')}
            onChange={(e) => setQuantity(e.target.value)}
          />
          {warehouses.length > 0 ? (
            <SelectField
              name="warehouseId"
              value={warehouseId}
              placeholder={t('variantStock.pickWarehouse', 'انبار')}
              onChange={setWarehouseId}
              options={warehouses}
            />
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={submitMove} disabled={move.isPending || needsWarehouse}>
              {t('variantStock.save', 'ثبت')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMoving(null)}>
              {t('variantStock.cancel', 'انصراف')}
            </Button>
          </div>
          <p className="sm:col-span-4 text-xs text-[hsl(var(--fg-secondary))]">
            {t(`variantStock.modeHint.${mode}`, '')}
          </p>
        </div>
      ) : null}
    </section>
  )
}
