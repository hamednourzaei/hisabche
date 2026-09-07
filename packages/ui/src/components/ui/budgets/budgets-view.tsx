'use client'

// ============================================
// packages/ui/src/components/ui/budgets/budgets-view.tsx
//
// Budgets.
//
// ---------------------------------------------------------------------------
// TWO DIFFERENT QUESTIONS, DELIBERATELY NOT MIXED
//
// The variance table answers "what happened": budget against actual, per
// period. Committed money is absent from it on purpose — a purchase order that
// was never received did not happen, and putting it in a historical report
// makes the history wrong.
//
// The spend check answers "may I": budget − actual − COMMITTED, asked before
// the money is promised. That ordering is the whole difference between a
// control and a report. A budget discovered at month end cannot stop anything.
// ============================================

import { memo, useState } from 'react'
import type { Budget, BudgetCheck, VarianceRow } from '@hisabche/api'

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../capability/capability-kit'

export interface BudgetsViewProps {
  t: (key: string, fallback?: string) => string
  budgets: Budget[]
  variance: VarianceRow[]
  isLoading: boolean
  error: string | null
  actionError: string | null
  isBusy: boolean
  checkResult: BudgetCheck | null
  onCheckSpend: (input: { accountId: string; amountMinor: number; onDate: string }) => void
  onRefresh: () => void
}

const STATE_TONE: Record<string, string | undefined> = {
  ok: 'good',
  warning: 'warn',
  exceeded: 'bad',
}

export const BudgetsView = memo(function BudgetsView({
  t,
  budgets,
  variance,
  isLoading,
  error,
  actionError,
  isBusy,
  checkResult,
  onCheckSpend,
  onRefresh,
}: BudgetsViewProps) {
  const [accountId, setAccountId] = useState('')
  const [amountMinor, setAmountMinor] = useState(0)

  const today = new Date().toISOString().slice(0, 10)

  return (
    <CapabilityPage>
      <CapabilityHeader
        title={t('budgets.title', 'بودجه')}
        description={t('budgets.subtitle', 'سقف هزینه به تفکیک حساب و دوره')}
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

      {!isLoading && budgets.length === 0 ? (
        <Panel title={t('budgets.empty_title', 'بودجه‌ای تعریف نشده')}>
          <p className="text-sm text-[hsl(var(--fg-tertiary))]">
            {t('budgets.empty_hint', 'بودجه از تنظیمات حسابداری، روی یک حساب، تعریف می‌شود.')}
          </p>
        </Panel>
      ) : null}

      {budgets.length > 0 ? (
        <Panel title={t('budgets.list', 'بودجه‌ها')}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('budgets.account', 'حساب')}</TableHead>
                <TableHead>{t('budgets.period', 'دوره')}</TableHead>
                <TableHead>{t('budgets.amount', 'سقف هر دوره')}</TableHead>
                <TableHead>{t('budgets.action', 'رفتار')}</TableHead>
                <TableHead>{t('common.status', 'وضعیت')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {budgets.map((budget) => (
                <TableRow key={budget.id}>
                  <TableCell className="py-2 font-mono text-xs" dir="ltr">
                    {budget.accountId.slice(0, 8)}
                  </TableCell>
                  <TableCell>{t(`budgets.period_${budget.period}`, budget.period)}</TableCell>
                  <TableCell>
                    <Money minor={budget.amountMinor} />
                  </TableCell>
                  <TableCell>
                    <Badge
                      tone={
                        budget.action === 'block'
                          ? 'bad'
                          : budget.action === 'warn'
                            ? 'warn'
                            : 'neutral'
                      }
                    >
                      {t(`budgets.action_${budget.action}`, budget.action)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {budget.isActive ? (
                      <Badge tone="good">{t('common.active', 'فعال')}</Badge>
                    ) : (
                      <Badge tone="neutral">{t('common.inactive', 'غیرفعال')}</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      ) : null}

      <Panel
        title={t('budgets.check_title', 'بررسی یک هزینه')}
        description={t('budgets.check_hint', 'پیش از تعهد پول پرسیده می‌شود، نه بعد از آن.')}
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_12rem_auto]">
          <Field
            label={t('budgets.account', 'حساب')}
            value={accountId}
            onChange={setAccountId}
            disabled={isBusy}
            dir="ltr"
          />
          <MinorInput
            label={t('budgets.amount_to_spend', 'مبلغ')}
            value={amountMinor}
            onChange={setAmountMinor}
            disabled={isBusy}
          />
          <ActionButton
            className="self-end"
            disabled={isBusy || accountId.trim() === '' || amountMinor <= 0}
            onClick={() =>
              onCheckSpend({ accountId: accountId.trim(), amountMinor, onDate: today })
            }
          >
            {t('budgets.check_action', 'بررسی')}
          </ActionButton>
        </div>

        {checkResult ? (
          <div className="mt-4 rounded-xl bg-[hsl(var(--surface-muted)/0.4)] p-4 text-sm">
            {/* The state carries more than allowed/refused: a spend can be
                permitted and still cross the warning threshold, and hiding
                that is how a budget is discovered only once it is broken. */}
            <Badge
              tone={
                (checkResult.status ? STATE_TONE[checkResult.status.state] : undefined) ??
                (checkResult.allowed ? 'good' : 'bad')
              }
            >
              {checkResult.allowed
                ? t('budgets.allowed', 'مجاز است')
                : t('budgets.blocked', 'از سقف عبور می‌کند')}
            </Badge>
            {checkResult.code ? (
              <span className="ms-2 text-[hsl(var(--fg-tertiary))]">
                {t(`budgets.code_${checkResult.code}`, checkResult.code)}
              </span>
            ) : null}

            {checkResult.status ? (
              <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-[hsl(var(--fg-tertiary))]">
                    {t('budgets.budget', 'بودجه')}
                  </dt>
                  <dd>
                    <Money minor={checkResult.status.budgetMinor} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[hsl(var(--fg-tertiary))]">
                    {t('budgets.actual', 'خرج‌شده')}
                  </dt>
                  <dd>
                    <Money minor={checkResult.status.actualMinor} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[hsl(var(--fg-tertiary))]">
                    {t('budgets.committed', 'تعهدشده')}
                  </dt>
                  <dd>
                    <Money minor={checkResult.status.committedMinor} tone="muted" />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[hsl(var(--fg-tertiary))]">
                    {t('budgets.available', 'قابل استفاده')}
                  </dt>
                  <dd>
                    <Money minor={checkResult.status.availableMinor} tone="auto" />
                  </dd>
                </div>
              </dl>
            ) : null}
          </div>
        ) : null}
      </Panel>

      {variance.length > 0 ? (
        <Panel
          title={t('budgets.variance', 'انحراف از بودجه')}
          description={t('budgets.variance_hint', 'گذشته‌نگر — تعهدها در این جدول نیستند.')}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('budgets.period_start', 'آغاز دوره')}</TableHead>
                <TableHead>{t('budgets.budget', 'بودجه')}</TableHead>
                <TableHead>{t('budgets.actual', 'خرج‌شده')}</TableHead>
                <TableHead>{t('budgets.variance_amount', 'انحراف')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {variance.map((row) => (
                <TableRow key={`${row.budgetId}-${row.periodStart}`}>
                  <TableCell className="py-2 tabular-nums" dir="ltr">
                    {row.periodStart.slice(0, 10)}
                  </TableCell>
                  <TableCell>
                    <Money minor={row.budgetMinor} tone="muted" />
                  </TableCell>
                  <TableCell>
                    <Money minor={row.actualMinor} />
                  </TableCell>
                  <TableCell>
                    {/* Positive is overspend, so the sign is inverted for tone:
                          more than budgeted is the bad direction. */}
                    <Money
                      minor={row.varianceMinor}
                      signed
                      tone={row.varianceMinor > 0 ? 'bad' : 'good'}
                    />
                    {row.variancePercent != null ? (
                      <span className="ms-2 text-xs text-[hsl(var(--fg-tertiary))]">
                        {Math.round(row.variancePercent)}%
                      </span>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      ) : null}
    </CapabilityPage>
  )
})

BudgetsView.displayName = 'BudgetsView'
