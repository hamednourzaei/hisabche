// packages/ui/src/components/ui/crm/crm-view.tsx
'use client'

import { KpiCard, KpiGrid } from '../kpi-card'
import { DataTable, TableFilterSelect, matchesSearch, type TableColumn } from '../data-table'
import { SegmentedControl } from '../segmented-control'
import { memo, useMemo, useState, useCallback } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../select'
import { formatDate as formatIntlDate } from '@hisabche/formatting'

import { cn } from '../../../lib/utils'
import { useDateFormat } from '../../../hooks/use-date-format'
import {
  Handshake,
  Plus,
  X,
  ClipboardList,
  Users,
  Clock,
  PlayCircle,
  CheckCircle2,
} from 'lucide-react'
import { CustomerMultiPicker, type CustomerOption } from './customer-multi-picker'
import { TaskDetailModal } from './task-detail-modal'
import { TaskStatsChart, type EmployeeTaskStat } from './task-stats-chart'
import type { Interaction, TaskStatus } from '@hisabche/api'

/* ═══════════════════════════════════════════════════════════════════════════
   CrmView — Memoized · Performance Optimized
   ✅ memo · props صریح · بدون hook داده‌ای مستقیم
   ═══════════════════════════════════════════════════════════════════════════ */

export type CrmTabId = 'interactions' | 'opportunities'

export interface EmployeeOption {
  id: string
  name: string
}

interface CrmViewProps {
  t: (key: string, fallback?: string) => string
  activeTab: CrmTabId
  onTabChange: (tab: CrmTabId) => void
  interactions: Interaction[]
  employees: EmployeeOption[]
  isLoading: boolean
  error?: string | null
  isCreatingInteraction: boolean
  isUpdatingStatus: boolean
  onCreateInteraction: (input: {
    customerId: string
    customerIds: string[]
    employeeId: string
    employeeName: string
    type: string
    subject: string
    content: string
  }) => Promise<void>
  onUpdateStatus: (
    id: string,
    status: TaskStatus,
    assignee?: { id: string; name: string },
  ) => Promise<void>
  /** Records how one customer on a task went. */
  onRecordOutcome: (
    taskId: string,
    input: { customerId: string; outcome: 'done' | 'failed'; note?: string },
  ) => Promise<void>
  pendingCustomerId?: string | null | undefined
  /** Subjects already used by this user, for the autocomplete. */
  subjectSuggestions: readonly string[]
  getPublicTaskUrl: (token: string) => string
}

const INTERACTION_TYPES = ['call', 'meeting', 'email', 'note'] as const

/** The order a task moves through. */
const TASK_STATUSES: readonly TaskStatus[] = ['pending', 'in_progress', 'completed']

const STATUS_LABEL_KEY: Record<TaskStatus, [string, string]> = {
  pending: ['crm.status.pending', 'در حال انتظار'],
  in_progress: ['crm.status.inProgress', 'در حال انجام'],
  completed: ['crm.status.completed', 'کامل شد'],
}

const STATUS_BADGE_MAP: Record<TaskStatus, string> = {
  pending: 'bg-[hsl(var(--color-warning)/0.12)] text-[hsl(var(--color-warning))]',
  in_progress: 'bg-[hsl(var(--color-info)/0.12)] text-[hsl(var(--color-info))]',
  completed: 'bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]',
}

// ⚠️ THE CALENDAR IS NOT A CONSTANT. This was pinned to `'fa-AF'`, so an
// English reader got the Afghan solar calendar in Persian digits and an
// Iranian Persian reader got «سنبله» where their own calendar says «شهریور» —
// the right calendar with the wrong month names, which reads as a typo rather
// than a bug and so was never reported as one. It follows the UI language now.
function formatDate(lang: string, date?: string): string {
  if (!date) return '-'
  try {
    return formatIntlDate(date, lang, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return date
  }
}

export const CrmView = memo(function CrmView({
  t,
  activeTab,
  onTabChange,
  interactions,
  employees,
  isLoading,
  error,
  isCreatingInteraction,
  isUpdatingStatus,
  onRecordOutcome,
  pendingCustomerId = null,
  subjectSuggestions,
  onCreateInteraction,
  onUpdateStatus,
  getPublicTaskUrl,
}: CrmViewProps) {
  const [isFormOpen, setIsFormOpen] = useState(false)
  // The reader's calendar — see the helper above.
  const { lang } = useDateFormat()

  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [employeeId, setEmployeeId] = useState<string>('')
  const [type, setType] = useState<string>('call')
  const [subject, setSubject] = useState('')
  const [content, setContent] = useState('')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  const handleSubmit = useCallback(async () => {
    if (customers.length === 0 || !subject.trim() || !employeeId) return
    const employee = employees.find((e) => e.id === employeeId)
    await onCreateInteraction({
      customerId: customers[0]!.id,
      customerIds: customers.map((c) => c.id),
      employeeId,
      employeeName: employee?.name ?? '',
      type,
      subject: subject.trim(),
      content: content.trim(),
    })
    setCustomers([])
    setEmployeeId('')
    setType('call')
    setSubject('')
    setContent('')
    setIsFormOpen(false)
  }, [customers, employeeId, employees, type, subject, content, onCreateInteraction])

  const selectedTask = useMemo(
    () => interactions.find((i) => i.id === selectedTaskId) ?? null,
    [interactions, selectedTaskId],
  )

  // ─── Task stats (Part F) — real aggregates derived from the status field ──
  const { totalCount, pendingCount, inProgressCount, completedCount, employeeStats } =
    useMemo(() => {
      let pendingCount = 0
      let inProgressCount = 0
      let completedCount = 0
      const byEmployee = new Map<string, EmployeeTaskStat>()

      for (const task of interactions) {
        if (task.status === 'pending') pendingCount++
        else if (task.status === 'in_progress') inProgressCount++
        else if (task.status === 'completed') completedCount++

        const employeeName = task.employeeName || t('crm.unassigned', 'بدون تخصیص')
        const stat = byEmployee.get(employeeName) ?? {
          employee: employeeName,
          pending: 0,
          in_progress: 0,
          completed: 0,
        }
        stat[task.status]++
        byEmployee.set(employeeName, stat)
      }

      return {
        totalCount: interactions.length,
        pendingCount,
        inProgressCount,
        completedCount,
        employeeStats: Array.from(byEmployee.values()),
      }
    }, [interactions, t])

  const [taskSearch, setTaskSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const taskRows = useMemo(
    () =>
      interactions
        .filter((task) => statusFilter === 'all' || task.status === statusFilter)
        .filter((task) =>
          matchesSearch(taskSearch, [
            task.subject,
            task.employeeName ?? '',
            ...(task.customers ?? []).flatMap((customer) => [
              customer.name ?? '',
              customer.phone ?? '',
            ]),
          ]),
        ),
    [interactions, statusFilter, taskSearch],
  )

  const taskColumns = useMemo<TableColumn<Interaction>[]>(
    () => [
      {
        id: 'employee',
        labelKey: 'crm.employee',
        labelFallback: 'نام پرسنل',
        sortValue: (task) => task.employeeName ?? '',
        render: (task) => <span className="whitespace-nowrap">{task.employeeName || '-'}</span>,
      },
      {
        id: 'customerCount',
        labelKey: 'crm.customerCount',
        labelFallback: 'تعداد مشتری',
        showFrom: 'md',
        sortValue: (task) => (task.customers ?? []).length,
        render: (task) => (
          <span className="inline-flex items-center gap-1 text-xs text-[hsl(var(--fg-secondary))]">
            <Users className="size-3.5" />
            {(task.customers ?? []).length}
          </span>
        ),
      },
      {
        id: 'phone',
        labelKey: 'crm.customerPhone',
        labelFallback: 'شماره مشتری',
        showFrom: 'md',
        render: (task) => {
          const all = task.customers ?? []
          const first = all[0]
          return (
            <span className="whitespace-nowrap text-xs text-[hsl(var(--fg-secondary))]">
              {first?.phone ? (
                <>
                  {first.phone}
                  {all.length > 1 ? (
                    <span className="text-[hsl(var(--fg-tertiary))]"> +{all.length - 1}</span>
                  ) : null}
                </>
              ) : (
                '-'
              )}
            </span>
          )
        },
      },
      {
        id: 'subject',
        labelKey: 'crm.interactions.subject',
        labelFallback: 'موضوع',
        locked: true,
        sortValue: (task) => task.subject,
        render: (task) => <span className="font-medium">{task.subject}</span>,
      },
      {
        id: 'type',
        labelKey: 'crm.interactions.typeLabel',
        labelFallback: 'نوع',
        showFrom: 'md',
        sortValue: (task) => task.type,
        render: (task) => (
          <span className="text-xs text-[hsl(var(--fg-secondary))]">
            {t(`crm.interactions.type.${task.type}`, task.type)}
          </span>
        ),
      },
      {
        id: 'date',
        labelKey: 'crm.interactions.date',
        labelFallback: 'تاریخ',
        sortValue: (task) => task.interactionDate,
        render: (task) => (
          <span className="whitespace-nowrap text-xs text-[hsl(var(--fg-secondary))]">
            {formatDate(lang, task.interactionDate)}
          </span>
        ),
      },
      {
        id: 'status',
        labelKey: 'crm.process',
        labelFallback: 'فرایند',
        sortValue: (task) => TASK_STATUSES.indexOf(task.status),
        render: (task) => (
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-medium',
              STATUS_BADGE_MAP[task.status],
            )}
          >
            {t(...STATUS_LABEL_KEY[task.status])}
          </span>
        ),
      },
    ],
    [lang, t],
  )

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Handshake className="size-6 text-[hsl(var(--color-primary))]" />
        <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))]">
          {t('nav.followUp', 'پیگیری فروش')}
        </h1>
      </div>

      {/* One part on screen at a time — the shared switch, not a second tab bar. */}
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl
          label={t('nav.followUp', 'پیگیری فروش')}
          value={activeTab}
          onChange={onTabChange}
          options={[
            { value: 'interactions', label: t('crm.tabs.interactions', 'تعاملات') },
            { value: 'opportunities', label: t('crm.tabs.stats', 'آمار تعاملات') },
          ]}
        />
        {activeTab === 'interactions' && (
          <button
            type="button"
            onClick={() => setIsFormOpen((v) => !v)}
            className="ms-auto inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold text-white bg-[hsl(var(--color-primary))] hover:brightness-110 transition-all"
          >
            {isFormOpen ? <X className="size-4" /> : <Plus className="size-4" />}
            {t('crm.interactions.new', 'وظیفه جدید')}
          </button>
        )}
      </div>

      {/* ─── «وظیفه جدید» ─────────────────────────────────────────────────
        A MODAL (request #98-ب). As an inline panel it pushed the task list
        down the page on every open, and the customer picker's dropdown had to
        fight the rows underneath it for space. Same shell as
        `TaskDetailModal`, so both dialogs behave the same.
      */}
      {activeTab === 'interactions' && isFormOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t('crm.interactions.new', 'وظیفه جدید')}
        >
          <div
            className="absolute inset-0 bg-[hsl(var(--surface-base)/0.8)] backdrop-blur-sm"
            onClick={() => setIsFormOpen(false)}
          />
          <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-bold text-[hsl(var(--fg-primary))]">
                {t('crm.interactions.new', 'وظیفه جدید')}
              </h3>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                aria-label={t('action.close', 'بستن')}
                className="text-[hsl(var(--fg-tertiary))] hover:text-[hsl(var(--fg-primary))]"
              >
                <X className="size-5" />
              </button>
            </div>

            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger>
                <SelectValue placeholder={t('crm.pickEmployeePlaceholder', 'انتخاب پرسنل...')} />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <CustomerMultiPicker
              value={customers}
              onChange={setCustomers}
              placeholder={t('crm.pickCustomersPlaceholder', 'انتخاب مشتری‌ها...')}
            />

            <div className="grid grid-cols-2 gap-3">
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERACTION_TYPES.map((it) => (
                    <SelectItem key={it} value={it}>
                      {t(`crm.interactions.type.${it}`, it)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Free text, but backed by the subjects this user has already
                used. A recurring campaign keeps one spelling instead of
                fragmenting into near-duplicates that split the stats. A native
                datalist keeps typing unrestricted — a new subject is still
                just typed. */}
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                list="crm-subject-suggestions"
                autoComplete="off"
                placeholder={t('crm.interactions.subject', 'موضوع')}
                className="w-full rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-3 py-2.5 text-sm text-[hsl(var(--fg-primary))]"
              />
              <datalist id="crm-subject-suggestions">
                {subjectSuggestions.map((suggestion) => (
                  <option key={suggestion} value={suggestion} />
                ))}
              </datalist>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t('crm.interactions.contentPlaceholder', 'توضیحات (اختیاری)')}
              rows={2}
              className="w-full rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-3 py-2.5 text-sm text-[hsl(var(--fg-primary))] resize-none"
            />
            <button
              type="button"
              disabled={
                customers.length === 0 || !subject.trim() || !employeeId || isCreatingInteraction
              }
              onClick={handleSubmit}
              className="w-full rounded-full px-5 py-2.5 text-sm font-bold text-white bg-[hsl(var(--color-primary))] hover:brightness-110 disabled:opacity-40 transition-all"
            >
              {t('crm.interactions.create', 'ثبت وظیفه')}
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-2xl border border-[hsl(var(--color-destructive)/0.3)] bg-[hsl(var(--color-destructive)/0.05)] p-4 text-center text-[hsl(var(--color-destructive))]">
          {error}
        </div>
      )}

      {/* Body */}
      {activeTab === 'interactions' ? (
        <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] overflow-hidden">
          {isLoading ? (
            <div className="p-8 space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-12 rounded-xl bg-[hsl(var(--surface-muted))] animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="p-3 md:p-4">
              <DataTable
                tableId="crm-tasks"
                t={t}
                rows={taskRows}
                columns={taskColumns}
                rowKey={(task) => task.id}
                // A row opens the task — the same detail as before.
                onRowClick={(task) => setSelectedTaskId(task.id)}
                searchValue={taskSearch}
                onSearchChange={setTaskSearch}
                actions={
                  <TableFilterSelect
                    label={t('crm.process', 'فرایند')}
                    value={statusFilter}
                    onChange={setStatusFilter}
                    allValue="all"
                    options={[
                      { value: 'all', label: t('common.all', 'همه') },
                      ...TASK_STATUSES.map((status) => ({
                        value: status as string,
                        label: t(...STATUS_LABEL_KEY[status]),
                      })),
                    ]}
                  />
                }
                minWidthClass="min-w-[520px]"
                emptyState={
                  <div className="p-12 text-center">
                    <ClipboardList className="mx-auto mb-3 size-12 text-[hsl(var(--fg-tertiary))]" />
                    <p className="text-[hsl(var(--fg-secondary))]">
                      {interactions.length === 0
                        ? t('crm.interactions.empty', 'هیچ وظیفه‌ای ثبت نشده')
                        : t('crm.interactions.noMatch', 'وظیفه‌ای با این فیلتر نیست')}
                    </p>
                  </div>
                }
              />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* KPI cards */}
          <KpiGrid>
            {[
              {
                id: 'total',
                icon: ClipboardList,
                label: t('crm.stats.total', 'مجموع وظایف'),
                value: totalCount,
              },
              {
                id: 'in_progress',
                icon: PlayCircle,
                label: t('crm.status.inProgress', 'در حال انجام'),
                value: inProgressCount,
              },
              {
                id: 'pending',
                icon: Clock,
                label: t('crm.status.pending', 'در حال انتظار'),
                value: pendingCount,
              },
              {
                id: 'completed',
                icon: CheckCircle2,
                label: t('crm.status.completed', 'کامل شد'),
                value: completedCount,
              },
            ].map((card) => (
              <KpiCard key={card.id} label={card.label} value={card.value} icon={card.icon} />
            ))}
          </KpiGrid>

          {/* Bar chart: task count per employee, colored by status */}
          {isLoading ? (
            <div className="h-64 rounded-2xl bg-[hsl(var(--surface-muted))] animate-pulse" />
          ) : (
            <TaskStatsChart
              data={employeeStats}
              labels={{
                pending: t('crm.status.pending', 'در حال انتظار'),
                in_progress: t('crm.status.inProgress', 'در حال انجام'),
                completed: t('crm.status.completed', 'کامل شد'),
              }}
              emptyLabel={t('crm.opportunities.empty', 'هیچ وظیفه‌ای ثبت نشده')}
            />
          )}
        </div>
      )}

      {/* Task detail modal */}
      {selectedTask && (
        <TaskDetailModal
          t={t}
          task={selectedTask}
          publicTaskUrl={
            selectedTask.publicToken ? getPublicTaskUrl(selectedTask.publicToken) : null
          }
          isUpdating={isUpdatingStatus}
          onClose={() => setSelectedTaskId(null)}
          onUpdateStatus={(status, assignee) => onUpdateStatus(selectedTask.id, status, assignee)}
          employees={employees}
          onRecordOutcome={(input) => void onRecordOutcome(selectedTask.id, input)}
          pendingCustomerId={pendingCustomerId}
        />
      )}
    </div>
  )
})

CrmView.displayName = 'CrmView'
