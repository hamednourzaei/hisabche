'use client'

// ============================================
// packages/ui/src/components/ui/cycle-count/cycle-count-view.tsx
//
// T11 / L2 — counting the shelves.
//
// ---------------------------------------------------------------------------
// WHY THIS SCREEN EXISTS AT ALL
//
// Stock on hand is a projection of what actually moved, and it cannot be typed
// over. So when the shelf disagrees with the system, the ONLY correct fix is a
// count: it records the difference as an adjustment, with a value, and leaves
// the evidence of what happened.
//
// The service and five routes shipped in phase L2 and had no caller. Without
// this screen there was no way to correct stock at all.
//
// ---------------------------------------------------------------------------
// ⚠️ COMPLETING A COUNT MOVES MONEY, AND THE SCREEN SAYS SO BEFORE IT HAPPENS
//
// A shortage is stock that left the business without being sold — it is
// written off at what it cost. That is a financial event, not a data tidy-up.
// The confirm step shows the variance and its value first, because someone
// clicking «complete» on a mistyped count is writing off real money.
//
// ---------------------------------------------------------------------------
// ⚠️ AN UNCOUNTED LINE IS NOT A ZERO
//
// `counted_qty` is null until somebody has actually looked at that shelf.
// Rendering null as 0 would show a full shortage for every line nobody has
// reached yet, and completing on that reading would write off the whole
// warehouse. Null is shown as «—» and is excluded from the totals.
// ============================================

import * as React from 'react'

import { AlertTriangle, ClipboardList } from 'lucide-react'

import type { CycleCount, CycleCountLine } from '@hisabche/api'

import { Badge } from '../badge'
import { Button } from '../button'
import { EmptyState } from '../empty-state'
import { Input } from '../input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../table'
import { cn } from '../../../lib/utils'

export interface CycleCountViewProps {
  t: (key: string, fallback?: string) => string
  fmtMoney: (value: number) => string
  fmtDate: (value: string) => string
  /** Resolves a product id to a name — the count endpoint returns ids only. */
  productName: (productId: string) => string
  counts: CycleCount[]
  activeCount: CycleCount | null
  isLoading?: boolean | undefined
  isBusy?: boolean | undefined
  error?: string | null | undefined
  onOpenCount: (countId: string) => void
  onRecord: (productId: string, countedQty: number) => void
  onComplete: () => void
  onCancel: (reason: string) => void
}

/** Uses the Badge component's own variants — no parallel tone vocabulary. */
const STATUS_VARIANT: Record<string, 'secondary' | 'warning' | 'success' | 'outline'> = {
  draft: 'secondary',
  counting: 'warning',
  completed: 'success',
  cancelled: 'outline',
}

/** Lines somebody has actually counted. Null is «not yet», not zero. */
function countedLines(lines: CycleCountLine[]): CycleCountLine[] {
  return lines.filter((line) => line.counted_qty !== null)
}

export function CycleCountView({
  t,
  fmtMoney,
  fmtDate,
  productName,
  counts,
  activeCount,
  isLoading,
  isBusy,
  error,
  onOpenCount,
  onRecord,
  onComplete,
  onCancel,
}: CycleCountViewProps) {
  const [confirming, setConfirming] = React.useState(false)

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-2xl bg-[hsl(var(--surface-muted))]" />
  }

  const lines = activeCount?.lines ?? []
  const done = countedLines(lines)
  const remaining = lines.length - done.length

  return (
    <div className="space-y-5 sm:space-y-6">
      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-[hsl(var(--color-destructive)/0.4)] bg-[hsl(var(--color-destructive)/0.08)] p-3 text-sm text-[hsl(var(--color-destructive))]"
        >
          {error}
        </p>
      ) : null}

      {/* ── The counts ─────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[hsl(var(--fg-primary))]">
          <ClipboardList className="size-4 text-[hsl(var(--color-primary))]" aria-hidden="true" />
          {t('cycleCount.title', 'شمارش انبار')}
        </h2>

        {counts.length === 0 ? (
          <EmptyState
            title={t('cycleCount.empty', 'هنوز شمارشی باز نشده')}
            description={t(
              'cycleCount.emptyHint',
              'وقتی موجودی با قفسه نمی‌خواند، شمارش راه درست اصلاح است.',
            )}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('cycleCount.number', 'شماره')}</TableHead>
                <TableHead>{t('cycleCount.status', 'وضعیت')}</TableHead>
                <TableHead>{t('cycleCount.started', 'شروع')}</TableHead>
                <TableHead>{t('cycleCount.netLoss', 'خالص زیان')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {counts.map((count) => (
                <TableRow key={count.id}>
                  <TableCell>{count.count_number ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[count.status] ?? 'secondary'}>
                      {t(`cycleCount.status_${count.status}`, count.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>{count.started_at ? fmtDate(count.started_at) : '—'}</TableCell>
                  <TableCell className="tabular-nums">
                    {/* Null means «not priced yet» — the count is still open.
                        Showing 0 would read as «no loss found». */}
                    {count.net_loss === null ? '—' : fmtMoney(count.net_loss)}
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => onOpenCount(count.id)}>
                      {t('cycleCount.open', 'باز کردن')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {/* ── The open count ─────────────────────────────────────────── */}
      {activeCount ? (
        <section className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
              {activeCount.count_number ?? t('cycleCount.title', 'شمارش انبار')}
            </h2>
            <span className="text-xs text-[hsl(var(--fg-tertiary))]">
              {t('cycleCount.progress', 'شمرده‌شده')}: {done.length} / {lines.length}
            </span>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('cycleCount.product', 'کالا')}</TableHead>
                <TableHead>{t('cycleCount.expected', 'انتظار')}</TableHead>
                <TableHead>{t('cycleCount.counted', 'شمرده‌شده')}</TableHead>
                <TableHead>{t('cycleCount.variance', 'اختلاف')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line) => (
                <CountLineRow
                  key={line.id}
                  t={t}
                  line={line}
                  productName={productName}
                  disabled={Boolean(isBusy) || activeCount.status === 'completed'}
                  onRecord={onRecord}
                />
              ))}
            </TableBody>
          </Table>

          {activeCount.status !== 'completed' && activeCount.status !== 'cancelled' ? (
            <div className="mt-4 space-y-3">
              {remaining > 0 ? (
                // ⚠️ Not a blocker — a partial count is legitimate. But the
                // person must know that uncounted lines are excluded, not
                // treated as zero.
                <p className="flex items-start gap-1.5 text-xs text-[hsl(var(--color-warning))]">
                  <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                  {t(
                    'cycleCount.remainingHint',
                    'ردیف‌های شمرده‌نشده در اصلاح حساب نمی‌شوند — صفر در نظر گرفته نمی‌شوند.',
                  )}
                </p>
              ) : null}

              {confirming ? (
                <div className="rounded-xl border border-[hsl(var(--color-warning)/0.4)] bg-[hsl(var(--color-warning)/0.08)] p-3">
                  {/* ⚠️ The whole reason for a confirm step: completing writes
                      ADJUSTMENT movements and values a shortage as a
                      write-off. That is money leaving the books. */}
                  <p className="text-xs text-[hsl(var(--fg-primary))]">
                    {t(
                      'cycleCount.completeWarning',
                      'با تکمیل، اختلاف‌ها به‌عنوان اصلاح انبار ثبت می‌شوند و کسری به قیمت تمام‌شده از دفاتر خارج می‌شود. این کار برگشت‌پذیر نیست.',
                    )}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" onClick={onComplete} disabled={Boolean(isBusy)}>
                      {t('cycleCount.confirmComplete', 'بله، تکمیل کن')}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setConfirming(false)}>
                      {t('common.cancel', 'انصراف')}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => setConfirming(true)}
                    disabled={Boolean(isBusy) || done.length === 0}
                  >
                    {t('cycleCount.complete', 'تکمیل شمارش')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={Boolean(isBusy)}
                    onClick={() => {
                      // The server requires a reason and refuses without one.
                      const reason = window.prompt(
                        t('cycleCount.cancelReason', 'دلیل لغو این شمارش؟'),
                      )
                      if (reason && reason.trim()) onCancel(reason.trim())
                    }}
                  >
                    {t('cycleCount.cancel', 'لغو شمارش')}
                  </Button>
                </div>
              )}
            </div>
          ) : null}

          {activeCount.status === 'completed' ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Figure
                t={t}
                labelKey="cycleCount.shortage"
                fallback="کسری"
                value={activeCount.shortage_value}
                fmtMoney={fmtMoney}
                tone="bad"
              />
              <Figure
                t={t}
                labelKey="cycleCount.surplus"
                fallback="اضافی"
                value={activeCount.surplus_value}
                fmtMoney={fmtMoney}
                tone="good"
              />
              <Figure
                t={t}
                labelKey="cycleCount.netLoss"
                fallback="خالص زیان"
                value={activeCount.net_loss}
                fmtMoney={fmtMoney}
                tone="bad"
              />
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}

function Figure({
  t,
  labelKey,
  fallback,
  value,
  fmtMoney,
  tone,
}: {
  t: CycleCountViewProps['t']
  labelKey: string
  fallback: string
  value: number | null
  fmtMoney: (value: number) => string
  tone: 'good' | 'bad'
}) {
  return (
    <div className="rounded-xl border border-[hsl(var(--border-default))] p-3">
      <span className="text-xs text-[hsl(var(--fg-secondary))]">{t(labelKey, fallback)}</span>
      <p
        className={cn(
          'mt-1 text-lg font-bold tabular-nums',
          value && tone === 'bad'
            ? 'text-[hsl(var(--color-destructive))]'
            : 'text-[hsl(var(--fg-primary))]',
        )}
      >
        {value === null ? '—' : fmtMoney(value)}
      </p>
    </div>
  )
}

function CountLineRow({
  t,
  line,
  productName,
  disabled,
  onRecord,
}: {
  t: CycleCountViewProps['t']
  line: CycleCountLine
  productName: (productId: string) => string
  disabled: boolean
  onRecord: (productId: string, countedQty: number) => void
}) {
  // Local so typing does not fire a request per keystroke; committed on blur.
  const [draft, setDraft] = React.useState(
    line.counted_qty === null ? '' : String(line.counted_qty),
  )

  const commit = () => {
    const trimmed = draft.trim()
    // ⚠️ Blank is «not counted», NOT zero. Sending 0 here would record a full
    // shortage for a shelf nobody has looked at.
    if (trimmed === '') return
    const value = Number(trimmed)
    if (!Number.isFinite(value) || value < 0) return
    if (value === line.counted_qty) return
    onRecord(line.product_id, value)
  }

  return (
    <TableRow>
      <TableCell>{productName(line.product_id)}</TableCell>
      <TableCell className="tabular-nums">{line.expected_qty}</TableCell>
      <TableCell>
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          value={draft}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          placeholder={t('cycleCount.notCounted', 'شمرده نشده')}
          className="h-9 w-28"
        />
      </TableCell>
      <TableCell
        className={cn(
          'tabular-nums',
          line.variance_qty
            ? 'font-semibold text-[hsl(var(--color-destructive))]'
            : 'text-[hsl(var(--fg-tertiary))]',
        )}
      >
        {line.counted_qty === null ? '—' : (line.variance_qty ?? 0)}
      </TableCell>
    </TableRow>
  )
}

export default CycleCountView
