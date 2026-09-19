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
  /**
   * ⚠️ «نبودِ یک نشانه، نشانه نیست» (راهنمای سشن، §۷٫۵).
   *
   * An empty approvals page has two completely different meanings and used to
   * show one sentence for both: «چیزی در انتظار تأیید شما نیست». That reads as
   * "you are up to date" — but if this workspace has never defined an approval
   * workflow, NOTHING is ever routed here, and the page will stay empty
   * forever while the user waits for a document to appear in it.
   *
   * `null` = we do not know yet (still loading); the page then says nothing
   * about the cause rather than guessing.
   */
  hasActiveWorkflow: boolean | null
  /** Take the user to where an approval workflow is actually defined. */
  onDefineWorkflow: () => void
}

export const ApprovalsView = memo(function ApprovalsView({
  t,
  isLoading,
  error,
  items,
  onRetry,
  hasActiveWorkflow,
  onDefineWorkflow,
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
            items.length > 0
              ? t('workflow.no_match', 'درخواستی با این وضعیت نیست')
              : hasActiveWorkflow === false
                ? t('workflow.noWorkflowTitle', 'هنوز هیچ گردش‌کار تأییدی تعریف نشده')
                : t('nav.approvals_empty', 'چیزی در انتظار تأیید شما نیست')
          }
          {...(items.length === 0 && hasActiveWorkflow === false
            ? {
                description: t(
                  'workflow.noWorkflowHint',
                  'تا وقتی یک گردش‌کار تأیید فعال نباشد، هیچ سندی برای تأیید به این صفحه نمی‌آید — فاکتورها مستقیم ثبت می‌شوند.',
                ),
                action: {
                  label: t('workflow.defineWorkflow', 'تعریف گردش‌کار تأیید'),
                  onClick: onDefineWorkflow,
                },
              }
            : {})}
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
