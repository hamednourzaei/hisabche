'use client'

// ============================================
// packages/ui/src/components/ui/developers/containers/developers-container.tsx
//
// Every data hook of the developer screen lives here; the view takes props only.
// ============================================

import { memo, useCallback, useEffect, useState } from 'react'
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
  apiClient,
  useStorefrontSettings,
  useSaveStorefrontSettings,
  usePublishableKeys,
  useCreatePublishableKey,
  useRevokePublishableKey,
  useOAuthApps,
  useCreateOAuthApp,
  useUpdateOAuthApp,
  useAppVersions,
  useSubmitAppVersion,
  useRotateOAuthSecret,
  useRotateAppWebhookSecret,
  useDeleteOAuthApp,
  useAppScreenshots,
  useAddAppScreenshot,
  useRemoveAppScreenshot,
  useAppStats,
  usePublisherProfile,
  useSavePublisherProfile,
  useInstalledApps,
  useUninstallApp,
  useAppUpdatePreview,
  useApplyAppUpdate,
  useSandboxStatus,
  useCreateSandbox,
} from '@hisabche/api'
import { localizePath } from '@hisabche/ui-contract'

import { useDateFormat } from '../../../../hooks/use-date-format'
import { useToast } from '../../toast-provider'
import { useRouteLang } from '../../../../hooks/use-locale-push'
import { oauthErrorMessage } from '../../../../lib/oauth-labels'
import { enterWorkspace } from '../../../../lib/enter-workspace'
import { sandboxErrorMessage } from '../../../../lib/sandbox-labels'
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

  const storefrontSettings = useStorefrontSettings()
  const saveStorefront = useSaveStorefrontSettings()
  const publishableKeys = usePublishableKeys()
  const createPublishable = useCreatePublishableKey()
  const revokePublishable = useRevokePublishableKey()
  const lang = useRouteLang()

  const oauthApps = useOAuthApps()
  const createApp = useCreateOAuthApp()
  const updateApp = useUpdateOAuthApp()
  const rotateAppSecret = useRotateOAuthSecret()
  const rotateAppWebhookSecret = useRotateAppWebhookSecret()
  const deleteApp = useDeleteOAuthApp()
  const [busyAppId, setBusyAppId] = useState<string | null>(null)
  const [managedAppId, setManagedAppId] = useState<string | null>(null)
  const [statsDays, setStatsDays] = useState<7 | 30>(7)
  const versions = useAppVersions(managedAppId)
  const submitVersion = useSubmitAppVersion()
  const screenshots = useAppScreenshots(managedAppId)
  const addScreenshot = useAddAppScreenshot()
  const removeScreenshot = useRemoveAppScreenshot()
  const appStats = useAppStats(managedAppId, statsDays)
  const publisher = usePublisherProfile()
  const savePublisher = useSavePublisherProfile()
  const installedApps = useInstalledApps()
  const uninstallApp = useUninstallApp()
  const [updateFor, setUpdateFor] = useState<string | null>(null)
  const updatePreview = useAppUpdatePreview(updateFor)
  const applyUpdate = useApplyAppUpdate()
  const managedApp = (oauthApps.data ?? []).find((a) => a.id === managedAppId) ?? null

  const sandboxStatus = useSandboxStatus()
  const createSandbox = useCreateSandbox()

  // Where the SDK is served and which API it calls. Read in an effect, never
  // during render (hydration). A packaged desktop app runs from file://, so
  // the public site is the SDK's home there.
  const [sdk, setSdk] = useState({ sdkUrl: '', apiBase: '', site: '' })
  useEffect(() => {
    const origin = window.location.protocol.startsWith('http')
      ? window.location.origin
      : 'https://hisabche.com'
    setSdk({
      sdkUrl: `${origin}/sdk/v1.js`,
      apiBase: apiClient.defaults.baseURL ?? '',
      site: origin,
    })
  }, [])

  const [revealed, setRevealed] = useState<{
    kind: 'key' | 'secret' | 'client-secret' | 'app-webhook-secret'
    value: string
  } | null>(null)
  const [busyEndpointId, setBusyEndpointId] = useState<string | null>(null)

  const failed = useCallback(
    (error: unknown) => toast.error(apiErrorMessage(error, t('developer.actionFailed'))),
    [toast, t],
  )

  const oauthFailed = useCallback(
    (error: unknown) => toast.error(oauthErrorMessage(t, error, t('developer.actionFailed'))),
    [toast, t],
  )

  const onApp = useCallback(
    async (id: string, run: () => Promise<unknown>) => {
      setBusyAppId(id)
      try {
        await run()
      } catch (error) {
        oauthFailed(error)
      } finally {
        setBusyAppId(null)
      }
    },
    [oauthFailed],
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
      storefront={{
        state: sectionState(
          storefrontSettings.isLoading || publishableKeys.isLoading,
          storefrontSettings.error ?? publishableKeys.error,
        ),
        settings: storefrontSettings.data ?? null,
        savingSettings: saveStorefront.isPending,
        onSaveSettings: (settings) =>
          saveStorefront.mutate(settings, {
            onSuccess: () => toast.success(t('storefront.saved')),
            onError: failed,
          }),
        keys: publishableKeys.data ?? [],
        creatingKey: createPublishable.isPending,
        onCreateKey: (input) => createPublishable.mutate(input, { onError: failed }),
        onRevokeKey: (id) => revokePublishable.mutate(id, { onError: failed }),
        onCopy: (value) => {
          navigator.clipboard
            ?.writeText(value)
            .then(() => toast.success(t('developer.copied')))
            .catch(failed)
        },
        sdkUrl: sdk.sdkUrl,
        apiBase: sdk.apiBase,
        ordersHref: localizePath('/orders', lang),
      }}
      sandbox={{
        state: sectionState(sandboxStatus.isLoading, sandboxStatus.error),
        status: sandboxStatus.data ?? null,
        creating: createSandbox.isPending,
        error: createSandbox.error
          ? sandboxErrorMessage(t, createSandbox.error, t('developer.actionFailed'))
          : null,
        onCreate: () =>
          createSandbox.mutate(undefined, {
            // Straight in: the reason for making one is to use it.
            onSuccess: (out) => enterWorkspace(out.id, out.name),
          }),
        onEnter: enterWorkspace,
      }}
      oauth={{
        formatDate: dateTime,
        scopes: catalog.data?.scopes ?? [],
        events: (catalog.data?.events ?? []).map((e) => e.type),
        marketplaceHref: localizePath('/marketplace', lang),
        listingHref: (slug) =>
          `${localizePath('/marketplace', lang)}?app=${encodeURIComponent(slug)}`,
        installedState: sectionState(installedApps.isLoading, installedApps.error),
        installed: installedApps.data ?? [],
        uninstallingId: uninstallApp.isPending ? (uninstallApp.variables ?? null) : null,
        onUninstall: (id) => uninstallApp.mutate(id, { onError: oauthFailed }),
        updateFor,
        onReviewUpdate: setUpdateFor,
        updateState: sectionState(updatePreview.isLoading, updatePreview.error),
        updatePreview: updatePreview.data ?? null,
        applyingUpdate: applyUpdate.isPending,
        onApplyUpdate: (id) =>
          applyUpdate.mutate(id, {
            onSuccess: () => {
              setUpdateFor(null)
              toast.success(t('oauth.update.applied'))
            },
            onError: oauthFailed,
          }),
        publisherState: sectionState(publisher.isLoading, publisher.error),
        publisher: publisher.data ?? null,
        savingPublisher: savePublisher.isPending,
        onSavePublisher: (input) =>
          savePublisher.mutate(input, {
            onSuccess: () => toast.success(t('oauth.publisherProfile.saved')),
            onError: oauthFailed,
          }),
        appsState: sectionState(oauthApps.isLoading || catalog.isLoading, oauthApps.error),
        apps: oauthApps.data ?? [],
        creatingApp: createApp.isPending,
        onCreateApp: (input) =>
          createApp.mutate(input, {
            // The client secret is in this response and nowhere else, ever.
            onSuccess: (out) => setRevealed({ kind: 'client-secret', value: out.clientSecret }),
            onError: oauthFailed,
          }),
        busyAppId,
        onRotateAppSecret: (id) =>
          void onApp(id, async () => {
            const out = await rotateAppSecret.mutateAsync(id)
            setRevealed({ kind: 'client-secret', value: out.clientSecret })
          }),
        onDeleteApp: (id) => void onApp(id, () => deleteApp.mutateAsync(id)),
        managedAppId,
        onManage: setManagedAppId,
        manage: managedApp
          ? {
              saving: updateApp.isPending,
              onSave: (patch) =>
                updateApp.mutate(
                  { id: managedApp.id, patch },
                  {
                    onSuccess: (out) => {
                      toast.success(t('oauth.manage.saved'))
                      // The app's webhook secret: in this response and nowhere else.
                      if (out.webhookSecret) {
                        setRevealed({ kind: 'app-webhook-secret', value: out.webhookSecret })
                      }
                    },
                    onError: oauthFailed,
                  },
                ),
              onRotateWebhookSecret: () =>
                void onApp(managedApp.id, async () => {
                  const out = await rotateAppWebhookSecret.mutateAsync(managedApp.id)
                  setRevealed({ kind: 'app-webhook-secret', value: out.webhookSecret })
                }),
              listingHref: managedApp.slug
                ? `${localizePath('/marketplace', lang)}?app=${encodeURIComponent(managedApp.slug)}`
                : null,
              versionsState: sectionState(versions.isLoading, versions.error),
              versions: versions.data ?? [],
              submitting: submitVersion.isPending,
              onSubmitVersion: (input) =>
                submitVersion.mutate(
                  { appId: managedApp.id, ...input },
                  {
                    onSuccess: () => toast.success(t('oauth.manage.submitted')),
                    onError: oauthFailed,
                  },
                ),
              screenshotsState: sectionState(screenshots.isLoading, screenshots.error),
              screenshots: screenshots.data ?? [],
              addingScreenshot: addScreenshot.isPending,
              onAddScreenshot: (input) =>
                addScreenshot.mutate({ appId: managedApp.id, ...input }, { onError: oauthFailed }),
              onRemoveScreenshot: (screenshotId) =>
                removeScreenshot.mutate(
                  { appId: managedApp.id, screenshotId },
                  { onError: oauthFailed },
                ),
              statsState: sectionState(appStats.isLoading, appStats.error),
              stats: appStats.data ?? null,
              days: statsDays,
              onDays: setStatsDays,
            }
          : null,
        // Locale-neutral on purpose: the site sends the visitor on to their own
        // language and keeps the query (next-intl, localePrefix 'always').
        authorizeUrl: sdk.site ? `${sdk.site}/oauth/authorize` : '',
        tokenUrl: `${sdk.apiBase}/oauth/token`,
        onCopy: (value) => {
          navigator.clipboard
            ?.writeText(value)
            .then(() => toast.success(t('developer.copied')))
            .catch(failed)
        },
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
