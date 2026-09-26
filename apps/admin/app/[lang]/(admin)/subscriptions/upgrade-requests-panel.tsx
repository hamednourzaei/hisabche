'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { apiErrorMessage } from '@hisabche/api'

import { Button, Input } from '@/components/ui'
import { Panel } from '@/components/admin-shell/admin-ui'
import {
  useAdminUpgradeRequests,
  useDecideUpgradeRequest,
  type AdminUpgradeRequest,
  type UpgradeRequestStatusFilter,
} from '@/hooks/use-admin-subscriptions'

const FILTERS: UpgradeRequestStatusFilter[] = [
  'pending',
  'approved',
  'rejected',
  'cancelled',
  'all',
]

/**
 * The upgrade queue. A member asks from /billing; this approves once the money
 * arrived. Approval is ONE server transaction (approve_subscription_upgrade):
 * that workspace's plan becomes active from now, and its history records it.
 */
export function UpgradeRequestsPanel() {
  const t = useTranslations()
  const [status, setStatus] = useState<UpgradeRequestStatusFilter>('pending')
  const { data: requests = [], isLoading } = useAdminUpgradeRequests(status)

  return (
    <Panel className="space-y-3 p-4" data-upgrade-queue="">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{t('admin.upgrades.title')}</h2>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setStatus(option)}
              aria-pressed={status === option}
              className={
                status === option
                  ? 'rounded-lg bg-accent px-2.5 py-1 text-xs font-medium'
                  : 'rounded-lg px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent'
              }
            >
              {t(`admin.upgrades.status.${option}`)}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t('admin.upgrades.hint')}</p>

      {isLoading ? null : requests.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('admin.upgrades.empty')}</p>
      ) : (
        <ul className="space-y-2">
          {requests.map((request) => (
            <UpgradeRequestRow key={request.id} request={request} />
          ))}
        </ul>
      )}
    </Panel>
  )
}

function UpgradeRequestRow({ request }: { request: AdminUpgradeRequest }) {
  const t = useTranslations()
  const decide = useDecideUpgradeRequest()
  const [note, setNote] = useState('')
  // Only a plan the product does not price needs an amount from the admin.
  const [amount, setAmount] = useState('')
  const needsAmount = request.amount_minor === null

  return (
    <li className="space-y-2 rounded-xl border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">
          {t(`admin.plan.${request.current_plan}`)} → {t(`admin.plan.${request.requested_plan}`)}
        </span>
        <span className="text-muted-foreground">
          {t(`admin.upgrades.interval.${request.billing_interval}`)}
        </span>
        <span className="text-muted-foreground">
          {t('admin.upgrades.amount')}:{' '}
          {request.amount_minor === null
            ? t('admin.upgrades.negotiated')
            : `${(request.amount_minor / 100).toFixed(2)} ${request.currency ?? ''}`}
        </span>
        <span className="text-muted-foreground">
          {t(`admin.upgrades.status.${request.status}`)}
        </span>
        <time
          className="text-xs text-muted-foreground"
          dateTime={request.created_at}
          suppressHydrationWarning
        >
          {new Date(request.created_at).toLocaleString()}
        </time>
      </div>
      <div className="text-xs text-muted-foreground">
        {t('admin.subscriptions.workspaceId')}:{' '}
        <code dir="ltr" className="select-all font-mono">
          {request.workspace_id}
        </code>
      </div>
      {request.payment_method || request.payment_reference ? (
        <div className="text-xs">
          {request.payment_method ? t(`admin.upgrades.method.${request.payment_method}`) : ''}
          {request.payment_reference ? ` · ${t('admin.upgrades.reference')}: ` : ''}
          {request.payment_reference ? (
            <code dir="ltr" className="select-all font-mono">
              {request.payment_reference}
            </code>
          ) : null}
        </div>
      ) : null}
      {request.member_note ? (
        <p className="text-xs">
          {t('admin.upgrades.memberNote')}: {request.member_note}
        </p>
      ) : null}

      {request.status === 'pending' ? (
        <div className="flex flex-wrap items-end gap-2">
          {needsAmount ? (
            <label className="space-y-1">
              <span className="block text-[11px] text-muted-foreground">
                {t('admin.upgrades.amountAgreed')}
              </span>
              <Input
                type="number"
                min={0}
                step={1}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="w-40"
              />
            </label>
          ) : null}
          <label className="min-w-[200px] flex-1 space-y-1">
            <span className="block text-[11px] text-muted-foreground">
              {t('admin.upgrades.note')}
            </span>
            <Input value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} />
          </label>
          <Button
            disabled={decide.isPending || (needsAmount && amount.trim() === '')}
            onClick={() =>
              decide.mutate({
                id: request.id,
                decision: 'approve',
                ...(needsAmount ? { amountMinor: Number(amount) } : {}),
                note,
              })
            }
          >
            {t('admin.upgrades.approve')}
          </Button>
          <Button
            variant="outline"
            disabled={decide.isPending}
            onClick={() => decide.mutate({ id: request.id, decision: 'reject', note })}
          >
            {t('admin.upgrades.reject')}
          </Button>
        </div>
      ) : request.admin_note ? (
        <p className="text-xs text-muted-foreground">{request.admin_note}</p>
      ) : null}

      {decide.isError ? (
        <p role="alert" className="text-xs text-destructive">
          {apiErrorMessage(decide.error, t('admin.error.generic'))}
        </p>
      ) : decide.isSuccess ? (
        <p role="status" className="text-xs text-emerald-500">
          {t('admin.upgrades.done')}
        </p>
      ) : null}
    </li>
  )
}
