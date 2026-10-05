// packages/ui/src/components/ui/workflow/approvals-view.tsx
'use client'

import { memo, useMemo, useState, type ReactNode } from 'react'
import { CalendarClock, ClipboardCheck, Hourglass, Loader } from 'lucide-react'

import { useDateFormat } from '../../../hooks/use-date-format'
import { DataTable, TableFilterSelect, matchesSearch, type TableColumn } from '../data-table'
import {
  ActionButton,
  Badge,
  CapabilityHeader,
  CapabilityPage,
  EmptyState,
  ErrorNote,
  Loading,
  Stat,
  StatGrid,
} from '../capability/capability-kit'

/* ══════════════════════════════════════════════════════════════════════════
   ApprovalsView — پیور presentational، بدون hook داده‌ای
   جواب یک جمله می‌دهد: «آمدم اینجا چون می‌خواهم ببینم چه چیزی منتظر تأیید من است».

   چیدمان همان ساختار فهرست فاکتورهاست: هدر، نوار آمار، یک DataTable با فیلتر
   وضعیت در نوار خودش. هر درخواست یک ردیف است؛ خط زمانی مراحل و فرم تأیید/رد
   — که در یک سلول جا نمی‌شود — با کلیک روی ردیف، زیر جدول باز می‌شود.

   ⚠️ سه عدد بالای صفحه همیشه هستند: هنگام بارگذاری «…»، و اگر خوانده نشد «—».
   قبلاً فقط وقتی فهرست می‌رسید ساخته می‌شدند و یک‌دفعه ظاهر می‌شدند.
   ══════════════════════════════════════════════════════════════════════════ */

export const APPROVAL_STATUS_FILTERS = ['pending', 'in_progress'] as const

export interface ApprovalListItem {
  id: string
  status: string
  /** What is waiting: 'invoice', 'expense', … */
  entityType: string
  currentStep: number
  totalSteps: number
  startedAt: string | null
  /** The steps and the approve/reject form of this request. */
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

const STATUS_TONE: Record<string, string> = { pending: 'warn', in_progress: 'neutral' }

/**
 * Whole days the OLDEST request has been waiting; null when nothing waits or
 * no request says when it started. A request with no start date is left out
 * rather than counted as waiting zero days.
 */
export function oldestWaitingDays(
  items: ReadonlyArray<{ startedAt: string | null }>,
  now: number,
): number | null {
  const started = items
    .map((item) => (item.startedAt ? Date.parse(item.startedAt) : Number.NaN))
    .filter((time) => Number.isFinite(time))
  if (started.length === 0) return null
  return Math.max(0, Math.floor((now - Math.min(...started)) / 86_400_000))
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
  const { date } = useDateFormat()
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  // The request whose steps and form are open under the table.
  const [openId, setOpenId] = useState<string | null>(null)

  const entityLabel = (item: ApprovalListItem) =>
    t(`workflow.entityType.${item.entityType}`, item.entityType)
  const statusLabel = (item: ApprovalListItem) => t(`workflow.status.${item.status}`, item.status)

  const visible = useMemo(
    () =>
      items
        .filter((item) => statusFilter === 'all' || item.status === statusFilter)
        .filter((item) =>
          matchesSearch(search, [
            t(`workflow.entityType.${item.entityType}`, item.entityType),
            t(`workflow.status.${item.status}`, item.status),
          ]),
        ),
    [items, search, statusFilter, t],
  )
  const open = openId ? items.find((item) => item.id === openId) : undefined

  const pendingCount = items.filter((item) => item.status === 'pending').length
  const inProgressCount = items.filter((item) => item.status === 'in_progress').length
  // Loading says «…»; a list that could not be read says «—». Neither is a number.
  const figure = (value: number) => (isLoading ? '…' : error ? '—' : value)
  const oldest = useMemo(() => oldestWaitingDays(items, Date.now()), [items])

  const columns: TableColumn<ApprovalListItem>[] = [
    {
      id: 'entity',
      labelKey: 'workflow.templates.entityType',
      labelFallback: 'روی چه چیزی',
      locked: true,
      sortValue: (item) => entityLabel(item),
      render: (item) => <span className="font-medium">{entityLabel(item)}</span>,
    },
    {
      id: 'status',
      labelKey: 'common.status',
      labelFallback: 'وضعیت',
      sortValue: (item) => item.status,
      render: (item) => (
        <Badge tone={STATUS_TONE[item.status] ?? 'neutral'}>{statusLabel(item)}</Badge>
      ),
    },
    {
      id: 'step',
      labelKey: 'workflow.step',
      labelFallback: 'مرحله',
      align: 'end',
      sortValue: (item) => item.currentStep,
      render: (item) => (
        <span className="tabular-nums" dir="ltr">
          {item.currentStep} / {item.totalSteps}
        </span>
      ),
    },
    {
      id: 'started',
      labelKey: 'workflow.started',
      labelFallback: 'شروع',
      showFrom: 'md',
      sortValue: (item) => item.startedAt,
      render: (item) => (
        <span className="whitespace-nowrap text-[hsl(var(--fg-secondary))]">
          {item.startedAt ? date(item.startedAt) : '—'}
        </span>
      ),
    },
  ]

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

      <StatGrid>
        <Stat
          icon={ClipboardCheck}
          label={t('workflow.awaiting_total', 'کل درخواست‌های منتظر')}
          value={figure(items.length)}
        />
        <Stat
          icon={Hourglass}
          label={t('workflow.status.pending', 'در انتظار')}
          value={figure(pendingCount)}
        />
        <Stat
          icon={Loader}
          label={t('workflow.status.in_progress', 'در حال بررسی')}
          value={figure(inProgressCount)}
        />
        {/* The fourth figure: how long the oldest request has been waiting. */}
        <Stat
          icon={CalendarClock}
          label={t('workflow.oldest_waiting', 'قدیمی‌ترین انتظار')}
          value={
            isLoading
              ? '…'
              : error || oldest === null
                ? '—'
                : `${oldest} ${t('workflow.days', 'روز')}`
          }
        />
      </StatGrid>

      {isLoading ? (
        <Loading label={t('common.loading', 'در حال بارگذاری…')} rows={3} />
      ) : error ? (
        <ErrorNote
          message={error}
          onRetry={onRetry}
          retryLabel={t('common.retry', 'تلاش دوباره')}
        />
      ) : (
        <>
          <DataTable
            tableId="approvals"
            t={t}
            rows={visible}
            columns={columns}
            rowKey={(item) => item.id}
            // A row opens its steps and its form under the table; again closes it.
            onRowClick={(item) => setOpenId((current) => (current === item.id ? null : item.id))}
            searchValue={search}
            onSearchChange={setSearch}
            actions={
              <TableFilterSelect
                label={t('workflow.status_filter', 'وضعیت درخواست')}
                value={statusFilter}
                onChange={setStatusFilter}
                allValue="all"
                options={[
                  { value: 'all', label: t('common.all', 'همه') },
                  ...APPROVAL_STATUS_FILTERS.map((status) => ({
                    value: status as string,
                    label: t(`workflow.status.${status}`, status),
                  })),
                ]}
              />
            }
            minWidthClass="min-w-[420px]"
            emptyState={
              <EmptyState
                icon={
                  <ClipboardCheck
                    className="size-12 text-[hsl(var(--fg-tertiary))]"
                    aria-hidden="true"
                  />
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
                        'تا وقتی یک گردش‌کار تأیید فعال نباشد، هیچ سندی برای تأیید به این صفحه نمی‌آید.',
                      ),
                      action: {
                        label: t('workflow.defineWorkflow', 'تعریف گردش‌کار تأیید'),
                        onClick: onDefineWorkflow,
                      },
                    }
                  : {})}
              />
            }
          />
          {open ? <div key={open.id}>{open.card}</div> : null}
        </>
      )}
    </CapabilityPage>
  )
})

ApprovalsView.displayName = 'ApprovalsView'
