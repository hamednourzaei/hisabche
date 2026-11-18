'use client'

// ============================================
// Expiry on a product's page (request #95).
//
// Goods received on different days expire on different days, so the dates live
// on BATCHES (`stock_batches`) — the same rows the expiry report and the FEFO
// issue queue read. This panel lists this product's batches and lets a mistyped
// date be corrected; quantities are not editable here, because they are what
// the movements and the lot trail already say.
//
// WP-05 adds the other reason a carton must not be sold: a RECALL. Blocking a
// batch keeps its quantity (the goods exist and their value is on the books)
// and takes it out of every allocation, online and offline.
// ============================================

import { useState } from 'react'
import { Ban, CalendarClock, Pencil, ShieldCheck } from 'lucide-react'
import {
  useBatches,
  useRecallBatch,
  useReleaseBatchRecall,
  useUpdateBatchDates,
} from '@hisabche/api'
import { toIsoDay } from '@hisabche/formatting'

import { cn } from '../../../lib/utils'
import { JalaliDatePicker } from '../jalali-datepicker'
import { Input } from '../input'
import { useDateFormat } from '../../../hooks/use-date-format'

type T = (key: string, fallback?: string) => string

/**
 * Days until the date; negative when it has passed. null when there is none.
 *
 * ⚠️ `toIsoDay` for today, never `toISOString()`: the latter is UTC, and in
 * Kabul (+4:30) local midnight is still the previous day there — which would
 * show goods as expiring «tomorrow» on the morning they expire.
 */
export function daysUntil(date: string | null | undefined, today = new Date()): number | null {
  if (!date) return null
  const target = Date.parse(`${date.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(target)) return null
  const now = Date.parse(`${toIsoDay(today)}T00:00:00Z`)
  return Math.round((target - now) / 86_400_000)
}

export function expiryTone(days: number | null): 'expired' | 'soon' | 'ok' | 'none' {
  if (days === null) return 'none'
  if (days < 0) return 'expired'
  // 30 days is the window the expiry report already calls «near expiry».
  return days <= 30 ? 'soon' : 'ok'
}

const TONE_CLASS: Record<string, string> = {
  expired: 'bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))]',
  soon: 'bg-[hsl(var(--color-warning)/0.12)] text-[hsl(var(--color-warning))]',
  ok: 'bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]',
  none: 'bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-secondary))]',
}

export function ProductExpiryPanel({ t, productId }: { t: T; productId: string }) {
  const { date } = useDateFormat()
  const { data, isLoading, isError, refetch } = useBatches(productId)
  const update = useUpdateBatchDates()
  const recall = useRecallBatch()
  const release = useReleaseBatchRecall()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [recallId, setRecallId] = useState<string | null>(null)
  const [recallReason, setRecallReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const batches = data ?? []

  const save = async (batchId: string) => {
    try {
      await update.mutateAsync({ batchId, expiryDate: draft || null })
      setEditingId(null)
      setError(null)
    } catch {
      setError(t('warehouse.saveFailed', 'ذخیره نشد. دوباره تلاش کنید.'))
    }
  }

  const block = async (batchId: string) => {
    // A block nobody can explain is a block the next person undoes.
    const reason = recallReason.trim()
    if (reason.length === 0) {
      setError(t('warehouse.recallReasonRequired', 'دلیل بلاک را بنویسید.'))
      return
    }
    try {
      await recall.mutateAsync({ batchId, reason })
      setRecallId(null)
      setRecallReason('')
      setError(null)
    } catch {
      setError(t('warehouse.recallFailed', 'بلاک نشد. دوباره تلاش کنید.'))
    }
  }

  const unblock = async (batchId: string) => {
    try {
      await release.mutateAsync(batchId)
      setError(null)
    } catch {
      setError(t('warehouse.releaseRecallFailed', 'آزادسازی نشد. دوباره تلاش کنید.'))
    }
  }

  return (
    <section className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-[hsl(var(--fg-primary))]">
        <CalendarClock className="size-4" aria-hidden="true" />
        {t('warehouse.expiryTitle', 'تاریخ انقضا')}
      </h2>

      {isLoading ? (
        <p className="py-6 text-center text-sm text-[hsl(var(--fg-secondary))]">
          {t('common.loading', 'در حال بارگذاری…')}
        </p>
      ) : isError ? (
        <p role="alert" className="py-6 text-center text-sm text-[hsl(var(--color-destructive))]">
          {t('warehouse.loadError', 'اطلاعات خوانده نشد.')}{' '}
          <button type="button" className="underline" onClick={() => void refetch()}>
            {t('common.retry', 'تلاش دوباره')}
          </button>
        </p>
      ) : batches.length === 0 ? (
        <p className="py-6 text-center text-sm text-[hsl(var(--fg-secondary))]">
          {t('warehouse.noBatches', 'برای این کالا تاریخ انقضایی ثبت نشده است.')}
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-[hsl(var(--border-default)/0.6)]">
          {batches.map((batch) => {
            const days = daysUntil(batch.expiryDate)
            const tone = expiryTone(days)
            return (
              <li
                key={batch.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
              >
                <span className="flex min-w-0 flex-col">
                  <span dir="ltr" className="truncate font-medium text-[hsl(var(--fg-primary))]">
                    {batch.batchNumber}
                  </span>
                  <span className="text-xs text-[hsl(var(--fg-tertiary))]">
                    {t('warehouse.remaining', 'باقی‌مانده')}: {batch.remainingQty}
                  </span>
                  {batch.recalledAt ? (
                    <span className="text-xs font-medium text-[hsl(var(--color-destructive))]">
                      {t('warehouse.recalled', 'بلاک‌شده')}
                      {batch.recalledReason ? ` · ${batch.recalledReason}` : ''}
                    </span>
                  ) : null}
                </span>

                {recallId === batch.id ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <Input
                      value={recallReason}
                      onChange={(event) => setRecallReason(event.target.value)}
                      maxLength={500}
                      placeholder={t(
                        'warehouse.recallReason',
                        'دلیل بلاک — مثلاً فراخوان تأمین‌کننده',
                      )}
                      aria-label={t('warehouse.recallReasonLabel', 'دلیل بلاک')}
                      className="w-56"
                    />
                    <button
                      type="button"
                      onClick={() => void block(batch.id)}
                      disabled={recall.isPending}
                      className="text-xs font-medium text-[hsl(var(--color-destructive))]"
                    >
                      {t('warehouse.recallConfirm', 'بلاک کن')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRecallId(null)
                        setRecallReason('')
                        setError(null)
                      }}
                      className="text-xs text-[hsl(var(--fg-secondary))]"
                    >
                      {t('common.cancel', 'انصراف')}
                    </button>
                  </span>
                ) : editingId === batch.id ? (
                  <span className="flex items-center gap-2">
                    <span className="w-44">
                      <JalaliDatePicker
                        value={draft}
                        onChange={setDraft}
                        placeholder={t('warehouse.expiryDate', 'تاریخ انقضا')}
                      />
                    </span>
                    <button
                      type="button"
                      onClick={() => void save(batch.id)}
                      disabled={update.isPending}
                      className="text-xs font-medium text-[hsl(var(--color-primary))]"
                    >
                      {t('common.save', 'ذخیره')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="text-xs text-[hsl(var(--fg-secondary))]"
                    >
                      {t('common.cancel', 'انصراف')}
                    </button>
                  </span>
                ) : (
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={cn('rounded-full px-2 py-0.5 text-xs', TONE_CLASS[tone])}>
                      {batch.expiryDate
                        ? `${date(batch.expiryDate)}${
                            days === null
                              ? ''
                              : days < 0
                                ? ` · ${t('warehouse.expired', 'منقضی')}`
                                : ` · ${days} ${t('warehouse.daysLeft', 'روز')}`
                          }`
                        : t('warehouse.noExpiry', 'بدون انقضا')}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setRecallId(null)
                        setEditingId(batch.id)
                        setDraft(batch.expiryDate ?? '')
                      }}
                      aria-label={t('warehouse.editExpiry', 'ویرایش تاریخ انقضا')}
                      className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-[hsl(var(--color-primary))] hover:bg-[hsl(var(--surface-muted))]"
                    >
                      <Pencil className="size-3.5" aria-hidden="true" />
                      {t('common.edit', 'ویرایش')}
                    </button>
                    {batch.recalledAt ? (
                      <button
                        type="button"
                        onClick={() => void unblock(batch.id)}
                        disabled={release.isPending}
                        className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-[hsl(var(--color-success))] hover:bg-[hsl(var(--surface-muted))]"
                      >
                        <ShieldCheck className="size-3.5" aria-hidden="true" />
                        {t('warehouse.releaseRecall', 'آزادسازی')}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null)
                          setRecallId(batch.id)
                          setRecallReason('')
                          setError(null)
                        }}
                        className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-[hsl(var(--color-destructive))] hover:bg-[hsl(var(--surface-muted))]"
                      >
                        <Ban className="size-3.5" aria-hidden="true" />
                        {t('warehouse.recall', 'بلاک')}
                      </button>
                    )}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {error ? (
        <p role="alert" className="mt-2 text-sm text-[hsl(var(--color-destructive))]">
          {error}
        </p>
      ) : null}
    </section>
  )
}
