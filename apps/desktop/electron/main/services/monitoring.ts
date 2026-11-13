// ============================================
// Crash and error reporting.
// Silently disabled when no DSN is configured, so local runs stay offline.
// ============================================

const DSN = process.env.SENTRY_DSN ?? ''

export function initCrashReporting(): void {
  if (!DSN) return

  try {
    // Required lazily so a missing/optional dependency cannot break startup.
    const Sentry = require('@sentry/electron/main') as typeof import('@sentry/electron/main')

    Sentry.init({
      dsn: DSN,
      ...(process.env.npm_package_version ? { release: process.env.npm_package_version } : {}),
      tracesSampleRate: 0.1,
    })
  } catch (error) {
    console.error('[monitoring] init failed:', error)
  }
}

/** Report a handled failure (IPC rejection, sync error) without crashing. */
export function reportError(error: unknown, context: Record<string, unknown> = {}): void {
  console.error('[error]', error, context)
  if (!DSN) return

  try {
    const Sentry = require('@sentry/electron/main') as typeof import('@sentry/electron/main')
    Sentry.captureException(error, { extra: context })
  } catch {
    // Reporting must never mask the original failure.
  }
}
