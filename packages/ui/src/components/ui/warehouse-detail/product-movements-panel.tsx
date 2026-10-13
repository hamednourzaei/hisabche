'use client'

// ============================================
// «افزایش و کاهش موجودی» — every movement of ONE product, on its own page.
//
// The product page said how much there is and where; it never said how it got
// there. This is the same history the warehouse list opens in a drawer
// (`useStockHistory`, the server's own running balance), as a table: each
// purchase, sale, transfer, production and adjustment, the warehouse it
// touched, and the stock after it.
//
// ⚠️ NOTHING IS ADDED UP HERE. The balance after each row is the server's. A
// history the server cut short is SAID to be cut short — the oldest rows are
// then missing, and the table must not read as the whole story.
// ⚠️ A NEGATIVE BALANCE IS SHOWN AS ONE: it is a recorded shortfall.
// ============================================

import { useMemo } from 'react'
import Link from 'next/link'
import { useStockHistory, useStockPlacement, type StockMovementRecord } from '@hisabche/api'
import { formatNumber } from '@hisabche/formatting'
import { localizePath } from '@hisabche/ui-contract'

import { routeForEntity } from '../../../lib/entity-route'
import { useDateFormat } from '../../../hooks/use-date-format'
import { useIntlLocale } from '../../../hooks/use-intl-locale'
import { useRouteLang } from '../../../hooks/use-locale-push'
import { Button } from '../button'
import { DataTable, type TableColumn } from '../data-table'

type T = (key: string, fallback?: string) => string

/** Movement types the screen has a word for. Anything else is shown as sent. */
export const MOVEMENT_TYPES = [
  'sale',
  'purchase',
  'production',
  'transfer',
  'adjustment',
  'opening',
] as const

export function ProductMovementsPanel({ t, productId }: { t: T; productId: string }) {
  const history = useStockHistory(productId)
  const placement = useStockPlacement()
  const { dateTime } = useDateFormat()
  const locale = useIntlLocale()
  const lang = useRouteLang()

  const warehouseName = useMemo(
    () => new Map((placement.data?.warehouses ?? []).map((row) => [row.id, row.name])),
    [placement.data],
  )
  // Newest first for reading; the balance was computed oldest-first on the
  // server, so reversing changes the order shown and no figure.
  const rows = useMemo(() => [...(history.data?.movements ?? [])].reverse(), [history.data])

  const typeWord = (type: string) =>
    (MOVEMENT_TYPES as readonly string[]).includes(type)
      ? t(`warehouse.movementType.${type}`, type)
      : type
  const placeOf = (movement: StockMovementRecord) => {
    const from = movement.fromWarehouseId ? warehouseName.get(movement.fromWarehouseId) : undefined
    const to = movement.toWarehouseId ? warehouseName.get(movement.toWarehouseId) : undefined
    if (from && to) return `${from} ← ${to}`
    return to ?? from ?? null
  }

  const columns = useMemo<TableColumn<StockMovementRecord>[]>(
    () => [
      {
        id: 'at',
        labelKey: 'common.date',
        labelFallback: t('common.date', 'تاریخ'),
        sortValue: (movement) => movement.createdAt ?? '',
        render: (movement) => (
          <span className="whitespace-nowrap text-xs text-[hsl(var(--fg-secondary))]">
            {movement.createdAt ? dateTime(movement.createdAt) : '—'}
          </span>
        ),
      },
      {
        id: 'type',
        labelKey: 'common.type',
        labelFallback: t('common.type', 'نوع'),
        locked: true,
        sortValue: (movement) => movement.type,
        render: (movement) => (
          <span>
            <span className="font-medium">{typeWord(movement.type)}</span>
            {/* Which way it went, in a word — never by colour alone. */}
            <span className="ms-2 text-xs text-[hsl(var(--fg-secondary))]">
              {movement.quantity < 0
                ? t('warehouse.movementOut', 'کاهش')
                : t('warehouse.movementIn', 'افزایش')}
            </span>
          </span>
        ),
      },
      {
        id: 'warehouse',
        labelKey: 'warehouse.warehouseName',
        labelFallback: t('warehouse.warehouseName', 'انبار'),
        showFrom: 'md',
        render: (movement) => placeOf(movement) ?? '—',
      },
      {
        id: 'change',
        labelKey: 'warehouse.change',
        labelFallback: t('warehouse.change', 'تغییر'),
        align: 'end',
        locked: true,
        sortValue: (movement) => movement.quantity,
        render: (movement) => (
          <span
            dir="ltr"
            className={
              movement.quantity < 0
                ? 'tabular-nums text-[hsl(var(--color-destructive))]'
                : 'tabular-nums text-[hsl(var(--color-success))]'
            }
          >
            {movement.quantity > 0 ? '+' : ''}
            {formatNumber(movement.quantity, locale, 3)}
          </span>
        ),
      },
      {
        id: 'balance',
        labelKey: 'warehouse.balance',
        labelFallback: t('warehouse.balance', 'مانده'),
        align: 'end',
        render: (movement) => (
          <span dir="ltr" className="tabular-nums">
            {formatNumber(movement.balance, locale, 3)}
          </span>
        ),
      },
      {
        id: 'source',
        labelKey: 'warehouse.source',
        labelFallback: t('warehouse.source', 'مبدأ'),
        showFrom: 'md',
        render: (movement) => {
          const route =
            movement.referenceType && movement.referenceId
              ? routeForEntity(movement.referenceType, movement.referenceId)
              : null
          // A movement with no document (an adjustment, an old sale) is text,
          // not a dead link.
          return route ? (
            <Link
              href={localizePath(route, lang)}
              className="text-[hsl(var(--color-primary))] underline-offset-4 hover:underline"
            >
              {t('common.view', 'مشاهده')}
            </Link>
          ) : (
            <span className="text-[hsl(var(--fg-tertiary))]">{movement.notes || '—'}</span>
          )
        },
      },
    ],
    // `typeWord` and `placeOf` read `t` and `warehouseName`, both listed.
    [t, dateTime, locale, lang, warehouseName],
  )

  const stored = history.data?.storedQuantity
  const summed = history.data?.movementTotal
  // The server returns the most recent movements up to a limit; when what it
  // returned does not add up to the stored quantity, older rows are missing
  // (or the two really disagree). Either way it is said.
  const incomplete =
    !history.isLoading &&
    typeof stored === 'number' &&
    typeof summed === 'number' &&
    stored !== summed

  return (
    <section
      className="space-y-3 rounded-2xl border border-[hsl(var(--border-default))] p-4"
      data-product-movements
    >
      <div>
        <h3 className="font-semibold text-[hsl(var(--fg-primary))]">
          {t('warehouse.movementsTitle', 'افزایش و کاهش موجودی')}
        </h3>
        <p className="mt-0.5 text-xs text-[hsl(var(--fg-secondary))]">
          {t(
            'warehouse.movementsHint',
            'هر خرید، فروش، انتقال، تولید و تعدیلِ این کالا، با موجودی بعد از آن.',
          )}
        </p>
      </div>

      {history.isLoading ? (
        <p className="text-sm text-[hsl(var(--fg-secondary))]">
          {t('common.loading', 'در حال بارگذاری…')}
        </p>
      ) : history.error || !history.data ? (
        // A failed read is not «no movements».
        <div className="space-y-2">
          <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
            {t('warehouse.movementsFailed', 'تاریخچه‌ی موجودی خوانده نشد.')}
          </p>
          <Button size="sm" variant="outline" onClick={() => void history.refetch()}>
            {t('common.retry', 'تلاش دوباره')}
          </Button>
        </div>
      ) : (
        <>
          {incomplete ? (
            <p role="alert" className="text-xs text-[hsl(var(--color-warning))]" data-movements-gap>
              {t(
                'warehouse.movementsGap',
                'جمع این حرکت‌ها با موجودی ثبت‌شده یکی نیست؛ ممکن است حرکت‌های قدیمی‌تر در این فهرست نباشند.',
              )}{' '}
              <span dir="ltr" className="tabular-nums">
                {stored} ≠ {summed}
              </span>
            </p>
          ) : null}
          <DataTable
            tableId="product-movements"
            t={t}
            rows={rows}
            columns={columns}
            rowKey={(movement) => movement.id}
            minWidthClass="min-w-[420px]"
            emptyState={
              <p className="p-6 text-center text-sm text-[hsl(var(--fg-secondary))]">
                {t('warehouse.noMovements', 'هیچ حرکتی برای این کالا ثبت نشده است.')}
              </p>
            }
          />
        </>
      )}
    </section>
  )
}
