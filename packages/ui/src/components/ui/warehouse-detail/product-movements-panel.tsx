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
//
// The type and the direction are two columns (owner, 17 October 2026): «خرید»
// and «افزایش» are different questions — what happened, and which way it moved
// — and one glued cell answered both at once. The money journey, which reads
// the same movements from the money side, is mounted INSIDE this card.
//
// The export writes the same rows this table shows: Excel (.xlsx) and
// Markdown, built from `movement-export.ts`, so the file and the screen cannot
// disagree. An export is the whole loaded history, not only what a search
// narrowed down.
// ============================================

import { useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { FileSpreadsheet, FileText } from 'lucide-react'
import { useStockHistory, useStockPlacement, type StockMovementRecord } from '@hisabche/api'
import { formatNumber, type XlsxSheet } from '@hisabche/formatting'
import { localizePath } from '@hisabche/ui-contract'

import { routeForEntity } from '../../../lib/entity-route'
import { exportToMarkdown, exportToXlsx } from '../../../lib/export'
import {
  movementDirectionWord,
  movementExportFilename,
  movementExportMarkdown,
  movementExportRecords,
  movementExportTable,
  movementPlace,
  movementTypeWord,
} from '../../../lib/warehouse/movement-export'
import { useDateFormat } from '../../../hooks/use-date-format'
import { useIntlLocale } from '../../../hooks/use-intl-locale'
import { useRouteLang } from '../../../hooks/use-locale-push'
import { Button } from '../button'
import { FOCUS_RING } from '../focus-ring'
import { cn } from '../../../lib/utils'
import { DataTable, matchesSearch, type TableColumn } from '../data-table'

type T = (key: string, fallback?: string) => string

// The catalogue of movement types lives with the export, so the screen and the
// file name each type in the same words. Re-exported: callers imported it here.
export { MOVEMENT_TYPES } from '../../../lib/warehouse/movement-export'

export function ProductMovementsPanel({
  t,
  productId,
  productName = '',
  journey,
}: {
  t: T
  productId: string
  /** The product's own name — the export is filed under it. */
  productName?: string | undefined
  /** The money journey block, mounted inside this card (composed by the container). */
  journey?: ReactNode
}) {
  const history = useStockHistory(productId)
  const placement = useStockPlacement()
  const { dateTime } = useDateFormat()
  const locale = useIntlLocale()
  const lang = useRouteLang()
  const [search, setSearch] = useState('')

  const warehouseName = useMemo(
    () => new Map((placement.data?.warehouses ?? []).map((row) => [row.id, row.name])),
    [placement.data],
  )
  // Newest first for reading; the balance was computed oldest-first on the
  // server, so reversing changes the order shown and no figure.
  const rows = useMemo(() => [...(history.data?.movements ?? [])].reverse(), [history.data])

  const title = t('warehouse.movementsTitle', 'افزایش و کاهش موجودی')

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
          <span className="font-medium">{movementTypeWord(movement.type, t)}</span>
        ),
      },
      {
        id: 'direction',
        labelKey: 'warehouse.direction',
        labelFallback: t('warehouse.direction', 'جهت'),
        locked: true,
        render: (movement) => (
          // Which way it went, in a word — never by colour alone.
          <span className="text-xs text-[hsl(var(--fg-secondary))]">
            {movementDirectionWord(movement.quantity, t, movement.isTransfer)}
          </span>
        ),
      },
      {
        id: 'warehouse',
        labelKey: 'warehouse.warehouseName',
        labelFallback: t('warehouse.warehouseName', 'انبار'),
        showFrom: 'md',
        render: (movement) => movementPlace(movement, warehouseName) ?? '—',
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
            className={cn(
              'tabular-nums',
              movement.isTransfer
                ? 'text-[hsl(var(--fg-tertiary))]'
                : movement.quantity < 0
                  ? 'text-[hsl(var(--color-destructive))]'
                  : 'text-[hsl(var(--color-success))]',
            )}
          >
            {movement.quantity > 0 && !movement.isTransfer ? '+' : ''}
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
    // `movementTypeWord`/`movementPlace` read `t` and `warehouseName`, both listed.
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
  const gapText = t(
    'warehouse.movementsGap',
    'جمع این حرکت‌ها با موجودی ثبت‌شده یکی نیست؛ ممکن است حرکت‌های قدیمی‌تر در این فهرست نباشند.',
  )

  // A search narrows the SCREEN only; the exports stay the whole history.
  const shown = useMemo(() => {
    if (!search.trim()) return rows
    return rows.filter((movement) =>
      matchesSearch(search, [
        movementTypeWord(movement.type, t),
        movementDirectionWord(movement.quantity, t, movement.isTransfer),
        movementPlace(movement, warehouseName) ?? '',
        movement.notes ?? '',
        movement.referenceType ?? '',
        movement.quantity,
        movement.balance,
      ]),
    )
  }, [rows, search, t, warehouseName])

  const table = useMemo(
    () => movementExportTable(rows, { t, dateTime, warehouseNames: warehouseName }),
    [rows, t, dateTime, warehouseName],
  )

  const exportExcel = () => {
    if (table.rows.length === 0) return
    const sheets: XlsxSheet[] = [{ name: title, rows: movementExportRecords(table) }]
    if (incomplete) {
      // The same warning the table carries: a file must not read as the whole
      // story either.
      const note = t('warehouse.exportNote', 'یادداشت')
      sheets.push({ name: note, rows: [{ [note]: gapText }] })
    }
    exportToXlsx(sheets, movementExportFilename(productName, new Date()))
  }

  const exportMarkdown = () => {
    if (table.rows.length === 0) return
    exportToMarkdown(
      movementExportMarkdown(table, { title, productName, warning: incomplete ? gapText : '' }),
      movementExportFilename(productName, new Date()),
    )
  }

  return (
    <section
      className="space-y-3 rounded-2xl border border-[hsl(var(--border-default))] p-4"
      data-product-movements
    >
      <div>
        <h3 className="font-semibold text-[hsl(var(--fg-primary))]">{title}</h3>
        <p className="mt-0.5 text-xs text-[hsl(var(--fg-secondary))]">
          {t(
            'warehouse.movementsHint',
            'هر خرید، فروش، انتقال، تولید و تعدیلِ این کالا، با موجودی بعد از آن.',
          )}
        </p>
      </div>

      {/* The money side of the same movements (owner, 17 October 2026). */}
      {journey}

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
              {gapText}{' '}
              <span dir="ltr" className="tabular-nums">
                {stored} ≠ {summed}
              </span>
            </p>
          ) : null}
          <DataTable
            tableId="product-movements"
            t={t}
            rows={shown}
            columns={columns}
            rowKey={(movement) => movement.id}
            minWidthClass="min-w-[480px]"
            searchValue={search}
            onSearchChange={setSearch}
            actions={
              <div className="flex items-center gap-1.5">
                <ExportButton
                  label={t('warehouse.exportExcel', 'Excel')}
                  icon={<FileSpreadsheet className="size-4" aria-hidden="true" />}
                  onClick={exportExcel}
                  disabled={rows.length === 0}
                />
                <ExportButton
                  label={t('warehouse.exportMarkdown', 'Markdown')}
                  icon={<FileText className="size-4" aria-hidden="true" />}
                  onClick={exportMarkdown}
                  disabled={rows.length === 0}
                />
              </div>
            }
            emptyState={
              <p className="p-6 text-center text-sm text-[hsl(var(--fg-secondary))]">
                {search.trim() && rows.length > 0
                  ? // A search that found nothing is not «this product never moved».
                    t('warehouse.movementsNoMatch', 'چیزی با این جستجو پیدا نشد.')
                  : t('warehouse.noMovements', 'هیچ حرکتی برای این کالا ثبت نشده است.')}
              </p>
            }
          />
        </>
      )}
    </section>
  )
}

/** An export control, the same square shape as the table's own icons. */
function ExportButton({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string
  icon: ReactNode
  onClick: () => void
  disabled: boolean
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-xl',
        'border border-[hsl(var(--border-default))]',
        'text-[hsl(var(--fg-secondary))]',
        'hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]',
        FOCUS_RING,
        'transition-colors duration-150 motion-reduce:transition-none',
        'disabled:cursor-not-allowed disabled:opacity-40',
      )}
    >
      {icon}
    </button>
  )
}
