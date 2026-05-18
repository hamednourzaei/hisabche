import posthog from 'posthog-js'

let initialized = false

export function initPostHog() {
  if (typeof window === 'undefined' || initialized) return

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) return

  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
    capture_pageview: true,
    capture_pageleave: true,
    loaded: (ph) => {
      if (process.env.NODE_ENV === 'development') ph.debug(false)
    },
  })

  initialized = true
}

export function trackEvent(name: string, properties?: Record<string, any>) {
  if (typeof window === 'undefined') return
  posthog.capture(name, properties)
}

export function identifyUser(id: string, traits?: Record<string, any>) {
  if (typeof window === 'undefined') return
  posthog.identify(id, traits)
}

export function trackPageView(pageName: string) {
  trackEvent('$pageview', { page: pageName })
}

// ─── Business Events ───

export function trackOnboardingStep(step: number, stepName: string) {
  trackEvent('onboarding_step_completed', { step, step_name: stepName })
}

export function trackOnboardingCompleted(businessType: string | null, storeSize: string | null) {
  trackEvent('onboarding_completed', { business_type: businessType, store_size: storeSize })
}

export function trackFirstInvoiceCreated(durationSeconds: number) {
  trackEvent('first_invoice_created', { duration_seconds: durationSeconds })
}

export function trackInvoiceCreated(type: string, total: number, currency: string) {
  trackEvent('invoice_created', { type, total, currency })
}

export function trackBackupCreated(type: 'auto' | 'manual') {
  trackEvent('backup_created', { backup_type: type })
}

export function trackSyncCompleted(pendingCount: number) {
  trackEvent('sync_completed', { pending_count: pendingCount })
}

export function trackSyncFailed(reason: string) {
  trackEvent('sync_failed', { reason })
}

export function trackError(errorType: string, message: string) {
  trackEvent('error_occurred', { error_type: errorType, message })
}

export function trackFeatureUsed(feature: string, action: string) {
  trackEvent('feature_used', { feature, action })
}

export function trackOfflineAction(action: string) {
  trackEvent('offline_action', { action })
}

export function trackLogin(method: string) {
  trackEvent('user_logged_in', { method })
}

export function trackLogout() {
  trackEvent('user_logged_out', {})
}

export { posthog }