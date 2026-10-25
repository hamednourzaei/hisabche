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
  DataTable,
  EmptyState,
  Skeleton,
  HubTabs,
  type TableColumn,
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
  type BillingLedgerItem,
  type PlanPriceItem,
} from '@/hooks/use-admin-billing'
import { StepUpDialog } from '@/components/admin-shell/step-up-dialog'
import { ErrorState, useAdminTableT } from '@/components/admin-shell/admin-ui'
import { useAdminLocale } from '@/hooks/use-admin-locale'
import { adminDate, adminDateTime, adminMoney, UNKNOWN_VALUE } from '@/lib/admin-format'

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
  const locale = useAdminLocale()
  const tableT = useAdminTableT()
  const columns: TableColumn<PlanPriceItem>[] = [
    {
      id: 'plan',
      labelKey: 'admin.revenue.plan',
      labelFallback: 'پلن',
      locked: true,
      render: (p) => <span className="font-mono font-bold text-foreground">{p.plan}</span>,
      sortValue: (p) => p.plan,
    },
    {
      id: 'toman',
      labelKey: 'admin.revenue.priceToman',
      labelFallback: 'قیمت (تومان)',
      render: (p) => (
        <span className="font-semibold tabular-nums text-foreground">
          {adminMoney(p.amount_irr / 10, 'IRT', locale)}
        </span>
      ),
      sortValue: (p) => p.amount_irr,
    },
    {
      id: 'irr',
      labelKey: 'admin.revenue.priceIrr',
      labelFallback: 'قیمت (ریال)',
      showFrom: 'md',
      render: (p) => (
        <span className="font-mono tabular-nums text-muted-foreground">
          {adminMoney(p.amount_irr, 'IRR', locale)}
        </span>
      ),
      sortValue: (p) => p.amount_irr,
    },
    {
      id: 'from',
      labelKey: 'admin.revenue.effectiveFrom',
      labelFallback: 'از تاریخ',
      showFrom: 'md',
      render: (p) => (
        <span className="tabular-nums text-muted-foreground">
          {adminDate(p.effective_from, locale)}
        </span>
      ),
      sortValue: (p) => p.effective_from,
    },
    {
      id: 'until',
      labelKey: 'admin.revenue.effectiveUntil',
      labelFallback: 'تا تاریخ',
      showFrom: 'lg',
      render: (p) => (
        <span className="tabular-nums text-muted-foreground">
          {p.effective_until
            ? adminDate(p.effective_until, locale)
            : t('admin.revenue.effectiveUntilOpen')}
        </span>
      ),
      sortValue: (p) => p.effective_until,
    },
    {
      id: 'createdBy',
      labelKey: 'admin.revenue.createdBy',
      labelFallback: 'ایجادکننده',
      showFrom: 'lg',
      render: (p) => <span className="text-muted-foreground">{p.created_by ?? UNKNOWN_VALUE}</span>,
      sortValue: (p) => p.created_by,
    },
  ]

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
          <DataTable
            tableId="admin-plan-prices"
            t={tableT}
            rows={prices}
            columns={columns}
            rowKey={(p) => p.id}
            caption={t('admin.revenue.priceCatalogTitle')}
            emptyState={
              <EmptyState
                title={t('admin.revenue.noPrices')}
                description={t('admin.revenue.defaultPricesActive')}
              />
            }
          />
        )}
      </CardContent>
    </Card>
  )
}

// ─── BILLING LEDGER TAB ─────────────────────────────────────────────

function BillingLedgerTabContent() {
  const t = useTranslations()
  const { data, isLoading, isError, refetch } = useAdminBillingLedger({ limit: 50 })
  const entries = data?.entries ?? []
  const locale = useAdminLocale()
  const tableT = useAdminTableT()
  const columns: TableColumn<BillingLedgerItem>[] = [
    {
      id: 'when',
      labelKey: 'admin.revenue.when',
      labelFallback: 'زمان',
      render: (e) => (
        <span className="tabular-nums text-muted-foreground">
          {adminDateTime(e.created_at, locale)}
        </span>
      ),
      sortValue: (e) => e.created_at,
    },
    {
      id: 'type',
      labelKey: 'admin.revenue.type',
      labelFallback: 'نوع',
      render: (e) => <LedgerBadge type={e.entry_type} />,
      sortValue: (e) => e.entry_type,
    },
    {
      id: 'workspace',
      labelKey: 'admin.revenue.workspace',
      labelFallback: 'کسب‌وکار',
      showFrom: 'md',
      render: (e) =>
        e.workspace_id ? (
          <span className="font-mono text-xs text-muted-foreground">
            {e.workspace_id.slice(0, 8)}…<span className="sr-only">{e.workspace_id}</span>
          </span>
        ) : (
          UNKNOWN_VALUE
        ),
    },
    {
      id: 'amount',
      labelKey: 'admin.revenue.amount',
      labelFallback: 'مبلغ',
      align: 'end',
      render: (e) => (
        <span
          className={
            e.amount_irr >= 0
              ? 'tabular-nums font-semibold text-success'
              : 'tabular-nums font-semibold text-destructive'
          }
        >
          {e.amount_irr >= 0 ? '+' : ''}
          {adminMoney(e.amount_irr, 'IRR', locale)}
        </span>
      ),
      sortValue: (e) => e.amount_irr,
    },
    {
      id: 'description',
      labelKey: 'admin.revenue.description',
      labelFallback: 'توضیح',
      showFrom: 'lg',
      render: (e) => (
        <span className="block max-w-[200px] truncate text-muted-foreground">
          {e.description ?? UNKNOWN_VALUE}
        </span>
      ),
    },
    {
      id: 'actor',
      labelKey: 'admin.revenue.actor',
      labelFallback: 'انجام‌دهنده',
      showFrom: 'lg',
      render: (e) => <span className="text-muted-foreground">{e.actor_email}</span>,
      sortValue: (e) => e.actor_email,
    },
    {
      id: 'idempotency',
      labelKey: 'admin.revenue.idempotencyKey',
      labelFallback: 'کلید یکتایی',
      showFrom: 'lg',
      render: (e) => (
        <span className="block max-w-[100px] truncate font-mono text-xs text-muted-foreground">
          {e.idempotency_key ?? UNKNOWN_VALUE}
        </span>
      ),
    },
  ]

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
        <ErrorState message={t('admin.revenue.ledgerError')} onRetry={() => void refetch()} />
      )}

      {!isLoading && !isError && (
        <DataTable
          tableId="admin-billing-ledger"
          t={tableT}
          rows={entries}
          columns={columns}
          rowKey={(e) => e.id}
          caption={t('admin.hubs.revenue.ledger')}
          minWidthClass="min-w-[860px]"
          emptyState={
            <EmptyState
              title={t('admin.revenue.emptyLedger')}
              description={t('admin.revenue.emptyLedgerHint')}
            />
          }
        />
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
    <Badge variant={variant} className="text-xs">
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
  const locale = useAdminLocale()
  const tableT = useAdminTableT()
  const columns: TableColumn<AdminActionRequestItem>[] = [
    {
      id: 'when',
      labelKey: 'admin.revenue.when',
      labelFallback: 'زمان',
      render: (r) => (
        <span className="tabular-nums text-muted-foreground">
          {adminDateTime(r.created_at, locale)}
        </span>
      ),
      sortValue: (r) => r.created_at,
    },
    {
      id: 'actionType',
      labelKey: 'admin.revenue.actionType',
      labelFallback: 'نوع عملیات',
      render: (r) => <span className="font-semibold text-foreground">{r.action_type}</span>,
      sortValue: (r) => r.action_type,
    },
    {
      id: 'proposedBy',
      labelKey: 'admin.revenue.proposedBy',
      labelFallback: 'پیشنهاددهنده',
      showFrom: 'md',
      render: (r) => <span className="text-muted-foreground">{r.proposed_by}</span>,
      sortValue: (r) => r.proposed_by,
    },
    {
      id: 'status',
      labelKey: 'admin.revenue.status',
      labelFallback: 'وضعیت',
      render: (r) => (
        <Badge
          variant={
            r.status === 'APPROVED'
              ? 'default'
              : r.status === 'REJECTED'
                ? 'destructive'
                : 'secondary'
          }
          className="text-xs"
        >
          {r.status}
        </Badge>
      ),
      sortValue: (r) => r.status,
    },
    {
      id: 'approver',
      labelKey: 'admin.revenue.approver',
      labelFallback: 'تأییدکننده',
      showFrom: 'md',
      render: (r) => (
        <span className="text-muted-foreground">{r.approved_by ?? UNKNOWN_VALUE}</span>
      ),
      sortValue: (r) => r.approved_by,
    },
    {
      id: 'actions',
      labelKey: 'admin.revenue.actions',
      labelFallback: 'عملیات',
      align: 'end',
      locked: true,
      render: (r) =>
        r.status === 'PENDING' ? (
          <div className="flex items-center justify-end gap-1">
            <Button
              size="sm"
              className="min-h-[36px] text-xs"
              aria-label={`${t('admin.revenue.approve')} — ${r.action_type}`}
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
              className="min-h-[36px] text-xs"
              aria-label={`${t('admin.revenue.reject')} — ${r.action_type}`}
              onClick={() => {
                setSelectedReq(r)
                setDecideMode('REJECTED')
              }}
            >
              {t('admin.revenue.reject')}
            </Button>
          </div>
        ) : (
          <span className="text-muted-foreground">{UNKNOWN_VALUE}</span>
        ),
    },
  ]

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
        <ErrorState message={t('admin.revenue.makerCheckerError')} onRetry={() => void refetch()} />
      )}

      {!isLoading && !isError && (
        <DataTable
          tableId="admin-maker-checker"
          t={tableT}
          rows={requests}
          columns={columns}
          rowKey={(r) => r.id}
          caption={t('admin.hubs.revenue.makerChecker')}
          minWidthClass="min-w-[820px]"
          emptyState={
            <EmptyState
              title={t('admin.revenue.noPendingActions')}
              description={t('admin.revenue.noPendingActionsHint')}
            />
          }
        />
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
