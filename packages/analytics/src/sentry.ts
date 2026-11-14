import * as Sentry from '@sentry/nextjs'

export function initSentry() {
  if (typeof window === 'undefined') return
}

export function setUser(id: string, email?: string) {
  const user: { id: string; email?: string } = { id }
  if (email) user.email = email
  Sentry.setUser(user)
}

export function clearUser() {
  Sentry.setUser(null)
}

export function captureError(error: Error, context?: Record<string, unknown>) {
  Sentry.withScope((scope) => {
    if (context) scope.setExtras(context)
    Sentry.captureException(error)
  })
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
  Sentry.captureMessage(message, level)
}

export { Sentry }
