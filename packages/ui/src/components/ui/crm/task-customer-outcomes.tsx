// ============================================
// Per-customer outcome panel for a task.
//
// A task targets many customers. This is where the assigned employee marks
// each one ✅ or ❌, and where the person who created the task reads back what
// happened — including the reason for every ❌.
//
// Rendered from the shared DataTable so it looks and behaves like every other
// table in the product, and paginated because a campaign can cover hundreds of
// customers.
// ============================================

'use client'

import { memo, useCallback, useMemo, useState } from 'react'
import { Check, Loader2, X } from 'lucide-react'
import type { CustomerOutcome, InteractionCustomer } from '@hisabche/api'

import { cn } from '../../../lib/utils'
import { DataTable, type TableColumn } from '../data-table'
import { useIntlLocale } from '../../../hooks/use-intl-locale'

/** Customers per page. Enough to scan, small enough to stay responsive. */
const PAGE_SIZE = 10

type Translate = (key: string, fallback?: string) => string

export interface TaskCustomerOutcomesProps {
  t: Translate
  customers: readonly InteractionCustomer[]
  outcomes: readonly CustomerOutcome[]
  /**
   * Omit to render read-only — the task creator reviewing results gets the
   * same table without the ✅/❌ controls.
   */
  onRecord?:
    ((input: { customerId: string; outcome: 'done' | 'failed'; note?: string }) => void) | undefined
  /** Customer id currently being written, so only that row shows a spinner. */
  pendingCustomerId?: string | null | undefined
  /**
   * ⚠️ A RECORDED RESULT IS A RECORD, NOT A DRAFT (request #98-د).
   *
   * «زمانی که رویه علامت تیک می‌زنم نتیجه می‌شود انجام شد، اما اون تیک سبز و
   * قرمز هنوز هستن و حتی با کامل شدن تسک باز امکان تغییر دادنش هست و این
   * اشتباهه». Two separate locks, because they say different things:
   *
   *  • a row that already has an outcome loses its own buttons — the call
   *    happened, and «انجام شد» is not a toggle;
   *  • a task that is finished loses the whole column — nothing about a closed
   *    task may be rewritten afterwards.
   */
  isLocked?: boolean | undefined
}

interface CustomerRow extends InteractionCustomer {
  outcome: CustomerOutcome | undefined
}

function formatTimestamp(iso: string, locale: string): string {
  try {
    const date = new Date(iso)
    // Date and time together: "called them" is only meaningful with the hour,
    // which is what a manager checks when a customer disputes the contact.
    return `${date.toLocaleDateString(locale)} ${date.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
    })}`
  } catch {
    return iso
  }
}

export const TaskCustomerOutcomes = memo(function TaskCustomerOutcomes({
  t,
  customers,
  outcomes,
  onRecord,
  pendingCustomerId = null,
  isLocked = false,
}: TaskCustomerOutcomesProps) {
  const locale = useIntlLocale()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  // Which customer is mid-❌ and still needs a reason typed.
  const [failingId, setFailingId] = useState<string | null>(null)
  const [note, setNote] = useState('')

  const outcomeByCustomer = useMemo(() => {
    const map = new Map<string, CustomerOutcome>()
    for (const entry of outcomes) map.set(entry.customerId, entry)
    return map
  }, [outcomes])

  const rows = useMemo<CustomerRow[]>(() => {
    const term = search.trim().toLowerCase()

    const matched = customers.filter((customer) => {
      if (!term) return true
      return (
        (customer.name ?? '').toLowerCase().includes(term) ||
        (customer.phone ?? '').toLowerCase().includes(term)
      )
    })

    return matched.map((customer) => ({
      ...customer,
      outcome: outcomeByCustomer.get(customer.id),
    }))
  }, [customers, outcomeByCustomer, search])

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  // A search that shrinks the list can strand the user past the last page.
  const safePage = Math.min(page, totalPages)
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value)
    setPage(1)
  }, [])

  const handleDone = useCallback(
    (customerId: string) => {
      setFailingId(null)
      setNote('')
      onRecord?.({ customerId, outcome: 'done' })
    },
    [onRecord],
  )

  const handleStartFail = useCallback((customerId: string) => {
    setFailingId(customerId)
    setNote('')
  }, [])

  const handleConfirmFail = useCallback(() => {
    const trimmed = note.trim()
    // The reason is the whole point of ❌ — refuse an empty one rather than
    // recording a failure nobody can act on.
    if (!failingId || !trimmed) return

    onRecord?.({ customerId: failingId, outcome: 'failed', note: trimmed })
    setFailingId(null)
    setNote('')
  }, [failingId, note, onRecord])

  const columns = useMemo<TableColumn<CustomerRow>[]>(
    () => [
      {
        id: 'name',
        labelKey: 'crm.outcomes.customer',
        labelFallback: 'مشتری',
        locked: true,
        sortValue: (row) => row.name ?? '',
        render: (row) => (
          <span className="font-medium text-[hsl(var(--fg-primary))]">{row.name || '—'}</span>
        ),
      },
      {
        id: 'phone',
        labelKey: 'crm.outcomes.phone',
        labelFallback: 'شماره تماس',
        showFrom: 'sm',
        sortValue: (row) => row.phone ?? '',
        render: (row) => (
          <span className="tabular-nums text-[hsl(var(--fg-secondary))]" dir="ltr">
            {row.phone || '—'}
          </span>
        ),
      },
      {
        id: 'result',
        labelKey: 'crm.outcomes.result',
        labelFallback: 'نتیجه',
        sortValue: (row) => row.outcome?.outcome ?? '',
        render: (row) => {
          if (!row.outcome) {
            return (
              <span className="text-xs text-[hsl(var(--fg-tertiary))]">
                {t('crm.outcomes.pending', 'انجام نشده')}
              </span>
            )
          }

          const done = row.outcome.outcome === 'done'
          return (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                done
                  ? 'bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]'
                  : 'bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))]',
              )}
            >
              {done ? <Check className="size-3" /> : <X className="size-3" />}
              {done ? t('crm.outcomes.done', 'انجام شد') : t('crm.outcomes.failed', 'انجام نشد')}
            </span>
          )
        },
      },
      {
        id: 'recordedAt',
        labelKey: 'crm.outcomes.recordedAt',
        labelFallback: 'تاریخ و ساعت',
        showFrom: 'md',
        sortValue: (row) => row.outcome?.recordedAt ?? '',
        render: (row) => (
          <span className="whitespace-nowrap text-xs text-[hsl(var(--fg-secondary))]">
            {row.outcome ? formatTimestamp(row.outcome.recordedAt, locale) : '—'}
          </span>
        ),
      },
      {
        id: 'note',
        labelKey: 'crm.outcomes.note',
        labelFallback: 'توضیحات',
        showFrom: 'lg',
        render: (row) => (
          <span className="text-xs text-[hsl(var(--fg-secondary))]">
            {row.outcome?.note || '—'}
          </span>
        ),
      },
      ...(onRecord && !isLocked
        ? [
            {
              id: 'actions',
              labelKey: 'crm.outcomes.actions',
              labelFallback: 'ثبت',
              locked: true,
              align: 'end' as const,
              render: (row: CustomerRow) => {
                // Already answered: show nothing to press. The result itself is
                // in the «نتیجه» column beside it.
                if (row.outcome) return null

                if (pendingCustomerId === row.id) {
                  return (
                    <Loader2 className="ms-auto size-4 animate-spin text-[hsl(var(--fg-tertiary))] motion-reduce:animate-none" />
                  )
                }

                return (
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => handleDone(row.id)}
                      aria-label={t('crm.outcomes.markDone', 'ثبت انجام شد')}
                      className="rounded-full p-1.5 text-[hsl(var(--color-success))] hover:bg-[hsl(var(--color-success)/0.12)]"
                    >
                      <Check className="size-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStartFail(row.id)}
                      aria-label={t('crm.outcomes.markFailed', 'ثبت انجام نشد')}
                      className="rounded-full p-1.5 text-[hsl(var(--color-destructive))] hover:bg-[hsl(var(--color-destructive)/0.12)]"
                    >
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                )
              },
            },
          ]
        : []),
    ],
    [t, locale, onRecord, isLocked, pendingCustomerId, handleDone, handleStartFail],
  )

  const doneCount = outcomes.filter((o) => o.outcome === 'done').length
  const failedCount = outcomes.filter((o) => o.outcome === 'failed').length

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-[hsl(var(--fg-primary))]">
          {t('crm.outcomes.title', 'مشتری‌های انتخاب‌شده')}
        </span>
        <span className="text-[hsl(var(--fg-tertiary))]">
          {t('crm.outcomes.summary', '{done} انجام شد · {failed} انجام نشد · {total} کل')
            .replace('{done}', String(doneCount))
            .replace('{failed}', String(failedCount))
            .replace('{total}', String(customers.length))}
        </span>
      </div>

      {failingId && (
        <div className="rounded-xl border border-[hsl(var(--color-destructive)/0.3)] bg-[hsl(var(--color-destructive)/0.06)] p-3">
          <label
            htmlFor="task-outcome-note"
            className="block text-xs font-medium text-[hsl(var(--fg-primary))]"
          >
            {t('crm.outcomes.whyFailed', 'چرا انجام نشد؟')}
          </label>
          <textarea
            id="task-outcome-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            autoFocus
            placeholder={t('crm.outcomes.notePlaceholder', 'مثلاً: شماره خاموش بود')}
            className="mt-1.5 w-full rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] p-2 text-sm outline-none focus:border-[hsl(var(--color-primary))]"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={handleConfirmFail}
              disabled={!note.trim()}
              className="rounded-full bg-[hsl(var(--color-destructive))] px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('common.save', 'ذخیره')}
            </button>
            <button
              type="button"
              onClick={() => {
                setFailingId(null)
                setNote('')
              }}
              className="rounded-full border border-[hsl(var(--border-default))] px-3 py-1.5 text-xs text-[hsl(var(--fg-secondary))]"
            >
              {t('common.cancel', 'انصراف')}
            </button>
          </div>
        </div>
      )}

      <DataTable
        tableId="task-customer-outcomes"
        t={t}
        rows={pageRows}
        columns={columns}
        rowKey={(row) => row.id}
        searchValue={search}
        onSearchChange={handleSearchChange}
        minWidthClass="min-w-[420px] sm:min-w-[640px]"
        emptyState={
          <p className="py-8 text-center text-sm text-[hsl(var(--fg-tertiary))]">
            {t('crm.outcomes.empty', 'مشتری‌ای پیدا نشد')}
          </p>
        }
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="rounded-full border border-[hsl(var(--border-default))] px-3 py-1 text-xs disabled:opacity-40"
          >
            {t('common.previous', 'قبلی')}
          </button>
          <span className="text-xs tabular-nums text-[hsl(var(--fg-secondary))]">
            {safePage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="rounded-full border border-[hsl(var(--border-default))] px-3 py-1 text-xs disabled:opacity-40"
          >
            {t('common.next', 'بعدی')}
          </button>
        </div>
      )}
    </div>
  )
})

TaskCustomerOutcomes.displayName = 'TaskCustomerOutcomes'
