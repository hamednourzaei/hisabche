'use client'

// ============================================
// packages/ui/src/components/ui/ai/ai-action-tool.tsx
//
// «انجام کار» — asking the assistant to DO something.
//
//   write what you want  →  it asks what is missing  →  it shows WHAT WILL
//   CHANGE  →  a person approves  →  it is done through the app's own route
//   →  the result is read back and shown
//
// ⚠️ THE PROPOSAL IS THE SCREEN. Nothing here writes anything: the buttons call
// the pipeline, and the pipeline calls the invoice / payment / customer route
// as the person who approved. So what is rendered below the request is exactly
// what will be sent — the server builds the diff from the command it stores.
//
// ⚠️ APPROVAL IS THE QUEUE'S. A proposal is a row of the one approval queue
// (`useAiActionRequests` / `useDecideAiActionRequest`) — the same one an outside
// assistant's requests wait in, and the same one «توسعه‌دهندگان» lists. This
// screen has no approve of its own.
//
// ⚠️ OFF IS SAID, NOT HIDDEN. The feature is off until the owner turns it on;
// the owner sees the switch here, everybody else is told who can.
// ============================================

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { formatNumber } from '@hisabche/formatting'
import {
  useAiActionRequests,
  useAiPipelineSettings,
  useAnswerAiPipelineRun,
  useCancelAiPipelineRun,
  useDecideAiActionRequest,
  useSaveAiPipelineSettings,
  useStartAiPipelineRun,
  type AiPipelineChange,
  type AiPipelineQuestion,
  type AiPipelineRun,
  type AiQuotaExceeded,
} from '@hisabche/api'

import { useIntlLocale } from '../../../hooks/use-intl-locale'
import { useLocalePush } from '../../../hooks/use-locale-push'
import { routeForEntity } from '../../../lib/entity-route'
import { cn } from '../../../lib/utils'
import { Button } from '../button'
import { SelectField } from '../select-field'
import { Switch } from '../switch'

/** The server's limit on a request, shown as a counter. */
export const ACTION_MAX_CHARACTERS = 2000

/** Codes this screen has words for. Anything else gets the general message. */
export const ACTION_ERROR_CODES = [
  'AI_PIPELINE_DISABLED',
  'AI_PIPELINE_MIGRATION_REQUIRED',
  'AI_PIPELINE_OWNER_ONLY',
  'AI_NOT_CONFIGURED',
  'AI_QUOTA_EXCEEDED',
  'AI_PROVIDER_BUSY',
  'AI_RUN_ALREADY_DECIDED',
  'AI_RUN_NOT_PROPOSED',
  'AI_RUN_NOT_WAITING',
  'AI_REQUEST_ALREADY_DECIDED',
  'AI_REQUEST_EXPIRED',
  'AI_REQUEST_NOT_ALLOWED',
  'AI_REQUESTS_MIGRATION_PENDING',
  'AI_RUN_NOT_YOURS',
] as const

/** Why a run stopped. A closed list: an unknown code is never passed to `t()`. */
export const ACTION_REASON_CODES = [
  'UNSUPPORTED_REQUEST',
  'NOT_ALLOWED',
  'NOTHING_TO_CHANGE',
  'INVALID_CUSTOMER_DETAILS',
  'MODEL_UNAVAILABLE',
  'INVESTIGATION_FAILED',
  'EXECUTION_ERROR',
  'CUSTOMER_CHANGED',
  'CAPABILITY_REQUIRED',
] as const

export const ACTION_WARNING_CODES = [
  'INSUFFICIENT_STOCK',
  'INEXACT_MATCH',
  'POSSIBLE_DUPLICATE',
  'NO_OPEN_INVOICES',
  'AMOUNT_EXCEEDS_DEBT',
  'AMOUNT_EXCEEDS_INVOICE',
  'DEFAULT_CURRENCY',
] as const

/** The fields of a proposal that have a label. A line is labelled by its product. */
export const ACTION_FIELDS = [
  'customer',
  'currency',
  'total',
  'notes',
  'amount',
  'method',
  'appliedTo',
  'reference',
  'fullName',
  'phone',
  'email',
  'address',
  'type',
  'isActive',
] as const

export const ACTION_STAGES = [
  'understand',
  'authorize',
  'investigate',
  'ask',
  'validate',
  'propose',
  'confirm',
  'execute',
  'verify',
] as const

const PAYMENT_METHODS = ['cash', 'bank', 'mobile_money', 'other'] as const
const CUSTOMER_TYPES = ['cash', 'credit'] as const

const field =
  'h-10 w-full rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-3 text-sm text-[hsl(var(--fg-primary))] outline-none focus:border-[hsl(var(--color-primary))]'
const area =
  'min-h-28 w-full resize-y rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-3 text-sm leading-relaxed text-[hsl(var(--fg-primary))] outline-none focus:border-[hsl(var(--color-primary))]'
const label = 'block text-xs text-[hsl(var(--fg-secondary))]'
const card =
  'space-y-3 rounded-[var(--radius-lg)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] p-4'
const note = 'text-sm leading-relaxed text-[hsl(var(--fg-secondary))]'

/** The code a refusal carries, from the response body. */
function codeOf(error: unknown): string {
  const data = (error as { response?: { data?: { code?: unknown } } } | null)?.response?.data
  if (typeof data?.code === 'string') return data.code
  return error instanceof Error ? error.message : ''
}

const isOneOf = <T extends string>(list: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && (list as readonly string[]).includes(value)

const STATUS_TONE: Record<AiPipelineRun['status'], string> = {
  understanding: 'text-[hsl(var(--fg-secondary))]',
  needs_input: 'text-[hsl(var(--color-warning))]',
  proposed: 'text-[hsl(var(--color-primary))]',
  approved: 'text-[hsl(var(--color-primary))]',
  executed: 'text-[hsl(var(--color-success))]',
  needs_review: 'text-[hsl(var(--color-warning))]',
  failed: 'text-[hsl(var(--color-destructive))]',
  rejected: 'text-[hsl(var(--fg-secondary))]',
  refused: 'text-[hsl(var(--fg-secondary))]',
}

export function AiActionTool({ topupContact }: { topupContact?: string | undefined }) {
  const t = useTranslations('aiAction')
  const locale = useIntlLocale()
  const push = useLocalePush()

  const { data: settings, isLoading } = useAiPipelineSettings()
  const saveSettings = useSaveAiPipelineSettings()
  const start = useStartAiPipelineRun()
  const answer = useAnswerAiPipelineRun()
  const cancel = useCancelAiPipelineRun()
  // THE approval queue: this screen's approve and reject are its, and what
  // waits for a manager is read from it.
  const decide = useDecideAiActionRequest()
  const enabled = settings?.enabled === true
  const { data: queue } = useAiActionRequests(enabled && settings?.canDecide === true)

  const [request, setRequest] = useState('')
  const [dryRun, setDryRun] = useState(false)
  const [run, setRun] = useState<AiPipelineRun | null>(null)
  const [failure, setFailure] = useState<unknown>(null)

  const errorText = (error: unknown): string => {
    const code = codeOf(error)
    const quota = (error as { quotaExceeded?: AiQuotaExceeded } | null)?.quotaExceeded
    if (quota || code === 'AI_QUOTA_EXCEEDED') {
      return `${t('errors.AI_QUOTA_EXCEEDED')} ${quota?.topupContact ?? topupContact ?? ''}`.trim()
    }
    return isOneOf(ACTION_ERROR_CODES, code) ? t(`errors.${code}`) : t('errors.general')
  }

  const settle = {
    onSuccess: (next: AiPipelineRun) => {
      setFailure(null)
      setRun(next)
    },
    onError: (error: unknown) => setFailure(error),
  }

  const submit = () => {
    setFailure(null)
    setRun(null)
    start.mutate({ request: request.trim(), dryRun }, settle)
  }

  const number = (value: number) => formatNumber(value, locale)

  /** One value of a proposal, in words. Never a raw code, never «null». */
  const show = (change: AiPipelineChange, value: unknown): string => {
    if (value === null || value === undefined || value === '') {
      return change.field === 'customer' && change.entity === 'invoice' ? t('walkIn') : t('empty')
    }
    if (typeof value === 'boolean') return value ? t('yes') : t('no')
    if (typeof value === 'number') return number(value)
    if (change.entity === 'invoice_line' && typeof value === 'object') {
      const line = value as {
        quantity?: unknown
        unit?: unknown
        unitPrice?: unknown
        total?: unknown
      }
      return t('line', {
        quantity: number(Number(line.quantity)),
        unit: String(line.unit ?? ''),
        unitPrice: number(Number(line.unitPrice)),
        total: number(Number(line.total)),
      })
    }
    if (change.field === 'method' && isOneOf(PAYMENT_METHODS, value)) return t(`methods.${value}`)
    if (change.field === 'type' && isOneOf(CUSTOMER_TYPES, value))
      return t(`customerTypes.${value}`)
    if (change.field === 'appliedTo' && value === 'auto') return t('autoAllocation')
    return String(value)
  }

  const fieldLabel = (change: AiPipelineChange): string =>
    change.entity === 'invoice_line'
      ? change.field
      : isOneOf(ACTION_FIELDS, change.field)
        ? t(`fields.${change.field}`)
        : change.field

  /** Approve or reject in the queue; the answer carries the run as it now stands. */
  const decideRun = (target: AiPipelineRun, decision: 'approve' | 'reject', current: boolean) => {
    if (!target.requestId) return
    setFailure(null)
    decide.mutate(
      { id: target.requestId, decision },
      {
        onSuccess: (request) => {
          if (current && request.run) setRun(request.run)
        },
        onError: (error: unknown) => setFailure(error),
      },
    )
  }

  const busy = start.isPending || answer.isPending || cancel.isPending || decide.isPending

  if (isLoading || !settings) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <span className="text-sm text-[hsl(var(--fg-tertiary))]">{t('loading')}</span>
      </div>
    )
  }

  // ─── Off ───
  if (!settings.available || !settings.enabled) {
    return (
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <p className={note}>{t('intro')}</p>
        <div className={card}>
          <h2 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">{t('offTitle')}</h2>
          <p className={note}>
            {!settings.available
              ? t('notAvailable')
              : settings.canManage
                ? t('offOwner')
                : t('offMember')}
          </p>
          {settings.available && settings.canManage ? (
            <Button
              loading={saveSettings.isPending}
              onClick={() =>
                saveSettings.mutate(
                  { enabled: true, autoApproveNonFinancial: false },
                  { onError: (error) => setFailure(error) },
                )
              }
            >
              {t('turnOn')}
            </Button>
          ) : null}
          {failure ? (
            <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
              {errorText(failure)}
            </p>
          ) : null}
        </div>
      </div>
    )
  }

  // In-app proposals waiting in the queue that this person could decide.
  const waiting = (queue ?? [])
    .filter((entry) => entry.status === 'pending' && entry.run?.canApprove === true)
    .map((entry) => entry.run as AiPipelineRun)
    .filter((entry) => entry.id !== run?.id)
  const tooLong = request.length > ACTION_MAX_CHARACTERS

  return (
    <div className="flex-1 space-y-4 overflow-y-auto p-4">
      <p className={note}>{t('intro')}</p>

      <label className="block space-y-1">
        <span className={label}>{t('request')}</span>
        <textarea
          name="request"
          dir="auto"
          value={request}
          onChange={(event) => setRequest(event.target.value)}
          placeholder={t('requestPlaceholder')}
          className={area}
        />
        <span
          className={cn(
            'block text-xs tabular-nums',
            tooLong ? 'text-[hsl(var(--color-destructive))]' : 'text-[hsl(var(--fg-tertiary))]',
          )}
        >
          {number(request.length)} / {number(ACTION_MAX_CHARACTERS)}
        </span>
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-[hsl(var(--fg-secondary))]">
          <Switch size="sm" checked={dryRun} onCheckedChange={setDryRun} aria-label={t('dryRun')} />
          <span>{t('dryRun')}</span>
        </label>
        <Button
          onClick={submit}
          loading={start.isPending}
          disabled={busy || request.trim().length === 0 || tooLong}
        >
          {t('submit')}
        </Button>
      </div>
      {dryRun ? <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('dryRunHint')}</p> : null}

      {failure ? (
        <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
          {errorText(failure)}
        </p>
      ) : null}

      {run ? (
        <RunCard
          key={`${run.id}:${run.status}:${run.questions.length}`}
          run={run}
          t={t}
          show={show}
          fieldLabel={fieldLabel}
          busy={busy}
          onAnswer={(answers) => answer.mutate({ runId: run.id, answers }, settle)}
          onCancel={() => cancel.mutate(run.id, settle)}
          onApprove={() => decideRun(run, 'approve', true)}
          onReject={() => decideRun(run, 'reject', true)}
          onOpen={(route) => push(route)}
        />
      ) : null}

      {waiting.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
            {t('waitingTitle')}
          </h2>
          {waiting.map((entry) => (
            <RunCard
              key={entry.id}
              run={entry}
              t={t}
              show={show}
              fieldLabel={fieldLabel}
              busy={busy}
              onAnswer={() => undefined}
              onCancel={() => undefined}
              onApprove={() => decideRun(entry, 'approve', false)}
              onReject={() => decideRun(entry, 'reject', false)}
              onOpen={(route) => push(route)}
            />
          ))}
        </section>
      ) : null}

      {settings.canManage ? (
        <div className={card}>
          <label className="flex items-start justify-between gap-3">
            <span className="space-y-1">
              <span className="block text-sm font-medium text-[hsl(var(--fg-primary))]">
                {t('autoApprove')}
              </span>
              <span className="block text-xs leading-relaxed text-[hsl(var(--fg-tertiary))]">
                {t('autoApproveHint')}
              </span>
            </span>
            <Switch
              checked={settings.autoApproveNonFinancial}
              disabled={saveSettings.isPending}
              onCheckedChange={(next) =>
                saveSettings.mutate(
                  { enabled: true, autoApproveNonFinancial: next },
                  { onError: (error) => setFailure(error) },
                )
              }
              aria-label={t('autoApprove')}
            />
          </label>
          <Button
            variant="outline"
            size="sm"
            disabled={saveSettings.isPending}
            onClick={() =>
              saveSettings.mutate(
                { enabled: false, autoApproveNonFinancial: false },
                { onError: (error) => setFailure(error) },
              )
            }
          >
            {t('turnOff')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

type Translate = ReturnType<typeof useTranslations>

function RunCard({
  run,
  t,
  show,
  fieldLabel,
  busy,
  onAnswer,
  onCancel,
  onApprove,
  onReject,
  onOpen,
}: {
  run: AiPipelineRun
  t: Translate
  show: (change: AiPipelineChange, value: unknown) => string
  fieldLabel: (change: AiPipelineChange) => string
  busy: boolean
  onAnswer: (answers: Record<string, string>) => void
  /** Give up a run that is still asking — not a decision of the queue. */
  onCancel: () => void
  onApprove: () => void
  onReject: () => void
  onOpen: (route: string) => void
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const proposal = run.proposal
  const open = run.status === 'proposed' && !run.dryRun
  const answered = run.questions.some((question) => (answers[question.id] ?? '').trim() !== '')
  const route =
    run.entityType && run.entityId && (run.status === 'executed' || run.status === 'needs_review')
      ? routeForEntity(run.entityType, run.entityId)
      : null
  const mismatches = run.result?.mismatches ?? []

  const ask = (question: AiPipelineQuestion): string =>
    t(`questions.${question.field}.${question.reason}`, { subject: question.subject ?? '' })

  return (
    <article className={card} data-ai-run={run.status}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
          {run.operation ? t(`operations.${run.operation}`) : t('operations.unknown')}
          {proposal?.subject ? ` — ${proposal.subject}` : ''}
        </h3>
        <span className={cn('text-xs font-medium', STATUS_TONE[run.status])}>
          {t(`status.${run.status}`)}
        </span>
      </header>
      <p dir="auto" className="text-xs text-[hsl(var(--fg-tertiary))]">
        {run.requestText}
      </p>

      {run.status === 'needs_input' ? (
        <div className="space-y-3">
          {run.questions.map((question) => (
            <div key={question.id} className="space-y-1">
              <span className={label}>{ask(question)}</span>
              {question.kind === 'choice' ? (
                <SelectField
                  name={question.id}
                  data-field={question.id}
                  aria-label={ask(question)}
                  value={answers[question.id] ?? ''}
                  onChange={(next) => setAnswers((prev) => ({ ...prev, [question.id]: next }))}
                  placeholder={t('choose')}
                  options={(question.options ?? []).map((option) => ({
                    value: option.value,
                    label:
                      option.value === 'auto'
                        ? t('autoAllocation')
                        : option.hint
                          ? `${option.label} — ${option.hint}`
                          : option.label,
                  }))}
                  className={field}
                />
              ) : (
                <input
                  name={question.id}
                  dir="auto"
                  inputMode={question.kind === 'number' ? 'decimal' : 'text'}
                  value={answers[question.id] ?? ''}
                  onChange={(event) =>
                    setAnswers((prev) => ({ ...prev, [question.id]: event.target.value }))
                  }
                  aria-label={ask(question)}
                  className={field}
                />
              )}
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => onAnswer(answers)} disabled={busy || !answered} loading={busy}>
              {t('continue')}
            </Button>
            <Button variant="outline" onClick={onCancel} disabled={busy}>
              {t('cancel')}
            </Button>
          </div>
        </div>
      ) : null}

      {proposal ? (
        <div className="space-y-2">
          <span className={label}>{t(`proposalTitle.${proposal.action}`)}</span>
          <dl className="divide-y divide-[hsl(var(--border-default))] text-sm">
            {proposal.changes.map((change, index) => (
              <div
                key={`${change.entity}:${change.field}:${index}`}
                className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3 py-2"
              >
                <dt className="text-[hsl(var(--fg-secondary))]">{fieldLabel(change)}</dt>
                <dd className="text-[hsl(var(--fg-primary))]">
                  {proposal.action === 'update' ? (
                    <>
                      <span className="text-[hsl(var(--fg-tertiary))] line-through">
                        {show(change, change.from)}
                      </span>{' '}
                      <span aria-hidden="true">←</span>{' '}
                    </>
                  ) : null}
                  <span className="font-medium">{show(change, change.to)}</span>
                </dd>
              </div>
            ))}
          </dl>
          {proposal.warnings.length > 0 ? (
            <ul className="space-y-1">
              {proposal.warnings.map((warning, index) => (
                <li
                  key={`${warning.code}:${index}`}
                  className="text-xs leading-relaxed text-[hsl(var(--color-warning))]"
                >
                  {isOneOf(ACTION_WARNING_CODES, warning.code)
                    ? t(`warnings.${warning.code}`, warning.detail ?? {})
                    : warning.code}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {run.status === 'proposed' && run.dryRun ? <p className={note}>{t('dryRunDone')}</p> : null}
      {open && run.needsApprover ? <p className={note}>{t('needsApprover')}</p> : null}
      {open && run.canApprove ? (
        <div className="flex flex-wrap gap-2">
          <Button onClick={onApprove} disabled={busy} loading={busy}>
            {t('approve')}
          </Button>
          <Button variant="outline" onClick={onReject} disabled={busy}>
            {t('reject')}
          </Button>
        </div>
      ) : null}

      {run.status === 'executed' ? (
        <p className="text-sm text-[hsl(var(--color-success))]">
          {run.autoApproved ? t('doneAuto') : t('done')}
          {run.result?.number ? ` (${run.result.number})` : ''}
        </p>
      ) : null}
      {run.status === 'needs_review' ? (
        <div className="space-y-1">
          <p className="text-sm text-[hsl(var(--color-warning))]">{t('needsReview')}</p>
          <ul className="text-xs text-[hsl(var(--fg-secondary))]">
            {mismatches.map((miss) => (
              <li key={miss.field}>
                {t('mismatch', {
                  field: miss.field,
                  expected: String(miss.expected ?? ''),
                  actual: String(miss.actual ?? ''),
                })}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {run.status === 'failed' || run.status === 'refused' ? (
        <p className="text-sm text-[hsl(var(--fg-secondary))]">
          {isOneOf(ACTION_REASON_CODES, run.reasonCode)
            ? t(`reasons.${run.reasonCode}`)
            : t('reasons.general')}
        </p>
      ) : null}
      {route ? (
        <Button variant="outline" size="sm" onClick={() => onOpen(route)}>
          {t('open')}
        </Button>
      ) : null}

      {run.steps.length > 0 ? (
        <details className="text-xs text-[hsl(var(--fg-tertiary))]">
          <summary className="cursor-pointer select-none">{t('trail')}</summary>
          <ol className="mt-2 space-y-1">
            {run.steps.map((step) => (
              <li key={step.id} className="flex items-center justify-between gap-3">
                <span>
                  {isOneOf(ACTION_STAGES, step.stage) ? t(`stages.${step.stage}`) : step.stage}
                </span>
                <span>{t(`outcomes.${step.outcome}`)}</span>
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </article>
  )
}

export default AiActionTool
