'use client'

// ============================================
// apps/admin/app/[lang]/(admin)/revenue/gateways/gateways-panel.tsx
//
// V63 · P-3 — the `gateways` tab of the revenue hub.
//
// «Configure» opens the gateway's form (gateway-config.tsx): the PayPal
// address and other public settings, and the keys — write-only, staged in
// Vault, applied by a second admin. ⚠️ Until the V63 audit (12 Nov 2026) this
// comment sent the admin to a «Security → Secrets» tab that did not exist;
// no key or PayPal address could be entered and no gateway could be enabled.
// ============================================

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
  Skeleton,
  type TableColumn,
} from '@/components/ui'
import { ErrorState, useAdminTableT } from '@/components/admin-shell/admin-ui'
import { StepUpDialog } from '@/components/admin-shell/step-up-dialog'
import { useAdminLocale } from '@/hooks/use-admin-locale'
import { adminDateTime } from '@/lib/admin-format'
import { GatewayConfig } from './gateway-config'
import {
  useAdminGateways,
  useDisableGateway,
  useEnableGateway,
  useTestGateway,
  type GatewayTestResultItem,
  type PlatformGatewayItem,
} from '@/hooks/use-admin-gateways'

type PendingAction =
  | { kind: 'enable'; gateway: PlatformGatewayItem }
  | { kind: 'disable'; gateway: PlatformGatewayItem }
  | { kind: 'test'; gateway: PlatformGatewayItem }
  | null

export function GatewaysPanel() {
  const t = useTranslations()
  const locale = useAdminLocale()
  const tableT = useAdminTableT()
  const { data, isLoading, isError, refetch } = useAdminGateways()
  const { mutateAsync: enableGateway } = useEnableGateway()
  const { mutateAsync: disableGateway } = useDisableGateway()
  const { mutateAsync: testGateway } = useTestGateway()

  const [pending, setPending] = useState<PendingAction>(null)
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<GatewayTestResultItem | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [configuringId, setConfiguringId] = useState<string | null>(null)

  const gateways = data?.gateways ?? []

  const stateLabel = (gateway: PlatformGatewayItem): string => {
    if (gateway.state === 'READY') return t('admin.gateways.state.ready')
    if (gateway.state === 'NOT_CONFIGURED') return t('admin.gateways.state.notConfigured')
    return t('admin.gateways.state.disabled')
  }

  const columns: TableColumn<PlatformGatewayItem>[] = [
    {
      id: 'provider',
      labelKey: 'admin.gateways.provider',
      labelFallback: 'درگاه',
      locked: true,
      render: (gateway) => (
        <span className="font-medium text-foreground">{gateway.displayName}</span>
      ),
      sortValue: (gateway) => gateway.displayName,
    },
    {
      id: 'mode',
      labelKey: 'admin.gateways.mode',
      labelFallback: 'حالت',
      render: (gateway) => (
        <Badge variant={gateway.environment === 'LIVE' ? 'default' : 'outline'}>
          {gateway.environment === 'LIVE' ? t('admin.gateways.live') : t('admin.gateways.test')}
        </Badge>
      ),
      sortValue: (gateway) => gateway.environment,
    },
    {
      id: 'state',
      labelKey: 'admin.gateways.stateLabel',
      labelFallback: 'وضعیت',
      render: (gateway) => (
        <div className="space-y-1">
          <Badge
            variant={
              gateway.state === 'READY'
                ? 'default'
                : gateway.state === 'NOT_CONFIGURED'
                  ? 'destructive'
                  : 'outline'
            }
          >
            {stateLabel(gateway)}
          </Badge>
          {gateway.note === 'INCOMPLETE' ? (
            <p className="text-xs text-muted-foreground">{t('admin.gateways.note.incomplete')}</p>
          ) : gateway.note === 'NEEDS_OWNER_DECISION' ? (
            <p className="text-xs text-muted-foreground">
              {t('admin.gateways.note.ownerDecision')}
            </p>
          ) : null}
        </div>
      ),
      sortValue: (gateway) => gateway.state,
    },
    {
      id: 'updated',
      labelKey: 'admin.gateways.updatedAt',
      labelFallback: 'آخرین تغییر',
      showFrom: 'md',
      render: (gateway) => (
        <span className="text-xs tabular-nums text-muted-foreground">
          {adminDateTime(gateway.updatedAt, locale)}
        </span>
      ),
      sortValue: (gateway) => gateway.updatedAt,
    },
    {
      id: 'actions',
      labelKey: 'admin.gateways.actions',
      labelFallback: 'عملیات',
      align: 'end',
      locked: true,
      render: (gateway) => (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setConfiguringId(gateway.id)}>
            {t('admin.gateways.configure')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPending({ kind: 'test', gateway })}>
            {t('admin.gateways.testConnection')}
          </Button>
          {gateway.isEnabled ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setPending({ kind: 'disable', gateway })}
            >
              {t('admin.gateways.disable')}
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={gateway.missingSecrets > 0}
              onClick={() => {
                setPendingRequestId(null)
                setPending({ kind: 'enable', gateway })
              }}
            >
              {t('admin.gateways.enable')}
            </Button>
          )}
        </div>
      ),
    },
  ]

  const handleConfirm = async ({
    stepUpTimestamp,
  }: {
    stepUpTimestamp: string
    reason?: string
  }) => {
    if (!pending) return
    if (pending.kind === 'enable') {
      const result = await enableGateway({ id: pending.gateway.id, stepUpTimestamp })
      if (result.state === 'PENDING_APPROVAL') setPendingRequestId(result.requestId)
    } else if (pending.kind === 'disable') {
      await disableGateway({ id: pending.gateway.id, stepUpTimestamp })
    } else {
      const result = await testGateway({ id: pending.gateway.id, stepUpTimestamp })
      setTestResult(result)
    }
    setPending(null)
    void refetch()
  }

  const copyWebhook = async (path: string) => {
    const base = process.env.NEXT_PUBLIC_API_URL ?? ''
    await navigator.clipboard.writeText(`${base}${path}`)
    setCopied(path)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.gateways.title')}</CardTitle>
          <CardDescription>{t('admin.gateways.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pendingRequestId && (
            <p className="rounded-xl border border-border p-3 text-sm text-foreground">
              {t('admin.gateways.pendingApproval', { id: pendingRequestId })}
            </p>
          )}

          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          )}

          {isError && !isLoading && (
            <ErrorState message={t('admin.gateways.error')} onRetry={() => void refetch()} />
          )}

          {!isLoading && !isError && (
            <DataTable
              tableId="admin-gateways"
              t={tableT}
              rows={gateways}
              columns={columns}
              rowKey={(gateway) => gateway.id}
              caption={t('admin.gateways.title')}
              minWidthClass="min-w-[760px]"
            />
          )}

          {testResult && (
            <div className="rounded-xl border border-border p-3">
              <p className="text-sm font-medium text-foreground">
                {t('admin.gateways.testResult')}: {testResult.result.state}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{testResult.result.detail}</p>
              {testResult.webhookPath && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <code dir="ltr" className="rounded bg-muted px-2 py-1 text-xs">
                    {testResult.webhookPath}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void copyWebhook(testResult.webhookPath as string)}
                  >
                    {copied === testResult.webhookPath
                      ? t('admin.gateways.copied')
                      : t('admin.gateways.copyWebhook')}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {configuringId && gateways.some((gateway) => gateway.id === configuringId) ? (
        <GatewayConfig
          key={configuringId}
          gateway={gateways.find((gateway) => gateway.id === configuringId) as PlatformGatewayItem}
          onClose={() => setConfiguringId(null)}
        />
      ) : null}

      <StepUpDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={
          pending?.kind === 'enable'
            ? t('admin.gateways.enableConfirmTitle')
            : pending?.kind === 'disable'
              ? t('admin.gateways.disableConfirmTitle')
              : t('admin.gateways.testConfirmTitle')
        }
        description={
          pending?.kind === 'enable' && pending.gateway.environment === 'LIVE'
            ? t('admin.gateways.enableLiveDesc')
            : pending?.kind === 'disable'
              ? t('admin.gateways.disableDesc')
              : t('admin.gateways.testDesc')
        }
        destructive={pending?.kind === 'disable'}
        confirmLabel={t('admin.gateways.confirm')}
        onConfirm={handleConfirm}
      />
    </div>
  )
}
