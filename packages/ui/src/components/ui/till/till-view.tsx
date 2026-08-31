'use client'

// ============================================
// packages/ui/src/components/ui/till/till-view.tsx
//
// The cash drawer.
//
// ---------------------------------------------------------------------------
// WHAT THIS SCREEN IS FOR
//
// Not selling — selling happens on the invoice screen. This is the drawer
// around the selling: opening it with a float, recording money that goes in or
// out for a reason, and counting it at the end.
//
// The one figure that matters is the VARIANCE, and it is shown before the
// close is confirmed, not after. A cashier who learns the drawer is short
// after the session is sealed can no longer count again; one who sees it while
// standing at the till usually finds the missing note.
//
// Expected cash is derived by the server from the session's own movements and
// is never editable here. A field a person can type into is a field that can
// be made to agree with whatever is in the drawer, which is precisely the
// control this screen exists to provide.
// ============================================

import { memo, useState } from 'react'
import type { PosSession, SessionTotals, AbandonedSession, PosPaymentMethod } from '@hisabche/api'
import {
  ActionButton,
  Badge,
  CapabilityHeader,
  CapabilityPage,
  ErrorNote,
  Field,
  Loading,
  MinorInput,
  Money,
  Panel,
  Stat,
  StatGrid,
} from '../capability/capability-kit'

export interface TillViewProps {
  t: (key: string, fallback?: string) => string
  session: PosSession | null
  totals: SessionTotals | null
  abandoned: AbandonedSession[]
  isLoading: boolean
  error: string | null
  isBusy: boolean
  actionError: string | null
  onRefresh: () => void
  onOpen: (openingFloatMinor: number) => void
  onCashMovement: (input: {
    kind: 'cash_in' | 'cash_out'
    amountMinor: number
    reason: string
  }) => void
  onClose: (input: { countedCashMinor: number; varianceReason?: string }) => void
}

const METHOD_ORDER: PosPaymentMethod[] = ['cash', 'card', 'transfer', 'credit', 'other']

export const TillView = memo(function TillView({
  t,
  session,
  totals,
  abandoned,
  isLoading,
  error,
  isBusy,
  actionError,
  onRefresh,
  onOpen,
  onCashMovement,
  onClose,
}: TillViewProps) {
  const [floatMinor, setFloatMinor] = useState(0)
  const [movementMinor, setMovementMinor] = useState(0)
  const [movementReason, setMovementReason] = useState('')
  const [countedMinor, setCountedMinor] = useState(0)
  const [varianceReason, setVarianceReason] = useState('')

  // Computed in the view because it is a preview of an unsaved count, not a
  // stored fact. The server recomputes it from its own totals on close.
  const previewVariance = totals != null ? countedMinor - totals.expectedCashMinor : null

  return (
    <CapabilityPage>
      <CapabilityHeader
        title={t('till.title', 'صندوق')}
        description={t('till.subtitle', 'باز کردن، ثبت نقدی و شمارش صندوق')}
        action={
          <ActionButton variant="quiet" onClick={onRefresh} disabled={isLoading}>
            {t('common.refresh', 'تازه‌سازی')}
          </ActionButton>
        }
      />

      {error ? (
        <ErrorNote
          message={error}
          onRetry={onRefresh}
          retryLabel={t('common.retry', 'تلاش دوباره')}
        />
      ) : null}
      {actionError ? <ErrorNote message={actionError} /> : null}

      {isLoading ? <Loading label={t('common.loading', 'در حال بارگذاری…')} /> : null}

      {!isLoading && !session ? (
        <Panel
          title={t('till.open_title', 'صندوق بسته است')}
          description={t('till.open_hint', 'مبلغ نقد اولیه‌ی داخل صندوق را وارد کنید.')}
        >
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-48">
              <MinorInput
                label={t('till.opening_float', 'نقد اولیه')}
                value={floatMinor}
                onChange={setFloatMinor}
                disabled={isBusy}
              />
            </div>
            <ActionButton onClick={() => onOpen(floatMinor)} disabled={isBusy}>
              {t('till.open_action', 'باز کردن صندوق')}
            </ActionButton>
          </div>
        </Panel>
      ) : null}

      {session && totals ? (
        <>
          <Panel
            title={t('till.session_title', 'صندوق باز')}
            description={
              t('till.opened_at', 'زمان باز شدن') +
              ': ' +
              session.openedAt.slice(0, 16).replace('T', ' ')
            }
            action={<Badge tone="good">{t(`till.status_${session.status}`, session.status)}</Badge>}
          >
            <StatGrid>
              <Stat
                label={t('till.orders', 'فروش‌ها')}
                value={totals.orderCount}
                hint={
                  totals.voidedCount > 0
                    ? `${t('till.voided', 'ابطال‌شده')}: ${totals.voidedCount}`
                    : undefined
                }
              />
              <Stat
                label={t('till.gross_sales', 'فروش ناخالص')}
                value={<Money minor={totals.grossSalesMinor} />}
              />
              <Stat
                label={t('till.expected_cash', 'نقد مورد انتظار')}
                value={<Money minor={totals.expectedCashMinor} />}
                hint={t('till.expected_hint', 'محاسبه‌ی سرور — قابل ویرایش نیست')}
              />
              <Stat
                label={t('till.opening_float', 'نقد اولیه')}
                value={<Money minor={session.openingFloatMinor} tone="muted" />}
              />
            </StatGrid>

            <div className="mt-4 grid gap-2 sm:grid-cols-5">
              {METHOD_ORDER.map((method) => (
                <div
                  key={method}
                  className="rounded-xl border border-[hsl(var(--border))] px-3 py-2 text-sm"
                >
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">
                    {t(`till.method_${method}`, method)}
                  </div>
                  <Money minor={totals.byMethod?.[method] ?? 0} tone="muted" />
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            title={t('till.movement_title', 'ورود و خروج نقدی')}
            description={t(
              'till.movement_hint',
              'برداشت از صندوق بدون دلیل، یعنی کسری بدون توضیح.',
            )}
          >
            <div className="grid gap-3 sm:grid-cols-[12rem_1fr_auto_auto]">
              <MinorInput
                label={t('till.amount', 'مبلغ')}
                value={movementMinor}
                onChange={setMovementMinor}
                disabled={isBusy}
              />
              <Field
                label={t('till.reason', 'دلیل')}
                value={movementReason}
                onChange={setMovementReason}
                disabled={isBusy}
              />
              <ActionButton
                variant="quiet"
                className="self-end"
                // Reason is required by the server too. Disabling it here just
                // avoids a round trip to be told so.
                disabled={isBusy || movementMinor <= 0 || movementReason.trim() === ''}
                onClick={() =>
                  onCashMovement({
                    kind: 'cash_in',
                    amountMinor: movementMinor,
                    reason: movementReason.trim(),
                  })
                }
              >
                {t('till.cash_in', 'ورود نقدی')}
              </ActionButton>
              <ActionButton
                variant="quiet"
                className="self-end"
                disabled={isBusy || movementMinor <= 0 || movementReason.trim() === ''}
                onClick={() =>
                  onCashMovement({
                    kind: 'cash_out',
                    amountMinor: movementMinor,
                    reason: movementReason.trim(),
                  })
                }
              >
                {t('till.cash_out', 'خروج نقدی')}
              </ActionButton>
            </div>
          </Panel>

          <Panel
            title={t('till.close_title', 'شمارش و بستن')}
            description={t('till.close_hint', 'اختلاف پیش از تأیید نشان داده می‌شود.')}
          >
            <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
              <MinorInput
                label={t('till.counted_cash', 'نقد شمرده‌شده')}
                value={countedMinor}
                onChange={setCountedMinor}
                disabled={isBusy}
              />
              <div className="self-end rounded-xl bg-[hsl(var(--muted)/0.4)] px-4 py-3 text-sm">
                <span className="text-[hsl(var(--muted-foreground))]">
                  {t('till.variance', 'اختلاف')}:{' '}
                </span>
                {previewVariance == null ? (
                  '—'
                ) : (
                  <Money minor={previewVariance} signed tone="auto" />
                )}
              </div>
            </div>

            {previewVariance != null && previewVariance !== 0 ? (
              <div className="mt-3">
                <Field
                  label={t('till.variance_reason', 'توضیح اختلاف')}
                  value={varianceReason}
                  onChange={setVarianceReason}
                  disabled={isBusy}
                />
              </div>
            ) : null}

            <ActionButton
              className="mt-4"
              // A non-zero variance must be explained before it can be sealed.
              // Once the session closes, the person who could still find the
              // missing note has gone home.
              disabled={
                isBusy ||
                (previewVariance != null && previewVariance !== 0 && varianceReason.trim() === '')
              }
              onClick={() =>
                onClose({
                  countedCashMinor: countedMinor,
                  ...(varianceReason.trim() ? { varianceReason: varianceReason.trim() } : {}),
                })
              }
            >
              {t('till.close_action', 'بستن صندوق')}
            </ActionButton>
          </Panel>
        </>
      ) : null}

      {abandoned.length > 0 ? (
        <Panel
          title={t('till.abandoned_title', 'صندوق‌های رها شده')}
          description={t('till.abandoned_hint', 'پولی که در صندوقی است که کسی به آن دسترسی ندارد.')}
        >
          <ul className="divide-y divide-[hsl(var(--border))]">
            {abandoned.map((item) => (
              <li
                key={item.sessionId}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <span className="text-[hsl(var(--muted-foreground))]">
                  {item.openedAt.slice(0, 10)} · {Math.round(item.hoursOpen)}
                  {t('till.hours_short', 'س')} · {item.orderCount}
                </span>
                <Money minor={item.expectedCashMinor} />
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </CapabilityPage>
  )
})

TillView.displayName = 'TillView'
