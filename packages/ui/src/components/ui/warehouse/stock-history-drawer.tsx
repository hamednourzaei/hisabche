'use client'

// ============================================
// packages/ui/src/components/ui/warehouse/stock-history-drawer.tsx
//
// H4 — why this product's on-hand figure is what it is.
//
// ---------------------------------------------------------------------------
// THE NUMBER PEOPLE ARGUE WITH
//
// Phase C made `stock_movements` the source of truth for quantity and
// `products.quantity` a projection maintained by trigger. Inventory is the
// figure a shopkeeper disputes most often, and until now the product screen
// showed the answer with no working: no arrival, no sale, no adjustment, no
// transfer — just a number.
//
// ---------------------------------------------------------------------------
// TWO THINGS THIS DELIBERATELY SHOWS RATHER THAN HIDES
//
//   1. A NEGATIVE ON-HAND. Phase C's own note: «a negative on-hand is a real
//      shortfall that has been recorded rather than clamped to zero, and
//      clamping is how the information gets lost». It renders as a negative.
//
//   2. A PROJECTION THAT DISAGREES with the sum of the movements. The trigger
//      is supposed to keep them equal; a difference means it did not run. That
//      is reported, never quietly corrected (§13) — and it is also what a
//      truncated history looks like, which the message says.
// ============================================

import { AlertTriangle, X } from 'lucide-react'

import { routeForEntity } from '../../../lib/entity-route'
import { cn } from '../../../lib/utils'

export interface StockHistoryMovement {
  id: string
  type: string
  quantity: number
  referenceType: string | null
  referenceId: string | null
  notes: string | null
  createdAt: string | null
  balance: number
}

export interface StockHistoryDrawerProps {
  t: (key: string, fallback: string) => string
  /** `null` closes the drawer. */
  product: { id: string; name: string } | null
  isLoading: boolean
  movements: StockHistoryMovement[]
  movementTotal: number
  storedQuantity: number
  /** Whether the returned history was cut short by the limit. */
  truncated: boolean
  onClose: () => void
  onNavigate?: ((route: string) => void) | undefined
}

/** What each movement type is called, and which way it reads. */
const TYPE_LABEL: Record<string, string> = {
  sale: 'فروش',
  purchase: 'خرید',
  production: 'تولید',
  transfer: 'انتقال',
  adjustment: 'تعدیل',
  opening: 'مانده‌ی اول دوره',
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString('fa-AF')
  } catch {
    return value
  }
}

export function StockHistoryDrawer({
  t,
  product,
  isLoading,
  movements,
  movementTotal,
  storedQuantity,
  truncated,
  onClose,
  onNavigate,
}: StockHistoryDrawerProps) {
  if (!product) return null

  // Compared as numbers, and only when the history is complete. A truncated
  // history ALWAYS disagrees, and warning about it there would cry wolf on
  // every long-lived product.
  const drifted = !truncated && !isLoading && movementTotal !== storedQuantity

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label={product.name}
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-2xl flex-col bg-[hsl(var(--surface-elevated))] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-[hsl(var(--border-default))] px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-[hsl(var(--fg-primary))]">
              {product.name}
            </h2>
            <p className="mt-0.5 text-xs text-[hsl(var(--fg-tertiary))]">
              {t('warehouse.stockHistory', 'تاریخچه‌ی موجودی')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('action.close', 'بستن')}
            className="shrink-0 rounded-full p-2 text-[hsl(var(--fg-secondary))] transition-colors hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]"
          >
            <X className="size-5" />
          </button>
        </header>

        {drifted ? (
          <p
            role="alert"
            className="flex items-start gap-2 border-b border-[hsl(var(--border-default))] bg-[hsl(var(--color-warning)/0.12)] px-5 py-3 text-xs text-[hsl(var(--color-warning))]"
          >
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              {t(
                'warehouse.stockDrift',
                'موجودی ثبت‌شده با مجموع حرکت‌ها یکی نیست — تریگر پروجکشن اجرا نشده است',
              )}
              {': '}
              <span className="tabular-nums">
                {storedQuantity} ≠ {movementTotal}
              </span>
            </span>
          </p>
        ) : null}

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2 p-5">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-10 animate-pulse rounded-lg bg-[hsl(var(--surface-muted))]"
                />
              ))}
            </div>
          ) : movements.length === 0 ? (
            <p className="p-5 text-sm text-[hsl(var(--fg-tertiary))]">
              {t('warehouse.noMovements', 'هیچ حرکتی برای این کالا ثبت نشده است.')}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[hsl(var(--surface-elevated))]">
                <tr className="border-b border-[hsl(var(--border-default))] text-xs text-[hsl(var(--fg-tertiary))]">
                  <th className="px-5 py-2 text-start font-medium">{t('common.date', 'تاریخ')}</th>
                  <th className="px-2 py-2 text-start font-medium">{t('common.type', 'نوع')}</th>
                  <th className="px-2 py-2 text-start font-medium">
                    {t('warehouse.source', 'مبدأ')}
                  </th>
                  <th className="px-2 py-2 text-end font-medium">
                    {t('warehouse.change', 'تغییر')}
                  </th>
                  <th className="px-5 py-2 text-end font-medium">
                    {t('warehouse.balance', 'مانده')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* NEWEST FIRST for reading; the running balance was computed
                    oldest-first on the server, so reversing here changes the
                    order shown and not any figure. */}
                {[...movements].reverse().map((movement) => {
                  const route =
                    movement.referenceType && movement.referenceId
                      ? routeForEntity(movement.referenceType, movement.referenceId)
                      : null

                  return (
                    <tr
                      key={movement.id}
                      className="border-b border-[hsl(var(--border-default)/0.5)] last:border-0"
                    >
                      <td className="px-5 py-2 text-[hsl(var(--fg-secondary))]">
                        {formatDate(movement.createdAt)}
                      </td>
                      <td className="px-2 py-2 text-[hsl(var(--fg-primary))]">
                        {TYPE_LABEL[movement.type] ?? movement.type}
                      </td>
                      <td className="px-2 py-2">
                        {route && onNavigate ? (
                          <button
                            type="button"
                            onClick={() => onNavigate(route)}
                            className="rounded text-[hsl(var(--color-primary))] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]"
                          >
                            {t('common.view', 'مشاهده')}
                          </button>
                        ) : (
                          // A movement whose document is unknown — an
                          // adjustment, or a sale recorded before H4 started
                          // writing `reference_id`. Text, not a dead link.
                          <span className="text-[hsl(var(--fg-tertiary))]">
                            {movement.referenceType ?? '—'}
                          </span>
                        )}
                      </td>
                      <td
                        className={cn(
                          'px-2 py-2 text-end tabular-nums',
                          movement.quantity < 0
                            ? 'text-[hsl(var(--color-destructive))]'
                            : 'text-[hsl(var(--color-success))]',
                        )}
                      >
                        {movement.quantity > 0 ? `+${movement.quantity}` : movement.quantity}
                      </td>
                      <td className="px-5 py-2 text-end font-semibold tabular-nums text-[hsl(var(--fg-primary))]">
                        {movement.balance}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-[hsl(var(--border-default))] px-5 py-3 text-sm">
          <span className="text-[hsl(var(--fg-secondary))]">
            {t('warehouse.onHand', 'موجودی فعلی')}
          </span>
          {/* Negative is shown as negative. Clamping to zero is how a real
              shortfall stops being visible — Phase C, lesson 15. */}
          <span
            className={cn(
              'font-semibold tabular-nums',
              storedQuantity < 0
                ? 'text-[hsl(var(--color-destructive))]'
                : 'text-[hsl(var(--fg-primary))]',
            )}
          >
            {storedQuantity}
          </span>
        </footer>
      </div>
    </div>
  )
}
