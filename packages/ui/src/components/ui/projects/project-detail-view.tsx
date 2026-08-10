// packages/ui/src/components/ui/projects/project-detail-view.tsx
'use client'

import { cn } from '../../../lib/utils'
import {
  ArrowRight,
  Plus,
  Trash2,
  Check,
  Circle,
  Clock,
  AlertCircle,
  X,
  CheckSquare,
  Square,
} from 'lucide-react'
import { useState, useCallback, useMemo, memo } from 'react'

/* ═══════════════════════════════════════════════════════════════════════════
   ProjectDetailView v4 — Memoized · Type-Safe
   ✅ memo · useCallback · useMemo · type-safe groupedTasks
   ✅ status dropdown per task (full lifecycle incl. review→done "approve")
   ✅ bulk selection + bulk done/todo toolbar
   ✅ progress computed live from tasks (fallback to project.progress)
   ═══════════════════════════════════════════════════════════════════════════ */

interface ProjectData {
  id: string
  name: string
  description?: string
  status: string
  priority: string
  progress: number
  start_date?: string
  end_date?: string
}

interface TaskData {
  id: string
  title: string
  status: string
  priority: string
  assignee_id?: string
  due_date?: string
  order_index: number
}

interface EmployeeRef {
  id: string
  first_name?: string
  last_name?: string
}

interface ProjectDetailViewProps {
  t: (key: string, fallback?: string) => string
  project: ProjectData | null | undefined
  isLoading: boolean
  tasks: TaskData[]
  tasksLoading: boolean
  employees?: EmployeeRef[]
  onUpdateProject: (values: Record<string, unknown>) => Promise<void>
  onCreateTask: (values: Record<string, unknown>) => Promise<void>
  onUpdateTask: (taskId: string, values: Record<string, unknown>) => Promise<void>
  onDeleteTask: (taskId: string) => Promise<void>
  onBack: () => void
}

// ─── Constants ──────────────────────────────────────────────────────────────

const TASK_STATUSES = ['todo', 'in_progress', 'review', 'done'] as const
type TaskStatus = (typeof TASK_STATUSES)[number]

const statusIconMap: Record<TaskStatus, React.ReactNode> = {
  done: <Check className="size-4 text-[hsl(var(--color-success))]" />,
  in_progress: <Clock className="size-4 text-[hsl(var(--color-primary))]" />,
  review: <AlertCircle className="size-4 text-[hsl(var(--color-warning))]" />,
  todo: <Circle className="size-4 text-[hsl(var(--fg-tertiary))]" />,
}

const statusLabelMap: Record<TaskStatus, string> = {
  todo: 'projects.todo',
  in_progress: 'projects.in_progress',
  review: 'projects.review',
  done: 'projects.done',
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getAssigneeName(
  assigneeId: string | undefined,
  employees: EmployeeRef[] | undefined,
): string | null {
  if (!assigneeId || !employees) return null
  const emp = employees.find((e) => e.id === assigneeId)
  if (!emp) return null
  return [emp.first_name, emp.last_name].filter(Boolean).join(' ') || null
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
}

// ─── Status Icon ────────────────────────────────────────────────────────────

const StatusIcon = memo(function StatusIcon({ status }: { status: string }) {
  const icon = statusIconMap[status as TaskStatus] || statusIconMap.todo
  return <>{icon}</>
})
StatusIcon.displayName = 'StatusIcon'

// ─── Task Card ─────────────────────────────────────────────────────────────

const TaskCard = memo(function TaskCard({
  task,
  employees,
  isSelected,
  onToggleSelect,
  onStatusChange,
  onDelete,
  t,
}: {
  task: TaskData
  employees: EmployeeRef[] | undefined
  isSelected: boolean
  onToggleSelect: (id: string) => void
  onStatusChange: (task: TaskData, status: TaskStatus) => void
  onDelete: (id: string) => void
  t: (key: string, fallback?: string) => string
}) {
  const isDone = task.status === 'done'
  const assigneeName = getAssigneeName(task.assignee_id, employees)

  const handleSelect = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onToggleSelect(task.id)
    },
    [task.id, onToggleSelect],
  )

  const handleStatusChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onStatusChange(task, e.target.value as TaskStatus)
    },
    [task, onStatusChange],
  )

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onDelete(task.id)
    },
    [task.id, onDelete],
  )

  return (
    <div
      className={cn(
        'group rounded-xl border bg-[hsl(var(--surface-elevated))] p-3 transition-colors',
        isSelected
          ? 'border-[hsl(var(--color-primary))] ring-1 ring-[hsl(var(--color-primary)/0.3)]'
          : 'border-[hsl(var(--border-default))] hover:border-[hsl(var(--color-primary)/0.3)]',
        isDone && 'opacity-60',
      )}
    >
      <div className="flex items-start gap-2">
        <button
          onClick={handleSelect}
          className="shrink-0 mt-0.5 text-[hsl(var(--fg-tertiary))] hover:text-[hsl(var(--color-primary))]"
          aria-label="select task"
        >
          {isSelected ? (
            <CheckSquare className="size-4 text-[hsl(var(--color-primary))]" />
          ) : (
            <Square className="size-4" />
          )}
        </button>
        <p className={cn('flex-1 text-sm', isDone && 'line-through')}>{task.title}</p>
        <button
          onClick={handleDelete}
          className="shrink-0 p-0.5 rounded hover:bg-[hsl(var(--color-destructive)/0.1)] text-[hsl(var(--color-destructive))] opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Delete task"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {/* Status dropdown — full lifecycle, incl. review → done ("approve") */}
      <select
        value={task.status in statusLabelMap ? task.status : 'todo'}
        onChange={handleStatusChange}
        onClick={(e) => e.stopPropagation()}
        aria-label={t('projects.changeStatus', 'تغییر وضعیت')}
        className="mt-2 w-full rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted)/0.5)] px-2 py-1 text-xs focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)]"
      >
        {TASK_STATUSES.map((s) => (
          <option key={s} value={s}>
            {t(statusLabelMap[s], s)}
          </option>
        ))}
      </select>

      <div className="flex items-center justify-between mt-2">
        {assigneeName ? (
          <div className="flex items-center gap-1.5">
            <span className="flex items-center justify-center size-5 rounded-full bg-[hsl(var(--color-primary)/0.15)] text-[9px] font-bold text-[hsl(var(--color-primary))]">
              {getInitials(assigneeName)}
            </span>
            <span className="text-[10px] text-[hsl(var(--fg-secondary))]">{assigneeName}</span>
          </div>
        ) : (
          <span className="text-[10px] text-[hsl(var(--fg-tertiary))]">
            {t('projects.unassigned', 'بدون مسئول')}
          </span>
        )}
        {task.due_date && (
          <p className="text-[10px] text-[hsl(var(--fg-tertiary))]">{task.due_date}</p>
        )}
      </div>
    </div>
  )
})
TaskCard.displayName = 'TaskCard'

// ─── Column ─────────────────────────────────────────────────────────────────

const TaskColumn = memo(function TaskColumn({
  status,
  tasks,
  employees,
  selectedIds,
  onToggleSelect,
  onStatusChange,
  onDelete,
  t,
}: {
  status: string
  tasks: TaskData[]
  employees: EmployeeRef[] | undefined
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onStatusChange: (task: TaskData, status: TaskStatus) => void
  onDelete: (id: string) => void
  t: (key: string, fallback?: string) => string
}) {
  const label = t(statusLabelMap[status as TaskStatus] || `projects.${status}`, status)

  return (
    <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted)/0.5)] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[hsl(var(--fg-primary))] flex items-center gap-1.5">
          <StatusIcon status={status} />
          {label}
        </h3>
        <span className="text-xs text-[hsl(var(--fg-tertiary))]">{tasks.length}</span>
      </div>
      <div className="space-y-2">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            employees={employees}
            isSelected={selectedIds.has(task.id)}
            onToggleSelect={onToggleSelect}
            onStatusChange={onStatusChange}
            onDelete={onDelete}
            t={t}
          />
        ))}
      </div>
    </div>
  )
})
TaskColumn.displayName = 'TaskColumn'

// ─── Main Component ─────────────────────────────────────────────────────────

export const ProjectDetailView = memo(function ProjectDetailView({
  t,
  project,
  isLoading,
  tasks,
  tasksLoading,
  employees,
  onUpdateProject,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
  onBack,
}: ProjectDetailViewProps) {
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)

  const handleAddTask = useCallback(async () => {
    const trimmed = newTaskTitle.trim()
    if (!trimmed) return
    await onCreateTask({ title: trimmed, status: 'todo', priority: 'medium' })
    setNewTaskTitle('')
  }, [newTaskTitle, onCreateTask])

  const handleStatusChange = useCallback(
    async (task: TaskData, status: TaskStatus) => {
      if (task.status === status) return
      await onUpdateTask(task.id, { status })
    },
    [onUpdateTask],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleAddTask()
      }
    },
    [handleAddTask],
  )

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(tasks.map((task) => task.id)))
  }, [tasks])

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const handleBulkSetStatus = useCallback(
    async (status: 'done' | 'todo') => {
      if (selectedIds.size === 0) return
      setBulkBusy(true)
      try {
        await Promise.all(Array.from(selectedIds).map((id) => onUpdateTask(id, { status })))
        setSelectedIds(new Set())
      } finally {
        setBulkBusy(false)
      }
    },
    [selectedIds, onUpdateTask],
  )

  // ✅ useMemo برای groupedTasks با type-safe
  const groupedTasks = useMemo(() => {
    const groups: Record<TaskStatus, TaskData[]> = {
      todo: [],
      in_progress: [],
      review: [],
      done: [],
    }
    for (const task of tasks) {
      const status = task.status as TaskStatus
      if (status in groups) {
        groups[status].push(task)
      } else {
        groups.todo.push(task)
      }
    }
    return groups
  }, [tasks])

  // ✅ پیشرفت به‌صورت زنده از روی وظایف محاسبه می‌شود (بدون نیاز به رفرش)
  // با fallback به project.progress وقتی هنوز وظیفه‌ای لود نشده
  const { computedProgress, doneCount, totalCount } = useMemo(() => {
    const total = tasks.length
    const done = groupedTasks.done.length
    return {
      totalCount: total,
      doneCount: done,
      computedProgress: total > 0 ? Math.round((done / total) * 100) : (project?.progress ?? 0),
    }
  }, [tasks.length, groupedTasks.done.length, project?.progress])

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 p-8">
        <div className="h-8 w-48 rounded bg-[hsl(var(--surface-muted))] animate-pulse" />
        <div className="h-60 rounded-2xl bg-[hsl(var(--surface-muted))] animate-pulse" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center">
        <p className="text-[hsl(var(--fg-secondary))]">
          {t('projects.notFound', 'پروژه پیدا نشد')}
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4 sm:p-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-[hsl(var(--fg-secondary))] hover:text-[hsl(var(--fg-primary))]"
        >
          <ArrowRight className="size-4" />
          {t('action.back', 'برگشت')}
        </button>
        <h1 className="text-xl font-bold text-[hsl(var(--fg-primary))]">{project.name}</h1>
      </div>

      {/* Progress / Roadmap signal */}
      <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-[hsl(var(--fg-secondary))]">
            {t('projects.progress', 'پیشرفت')}
          </span>
          <span className="text-sm font-bold text-[hsl(var(--fg-primary))]">
            {computedProgress}%
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-[hsl(var(--surface-muted))] overflow-hidden">
          <div
            className="h-full rounded-full bg-[hsl(var(--color-primary))] transition-all"
            style={{ width: `${computedProgress}%` }}
          />
        </div>
        {totalCount > 0 && (
          <p className="mt-2 text-[11px] text-[hsl(var(--fg-tertiary))]">
            {doneCount} / {totalCount} {t('projects.tasksDoneLabel', 'وظیفه انجام‌شده')}
          </p>
        )}
      </div>

      {/* Selection toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={handleSelectAll}
          disabled={tasks.length === 0}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium',
            'border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]',
            'hover:border-[hsl(var(--color-primary)/0.4)] disabled:opacity-40 transition-colors',
          )}
        >
          <CheckSquare className="size-3.5" />
          {t('projects.selectAll', 'انتخاب همه')}
        </button>

        {selectedIds.size > 0 && (
          <>
            <span className="text-xs text-[hsl(var(--fg-secondary))]">
              {selectedIds.size} {t('projects.selectedSuffix', 'مورد انتخاب شده')}
            </span>
            <button
              onClick={() => handleBulkSetStatus('done')}
              disabled={bulkBusy}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold',
                'bg-[hsl(var(--color-success)/0.15)] text-[hsl(var(--color-success))]',
                'hover:brightness-110 disabled:opacity-50 transition',
              )}
            >
              <Check className="size-3.5" />
              {t('projects.markDone', 'علامت به‌عنوان انجام‌شده')}
            </button>
            <button
              onClick={() => handleBulkSetStatus('todo')}
              disabled={bulkBusy}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold',
                'bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-secondary))]',
                'hover:brightness-110 disabled:opacity-50 transition',
              )}
            >
              <Circle className="size-3.5" />
              {t('projects.markTodo', 'بازگشت به برای انجام')}
            </button>
            <button
              onClick={handleClearSelection}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs text-[hsl(var(--fg-tertiary))] hover:text-[hsl(var(--fg-primary))]"
            >
              <X className="size-3.5" />
              {t('projects.clearSelection', 'لغو انتخاب')}
            </button>
          </>
        )}
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {TASK_STATUSES.map((status) => (
          <TaskColumn
            key={status}
            status={status}
            tasks={groupedTasks[status] ?? []}
            employees={employees}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onStatusChange={handleStatusChange}
            onDelete={onDeleteTask}
            t={t}
          />
        ))}
      </div>

      {/* Add Task */}
      <div className="flex gap-3">
        <input
          type="text"
          placeholder={t('projects.taskTitle', 'عنوان تسک جدید...')}
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-4 py-2.5 text-sm focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)]"
        />
        <button
          onClick={handleAddTask}
          className={cn(
            'inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold',
            'bg-[hsl(var(--color-primary))] text-[hsl(var(--color-primary-fg))]',
            'hover:brightness-110 transition',
          )}
        >
          <Plus className="size-4" />
          {t('projects.newTask', 'تسک جدید')}
        </button>
      </div>
    </div>
  )
})

ProjectDetailView.displayName = 'ProjectDetailView'
