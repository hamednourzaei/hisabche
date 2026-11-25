'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  apiErrorMessage,
  useCreateSupportTicket,
  useEstimateBillingTco,
  useIntegrationHealth,
  useWorkspaceExportBundle,
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
  const estimateTco = useEstimateBillingTco()
  const submitTicket = useCreateSupportTicket()
  const integrationHealth = useIntegrationHealth()

  const [basePlan, setBasePlan] = useState('4900')
  const [extraUsers, setExtraUsers] = useState('2')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
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
          <ExpressResultBox
            label={t('common.result')}
            data={exportBundle.data}
            error={
              exportBundle.error ? apiErrorMessage(exportBundle.error, t('common.error')) : null
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
          <ExpressResultBox
            label={t('common.result')}
            data={submitTicket.data}
            error={
              submitTicket.error ? apiErrorMessage(submitTicket.error, t('common.error')) : null
            }
          />
        </ExpressCard>

        <ExpressCard title={t('ops.integrationsTitle')}>
          <ExpressResultBox
            label={t('common.result')}
            data={
              integrationHealth.data ?? {
                status: integrationHealth.isLoading ? 'loading' : 'ready',
              }
            }
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
