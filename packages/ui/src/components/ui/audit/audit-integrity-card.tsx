// ============================================
// packages/ui/src/components/ui/audit/audit-integrity-card.tsx
//
// V53 4.7 / Phase H — the owner's verdict on the audit chain.
//
// WHAT THIS SHOWS, AND WHAT IT DOES NOT
//   The chain is written and verified inside PostgreSQL (docs/audit-hash-01-migration.sql). This card only
//   reports what the database answered. `verified` means «internally consistent» — it does NOT mean
//   «nobody could ever have rewritten it»: someone who rewrote the whole chain AND its exported head would
//   still verify. That limitation is said on the card, not hidden, and the head is offered for export so a
//   copy can live somewhere the database cannot reach.
//
//   `migrationRequired` is its own state: a database without the migration has checked nothing, so it is
//   never rendered as «verified».
// ============================================

'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Database, Loader2, ShieldAlert } from 'lucide-react'

import { copyText } from '../../../lib/copy-text'
import { cn } from '../../../lib/utils'

export interface AuditIntegrityVerdict {
  verified: boolean
  count: number
  legacyUnchained: number
  failedAtSeq?: number | undefined
  reason?: 'HASH_MISMATCH' | 'BROKEN_LINK' | 'MISSING_RECORD' | 'TAIL_REMOVED' | undefined
  migrationRequired?: true | undefined
  head?: { seq: number; hash: string } | null | undefined
}

interface AuditIntegrityCardProps {
  t: (key: string, fallback?: string) => string
  verdict: AuditIntegrityVerdict | undefined
  isLoading: boolean
  error?: string | null
  onRetry?: (() => void) | undefined
}

const REASON_KEY: Record<string, string> = {
  HASH_MISMATCH: 'audit.integrityReasonHash',
  BROKEN_LINK: 'audit.integrityReasonLink',
  MISSING_RECORD: 'audit.integrityReasonMissing',
  TAIL_REMOVED: 'audit.integrityReasonTail',
}

export function AuditIntegrityCard({
  t,
  verdict,
  isLoading,
  error,
  onRetry,
}: AuditIntegrityCardProps) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  const copyHead = async () => {
    if (!verdict?.head) return
    const value = `${verdict.head.seq}:${verdict.head.hash}`
    const done = await copyText(value)
    setCopied(done)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 2000)
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-4 py-3 text-sm text-[hsl(var(--fg-secondary))]">
        <Loader2 className="size-4 animate-spin" />
        {t('audit.integrityChecking', 'در حال بررسی زنجیرهٔ سابقه…')}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-2 rounded-2xl border border-[hsl(var(--color-destructive)/0.3)] bg-[hsl(var(--color-destructive)/0.05)] px-4 py-3 text-sm">
        <div className="flex items-center gap-2 text-[hsl(var(--color-destructive))]">
          <AlertTriangle className="size-4" />
          {t('audit.integrityUnreadable', 'نتیجهٔ بررسی سابقه خوانده نشد.')}
        </div>
        <span className="text-xs text-[hsl(var(--fg-tertiary))]">{error}</span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="self-start text-xs text-[hsl(var(--color-primary))] hover:underline"
          >
            {t('audit.retry', 'تلاش مجدد')}
          </button>
        )}
      </div>
    )
  }

  if (!verdict) return null

  if (verdict.migrationRequired) {
    return (
      <div className="rounded-2xl border border-[hsl(var(--color-warning)/0.35)] bg-[hsl(var(--color-warning)/0.08)] px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--color-warning))]">
          <Database className="size-4" />
          {t('audit.integrityMigrationTitle', 'زنجیرهٔ سابقه در این پایگاه‌داده فعال نشده است')}
        </div>
        <p className="mt-1 text-xs text-[hsl(var(--fg-secondary))]">
          {t(
            'audit.integrityMigrationHint',
            'هیچ ردیفی بررسی نشده است. تا اجرای مهاجرت audit-hash-01، سالم بودن سابقه ادعا نمی‌شود.',
          )}
        </p>
      </div>
    )
  }

  const tone = verdict.verified
    ? 'border-[hsl(var(--color-success)/0.35)] bg-[hsl(var(--color-success)/0.08)]'
    : 'border-[hsl(var(--color-destructive)/0.35)] bg-[hsl(var(--color-destructive)/0.08)]'
  const toneText = verdict.verified
    ? 'text-[hsl(var(--color-success))]'
    : 'text-[hsl(var(--color-destructive))]'
  const Icon = verdict.verified ? CheckCircle2 : ShieldAlert
  const title = verdict.verified
    ? t('audit.integrityVerified', 'زنجیرهٔ سابقه سالم است')
    : t('audit.integrityBroken', 'زنجیرهٔ سابقه آسیب دیده است')

  return (
    <div className={cn('rounded-2xl border px-4 py-3', tone)}>
      <div className={cn('flex items-center gap-2 text-sm font-medium', toneText)}>
        <Icon className="size-4" />
        {title}
      </div>

      <p className="mt-1 text-xs text-[hsl(var(--fg-secondary))]">
        {verdict.verified
          ? t('audit.integrityVerifiedHint', '{count} ردیف زنجیره‌شده بررسی شد.').replace(
              '{count}',
              verdict.count.toLocaleString('en-US'),
            )
          : t('audit.integrityBrokenAt', 'نخستین ردیف ناسازگار: {seq}')
              .replace('{seq}', String(verdict.failedAtSeq ?? '—'))
              .concat(' · ')
              .concat(
                t(
                  REASON_KEY[verdict.reason ?? ''] ?? 'audit.integrityBroken',
                  verdict.reason ?? '—',
                ),
              )}
      </p>

      {verdict.legacyUnchained > 0 && (
        <p className="mt-1 text-xs text-[hsl(var(--fg-tertiary))]">
          {t('audit.integrityLegacy', '{count} ردیف قدیمی (پیش از زنجیره) برشمرده شد.').replace(
            '{count}',
            verdict.legacyUnchained.toLocaleString('en-US'),
          )}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-xs text-[hsl(var(--fg-tertiary))]">
          {t('audit.integrityHead', 'سرِ زنجیره (برای نگهداری بیرون از پایگاه‌داده):')}
        </span>
        <code
          dir="ltr"
          className="max-w-full truncate rounded-lg bg-[hsl(var(--surface-muted))] px-2 py-1 text-[11px] text-[hsl(var(--fg-secondary))]"
        >
          {verdict.head ? `${verdict.head.seq}:${verdict.head.hash}` : '—'}
        </code>
        {verdict.head && (
          <button
            type="button"
            onClick={() => void copyHead()}
            className="rounded-full border border-[hsl(var(--border-default))] px-3 py-1 text-xs text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))]"
          >
            {copied ? t('audit.integrityCopied', 'کپی شد') : t('audit.integrityCopy', 'کپی')}
          </button>
        )}
      </div>

      <p className="mt-2 text-[11px] text-[hsl(var(--fg-tertiary))]">
        {t(
          'audit.integrityLimitation',
          'این بررسی فقط ناسازگاری داخلی را نشان می‌دهد؛ اگر کسی کل زنجیره و سرِ آن را بازنویسی کند، از این‌جا تشخیص داده نمی‌شود.',
        )}
      </p>
    </div>
  )
}
