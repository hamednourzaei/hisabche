'use client'

// ============================================
// CustomerCrmPanel — one customer's relationship picture, anywhere.
//
// The UI end of the CRM Core's customer port (GET /api/crm/customers/:id via
// `useCustomerCrm`). Drop it on any page that shows a party: Customer 360,
// an invoice, a payment. It reads nothing else and computes no totals — the
// open-task count, pipeline value and next task all come from the server.
//
// Tasks include multi-customer tasks where this customer is on the list, not
// only tasks whose primary customer they are.
// ============================================

import { KpiCard, KpiGrid } from '../kpi-card'
import { useTranslations } from 'next-intl'
import { CalendarClock, CheckCircle2, ListTodo, Target } from 'lucide-react'
import { useCustomerCrm } from '@hisabche/api'
import { formatNumber } from '@hisabche/formatting'

import { cn } from '../../../lib/utils'
import { useDateFormat } from '../../../hooks/use-date-format'
import { useIntlLocale } from '../../../hooks/use-intl-locale'

const STAGE_KEY: Record<string, string> = {
  lead: 'stageLead',
  qualified: 'stageQualified',
  proposal: 'stageProposal',
  negotiation: 'stageNegotiation',
  won: 'stageWon',
  lost: 'stageLost',
}
const STATUS_KEY: Record<string, string> = {
  pending: 'pending',
  in_progress: 'inProgress',
  completed: 'completed',
}

const card =
  'rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]'

export interface CustomerCrmPanelProps {
  customerId: string
  /** Money formatter of the host page (currency is the page's decision). */
  formatMoney?: ((value: number) => string) | undefined
  /** Optional: open the full CRM screen. */
  onOpenCrm?: (() => void) | undefined
  className?: string | undefined
}

export function CustomerCrmPanel({
  customerId,
  formatMoney,
  onOpenCrm,
  className,
}: CustomerCrmPanelProps) {
  const t = useTranslations('crmPanel')
  const tCrm = useTranslations('crm')
  const locale = useIntlLocale()
  const { date } = useDateFormat()
  const { data, isLoading, isError, refetch } = useCustomerCrm(customerId)
  const money = formatMoney ?? ((value: number) => formatNumber(value, locale, 2))

  if (isLoading)
    return (
      <p className="py-8 text-center text-sm text-[hsl(var(--fg-secondary))]">{t('loading')}</p>
    )
  if (isError || !data) {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center justify-between gap-2 py-6 text-sm text-[hsl(var(--color-destructive))]"
      >
        {t('loadError')}
        <button
          type="button"
          onClick={() => void refetch()}
          className="rounded-full border border-[hsl(var(--border-default))] px-3 py-1 text-[hsl(var(--fg-secondary))]"
        >
          {t('retry')}
        </button>
      </div>
    )
  }

  const { summary, interactions, opportunities } = data

  return (
    <section className={cn('space-y-4', className)}>
      {/* The product's KPI row — this panel had a local `stat()` helper. */}
      <KpiGrid>
        <KpiCard
          icon={ListTodo}
          label={t('openTasks')}
          value={formatNumber(summary.openTasks, locale)}
          hint={t('completedTasks', { count: summary.completedTasks })}
        />
        <KpiCard
          icon={Target}
          label={t('openPipeline')}
          value={money(summary.openPipelineValue)}
          hint={t('openDeals', { count: summary.openOpportunities })}
        />
        <KpiCard
          icon={Target}
          label={t('weightedPipeline')}
          value={money(summary.weightedPipelineValue)}
        />
        <KpiCard
          icon={CheckCircle2}
          label={t('won')}
          value={money(summary.wonValue)}
          {...(summary.lostCount > 0 ? { hint: t('lostCount', { count: summary.lostCount }) } : {})}
        />
      </KpiGrid>

      {summary.nextTask && (
        <p
          className={cn(card, 'flex items-center gap-2 p-3 text-sm text-[hsl(var(--fg-primary))]')}
        >
          <CalendarClock
            className="size-4 shrink-0 text-[hsl(var(--color-warning))]"
            aria-hidden="true"
          />
          <span className="font-medium">{t('nextTask')}:</span>
          <span className="min-w-0 truncate">{summary.nextTask.subject || '—'}</span>
          {summary.nextTask.interactionDate && (
            <span className="ms-auto shrink-0 text-xs text-[hsl(var(--fg-tertiary))]">
              {date(summary.nextTask.interactionDate)}
            </span>
          )}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-[hsl(var(--fg-primary))]">{t('tasks')}</h3>
          {interactions.length === 0 ? (
            <p className="py-6 text-center text-sm text-[hsl(var(--fg-secondary))]">
              {t('noTasks')}
            </p>
          ) : (
            <ul className={cn(card, 'divide-y divide-[hsl(var(--border-default)/0.6)]')}>
              {interactions.slice(0, 20).map((task) => (
                <li
                  key={task.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[hsl(var(--fg-primary))]">
                      {task.subject || '—'}
                    </p>
                    <p className="text-xs text-[hsl(var(--fg-tertiary))]">
                      {task.interactionDate ? date(task.interactionDate) : '—'}
                      {task.employeeName ? ` · ${task.employeeName}` : ''}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                      task.status === 'completed'
                        ? 'bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]'
                        : 'bg-[hsl(var(--color-warning)/0.12)] text-[hsl(var(--color-warning))]',
                    )}
                  >
                    {tCrm(`status.${STATUS_KEY[task.status] ?? 'pending'}`)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-[hsl(var(--fg-primary))]">
            {t('opportunities')}
          </h3>
          {opportunities.length === 0 ? (
            <p className="py-6 text-center text-sm text-[hsl(var(--fg-secondary))]">
              {t('noOpportunities')}
            </p>
          ) : (
            <ul className={cn(card, 'divide-y divide-[hsl(var(--border-default)/0.6)]')}>
              {opportunities.slice(0, 20).map((deal) => (
                <li
                  key={deal.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[hsl(var(--fg-primary))]">
                      {deal.title}
                    </p>
                    <p className="text-xs text-[hsl(var(--fg-tertiary))]">
                      {STAGE_KEY[deal.stage] ? tCrm(STAGE_KEY[deal.stage]!) : deal.stage}
                      {' · '}
                      {formatNumber(deal.probability, locale)}%
                      {deal.expectedCloseDate ? ` · ${date(deal.expectedCloseDate)}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 font-medium tabular-nums text-[hsl(var(--fg-primary))]">
                    {money(deal.value)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {onOpenCrm && (
        <div className="text-center">
          <button
            type="button"
            onClick={onOpenCrm}
            className="text-sm font-medium text-[hsl(var(--color-primary))] hover:underline"
          >
            {t('openCrm')}
          </button>
        </div>
      )}
    </section>
  )
}
