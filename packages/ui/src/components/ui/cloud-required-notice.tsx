'use client'

// ============================================
// packages/ui/src/components/ui/cloud-required-notice.tsx
//
// «این کار اینترنت می‌خواهد» — Cloud-Required Notice
//
// Rendered when an action, tab, or screen requires a cloud connection /
// server execution and the device is currently running in the offline edition.
//
// ⚠️ HONESTY FIRST (Rule 10):
// - No fake success, no blank page, no disabled-without-reason button.
// - Clearly explains WHAT needs the server, WHY, and WHAT TO DO.
// - Explicitly reassures the user that their local data is safe and untouched.
//
// ⚠️ DESIGN DISCIPLINE (Rule 5):
// - Design tokens only: hsl(var(--...)). Zero hex, zero Tailwind palette colors.
// - RTL logical properties only: ms-*, me-*, ps-*, pe-*, text-start, border-s/e.
// - Fully responsive and adaptive to dark / light modes.
// ============================================

import React, { memo } from 'react'
import { useTranslations } from 'next-intl'
import { CloudOff, RotateCcw, ShieldCheck, HelpCircle, ArrowUpRight, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from './button'
import { Badge } from './badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './card'

export type CloudRequiredVariant = 'card' | 'inline' | 'fullscreen'

export interface CloudRequiredNoticeProps {
  /** Override for the feature title (e.g. «فرمول ساخت (BOM)» or «هوش مصنوعی») */
  title?: string | undefined
  /** Override for the badge text (defaults to «نیازمند اینترنت») */
  badgeText?: string | undefined
  /** Main description of why the feature is offline-limited */
  description?: string | undefined
  /** Specific explanation of why a cloud server connection is required */
  why?: string | undefined
  /** Actionable guidance on what the person should do */
  whatToDo?: string | undefined
  /** Visual presentation variant */
  variant?: CloudRequiredVariant | undefined
  /** Optional retry handler */
  onRetry?: (() => void) | undefined
  /** Optional dismiss / close handler */
  onDismiss?: (() => void) | undefined
  /** Optional navigate to dashboard / home handler */
  onHome?: (() => void) | undefined
  /** Whether to show the «local data is safe» assurance banner (default: true) */
  showDataSafeNotice?: boolean | undefined
  /** Additional CSS class names */
  className?: string | undefined
}

export const CloudRequiredNotice = memo(function CloudRequiredNotice({
  title,
  badgeText,
  description,
  why,
  whatToDo,
  variant = 'card',
  onRetry,
  onDismiss,
  onHome,
  showDataSafeNotice = true,
  className,
}: CloudRequiredNoticeProps) {
  const t = useTranslations('offline.cloudRequired')

  const effectiveTitle = title ?? t('title')
  const effectiveBadge = badgeText ?? t('badge')
  const effectiveDescription = description ?? t('description')
  const effectiveWhy = why ?? t('whyDefault')
  const effectiveWhatToDo = whatToDo ?? t('whatToDoDefault')

  // ─── Inline Banner Variant ──────────────────────────────────────────────
  if (variant === 'inline') {
    return (
      <div
        role="alert"
        aria-live="polite"
        data-cloud-required="inline"
        className={cn(
          'flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5',
          'border-[hsl(var(--color-warning)/0.3)] bg-[hsl(var(--color-warning)/0.08)]',
          'text-[hsl(var(--fg-primary))]',
          className,
        )}
      >
        <div className="flex items-center gap-2.5 text-start">
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--color-warning)/0.15)] text-[hsl(var(--color-warning))]">
            <CloudOff className="size-4" aria-hidden="true" />
          </span>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[hsl(var(--fg-primary))]">
                {effectiveTitle}
              </span>
              <Badge variant="warning" size="sm">
                {effectiveBadge}
              </Badge>
            </div>
            <p className="text-xs text-[hsl(var(--fg-secondary))]">{effectiveDescription}</p>
          </div>
        </div>

        <div className="ms-auto flex items-center gap-2">
          {onRetry ? (
            <Button type="button" variant="outline" size="sm" onClick={onRetry} className="text-xs">
              <RotateCcw className="me-1.5 size-3.5" aria-hidden="true" />
              {t('retry')}
            </Button>
          ) : null}
          {onDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              aria-label={t('dismiss')}
              className="rounded-lg p-1 text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  // ─── Fullscreen Screen Variant ──────────────────────────────────────────
  if (variant === 'fullscreen') {
    return (
      <div
        role="alert"
        aria-live="polite"
        data-cloud-required="fullscreen"
        className={cn(
          'mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-12 text-center',
          className,
        )}
      >
        <div className="mb-4 inline-flex size-16 items-center justify-center rounded-2xl border border-[hsl(var(--color-warning)/0.3)] bg-[hsl(var(--color-warning)/0.1)] text-[hsl(var(--color-warning))] shadow-sm">
          <CloudOff className="size-8" aria-hidden="true" />
        </div>

        <Badge variant="warning" className="mb-3">
          {effectiveBadge}
        </Badge>

        <h1 className="text-xl font-bold text-[hsl(var(--fg-primary))] sm:text-2xl">
          {effectiveTitle}
        </h1>

        <p className="mt-2.5 max-w-md text-sm leading-relaxed text-[hsl(var(--fg-secondary))]">
          {effectiveDescription}
        </p>

        <div className="mt-6 w-full rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4 text-start shadow-sm">
          <div className="flex items-start gap-3">
            <HelpCircle
              className="mt-0.5 size-5 shrink-0 text-[hsl(var(--color-primary))]"
              aria-hidden="true"
            />
            <div>
              <h4 className="text-xs font-bold text-[hsl(var(--fg-primary))]">{t('whyTitle')}</h4>
              <p className="mt-1 text-xs leading-relaxed text-[hsl(var(--fg-secondary))]">
                {effectiveWhy}
              </p>
            </div>
          </div>

          <div className="mt-4 border-t border-[hsl(var(--border-default))] pt-3">
            <h4 className="text-xs font-bold text-[hsl(var(--fg-primary))]">
              {t('whatToDoTitle')}
            </h4>
            <p className="mt-1 text-xs leading-relaxed text-[hsl(var(--fg-secondary))]">
              {effectiveWhatToDo}
            </p>
          </div>
        </div>

        {showDataSafeNotice ? (
          <div className="mt-4 flex w-full items-center gap-2 rounded-xl border border-[hsl(var(--color-success)/0.2)] bg-[hsl(var(--color-success)/0.06)] px-3.5 py-2 text-start text-xs text-[hsl(var(--color-success))]">
            <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
            <span>{t('dataSafe')}</span>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {onRetry ? (
            <Button type="button" variant="outline" onClick={onRetry}>
              <RotateCcw className="me-2 size-4" aria-hidden="true" />
              {t('retry')}
            </Button>
          ) : null}
          {onHome ? (
            <Button type="button" variant="default" onClick={onHome}>
              {t('backToHome')}
            </Button>
          ) : null}
          {onDismiss ? (
            <Button type="button" variant="ghost" onClick={onDismiss}>
              {t('dismiss')}
            </Button>
          ) : null}
        </div>
      </div>
    )
  }

  // ─── Standard Card Variant (Default) ───────────────────────────────────
  return (
    <Card
      role="alert"
      aria-live="polite"
      data-cloud-required="card"
      className={cn(
        'border-[hsl(var(--color-warning)/0.3)] bg-[hsl(var(--surface-elevated))]',
        className,
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
        <div className="flex items-start gap-3 text-start">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-[hsl(var(--color-warning)/0.3)] bg-[hsl(var(--color-warning)/0.1)] text-[hsl(var(--color-warning))]">
            <CloudOff className="size-5" aria-hidden="true" />
          </span>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-bold">{effectiveTitle}</CardTitle>
              <Badge variant="warning" size="sm">
                {effectiveBadge}
              </Badge>
            </div>
            <CardDescription className="mt-1 text-xs leading-relaxed">
              {effectiveDescription}
            </CardDescription>
          </div>
        </div>

        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t('dismiss')}
            className="rounded-lg p-1 text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-3.5 pt-2 text-start">
        <div className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))] p-3">
          <div className="flex items-start gap-2.5">
            <HelpCircle
              className="mt-0.5 size-4 shrink-0 text-[hsl(var(--color-primary))]"
              aria-hidden="true"
            />
            <div className="space-y-1">
              <h5 className="text-xs font-bold text-[hsl(var(--fg-primary))]">{t('whyTitle')}</h5>
              <p className="text-xs leading-relaxed text-[hsl(var(--fg-secondary))]">
                {effectiveWhy}
              </p>
            </div>
          </div>
          <div className="mt-2.5 border-t border-[hsl(var(--border-default))] pt-2.5">
            <div className="flex items-start gap-2.5">
              <ArrowUpRight
                className="mt-0.5 size-4 shrink-0 text-[hsl(var(--color-primary))]"
                aria-hidden="true"
              />
              <div className="space-y-1">
                <h5 className="text-xs font-bold text-[hsl(var(--fg-primary))]">
                  {t('whatToDoTitle')}
                </h5>
                <p className="text-xs leading-relaxed text-[hsl(var(--fg-secondary))]">
                  {effectiveWhatToDo}
                </p>
              </div>
            </div>
          </div>
        </div>

        {showDataSafeNotice ? (
          <div className="flex items-center gap-2 rounded-xl border border-[hsl(var(--color-success)/0.2)] bg-[hsl(var(--color-success)/0.06)] px-3 py-2 text-xs text-[hsl(var(--color-success))]">
            <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
            <span>{t('dataSafe')}</span>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
          {onRetry ? (
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              <RotateCcw className="me-1.5 size-3.5" aria-hidden="true" />
              {t('retry')}
            </Button>
          ) : null}
          {onHome ? (
            <Button type="button" variant="default" size="sm" onClick={onHome}>
              {t('backToHome')}
            </Button>
          ) : null}
          {onDismiss && !onHome && !onRetry ? (
            <Button type="button" variant="secondary" size="sm" onClick={onDismiss}>
              {t('dismiss')}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
})

CloudRequiredNotice.displayName = 'CloudRequiredNotice'
