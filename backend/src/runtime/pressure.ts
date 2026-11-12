import { monitorEventLoopDelay, type IntervalHistogram } from 'node:perf_hooks'

export interface PressureThresholds {
  maxEventLoopDelayMs: number
  maxHeapUsedBytes: number
  maxRssBytes: number
  retryAfterSeconds: number
}

export const DEFAULT_PRESSURE_THRESHOLDS: PressureThresholds = {
  maxEventLoopDelayMs: Number(process.env.MAX_EVENT_LOOP_DELAY_MS ?? 250),
  maxHeapUsedBytes: Number(process.env.MAX_HEAP_USED_BYTES ?? 1_500_000_000),
  maxRssBytes: Number(process.env.MAX_RSS_BYTES ?? 2_000_000_000),
  retryAfterSeconds: Number(process.env.PRESSURE_RETRY_AFTER_SECONDS ?? 5),
}

export interface PressureSnapshot {
  overloaded: boolean
  reason: 'event_loop_lag' | 'heap_used' | 'rss' | null
  eventLoopDelayMs: number
  heapUsedBytes: number
  rssBytes: number
  retryAfterSeconds: number
}

export class PressureMonitor {
  private histogram: IntervalHistogram | null = null
  private forcedDelayMs: number | null = null

  start() {
    if (this.histogram) return
    this.histogram = monitorEventLoopDelay({ resolution: 20 })
    this.histogram.enable()
  }

  stop() {
    if (!this.histogram) return
    this.histogram.disable()
    this.histogram = null
  }

  setForcedDelayForTest(ms: number | null) {
    this.forcedDelayMs = ms
  }

  snapshot(thresholds: PressureThresholds = DEFAULT_PRESSURE_THRESHOLDS): PressureSnapshot {
    const mem = process.memoryUsage()
    const eventLoopDelayMs =
      this.forcedDelayMs !== null
        ? this.forcedDelayMs
        : this.histogram
          ? Math.round(this.histogram.percentile(99) / 1e6)
          : 0

    if (eventLoopDelayMs > thresholds.maxEventLoopDelayMs) {
      return {
        overloaded: true,
        reason: 'event_loop_lag',
        eventLoopDelayMs,
        heapUsedBytes: mem.heapUsed,
        rssBytes: mem.rss,
        retryAfterSeconds: thresholds.retryAfterSeconds,
      }
    }
    if (mem.heapUsed > thresholds.maxHeapUsedBytes) {
      return {
        overloaded: true,
        reason: 'heap_used',
        eventLoopDelayMs,
        heapUsedBytes: mem.heapUsed,
        rssBytes: mem.rss,
        retryAfterSeconds: thresholds.retryAfterSeconds,
      }
    }
    if (mem.rss > thresholds.maxRssBytes) {
      return {
        overloaded: true,
        reason: 'rss',
        eventLoopDelayMs,
        heapUsedBytes: mem.heapUsed,
        rssBytes: mem.rss,
        retryAfterSeconds: thresholds.retryAfterSeconds,
      }
    }
    return {
      overloaded: false,
      reason: null,
      eventLoopDelayMs,
      heapUsedBytes: mem.heapUsed,
      rssBytes: mem.rss,
      retryAfterSeconds: 0,
    }
  }
}

export const pressureMonitor = new PressureMonitor()
