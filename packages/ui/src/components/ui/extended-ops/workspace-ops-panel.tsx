'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  apiErrorMessage,
  useAddSupportTicketComment,
  useAssignSupportTicket,
  useCreateSupportTicket,
  useEstimateBillingTco,
  useEvaluateSupportSla,
  useIntegrationHealth,
  useLocalOpsRegisters,
  useReadLocalOpsRegister,
  useSupportTicketComments,
  useSupportTicketEvents,
  useSupportTickets,
  useUpdateSupportTicketStatus,
  useWorkspaceExportBundle,
  useWorkspaceRestorePreview,
} from '@hisabche/api'
import { useWorkspaceStore } from '@hisabche/store'
import { useBookCurrency } from '../../../hooks/use-book-currency'
import { Button } from '../button'
import { Input } from '../input'
import { SelectField } from '../select-field'
import { ExpressCard, ExpressResultBox } from './express-card'

export function WorkspaceOpsPanel() {
  const t = useTranslations('extendedOps')
  const bookCurrency = useBookCurrency()
  const currency = bookCurrency || ''
  const workspaceId = useWorkspaceStore((s) => s.workspaceId)

  const exportBundle = useWorkspaceExportBundle()
  const restorePreview = useWorkspaceRestorePreview()
  const estimateTco = useEstimateBillingTco()
  const submitTicket = useCreateSupportTicket()
  const ticketsQuery = useSupportTickets()
  const updateTicketStatus = useUpdateSupportTicketStatus()
  const assignTicket = useAssignSupportTicket()
  const addTicketComment = useAddSupportTicketComment()
  const evaluateSla = useEvaluateSupportSla()
  const firstTicketId =
    Array.isArray(ticketsQuery.data) && ticketsQuery.data[0]?.id
      ? String(ticketsQuery.data[0].id)
      : null
  const firstTicketEvents = useSupportTicketEvents(firstTicketId)
  const firstTicketComments = useSupportTicketComments(firstTicketId)
  const integrationHealth = useIntegrationHealth()
  const localApprovals = useReadLocalOpsRegister('approvals')
  const writeLocalOp = useLocalOpsRegisters()

  const [basePlan, setBasePlan] = useState('4900')
  const [extraUsers, setExtraUsers] = useState('2')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [rcaSummary, setRcaSummary] = useState('')
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'critical'>('normal')

  return (
    <section
      data-extended-panel="workspace-ops"
      className="mx-auto mt-4 w-full max-w-6xl space-y-3 px-3 sm:px-4 lg:px-6"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ExpressCard title={t('ops.workspaceExportTitle')}>
          <Button
            type="button"
            className="min-h-[44px] w-full"
            disabled={!workspaceId || exportBundle.isPending}
            onClick={() => workspaceId && exportBundle.mutate(workspaceId)}
          >
            {t('ops.exportBundleBtn')}
          </Button>
          <p className="text-xs text-[hsl(var(--fg-secondary))]">{t('ops.restoreDisclosure')}</p>
          {exportBundle.data && workspaceId ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] w-full"
              disabled={restorePreview.isPending}
              onClick={() => {
                const rawBackup = exportBundle.data.backup as
                  | {
                      meta?: {
                        workspaceId?: string
                        schemaVersion?: string
                        truncatedTables?: string[]
                      }
                      data?: Record<string, Array<Record<string, unknown>>>
                    }
                  | undefined
                restorePreview.mutate({
                  workspaceId,
                  backup: {
                    meta: {
                      workspaceId: rawBackup?.meta?.workspaceId ?? workspaceId,
                      schemaVersion: rawBackup?.meta?.schemaVersion ?? '1',
                      truncatedTables:
                        rawBackup?.meta?.truncatedTables ?? exportBundle.data.truncatedTables,
                    },
                    data: rawBackup?.data ?? {},
                  },
                })
              }}
            >
              {t('ops.restorePreviewBtn')}
            </Button>
          ) : null}
          <ExpressResultBox
            label={t('common.result')}
            data={restorePreview.data ?? exportBundle.data ?? null}
            error={
              restorePreview.error
                ? apiErrorMessage(restorePreview.error, t('common.error'))
                : exportBundle.error
                  ? apiErrorMessage(exportBundle.error, t('common.error'))
                  : null
            }
          />
        </ExpressCard>

        <ExpressCard title={t('ops.tcoTitle')}>
          <Input
            type="number"
            inputMode="numeric"
            value={basePlan}
            onChange={(e) => setBasePlan(e.target.value)}
            placeholder={t('ops.basePlan')}
            className="min-h-[44px]"
          />
          <Input
            type="number"
            inputMode="numeric"
            value={extraUsers}
            onChange={(e) => setExtraUsers(e.target.value)}
            placeholder={t('ops.extraUsers')}
            className="min-h-[44px]"
          />
          <Button
            type="button"
            className="min-h-[44px] w-full"
            disabled={!currency || estimateTco.isPending}
            onClick={() =>
              estimateTco.mutate({
                basePlanMonthlyMinor: Math.max(0, Number(basePlan) || 0),
                extraUsers: Math.max(0, Number(extraUsers) || 0),
                perUserMonthlyMinor: 500,
                extraBranches: 0,
                perBranchMonthlyMinor: 1000,
                addonsMonthlyMinor: 0,
                annualDiscountBps: 1500,
                currency,
              })
            }
          >
            {t('ops.calculateTco')}
          </Button>
          <ExpressResultBox
            label={t('common.result')}
            data={estimateTco.data}
            error={estimateTco.error ? apiErrorMessage(estimateTco.error, t('common.error')) : null}
          />
        </ExpressCard>

        <ExpressCard title={t('ops.supportTitle')}>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={t('ops.ticketSubject')}
            className="min-h-[44px]"
          />
          <SelectField
            value={priority}
            onChange={(v) => setPriority(v as 'low' | 'normal' | 'high' | 'critical')}
            options={[
              { value: 'low', label: 'Low SLA (48h)' },
              { value: 'normal', label: 'Normal SLA (24h)' },
              { value: 'high', label: 'High SLA (4h)' },
              { value: 'critical', label: 'Critical SLA (2h)' },
            ]}
          />
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('ops.ticketDesc')}
            className="min-h-[44px]"
          />
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] w-full"
            disabled={
              subject.trim().length < 3 || description.trim().length < 5 || submitTicket.isPending
            }
            onClick={() =>
              submitTicket.mutate({
                subject: subject.trim(),
                priority,
                category: 'other',
                description: description.trim(),
              })
            }
          >
            {t('ops.submitTicket')}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] w-full"
            disabled={evaluateSla.isPending}
            onClick={() => evaluateSla.mutate()}
          >
            {t('ops.escalateBtn')}
          </Button>
          <Input
            value={rcaSummary}
            onChange={(e) => setRcaSummary(e.target.value)}
            placeholder={t('ops.rcaPlaceholder')}
            className="min-h-[44px]"
          />
          {Array.isArray(ticketsQuery.data) && ticketsQuery.data.length > 0 ? (
            <div className="space-y-1 pt-1">
              {ticketsQuery.data.slice(0, 3).map((tk) => {
                const tkId = String(tk.id ?? '')
                const tkStatus = String(tk.status ?? '')
                const isClosedOrResolved = tkStatus === 'resolved' || tkStatus === 'closed'
                return (
                  <div
                    key={tkId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[hsl(var(--border-default))] px-2 py-1 text-xs"
                  >
                    <span className="truncate font-medium">
                      {String(tk.ticket_code ?? tk.subject ?? tkId)} · {tkStatus}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-[36px] px-2 text-xs"
                        onClick={() =>
                          updateTicketStatus.mutate({ ticketId: tkId, status: 'escalated' })
                        }
                      >
                        {t('ops.escalateBtn')}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-[36px] px-2 text-xs"
                        onClick={() =>
                          updateTicketStatus.mutate({
                            ticketId: tkId,
                            status: isClosedOrResolved ? 'acknowledged' : 'resolved',
                            ...(isClosedOrResolved
                              ? { reason: rcaSummary.trim() || 'Reopened by manager' }
                              : rcaSummary.trim()
                                ? { rcaSummary: rcaSummary.trim() }
                                : {}),
                          })
                        }
                      >
                        {isClosedOrResolved ? t('ops.acknowledgeBtn') : t('ops.resolveBtn')}
                      </Button>
                      {rcaSummary.trim() ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-[36px] px-2 text-xs"
                          onClick={() =>
                            addTicketComment.mutate({
                              ticketId: tkId,
                              body: rcaSummary.trim(),
                              isInternal: false,
                            })
                          }
                        >
                          {t('ops.acknowledgeBtn')}
                        </Button>
                      ) : null}
                      {workspaceId ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-[36px] px-2 text-xs"
                          onClick={() => assignTicket.mutate({ ticketId: tkId, assigneeId: null })}
                        >
                          {t('ops.loadTicketsBtn')}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : null}
          <ExpressResultBox
            label={t('common.result')}
            data={
              updateTicketStatus.data ??
              submitTicket.data ??
              (firstTicketEvents.data || firstTicketComments.data
                ? {
                    tickets: ticketsQuery.data,
                    events: firstTicketEvents.data ?? [],
                    comments: firstTicketComments.data ?? [],
                  }
                : ticketsQuery.data) ??
              null
            }
            error={
              updateTicketStatus.error
                ? apiErrorMessage(updateTicketStatus.error, t('common.error'))
                : submitTicket.error
                  ? apiErrorMessage(submitTicket.error, t('common.error'))
                  : null
            }
          />
        </ExpressCard>

        <ExpressCard title={t('ops.integrationsTitle')}>
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] w-full"
            disabled={!workspaceId || writeLocalOp.isPending}
            onClick={() =>
              workspaceId &&
              writeLocalOp.mutate({
                kind: 'approval',
                payload: { documentType: 'support_check', documentId: workspaceId },
              })
            }
          >
            {t('ops.loadTicketsBtn')}
          </Button>
          <ExpressResultBox
            label={t('common.result')}
            data={{
              integrations: integrationHealth.data ?? {
                status: integrationHealth.isLoading ? 'loading' : 'ready',
              },
              localQueue: localApprovals.data ?? writeLocalOp.data ?? null,
            }}
            error={
              integrationHealth.error
                ? apiErrorMessage(integrationHealth.error, t('common.error'))
                : null
            }
          />
        </ExpressCard>
      </div>
    </section>
  )
}
