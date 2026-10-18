// packages/ui/src/components/ui/workflow/workflow-templates-view.tsx
'use client'

import { memo, useState, useCallback, type ReactNode } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../select'
import { cn } from '../../../lib/utils'
import { DataTable, TableFilterSelect, matchesSearch, type TableColumn } from '../data-table'
import { ListChecks, Plus, X } from 'lucide-react'
import type { Workflow, WorkflowEntityType, ApproverRole, WorkflowStep } from '@hisabche/api'
import { formatNumber } from '@hisabche/formatting'
import { typedNumber } from '../../../lib/typed-number'
import { useIntlLocale } from '../../../hooks/use-intl-locale'
import type { ApprovalCondition } from '../../../lib/workflow/approval-rule'

/** «بیشتر از» as typed: empty = every invoice; anything else must be a positive number. */
function readMinTotal(text: string): { ok: true; value: number | null } | { ok: false } {
  if (text.trim() === '') return { ok: true, value: null }
  const value = typedNumber(text)
  return value !== null && value > 0 ? { ok: true, value } : { ok: false }
}

/** «شرط بگذار» for a template no rule names — the owner's existing templates. */
function ConditionSetter({
  t,
  disabled,
  onSave,
}: {
  t: (key: string, fallback?: string) => string
  disabled: boolean
  onSave: (minTotal: number | null) => Promise<void>
}) {
  const [text, setText] = useState('')
  const parsed = readMinTotal(text)
  return (
    <div className="flex items-center gap-2" data-condition-setter>
      <input
        type="text"
        inputMode="decimal"
        dir="ltr"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={t('workflow.condition.amountPlaceholder', 'مثلاً ۵۰۰۰')}
        aria-label={t('workflow.condition.above', 'فاکتورهای با مبلغ بیشتر از')}
        className="h-9 w-28 rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-2 text-xs tabular-nums"
      />
      <button
        type="button"
        disabled={disabled || !parsed.ok}
        onClick={() => (parsed.ok ? onSave(parsed.value) : undefined)}
        className="h-9 shrink-0 rounded-full bg-[hsl(var(--color-primary))] px-3 text-xs font-bold text-[hsl(var(--color-primary-fg))] disabled:opacity-40"
      >
        {t('workflow.condition.set', 'شرط بگذار')}
      </button>
    </div>
  )
}

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
    /** Invoice templates: «مبلغ بیشتر از». null = every invoice. */
    minTotal: number | null
  }) => Promise<void>
  /**
   * When a template actually holds invoices — the rule that names it. null
   * while loading; 'error' when the rules could not be read.
   */
  conditionOf?: ((workflow: Workflow) => ApprovalCondition | 'error' | null) | undefined
  /** Write the rule for a template that has none. */
  onSetCondition?: ((workflow: Workflow, minTotal: number | null) => Promise<void>) | undefined
  isSavingCondition?: boolean | undefined
  /** The escalation control of one workflow (it fetches and saves on its own). */
  renderEscalation?: ((workflow: Workflow) => ReactNode) | undefined
}

export const WorkflowTemplatesView = memo(function WorkflowTemplatesView({
  t,
  workflows,
  isLoading,
  isCreating,
  onCreate,
  conditionOf,
  onSetCondition,
  isSavingCondition = false,
  renderEscalation,
}: WorkflowTemplatesViewProps) {
  const locale = useIntlLocale()
  const [minTotalText, setMinTotalText] = useState('')
  const minTotal = readMinTotal(minTotalText)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [name, setName] = useState('')
  const [entityType, setEntityType] = useState<WorkflowEntityType>('invoice')
  const [approverRole, setApproverRole] = useState<ApproverRole>('finance_manager')

  const handleSubmit = useCallback(async () => {
    if (!name.trim() || !minTotal.ok) return
    await onCreate({
      name: name.trim(),
      entity_type: entityType,
      steps: [{ step_order: 1, approver_role: approverRole, is_final: true }],
      minTotal: entityType === 'invoice' ? minTotal.value : null,
    })
    setName('')
    setMinTotalText('')
    setIsFormOpen(false)
  }, [name, entityType, approverRole, minTotal, onCreate])

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const rows = workflows
    .filter(
      (workflow) => statusFilter === 'all' || workflow.is_active === (statusFilter === 'active'),
    )
    .filter((workflow) =>
      matchesSearch(search, [
        workflow.name,
        t(`workflow.entityType.${workflow.entity_type}`, workflow.entity_type),
      ]),
    )
  const columns: TableColumn<Workflow>[] = [
    {
      id: 'name',
      labelKey: 'workflow.templates.name',
      labelFallback: 'نام الگو',
      locked: true,
      sortValue: (workflow) => workflow.name,
      render: (workflow) => <span className="font-medium">{workflow.name}</span>,
    },
    {
      id: 'entityType',
      labelKey: 'workflow.templates.entityType',
      labelFallback: 'روی چه چیزی',
      sortValue: (workflow) => workflow.entity_type,
      render: (workflow) => (
        <span className="text-xs text-[hsl(var(--fg-secondary))]">
          {t(`workflow.entityType.${workflow.entity_type}`, workflow.entity_type)}
        </span>
      ),
    },
    {
      id: 'status',
      labelKey: 'workflow.templates.status',
      labelFallback: 'وضعیت',
      sortValue: (workflow) => (workflow.is_active ? 0 : 1),
      render: (workflow) => (
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-medium',
            workflow.is_active
              ? 'bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]'
              : 'bg-[hsl(var(--fg-tertiary)/0.12)] text-[hsl(var(--fg-tertiary))]',
          )}
        >
          {workflow.is_active
            ? t('workflow.templates.active', 'فعال')
            : t('workflow.templates.inactive', 'غیرفعال')}
        </span>
      ),
    },
    ...(conditionOf
      ? [
          {
            id: 'condition',
            labelKey: 'workflow.condition.title',
            labelFallback: 'چه فاکتوری منتظر تأیید می‌ماند',
            render: (workflow: Workflow) => {
              // Only invoices ask the rules today (decideApprovalRoute); a
              // purchase-order or expense template holds nothing — said, not hidden.
              if (workflow.entity_type !== 'invoice') {
                return (
                  <span className="text-xs text-[hsl(var(--fg-tertiary))]">
                    {t('workflow.condition.notWired', 'برای این نوع سند هنوز تأیید اعمال نمی‌شود')}
                  </span>
                )
              }
              const condition = conditionOf(workflow)
              if (condition === null) return <span className="text-xs">…</span>
              if (condition === 'error') {
                return (
                  <span role="alert" className="text-xs text-[hsl(var(--color-destructive))]">
                    {t('workflow.condition.readFailed', 'شرط‌ها خوانده نشد')}
                  </span>
                )
              }
              if (condition.kind === 'above') {
                return (
                  <span className="text-xs font-medium" data-condition="above">
                    {t('workflow.condition.above', 'فاکتورهای با مبلغ بیشتر از')}{' '}
                    {formatNumber(condition.amount, locale)}
                  </span>
                )
              }
              if (condition.kind === 'always') {
                return (
                  <span className="text-xs font-medium" data-condition="always">
                    {t('workflow.condition.always', 'همه‌ی فاکتورها')}
                  </span>
                )
              }
              return (
                <div className="space-y-1.5" data-condition="none">
                  <p className="text-xs text-[hsl(var(--color-warning))]">
                    {t(
                      'workflow.condition.none',
                      'بدون شرط — هیچ فاکتوری منتظر این الگو نمی‌ماند.',
                    )}
                  </p>
                  {onSetCondition ? (
                    <ConditionSetter
                      t={t}
                      disabled={isSavingCondition}
                      onSave={(value) => onSetCondition(workflow, value)}
                    />
                  ) : null}
                </div>
              )
            },
          } satisfies TableColumn<Workflow>,
        ]
      : []),
    ...(renderEscalation
      ? [
          {
            id: 'escalation',
            labelKey: 'workflow.escalation.title',
            labelFallback: 'ارجاع خودکار',
            render: (workflow: Workflow) => renderEscalation(workflow),
          } satisfies TableColumn<Workflow>,
        ]
      : []),
  ]

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

          {entityType === 'invoice' ? (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[hsl(var(--fg-primary))]">
                {t('workflow.condition.above', 'فاکتورهای با مبلغ بیشتر از')}
              </label>
              <input
                type="text"
                inputMode="decimal"
                dir="ltr"
                value={minTotalText}
                onChange={(event) => setMinTotalText(event.target.value)}
                placeholder={t('workflow.condition.amountPlaceholder', 'مثلاً ۵۰۰۰')}
                data-min-total=""
                className="w-full rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-3 py-2.5 text-sm tabular-nums text-[hsl(var(--fg-primary))]"
              />
              <p className="text-xs text-[hsl(var(--fg-tertiary))]">
                {minTotal.ok
                  ? t(
                      'workflow.condition.hint',
                      'خالی بگذارید تا همه‌ی فاکتورها منتظر تأیید بمانند. مبلغ به ارز خودِ فاکتور است.',
                    )
                  : t('workflow.condition.badAmount', 'مبلغ باید عددی بزرگ‌تر از صفر باشد.')}
              </p>
            </div>
          ) : (
            <p className="text-xs text-[hsl(var(--fg-tertiary))]">
              {t('workflow.condition.notWired', 'برای این نوع سند هنوز تأیید اعمال نمی‌شود')}
            </p>
          )}

          <button
            type="button"
            disabled={!name.trim() || !minTotal.ok || isCreating}
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
        ) : (
          <div className="p-3 md:p-4">
            <DataTable
              tableId="workflow-templates"
              t={t}
              rows={rows}
              columns={columns}
              rowKey={(workflow) => workflow.id}
              searchValue={search}
              onSearchChange={setSearch}
              actions={
                <TableFilterSelect
                  label={t('workflow.templates.status', 'وضعیت')}
                  value={statusFilter}
                  onChange={setStatusFilter}
                  allValue="all"
                  options={[
                    { value: 'all', label: t('common.all', 'همه') },
                    { value: 'active', label: t('workflow.templates.active', 'فعال') },
                    { value: 'inactive', label: t('workflow.templates.inactive', 'غیرفعال') },
                  ]}
                />
              }
              minWidthClass="min-w-[420px]"
              emptyState={
                <div className="p-12 text-center">
                  <ListChecks className="mx-auto mb-3 size-12 text-[hsl(var(--fg-tertiary))]" />
                  <p className="text-[hsl(var(--fg-secondary))]">
                    {workflows.length === 0
                      ? t('workflow.templates.empty', 'هنوز هیچ الگویی نساخته‌اید')
                      : t('workflow.templates.noMatch', 'الگویی با این فیلتر نیست')}
                  </p>
                </div>
              }
            />
          </div>
        )}
      </div>
    </div>
  )
})

WorkflowTemplatesView.displayName = 'WorkflowTemplatesView'
