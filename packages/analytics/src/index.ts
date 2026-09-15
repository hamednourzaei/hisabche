import type posthog from 'posthog-js'

let ph: typeof posthog | null = null

export function initPostHog() {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST
  if (typeof window === 'undefined' || !key || !host) return

  const start = () => {
    import('posthog-js').then(({ default: posthog }) => {
      posthog.init(key, {
        api_host: host,
        autocapture: true,
        capture_pageview: true,
        persistence: 'localStorage',
        disable_session_recording: true, // recorder.js لود نمی‌شود
        // surveys.js (33 KiB, 4 h cache) was fetched on every public page — no
        // survey is configured, so it bought nothing.
        disable_surveys: true,
      })
      ph = posthog
    })
  }
  // ⚠️ This runs after the visitor's first interaction, long after `load` has
  // fired — a bare `load` listener would never be called and PostHog would
  // silently never start.
  if (document.readyState === 'complete') start()
  else window.addEventListener('load', start, { once: true })
}

export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  ph?.identify(userId, properties)
}

export function setUser(userId: string, email: string) {
  ph?.identify(userId, { email })
}

export function initSentry() {
  // سنتری اگه داری اینجا
}
