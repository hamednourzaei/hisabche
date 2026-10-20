'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, EmptyState, HubTabs, useHubTab, Badge, Skeleton } from '@/components/ui'
import { WorkspacesClient } from '../workspaces/workspaces-client'
import { UsersClient } from '../users/users-client'
import { Workspace360Sheet } from '@/components/customers/workspace-360-sheet'
import { useTrialAbuseSignals } from '@/hooks/use-admin-customers'

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
  const { data, isLoading, isError } = useTrialAbuseSignals()
  const signals = data?.signals ?? []

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
          <EmptyState
            title={t('admin.customers.abuseLoadError')}
            description={t('admin.customers.abuseLoadErrorHint')}
          />
        </Card>
      )}

      {!isLoading && !isError && signals.length === 0 && (
        <Card className="p-8">
          <EmptyState
            title={t('admin.customers.noAbuseSignals')}
            description={t('admin.customers.noAbuseSignalsHint')}
          />
        </Card>
      )}

      {!isLoading && !isError && signals.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-start">{t('admin.customers.signalType')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.customers.fingerprint')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.customers.workspaceCount')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.customers.lastSeen')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {signals.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <Badge variant="destructive" className="font-mono text-xs">
                        {s.signal_type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-foreground" dir="ltr">
                      {s.fingerprint}
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums text-foreground font-semibold">
                      {s.workspace_count}
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums text-muted-foreground">
                      {new Date(s.last_seen_at).toLocaleString()}
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
