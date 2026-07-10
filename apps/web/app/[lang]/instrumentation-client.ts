import posthog from 'posthog-js'

export function register() {
  if (typeof window !== 'undefined') {
    const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
    const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST
    
    if (apiKey && apiHost) {
      posthog.init(apiKey, {
        api_host: apiHost,
        defaults: '2026-01-30'
      })
    }
  }
}