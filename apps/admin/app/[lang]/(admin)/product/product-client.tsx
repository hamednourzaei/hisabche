'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Card,
  Badge,
  DataTable,
  EmptyState,
  Skeleton,
  HubTabs,
  useHubTab,
  Switch,
  type TableColumn,
} from '@/components/ui'
import { AiClient } from '../ai/ai-client'
import { OAuthAppsClient } from '../oauth-apps/oauth-apps-client'
import { MarketClient } from '../market/market-client'
import {
  useAdminFeatureFlags,
  useUpsertFeatureFlag,
  type FeatureFlagItem,
} from '@/hooks/use-admin-ops'
import { StepUpDialog } from '@/components/admin-shell/step-up-dialog'
import { ErrorState, useAdminTableT } from '@/components/admin-shell/admin-ui'
import { useAdminLocale } from '@/hooks/use-admin-locale'
import { adminNumber } from '@/lib/admin-format'

const PRODUCT_TABS = ['features', 'ai', 'oauth', 'market'] as const
type ProductTab = (typeof PRODUCT_TABS)[number]

export function ProductClient() {
  const t = useTranslations()
  const [tab, setTab] = useHubTab<ProductTab>(PRODUCT_TABS)

  return (
    <div className="space-y-6">
      <HubTabs
        label={t('admin.hubs.product.title')}
        items={[
          { id: 'features', label: t('admin.hubs.product.features') },
          { id: 'ai', label: t('admin.hubs.product.ai') },
          { id: 'oauth', label: t('admin.hubs.product.oauth') },
          { id: 'market', label: t('admin.hubs.product.market') },
        ]}
        active={tab}
        onSelect={setTab}
      />

      {tab === 'features' && <FeatureFlagsTabContent />}
      {tab === 'ai' && <AiClient />}
      {tab === 'oauth' && <OAuthAppsClient />}
      {tab === 'market' && <MarketClient />}
    </div>
  )
}

function FeatureFlagsTabContent() {
  const t = useTranslations()
  const { data, isLoading, isError, refetch } = useAdminFeatureFlags()
  const { mutateAsync: upsertFlag } = useUpsertFeatureFlag()
  const [toggleTarget, setToggleTarget] = useState<{
    flag: FeatureFlagItem
    nextEnabled: boolean
  } | null>(null)

  const flags = data?.flags ?? []
  const locale = useAdminLocale()
  const tableT = useAdminTableT()
  const columns: TableColumn<FeatureFlagItem>[] = [
    {
      id: 'flagKey',
      labelKey: 'admin.product.flagKey',
      labelFallback: 'کلید پرچم',
      locked: true,
      render: (f) => (
        <span dir="ltr" className="font-mono text-xs font-semibold text-foreground">
          {f.key}
        </span>
      ),
      sortValue: (f) => f.key,
    },
    {
      id: 'flagName',
      labelKey: 'admin.product.flagName',
      labelFallback: 'نام',
      render: (f) => (
        <div className="min-w-0">
          <div className="font-medium text-foreground">{f.name}</div>
          {f.description ? (
            <div className="text-xs text-muted-foreground">{f.description}</div>
          ) : null}
        </div>
      ),
      sortValue: (f) => f.name,
    },
    {
      id: 'rollout',
      labelKey: 'admin.product.rollout',
      labelFallback: 'درصد انتشار',
      showFrom: 'md',
      render: (f) => (
        <span className="tabular-nums font-mono">{adminNumber(f.rollout_percentage, locale)}%</span>
      ),
      sortValue: (f) => f.rollout_percentage,
    },
    {
      id: 'beta',
      labelKey: 'admin.product.beta',
      labelFallback: 'بتا',
      showFrom: 'lg',
      render: (f) =>
        f.is_beta ? (
          <Badge variant="outline" className="border-warning/30 text-xs text-warning">
            {t('admin.product.beta')}
          </Badge>
        ) : null,
      sortValue: (f) => (f.is_beta ? 1 : 0),
    },
    {
      id: 'status',
      labelKey: 'admin.product.status',
      labelFallback: 'وضعیت',
      align: 'end',
      locked: true,
      render: (f) => (
        <Switch
          checked={f.is_enabled}
          aria-label={t('admin.product.toggleAria', { flag: f.name })}
          onCheckedChange={(checked) => setToggleTarget({ flag: f, nextEnabled: checked })}
        />
      ),
      sortValue: (f) => (f.is_enabled ? 1 : 0),
    },
  ]

  const handleToggleConfirm = async ({ stepUpTimestamp }: { stepUpTimestamp: string }) => {
    if (!toggleTarget) return
    await upsertFlag({
      flag: {
        key: toggleTarget.flag.key,
        name: toggleTarget.flag.name,
        is_enabled: toggleTarget.nextEnabled,
      },
      stepUpTimestamp,
    })
    setToggleTarget(null)
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
        <ErrorState message={t('admin.product.flagsError')} onRetry={() => void refetch()} />
      )}

      {!isLoading && !isError && (
        <DataTable
          tableId="admin-feature-flags"
          t={tableT}
          rows={flags}
          columns={columns}
          rowKey={(f) => f.id}
          minWidthClass="min-w-[760px]"
          emptyState={
            <EmptyState
              title={t('admin.product.noFlags')}
              description={t('admin.product.noFlagsHint')}
            />
          }
        />
      )}

      {/* StepUp Dialog for Feature Flag Toggle */}
      <StepUpDialog
        open={Boolean(toggleTarget)}
        onOpenChange={(open) => !open && setToggleTarget(null)}
        title={t('admin.product.confirmToggleTitle')}
        description={t('admin.product.confirmToggleDesc', {
          enable: toggleTarget?.nextEnabled ? 'true' : 'false',
          flag: toggleTarget?.flag.key ?? '',
        })}
        onConfirm={handleToggleConfirm}
      />
    </div>
  )
}
