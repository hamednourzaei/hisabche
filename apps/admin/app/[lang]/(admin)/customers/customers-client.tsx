'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Card,
  DataTable,
  EmptyState,
  HubTabs,
  useHubTab,
  Badge,
  Skeleton,
  type TableColumn,
} from '@/components/ui'
import { WorkspacesClient } from '../workspaces/workspaces-client'
import { UsersClient } from '../users/users-client'
import { Workspace360Sheet } from '@/components/customers/workspace-360-sheet'
import { useTrialAbuseSignals, type TrialAbuseSignalItem } from '@/hooks/use-admin-customers'
import { ErrorState, useAdminTableT } from '@/components/admin-shell/admin-ui'
import { useAdminLocale } from '@/hooks/use-admin-locale'
import { adminDateTime } from '@/lib/admin-format'

const CUSTOMERS_TABS = ['workspaces', 'users', 'devices', 'support', 'trial_abuse'] as const
type CustomersTab = (typeof CUSTOMERS_TABS)[number]

export function CustomersClient() {
  const t = useTranslations()
  const [tab, setTab] = useHubTab<CustomersTab>(CUSTOMERS_TABS)
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null)

  return (
    <div className="space-y-6">
      <HubTabs
        label={t('admin.hubs.customers.title')}
        items={[
          { id: 'workspaces', label: t('admin.hubs.customers.workspaces') },
          { id: 'users', label: t('admin.hubs.customers.users') },
          { id: 'devices', label: t('admin.hubs.customers.devices') },
          { id: 'support', label: t('admin.hubs.customers.support') },
          { id: 'trial_abuse', label: t('admin.hubs.customers.trialAbuse') },
        ]}
        active={tab}
        onSelect={setTab}
      />

      {tab === 'workspaces' && (
        <>
          <WorkspacesClient onOpen360={(id) => setSelectedWorkspaceId(id)} />
          <Workspace360Sheet
            workspaceId={selectedWorkspaceId}
            onClose={() => setSelectedWorkspaceId(null)}
          />
        </>
      )}

      {tab === 'users' && <UsersClient />}

      {tab === 'devices' && (
        <Card className="p-8">
          <EmptyState
            title={t('admin.hubs.customers.devices')}
            description={t('admin.customers.devicesNotice')}
          />
        </Card>
      )}

      {tab === 'support' && (
        <Card className="p-8">
          <EmptyState
            title={t('admin.hubs.customers.support')}
            description={t('admin.customers.supportNoticeGeneral')}
          />
        </Card>
      )}

      {tab === 'trial_abuse' && <TrialAbuseTabContent />}
    </div>
  )
}

function TrialAbuseTabContent() {
  const t = useTranslations()
  const { data, isLoading, isError, refetch } = useTrialAbuseSignals()
  const signals = data?.signals ?? []
  const locale = useAdminLocale()
  const tableT = useAdminTableT()
  const columns: TableColumn<TrialAbuseSignalItem>[] = [
    {
      id: 'signalType',
      labelKey: 'admin.customers.signalType',
      labelFallback: 'نوع سیگنال',
      locked: true,
      render: (s) => (
        <Badge variant="destructive" className="font-mono text-xs">
          {s.signal_type}
        </Badge>
      ),
      sortValue: (s) => s.signal_type,
    },
    {
      id: 'fingerprint',
      labelKey: 'admin.customers.fingerprint',
      labelFallback: 'اثر انگشت',
      render: (s) => (
        <span dir="ltr" className="block max-w-[180px] truncate font-mono text-xs text-foreground">
          {s.fingerprint}
        </span>
      ),
      sortValue: (s) => s.fingerprint,
    },
    {
      id: 'workspaceCount',
      labelKey: 'admin.customers.workspaceCount',
      labelFallback: 'تعداد کسب‌وکار',
      render: (s) => (
        <span className="tabular-nums text-xs font-semibold text-foreground">
          {s.workspace_count}
        </span>
      ),
      sortValue: (s) => s.workspace_count,
    },
    {
      id: 'lastSeen',
      labelKey: 'admin.customers.lastSeen',
      labelFallback: 'آخرین مشاهده',
      render: (s) => (
        <span className="whitespace-nowrap tabular-nums text-xs text-muted-foreground">
          {adminDateTime(s.last_seen_at, locale)}
        </span>
      ),
      sortValue: (s) => s.last_seen_at,
    },
  ]

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
        <ErrorState message={t('admin.customers.abuseLoadError')} onRetry={() => void refetch()} />
      )}

      {!isLoading && !isError && (
        <DataTable
          tableId="admin-customer-signals"
          t={tableT}
          rows={signals}
          columns={columns}
          rowKey={(s) => s.id}
          minWidthClass="min-w-[720px]"
          emptyState={
            <EmptyState
              title={t('admin.customers.noAbuseSignals')}
              description={t('admin.customers.noAbuseSignalsHint')}
            />
          }
        />
      )}
    </div>
  )
}
