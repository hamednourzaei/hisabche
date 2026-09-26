'use client'

// ============================================
// packages/ui/src/components/ui/ai/ai-assistant-panel.tsx
//
// T13 — the chat window.
//
// ---------------------------------------------------------------------------
// ⚠️ THE CONVERSATION UI IS NOT HAND-WRITTEN, ON PURPOSE
//
// The owner asked for this explicitly: «مهمه که از صفر پیاده سازی نشه … یه
// نسخه ۱۰ از ۱۰ پیدا کن». So the thread, the message list, the composer, the
// auto-scroll, the keyboard handling, the streaming affordances and the RTL
// behaviour all come from `@assistant-ui/react`.
//
// That is worth doing for reasons beyond time: a chat transcript is a
// surprisingly deep component — scroll anchoring that survives new messages,
// focus that does not jump on mobile keyboards, and screen-reader semantics
// for a list that grows from the bottom. Rebuilding those badly is worse than
// not having them.
//
// ---------------------------------------------------------------------------
// ⚠️ `useExternalStoreRuntime`, NOT THE LIBRARY'S OWN TRANSPORT
//
// assistant-ui can talk to a provider directly. It must not here. Every
// question has to go through `POST /api/ai/ask`, because that endpoint is
// where the quota is checked, where the reporting views are read WITH THE
// USER'S OWN TOKEN, and where `ai_query_log` is written.
//
// The external-store adapter keeps our API the source of truth and uses the
// library for what it is good at — the surface.
// ============================================

import * as React from 'react'

import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useExternalStoreRuntime,
  type ThreadMessageLike,
} from '@assistant-ui/react'
import { Send, Sparkles } from 'lucide-react'

import { cn } from '../../../lib/utils'

/**
 * The «thinking» label, handed from the panel (which has `t`) down to the
 * message components the library renders (which do not).
 */
const ThinkingLabel = React.createContext('')

/**
 * What an assistant message shows before its answer arrives.
 *
 * ⚠️ The library's default was a lone «●» — reported as «فقط یه نقطه هست»:
 * nothing said the question had been received and was being worked on.
 * The answer comes back whole (no streaming), so this is the whole wait.
 * `Empty` is what the library renders for a message with no parts yet; its
 * `status` says whether that message is still running.
 */
function ThinkingPart({ status }: { status: { type: string } }) {
  const label = React.useContext(ThinkingLabel)
  if (status.type !== 'running') return null
  return (
    <span
      role="status"
      data-thinking=""
      className="inline-flex items-center gap-2 text-[hsl(var(--fg-secondary))]"
    >
      <span className="inline-flex gap-1" aria-hidden="true">
        <span className="size-1.5 animate-bounce rounded-full bg-[hsl(var(--color-primary))] [animation-delay:-0.3s] motion-reduce:animate-none" />
        <span className="size-1.5 animate-bounce rounded-full bg-[hsl(var(--color-primary))] [animation-delay:-0.15s] motion-reduce:animate-none" />
        <span className="size-1.5 animate-bounce rounded-full bg-[hsl(var(--color-primary))] motion-reduce:animate-none" />
      </span>
      {label}
    </span>
  )
}

export interface AiAssistantPanelProps {
  t?: ((key: string, fallback?: string) => string) | undefined
  messages: ThreadMessageLike[]
  isRunning: boolean
  onSend: (text: string) => void
  /** Rendered above the composer — quota warnings, top-up contact, errors. */
  notice?: React.ReactNode | undefined
  /** Blocks the composer, e.g. when the allowance is spent. */
  disabled?: boolean | undefined
}

export function AiAssistantPanel({
  t,
  messages,
  isRunning,
  onSend,
  notice,
  disabled,
}: AiAssistantPanelProps) {
  const tr = (key: string, fallback: string) => (t ? t(key, fallback) : fallback)

  const runtime = useExternalStoreRuntime({
    messages,
    isRunning,
    // Our messages are ALREADY in the library's shape, so the converter is
    // identity. It is required rather than optional because the adapter is
    // generic over any store shape; declaring it keeps that generic honest
    // instead of casting the whole adapter.
    convertMessage: (message: ThreadMessageLike) => message,
    onNew: async (message) => {
      // The composer only ever produces text parts. Anything else would be an
      // attachment, which this endpoint does not accept.
      const text = message.content
        .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
        .map((part) => part.text)
        .join('\n')
        .trim()

      if (text) onSend(text)
    },
  })

  return (
    <ThinkingLabel.Provider value={tr('ai.thinking', 'در حال فکر کردن…')}>
      <AssistantRuntimeProvider runtime={runtime}>
        <ThreadPrimitive.Root className="flex h-full min-h-0 flex-col bg-[hsl(var(--surface-base))]">
          <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto px-4 py-3">
            <ThreadPrimitive.Empty>
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Sparkles className="size-6 text-[hsl(var(--color-primary))]" aria-hidden="true" />
                <p className="text-sm font-medium text-[hsl(var(--fg-primary))]">
                  {tr('ai.emptyTitle', 'از دفترهایتان بپرسید')}
                </p>
                <p className="max-w-xs text-xs text-[hsl(var(--fg-tertiary))]">
                  {tr(
                    'ai.emptyHint',
                    'مثلاً: کدام مشتری بیشترین بدهی را دارد؟ · کدام کالاها به نقطه‌ی سفارش رسیده‌اند؟',
                  )}
                </p>
              </div>
            </ThreadPrimitive.Empty>

            <ThreadPrimitive.Messages components={{ UserMessage, AssistantMessage }} />
          </ThreadPrimitive.Viewport>

          {notice ? <div className="px-4 pb-2">{notice}</div> : null}

          <ComposerPrimitive.Root className="flex items-end gap-2 border-t border-[hsl(var(--border-default))] p-3">
            <ComposerPrimitive.Input
              autoFocus
              disabled={Boolean(disabled)}
              placeholder={tr('ai.placeholder', 'سؤالتان را بنویسید…')}
              rows={1}
              className={cn(
                'max-h-32 flex-1 resize-none rounded-xl px-3 py-2 text-sm',
                'border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]',
                'text-[hsl(var(--fg-primary))] outline-none',
                'focus:border-[hsl(var(--color-primary))]',
                'disabled:opacity-50',
              )}
            />
            <ComposerPrimitive.Send
              disabled={Boolean(disabled)}
              className="shrink-0 rounded-xl bg-[hsl(var(--color-primary))] p-2.5 text-[hsl(var(--color-primary-fg))] disabled:opacity-40"
              aria-label={tr('ai.send', 'ارسال')}
            >
              <Send className="size-4" aria-hidden="true" />
            </ComposerPrimitive.Send>
          </ComposerPrimitive.Root>
        </ThreadPrimitive.Root>
      </AssistantRuntimeProvider>
    </ThinkingLabel.Provider>
  )
}

function UserMessage() {
  return (
    <MessagePrimitive.Root className="mb-3 flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-se-sm bg-[hsl(var(--color-primary)/0.12)] px-3 py-2 text-sm text-[hsl(var(--fg-primary))]">
        <MessagePrimitive.Parts />
      </div>
    </MessagePrimitive.Root>
  )
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="mb-3 flex justify-start">
      <div
        className={cn(
          'max-w-[85%] rounded-2xl rounded-ss-sm px-3 py-2',
          'border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]',
          // `whitespace-pre-wrap` so the model's own line breaks survive — an
          // answer listing five overdue invoices is unreadable as one run-on
          // paragraph.
          'whitespace-pre-wrap text-sm leading-relaxed text-[hsl(var(--fg-primary))]',
        )}
      >
        <MessagePrimitive.Parts components={{ Empty: ThinkingPart }} />
      </div>
    </MessagePrimitive.Root>
  )
}

export default AiAssistantPanel
