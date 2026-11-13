'use client'

// ============================================
// apps/admin/app/[lang]/(admin)/ai/ai-client.tsx
//
// V63 · A — the AI tab, in six sections behind one SegmentedControl:
// provider · fallback · usage · budgets · prompts · audit.
//
// Three rules this screen keeps:
//
//  1. THE KEY FIELD IS ALWAYS EMPTY. No endpoint returns the stored key, so
//     «empty» means «leave it alone» — both the hook and the server strip a
//     blank key for that reason.
//  2. AN UNKNOWN NUMBER IS «—». A cost with no price row, tokens the provider
//     did not report, and a spend that includes an unpriced question all render
//     as unknown. None of them is ever zero.
//  3. EVERY WRITE GOES THROUGH STEP-UP. The server refuses a write without a
//     TOTP check from the last five minutes, so each mutating section opens
//     StepUpDialog and passes the timestamp it returns.
// ============================================

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { apiErrorMessage } from '@hisabche/api'
import { FRACTION_DIGITS, type KnownCurrency } from '@hisabche/formatting'

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DataTable,
  EmptyState,
  Input,
  SegmentedControl,
  SelectField,
  Skeleton,
  type TableColumn,
} from '@/components/ui'
import { ErrorState, useAdminTableT } from '@/components/admin-shell/admin-ui'
import { StepUpDialog } from '@/components/admin-shell/step-up-dialog'
import type { AdminLocale } from '@/components/admin-shell/admin-nav'
import { useAdminLocale } from '@/hooks/use-admin-locale'
import { adminDateTime, adminMoney, adminNumber, UNKNOWN_VALUE } from '@/lib/admin-format'
import {
  useAdminAiConfig,
  useSaveAdminAiConfig,
  useSetWorkspaceAiQuota,
  useTestAdminAiConfig,
} from '@/hooks/use-admin-ai'
import {
  useAdminAiAudit,
  useAdminAiBudgets,
  useAdminAiFallbacks,
  useAdminAiPrices,
  useAdminAiPrompts,
  useAdminAiUsage,
  useDeleteAdminAiBudget,
  useDeleteAdminAiPrice,
  useSaveAdminAiBudget,
  useSaveAdminAiFallbacks,
  useSaveAdminAiPrice,
  type AiAuditItem,
  type AiBudgetItem,
  type AiFallbackDraft,
  type AiFallbackItem,
  type AiPriceItem,
  type AiPromptVersionItem,
  type AiUsageRangeName,
  type AiUsageRowItem,
} from '@/hooks/use-admin-ai-admin'

const SECTIONS = ['config', 'fallback', 'usage', 'budgets', 'prompts', 'audit'] as const
type AiSection = (typeof SECTIONS)[number]

const USAGE_RANGES: readonly AiUsageRangeName[] = ['24h', '7d', '30d', '90d']

const FIELD =
  'w-full rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-3 py-2 text-sm text-[hsl(var(--fg-primary))] outline-none focus:border-[hsl(var(--color-primary))]'

/** The two providers the backend knows. Labels are brand names, not copy. */
const AI_PROVIDER_OPTIONS = [
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
] as const

function isKnownCurrency(code: string): code is KnownCurrency {
  return Object.prototype.hasOwnProperty.call(FRACTION_DIGITS, code)
}

/**
 * Micros → the money a person reads.
 *
 * ⚠️ `/1_000_000` is a UNIT change (a micro is one millionth of a currency
 * unit), not a conversion between currencies. The currency is the one on the
 * price row, never a default.
 */
function moneyFromMicros(
  micros: number | null,
  currency: string | null,
  locale: AdminLocale,
): string {
  if (micros === null || !Number.isFinite(micros)) return UNKNOWN_VALUE
  const value = micros / 1_000_000
  if (!currency) return adminNumber(value, locale, 4)
  return isKnownCurrency(currency)
    ? adminMoney(value, currency, locale)
    : `${adminNumber(value, locale, 4)} ${currency}`
}

function errorText(error: unknown, fallback: string): string {
  return apiErrorMessage(error, fallback)
}

// ─── Section: provider + per-account allowance ───────────────────────────

/** A request to put an old prompt back in the form; a new object for every click. */
interface RestoreRequest {
  content: string
}

function ConfigSection({ restore }: { restore: RestoreRequest | null }) {
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

  // The form takes the saved config each time a new one arrives — during render, against
  // the last one taken (React's «adjust state when a prop changes»), not in an effect.
  const [loadedConfig, setLoadedConfig] = useState(config)
  if (config && config !== loadedConfig) {
    setLoadedConfig(config)
    setProvider(config.provider)
    setModel(config.model)
    setBaseUrl(config.baseUrl ?? '')
    setSystemPrompt(config.systemPrompt)
    setTopupContact(config.topupContact)
    setIsEnabled(config.isEnabled)
    // ⚠️ `apiKey` is deliberately NOT set from `config` — there is nothing to
    // set it from, by design.
  }

  // The prompts section can hand an old version back to this form. Applying it
  // only prefills: saving stays the existing one write path. Each request is applied once.
  const [appliedRestore, setAppliedRestore] = useState<RestoreRequest | null>(null)
  if (restore && restore !== appliedRestore) {
    setAppliedRestore(restore)
    setSystemPrompt(restore.content)
  }

  if (isError) {
    return <ErrorState message={t('admin.error.generic')} onRetry={() => void refetch()} />
  }

  return (
    <>
      <Card>
        <CardHeader className="text-start">
          <CardTitle>{t('admin.ai.provider')}</CardTitle>
          <CardDescription>{t('admin.ai.description')}</CardDescription>
        </CardHeader>
        <CardContent>
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
                <SelectField
                  value={provider}
                  onChange={(value) => setProvider(value as 'anthropic' | 'openai')}
                  options={AI_PROVIDER_OPTIONS}
                  aria-label={t('admin.ai.provider')}
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs text-[hsl(var(--fg-secondary))]">
                  {t('admin.ai.model')}
                </span>
                <Input value={model} onChange={(event) => setModel(event.target.value)} />
              </label>
            </div>

            <label className="block space-y-1.5">
              <span className="text-xs text-[hsl(var(--fg-secondary))]">
                {t('admin.ai.baseUrl')}
              </span>
              <Input
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder="https://api.anthropic.com"
              />
              <span className="block text-xs text-[hsl(var(--fg-tertiary))]">
                {t('admin.ai.baseUrlHint')}
              </span>
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs text-[hsl(var(--fg-secondary))]">
                {t('admin.ai.apiKey')}
              </span>
              <Input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                autoComplete="off"
                placeholder={config?.hasApiKey ? t('admin.ai.keyStored') : t('admin.ai.keyMissing')}
              />
              <span className="block text-xs text-[hsl(var(--fg-tertiary))]">
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
                className={FIELD}
              />
              <span className="block text-xs text-[hsl(var(--fg-tertiary))]">
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
            <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('admin.ai.testHint')}</p>

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
                  <p dir="ltr" className="mt-1 break-words text-start font-mono text-xs opacity-90">
                    {test.data.detail}
                  </p>
                ) : null}
              </div>
            ) : null}
            {test.isError ? (
              <p className="text-xs text-[hsl(var(--color-destructive))]" role="alert">
                {errorText(test.error, t('admin.error.generic')) === 'AI_KEY_MISSING'
                  ? t('admin.ai.testNoKey')
                  : errorText(test.error, t('admin.error.generic'))}
              </p>
            ) : null}

            {save.isError ? (
              <p className="text-xs text-[hsl(var(--color-destructive))]" role="alert">
                {errorText(save.error, t('admin.error.generic'))}
              </p>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="text-start">
          <CardTitle>{t('admin.ai.quota')}</CardTitle>
          <CardDescription>{t('admin.ai.quotaHint')}</CardDescription>
        </CardHeader>
        <CardContent>
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

            <Button type="submit" disabled={setQuota.isPending || !quotaWorkspace.trim()}>
              {setQuota.isPending ? t('common.saving') : t('common.save')}
            </Button>

            {setQuota.isError ? (
              <p className="text-xs text-[hsl(var(--color-destructive))]" role="alert">
                {errorText(setQuota.error, t('admin.error.generic'))}
              </p>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </>
  )
}

// ─── Section: ordered fallback ───────────────────────────────────────────

function draftFrom(item: AiFallbackItem): AiFallbackDraft {
  return {
    position: item.position,
    provider: item.provider,
    model: item.model,
    baseUrl: item.baseUrl,
    timeoutMs: item.timeoutMs,
    isEnabled: item.isEnabled,
  }
}

function FallbackSection() {
  const t = useTranslations()
  const { data, isLoading, isError, refetch } = useAdminAiFallbacks()
  const save = useSaveAdminAiFallbacks()
  const [drafts, setDrafts] = useState<AiFallbackDraft[]>([])
  const [stepUpOpen, setStepUpOpen] = useState(false)

  // New server data → fresh drafts; during render, against the last data taken.
  const [draftedFrom, setDraftedFrom] = useState<typeof data | null>(null)
  if (data !== draftedFrom) {
    setDraftedFrom(data)
    setDrafts((data ?? []).map(draftFrom))
  }

  if (isError) {
    return <ErrorState message={t('admin.ai.fallback.loadFailed')} onRetry={() => void refetch()} />
  }

  const update = (index: number, patch: Partial<AiFallbackDraft>): void => {
    setDrafts((current) =>
      current.map((entry, position) => (position === index ? { ...entry, ...patch } : entry)),
    )
  }

  const add = (): void => {
    if (drafts.length >= 9) return
    setDrafts((current) => [
      ...current,
      {
        position: current.length + 1,
        provider: 'openai',
        model: '',
        baseUrl: null,
        timeoutMs: 60_000,
        isEnabled: true,
      },
    ])
  }

  const remove = (index: number): void => {
    setDrafts((current) =>
      current
        .filter((_entry, position) => position !== index)
        .map((entry, position) => ({ ...entry, position: position + 1 })),
    )
  }

  return (
    <>
      <Card>
        <CardHeader className="text-start">
          <CardTitle>{t('admin.ai.fallback.title')}</CardTitle>
          <CardDescription>{t('admin.ai.fallback.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 rounded-lg" />
              <Skeleton className="h-12 rounded-lg" />
            </div>
          ) : drafts.length === 0 ? (
            <EmptyState
              title={t('admin.ai.fallback.empty')}
              description={t('admin.ai.fallback.emptyHint')}
            />
          ) : (
            <ul className="space-y-3">
              {drafts.map((entry, index) => (
                <li
                  key={`${entry.position}-${index}`}
                  className="rounded-lg border border-[hsl(var(--border-default))] p-3"
                >
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="space-y-1.5">
                      <span className="text-xs text-[hsl(var(--fg-secondary))]">
                        {t('admin.ai.fallback.position', { position: index + 1 })}
                      </span>
                      <SelectField
                        value={entry.provider}
                        onChange={(value) =>
                          update(index, { provider: value as 'anthropic' | 'openai' })
                        }
                        options={AI_PROVIDER_OPTIONS}
                        aria-label={t('admin.ai.provider')}
                      />
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-xs text-[hsl(var(--fg-secondary))]">
                        {t('admin.ai.model')}
                      </span>
                      <Input
                        value={entry.model}
                        onChange={(event) => update(index, { model: event.target.value })}
                      />
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-xs text-[hsl(var(--fg-secondary))]">
                        {t('admin.ai.fallback.timeout')}
                      </span>
                      <Input
                        type="number"
                        min={1000}
                        max={300000}
                        value={entry.timeoutMs}
                        onChange={(event) =>
                          update(index, { timeoutMs: Number(event.target.value) })
                        }
                      />
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-xs text-[hsl(var(--fg-secondary))]">
                        {t('admin.ai.baseUrl')}
                      </span>
                      <Input
                        value={entry.baseUrl ?? ''}
                        onChange={(event) =>
                          update(index, {
                            baseUrl: event.target.value.trim() ? event.target.value.trim() : null,
                          })
                        }
                        placeholder="—"
                      />
                    </label>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-sm text-[hsl(var(--fg-primary))]">
                      <input
                        type="checkbox"
                        checked={entry.isEnabled}
                        onChange={(event) => update(index, { isEnabled: event.target.checked })}
                      />
                      {t('admin.ai.fallback.enabled')}
                    </label>
                    <Button variant="ghost" size="sm" onClick={() => remove(index)}>
                      {t('admin.ai.fallback.remove')}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={add} disabled={drafts.length >= 9}>
              {t('admin.ai.fallback.add')}
            </Button>
            <Button
              type="button"
              onClick={() => setStepUpOpen(true)}
              disabled={save.isPending || drafts.some((entry) => !entry.model.trim())}
            >
              {save.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </div>

          {save.isError ? (
            <p className="text-xs text-[hsl(var(--color-destructive))]" role="alert">
              {errorText(save.error, t('admin.error.generic'))}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <StepUpDialog
        open={stepUpOpen}
        onOpenChange={setStepUpOpen}
        title={t('admin.ai.fallback.confirmTitle')}
        description={t('admin.ai.fallback.confirmDesc', { count: drafts.length })}
        onConfirm={async ({ stepUpTimestamp }) => {
          await save.mutateAsync({ entries: drafts, stepUpTimestamp })
          setStepUpOpen(false)
        }}
      />
    </>
  )
}

// ─── Section: usage + prices ─────────────────────────────────────────────

function UsageSection() {
  const t = useTranslations()
  const locale = useAdminLocale()
  const tableT = useAdminTableT()
  const [range, setRange] = useState<AiUsageRangeName>('7d')
  const { data: rows, isLoading, isError, refetch } = useAdminAiUsage(range)
  const { data: prices, isLoading: pricesLoading } = useAdminAiPrices()
  const savePrice = useSaveAdminAiPrice()
  const deletePrice = useDeleteAdminAiPrice()

  const [priceDraft, setPriceDraft] = useState({
    provider: 'anthropic' as 'anthropic' | 'openai',
    model: '',
    currency: 'USD',
    input: '',
    output: '',
  })
  const [pendingAction, setPendingAction] = useState<
    { kind: 'save-price' } | { kind: 'delete-price'; id: string } | null
  >(null)

  const usageColumns: TableColumn<AiUsageRowItem>[] = [
    {
      id: 'day',
      labelKey: 'admin.ai.usage.day',
      labelFallback: 'روز',
      locked: true,
      render: (row) => <span className="tabular-nums">{adminDateTime(row.day, locale)}</span>,
      sortValue: (row) => row.day,
    },
    {
      id: 'provider',
      labelKey: 'admin.ai.usage.provider',
      labelFallback: 'ارائه‌دهنده',
      render: (row) => <span dir="ltr">{row.provider || UNKNOWN_VALUE}</span>,
      sortValue: (row) => row.provider,
    },
    {
      id: 'model',
      labelKey: 'admin.ai.usage.model',
      labelFallback: 'مدل',
      render: (row) => (
        <span dir="ltr" className="font-mono text-xs">
          {row.model || UNKNOWN_VALUE}
        </span>
      ),
      sortValue: (row) => row.model,
    },
    {
      id: 'queries',
      labelKey: 'admin.ai.usage.queries',
      labelFallback: 'پرسش',
      align: 'end',
      render: (row) => <span className="tabular-nums">{adminNumber(row.queries, locale)}</span>,
      sortValue: (row) => row.queries,
    },
    {
      id: 'promptTokens',
      labelKey: 'admin.ai.usage.promptTokens',
      labelFallback: 'توکن پرسش',
      align: 'end',
      render: (row) => (
        <span className="tabular-nums">
          {row.promptTokens === null ? UNKNOWN_VALUE : adminNumber(row.promptTokens, locale)}
        </span>
      ),
      sortValue: (row) => row.promptTokens,
    },
    {
      id: 'completionTokens',
      labelKey: 'admin.ai.usage.completionTokens',
      labelFallback: 'توکن پاسخ',
      align: 'end',
      render: (row) => (
        <span className="tabular-nums">
          {row.completionTokens === null
            ? UNKNOWN_VALUE
            : adminNumber(row.completionTokens, locale)}
        </span>
      ),
      sortValue: (row) => row.completionTokens,
    },
    {
      id: 'cost',
      labelKey: 'admin.ai.usage.cost',
      labelFallback: 'هزینه',
      align: 'end',
      render: (row) => (
        <span className="tabular-nums">
          {moneyFromMicros(row.costMicros, row.currency, locale)}
        </span>
      ),
      sortValue: (row) => row.costMicros,
    },
    {
      id: 'unpriced',
      labelKey: 'admin.ai.usage.unpriced',
      labelFallback: 'بدون قیمت',
      align: 'end',
      render: (row) => (
        <span className="tabular-nums">
          {row.unpricedQueries > 0 ? adminNumber(row.unpricedQueries, locale) : UNKNOWN_VALUE}
        </span>
      ),
      sortValue: (row) => row.unpricedQueries,
    },
  ]

  const priceColumns: TableColumn<AiPriceItem>[] = [
    {
      id: 'provider',
      labelKey: 'admin.ai.usage.provider',
      labelFallback: 'ارائه‌دهنده',
      locked: true,
      render: (row) => <span dir="ltr">{row.provider}</span>,
      sortValue: (row) => row.provider,
    },
    {
      id: 'model',
      labelKey: 'admin.ai.usage.model',
      labelFallback: 'مدل',
      render: (row) => (
        <span dir="ltr" className="font-mono text-xs">
          {row.model}
        </span>
      ),
      sortValue: (row) => row.model,
    },
    {
      id: 'currency',
      labelKey: 'admin.ai.price.currency',
      labelFallback: 'ارز',
      render: (row) => <span dir="ltr">{row.currency}</span>,
      sortValue: (row) => row.currency,
    },
    {
      id: 'input',
      labelKey: 'admin.ai.price.input',
      labelFallback: 'ورودی / میلیون',
      align: 'end',
      render: (row) => (
        <span className="tabular-nums">
          {moneyFromMicros(row.inputMicrosPerMillion, row.currency, locale)}
        </span>
      ),
      sortValue: (row) => row.inputMicrosPerMillion,
    },
    {
      id: 'output',
      labelKey: 'admin.ai.price.output',
      labelFallback: 'خروجی / میلیون',
      align: 'end',
      render: (row) => (
        <span className="tabular-nums">
          {moneyFromMicros(row.outputMicrosPerMillion, row.currency, locale)}
        </span>
      ),
      sortValue: (row) => row.outputMicrosPerMillion,
    },
    {
      id: 'actions',
      labelKey: 'admin.ai.price.actions',
      labelFallback: 'عملیات',
      align: 'end',
      render: (row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setPendingAction({ kind: 'delete-price', id: row.id })}
        >
          {t('common.delete')}
        </Button>
      ),
    },
  ]

  const draftValid =
    priceDraft.model.trim().length > 0 &&
    /^[A-Za-z]{3}$/.test(priceDraft.currency.trim()) &&
    Number.isInteger(Number(priceDraft.input)) &&
    Number.isInteger(Number(priceDraft.output))

  return (
    <>
      <Card>
        <CardHeader className="text-start">
          <CardTitle>{t('admin.ai.usage.title')}</CardTitle>
          <CardDescription>{t('admin.ai.usage.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SegmentedControl
            label={t('admin.ai.usage.title')}
            value={range}
            onChange={setRange}
            options={USAGE_RANGES.map((value) => ({
              value,
              label: t(`admin.ai.usage.range.${value}`),
            }))}
          />

          {isError ? (
            <ErrorState message={t('admin.ai.usage.loadFailed')} onRetry={() => void refetch()} />
          ) : isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 rounded-lg" />
              <Skeleton className="h-10 rounded-lg" />
            </div>
          ) : (
            <DataTable
              tableId="admin-ai-usage"
              t={tableT}
              rows={rows ?? []}
              columns={usageColumns}
              rowKey={(row, index) => `${row.day}-${row.model}-${index}`}
              caption={t('admin.ai.usage.title')}
              emptyState={
                <EmptyState
                  title={t('admin.ai.usage.empty')}
                  description={t('admin.ai.usage.emptyHint')}
                />
              }
            />
          )}
          <p className="text-xs text-[hsl(var(--fg-tertiary))]">
            {t('admin.ai.usage.unpricedHint')}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="text-start">
          <CardTitle>{t('admin.ai.price.title')}</CardTitle>
          <CardDescription>{t('admin.ai.price.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pricesLoading ? (
            <Skeleton className="h-10 rounded-lg" />
          ) : (
            <DataTable
              tableId="admin-ai-prices"
              t={tableT}
              rows={prices ?? []}
              columns={priceColumns}
              rowKey={(row) => row.id}
              caption={t('admin.ai.price.title')}
              emptyState={
                <EmptyState
                  title={t('admin.ai.price.empty')}
                  description={t('admin.ai.price.emptyHint')}
                />
              }
            />
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="space-y-1.5">
              <span className="text-xs text-[hsl(var(--fg-secondary))]">
                {t('admin.ai.providerName')}
              </span>
              <SelectField
                value={priceDraft.provider}
                onChange={(value) =>
                  setPriceDraft((current) => ({
                    ...current,
                    provider: value as 'anthropic' | 'openai',
                  }))
                }
                options={AI_PROVIDER_OPTIONS}
                aria-label={t('admin.ai.provider')}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs text-[hsl(var(--fg-secondary))]">{t('admin.ai.model')}</span>
              <Input
                value={priceDraft.model}
                onChange={(event) =>
                  setPriceDraft((current) => ({ ...current, model: event.target.value }))
                }
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs text-[hsl(var(--fg-secondary))]">
                {t('admin.ai.price.currency')}
              </span>
              <Input
                value={priceDraft.currency}
                onChange={(event) =>
                  setPriceDraft((current) => ({
                    ...current,
                    currency: event.target.value.toUpperCase(),
                  }))
                }
                maxLength={3}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs text-[hsl(var(--fg-secondary))]">
                {t('admin.ai.price.input')}
              </span>
              <Input
                type="number"
                min={0}
                value={priceDraft.input}
                onChange={(event) =>
                  setPriceDraft((current) => ({ ...current, input: event.target.value }))
                }
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs text-[hsl(var(--fg-secondary))]">
                {t('admin.ai.price.output')}
              </span>
              <Input
                type="number"
                min={0}
                value={priceDraft.output}
                onChange={(event) =>
                  setPriceDraft((current) => ({ ...current, output: event.target.value }))
                }
              />
            </label>
          </div>

          <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('admin.ai.price.hint')}</p>

          <Button
            type="button"
            disabled={!draftValid || savePrice.isPending}
            onClick={() => setPendingAction({ kind: 'save-price' })}
          >
            {savePrice.isPending ? t('common.saving') : t('admin.ai.price.add')}
          </Button>

          {savePrice.isError ? (
            <p className="text-xs text-[hsl(var(--color-destructive))]" role="alert">
              {errorText(savePrice.error, t('admin.error.generic'))}
            </p>
          ) : null}
          {deletePrice.isError ? (
            <p className="text-xs text-[hsl(var(--color-destructive))]" role="alert">
              {errorText(deletePrice.error, t('admin.error.generic'))}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <StepUpDialog
        open={pendingAction !== null}
        onOpenChange={(open) => !open && setPendingAction(null)}
        title={
          pendingAction?.kind === 'delete-price'
            ? t('admin.ai.price.deleteTitle')
            : t('admin.ai.price.confirmTitle')
        }
        description={
          pendingAction?.kind === 'delete-price'
            ? t('admin.ai.price.deleteDesc')
            : t('admin.ai.price.confirmDesc')
        }
        onConfirm={async ({ stepUpTimestamp }) => {
          if (!pendingAction) return
          if (pendingAction.kind === 'delete-price') {
            await deletePrice.mutateAsync({ id: pendingAction.id, stepUpTimestamp })
          } else {
            await savePrice.mutateAsync({
              provider: priceDraft.provider,
              model: priceDraft.model.trim(),
              currency: priceDraft.currency.trim().toUpperCase(),
              inputMicrosPerMillion: Number(priceDraft.input),
              outputMicrosPerMillion: Number(priceDraft.output),
              stepUpTimestamp,
            })
            setPriceDraft((current) => ({ ...current, model: '', input: '', output: '' }))
          }
          setPendingAction(null)
        }}
      />
    </>
  )
}

// ─── Section: monthly budgets ────────────────────────────────────────────

function BudgetsSection() {
  const t = useTranslations()
  const locale = useAdminLocale()
  const tableT = useAdminTableT()
  const { data, isLoading, isError, refetch } = useAdminAiBudgets()
  const save = useSaveAdminAiBudget()
  const remove = useDeleteAdminAiBudget()

  const [draft, setDraft] = useState({
    scope: 'platform' as 'platform' | 'workspace',
    workspaceId: '',
    currency: 'USD',
    // Entered in the currency's own unit; converted to micros on save.
    amount: '',
    alertPercent: '80',
  })
  const [pendingAction, setPendingAction] = useState<
    { kind: 'save' } | { kind: 'delete'; id: string } | null
  >(null)

  const draftMicros = Math.round(Number(draft.amount) * 1_000_000)
  const draftValid =
    /^[A-Za-z]{3}$/.test(draft.currency.trim()) &&
    Number.isFinite(Number(draft.amount)) &&
    Number(draft.amount) > 0 &&
    Number.isInteger(draftMicros) &&
    Number.isInteger(Number(draft.alertPercent)) &&
    (draft.scope === 'platform' || draft.workspaceId.trim().length > 0)

  const columns: TableColumn<AiBudgetItem>[] = [
    {
      id: 'scope',
      labelKey: 'admin.ai.budgets.scope',
      labelFallback: 'دامنه',
      locked: true,
      render: (row) => (
        <Badge variant={row.scope === 'platform' ? 'default' : 'secondary'} className="text-xs">
          {t(`admin.ai.budgets.scopeName.${row.scope}`)}
        </Badge>
      ),
      sortValue: (row) => row.scope,
    },
    {
      id: 'currency',
      labelKey: 'admin.ai.budgets.currency',
      labelFallback: 'ارز',
      render: (row) => <span dir="ltr">{row.currency}</span>,
      sortValue: (row) => row.currency,
    },
    {
      id: 'limit',
      labelKey: 'admin.ai.budgets.limit',
      labelFallback: 'سقف ماهانه',
      align: 'end',
      render: (row) => (
        <span className="tabular-nums">
          {moneyFromMicros(row.monthlyLimitMicros, row.currency, locale)}
        </span>
      ),
      sortValue: (row) => row.monthlyLimitMicros,
    },
    {
      id: 'spent',
      labelKey: 'admin.ai.budgets.spent',
      labelFallback: 'هزینه این ماه',
      align: 'end',
      render: (row) => (
        <span className="tabular-nums">
          {moneyFromMicros(row.spentMicros, row.currency, locale)}
        </span>
      ),
      sortValue: (row) => row.spentMicros,
    },
    {
      id: 'percent',
      labelKey: 'admin.ai.budgets.percent',
      labelFallback: 'درصد مصرف',
      align: 'end',
      render: (row) => (
        <span className="tabular-nums">
          {row.percentUsed === null ? UNKNOWN_VALUE : `${adminNumber(row.percentUsed, locale, 1)}%`}
        </span>
      ),
      sortValue: (row) => row.percentUsed,
    },
    {
      id: 'alert',
      labelKey: 'admin.ai.budgets.alertPercent',
      labelFallback: 'هشدار در',
      align: 'end',
      render: (row) => (
        <span className="tabular-nums">{adminNumber(row.alertPercent, locale)}%</span>
      ),
      sortValue: (row) => row.alertPercent,
    },
    {
      id: 'actions',
      labelKey: 'admin.ai.budgets.actions',
      labelFallback: 'عملیات',
      align: 'end',
      render: (row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setPendingAction({ kind: 'delete', id: row.id })}
        >
          {t('common.delete')}
        </Button>
      ),
    },
  ]

  return (
    <>
      <Card>
        <CardHeader className="text-start">
          <CardTitle>{t('admin.ai.budgets.title')}</CardTitle>
          <CardDescription>{t('admin.ai.budgets.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isError ? (
            <ErrorState message={t('admin.ai.budgets.loadFailed')} onRetry={() => void refetch()} />
          ) : isLoading ? (
            <Skeleton className="h-10 rounded-lg" />
          ) : (
            <DataTable
              tableId="admin-ai-budgets"
              t={tableT}
              rows={data ?? []}
              columns={columns}
              rowKey={(row) => row.id}
              caption={t('admin.ai.budgets.title')}
              emptyState={
                <EmptyState
                  title={t('admin.ai.budgets.empty')}
                  description={t('admin.ai.budgets.emptyHint')}
                />
              }
            />
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="space-y-1.5">
              <span className="text-xs text-[hsl(var(--fg-secondary))]">
                {t('admin.ai.budgets.scope')}
              </span>
              <SelectField
                value={draft.scope}
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    scope: value as 'platform' | 'workspace',
                  }))
                }
                options={[
                  { value: 'platform', label: t('admin.ai.budgets.scopeName.platform') },
                  { value: 'workspace', label: t('admin.ai.budgets.scopeName.workspace') },
                ]}
                aria-label={t('admin.ai.budgets.scope')}
              />
            </label>
            {draft.scope === 'workspace' ? (
              <label className="space-y-1.5">
                <span className="text-xs text-[hsl(var(--fg-secondary))]">
                  {t('admin.ai.workspaceId')}
                </span>
                <Input
                  value={draft.workspaceId}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, workspaceId: event.target.value }))
                  }
                  placeholder="00000000-0000-0000-0000-000000000000"
                />
              </label>
            ) : null}
            <label className="space-y-1.5">
              <span className="text-xs text-[hsl(var(--fg-secondary))]">
                {t('admin.ai.budgets.currency')}
              </span>
              <Input
                value={draft.currency}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    currency: event.target.value.toUpperCase(),
                  }))
                }
                maxLength={3}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs text-[hsl(var(--fg-secondary))]">
                {t('admin.ai.budgets.limit')}
              </span>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={draft.amount}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, amount: event.target.value }))
                }
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs text-[hsl(var(--fg-secondary))]">
                {t('admin.ai.budgets.alertPercent')}
              </span>
              <Input
                type="number"
                min={1}
                max={100}
                value={draft.alertPercent}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, alertPercent: event.target.value }))
                }
              />
            </label>
          </div>

          <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('admin.ai.budgets.hint')}</p>

          <Button
            type="button"
            disabled={!draftValid || save.isPending}
            onClick={() => setPendingAction({ kind: 'save' })}
          >
            {save.isPending ? t('common.saving') : t('admin.ai.budgets.add')}
          </Button>

          {save.isError ? (
            <p className="text-xs text-[hsl(var(--color-destructive))]" role="alert">
              {errorText(save.error, t('admin.error.generic'))}
            </p>
          ) : null}
          {remove.isError ? (
            <p className="text-xs text-[hsl(var(--color-destructive))]" role="alert">
              {errorText(remove.error, t('admin.error.generic'))}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <StepUpDialog
        open={pendingAction !== null}
        onOpenChange={(open) => !open && setPendingAction(null)}
        title={
          pendingAction?.kind === 'delete'
            ? t('admin.ai.budgets.deleteTitle')
            : t('admin.ai.budgets.confirmTitle')
        }
        description={
          pendingAction?.kind === 'delete'
            ? t('admin.ai.budgets.deleteDesc')
            : t('admin.ai.budgets.confirmDesc')
        }
        onConfirm={async ({ stepUpTimestamp }) => {
          if (!pendingAction) return
          if (pendingAction.kind === 'delete') {
            await remove.mutateAsync({ id: pendingAction.id, stepUpTimestamp })
          } else {
            await save.mutateAsync({
              scope: draft.scope,
              workspaceId: draft.scope === 'workspace' ? draft.workspaceId.trim() : undefined,
              currency: draft.currency.trim().toUpperCase(),
              monthlyLimitMicros: draftMicros,
              alertPercent: Number(draft.alertPercent),
              stepUpTimestamp,
            })
            setDraft((current) => ({ ...current, amount: '' }))
          }
          setPendingAction(null)
        }}
      />
    </>
  )
}

// ─── Section: prompt history ─────────────────────────────────────────────

function PromptsSection({ onUse }: { onUse: (content: string) => void }) {
  const t = useTranslations()
  const locale = useAdminLocale()
  const tableT = useAdminTableT()
  const { data, isLoading, isError, refetch } = useAdminAiPrompts()

  const columns: TableColumn<AiPromptVersionItem>[] = [
    {
      id: 'version',
      labelKey: 'admin.ai.prompts.version',
      labelFallback: 'نسخه',
      locked: true,
      align: 'end',
      render: (row) => <span className="tabular-nums">{adminNumber(row.version, locale)}</span>,
      sortValue: (row) => row.version,
    },
    {
      id: 'createdAt',
      labelKey: 'admin.ai.prompts.createdAt',
      labelFallback: 'تاریخ',
      render: (row) => <span className="tabular-nums">{adminDateTime(row.createdAt, locale)}</span>,
      sortValue: (row) => row.createdAt,
    },
    {
      id: 'createdBy',
      labelKey: 'admin.ai.prompts.createdBy',
      labelFallback: 'توسط',
      render: (row) => <span dir="ltr">{row.createdBy ?? UNKNOWN_VALUE}</span>,
      sortValue: (row) => row.createdBy ?? '',
    },
    {
      id: 'content',
      labelKey: 'admin.ai.prompts.content',
      labelFallback: 'متن',
      render: (row) => (
        <span className="block max-w-[360px] whitespace-pre-wrap break-words text-xs">
          {row.content}
        </span>
      ),
    },
    {
      id: 'actions',
      labelKey: 'admin.ai.prompts.actions',
      labelFallback: 'عملیات',
      align: 'end',
      render: (row) => (
        <Button variant="ghost" size="sm" onClick={() => onUse(row.content)}>
          {t('admin.ai.prompts.use')}
        </Button>
      ),
    },
  ]

  return (
    <Card>
      <CardHeader className="text-start">
        <CardTitle>{t('admin.ai.prompts.title')}</CardTitle>
        <CardDescription>{t('admin.ai.prompts.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {isError ? (
          <ErrorState message={t('admin.ai.prompts.loadFailed')} onRetry={() => void refetch()} />
        ) : isLoading ? (
          <Skeleton className="h-10 rounded-lg" />
        ) : (
          <DataTable
            tableId="admin-ai-prompts"
            t={tableT}
            rows={data ?? []}
            columns={columns}
            rowKey={(row) => String(row.version)}
            caption={t('admin.ai.prompts.title')}
            emptyState={
              <EmptyState
                title={t('admin.ai.prompts.empty')}
                description={t('admin.ai.prompts.emptyHint')}
              />
            }
          />
        )}
      </CardContent>
    </Card>
  )
}

// ─── Section: audit trail ────────────────────────────────────────────────

function AuditSection() {
  const t = useTranslations()
  const locale = useAdminLocale()
  const tableT = useAdminTableT()
  const { data, isLoading, isError, refetch } = useAdminAiAudit()

  const columns: TableColumn<AiAuditItem>[] = [
    {
      id: 'event',
      labelKey: 'admin.ai.audit.event',
      labelFallback: 'رویداد',
      locked: true,
      render: (row) => (
        <span dir="ltr" className="font-mono text-xs">
          {row.eventType}
        </span>
      ),
      sortValue: (row) => row.eventType,
    },
    {
      id: 'actor',
      labelKey: 'admin.ai.audit.actor',
      labelFallback: 'توسط',
      render: (row) => <span dir="ltr">{row.adminEmail ?? UNKNOWN_VALUE}</span>,
      sortValue: (row) => row.adminEmail ?? '',
    },
    {
      id: 'at',
      labelKey: 'admin.ai.audit.at',
      labelFallback: 'تاریخ',
      render: (row) => <span className="tabular-nums">{adminDateTime(row.createdAt, locale)}</span>,
      sortValue: (row) => row.createdAt,
    },
    {
      id: 'details',
      labelKey: 'admin.ai.audit.details',
      labelFallback: 'جزئیات',
      render: (row) => (
        <span
          dir="ltr"
          className="block max-w-[320px] truncate font-mono text-xs"
          title={JSON.stringify(row.details)}
        >
          {JSON.stringify(row.details)}
        </span>
      ),
    },
  ]

  return (
    <Card>
      <CardHeader className="text-start">
        <CardTitle>{t('admin.ai.audit.title')}</CardTitle>
        <CardDescription>{t('admin.ai.audit.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {isError ? (
          <ErrorState message={t('admin.ai.audit.loadFailed')} onRetry={() => void refetch()} />
        ) : isLoading ? (
          <Skeleton className="h-10 rounded-lg" />
        ) : (
          <DataTable
            tableId="admin-ai-audit"
            t={tableT}
            rows={data ?? []}
            columns={columns}
            rowKey={(row) => row.id}
            caption={t('admin.ai.audit.title')}
            emptyState={
              <EmptyState
                title={t('admin.ai.audit.empty')}
                description={t('admin.ai.audit.emptyHint')}
              />
            }
          />
        )}
      </CardContent>
    </Card>
  )
}

// ─── The tab ─────────────────────────────────────────────────────────────

export function AiClient() {
  const t = useTranslations()
  const [section, setSection] = useState<AiSection>('config')
  const [restore, setRestore] = useState<RestoreRequest | null>(null)

  return (
    <div className="space-y-5">
      <SegmentedControl
        label={t('admin.ai.title')}
        value={section}
        onChange={setSection}
        options={SECTIONS.map((value) => ({
          value,
          label: t(`admin.ai.section.${value}`),
        }))}
      />

      {section === 'config' ? <ConfigSection restore={restore} /> : null}
      {section === 'fallback' ? <FallbackSection /> : null}
      {section === 'usage' ? <UsageSection /> : null}
      {section === 'budgets' ? <BudgetsSection /> : null}
      {section === 'prompts' ? (
        <PromptsSection
          onUse={(content) => {
            setRestore({ content })
            setSection('config')
          }}
        />
      ) : null}
      {section === 'audit' ? <AuditSection /> : null}
    </div>
  )
}
