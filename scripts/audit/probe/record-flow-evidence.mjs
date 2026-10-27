// scripts/audit/probe/record-flow-evidence.mjs
// Gate 3: run the tests that touch the five critical flows, record the real
// output, and write docs/audit/generated/flow-evidence.json.
//
// Only a route whose handler actually executed in this session (HTTP_INJECT via
// buildServer + app.inject, or a unit test of the service) can appear in
// `routes`. A 401-only probe proves wiring and guard order, never the money
// effect, so it is recorded under `wiring` and never promotes a route to
// RUNTIME_VERIFIED.
//
// Run: node scripts/audit/probe/record-flow-evidence.mjs

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(process.cwd())
const GEN = path.join(ROOT, 'docs/audit/generated')
fs.mkdirSync(GEN, { recursive: true })
const BACKEND = path.join(ROOT, 'backend')
const DESKTOP = path.join(ROOT, 'apps/desktop')

function run(command, cwd = BACKEND, label = 'backend') {
  const started = Date.now()
  // spawnSync, not execSync: Jest writes its summary to stderr, and execSync only
  // returns stdout on a zero exit — which would record a PASS with an empty line.
  const res = spawnSync(command, {
    cwd,
    encoding: 'utf8',
    shell: true,
    maxBuffer: 64 * 1024 * 1024,
  })
  const output = `${res.stdout || ''}\n${res.stderr || ''}`
  const exit = typeof res.status === 'number' ? res.status : 1
  const tail = output
    .split('\n')
    .filter((l) => /Test Files|Tests:|Tests |FAIL |PASS |AssertionError/.test(l))
    .slice(-12)
    .join('\n')
  return { command, cwd: label, exit, durationMs: Date.now() - started, summary: tail }
}

const FLOW_TESTS = [
  'src/__tests__/reverse-sales-return.test.ts',
  'src/__tests__/auto-bank-match.test.ts',
  'src/__tests__/bank-categorization.test.ts',
  'src/__tests__/bank-review-assist.test.ts',
  'src/__tests__/bank-category-suggestions.test.ts',
  'src/__tests__/http-e2e-business-day.test.ts',
  'src/__tests__/http-integration-finance.test.ts',
  'src/__tests__/conflict-auto-merge.test.ts',
  'src/__tests__/offline-conflict-rules.test.ts',
  'src/__tests__/offline-pos-conflict.test.ts',
  'src/__tests__/sync-invariants.test.ts',
  'src/__tests__/tax-calculation-consistency.test.ts',
  'src/__tests__/tax-engine-rules.test.ts',
  'src/__tests__/financial-flows-e2e.test.ts',
]

const flowRun = run(`npx vitest run --project unit ${FLOW_TESTS.join(' ')}`)
const probeRun = run('npx vitest run --config ../scripts/audit/probe/vitest.probe.config.mts')
// The client sync scenarios are Jest suites that live under packages/app-shell and
// are run by apps/desktop's Jest config (roots include that package). Running them
// under vitest fails on the `@/` alias, so this is the only runner that can execute
// them — and until this run, nobody had.
const clientRun = run('npx jest sync-scenarios', DESKTOP, 'apps/desktop')

// A route is RUNTIME_VERIFIED only when the named test passed AND that file
// contains the route path it claims to exercise.
const RUNTIME_ROUTES = [
  {
    route: 'POST /api/pos/sessions/:id/close',
    flow: 'till-close',
    test: 'src/__tests__/http-e2e-business-day.test.ts',
    contains: '/close',
    level: 'HTTP_INJECT',
  },
  {
    route: 'GET /api/conflicts/',
    flow: 'sync-conflict',
    test: 'src/__tests__/http-integration-finance.test.ts',
    contains: "'/api/conflicts?status=open'",
    level: 'HTTP_INJECT',
  },
  {
    route: 'POST /api/conflicts/:id/resolve',
    flow: 'sync-conflict',
    test: 'src/__tests__/http-integration-finance.test.ts',
    contains: '/resolve',
    level: 'HTTP_INJECT',
  },
]

const flowPassed = flowRun.exit === 0
const probePassed = probeRun.exit === 0
const routes = {}

for (const r of RUNTIME_ROUTES) {
  const testPath = path.join(BACKEND, r.test)
  const text = fs.existsSync(testPath) ? fs.readFileSync(testPath, 'utf8') : ''
  if (!flowPassed || !text.includes(r.contains)) {
    console.log(`NOT RECORDED ${r.route}: ${flowPassed ? 'marker missing' : 'flow tests failed'}`)
    continue
  }
  routes[r.route] = { level: r.level, passed: true, flow: r.flow, source: `backend/${r.test}` }
}

const evidence = {
  generatedBy: 'scripts/audit/probe/record-flow-evidence.mjs',
  generatedAt: new Date().toISOString(),
  flows: {
    'invoice-return': {
      tests: [
        'src/__tests__/reverse-sales-return.test.ts',
        'src/__tests__/invoice-return-01.pg.test.ts',
      ],
      ran: ['src/__tests__/reverse-sales-return.test.ts'],
      level: 'STATIC + UNIT',
      pgWrittenNotRun: ['backend/src/__tests__/invoice-return-01.pg.test.ts'],
    },
    'bank-reconciliation': {
      tests: [
        'src/__tests__/auto-bank-match.test.ts',
        'src/__tests__/bank-categorization.test.ts',
        'src/__tests__/bank-review-assist.test.ts',
        'src/__tests__/bank-category-suggestions.test.ts',
      ],
      ran: [
        'src/__tests__/auto-bank-match.test.ts',
        'src/__tests__/bank-categorization.test.ts',
        'src/__tests__/bank-review-assist.test.ts',
        'src/__tests__/bank-category-suggestions.test.ts',
      ],
      level: 'UNIT',
      pgWrittenNotRun: [],
    },
    'till-close': {
      tests: [
        'src/__tests__/http-e2e-business-day.test.ts',
        'src/__tests__/http-integration-finance.test.ts',
        'src/__tests__/pos-till-currency-http.test.ts',
        'src/__tests__/pos-till-currency.pg.test.ts',
      ],
      ran: [
        'src/__tests__/http-e2e-business-day.test.ts',
        'src/__tests__/http-integration-finance.test.ts',
      ],
      level: 'HTTP_INJECT',
      pgWrittenNotRun: ['backend/src/__tests__/pos-till-currency.pg.test.ts'],
    },
    'sync-conflict': {
      tests: [
        'src/__tests__/http-integration-finance.test.ts',
        'src/__tests__/conflict-auto-merge.test.ts',
        'src/__tests__/sync-invariants.test.ts',
        'src/__tests__/offline-pos-conflict.test.ts',
        'src/__tests__/offline-conflict-rules.test.ts',
        'packages/app-shell/src/features/sync/__tests__/sync-scenarios.test.ts',
        'src/__tests__/sync-scenarios.pg.test.ts',
      ],
      ran: [
        'src/__tests__/http-integration-finance.test.ts',
        'src/__tests__/conflict-auto-merge.test.ts',
        'src/__tests__/sync-invariants.test.ts',
        'src/__tests__/offline-pos-conflict.test.ts',
        'src/__tests__/offline-conflict-rules.test.ts',
        'packages/app-shell/src/features/sync/__tests__/sync-scenarios.test.ts',
      ],
      level: 'HTTP_INJECT + CLIENT_FAKE_TRANSPORT',
      pgWrittenNotRun: ['backend/src/__tests__/sync-scenarios.pg.test.ts'],
    },
    'tax-return': {
      tests: [
        'src/__tests__/tax-calculation-consistency.test.ts',
        'src/__tests__/tax-engine-rules.test.ts',
      ],
      ran: [
        'src/__tests__/tax-calculation-consistency.test.ts',
        'src/__tests__/tax-engine-rules.test.ts',
      ],
      level: 'UNIT',
      pgWrittenNotRun: [],
    },
  },
  commands: [flowRun, probeRun, clientRun],
  clientScenarios: {
    passed: clientRun.exit === 0,
    runner: 'apps/desktop Jest (roots include packages/app-shell/src)',
    source: 'packages/app-shell/src/features/sync/__tests__/sync-scenarios.test.ts',
    covered: [
      'D — network cut mid-push',
      'E — batch retry safety',
      'F — delete refusal (N-30)',
      'H — rehydrate past horizon',
    ],
    notCoveredByThisSuite: [
      'A — oversell on the last stock unit',
      'B — multi-device convergence',
      'C — invoice aggregate conflict',
      'G — commit-horizon cursor',
    ],
    summary: clientRun.summary,
  },
  wiring: {
    level: 'HTTP_INJECT',
    passed: probePassed,
    source: 'scripts/audit/probe/flow-routes.probe.test.ts',
    routes: [
      'POST /api/invoices/:id/returns',
      'POST /api/finance/bank/reconcile',
      'POST /api/pos/sessions/:id/close',
      'POST /api/conflicts/:id/resolve',
      'GET /api/tax/return',
    ],
  },
  routes,
  pgCommand:
    'cd backend && npx vitest run --project pg   # Linux/macOS; Windows embedded-postgres fails with error code 1314',
}

fs.writeFileSync(path.join(GEN, 'flow-evidence.json'), JSON.stringify(evidence, null, 2))

console.log(
  'flow tests :',
  flowRun.exit === 0 ? 'PASS' : 'FAIL',
  '|',
  flowRun.summary.replace(/\n/g, ' | '),
)
console.log(
  'probe      :',
  probeRun.exit === 0 ? 'PASS' : 'FAIL',
  '|',
  probeRun.summary.replace(/\n/g, ' | '),
)
console.log(
  'client sync:',
  clientRun.exit === 0 ? 'PASS' : 'FAIL',
  '|',
  clientRun.summary.replace(/\n/g, ' | '),
)
console.log('runtime routes:', Object.keys(routes).join(', ') || 'none')
console.log('written: docs/audit/generated/flow-evidence.json')
if (!probePassed) process.exit(1)
