'use client'

// ============================================
// «دستیارهای هوش مصنوعی» — connecting an AI assistant (Claude, ChatGPT, Gemini,
// Cursor, any MCP client) and approving what it asks for.
//
// Two things, and only these:
//   1. the address an assistant connects to, and that it uses an API key from
//      this same page — there is no separate credential;
//   2. the queue of actions an assistant asked for that move money or stock.
//      Nothing in that queue has happened; approving runs it as YOU, once.
//
// ⚠️ What the assistant asked for is shown as it was sent (tool and arguments),
// as DATA. It is never rendered as instructions to the person.
// ⚠️ «Not set up», «not allowed», «failed» and «nothing waiting» are four
// different sentences.
// ============================================

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Bot } from 'lucide-react'
import {
  apiErrorMessage,
  mcpEndpointUrl,
  useAiActionRequests,
  useDecideAiActionRequest,
} from '@hisabche/api'

import { cn } from '../../../lib/utils'
import { useDateFormat } from '../../../hooks/use-date-format'
import { Button } from '../button'

/** The tools that can land in the queue — the gateway's risky ones. */
export const AI_REQUEST_TOOLS = [
  'create_invoice',
  'confirm_order',
  'fulfill_order',
  'invoice_order',
  'cancel_order',
] as const
export const AI_REQUEST_STATUSES = [
  'pending',
  'approved',
  'executed',
  'failed',
  'rejected',
  'expired',
] as const
export const AI_REQUEST_ERROR_CODES = [
  'AI_REQUEST_ALREADY_DECIDED',
  'AI_REQUEST_EXPIRED',
  'AI_REQUESTS_MIGRATION_PENDING',
] as const

const card =
  'rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]'

export function AiAssistantsPanel() {
  const t = useTranslations('aiConnect')
  const { dateTime } = useDateFormat()
  const [open, setOpen] = useState(false)
  const requests = useAiActionRequests(open)
  const decide = useDecideAiActionRequest()
  const [confirming, setConfirming] = useState<string | null>(null)

  const message = (error: unknown): string => {
    if ((error as { response?: { status?: number } } | null)?.response?.status === 403)
      return t('forbidden')
    const raw = apiErrorMessage(error, '')
    const code = AI_REQUEST_ERROR_CODES.find((known) => raw.includes(known))
    return code ? t(`errors.${code}`) : t('errors.general')
  }
  const known = <T extends string>(value: string, list: readonly T[]): value is T =>
    (list as readonly string[]).includes(value)

  const pending = (requests.data ?? []).filter((request) => request.status === 'pending')
  const decided = (requests.data ?? [])
    .filter((request) => request.status !== 'pending')
    .slice(0, 10)

  return (
    <section className={cn(card, 'space-y-4 p-4')}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-[hsl(var(--fg-primary))]">
            <Bot className="size-4 text-[hsl(var(--color-primary))]" aria-hidden="true" />
            {t('title')}
          </h2>
          <p className="mt-1 text-xs text-[hsl(var(--fg-tertiary))]">{t('subtitle')}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setOpen((value) => !value)}>
          {open ? t('hide') : t('show')}
        </Button>
      </div>

      {open ? (
        <>
          <div className="space-y-2 rounded-xl bg-[hsl(var(--surface-muted))] p-3 text-sm">
            <p className="text-xs text-[hsl(var(--fg-secondary))]">{t('endpoint')}</p>
            <code
              dir="ltr"
              className="block break-all font-mono text-sm text-[hsl(var(--fg-primary))]"
            >
              {mcpEndpointUrl()}
            </code>
            <ol className="list-decimal space-y-1 ps-5 text-xs text-[hsl(var(--fg-secondary))]">
              <li>{t('step1')}</li>
              <li>{t('step2')}</li>
              <li>{t('step3')}</li>
            </ol>
            <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('safety')}</p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
              {t('queueTitle')}
            </h3>
            {requests.isLoading ? (
              <div className="h-11 animate-pulse rounded-xl bg-[hsl(var(--surface-muted))]" />
            ) : requests.error || !requests.data ? (
              <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
                {message(requests.error)}
              </p>
            ) : pending.length === 0 ? (
              <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('queueEmpty')}</p>
            ) : (
              <ul className="space-y-2">
                {pending.map((request) => (
                  <li
                    key={request.id}
                    className="space-y-2 rounded-xl border border-[hsl(var(--border-default))] p-3"
                  >
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-[hsl(var(--fg-primary))]">
                      {known(request.tool, AI_REQUEST_TOOLS)
                        ? t(`tools.${request.tool}`)
                        : request.tool}
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs',
                          request.risk === 'destructive'
                            ? 'bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))]'
                            : 'bg-[hsl(var(--color-warning)/0.15)] text-[hsl(var(--fg-primary))]',
                        )}
                      >
                        {t(`risks.${request.risk}`)}
                      </span>
                      <span className="ms-auto text-xs font-normal text-[hsl(var(--fg-tertiary))]">
                        {dateTime(request.createdAt)}
                      </span>
                    </p>
                    <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('argumentsLabel')}</p>
                    <pre
                      dir="ltr"
                      className="max-h-48 overflow-auto rounded-lg bg-[hsl(var(--surface-muted))] p-2 text-xs text-[hsl(var(--fg-secondary))]"
                    >
                      {JSON.stringify(request.arguments, null, 2)}
                    </pre>
                    {confirming === request.id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-[hsl(var(--fg-primary))]">
                          {t('approveConfirm')}
                        </span>
                        <Button
                          size="sm"
                          disabled={decide.isPending}
                          onClick={() =>
                            decide.mutate(
                              { id: request.id, decision: 'approve' },
                              { onSettled: () => setConfirming(null) },
                            )
                          }
                        >
                          {t('approveYes')}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                          {t('cancel')}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => setConfirming(request.id)}>
                          {t('approve')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={decide.isPending}
                          onClick={() => decide.mutate({ id: request.id, decision: 'reject' })}
                        >
                          {t('reject')}
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {decide.error ? (
              <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
                {message(decide.error)}
              </p>
            ) : null}
          </div>

          {decided.length > 0 ? (
            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
                {t('historyTitle')}
              </h3>
              <ul className="space-y-1 text-xs text-[hsl(var(--fg-secondary))]">
                {decided.map((request) => (
                  <li key={request.id} className="flex flex-wrap items-center gap-2">
                    <span>
                      {known(request.tool, AI_REQUEST_TOOLS)
                        ? t(`tools.${request.tool}`)
                        : request.tool}
                    </span>
                    <span className="font-medium text-[hsl(var(--fg-primary))]">
                      {known(request.status, AI_REQUEST_STATUSES)
                        ? t(`statuses.${request.status}`)
                        : request.status}
                    </span>
                    <span className="ms-auto text-[hsl(var(--fg-tertiary))]">
                      {dateTime(request.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
