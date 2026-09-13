// packages/ui/src/components/ui/workflow/approvals-view.tsx
'use client'

import { memo, useMemo, useState, type ReactNode } from 'react'
import { ClipboardCheck, Hourglass, Loader } from 'lucide-react'

import { SegmentedFilter } from '../segmented-filter'
import {
  ActionButton,
  CapabilityHeader,
  CapabilityPage,
  EmptyState,
  ErrorNote,
  Loading,
  Stat,
  StatGrid,
} from '../capability/capability-kit'

/* ═══════════════════════════════════════════════════════════════════════════
   ApprovalsView — پیور presentational، بدون hook داده‌ای
   جواب یک جمله می‌دهد: «آمدم اینجا چون می‌خواهم ببینم چه چیزی منتظر تأیید من است»

   چیدمان همان ساختار فهرست فاکتورهاست: هدر، فیلتر وضعیت، نوار آمار، فهرست.
   فهرست کارت می‌ماند، نه DataTable: هر ردیف یک خط زمانی مراحل و فرم
   تأیید/رد با توضیح دارد که در یک سلول جدول جا نمی‌شود.
   ═══════════════════════════════════════════════════════════════════════════ */

export type ApprovalStatusFilter = 'all' | 'pending' | 'in_progress'

export interface ApprovalListItem {
  id: string
  status: string
  card: ReactNode
}

interface ApprovalsViewProps {
  t: (key: string, fallback?: string) => string
  isLoading: boolean
  /** جدا از «خالی»: درخواستِ شکسته نباید «چیزی منتظر شما نیست» خوانده شود. */
  error: string | null
  items: ApprovalListItem[]
  onRetry: () => void
}

export const ApprovalsView = memo(function ApprovalsView({
  t,
  isLoading,
  error,
  items,
  onRetry,
}: ApprovalsViewProps) {
  const [statusFilter, setStatusFilter] = useState<ApprovalStatusFilter>('all')

  const visible = useMemo(
    () => (statusFilter === 'all' ? items : items.filter((item) => item.status === statusFilter)),
    [items, statusFilter],
  )

  const pendingCount = items.filter((item) => item.status === 'pending').length
  const inProgressCount = items.filter((item) => item.status === 'in_progress').length

  return (
    <CapabilityPage>
      <CapabilityHeader
        title={t('nav.approvals', 'در انتظار تأیید شما')}
        description={t('nav.approvals_description', 'درخواست‌هایی که باید تأیید یا رد کنید')}
        action={
          <ActionButton variant="quiet" onClick={onRetry} disabled={isLoading}>
            {t('common.refresh', 'تازه‌سازی')}
          </ActionButton>
        }
      />

      <SegmentedFilter
        label={t('workflow.status_filter', 'وضعیت درخواست')}
        value={statusFilter}
        onChange={setStatusFilter}
        options={[
          { value: 'all', label: t('common.all', 'همه') },
          { value: 'pending', label: t('workflow.status.pending', 'در انتظار') },
          { value: 'in_progress', label: t('workflow.status.in_progress', 'در حال بررسی') },
        ]}
      />

      {!isLoading && !error && items.length > 0 ? (
        <StatGrid>
          <Stat
            icon={ClipboardCheck}
            label={t('workflow.awaiting_total', 'کل درخواست‌های منتظر')}
            value={items.length}
          />
          <Stat
            icon={Hourglass}
            label={t('workflow.status.pending', 'در انتظار')}
            value={pendingCount}
          />
          <Stat
            icon={Loader}
            label={t('workflow.status.in_progress', 'در حال بررسی')}
            value={inProgressCount}
          />
        </StatGrid>
      ) : null}

      {isLoading ? (
        <Loading label={t('common.loading', 'در حال بارگذاری…')} rows={3} />
      ) : error ? (
        <ErrorNote
          message={error}
          onRetry={onRetry}
          retryLabel={t('common.retry', 'تلاش دوباره')}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={
            <ClipboardCheck className="size-12 text-[hsl(var(--fg-tertiary))]" aria-hidden="true" />
          }
          title={
            items.length === 0
              ? t('nav.approvals_empty', 'چیزی در انتظار تأیید شما نیست')
              : t('workflow.no_match', 'درخواستی با این وضعیت نیست')
          }
        />
      ) : (
        <div className="space-y-4">
          {visible.map((item) => (
            <div key={item.id}>{item.card}</div>
          ))}
        </div>
      )}
    </CapabilityPage>
  )
})

ApprovalsView.displayName = 'ApprovalsView'
