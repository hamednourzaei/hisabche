// packages/ui/src/components/ui/workflow/workflow-templates-view.tsx
'use client'

import { memo, useState, useCallback } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../select'
import { cn } from '../../../lib/utils'
import { ListChecks, Plus, X } from 'lucide-react'
import type { Workflow, WorkflowEntityType, ApproverRole, WorkflowStep } from '@hisabche/api'

const ENTITY_TYPES: WorkflowEntityType[] = ['invoice', 'purchase_order', 'expense']
const APPROVER_ROLES: ApproverRole[] = ['sales_manager', 'finance_manager', 'ceo', 'admin']

interface WorkflowTemplatesViewProps {
  t: (key: string, fallback?: string) => string
  workflows: Workflow[]
  isLoading: boolean
  isCreating: boolean
  onCreate: (input: {
    name: string
    entity_type: WorkflowEntityType
    steps: WorkflowStep[]
  }) => Promise<void>
}

export const WorkflowTemplatesView = memo(function WorkflowTemplatesView({
  t,
  workflows,
  isLoading,
  isCreating,
  onCreate,
}: WorkflowTemplatesViewProps) {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [name, setName] = useState('')
  const [entityType, setEntityType] = useState<WorkflowEntityType>('invoice')
  const [approverRole, setApproverRole] = useState<ApproverRole>('finance_manager')

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) return
    await onCreate({
      name: name.trim(),
      entity_type: entityType,
      steps: [{ step_order: 1, approver_role: approverRole, is_final: true }],
    })
    setName('')
    setIsFormOpen(false)
  }, [name, entityType, approverRole, onCreate])

  return (
    <div className="space-y-6 max-w-3xl mx-auto px-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ListChecks className="size-6 text-[hsl(var(--color-primary))]" />
          <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))]">
            {t('workflow.templates.title', 'الگوهای تأیید')}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setIsFormOpen((v) => !v)}
          className={cn(
            'inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-white',
            'bg-[hsl(var(--color-primary))] hover:brightness-110 transition-all',
          )}
        >
          {isFormOpen ? <X className="size-4" /> : <Plus className="size-4" />}
          {t('workflow.templates.new', 'الگوی تازه')}
        </button>
      </div>

      <p className="text-sm text-[hsl(var(--fg-secondary))]">
        {t(
          'workflow.templates.description',
          'بدون حداقل یک الگوی فعال، هیچ فاکتور/سفارش خریدی وارد چرخه‌ی تأیید نمی‌شود.',
        )}
      </p>

      {isFormOpen && (
        <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[hsl(var(--fg-primary))]">
              {t('workflow.templates.name', 'نام الگو')}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t(
                'workflow.templates.namePlaceholder',
                'مثلاً: تأیید فاکتورهای بالای ۵۰۰۰۰',
              )}
              className="w-full rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-3 py-2.5 text-sm text-[hsl(var(--fg-primary))]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[hsl(var(--fg-primary))]">
                {t('workflow.templates.entityType', 'روی چه چیزی اعمال شود')}
              </label>
              {/* The project's Select, not the native element: `<select>`
                  cannot be styled consistently across browsers, ignores the
                  app's focus ring, and in RTL puts its arrow on the wrong
                  side. */}
              <Select
                value={entityType}
                onValueChange={(value) => setEntityType(value as WorkflowEntityType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPES.map((et) => (
                    <SelectItem key={et} value={et}>
                      {t(`workflow.entityType.${et}`, et)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[hsl(var(--fg-primary))]">
                {t('workflow.templates.approver', 'تأییدکننده')}
              </label>
              <Select
                value={approverRole}
                onValueChange={(value) => setApproverRole(value as ApproverRole)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APPROVER_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {t(`roles.${r}`, r)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <button
            type="button"
            disabled={!name.trim() || isCreating}
            onClick={handleSubmit}
            className={cn(
              'w-full rounded-full px-5 py-2.5 text-sm font-bold text-white',
              'bg-[hsl(var(--color-primary))] hover:brightness-110 disabled:opacity-40 transition-all',
            )}
          >
            {t('workflow.templates.create', 'ساخت الگو')}
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-14 rounded-xl bg-[hsl(var(--surface-muted))] animate-pulse"
              />
            ))}
          </div>
        ) : workflows.length === 0 ? (
          <div className="p-12 text-center">
            <ListChecks className="size-12 mx-auto mb-3 text-[hsl(var(--fg-tertiary))]" />
            <p className="text-[hsl(var(--fg-secondary))]">
              {t('workflow.templates.empty', 'هنوز هیچ الگویی نساخته‌اید')}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))]">
                <th className="px-4 py-3 text-start font-medium text-[hsl(var(--fg-secondary))] text-xs">
                  {t('workflow.templates.name', 'نام الگو')}
                </th>
                <th className="px-4 py-3 text-start font-medium text-[hsl(var(--fg-secondary))] text-xs">
                  {t('workflow.templates.entityType', 'روی چه چیزی')}
                </th>
                <th className="px-4 py-3 text-center font-medium text-[hsl(var(--fg-secondary))] text-xs">
                  {t('workflow.templates.status', 'وضعیت')}
                </th>
              </tr>
            </thead>
            <tbody>
              {workflows.map((w) => (
                <tr key={w.id} className="border-b border-[hsl(var(--border-default))]">
                  <td className="px-4 py-3 text-[hsl(var(--fg-primary))]">{w.name}</td>
                  <td className="px-4 py-3 text-xs text-[hsl(var(--fg-secondary))]">
                    {t(`workflow.entityType.${w.entity_type}`, w.entity_type)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-full text-xs font-medium',
                        w.is_active
                          ? 'bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]'
                          : 'bg-[hsl(var(--fg-tertiary)/0.12)] text-[hsl(var(--fg-tertiary))]',
                      )}
                    >
                      {w.is_active
                        ? t('workflow.templates.active', 'فعال')
                        : t('workflow.templates.inactive', 'غیرفعال')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
})

WorkflowTemplatesView.displayName = 'WorkflowTemplatesView'
