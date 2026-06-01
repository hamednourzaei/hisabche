'use client'

import posthog from 'posthog-js'

export const captureEvent = (event: string, properties?: Record<string, unknown>) => {
  if (typeof window !== 'undefined') {
    posthog.capture(event, properties)
  }
}

export const identifyUser = (userId: string, properties?: Record<string, unknown>) => {
  if (typeof window !== 'undefined') {
    posthog.identify(userId, properties)
  }
}