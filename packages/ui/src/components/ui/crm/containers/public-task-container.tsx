'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, ClipboardList, User, Phone, Check, PlayCircle } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import { TaskCustomerOutcomes } from '../task-customer-outcomes'

/* ═══════════════════════════════════════════════════════════
   PublicTaskContainer — read-only-except-status, no-login task
   view. Fetches GET /api/public/tasks/:token and advances status
   via PATCH /api/public/tasks/:token/status (no auth header).
   Used by apps/web/app/[lang]/public-task/[token]/page.tsx —
   modeled on public-invoice-container.tsx.
   ═══════════════════════════════════════════════════════════ */

const BASE_URL =
  (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_API_URL : undefined) ||
  'https://api.hisabche.com/api'

type TaskStatus = 'pending' | 'in_progress' | 'completed'

interface PublicTaskResponse {
  id: string
  subject: string
  content?: string
  type: string
  status: TaskStatus
  interactionDate: string
  employeeName?: string | null
  customers?: Array<{ id: string; name: string; phone: string | null }>
  customerOutcomes?: Array<{
    customerId: string
    outcome: 'done' | 'failed'
    recordedAt: string
    recordedBy: 'owner' | 'employee'
    note?: string
  }>
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: 'در حال انتظار',
  in_progress: 'در حال انجام',
  completed: 'کامل شد',
}

export function PublicTaskContainer({ token }: { token: string }) {
  const t = useTranslations()
  const safeT = (key: string, fallback?: string) => {
    const v = t(key)
    return v && v !== key ? v : (fallback ?? key)
  }

  const [data, setData] = useState<PublicTaskResponse | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [pendingCustomerId, setPendingCustomerId] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(false)
    fetch(`${BASE_URL}/public/tasks/${token}`)
      .then((res) => {
        if (!res.ok) throw new Error('not ok')
        return res.json()
      })
      .then((json: PublicTaskResponse) => setData(json))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const advanceStatus = useCallback(
    async (status: TaskStatus) => {
      setUpdating(true)
      try {
        const res = await fetch(`${BASE_URL}/public/tasks/${token}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        })
        if (!res.ok) throw new Error('not ok')
        const json: PublicTaskResponse = await res.json()
        setData(json)
      } catch {
        /* keep prior state; user can retry */
      } finally {
        setUpdating(false)
      }
    },
    [token],
  )

  const recordOutcome = useCallback(
    async (input: { customerId: string; outcome: 'done' | 'failed'; note?: string }) => {
      setPendingCustomerId(input.customerId)
      try {
        const res = await fetch(`${BASE_URL}/public/tasks/${token}/customer-outcome`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        })
        if (!res.ok) throw new Error('not ok')

        // The response carries the whole task, so the table re-renders from
        // the server's copy rather than a locally guessed one.
        const json: PublicTaskResponse = await res.json()
        setData(json)
      } catch {
        /* keep prior state; the row returns to its buttons so it can be retried */
      } finally {
        setPendingCustomerId(null)
      }
    },
    [token],
  )

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-[hsl(var(--color-primary))]" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <ClipboardList className="size-16 text-[hsl(var(--fg-tertiary))]" />
        <p className="text-lg text-[hsl(var(--fg-secondary))]">
          {safeT('crm.taskNotFound', 'این وظیفه پیدا نشد')}
        </p>
      </div>
    )
  }

  const customers = data.customers ?? []

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-6 space-y-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="size-5 text-[hsl(var(--color-primary))]" />
          <h1 className="text-lg font-bold text-[hsl(var(--fg-primary))]">{data.subject}</h1>
        </div>

        <span
          className={cn(
            'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
            data.status === 'completed'
              ? 'bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]'
              : data.status === 'in_progress'
                ? 'bg-[hsl(var(--color-info)/0.12)] text-[hsl(var(--color-info))]'
                : 'bg-[hsl(var(--color-warning)/0.12)] text-[hsl(var(--color-warning))]',
          )}
        >
          {STATUS_LABEL[data.status]}
        </span>

        {data.content && <p className="text-sm text-[hsl(var(--fg-secondary))]">{data.content}</p>}

        {data.employeeName && (
          <p className="flex items-center gap-1.5 text-sm text-[hsl(var(--fg-primary))]">
            <User className="size-4 text-[hsl(var(--fg-tertiary))]" />
            {data.employeeName}
          </p>
        )}

        {customers.length > 0 && (
          <div className="border-t border-[hsl(var(--border-default))] pt-3">
            {/* The employee marks each customer individually here. Same panel
                the owner sees, so both read the same table. */}
            <TaskCustomerOutcomes
              t={safeT}
              customers={customers}
              outcomes={data.customerOutcomes ?? []}
              onRecord={recordOutcome}
              pendingCustomerId={pendingCustomerId}
            />
          </div>
        )}

        <div className="flex gap-2 border-t border-[hsl(var(--border-default))] pt-4">
          {data.status === 'pending' && (
            <button
              type="button"
              disabled={updating}
              onClick={() => advanceStatus('in_progress')}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-bold text-white bg-[hsl(var(--color-primary))] hover:brightness-110 disabled:opacity-40 transition-all"
            >
              {updating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <PlayCircle className="size-4" />
              )}
              {safeT('crm.startTask', 'شروع انجام')}
            </button>
          )}
          {data.status === 'in_progress' && (
            <button
              type="button"
              disabled={updating}
              onClick={() => advanceStatus('completed')}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-bold text-white bg-[hsl(var(--color-success))] hover:brightness-110 disabled:opacity-40 transition-all"
            >
              {updating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              {safeT('crm.markComplete', 'تکمیل شد')}
            </button>
          )}
          {data.status === 'completed' && (
            <p className="flex-1 text-center text-sm font-medium text-[hsl(var(--color-success))]">
              {safeT('crm.taskDone', 'این وظیفه تکمیل شده است')}
            </p>
          )}
        </div>
      </div>
      <p className="text-center text-sm text-[hsl(var(--fg-tertiary))]">
        {safeT('app.name', 'حسابچه')}
      </p>
    </div>
  )
}
