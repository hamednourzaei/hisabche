'use client'

// ============================================
// packages/ui/src/components/ui/customers/customer-list-view.tsx
//
// The engine's interaction language, drawn with the project's own components.
//
// Every behaviour here — what a second click on a header does, when the pager
// resets, which page size is allowed — belongs to `@hisabche/ui-contract`.
// This file decides nothing; it renders what the engine reports and calls back
// into it. That is what makes the next list a copy rather than a new opinion.
// ============================================

import { memo } from 'react'
import type { Customer } from '@hisabche/validation'
import { PAGE_SIZES } from '@hisabche/ui-contract'

import type { ListEngine } from '../../../hooks/use-list-engine'
import {
  ActionButton,
  Badge,
  CapabilityHeader,
  CapabilityPage,
  EmptyState,
  ErrorNote,
  Loading,
  Panel,
  SelectField,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../capability/capability-kit'
import { WorkStateBadge } from '../state/work-state'
import { Input } from '../input'

export interface CustomerListViewProps {
  t: (key: string, fallback?: string) => string
  engine: ListEngine
  /** Connectivity, so the header can say whether this list is in step. */
  isOnline: boolean
  pendingCount: number
  rows: Customer[]
  total: number
  isLoading: boolean
  error: string | null
  onRefresh: () => void
}

/**
 * Sortable columns.
 *
 * ⚠️ Only fields the SERVER can actually order by. `balance` is deliberately
 * absent: it is computed per customer rather than stored, so offering it as a
 * sort would send `sortBy=balance` to an endpoint that quietly ignores it —
 * and a sort control that does nothing is worse than no sort control.
 */
const COLUMNS: ReadonlyArray<{ field: string; labelKey: string; fallback: string }> = [
  { field: 'fullName', labelKey: 'customers.name', fallback: 'نام' },
  { field: 'phone', labelKey: 'customers.phone', fallback: 'تلفن' },
]

export const CustomerListView = memo(function CustomerListView({
  t,
  engine,
  isOnline,
  pendingCount,
  rows,
  total,
  isLoading,
  error,
  onRefresh,
}: CustomerListViewProps) {
  const { state } = engine

  return (
    <CapabilityPage>
      <CapabilityHeader
        title={t('customers.title', 'مشتریان')}
        description={t('customers.subtitle', 'فهرست مشتریان با جست‌وجو و مرتب‌سازی')}
        action={
          <span className="flex items-center gap-2">
            {/* Whether this list is in step with the server, in the product's
                one state vocabulary. Renders nothing when it is. */}
            <WorkStateBadge t={t} isOffline={!isOnline} pendingCount={pendingCount} />
            <ActionButton variant="quiet" onClick={onRefresh} disabled={isLoading}>
              {t('common.refresh', 'تازه‌سازی')}
            </ActionButton>
          </span>
        }
      />

      {error ? (
        <ErrorNote
          message={error}
          onRetry={onRefresh}
          retryLabel={t('common.retry', 'تلاش دوباره')}
        />
      ) : null}

      <Panel title={t('common.search', 'جست‌وجو')}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <Input
              label={t('customers.search_label', 'نام یا شماره')}
              value={state.search}
              onChange={(event) => engine.setSearch(event.target.value)}
            />
          </div>

          <div className="w-32">
            <SelectField
              label={t('common.page_size', 'تعداد در صفحه')}
              value={String(state.pageSize)}
              onChange={(value) => engine.setPageSize(Number(value))}
              options={PAGE_SIZES.map((size) => ({ value: String(size), label: String(size) }))}
            />
          </div>

          {/* Shown only when something is actually narrowing the list —
              a permanent "clear" button on an unfiltered list is a control
              that does nothing. */}
          {engine.isFiltered ? (
            <ActionButton variant="quiet" onClick={engine.reset}>
              {t('common.clear', 'پاک کردن')}
            </ActionButton>
          ) : null}
        </div>
      </Panel>

      {isLoading ? <Loading label={t('common.loading', 'در حال بارگذاری…')} /> : null}

      {!isLoading && rows.length === 0 ? (
        <EmptyState
          title={
            engine.isFiltered
              ? t('customers.no_match', 'مشتری‌ای با این جست‌وجو پیدا نشد')
              : t('customers.empty', 'هنوز مشتری‌ای ثبت نشده')
          }
          description={
            engine.isFiltered
              ? t('customers.no_match_hint', 'جست‌وجو را تغییر دهید یا پاکش کنید.')
              : t('customers.empty_hint', 'اولین مشتری را از صفحه‌ی مشتریان اضافه کنید.')
          }
        />
      ) : null}

      {rows.length > 0 ? (
        <Panel title={t('customers.list', 'فهرست')}>
          <Table>
            <TableHeader>
              <TableRow>
                {COLUMNS.map((column) => {
                  const direction = engine.sortIndicator(column.field)
                  return (
                    <TableHead key={column.field}>
                      <button
                        type="button"
                        onClick={() => engine.toggleSort(column.field)}
                        // The header states the sort for a screen reader, not
                        // only with an arrow — §1.7, never colour or glyph
                        // alone.
                        aria-sort={
                          direction === 'asc'
                            ? 'ascending'
                            : direction === 'desc'
                              ? 'descending'
                              : 'none'
                        }
                        className="flex items-center gap-1 text-start"
                      >
                        {t(column.labelKey, column.fallback)}
                        <span aria-hidden="true">
                          {direction === 'asc' ? '↑' : direction === 'desc' ? '↓' : ''}
                        </span>
                      </button>
                    </TableHead>
                  )
                })}
                {/* Not a button: nothing behind it can sort by terms. */}
                <TableHead>{t('customers.terms', 'شرایط')}</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {rows.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell>{customer.fullName}</TableCell>
                  <TableCell dir="ltr">{customer.phone || '—'}</TableCell>
                  <TableCell>
                    <Badge tone={customer.type === 'credit' ? 'warn' : 'neutral'}>
                      {customer.type === 'credit'
                        ? t('customers.credit', 'نسیه')
                        : t('customers.cash', 'نقدی')}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      ) : null}

      {engine.pageCount > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <ActionButton
            variant="quiet"
            disabled={state.page <= 1}
            onClick={() => engine.goToPage(state.page - 1)}
          >
            {t('common.previous', 'قبلی')}
          </ActionButton>

          <Badge>
            <span dir="ltr" className="tabular-nums">
              {state.page} / {engine.pageCount}
            </span>
          </Badge>

          <ActionButton
            variant="quiet"
            disabled={state.page >= engine.pageCount}
            onClick={() => engine.goToPage(state.page + 1)}
          >
            {t('common.next', 'بعدی')}
          </ActionButton>
        </div>
      ) : null}

      <p className="text-xs text-[hsl(var(--fg-tertiary))]">
        {t('common.total', 'مجموع')}:{' '}
        <span dir="ltr" className="tabular-nums">
          {total}
        </span>
      </p>
    </CapabilityPage>
  )
})

CustomerListView.displayName = 'CustomerListView'
