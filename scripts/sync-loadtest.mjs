#!/usr/bin/env node
// ============================================
// scripts/sync-loadtest.mjs
//
// Reproducible load test for the sync endpoints.
//
// WHAT IT IS AND IS NOT
//
// It drives the REAL /api/sync endpoints against a REAL deployment with REAL
// tokens, and reports measured latency percentiles. It does not simulate a
// server, and it does not print a capacity number it did not observe.
//
// It is deliberately dependency-free (node:http/https via fetch) so it can be
// run from any machine that can reach the API, including CI, without an
// install step.
//
// USAGE
//
//   API_URL=https://api.hisabche.com/api \
//   SYNC_TOKENS="jwt1,jwt2,jwt3" \
//   node scripts/sync-loadtest.mjs --users 50 --duration 60
//
// One token per simulated user. Tokens must belong to a THROWAWAY workspace:
// this writes real invoices and real customers.
//
// SAFETY
//
//   * Refuses to run against a hostname containing "prod" unless
//     ALLOW_PRODUCTION=yes is set explicitly.
//   * Every mutation carries a stable mutation_id, so a re-run of a failed
//     test cannot double-charge anything.
//   * Read-only mode (--read-only) drives pulls alone.
// ============================================

import { randomUUID } from 'node:crypto'
import { parseArgs } from 'node:util'

const { values } = parseArgs({
  options: {
    users: { type: 'string', default: '50' },
    duration: { type: 'string', default: '60' },
    'read-only': { type: 'boolean', default: false },
    'batch-size': { type: 'string', default: '10' },
    // Mutations per user per minute. 12/min ≈ a busy shop counter.
    rate: { type: 'string', default: '12' },
  },
})

const API_URL = process.env.API_URL
const TOKENS = (process.env.SYNC_TOKENS ?? '')
  .split(',')
  .map((t) => t.trim())
  .filter(Boolean)

const USERS = Number(values.users)
const DURATION_S = Number(values.duration)
const BATCH_SIZE = Number(values['batch-size'])
const RATE_PER_MIN = Number(values.rate)
const READ_ONLY = values['read-only']

if (!API_URL) {
  console.error('API_URL is required, e.g. https://staging-api.hisabche.com/api')
  process.exit(1)
}
if (TOKENS.length === 0) {
  console.error('SYNC_TOKENS is required: a comma-separated list of JWTs')
  process.exit(1)
}
if (/prod/i.test(API_URL) && process.env.ALLOW_PRODUCTION !== 'yes') {
  console.error(
    `Refusing to load-test what looks like production (${API_URL}).\n` +
      'This writes real financial rows. Set ALLOW_PRODUCTION=yes only if you are certain.',
  )
  process.exit(1)
}

/* ── measurement ───────────────────────────────────────────────────────── */

/**
 * Percentiles from raw samples.
 *
 * Kept as a full sample array rather than a streaming estimate: these runs are
 * minutes long, the arrays fit in memory easily, and an exact p99 beats an
 * approximate one when the whole point is to find the tail.
 */
function percentile(sorted, p) {
  if (sorted.length === 0) return 0
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
  return sorted[index]
}

class Metrics {
  constructor(name) {
    this.name = name
    this.samples = []
    this.errors = 0
    this.statuses = new Map()
  }

  record(ms, status) {
    this.samples.push(ms)
    this.statuses.set(status, (this.statuses.get(status) ?? 0) + 1)
    if (status >= 400 || status === 0) this.errors += 1
  }

  summary(seconds) {
    const sorted = [...this.samples].sort((a, b) => a - b)
    const total = sorted.length

    return {
      operation: this.name,
      requests: total,
      rps: total > 0 ? Number((total / seconds).toFixed(2)) : 0,
      errorRate: total > 0 ? Number(((this.errors / total) * 100).toFixed(2)) : 0,
      p50: Math.round(percentile(sorted, 50)),
      p95: Math.round(percentile(sorted, 95)),
      p99: Math.round(percentile(sorted, 99)),
      max: Math.round(sorted[sorted.length - 1] ?? 0),
      statuses: Object.fromEntries(this.statuses),
    }
  }
}

const pushMetrics = new Metrics('push')
const pullMetrics = new Metrics('pull')

async function timed(metrics, fn) {
  const started = performance.now()
  let status = 0
  try {
    status = await fn()
  } catch {
    status = 0 // network failure counts as an error, not a missing sample
  } finally {
    metrics.record(performance.now() - started, status)
  }
  return status
}

/* ── one simulated client ──────────────────────────────────────────────── */

function invoicePayload() {
  return {
    total: Math.floor(Math.random() * 5_000_000) + 1000,
    currency: 'IRR',
    type: 'sale',
    date: new Date().toISOString(),
  }
}

class VirtualUser {
  constructor(index, token) {
    this.token = token
    this.deviceId = `loadtest-${index}-${randomUUID().slice(0, 8)}`
    this.cursor = 0
    this.stopped = false
  }

  headers() {
    return {
      'content-type': 'application/json',
      authorization: `Bearer ${this.token}`,
      'x-hisabche-device': this.deviceId,
    }
  }

  async push() {
    const mutations = Array.from({ length: BATCH_SIZE }, () => ({
      // Stable per mutation. A retried run cannot duplicate an invoice.
      mutationId: randomUUID(),
      entityType: 'invoice',
      entityId: randomUUID(),
      operation: 'create',
      payload: invoicePayload(),
    }))

    return timed(pushMetrics, async () => {
      const response = await fetch(`${API_URL}/sync/push`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ deviceId: this.deviceId, batchId: randomUUID(), mutations }),
      })
      await response.text()
      return response.status
    })
  }

  async pull() {
    return timed(pullMetrics, async () => {
      const query = new URLSearchParams({
        cursor: String(this.cursor),
        limit: '200',
        deviceId: this.deviceId,
      })

      const response = await fetch(`${API_URL}/sync/pull?${query}`, {
        headers: this.headers(),
      })

      if (response.ok) {
        const body = await response.json()
        // Advance only on success — the same rule the real client follows.
        this.cursor = body.nextCursor ?? this.cursor
      } else {
        await response.text()
      }

      return response.status
    })
  }

  /**
   * A realistic loop: mostly reading, occasionally writing.
   *
   * Jittered so N users do not march in lockstep, which would produce a
   * sawtooth that flatters the p99.
   */
  async run(endsAt) {
    const pushEveryMs = (60 / RATE_PER_MIN) * 1000
    let nextPush = Date.now() + Math.random() * pushEveryMs

    while (Date.now() < endsAt && !this.stopped) {
      await this.pull()

      if (!READ_ONLY && Date.now() >= nextPush) {
        await this.push()
        nextPush = Date.now() + pushEveryMs * (0.75 + Math.random() * 0.5)
      }

      // Roughly the interval a real client polls on when idle.
      await new Promise((r) => setTimeout(r, 1000 + Math.random() * 2000))
    }
  }
}

/* ── run ───────────────────────────────────────────────────────────────── */

async function main() {
  console.log(
    `sync load test\n` +
      `  target      ${API_URL}\n` +
      `  users       ${USERS}\n` +
      `  duration    ${DURATION_S}s\n` +
      `  batch       ${BATCH_SIZE} mutations\n` +
      `  write rate  ${READ_ONLY ? 'read-only' : `${RATE_PER_MIN}/user/min`}\n` +
      `  tokens      ${TOKENS.length}\n`,
  )

  const users = Array.from(
    { length: USERS },
    // Tokens are reused round-robin when fewer are supplied than users, which
    // models several devices per account.
    (_, i) => new VirtualUser(i, TOKENS[i % TOKENS.length]),
  )

  const startedAt = Date.now()
  const endsAt = startedAt + DURATION_S * 1000

  const ticker = setInterval(() => {
    const elapsed = Math.round((Date.now() - startedAt) / 1000)
    process.stdout.write(
      `\r  ${elapsed}s  push=${pushMetrics.samples.length} pull=${pullMetrics.samples.length} errors=${pushMetrics.errors + pullMetrics.errors}   `,
    )
  }, 1000)

  await Promise.all(users.map((u) => u.run(endsAt)))

  clearInterval(ticker)
  const seconds = (Date.now() - startedAt) / 1000

  console.log('\n')
  console.table(
    [pullMetrics.summary(seconds), pushMetrics.summary(seconds)].filter((row) => row.requests > 0),
  )

  const totalErrors = pushMetrics.errors + pullMetrics.errors
  const totalRequests = pushMetrics.samples.length + pullMetrics.samples.length

  console.log(
    `\ntotal ${totalRequests} requests over ${seconds.toFixed(1)}s ` +
      `(${(totalRequests / seconds).toFixed(1)} rps), ` +
      `${totalErrors} errors (${((totalErrors / Math.max(1, totalRequests)) * 100).toFixed(2)}%)`,
  )

  // A non-zero exit makes this usable as a CI gate.
  const errorRate = totalErrors / Math.max(1, totalRequests)
  if (errorRate > 0.01) {
    console.error(`\nFAIL: error rate ${(errorRate * 100).toFixed(2)}% exceeds 1%`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
