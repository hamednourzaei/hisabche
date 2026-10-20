'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, Badge, EmptyState, Skeleton, HubTabs, useHubTab, Switch } from '@/components/ui'
import { AiClient } from '../ai/ai-client'
import { OAuthAppsClient } from '../oauth-apps/oauth-apps-client'
import { MarketClient } from '../market/market-client'
import {
  useAdminFeatureFlags,
  useUpsertFeatureFlag,
  type FeatureFlagItem,
} from '@/hooks/use-admin-ops'
import { StepUpDialog } from '@/components/admin-shell/step-up-dialog'

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
        <Card className="p-8">
          <EmptyState title={t('admin.product.flagsError')} />
        </Card>
      )}

      {!isLoading && !isError && flags.length === 0 && (
        <Card className="p-8">
          <EmptyState
            title={t('admin.product.noFlags')}
            description={t('admin.product.noFlagsHint')}
          />
        </Card>
      )}

      {!isLoading && !isError && flags.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="border-b border-border bg-muted/40 font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-start">{t('admin.product.flagKey')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.product.flagName')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.product.rollout')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.product.beta')}</th>
                  <th className="px-4 py-3 text-end">{t('admin.product.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {flags.map((f) => (
                  <tr key={f.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono font-semibold text-foreground" dir="ltr">
                      {f.key}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{f.name}</div>
                      {f.description && (
                        <div className="text-muted-foreground text-[11px]">{f.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums font-mono">{f.rollout_percentage}%</td>
                    <td className="px-4 py-3">
                      {f.is_beta && (
                        <Badge
                          variant="outline"
                          className="text-[10px] text-warning border-warning/30"
                        >
                          BETA
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <Switch
                        checked={f.is_enabled}
                        onCheckedChange={(checked) =>
                          setToggleTarget({ flag: f, nextEnabled: checked })
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
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
