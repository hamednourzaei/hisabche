'use client'

// ============================================
// packages/ui/src/components/ui/timesheets/timesheets-view.tsx
//
// Time on a project, and what of it can be billed.
//
// ---------------------------------------------------------------------------
// MINUTES ALL THE WAY DOWN
//
// The person types hours and minutes; what crosses the wire is an integer
// count of minutes. 1.5 hours is 90, never 1.5 — a float here is a bill that
// drifts by a few afghani a month and by a real amount over a year.
//
// The billing preview BILLS NOTHING. It shows the invoice lines the unbilled
// time would produce, and its `problems` list names the reasons hours cannot
// be billed. Those reasons are shown, not swallowed: "there is nothing to
// bill" and "there are forty hours nobody set a rate for" look identical on a
// screen that hides them.
//
// Profitability values labour at COST, not at the billing rate. Using the
// billing rate on both sides makes every project look like it broke exactly
// even, which is the most common way a loss is discovered at year end.
// ============================================

import { memo, useState } from 'react'
import type {
  BillableLine,
  ProjectProfitability,
  ProjectBillingConfig,
  TimeTotals,
} from '@hisabche/api'
import {
  ActionButton,
  Badge,
  CapabilityHeader,
  CapabilityPage,
  ErrorNote,
  Field,
  Loading,
  Money,
  Panel,
  Stat,
  StatGrid,
  formatMinutes,
  NumberField,
  SelectField,
} from '../capability/capability-kit'

export interface TimesheetProjectOption {
  id: string
  name: string
}

export interface TimesheetsViewProps {
  t: (key: string, fallback?: string) => string
  projects: TimesheetProjectOption[]
  selectedProjectId: string | null
  config: ProjectBillingConfig | null
  totals: TimeTotals | null
  previewLines: BillableLine[]
  previewProblems: string[]
  profitability: ProjectProfitability | null
  isLoading: boolean
  isDetailLoading: boolean
  error: string | null
  actionError: string | null
  isBusy: boolean
  onSelectProject: (projectId: string) => void
  onLogTime: (input: {
    employeeId: string
    onDate: string
    minutes: number
    billable: boolean
    description: string
  }) => void
  onRefresh: () => void
}

export const TimesheetsView = memo(function TimesheetsView({
  t,
  projects,
  selectedProjectId,
  config,
  totals,
  previewLines,
  previewProblems,
  profitability,
  isLoading,
  isDetailLoading,
  error,
  actionError,
  isBusy,
  onSelectProject,
  onLogTime,
  onRefresh,
}: TimesheetsViewProps) {
  const [employeeId, setEmployeeId] = useState('')
  const [onDate, setOnDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [hours, setHours] = useState(0)
  const [minutes, setMinutes] = useState(0)
  const [billable, setBillable] = useState(true)
  const [description, setDescription] = useState('')

  const totalMinutes = Math.trunc(hours) * 60 + Math.trunc(minutes)

  return (
    <CapabilityPage>
      <CapabilityHeader
        title={t('timesheets.title', 'کارکرد و صورتحساب')}
        description={t('timesheets.subtitle', 'ثبت زمان، پیش‌نمایش صورتحساب و سودآوری پروژه')}
        action={
          <ActionButton variant="quiet" onClick={onRefresh} disabled={isLoading}>
            {t('common.refresh', 'تازه‌سازی')}
          </ActionButton>
        }
      />

      {error ? (
        <ErrorNote
          message={error}
          onRetry={onRefresh}
          retryLabel={t('common.retry', 'تلاش دوباره')}
        />
      ) : null}
      {actionError ? <ErrorNote message={actionError} /> : null}

      {isLoading ? <Loading label={t('common.loading', 'در حال بارگذاری…')} /> : null}

      {!isLoading && projects.length === 0 ? (
        <Panel title={t('timesheets.no_projects', 'پروژه‌ای وجود ندارد')}>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {t('timesheets.no_projects_hint', 'زمان روی یک پروژه ثبت می‌شود. ابتدا پروژه بسازید.')}
          </p>
        </Panel>
      ) : null}

      {projects.length > 0 ? (
        <Panel title={t('timesheets.project', 'پروژه')}>
          <SelectField
            value={selectedProjectId ?? ''}
            onChange={onSelectProject}
            placeholder={t('timesheets.select_project', 'یک پروژه انتخاب کنید')}
            options={projects.map((project) => ({ value: project.id, label: project.name }))}
          />
        </Panel>
      ) : null}

      {isDetailLoading ? <Loading label={t('common.loading', 'در حال بارگذاری…')} /> : null}

      {selectedProjectId && totals ? (
        <Panel
          title={t('timesheets.totals', 'جمع کارکرد')}
          action={
            config ? (
              <Badge tone={config.method === 'non_billable' ? 'neutral' : 'info'}>
                {t(`timesheets.method_${config.method}`, config.method)}
              </Badge>
            ) : null
          }
        >
          <StatGrid>
            <Stat
              label={t('timesheets.recorded', 'ثبت‌شده')}
              value={formatMinutes(totals.recordedMinutes)}
            />
            <Stat
              label={t('timesheets.billable', 'قابل صورتحساب')}
              value={formatMinutes(totals.billableMinutes)}
            />
            <Stat
              label={t('timesheets.billed', 'صورتحساب‌شده')}
              value={formatMinutes(totals.billedMinutes)}
            />
            <Stat
              label={t('timesheets.unbilled', 'در انتظار صورتحساب')}
              value={formatMinutes(totals.unbilledMinutes)}
              hint={<Money minor={totals.unbilledAmountMinor} />}
            />
          </StatGrid>
        </Panel>
      ) : null}

      {selectedProjectId ? (
        <Panel
          title={t('timesheets.log_title', 'ثبت زمان')}
          description={t('timesheets.log_hint', 'ساعت و دقیقه — به دقیقه‌ی صحیح ذخیره می‌شود.')}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <Field
              label={t('timesheets.employee', 'کارمند')}
              value={employeeId}
              onChange={setEmployeeId}
              disabled={isBusy}
              dir="ltr"
            />
            <Field
              label={t('common.date', 'تاریخ')}
              value={onDate}
              onChange={setOnDate}
              disabled={isBusy}
              type="date"
              dir="ltr"
            />
            {/* Two fields, each labelled, rather than one labelled pair: a
                screen reader reading "duration" over two anonymous numbers
                cannot say which is hours. `max={59}` is the field's rule —
                60 minutes is an hour, and typing it should not silently
                become an extra hour nobody entered. */}
            <div className="flex gap-2" dir="ltr">
              <NumberField
                label={t('timesheets.hours', 'ساعت')}
                value={hours}
                onChange={setHours}
                min={0}
                disabled={isBusy}
              />
              <NumberField
                label={t('timesheets.minutes', 'دقیقه')}
                value={minutes}
                onChange={setMinutes}
                min={0}
                max={59}
                disabled={isBusy}
              />
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <Field
              label={t('common.description', 'شرح')}
              value={description}
              onChange={setDescription}
              disabled={isBusy}
            />
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                checked={billable}
                disabled={isBusy}
                onChange={(event) => setBillable(event.target.checked)}
              />
              {t('timesheets.is_billable', 'قابل صورتحساب')}
            </label>
            <ActionButton
              className="self-end"
              disabled={isBusy || totalMinutes <= 0 || employeeId.trim() === ''}
              onClick={() =>
                onLogTime({
                  employeeId: employeeId.trim(),
                  onDate,
                  minutes: totalMinutes,
                  billable,
                  description: description.trim(),
                })
              }
            >
              {t('timesheets.log_action', 'ثبت')}
            </ActionButton>
          </div>
        </Panel>
      ) : null}

      {selectedProjectId && (previewLines.length > 0 || previewProblems.length > 0) ? (
        <Panel
          title={t('timesheets.preview', 'پیش‌نمایش صورتحساب')}
          description={t(
            'timesheets.preview_hint',
            'چیزی صورتحساب نمی‌شود — فقط نشان می‌دهد چه می‌شد.',
          )}
        >
          {previewProblems.length > 0 ? (
            <ul className="mb-3 space-y-1 text-sm text-[hsl(var(--color-warning))]">
              {previewProblems.map((problem) => (
                <li key={problem}>{t(`timesheets.problem_${problem}`, problem)}</li>
              ))}
            </ul>
          ) : null}

          <ul className="divide-y divide-[hsl(var(--border))] text-sm">
            {previewLines.map((line) => (
              <li
                key={line.entryIds.join('-')}
                className="flex items-center justify-between gap-3 py-2"
              >
                <span>
                  <span className="text-[hsl(var(--muted-foreground))]">{line.description}</span>
                  <span className="ms-2 tabular-nums">{formatMinutes(line.minutes)}</span>
                </span>
                <Money minor={line.amountMinor} />
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {selectedProjectId && profitability ? (
        <Panel
          title={t('timesheets.profitability', 'سودآوری پروژه')}
          description={t(
            'timesheets.profitability_hint',
            'کارکرد به بهای تمام‌شده ارزیابی می‌شود، نه به نرخ فروش.',
          )}
        >
          <StatGrid>
            <Stat
              label={t('timesheets.revenue', 'درآمد')}
              value={<Money minor={profitability.revenueMinor} />}
            />
            <Stat
              label={t('timesheets.labour_cost', 'هزینه‌ی کارکرد')}
              value={<Money minor={profitability.labourCostMinor} tone="muted" />}
            />
            <Stat
              label={t('timesheets.expenses', 'هزینه‌ها')}
              value={<Money minor={profitability.expenseMinor} tone="muted" />}
            />
            <Stat
              label={t('timesheets.margin', 'حاشیه')}
              value={<Money minor={profitability.marginMinor} signed tone="auto" />}
              hint={
                profitability.marginPercent != null
                  ? `${Math.round(profitability.marginPercent)}%`
                  : undefined
              }
            />
          </StatGrid>

          {profitability.unbillableMinutes > 0 ? (
            <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">
              {t('timesheets.unbillable', 'کارکرد غیرقابل صورتحساب')}:{' '}
              {formatMinutes(profitability.unbillableMinutes)}
            </p>
          ) : null}
        </Panel>
      ) : null}
    </CapabilityPage>
  )
})

TimesheetsView.displayName = 'TimesheetsView'
