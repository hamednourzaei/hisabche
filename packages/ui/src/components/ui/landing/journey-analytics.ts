// packages/ui/src/components/ui/landing/journey-analytics.ts
//
// Analytics and Telemetry Emitter for the Hisabche 3D Journey.
// Conforms strictly to docs/landing-v2-spec.md Section 9.

import type { JourneyAnalyticsEventName, JourneyAnalyticsPayloads } from './journey.config'

type GtagFn = (command: string, action: string, params?: Record<string, unknown>) => void

export interface EmittedJourneyEvent<
  T extends JourneyAnalyticsEventName = JourneyAnalyticsEventName,
> {
  name: T
  payload: JourneyAnalyticsPayloads[T]
  timestamp: number
}

const eventHistory: EmittedJourneyEvent[] = []

export function emitJourneyEvent<T extends JourneyAnalyticsEventName>(
  name: T,
  payload: JourneyAnalyticsPayloads[T],
): void {
  const event: EmittedJourneyEvent<T> = {
    name,
    payload,
    timestamp: Date.now(),
  }

  eventHistory.push(event)

  if (typeof window === 'undefined') return

  const win = window as unknown as { gtag?: GtagFn; dataLayer?: unknown[] }

  // 1. Send to gtag if configured
  if (typeof win.gtag === 'function') {
    win.gtag('event', name, payload as Record<string, unknown>)
  }

  // 2. Push to dataLayer if available
  if (Array.isArray(win.dataLayer)) {
    win.dataLayer.push({
      event: name,
      ...payload,
    })
  }

  // 3. Dispatch DOM CustomEvent for integrations, A/B harnesses, and testing
  try {
    const domEvent = new CustomEvent('hisabche:journey', {
      detail: event,
      bubbles: true,
    })
    window.dispatchEvent(domEvent)
  } catch {
    // Gracefully handle older browser environments
  }
}

export function getJourneyAnalyticsHistory(): readonly EmittedJourneyEvent[] {
  return eventHistory
}

export function clearJourneyAnalyticsHistory(): void {
  eventHistory.length = 0
}
