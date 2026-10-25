// scripts/measure/core-bench.mjs
//
// The measurement behind docs/architecture/MEASUREMENTS.md §1.
//
// It measures the PURE CORE only — how long a rule takes, not how long a sale
// takes. The sale is dominated by network and database, which this does not
// touch, and MEASUREMENTS.md says so rather than implying a speedup.
//
// Timing uses `process.hrtime.bigint()`, not `performance.now()`: on Windows the
// latter's resolution is coarser than the operations being timed, so it reports
// 0 µs for everything below a millisecond.
//
// Run:  node scripts/measure/core-bench.mjs
//      (needs the workspace resolver; see the note at the bottom)

import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = process.cwd()

// Load the core through its TypeScript source. Under plain Node this requires a
// TS-capable loader; under vitest it resolves natively. The script reports which
// path it took so a number can never be quoted without knowing how it was made.
async function loadCore() {
  const entry = join(ROOT, 'packages/validation/src/index.ts')
  try {
    return await import(pathToFileURL(entry).href)
  } catch (error) {
    throw new Error(
      `could not load the core from ${entry}: ${error.message}\n` +
        'Run this through a TypeScript-capable runner (e.g. copy it beside a\n' +
        'vitest test, as MEASUREMENTS.md describes), or with `node --experimental-strip-types`.',
      { cause: error },
    )
  }
}

const core = await loadCore()
const { computeInvoiceMoney, planConsumption, reverseLines, summarize, validateAllocations } = core

const AS = { currency: 'USD', precision: 2, rates: {} }
const columns = [
  {
    id: 'description',
    label: 'd',
    type: 'text',
    system: true,
    visible: true,
    aggregate: false,
    precision: 0,
  },
  {
    id: 'quantity',
    label: 'q',
    type: 'integer',
    system: true,
    visible: true,
    aggregate: true,
    precision: 0,
  },
  {
    id: 'unitPrice',
    label: 'p',
    type: 'currency',
    system: true,
    visible: true,
    aggregate: false,
    precision: 2,
    currency: 'USD',
  },
  {
    id: 'discount',
    label: 'x',
    type: 'percent',
    system: false,
    visible: true,
    aggregate: false,
    precision: 2,
  },
  {
    id: 'tax',
    label: 't',
    type: 'percent',
    system: false,
    visible: true,
    aggregate: false,
    precision: 2,
  },
]
const rows = Array.from({ length: 8 }, (_, i) => ({
  id: `r${i}`,
  values: {
    description: `item ${i}`,
    quantity: '3',
    unitPrice: '1234.56',
    discount: '5',
    tax: '9',
  },
}))
const items = rows.map(() => ({ quantity: 3, unitPrice: 1234.56, discount: 5 }))
const layers = [
  {
    id: 'L1',
    productId: 'p',
    warehouseId: null,
    remainingQty: 10,
    unitCost: 100,
    entryDate: '2026-01-01',
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'L2',
    productId: 'p',
    warehouseId: null,
    remainingQty: 10,
    unitCost: 110,
    entryDate: '2026-01-02',
    createdAt: '2026-01-02T00:00:00Z',
  },
]
const lines = [
  { accountId: 'a', debit: 1000, credit: 0 },
  { accountId: 'b', debit: 0, credit: 1000 },
]
const invoices = [
  {
    invoiceId: 'i1',
    invoiceNumber: '1',
    total: 500,
    allocated: 0,
    dueDate: '2026-01-01',
    invoiceDate: '2026-01-01',
    currency: 'USD',
  },
]

function bench(fn, iterations = 20_000) {
  for (let i = 0; i < 3_000; i++) fn()
  const samples = []
  for (let i = 0; i < iterations; i++) {
    const start = process.hrtime.bigint()
    fn()
    samples.push(Number(process.hrtime.bigint() - start) / 1e6)
  }
  samples.sort((a, b) => a - b)
  const at = (q) => samples[Math.min(samples.length - 1, Math.floor(samples.length * q))]
  const total = samples.reduce((a, b) => a + b, 0)
  return {
    p50us: +(at(0.5) * 1000).toFixed(2),
    p95us: +(at(0.95) * 1000).toFixed(2),
    p99us: +(at(0.99) * 1000).toFixed(2),
    opsPerSec: Math.round(1000 / (total / iterations)),
  }
}

const cases = [
  ['computeInvoiceMoney (8 lines)', () => computeInvoiceMoney({ items, currency: 'USD' })],
  [
    'summarize (grid, 8 rows)',
    () =>
      summarize({ rows, columns, ctx: AS, discountValue: 0, discountType: 'fixed', taxRate: 9 }),
  ],
  ['planConsumption (FIFO, 2 layers)', () => planConsumption(layers, 7)],
  ['reverseLines (2 legs)', () => reverseLines(lines)],
  [
    'validateAllocations',
    () => validateAllocations(500, [{ invoiceId: 'i1', amount: 500 }], invoices),
  ],
]

console.log(`node ${process.version} | ${process.platform} ${process.arch}`)
for (const [name, fn] of cases) {
  const r = bench(fn)
  console.log(`${name} :: p50=${r.p50us}us p95=${r.p95us}us p99=${r.p99us}us ops/s=${r.opsPerSec}`)
}
