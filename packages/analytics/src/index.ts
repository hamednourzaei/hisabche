import posthog from "posthog-js"

export function initPostHog() {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST
  
  if (typeof window !== "undefined" && key && host) {
    posthog.init(key, {
      api_host: host,
      autocapture: true,
      capture_pageview: true,
      persistence: "localStorage",
    })
  }
}

export function identifyUser(userId: string, properties?: Record<string, any>) {
  posthog.identify(userId, properties)
}

export function setUser(userId: string, email: string) {
  posthog.identify(userId, { email })
}