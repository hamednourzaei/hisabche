'use client'

// ============================================
// A campaign recipient's own page — PUBLIC, no account. The token in the link
// from their email is the credential.
//
// Two things can be done here, each with one deliberate press:
//   · answer the NPS question (0–10, with an optional comment);
//   · ask not to be written to again.
//
// ⚠️ NOTHING IS RECORDED ON LOAD. The score in the link is only pre-selected:
// mail scanners follow links, and a page that recorded on arrival would file
// answers nobody gave.
// ⚠️ An answer is given once. «Already answered» and «this link has expired»
// are said as such.
// ============================================

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useAnswerFeedback, useFeedbackView, useUnsubscribeFeedback } from '@hisabche/api'

import { cn } from '../../../lib/utils'
import { Button } from '../button'

const SCORES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const

export function FeedbackContainer({
  token,
  initialScore,
  startUnsubscribe,
}: {
  token: string
  /** From `?score=` in the emailed link; pre-selects, records nothing. */
  initialScore?: number | undefined
  /** From `?unsubscribe=1`; shows the opt-out question first. */
  startUnsubscribe?: boolean | undefined
}) {
  const t = useTranslations('feedback')
  const view = useFeedbackView(token)
  const answer = useAnswerFeedback(token)
  const unsubscribe = useUnsubscribeFeedback(token)
  const [score, setScore] = useState<number | null>(
    typeof initialScore === 'number' && initialScore >= 0 && initialScore <= 10
      ? Math.round(initialScore)
      : null,
  )
  const [comment, setComment] = useState('')

  const shell = (children: React.ReactNode) => (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-lg flex-col justify-center px-4 py-10">
      <div className="space-y-4 rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-6">
        {children}
      </div>
    </div>
  )

  if (view.isLoading) {
    return shell(<p className="text-sm text-[hsl(var(--fg-secondary))]">{t('loading')}</p>)
  }
  if (view.error || !view.data) {
    const status = (view.error as { response?: { status?: number } } | null)?.response?.status
    return shell(
      <p role="alert" className="text-sm text-[hsl(var(--fg-primary))]">
        {status === 404 || status === 400 ? t('invalidLink') : t('loadFailed')}
      </p>,
    )
  }

  const data = view.data
  const unsubscribed = data.unsubscribed || unsubscribe.isSuccess
  const answered = data.answered || answer.isSuccess

  return shell(
    <>
      <h1 className="text-lg font-bold text-[hsl(var(--fg-primary))]" dir="auto">
        {data.businessName}
      </h1>

      {data.asksForScore && !startUnsubscribe ? (
        answered ? (
          <p className="text-sm text-[hsl(var(--fg-primary))]">
            {answer.data && !answer.data.recorded
              ? t('alreadyAnswered')
              : data.answered
                ? t('alreadyAnswered')
                : t('thanks')}
          </p>
        ) : !data.canAnswer ? (
          <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('expired')}</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium text-[hsl(var(--fg-primary))]">{t('question')}</p>
            <div
              className="flex flex-wrap gap-1.5"
              dir="ltr"
              role="radiogroup"
              aria-label={t('question')}
            >
              {SCORES.map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={score === value}
                  onClick={() => setScore(value)}
                  className={cn(
                    'size-10 rounded-lg border text-sm font-medium tabular-nums transition-colors motion-reduce:transition-none',
                    score === value
                      ? 'border-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary))] text-[hsl(var(--color-primary-fg))]'
                      : 'border-[hsl(var(--border-default))] text-[hsl(var(--fg-primary))] hover:bg-[hsl(var(--surface-muted))]',
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
            <p className="flex justify-between text-xs text-[hsl(var(--fg-tertiary))]">
              <span>{t('low')}</span>
              <span>{t('high')}</span>
            </p>
            <textarea
              name="comment"
              value={comment}
              maxLength={1000}
              rows={3}
              onChange={(event) => setComment(event.target.value)}
              placeholder={t('commentPlaceholder')}
              aria-label={t('commentPlaceholder')}
              className="w-full rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-3 text-sm text-[hsl(var(--fg-primary))] outline-none focus:border-[hsl(var(--color-primary))]"
            />
            {answer.error ? (
              <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
                {t('submitFailed')}
              </p>
            ) : null}
            <Button
              disabled={score === null || answer.isPending}
              onClick={() =>
                score !== null && answer.mutate({ score, comment: comment.trim() || null })
              }
            >
              {t('submit')}
            </Button>
          </div>
        )
      ) : null}

      <div className="border-t border-[hsl(var(--border-default))] pt-3">
        {unsubscribed ? (
          <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('unsubscribed')}</p>
        ) : (
          <div className="space-y-2">
            {startUnsubscribe ? (
              <p className="text-sm text-[hsl(var(--fg-primary))]">{t('unsubscribeQuestion')}</p>
            ) : null}
            {unsubscribe.error ? (
              <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
                {t('submitFailed')}
              </p>
            ) : null}
            <Button
              size="sm"
              variant={startUnsubscribe ? 'default' : 'ghost'}
              disabled={unsubscribe.isPending}
              onClick={() => unsubscribe.mutate()}
            >
              {t('unsubscribe')}
            </Button>
          </div>
        )}
      </div>
    </>,
  )
}
