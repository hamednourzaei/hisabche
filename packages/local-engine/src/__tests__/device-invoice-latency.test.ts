// ============================================
// packages/local-engine/src/__tests__/device-invoice-latency.test.ts
//
// V68.8: how long the DEVICE takes to record a sale — measured on the real
// engine (validation, totals, stock, cost, posting, outbox: one transaction),
// not on a stand-in schema.
//
// What this does and does not say:
//   - it is the engine's own time on the machine that runs the suite; the
//     Electron IPC hop and a phone's flash storage are on top of it;
//   - it says NOTHING about the server path. That needs a live backend and is
//     not measured here (docs/architecture/MEASUREMENTS.md §7).
//
// The bound is loose on purpose: it is a tripwire for «the device path became
// something a person waits for», not a benchmark.
// ============================================

import { describe, expect, it } from 'vitest'
import { createTestDb, createTestEngine, TEST_USER_ID } from './test-db'

const QUEUED = { 'x-hisabche-queue': '1', 'x-hisabche-user-id': TEST_USER_ID }

function percentile(sorted: number[], p: number): number {
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[index] ?? Number.NaN
}

describe('device sale latency (real engine)', () => {
  it('records a two-line sale without making anyone wait', async () => {
    const db = createTestDb()
    const engine = createTestEngine(db)

    const sale = (n: number) => ({
      type: 'sale',
      date: '2026-11-16',
      paymentMethod: 'cash',
      items: [
        { productName: `کالای ${n}-الف`, quantity: 2, unitPrice: 50000 },
        { productName: `کالای ${n}-ب`, quantity: 1, unitPrice: 12500 },
      ],
    })

    const WARMUP = 5
    const RUNS = 20
    const times: number[] = []
    for (let n = 0; n < WARMUP + RUNS; n++) {
      const started = performance.now()
      const res = await engine.request({
        method: 'POST',
        path: '/invoices',
        body: sale(n),
        headers: QUEUED,
      })
      const elapsed = performance.now() - started
      expect(res.status).toBe(201)
      if (n >= WARMUP) times.push(elapsed)
    }

    // Every sale really landed, with its outbox row.
    expect(db.all('SELECT id FROM invoice')).toHaveLength(WARMUP + RUNS)
    expect(db.all('SELECT client_id FROM sync_queue')).toHaveLength(WARMUP + RUNS)

    const sorted = [...times].sort((a, b) => a - b)
    const median = percentile(sorted, 50)
    const p95 = percentile(sorted, 95)
    console.info(
      `[V68.8] device sale, ${RUNS} runs: median ${median.toFixed(2)} ms, p95 ${p95.toFixed(2)} ms`,
    )

    expect(median).toBeLessThan(250)
  })
})
