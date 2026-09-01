'use client'

import React from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { cn } from '../../lib/utils'

/* ═══════════════════════════════════════════════════════════════════════════
   ErrorBoundary v3 — i18n-ready (fixed)
   ═══════════════════════════════════════════════════════════════════════════ */

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  /**
   * Values that, when they change, clear a caught error automatically.
   *
   * Pass the pathname. Without it a boundary that catches on one screen stays
   * broken after the user navigates away — the error is gone, the page they
   * asked for is fine, and they are still looking at a crash report for a
   * screen they left.
   */
  resetKeys?: readonly unknown[]
}

interface State {
  hasError: boolean
  error: Error | null
  /**
   * How many times this boundary has caught WITHOUT recovering in between.
   *
   * The difference between offering "try again" and offering "reload" — see
   * `handleReset`.
   */
  failures: number
  /** Serialised `resetKeys`, so a change can be detected in the render pass. */
  resetSignature: string
}

// ─── Presentational fallback (بدون هیچ hook ای — هرگز نمی‌تواند throw کند) ──
function FallbackUI({
  title,
  description,
  retry,
  reload,
  onReset,
  onReload,
  error,
  exhausted,
}: {
  title: string
  description: string
  retry: string
  reload: string
  onReset: () => void
  onReload: () => void
  error?: Error | null | undefined
  /**
   * True once retrying has already failed.
   *
   * ⚠️ A "try again" button that re-renders the same broken tree with the same
   * props fails the same way, instantly. Offering it twice teaches the user
   * that the button does nothing. After the second failure the honest action
   * is a reload, which throws away the state that is probably the cause.
   */
  exhausted: boolean
}) {
  return (
    <div className="flex min-h-[400px] items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[hsl(var(--color-destructive)/0.1)]">
          <AlertTriangle
            className="size-8 text-[hsl(var(--color-destructive))]"
            aria-hidden="true"
          />
        </div>
        <h2 className="mb-2 text-xl font-bold text-[hsl(var(--fg-primary))]">{title}</h2>
        <p className="mb-4 text-sm text-[hsl(var(--fg-secondary))]">{description}</p>
        {error?.message ? (
          <pre
            className="mb-6 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))] p-3 text-start text-[11px] text-[hsl(var(--fg-secondary))]"
            dir="ltr"
          >
            {error.name}: {error.message}
          </pre>
        ) : null}
        <button
          type="button"
          onClick={exhausted ? onReload : onReset}
          className={cn(
            'inline-flex items-center gap-2 rounded-full px-4 py-2.5',
            'text-sm font-medium',
            'border border-[hsl(var(--border-default))]',
            'text-[hsl(var(--fg-secondary))]',
            'hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]',
            'transition-colors duration-150',
            'motion-reduce:transition-none',
          )}
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          {exhausted ? reload : retry}
        </button>
      </div>
    </div>
  )
}

// متن اضطراری وقتی context ترجمه در دسترس نیست.
const STATIC_TEXT = {
  title: 'مشکلی پیش آمد',
  description: 'در نمایش این بخش خطایی رخ داد. لطفاً دوباره تلاش کنید.',
  retry: 'تلاش دوباره',
  reload: 'بارگذاری دوباره‌ی صفحه',
}

// ✅ FIX: نسخه‌ی ترجمه‌شده useTranslations() صدا می‌زند. اگر این کامپوننت
// بیرون از NextIntlClientProvider رندر شود، useTranslations خودش throw
// می‌کند — و چون این UI خودِ fallback ارور بود، خطا از ErrorBoundary فرار
// می‌کرد و کل سایت سیاه می‌شد. حالا با یک boundary داخلی محافظت شده است.
function TranslatedFallback({
  onReset,
  onReload,
  error,
  exhausted,
}: {
  onReset: () => void
  onReload: () => void
  error?: Error | null | undefined
  exhausted: boolean
}) {
  const t = useTranslations()
  const tr = (key: string, fallback: string) => {
    try {
      const v = t(key as Parameters<typeof t>[0])
      return v && v !== key ? v : fallback
    } catch {
      return fallback
    }
  }
  return (
    <FallbackUI
      title={tr('error.title', STATIC_TEXT.title)}
      description={tr('error.description', STATIC_TEXT.description)}
      retry={tr('action.retry', STATIC_TEXT.retry)}
      reload={tr('action.reload', STATIC_TEXT.reload)}
      onReset={onReset}
      onReload={onReload}
      error={error}
      exhausted={exhausted}
    />
  )
}

// boundary داخلی: اگر ترجمه‌ها در دسترس نبودند، متن ثابت نمایش داده می‌شود
// به‌جای این‌که کل اپلیکیشن از کار بیفتد.
class ErrorFallback extends React.Component<
  {
    onReset: () => void
    onReload: () => void
    error?: Error | null | undefined
    exhausted: boolean
  },
  { intlFailed: boolean }
> {
  constructor(props: {
    onReset: () => void
    onReload: () => void
    error?: Error | null | undefined
    exhausted: boolean
  }) {
    super(props)
    this.state = { intlFailed: false }
  }

  static getDerivedStateFromError() {
    return { intlFailed: true }
  }

  render() {
    if (this.state.intlFailed) {
      return (
        <FallbackUI
          {...STATIC_TEXT}
          onReset={this.props.onReset}
          onReload={this.props.onReload}
          error={this.props.error}
          exhausted={this.props.exhausted}
        />
      )
    }
    return (
      <TranslatedFallback
        onReset={this.props.onReset}
        onReload={this.props.onReload}
        error={this.props.error}
        exhausted={this.props.exhausted}
      />
    )
  }
}

/**
 * A comparable string for `resetKeys`.
 *
 * String rather than a reference comparison so a caller can pass a fresh array
 * literal on every render — `resetKeys={[pathname]}` — without it counting as
 * a change on every render and clearing errors instantly.
 */
function signatureOf(keys: readonly unknown[] | undefined): string {
  if (!keys || keys.length === 0) return ''
  return keys.map((key) => String(key)).join('\u0000')
}

// ─── Class component ───────────────────────────────────────────────────────
class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      failures: 0,
      resetSignature: signatureOf(props.resetKeys),
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // `failures` is incremented in `componentDidCatch`, not here.
    // `getDerivedStateFromError` can be called more than once for a single
    // error during concurrent rendering, and counting there would exhaust the
    // retry on the first failure.
    return { hasError: true, error }
  }

  /**
   * Clear a caught error when the caller's `resetKeys` change.
   *
   * ⚠️ In the RENDER phase, not an effect. A boundary in the error state
   * renders its fallback and never mounts its children, so an effect that
   * waits for a commit would run — but only after the user had already seen a
   * crash report for a screen they navigated away from.
   */
  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    const signature = signatureOf(props.resetKeys)
    if (signature === state.resetSignature) return null

    // A route change is a fresh start: the error is forgotten AND the failure
    // count resets, so the next screen gets its own "try again" rather than
    // inheriting an exhausted one.
    return { hasError: false, error: null, failures: 0, resetSignature: signature }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // ✅ در پروداکشن فقط console.error زنده می‌ماند (removeConsole در
    // next.config همه‌ی console.log ها را حذف می‌کند)، پس عمداً error است.
    console.error(
      '[ErrorBoundary] پیام خطا:',
      error?.message || '(بدون پیام)',
      '\n[ErrorBoundary] نام:',
      error?.name,
      '\n[ErrorBoundary] کامپوننتی که کرش کرد:',
      errorInfo?.componentStack,
      '\n[ErrorBoundary] stack:',
      error?.stack,
    )
    this.props.onError?.(error, errorInfo)

    this.setState((previous) => ({ failures: previous.failures + 1 }))
  }

  handleReset = () => {
    // Clears the error and re-renders the children. If whatever caused the
    // crash is still true, `componentDidCatch` fires again and `failures`
    // reaches 2 — at which point the fallback stops offering this and offers a
    // reload instead.
    this.setState({ hasError: false, error: null })
  }

  handleReload = () => {
    // The escape hatch. Throws away every piece of client state — a stale
    // query cache, a corrupted store, a half-hydrated tree — which is what is
    // usually still true when a retry fails.
    if (typeof window !== 'undefined') window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <ErrorFallback
          onReset={this.handleReset}
          onReload={this.handleReload}
          error={this.state.error}
          exhausted={this.state.failures >= 2}
        />
      )
    }
    return this.props.children
  }
}

export { ErrorBoundary }
