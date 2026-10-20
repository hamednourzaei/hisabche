'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Button,
  EmptyState,
  Skeleton,
  HubTabs,
  useHubTab,
} from '@/components/ui'
import { PlanLimitsPanel } from '../subscriptions/plan-limits-panel'
import { SubscriptionsClient } from '../subscriptions/subscriptions-client'
import { UpgradeRequestsPanel } from '../subscriptions/upgrade-requests-panel'
import { WalletClient } from '../wallet/wallet-client'
import {
  useAdminPlanPrices,
  useAdminBillingLedger,
  useAdminActionRequests,
  useDecideActionRequest,
  type AdminActionRequestItem,
} from '@/hooks/use-admin-billing'
import { StepUpDialog } from '@/components/admin-shell/step-up-dialog'

const REVENUE_TABS = ['plans', 'subscriptions', 'ledger', 'maker_checker', 'wallet'] as const
type RevenueTab = (typeof REVENUE_TABS)[number]

export function RevenueClient() {
  const t = useTranslations()
  const [tab, setTab] = useHubTab<RevenueTab>(REVENUE_TABS)

  return (
    <div className="space-y-6">
      <HubTabs
        label={t('admin.hubs.revenue.title')}
        items={[
          { id: 'plans', label: t('admin.hubs.revenue.plans') },
          { id: 'subscriptions', label: t('admin.hubs.revenue.subscriptions') },
          { id: 'ledger', label: t('admin.hubs.revenue.ledger') },
          { id: 'maker_checker', label: t('admin.hubs.revenue.makerChecker') },
          { id: 'wallet', label: t('admin.hubs.revenue.wallet') },
        ]}
        active={tab}
        onSelect={setTab}
      />

      {tab === 'plans' && (
        <div className="space-y-6">
          <PlanPricesCatalog />
          <PlanLimitsPanel />
        </div>
      )}

      {tab === 'subscriptions' && (
        <div className="space-y-6">
          <SubscriptionsClient />
          <UpgradeRequestsPanel />
        </div>
      )}

      {tab === 'ledger' && <BillingLedgerTabContent />}

      {tab === 'maker_checker' && <MakerCheckerTabContent />}

      {tab === 'wallet' && <WalletClient />}
    </div>
  )
}

// ─── PLAN PRICES CATALOGUE ──────────────────────────────────────────

function PlanPricesCatalog() {
  const t = useTranslations()
  const { data, isLoading } = useAdminPlanPrices()
  const prices = data?.prices ?? []

  return (
    <Card>
      <CardHeader className="text-start">
        <CardTitle>{t('admin.revenue.priceCatalogTitle')}</CardTitle>
        <CardDescription>{t('admin.revenue.priceCatalogDesc')}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-12 rounded-xl" />
            ))}
          </div>
        ) : prices.length === 0 ? (
          <EmptyState
            title={t('admin.revenue.noPrices')}
            description={t('admin.revenue.defaultPricesActive')}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="border-b border-border bg-muted/40 font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-start">{t('admin.revenue.plan')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.revenue.priceToman')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.revenue.priceIrr')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.revenue.effectiveFrom')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.revenue.effectiveUntil')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.revenue.createdBy')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {prices.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-bold text-foreground font-mono">{p.plan}</td>
                    <td className="px-4 py-3 font-semibold text-foreground tabular-nums">
                      {(p.amount_irr / 10).toLocaleString()} {t('currency.toman')}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums font-mono">
                      {p.amount_irr.toLocaleString()} IRR
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {new Date(p.effective_from).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {p.effective_until
                        ? new Date(p.effective_until).toLocaleDateString()
                        : '— (همواره)'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{p.created_by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── BILLING LEDGER TAB ─────────────────────────────────────────────

function BillingLedgerTabContent() {
  const t = useTranslations()
  const { data, isLoading, isError } = useAdminBillingLedger({ limit: 50 })
  const entries = data?.entries ?? []

  return (
    <div className="space-y-4">
      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      )}

      {isError && !isLoading && (
        <Card className="p-8">
          <EmptyState
            title={t('admin.revenue.ledgerError')}
            description={t('admin.revenue.ledgerErrorHint')}
          />
        </Card>
      )}

      {!isLoading && !isError && entries.length === 0 && (
        <Card className="p-8">
          <EmptyState
            title={t('admin.revenue.emptyLedger')}
            description={t('admin.revenue.emptyLedgerHint')}
          />
        </Card>
      )}

      {!isLoading && !isError && entries.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="border-b border-border bg-muted/40 font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-start">{t('admin.revenue.when')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.revenue.type')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.revenue.workspace')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.revenue.amount')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.revenue.description')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.revenue.actor')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.revenue.idempotencyKey')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {entries.map((e) => (
                  <tr key={e.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 tabular-nums text-muted-foreground whitespace-nowrap">
                      {new Date(e.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <LedgerBadge type={e.entry_type} />
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground truncate max-w-[120px]">
                      {e.workspace_id}
                    </td>
                    <td className="px-4 py-3 tabular-nums font-semibold">
                      <span className={e.amount_irr >= 0 ? 'text-success' : 'text-destructive'}>
                        {e.amount_irr >= 0 ? '+' : ''}
                        {(e.amount_irr / 10).toLocaleString()} {t('currency.toman')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">
                      {e.description}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{e.actor_email}</td>
                    <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground truncate max-w-[100px]">
                      {e.idempotency_key ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

function LedgerBadge({ type }: { type: string }) {
  let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'secondary'
  if (type === 'PAYMENT' || type === 'UPGRADE_CREDIT') variant = 'default'
  if (type === 'REFUND') variant = 'destructive'
  if (type === 'ADJUSTMENT') variant = 'outline'
  return (
    <Badge variant={variant} className="text-[10px]">
      {type}
    </Badge>
  )
}

// ─── MAKER-CHECKER TAB ──────────────────────────────────────────────

function MakerCheckerTabContent() {
  const t = useTranslations()
  const { data, isLoading, isError, refetch } = useAdminActionRequests()
  const { mutateAsync: decideRequest } = useDecideActionRequest()
  const [selectedReq, setSelectedReq] = useState<AdminActionRequestItem | null>(null)
  const [decideMode, setDecideMode] = useState<'APPROVED' | 'REJECTED' | null>(null)

  const requests = data?.requests ?? []

  const handleDecideConfirm = async ({
    stepUpTimestamp,
    reason,
  }: {
    stepUpTimestamp: string
    reason?: string
  }) => {
    if (!selectedReq || !decideMode) return
    await decideRequest({
      id: selectedReq.id,
      approved: decideMode === 'APPROVED',
      rejectionReason: reason,
      stepUpTimestamp,
    })
    setSelectedReq(null)
    setDecideMode(null)
    void refetch()
  }

  return (
    <div className="space-y-4">
      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      )}

      {isError && !isLoading && (
        <Card className="p-8">
          <EmptyState title={t('admin.revenue.makerCheckerError')} />
        </Card>
      )}

      {!isLoading && !isError && requests.length === 0 && (
        <Card className="p-8">
          <EmptyState
            title={t('admin.revenue.noPendingActions')}
            description={t('admin.revenue.noPendingActionsHint')}
          />
        </Card>
      )}

      {!isLoading && !isError && requests.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="border-b border-border bg-muted/40 font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-start">{t('admin.revenue.when')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.revenue.actionType')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.revenue.proposedBy')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.revenue.status')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.revenue.approver')}</th>
                  <th className="px-4 py-3 text-end">{t('admin.revenue.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 tabular-nums text-muted-foreground whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground">{r.action_type}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.proposed_by}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          r.status === 'APPROVED'
                            ? 'default'
                            : r.status === 'REJECTED'
                              ? 'destructive'
                              : 'secondary'
                        }
                        className="text-[10px]"
                      >
                        {r.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.approved_by ?? '—'}</td>
                    <td className="px-4 py-3 text-end space-x-1 rtl:space-x-reverse">
                      {r.status === 'PENDING' ? (
                        <>
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              setSelectedReq(r)
                              setDecideMode('APPROVED')
                            }}
                          >
                            {t('admin.revenue.approve')}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              setSelectedReq(r)
                              setDecideMode('REJECTED')
                            }}
                          >
                            {t('admin.revenue.reject')}
                          </Button>
                        </>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* StepUp Dialog for Maker-Checker Decision */}
      <StepUpDialog
        open={Boolean(selectedReq && decideMode)}
        onOpenChange={(open) => !open && setSelectedReq(null)}
        title={
          decideMode === 'APPROVED'
            ? t('admin.revenue.confirmApprove')
            : t('admin.revenue.confirmReject')
        }
        description={
          decideMode === 'APPROVED'
            ? t('admin.revenue.approveDesc', { actionType: selectedReq?.action_type ?? '' })
            : t('admin.revenue.rejectDesc')
        }
        destructive={decideMode === 'REJECTED'}
        requireReason={decideMode === 'REJECTED'}
        reasonLabel={t('admin.revenue.rejectionReasonLabel')}
        onConfirm={handleDecideConfirm}
      />
    </div>
  )
}
