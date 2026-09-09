'use client'

// ============================================
// packages/ui/src/components/ui/ai/containers/ai-assistant-container.tsx
//
// The assistant as a PAGE, at its own URL.
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS ALONGSIDE THE FLOATING BUTTON
//
// `AiAssistantLauncher` opens a popup over whatever screen you are on. That is
// right for «what does this number mean» while looking at the number, and
// wrong for everything else: the popup cannot be linked to, cannot be kept
// open beside another window, loses its thread when the route changes, and on
// a phone covers the page it is about.
//
// A route can be bookmarked, opened in a second window, and reached from the
// menu by someone who never noticed a floating button.
//
// ---------------------------------------------------------------------------
// ⚠️ IT DOES NOT RENDER NOTHING WHEN THERE IS NO PROVIDER
//
// The launcher hides itself entirely when `isConfigured` is false, and that is
// correct for a floating button — advertising a feature the account cannot use
// is worse than not advertising it.
//
// A PAGE cannot do that. Someone navigated here on purpose; a blank screen
// tells them the product is broken. So the unconfigured state is stated, with
// what has to happen and who can do it. That is the whole difference between a
// button that quietly stays away and a page that has to answer for itself.
// ============================================

import * as React from 'react'

import { useTranslations } from 'next-intl'
import type { ThreadMessageLike } from '@assistant-ui/react'
import { Sparkles } from 'lucide-react'

import { useAiAvailability, useAskAi, type AiQuotaExceeded } from '@hisabche/api'

import { AiAssistantPanel } from '../ai-assistant-panel'
import { cn } from '../../../../lib/utils'

export function AiAssistantContainer() {
  // ⚠️ RESOLVED HERE, NOT PASSED IN. Every other container in this package
  // reads its own strings — the page that renders it is a server component and
  // cannot hand a function across that boundary. Desktop mounts the same
  // component through its next-intl shim.
  const translate = useTranslations()

  /**
   * ⚠️ NON-THROWING. `next-intl`'s `t()` throws on a missing key, and this
   * screen reads a dozen. One absent string would replace the whole assistant
   * with an error boundary — for a missing label.
   */
  const tr = React.useCallback(
    (key: string, fallback?: string): string => {
      try {
        const value = translate(key as Parameters<typeof translate>[0])
        return value && value !== key ? value : (fallback ?? key)
      } catch {
        return fallback ?? key
      }
    },
    [translate],
  )

  const [messages, setMessages] = React.useState<ThreadMessageLike[]>([])
  const [exceeded, setExceeded] = React.useState<AiQuotaExceeded | null>(null)

  const { data: availability, isLoading } = useAiAvailability()
  const ask = useAskAi()

  const send = React.useCallback(
    (text: string) => {
      setExceeded(null)
      setMessages((prev) => [...prev, { role: 'user', content: [{ type: 'text', text }] }])

      ask.mutate(text, {
        onSuccess: (result) => {
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: [{ type: 'text', text: result.answer }] },
          ])
        },
        onError: (error) => {
          const quota = (error as Error & { quotaExceeded?: AiQuotaExceeded }).quotaExceeded
          if (quota) {
            // ⚠️ NOT appended to the thread. Running out of questions is not an
            // ANSWER, and putting it in the transcript would make it read as
            // though the assistant said it.
            setExceeded(quota)
            return
          }
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: [
                { type: 'text', text: tr('ai.error', 'پاسخ گرفته نشد. دوباره تلاش کنید.') },
              ],
            },
          ])
        },
      })
    },
    [ask, tr],
  )

  // ─── Not ready yet ───
  if (isLoading) {
    return (
      <Shell t={tr}>
        <div className="flex flex-1 items-center justify-center">
          <span className="text-sm text-[hsl(var(--fg-tertiary))]">
            {tr('common.loading', 'در حال بارگذاری…')}
          </span>
        </div>
      </Shell>
    )
  }

  // ─── No provider ───
  if (!availability?.isConfigured) {
    return (
      <Shell t={tr}>
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-md text-center">
            <div
              className={cn(
                'mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl',
                'bg-[hsl(var(--color-primary)/0.10)]',
              )}
            >
              <Sparkles className="size-6 text-[hsl(var(--color-primary))]" aria-hidden="true" />
            </div>
            <h2 className="text-base font-semibold text-[hsl(var(--fg-primary))]">
              {tr('ai.notConfiguredTitle', 'دستیار هنوز فعال نشده است')}
            </h2>
            {/* ⚠️ Says WHO can fix it. «Not configured» on its own sends the
                person looking through their own settings for a switch that is
                not there — the provider is set by the platform, not by the
                workspace. */}
            <p className="mt-2 text-sm leading-relaxed text-[hsl(var(--fg-secondary))]">
              {tr(
                'ai.notConfiguredBody',
                'برای فعال شدن دستیار، مدیر سامانه باید ارائه‌دهنده‌ی هوش مصنوعی را تنظیم کند. تا آن زمان این صفحه کار نمی‌کند.',
              )}
            </p>
          </div>
        </div>
      </Shell>
    )
  }

  // ─── Ready ───
  const quota = availability.quota
  const spent = exceeded !== null

  return (
    <Shell t={tr} remaining={quota?.remaining ?? null}>
      <AiAssistantPanel
        t={tr}
        messages={messages}
        isRunning={ask.isPending}
        onSend={send}
        disabled={spent}
        notice={
          spent ? (
            <p className="text-xs leading-relaxed text-[hsl(var(--color-warning))]">
              {tr('ai.quotaExceeded', 'سهم پرسش‌های شما تمام شده است.')} {availability.topupContact}
            </p>
          ) : undefined
        }
      />
    </Shell>
  )
}

/** The page frame: title, remaining allowance, and a column that fills the screen. */
function Shell({
  t,
  remaining,
  children,
}: {
  t: (key: string, fallback?: string) => string
  remaining?: number | null
  children: React.ReactNode
}) {
  return (
    // ⚠️ A FIXED HEIGHT, NOT `min-h`. The transcript scrolls inside itself and
    // the composer stays at the bottom; with `min-h` the page grows instead and
    // the input walks off the end of a long conversation.
    <div className="flex h-[calc(100vh-9rem)] flex-col gap-4">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-lg font-bold text-[hsl(var(--fg-primary))]">
          <Sparkles
            className="size-5 shrink-0 text-[hsl(var(--color-primary))]"
            aria-hidden="true"
          />
          {t('ai.title', 'دستیار هوشمند')}
        </h1>

        {/* Real number or nothing. A «—» where a count belongs reads as a
            broken value rather than as an absent one. */}
        {typeof remaining === 'number' ? (
          <span
            className={cn(
              'rounded-full px-2.5 py-1 text-xs',
              'bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-secondary))]',
            )}
          >
            {t('ai.remaining', 'پرسش باقی‌مانده')}:{' '}
            <span className="tabular-nums">{remaining}</span>
          </span>
        ) : null}
      </header>

      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl',
          'border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]',
        )}
      >
        {children}
      </div>
    </div>
  )
}

export default AiAssistantContainer
