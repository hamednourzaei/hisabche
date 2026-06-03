import type posthog from "posthog-js"

let ph: typeof posthog | null = null

export function initPostHog() {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST
  if (typeof window === "undefined" || !key || !host) return

  window.addEventListener("load", () => {
    import("posthog-js").then(({ default: posthog }) => {
      posthog.init(key, {
        api_host: host,
        autocapture: true,
        capture_pageview: true,
        persistence: "localStorage",
        disable_session_recording: true, // surveys.js و recorder.js لود نمیشن
      })
      ph = posthog
    })
  }, { once: true })
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