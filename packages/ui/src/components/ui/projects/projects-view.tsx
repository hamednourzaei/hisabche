// packages/ui/src/components/ui/projects/projects-view.tsx
'use client'

import { cn } from '../../../lib/utils'
import { Plus, Kanban, Trash2, Eye, Calendar, Users } from 'lucide-react'
import { useState, useCallback, useMemo, memo } from 'react'

/* ═══════════════════════════════════════════════════════════════════════════
   ProjectsView v4 — Fully Type-Safe
   ✅ memo · useCallback · useMemo · type-safe status/priority
   ═══════════════════════════════════════════════════════════════════════════ */

// ✅ export types برای Container
export type StatusType = 'planning' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled'
export type PriorityType = 'low' | 'medium' | 'high' | 'urgent'

interface Project {
  id: string
  name: string
  description?: string
  status: StatusType
  priority: PriorityType
  progress: number
  start_date?: string
  end_date?: string
  created_at: string
}

interface ProjectsViewProps {
  t: (key: string, fallback?: string) => string
  projects: Project[]
  isLoading: boolean
  status: StatusType | undefined
  onStatusChange: (status: StatusType | undefined) => void
  onCreate: (values: Record<string, unknown>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onView: (id: string) => void
}

// ─── Constants ──────────────────────────────────────────────────────────────

const STATUSES: StatusType[] = ['planning', 'in_progress', 'on_hold', 'completed', 'cancelled']
const PRIORITIES: PriorityType[] = ['low', 'medium', 'high', 'urgent']

// ✅ type-safe maps
const statusColorMap: Record<StatusType, string> = {
  planning: 'bg-[hsl(var(--color-info)/0.12)] text-[hsl(var(--color-info))]',
  in_progress: 'bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))]',
  on_hold: 'bg-[hsl(var(--color-warning)/0.12)] text-[hsl(var(--color-warning))]',
  completed: 'bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]',
  cancelled: 'bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))]',
}

const priorityColorMap: Record<PriorityType, string> = {
  low: 'text-[hsl(var(--fg-tertiary))]',
  medium: 'text-[hsl(var(--color-info))]',
  high: 'text-[hsl(var(--color-warning))]',
  urgent: 'text-[hsl(var(--color-destructive))]',
}

function getStatusColor(status: StatusType): string {
  return statusColorMap[status]
}

function getPriorityColor(priority: PriorityType): string {
  return priorityColorMap[priority]
}

// ─── Status Filter Button ──────────────────────────────────────────────────

const StatusFilterButton = memo(function StatusFilterButton({
  label,
  value,
  currentStatus,
  onClick,
}: {
  label: string
  value: StatusType | undefined
  currentStatus: StatusType | undefined
  onClick: (value: StatusType | undefined) => void
}) {
  const isActive = currentStatus === value
  return (
    <button
      onClick={() => onClick(value)}
      className={cn(
        'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
        isActive
          ? 'bg-[hsl(var(--color-primary))] text-white'
          : 'border border-[hsl(var(--border-default))] hover:bg-[hsl(var(--surface-muted))]',
      )}
    >
      {label}
    </button>
  )
})
StatusFilterButton.displayName = 'StatusFilterButton'

// ─── Project Card ──────────────────────────────────────────────────────────

const ProjectCard = memo(function ProjectCard({
  project,
  onView,
  onDelete,
  t,
}: {
  project: Project
  onView: (id: string) => void
  onDelete: (id: string) => void
  t: (key: string, fallback?: string) => string
}) {
  const handleView = useCallback(() => onView(project.id), [project.id, onView])
  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onDelete(project.id)
    },
    [project.id, onDelete],
  )

  return (
    <div
      className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-5 space-y-3 hover:border-[hsl(var(--color-primary)/0.3)] transition-colors cursor-pointer"
      onClick={handleView}
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-[hsl(var(--fg-primary))]">{project.name}</h3>
          {project.description && (
            <p className="text-xs text-[hsl(var(--fg-secondary))] mt-0.5 line-clamp-2">
              {project.description}
            </p>
          )}
        </div>
        <button
          onClick={handleDelete}
          className="p-1.5 rounded-lg hover:bg-[hsl(var(--color-destructive)/0.1)] text-[hsl(var(--color-destructive))]"
          aria-label="Delete project"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={cn(
            'px-2 py-0.5 rounded-full text-xs font-medium',
            getStatusColor(project.status),
          )}
        >
          {t(`projects.${project.status}`, project.status)}
        </span>
        <span className={cn('text-xs', getPriorityColor(project.priority))}>
          {t(`projects.${project.priority}`, project.priority)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 rounded-full bg-[hsl(var(--surface-muted))] overflow-hidden">
        <div
          className="h-full rounded-full bg-[hsl(var(--color-primary))] transition-all"
          style={{ width: `${project.progress || 0}%` }}
        />
      </div>

      <div className="flex items-center gap-4 text-xs text-[hsl(var(--fg-tertiary))]">
        {project.start_date && (
          <span className="flex items-center gap-1">
            <Calendar className="size-3" />
            {project.start_date}
          </span>
        )}
        <span>{project.progress || 0}%</span>
      </div>
    </div>
  )
})
ProjectCard.displayName = 'ProjectCard'

// ─── Form Component ────────────────────────────────────────────────────────

interface FormData {
  name: string
  description: string
  priority: PriorityType
  startDate: string
}

const ProjectForm = memo(function ProjectForm({
  form,
  setForm,
  onSubmit,
  onCancel,
  t,
  isSubmitting,
}: {
  form: FormData
  setForm: (data: FormData) => void
  onSubmit: () => void
  onCancel: () => void
  t: (key: string, fallback?: string) => string
  isSubmitting: boolean
}) {
  const handleFieldChange = useCallback(
    <K extends keyof FormData>(field: K, value: FormData[K]) => {
      setForm({ ...form, [field]: value })
    },
    [form, setForm],
  )

  return (
    <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-6 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <input
          placeholder={t('projects.projectName', 'نام پروژه')}
          value={form.name}
          onChange={(e) => handleFieldChange('name', e.target.value)}
          className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-4 py-2.5 text-sm focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)]"
        />
        <select
          value={form.priority}
          onChange={(e) => handleFieldChange('priority', e.target.value as PriorityType)}
          className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-4 py-2.5 text-sm focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)]"
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {t(`projects.${p}`, p)}
            </option>
          ))}
        </select>
        <input
          placeholder={t('projects.description', 'شرح')}
          value={form.description}
          onChange={(e) => handleFieldChange('description', e.target.value)}
          className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-4 py-2.5 text-sm focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)] sm:col-span-2"
        />
        <input
          type="date"
          value={form.startDate}
          onChange={(e) => handleFieldChange('startDate', e.target.value)}
          className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-4 py-2.5 text-sm focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)]"
        />
      </div>
      <div className="flex gap-3">
        <button
          onClick={onSubmit}
          disabled={isSubmitting}
          className="rounded-full bg-[hsl(var(--color-primary))] text-white px-6 py-2.5 text-sm font-bold disabled:opacity-50"
        >
          {isSubmitting ? '...' : t('action.save', 'ذخیره')}
        </button>
        <button
          onClick={onCancel}
          className="rounded-full border border-[hsl(var(--border-default))] px-6 py-2.5 text-sm"
        >
          {t('action.cancel', 'لغو')}
        </button>
      </div>
    </div>
  )
})
ProjectForm.displayName = 'ProjectForm'

// ─── Main Component ─────────────────────────────────────────────────────────

export const ProjectsView = memo(function ProjectsView({
  t,
  projects,
  isLoading,
  status,
  onStatusChange,
  onCreate,
  onDelete,
  onView,
}: ProjectsViewProps) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormData>({
    name: '',
    description: '',
    priority: 'medium',
    startDate: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true)
    try {
      await onCreate({
        name: form.name,
        description: form.description || undefined,
        priority: form.priority,
        startDate: form.startDate ? `${form.startDate}T00:00:00.000Z` : new Date().toISOString(),
        status: 'planning' as StatusType,
        budget: 0,
        currency: 'AFN',
        tags: [],
      })
      setShowForm(false)
      setForm({ name: '', description: '', priority: 'medium', startDate: '' })
    } finally {
      setIsSubmitting(false)
    }
  }, [form, onCreate])

  const handleCancel = useCallback(() => {
    setShowForm(false)
    setForm({ name: '', description: '', priority: 'medium', startDate: '' })
  }, [])

  const toggleForm = useCallback(() => {
    setShowForm((prev) => !prev)
  }, [])

  // ✅ useMemo برای project cards
  const projectCards = useMemo(
    () =>
      projects.map((p) => (
        <ProjectCard key={p.id} project={p} onView={onView} onDelete={onDelete} t={t} />
      )),
    [projects, onView, onDelete, t],
  )

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Kanban className="size-6 text-[hsl(var(--color-primary))]" />
          <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))]">
            {t('projects.title', 'پروژه‌ها')}
          </h1>
        </div>
        <button
          onClick={toggleForm}
          className={cn(
            'inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold',
            'bg-[hsl(var(--color-primary))] text-[hsl(var(--color-primary-fg))]',
            'hover:brightness-110 transition',
          )}
        >
          <Plus className="size-4" />
          {t('projects.newProject', 'پروژه جدید')}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <ProjectForm
          form={form}
          setForm={setForm}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          t={t}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Status Filter */}
      <div className="flex flex-wrap gap-2">
        <StatusFilterButton
          label={t('common.all', 'همه')}
          value={undefined}
          currentStatus={status}
          onClick={onStatusChange}
        />
        {STATUSES.map((s) => (
          <StatusFilterButton
            key={s}
            label={t(`projects.${s}`, s)}
            value={s}
            currentStatus={status}
            onClick={onStatusChange}
          />
        ))}
      </div>

      {/* Projects Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-32 rounded-2xl bg-[hsl(var(--surface-muted))] animate-pulse"
            />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]">
          <Kanban className="size-12 mx-auto mb-3 text-[hsl(var(--fg-tertiary))]" />
          <p className="text-[hsl(var(--fg-secondary))]">
            {t('projects.noProjects', 'هیچ پروژه‌ای ثبت نشده')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{projectCards}</div>
      )}
    </div>
  )
})

ProjectsView.displayName = 'ProjectsView'
