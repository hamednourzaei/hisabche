'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DataTable,
  EmptyState,
  SelectField,
  Skeleton,
  type TableColumn,
} from '@/components/ui'
import {
  useAdminSupportTickets,
  useEvaluateAdminSupportSla,
  useTransitionAdminSupportTicket,
  type AdminSupportTicketItem,
} from '@/hooks/use-admin-ops'
import { StepUpDialog } from '@/components/admin-shell/step-up-dialog'
import { ErrorState, useAdminTableT } from '@/components/admin-shell/admin-ui'
import { useAdminLocale } from '@/hooks/use-admin-locale'
import { adminDateTime, adminNumber, UNKNOWN_VALUE } from '@/lib/admin-format'

type TicketStatus = 'acknowledged' | 'escalated' | 'resolved' | 'closed'

export function AdminSupportOpsPanel() {
  const t = useTranslations()
  const locale = useAdminLocale()
  const tableT = useAdminTableT()
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [transitionTarget, setTransitionTarget] = useState<{
    ticket: AdminSupportTicketItem
    nextStatus: TicketStatus
  } | null>(null)
  const [sweepConfirmOpen, setSweepConfirmOpen] = useState(false)
  const [sweepSummary, setSweepSummary] = useState<string | null>(null)

  const { data, isLoading, isError, refetch } = useAdminSupportTickets(
    statusFilter === 'ALL' ? {} : { status: statusFilter },
  )
  const { mutateAsync: transitionTicket } = useTransitionAdminSupportTicket()
  const { mutateAsync: runSlaSweep } = useEvaluateAdminSupportSla()

  const tickets = data?.tickets ?? []

  const columns: TableColumn<AdminSupportTicketItem>[] = [
    {
      id: 'code',
      labelKey: 'admin.controlPlane.support.code',
      labelFallback: 'تیکت',
      locked: true,
      render: (row) => (
        <div className="min-w-0">
          <div dir="ltr" className="font-mono text-xs font-semibold text-foreground">
            {row.ticket_code ?? row.id.slice(0, 8)}
          </div>
          <div className="truncate text-xs text-muted-foreground">{row.subject}</div>
        </div>
      ),
      sortValue: (row) => row.created_at,
    },
    {
      id: 'workspace',
      labelKey: 'admin.controlPlane.common.workspace',
      labelFallback: 'کسب‌وکار',
      showFrom: 'md',
      render: (row) => (
        <span className="text-xs text-foreground">
          {row.workspace_name ?? row.workspace_id.slice(0, 8)}
        </span>
      ),
      sortValue: (row) => row.workspace_name ?? row.workspace_id,
    },
    {
      id: 'priority',
      labelKey: 'admin.controlPlane.support.priority',
      labelFallback: 'اولویت',
      render: (row) => (
        <Badge
          variant={
            row.priority === 'critical' || row.priority === 'high' ? 'destructive' : 'outline'
          }
          className="text-xs"
        >
          {row.priority}
        </Badge>
      ),
      sortValue: (row) => row.priority,
    },
    {
      id: 'status',
      labelKey: 'admin.controlPlane.common.status',
      labelFallback: 'وضعیت',
      render: (row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="text-xs">
            {row.status}
          </Badge>
          {row.slaBreached ? (
            <Badge variant="destructive" className="text-xs">
              {t('admin.controlPlane.support.slaBreached')}
            </Badge>
          ) : null}
        </div>
      ),
      sortValue: (row) => (row.slaBreached ? `0_${row.status}` : `1_${row.status}`),
    },
    {
      id: 'escalation',
      labelKey: 'admin.controlPlane.support.escalation',
      labelFallback: 'سطح ارجاع',
      showFrom: 'lg',
      render: (row) => (
        <span className="text-xs tabular-nums">{adminNumber(row.escalation_level, locale)}</span>
      ),
      sortValue: (row) => row.escalation_level,
    },
    {
      id: 'dueAt',
      labelKey: 'admin.controlPlane.support.dueAt',
      labelFallback: 'مهلت SLA',
      showFrom: 'lg',
      render: (row) => (
        <span className="text-xs text-muted-foreground tabular-nums">
          {row.response_due_at ? adminDateTime(row.response_due_at, locale) : UNKNOWN_VALUE}
        </span>
      ),
      sortValue: (row) => row.response_due_at ?? '',
    },
    {
      id: 'actions',
      labelKey: 'admin.controlPlane.common.actions',
      labelFallback: 'اقدامات',
      align: 'end',
      locked: true,
      render: (row) =>
        row.status !== 'resolved' && row.status !== 'closed' ? (
          <div className="flex items-center justify-end gap-1">
            {row.status === 'open' ? (
              <Button
                size="sm"
                variant="outline"
                className="min-h-[36px] text-xs"
                onClick={() => setTransitionTarget({ ticket: row, nextStatus: 'acknowledged' })}
              >
                {t('admin.controlPlane.support.takeAction')}
              </Button>
            ) : null}
            <Button
              size="sm"
              className="min-h-[36px] text-xs"
              onClick={() => setTransitionTarget({ ticket: row, nextStatus: 'resolved' })}
            >
              {t('admin.controlPlane.support.resolveAction')}
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">{UNKNOWN_VALUE}</span>
        ),
    },
  ]

  const handleConfirmTransition = async ({
    stepUpTimestamp,
    reason,
  }: {
    stepUpTimestamp: string
    reason?: string
  }) => {
    if (!transitionTarget) return
    await transitionTicket({
      ticketId: transitionTarget.ticket.id,
      status: transitionTarget.nextStatus,
      ...(reason ? { note: reason } : {}),
      stepUpTimestamp,
    })
    setTransitionTarget(null)
    void refetch()
  }

  const handleConfirmSweep = async ({ stepUpTimestamp }: { stepUpTimestamp: string }) => {
    const res = await runSlaSweep({ stepUpTimestamp })
    setSweepConfirmOpen(false)
    setSweepSummary(
      t('admin.controlPlane.support.sweepResult', {
        evaluated: adminNumber(res.evaluatedCount, locale),
        escalated: adminNumber(res.escalatedTicketIds.length, locale),
      }),
    )
    void refetch()
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>{t('admin.controlPlane.support.title')}</CardTitle>
          <CardDescription>{t('admin.controlPlane.support.description')}</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-44">
            <SelectField
              aria-label={t('admin.controlPlane.common.status')}
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'ALL', label: t('admin.filters.all') },
                { value: 'open', label: 'open' },
                { value: 'acknowledged', label: 'acknowledged' },
                { value: 'escalated', label: 'escalated' },
                { value: 'resolved', label: 'resolved' },
                { value: 'closed', label: 'closed' },
              ]}
            />
          </div>
          <Button size="sm" variant="outline" onClick={() => setSweepConfirmOpen(true)}>
            {t('admin.controlPlane.support.runSlaSweep')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {sweepSummary ? (
          <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-foreground">
            {sweepSummary}
          </p>
        ) : null}

        {isLoading ? (
          <Skeleton className="h-44 w-full rounded-xl" />
        ) : isError ? (
          <ErrorState
            message={t('admin.controlPlane.support.loadError')}
            onRetry={() => void refetch()}
          />
        ) : (
          <DataTable
            tableId="admin-customers-support-ops"
            t={tableT}
            rows={tickets}
            columns={columns}
            rowKey={(r) => r.id}
            caption={t('admin.controlPlane.support.title')}
            minWidthClass="min-w-[820px]"
            emptyState={
              <EmptyState
                title={t('admin.controlPlane.support.empty')}
                description={t('admin.controlPlane.support.emptyHint')}
              />
            }
          />
        )}
      </CardContent>

      <StepUpDialog
        open={Boolean(transitionTarget)}
        onOpenChange={(open) => !open && setTransitionTarget(null)}
        title={t('admin.controlPlane.support.confirmTransitionTitle')}
        description={t('admin.controlPlane.support.confirmTransitionDesc', {
          code: transitionTarget?.ticket.ticket_code ?? '',
          status: transitionTarget?.nextStatus ?? '',
        })}
        requireReason={false}
        reasonLabel={t('admin.controlPlane.support.noteLabel')}
        onConfirm={handleConfirmTransition}
      />

      <StepUpDialog
        open={sweepConfirmOpen}
        onOpenChange={setSweepConfirmOpen}
        title={t('admin.controlPlane.support.runSlaSweep')}
        description={t('admin.controlPlane.support.sweepConfirmDesc')}
        onConfirm={handleConfirmSweep}
      />
    </Card>
  )
}
