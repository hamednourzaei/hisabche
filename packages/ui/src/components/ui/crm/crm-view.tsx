// packages/ui/src/components/ui/crm/crm-view.tsx
'use client'

import { memo, useMemo, useState, useCallback } from 'react'
import { cn } from '../../../lib/utils'
import {
  Handshake,
  MessageSquare,
  BarChart3,
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
  onUpdateStatus: (id: string, status: TaskStatus) => Promise<void>
  getPublicTaskUrl: (token: string) => string
}

const INTERACTION_TYPES = ['call', 'meeting', 'email', 'note'] as const

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

function formatDate(date?: string): string {
  if (!date) return '-'
  try {
    return new Date(date).toLocaleDateString('fa-AF', {
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
  onCreateInteraction,
  onUpdateStatus,
  getPublicTaskUrl,
}: CrmViewProps) {
  const [isFormOpen, setIsFormOpen] = useState(false)
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

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Handshake className="size-6 text-[hsl(var(--color-primary))]" />
        <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))]">
          {t('nav.followUp', 'پیگیری فروش')}
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[hsl(var(--border-default))]">
        <button
          type="button"
          onClick={() => onTabChange('interactions')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === 'interactions'
              ? 'border-[hsl(var(--color-primary))] text-[hsl(var(--color-primary))]'
              : 'border-transparent text-[hsl(var(--fg-tertiary))] hover:text-[hsl(var(--fg-primary))]',
          )}
        >
          <MessageSquare className="size-4" />
          {t('crm.tabs.interactions', 'تعاملات')}
        </button>
        <button
          type="button"
          onClick={() => onTabChange('opportunities')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === 'opportunities'
              ? 'border-[hsl(var(--color-primary))] text-[hsl(var(--color-primary))]'
              : 'border-transparent text-[hsl(var(--fg-tertiary))] hover:text-[hsl(var(--fg-primary))]',
          )}
        >
          <BarChart3 className="size-4" />
          {t('crm.tabs.stats', 'آمار تعاملات')}
        </button>
        {activeTab === 'interactions' && (
          <button
            type="button"
            onClick={() => setIsFormOpen((v) => !v)}
            className="ms-auto mb-1 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold text-white bg-[hsl(var(--color-primary))] hover:brightness-110 transition-all"
          >
            {isFormOpen ? <X className="size-4" /> : <Plus className="size-4" />}
            {t('crm.interactions.new', 'وظیفه جدید')}
          </button>
        )}
      </div>

      {/* New Task Form */}
      {activeTab === 'interactions' && isFormOpen && (
        <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-5 space-y-4">
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="w-full rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-3 py-2.5 text-sm text-[hsl(var(--fg-primary))]"
          >
            <option value="">{t('crm.pickEmployeePlaceholder', 'انتخاب پرسنل...')}</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </select>

          <CustomerMultiPicker
            value={customers}
            onChange={setCustomers}
            placeholder={t('crm.pickCustomersPlaceholder', 'انتخاب مشتری‌ها...')}
          />

          <div className="grid grid-cols-2 gap-3">
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-3 py-2.5 text-sm text-[hsl(var(--fg-primary))]"
            >
              {INTERACTION_TYPES.map((it) => (
                <option key={it} value={it}>
                  {t(`crm.interactions.type.${it}`, it)}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t('crm.interactions.subject', 'موضوع')}
              className="w-full rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-3 py-2.5 text-sm text-[hsl(var(--fg-primary))]"
            />
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
          ) : interactions.length === 0 ? (
            <div className="p-12 text-center">
              <ClipboardList className="size-12 mx-auto mb-3 text-[hsl(var(--fg-tertiary))]" />
              <p className="text-[hsl(var(--fg-secondary))]">
                {t('crm.interactions.empty', 'هیچ وظیفه‌ای ثبت نشده')}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))]">
                    <th className="px-4 py-3 text-start font-medium text-[hsl(var(--fg-secondary))] text-xs">
                      {t('crm.employee', 'نام پرسنل')}
                    </th>
                    <th className="px-4 py-3 text-start font-medium text-[hsl(var(--fg-secondary))] text-xs">
                      {t('crm.customerCount', 'تعداد مشتری')}
                    </th>
                    <th className="px-4 py-3 text-start font-medium text-[hsl(var(--fg-secondary))] text-xs">
                      {t('crm.customerPhone', 'شماره مشتری')}
                    </th>
                    <th className="px-4 py-3 text-start font-medium text-[hsl(var(--fg-secondary))] text-xs">
                      {t('crm.interactions.subject', 'موضوع')}
                    </th>
                    <th className="px-4 py-3 text-start font-medium text-[hsl(var(--fg-secondary))] text-xs">
                      {t('crm.interactions.type', 'نوع')}
                    </th>
                    <th className="px-4 py-3 text-start font-medium text-[hsl(var(--fg-secondary))] text-xs">
                      {t('crm.interactions.date', 'تاریخ')}
                    </th>
                    <th className="px-4 py-3 text-start font-medium text-[hsl(var(--fg-secondary))] text-xs">
                      {t('crm.process', 'فرایند')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {interactions.map((interaction) => {
                    const custs = interaction.customers ?? []
                    const first = custs[0]
                    const extra = custs.length - 1
                    return (
                      <tr
                        key={interaction.id}
                        onClick={() => setSelectedTaskId(interaction.id)}
                        className="cursor-pointer border-b border-[hsl(var(--border-default))] hover:bg-[hsl(var(--surface-muted)/0.5)] transition-colors"
                      >
                        <td className="px-4 py-3 text-[hsl(var(--fg-primary))] whitespace-nowrap">
                          {interaction.employeeName || '-'}
                        </td>
                        <td className="px-4 py-3 text-xs text-[hsl(var(--fg-secondary))]">
                          <span className="inline-flex items-center gap-1">
                            <Users className="size-3.5" />
                            {custs.length}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-[hsl(var(--fg-secondary))] whitespace-nowrap">
                          {first?.phone ? (
                            <>
                              {first.phone}
                              {extra > 0 && (
                                <span className="text-[hsl(var(--fg-tertiary))]"> +{extra}</span>
                              )}
                            </>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-4 py-3 text-[hsl(var(--fg-primary))]">
                          {interaction.subject}
                        </td>
                        <td className="px-4 py-3 text-xs text-[hsl(var(--fg-secondary))]">
                          {t(`crm.interactions.type.${interaction.type}`, interaction.type)}
                        </td>
                        <td className="px-4 py-3 text-xs text-[hsl(var(--fg-secondary))] whitespace-nowrap">
                          {formatDate(interaction.interactionDate)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded-full text-xs font-medium',
                              STATUS_BADGE_MAP[interaction.status],
                            )}
                          >
                            {t(...STATUS_LABEL_KEY[interaction.status])}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
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
              <div
                key={card.id}
                className="min-w-0 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-2.5 sm:p-4 space-y-1 sm:space-y-2"
              >
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <card.icon
                    className="size-3.5 sm:size-4 shrink-0 text-[hsl(var(--color-primary))]"
                    aria-hidden="true"
                  />
                  <span className="truncate text-[10px] sm:text-xs text-[hsl(var(--fg-secondary))]">
                    {card.label}
                  </span>
                </div>
                <p className="truncate text-sm sm:text-xl font-bold tabular-nums text-[hsl(var(--fg-primary))]">
                  {card.value}
                </p>
              </div>
            ))}
          </div>

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
          onUpdateStatus={(status) => onUpdateStatus(selectedTask.id, status)}
        />
      )}
    </div>
  )
})

CrmView.displayName = 'CrmView'
