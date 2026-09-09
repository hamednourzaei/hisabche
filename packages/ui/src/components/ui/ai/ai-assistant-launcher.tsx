'use client'

// ============================================
// packages/ui/src/components/ui/ai/ai-assistant-launcher.tsx
//
// T13 — «یک دکمه‌ی شاین‌دار در بخش AI · با کلیک → پاپ‌آپ محیط گفتگو».
//
// ---------------------------------------------------------------------------
// ⚠️ THE BUTTON DOES NOT APPEAR UNTIL A PROVIDER IS CONFIGURED
//
// `GET /api/ai/quota` reports `isConfigured`. Rendering a shining button that
// opens a window which can only say «not configured» is worse than no button:
// it advertises a feature the account cannot use, and the person cannot tell
// whether they did something wrong.
//
// The same reasoning as the display-basis picker in T10, which hides itself
// when there is only one basis to choose.
// ============================================

import * as React from 'react'

import type { ThreadMessageLike } from '@assistant-ui/react'
import { Maximize2, Sparkles, X } from 'lucide-react'

import { useAiAvailability, useAskAi, type AiQuotaExceeded } from '@hisabche/api'

import { AiAssistantPanel } from './ai-assistant-panel'
import { cn } from '../../../lib/utils'

export interface AiAssistantLauncherProps {
  t?: ((key: string, fallback?: string) => string) | undefined
  /**
   * Where the full-page assistant lives, already locale-prefixed.
   *
   * Optional: this package has no router, so the host builds it. Absent means
   * no link rather than a link to the wrong place.
   */
  fullPageHref?: string | undefined
}

export function AiAssistantLauncher({ t, fullPageHref }: AiAssistantLauncherProps) {
  const tr = (key: string, fallback: string) => (t ? t(key, fallback) : fallback)

  const [open, setOpen] = React.useState(false)
  const [messages, setMessages] = React.useState<ThreadMessageLike[]>([])
  const [exceeded, setExceeded] = React.useState<AiQuotaExceeded | null>(null)

  const { data: availability } = useAiAvailability()
  const ask = useAskAi()

  const send = (text: string) => {
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
          // Out of questions. Not appended to the thread as an assistant
          // message — it is not an answer, and putting it there would make the
          // transcript read as though the assistant said it.
          setExceeded(quota)
          return
        }
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: tr('ai.error', 'نتوانستم پاسخ بدهم. لطفاً دوباره تلاش کنید.'),
              },
            ],
          },
        ])
      },
    })
  }

  // Nothing configured — no button at all. See the header.
  if (!availability?.isConfigured) return null

  const quota = availability.quota

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'group relative inline-flex items-center gap-2 overflow-hidden rounded-full px-4 py-2',
          'text-sm font-bold text-white',
          'bg-[var(--gradient-brand)]',
          'shadow-[0_4px_16px_-4px_hsl(var(--color-primary)/0.5)]',
          'transition-transform hover:scale-[1.02] active:scale-[0.98]',
          // The «shine»: a highlight that sweeps across on hover. Behind
          // `motion-reduce` because a looping animation on a dashboard is a
          // real accessibility problem for some people.
          'motion-safe:before:absolute motion-safe:before:inset-0',
          'motion-safe:before:-translate-x-full motion-safe:before:bg-gradient-to-r',
          'motion-safe:before:from-transparent motion-safe:before:via-white/30 motion-safe:before:to-transparent',
          'motion-safe:before:transition-transform motion-safe:before:duration-700',
          'motion-safe:group-hover:before:translate-x-full',
        )}
      >
        <Sparkles className="size-4 shrink-0" aria-hidden="true" />
        <span className="relative">{tr('ai.launch', 'پرسش از دستیار')}</span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={tr('ai.title', 'دستیار حسابچه')}
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false)
          }}
        >
          <div
            className={cn(
              'flex w-full flex-col overflow-hidden bg-[hsl(var(--surface-base))]',
              // Full height on a phone, a panel on a desktop.
              'h-[85vh] rounded-t-2xl sm:h-[70vh] sm:max-w-lg sm:rounded-2xl',
              'border border-[hsl(var(--border-default))] shadow-2xl',
            )}
          >
            <header className="flex items-center justify-between border-b border-[hsl(var(--border-default))] px-4 py-3">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-[hsl(var(--color-primary))]" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
                  {tr('ai.title', 'دستیار حسابچه')}
                </h2>
              </div>

              <div className="flex items-center gap-3">
                {/* The allowance, always visible. Someone about to be cut off
                    should know before they are, not after. */}
                <span className="text-[11px] tabular-nums text-[hsl(var(--fg-tertiary))]">
                  {quota.used} / {quota.limit}
                </span>

                {/* ⚠️ A WAY OUT OF THE POPUP.
                    The popup is right for a quick question about the screen
                    behind it, and wrong for a long conversation: it is narrow,
                    it sits over the page, and its thread is lost the moment the
                    route changes. This hands the person the page, which can be
                    bookmarked and kept open.

                    `fullPageHref` is passed in rather than built here — this
                    package has no router and no idea what the locale prefix
                    is. When the host does not supply one, the link is simply
                    absent instead of pointing somewhere wrong. */}
                {fullPageHref ? (
                  <a
                    href={fullPageHref}
                    aria-label={tr('ai.openFullPage', 'باز کردن در صفحه‌ی کامل')}
                    title={tr('ai.openFullPage', 'باز کردن در صفحه‌ی کامل')}
                    className="rounded-lg p-1 text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]"
                  >
                    <Maximize2 className="size-4" aria-hidden="true" />
                  </a>
                ) : null}

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label={tr('common.close', 'بستن')}
                  className="rounded-lg p-1 text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--surface-muted))]"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>
            </header>

            <div className="min-h-0 flex-1">
              <AiAssistantPanel
                t={t}
                messages={messages}
                isRunning={ask.isPending}
                onSend={send}
                disabled={Boolean(exceeded)}
                notice={
                  exceeded ? (
                    <div className="rounded-xl border border-[hsl(var(--color-warning)/0.4)] bg-[hsl(var(--color-warning)/0.1)] p-3 text-xs">
                      <p className="font-medium text-[hsl(var(--fg-primary))]">
                        {tr('ai.quotaExceeded', 'سقف پرسش‌های این ماه تمام شده است.')}
                      </p>
                      {exceeded.topupContact ? (
                        <p className="mt-1 text-[hsl(var(--fg-secondary))]">
                          {tr('ai.topupHint', 'برای افزایش سقف تماس بگیرید:')}{' '}
                          {/* Plain text, not a link: the admin types this and
                              it may be a Telegram id, a WhatsApp number or a
                              username. Guessing a URL scheme would produce a
                              broken link more often than a working one. */}
                          <span className="font-medium text-[hsl(var(--fg-primary))]">
                            {exceeded.topupContact}
                          </span>
                        </p>
                      ) : null}
                    </div>
                  ) : null
                }
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

export default AiAssistantLauncher
