'use client'

// ============================================
// packages/ui/src/components/ui/inventory-ops/inventory-ops-view.tsx
//
// T11 — the screens for backend that had none.
//
// L3 reorder suggestions · L4 dead stock · M3 shift history ·
// N3 cash forecast · N4 stale opportunities.
//
// ---------------------------------------------------------------------------
// ⚠️ EVERY FIGURE HERE IS THE SERVER'S, NOT THIS FILE'S
//
// Each of these endpoints computes something with a real domain behind it —
// reorder points from consumption, dead stock from last movement, a cash
// forecast from scheduled receipts and payables. None of it is recomputed
// here, and none of it is estimated when a field is missing.
//
// That matters most for the forecast: a projected shortfall is a number
// someone may act on by delaying a payment, and a client-side approximation
// of it would be indistinguishable from the real one.
//
// ⚠️ A missing value renders as «—», never as zero. Zero is a real answer
// («nothing is overdue») and using it for «not known» makes a gap in the data
// look like good news.
// ============================================

import * as React from 'react'

import { AlertTriangle, Boxes, Clock, TrendingDown, Wallet } from 'lucide-react'

import {
  useCashForecast,
  useDeadStock,
  useReorderSuggestions,
  useShiftHistory,
  useStaleOpportunities,
} from '@hisabche/api'

import { EmptyState } from '../empty-state'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../table'
import { KpiCard } from '../kpi-card'
import { cn } from '../../../lib/utils'

export interface InventoryOpsViewProps {
  t?: ((key: string, fallback?: string) => string) | undefined
  fmtMoney: (value: number) => string
  fmtDate: (value: string) => string
}

/** «—», never 0. See the header. */
function orDash(value: number | null | undefined, format: (value: number) => string): string {
  return value === null || value === undefined ? '—' : format(value)
}

const card =
  'rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4'

export function InventoryOpsView({ t, fmtMoney, fmtDate }: InventoryOpsViewProps) {
  const tr = (key: string, fallback: string) => (t ? t(key, fallback) : fallback)

  const reorder = useReorderSuggestions()
  const deadStock = useDeadStock()
  const shifts = useShiftHistory()
  const forecast = useCashForecast()
  const stale = useStaleOpportunities()

  const num = (value: number) => value.toLocaleString('fa-AF')

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* ── N3 · cash forecast ─────────────────────────────────────── */}
      <section className={card}>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[hsl(var(--fg-primary))]">
          <Wallet className="size-4 text-[hsl(var(--color-primary))]" aria-hidden="true" />
          {tr('ops.cashForecast', 'پیش‌بینی نقدینگی')}
        </h2>

        {forecast.data ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <KpiCard
              label={tr('ops.openingBalance', 'موجودی فعلی')}
              value={fmtMoney(forecast.data.openingBalance)}
            />

            <KpiCard
              label={tr('ops.daysProjected', 'روزهای پیش‌بینی')}
              value={num(forecast.data.days.length)}
            />

            {/* ⚠️ null means «no shortfall in the projected window», which is
                good news and must not read like missing data — so the red is
                on the DATE, never on «کسری ندارد». */}
            <KpiCard
              label={tr('ops.firstShortfall', 'اولین کسری')}
              value={
                forecast.data.firstShortfallDate ? (
                  <span className="text-[hsl(var(--color-destructive))]">
                    {fmtDate(forecast.data.firstShortfallDate)}
                  </span>
                ) : (
                  tr('ops.noShortfall', 'کسری ندارد')
                )
              }
            />
          </div>
        ) : (
          <p className="text-sm text-[hsl(var(--fg-tertiary))]">
            {forecast.isLoading
              ? tr('common.loading', 'در حال بارگذاری…')
              : tr('ops.noForecast', 'داده‌ای برای پیش‌بینی نیست')}
          </p>
        )}
      </section>

      {/* ── L3 · reorder suggestions ───────────────────────────────── */}
      <section className={card}>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[hsl(var(--fg-primary))]">
          <Boxes className="size-4 text-[hsl(var(--color-primary))]" aria-hidden="true" />
          {tr('ops.reorder', 'پیشنهاد سفارش')}
        </h2>

        {(reorder.data ?? []).length === 0 ? (
          <EmptyState
            title={tr('ops.reorderEmpty', 'هیچ کالایی به نقطه‌ی سفارش نرسیده')}
            description={tr('ops.reorderEmptyHint', 'موجودی همه‌ی کالاها بالای حد تعیین‌شده است.')}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tr('ops.product', 'کالا')}</TableHead>
                <TableHead>{tr('ops.onHand', 'موجودی')}</TableHead>
                <TableHead>{tr('ops.reorderLevel', 'نقطه‌ی سفارش')}</TableHead>
                <TableHead>{tr('ops.suggested', 'پیشنهاد')}</TableHead>
                <TableHead>{tr('ops.daysOfCover', 'کفایت (روز)')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(reorder.data ?? []).map((item) => (
                <TableRow key={item.productId}>
                  <TableCell>{item.productName}</TableCell>
                  <TableCell className="tabular-nums">{num(item.onHand)}</TableCell>
                  <TableCell className="tabular-nums">{num(item.reorderLevel)}</TableCell>
                  <TableCell className="font-semibold tabular-nums">
                    {num(item.suggestedQuantity)}
                  </TableCell>
                  <TableCell className="tabular-nums">{orDash(item.daysOfCover, num)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {/* ── L4 · dead stock ────────────────────────────────────────── */}
      <section className={card}>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[hsl(var(--fg-primary))]">
          <TrendingDown className="size-4 text-[hsl(var(--color-warning))]" aria-hidden="true" />
          {tr('ops.deadStock', 'کالای راکد')}
        </h2>

        {(deadStock.data ?? []).length === 0 ? (
          <EmptyState
            title={tr('ops.deadStockEmpty', 'کالای راکدی نیست')}
            description={tr('ops.deadStockEmptyHint', 'همه‌ی کالاها اخیراً حرکت داشته‌اند.')}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tr('ops.product', 'کالا')}</TableHead>
                <TableHead>{tr('ops.onHand', 'موجودی')}</TableHead>
                <TableHead>{tr('ops.stockValue', 'ارزش (به قیمت تمام‌شده)')}</TableHead>
                <TableHead>{tr('ops.lastMovement', 'آخرین حرکت')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(deadStock.data ?? []).map((item) => (
                <TableRow key={item.productId}>
                  <TableCell>{item.productName}</TableCell>
                  <TableCell className="tabular-nums">{num(item.onHand)}</TableCell>
                  <TableCell className="tabular-nums">{fmtMoney(item.stockValue)}</TableCell>
                  <TableCell>
                    {item.lastMovementAt
                      ? fmtDate(item.lastMovementAt)
                      : // A product that has NEVER moved is not the same as one
                        // whose date is unknown, and both differ from «today».
                        tr('ops.neverMoved', 'هرگز حرکت نکرده')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {/* ── M3 · shift history ─────────────────────────────────────── */}
      <section className={card}>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[hsl(var(--fg-primary))]">
          <Clock className="size-4 text-[hsl(var(--color-primary))]" aria-hidden="true" />
          {tr('ops.shiftHistory', 'تاریخچه‌ی شیفت‌ها')}
        </h2>

        {(shifts.data ?? []).length === 0 ? (
          <EmptyState title={tr('ops.shiftsEmpty', 'هنوز شیفتی بسته نشده')} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tr('ops.opened', 'باز شد')}</TableHead>
                <TableHead>{tr('ops.closed', 'بسته شد')}</TableHead>
                <TableHead>{tr('ops.expected', 'نقد مورد انتظار')}</TableHead>
                <TableHead>{tr('ops.counted', 'شمرده‌شده')}</TableHead>
                <TableHead>{tr('ops.variance', 'اختلاف')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(shifts.data ?? []).map((shift) => (
                <TableRow key={shift.id}>
                  <TableCell>{fmtDate(shift.openedAt)}</TableCell>
                  <TableCell>
                    {shift.closedAt ? fmtDate(shift.closedAt) : tr('ops.stillOpen', 'باز است')}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {orDash(shift.expectedCashMinor, (v) => fmtMoney(v / 100))}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {orDash(shift.countedCashMinor, (v) => fmtMoney(v / 100))}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'tabular-nums',
                      // A variance of any sign is worth noticing; only exactly
                      // zero is neutral.
                      shift.varianceMinor
                        ? 'font-semibold text-[hsl(var(--color-destructive))]'
                        : undefined,
                    )}
                  >
                    {orDash(shift.varianceMinor, (v) => fmtMoney(v / 100))}
                    {shift.varianceReason ? (
                      <span className="ms-1 text-[10px] text-[hsl(var(--fg-tertiary))]">
                        ({shift.varianceReason})
                      </span>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {/* ── N4 · stale opportunities ───────────────────────────────── */}
      <section className={card}>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[hsl(var(--fg-primary))]">
          <AlertTriangle className="size-4 text-[hsl(var(--color-warning))]" aria-hidden="true" />
          {tr('ops.staleOpportunities', 'فرصت‌های راکد')}
        </h2>

        {(stale.data ?? []).length === 0 ? (
          <EmptyState title={tr('ops.staleEmpty', 'فرصت راکدی نیست')} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tr('ops.opportunity', 'فرصت')}</TableHead>
                <TableHead>{tr('ops.customer', 'مشتری')}</TableHead>
                <TableHead>{tr('ops.stage', 'مرحله')}</TableHead>
                <TableHead>{tr('ops.value', 'ارزش')}</TableHead>
                <TableHead>{tr('ops.daysStale', 'روز بی‌حرکت')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(stale.data ?? []).map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.title}</TableCell>
                  <TableCell>{item.customerName ?? '—'}</TableCell>
                  <TableCell>{item.stage ?? '—'}</TableCell>
                  <TableCell className="tabular-nums">
                    {orDash(item.valueMinor, (v) => fmtMoney(v / 100))}
                  </TableCell>
                  <TableCell className="tabular-nums">{orDash(item.daysStale, num)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  )
}

export default InventoryOpsView
