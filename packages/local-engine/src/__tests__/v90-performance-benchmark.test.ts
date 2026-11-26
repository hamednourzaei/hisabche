// ============================================
// packages/local-engine/src/__tests__/v90-performance-benchmark.test.ts
//
// Reproducible local SQLite latency & scaling benchmark (50 / 500 / 2000 rows)
// using process.hrtime.bigint() on real node:sqlite + createLocalEngine().
// ============================================

import { describe, expect, it } from 'vitest'
import { createTestDb, createTestEngine, TEST_WORKSPACE_ID } from './test-db'

function percentileMs(samplesMs: number[], p: number): number {
  if (samplesMs.length === 0) return 0
  const sorted = [...samplesMs].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return Number((sorted[idx] ?? 0).toFixed(3))
}

function nowNs(): bigint {
  return process.hrtime.bigint()
}

function elapsedMs(startNs: bigint): number {
  return Number(nowNs() - startNs) / 1_000_000
}

describe('V90 local SQLite performance benchmark', () => {
  it('measures POST /invoices, GET /invoices, analytics, and draft save at 50 / 500 / 2000 rows', async () => {
    const scales = [50, 500, 2000] as const
    const report: Array<Record<string, unknown>> = []

    for (const totalRows of scales) {
      const db = createTestDb()
      const engine = createTestEngine(db)
      const heapBefore = process.memoryUsage().heapUsed

      const seedStart = nowNs()
      db.exec('BEGIN;')
      for (let i = 0; i < totalRows; i++) {
        const invId = `00000000-0000-4000-8100-${String(i).padStart(12, '0')}`
        const num = `INV-BENCH-${String(i).padStart(5, '0')}`
        db.run(
          `INSERT INTO invoice (
            id, workspace_id, invoice_number, type, date, currency, subtotal,
            discount_total, tax_total, total, paid_amount, status, created_at, updated_at
          ) VALUES (?, ?, ?, 'sale', '2026-11-26', 'AFN', 1000, 0, 0, 1000, 1000, 'pending', datetime('now'), datetime('now'))`,
          [invId, TEST_WORKSPACE_ID, num],
        )
      }
      db.exec('COMMIT;')
      const seedMs = Number(elapsedMs(seedStart).toFixed(3))

      const createLatencies: number[] = []
      const listLatencies: number[] = []
      const draftLatencies: number[] = []
      const runs = 15

      for (let r = 0; r < runs; r++) {
        const cStart = nowNs()
        const cRes = await engine.request({
          method: 'POST',
          path: '/invoices',
          body: {
            type: 'sale',
            currency: 'AFN',
            items: [{ productName: `Benchmark Item ${r}`, quantity: 2, unitPrice: 150 }],
          },
        })
        createLatencies.push(elapsedMs(cStart))
        expect(cRes.status).toBe(201)

        const lStart = nowNs()
        const lRes = await engine.request({
          method: 'GET',
          path: '/invoices?limit=50&page=1',
        })
        listLatencies.push(elapsedMs(lStart))
        expect(lRes.status).toBe(200)

        const dStart = nowNs()
        const dRes = await engine.request({
          method: 'PUT',
          path: '/me/invoice-drafts',
          body: {
            kind: 'sale',
            title: `Bench Draft ${r}`,
            payload: {
              type: 'sale',
              currency: 'AFN',
              items: [{ productName: 'Draft SKU', quantity: 1, unitPrice: 50 }],
            },
          },
        })
        draftLatencies.push(elapsedMs(dStart))
        expect(dRes.status).toBe(200)
      }

      const dashStart = nowNs()
      const dashRes = await engine.request({
        method: 'GET',
        path: '/analytics/dashboard',
      })
      const dashboardMs = Number(elapsedMs(dashStart).toFixed(3))
      expect(dashRes.status).toBe(200)

      const heapAfter = process.memoryUsage().heapUsed
      const row = {
        rows: totalRows,
        seedMs,
        createInvoiceP50Ms: percentileMs(createLatencies, 50),
        createInvoiceP95Ms: percentileMs(createLatencies, 95),
        listInvoicesP50Ms: percentileMs(listLatencies, 50),
        listInvoicesP95Ms: percentileMs(listLatencies, 95),
        draftSaveP95Ms: percentileMs(draftLatencies, 95),
        dashboardMs,
        heapDeltaKb: Math.round((heapAfter - heapBefore) / 1024),
      }
      report.push(row)
      expect(row.createInvoiceP95Ms).toBeLessThan(500)
      expect(row.listInvoicesP95Ms).toBeLessThan(500)
      db.close()
    }

    console.info(
      `[V90_BENCH] ${JSON.stringify({ platform: process.platform, node: process.version, arch: process.arch, results: report })}`,
    )
  }, 30_000)
})
