'use client'

// ============================================
// packages/ui/src/components/ui/developers/containers/developers-container.tsx
//
// Every data hook of the developer screen lives here; the view takes props only.
// ============================================

import { memo, useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  apiErrorMessage,
  useApiKeys,
  useCreateApiKey,
  useCreateWebhookEndpoint,
  useDeleteWebhookEndpoint,
  useDeveloperCatalog,
  useRetryWebhookDelivery,
  useRevokeApiKey,
  useRotateWebhookSecret,
  useSendWebhookTest,
  useUpdateWebhookEndpoint,
  useWebhookDeliveries,
  useWebhookEndpoints,
  useApiKeyUsage,
  useReplayWebhook,
} from '@hisabche/api'

import { useDateFormat } from '../../../../hooks/use-date-format'
import { useToast } from '../../toast-provider'
import { DevelopersView, type SectionState } from '../developers-view'

function statusOf(error: unknown): number | undefined {
  return (error as { response?: { status?: number } } | null)?.response?.status
}

/** 503 = migration not run; 403 = not an owner/manager. Neither is «empty». */
function sectionState(isLoading: boolean, error: unknown): SectionState {
  if (isLoading) return 'loading'
  if (!error) return 'ready'
  const status = statusOf(error)
  if (status === 503) return 'not-configured'
  if (status === 403) return 'forbidden'
  return 'error'
}

export const DevelopersContainer = memo(function DevelopersContainer() {
  const tOriginal = useTranslations()
  const t = useCallback(
    (key: string, fallback?: string): string => {
      const value = tOriginal(key as Parameters<typeof tOriginal>[0])
      return value && value !== key ? value : (fallback ?? key)
    },
    [tOriginal],
  )
  const { dateTime } = useDateFormat()
  const toast = useToast()

  const catalog = useDeveloperCatalog()
  const keys = useApiKeys()
  const endpoints = useWebhookEndpoints()
  const [selectedEndpointId, setSelectedEndpointId] = useState<string | null>(null)
  const deliveries = useWebhookDeliveries(selectedEndpointId)

  const createKey = useCreateApiKey()
  const revokeKey = useRevokeApiKey()
  const createEndpoint = useCreateWebhookEndpoint()
  const updateEndpoint = useUpdateWebhookEndpoint()
  const deleteEndpoint = useDeleteWebhookEndpoint()
  const rotateSecret = useRotateWebhookSecret()
  const sendTest = useSendWebhookTest()
  const retryDelivery = useRetryWebhookDelivery()
  const replay = useReplayWebhook()
  const [usageKeyId, setUsageKeyId] = useState<string | null>(null)
  const usage = useApiKeyUsage(usageKeyId)

  const [revealed, setRevealed] = useState<{ kind: 'key' | 'secret'; value: string } | null>(null)
  const [busyEndpointId, setBusyEndpointId] = useState<string | null>(null)

  const failed = useCallback(
    (error: unknown) => toast.error(apiErrorMessage(error, t('developer.actionFailed'))),
    [toast, t],
  )

  const onEndpoint = useCallback(
    async (id: string, run: () => Promise<unknown>) => {
      setBusyEndpointId(id)
      try {
        await run()
      } catch (error) {
        failed(error)
      } finally {
        setBusyEndpointId(null)
      }
    },
    [failed],
  )

  return (
    <DevelopersView
      t={t}
      formatDate={dateTime}
      scopes={catalog.data?.scopes ?? []}
      events={(catalog.data?.events ?? []).map((e) => e.type)}
      keysState={sectionState(keys.isLoading || catalog.isLoading, keys.error ?? catalog.error)}
      keysError={keys.error ? apiErrorMessage(keys.error, t('developer.loadError')) : null}
      keys={keys.data ?? []}
      creatingKey={createKey.isPending}
      onCreateKey={(input) =>
        createKey.mutate(input, {
          onSuccess: (out) => {
            setRevealed({ kind: 'key', value: out.secret })
            // Scopes the creator could not grant are named, not silently dropped.
            if (out.refused.length > 0) {
              toast.warning(
                t('developer.scopesRefused'),
                out.refused.map((r) => r.scope).join('، '),
              )
            }
          },
          onError: failed,
        })
      }
      revokingKeyId={revokeKey.isPending ? (revokeKey.variables ?? null) : null}
      onRevokeKey={(id) => revokeKey.mutate(id, { onError: failed })}
      endpointsState={sectionState(
        endpoints.isLoading || catalog.isLoading,
        endpoints.error ?? catalog.error,
      )}
      endpointsError={
        endpoints.error ? apiErrorMessage(endpoints.error, t('developer.loadError')) : null
      }
      endpoints={endpoints.data ?? []}
      creatingEndpoint={createEndpoint.isPending}
      onCreateEndpoint={(input) =>
        createEndpoint.mutate(input, {
          onSuccess: (out) => setRevealed({ kind: 'secret', value: out.secret }),
          onError: failed,
        })
      }
      onToggleEndpoint={(id, isActive) =>
        void onEndpoint(id, () => updateEndpoint.mutateAsync({ id, input: { isActive } }))
      }
      onDeleteEndpoint={(id) => void onEndpoint(id, () => deleteEndpoint.mutateAsync(id))}
      onRotateSecret={(id) =>
        void onEndpoint(id, async () => {
          const out = await rotateSecret.mutateAsync(id)
          setRevealed({ kind: 'secret', value: out.secret })
        })
      }
      onSendTest={(id) =>
        void onEndpoint(id, async () => {
          const row = await sendTest.mutateAsync(id)
          setSelectedEndpointId(id)
          if (row.status === 'succeeded') toast.success(t('developer.testDelivered'))
          else toast.warning(t('developer.testFailed'), row.last_error ?? undefined)
        })
      }
      busyEndpointId={busyEndpointId}
      selectedEndpointId={selectedEndpointId}
      onSelectEndpoint={setSelectedEndpointId}
      deliveriesState={sectionState(deliveries.isLoading, deliveries.error)}
      deliveries={deliveries.data ?? []}
      onRetryDelivery={(id) => retryDelivery.mutate(id, { onError: failed })}
      usageKeyId={usageKeyId}
      onToggleUsage={setUsageKeyId}
      usageState={sectionState(usage.isLoading, usage.error)}
      usage={usage.data ?? null}
      onReplay={(id, days) =>
        void onEndpoint(id, async () => {
          const out = await replay.mutateAsync({
            id,
            since: new Date(Date.now() - days * 86_400_000).toISOString(),
          })
          setSelectedEndpointId(id)
          // The count the database requeued — zero is said, not hidden.
          toast.info(t('developer.replayed'), String(out.requeued))
        })
      }
      revealed={revealed}
      onDismissRevealed={() => setRevealed(null)}
      onCopy={(value) => {
        navigator.clipboard
          ?.writeText(value)
          .then(() => toast.success(t('developer.copied')))
          .catch(failed)
      }}
      onRetry={() => {
        void catalog.refetch()
        void keys.refetch()
        void endpoints.refetch()
      }}
    />
  )
})

DevelopersContainer.displayName = 'DevelopersContainer'
