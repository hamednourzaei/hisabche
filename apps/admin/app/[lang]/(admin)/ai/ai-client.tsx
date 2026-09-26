'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { apiErrorMessage } from '@hisabche/api'

import { Button, Input } from '@/components/ui'
import { ErrorState, Panel } from '@/components/admin-shell/admin-ui'
import {
  useAdminAiConfig,
  useSaveAdminAiConfig,
  useSetWorkspaceAiQuota,
  useTestAdminAiConfig,
} from '@/hooks/use-admin-ai'

/**
 * Platform AI configuration.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ THE KEY FIELD IS ALWAYS EMPTY, AND THAT IS CORRECT
 *
 * No endpoint returns the stored key — not masked, not the last four
 * characters. So this form cannot prefill it, and «empty» must therefore mean
 * «leave it alone» rather than «clear it». Both the hook and the server strip
 * a blank key for that reason.
 *
 * The status line below says whether a key is stored, which is the only thing
 * about it anyone needs to know from here.
 */
export function AiClient() {
  const t = useTranslations()
  const { data: config, isLoading, isError, refetch } = useAdminAiConfig()
  const save = useSaveAdminAiConfig()
  const setQuota = useSetWorkspaceAiQuota()
  const test = useTestAdminAiConfig()

  const [provider, setProvider] = useState<'anthropic' | 'openai'>('anthropic')
  const [model, setModel] = useState('claude-sonnet-4-5')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [topupContact, setTopupContact] = useState('')
  const [isEnabled, setIsEnabled] = useState(false)

  const [quotaWorkspace, setQuotaWorkspace] = useState('')
  const [quotaLimit, setQuotaLimit] = useState('')
  const [quotaNote, setQuotaNote] = useState('')

  useEffect(() => {
    if (!config) return
    setProvider(config.provider)
    setModel(config.model)
    setBaseUrl(config.baseUrl ?? '')
    setSystemPrompt(config.systemPrompt)
    setTopupContact(config.topupContact)
    setIsEnabled(config.isEnabled)
    // ⚠️ `apiKey` is deliberately NOT set from `config` — there is nothing to
    // set it from, by design.
  }, [config])

  if (isError) {
    return <ErrorState message={t('admin.error.generic')} onRetry={() => void refetch()} />
  }

  const field =
    'w-full rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-3 py-2 text-sm text-[hsl(var(--fg-primary))] outline-none focus:border-[hsl(var(--color-primary))]'

  return (
    <div className="space-y-5">
      <Panel className="p-4">
        {/* `Panel` is deliberately a bare surface with no title prop — see its
            definition. The heading is the caller's, as everywhere else. */}
        <h2 className="mb-4 text-sm font-semibold text-[hsl(var(--fg-primary))]">
          {t('admin.ai.provider')}
        </h2>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            save.mutate({
              provider,
              baseUrl: baseUrl.trim() ? baseUrl.trim() : null,
              model: model.trim(),
              ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
              systemPrompt,
              topupContact: topupContact.trim(),
              isEnabled,
            })
            // Cleared after submitting so the secret does not sit in a DOM
            // node for the rest of the session.
            setApiKey('')
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs text-[hsl(var(--fg-secondary))]">
                {t('admin.ai.providerName')}
              </span>
              <select
                value={provider}
                onChange={(event) => setProvider(event.target.value as 'anthropic' | 'openai')}
                className={field}
              >
                <option value="anthropic">Anthropic</option>
                <option value="openai">OpenAI</option>
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="text-xs text-[hsl(var(--fg-secondary))]">{t('admin.ai.model')}</span>
              <Input value={model} onChange={(event) => setModel(event.target.value)} />
            </label>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs text-[hsl(var(--fg-secondary))]">{t('admin.ai.baseUrl')}</span>
            <Input
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://api.anthropic.com"
            />
            <span className="block text-[11px] text-[hsl(var(--fg-tertiary))]">
              {t('admin.ai.baseUrlHint')}
            </span>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs text-[hsl(var(--fg-secondary))]">{t('admin.ai.apiKey')}</span>
            <Input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              autoComplete="off"
              placeholder={config?.hasApiKey ? t('admin.ai.keyStored') : t('admin.ai.keyMissing')}
            />
            <span className="block text-[11px] text-[hsl(var(--fg-tertiary))]">
              {t('admin.ai.keyHint')}
            </span>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs text-[hsl(var(--fg-secondary))]">
              {t('admin.ai.systemPrompt')}
            </span>
            <textarea
              value={systemPrompt}
              onChange={(event) => setSystemPrompt(event.target.value)}
              rows={6}
              className={field}
            />
            <span className="block text-[11px] text-[hsl(var(--fg-tertiary))]">
              {t('admin.ai.systemPromptHint')}
            </span>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs text-[hsl(var(--fg-secondary))]">
              {t('admin.ai.topupContact')}
            </span>
            <Input
              value={topupContact}
              onChange={(event) => setTopupContact(event.target.value)}
              placeholder="@hisabche_support"
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-[hsl(var(--fg-primary))]">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(event) => setIsEnabled(event.target.checked)}
            />
            {t('admin.ai.enabled')}
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={save.isPending || isLoading}>
              {save.isPending ? t('common.saving') : t('common.save')}
            </Button>
            {/* Tests what is IN THE FORM, before it is saved or enabled. The
                key field is not cleared: the admin may still want to save it. */}
            <Button
              type="button"
              variant="outline"
              disabled={test.isPending || !model.trim()}
              onClick={() =>
                test.mutate({
                  provider,
                  baseUrl: baseUrl.trim() ? baseUrl.trim() : null,
                  model: model.trim(),
                  ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
                })
              }
            >
              {test.isPending ? t('admin.ai.testing') : t('admin.ai.test')}
            </Button>
          </div>
          <p className="text-[11px] text-[hsl(var(--fg-tertiary))]">{t('admin.ai.testHint')}</p>

          {test.data ? (
            <div
              role="status"
              data-test-result={test.data.ok ? 'ok' : 'failed'}
              className={
                test.data.ok
                  ? 'rounded-lg border border-[hsl(var(--color-success))] px-3 py-2 text-xs text-[hsl(var(--color-success))]'
                  : 'rounded-lg border border-[hsl(var(--color-destructive))] px-3 py-2 text-xs text-[hsl(var(--color-destructive))]'
              }
            >
              <p className="font-medium">
                {test.data.ok
                  ? t('admin.ai.testOk', { ms: test.data.latencyMs })
                  : test.data.status === null
                    ? t('admin.ai.testUnreachable')
                    : t('admin.ai.testFailed', { status: test.data.status })}
              </p>
              {/* The provider's own words — the one thing that says WHY. */}
              {test.data.detail ? (
                <p
                  dir="ltr"
                  className="mt-1 break-words text-start font-mono text-[11px] opacity-90"
                >
                  {test.data.detail}
                </p>
              ) : null}
            </div>
          ) : null}
          {test.isError ? (
            <p className="text-xs text-[hsl(var(--color-destructive))]" role="alert">
              {apiErrorMessage(test.error, t('admin.error.generic')) === 'AI_KEY_MISSING'
                ? t('admin.ai.testNoKey')
                : apiErrorMessage(test.error, t('admin.error.generic'))}
            </p>
          ) : null}

          {save.isError ? (
            <p className="text-xs text-[hsl(var(--color-destructive))]" role="alert">
              {(save.error as Error).message}
            </p>
          ) : null}
        </form>
      </Panel>

      <Panel className="p-4">
        <h2 className="mb-4 text-sm font-semibold text-[hsl(var(--fg-primary))]">
          {t('admin.ai.quota')}
        </h2>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            const trimmed = quotaLimit.trim()
            setQuota.mutate({
              workspaceId: quotaWorkspace.trim(),
              // ⚠️ Empty means «clear the override», which is NOT the same as
              // zero. Zero is a real allowance meaning «none», and collapsing
              // the two would silently restore an account an admin cut off.
              monthlyLimit: trimmed === '' ? null : Number(trimmed),
              note: quotaNote,
            })
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs text-[hsl(var(--fg-secondary))]">
                {t('admin.ai.workspaceId')}
              </span>
              <Input
                value={quotaWorkspace}
                onChange={(event) => setQuotaWorkspace(event.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-xs text-[hsl(var(--fg-secondary))]">
                {t('admin.ai.monthlyLimit')}
              </span>
              <Input
                type="number"
                min={0}
                value={quotaLimit}
                onChange={(event) => setQuotaLimit(event.target.value)}
                placeholder={t('admin.ai.limitFromPlan')}
              />
            </label>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs text-[hsl(var(--fg-secondary))]">{t('admin.ai.note')}</span>
            <Input value={quotaNote} onChange={(event) => setQuotaNote(event.target.value)} />
          </label>

          <p className="text-[11px] text-[hsl(var(--fg-tertiary))]">{t('admin.ai.quotaHint')}</p>

          <Button type="submit" disabled={setQuota.isPending || !quotaWorkspace.trim()}>
            {setQuota.isPending ? t('common.saving') : t('common.save')}
          </Button>

          {setQuota.isError ? (
            <p className="text-xs text-[hsl(var(--color-destructive))]" role="alert">
              {(setQuota.error as Error).message}
            </p>
          ) : null}
        </form>
      </Panel>
    </div>
  )
}
