// scripts/audit/reconcile-counts.mjs
// Gate 1: every number in the audit must reconcile. Exits 1 with a printed diff
// when any invariant fails. Read-only: loads generated JSON + the CSV + reports.
//
// Run: node scripts/audit/reconcile-counts.mjs

import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const GEN = path.join(ROOT, 'docs/audit/generated')
const PI = path.join(ROOT, 'docs/product-intelligence')
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))

const failures = []
const check = (name, actual, expected, detail = '') => {
  const ok = actual === expected
  if (!ok) failures.push({ name, actual, expected, detail })
  console.log(
    `${ok ? 'OK  ' : 'FAIL'} ${name}: ${actual}${ok ? '' : ` != ${expected}`}${detail ? ` (${detail})` : ''}`,
  )
}

// ── Load inputs ───────────────────────────────────────────────────────────────
const routesJson = readJson(path.join(GEN, 'routes.json'))
const routeInv = readJson(path.join(GEN, 'route-inventory.json'))
const hookInv = readJson(path.join(GEN, 'hook-inventory.json'))
const summary = readJson(path.join(GEN, 'master-matrix-summary.json'))

const csvText = fs.readFileSync(path.join(PI, 'ROUTE-DOMAIN-HOOK-UI-MASTER-MATRIX.csv'), 'utf8')
const csvLines = csvText.trim().split('\n')

function parseCsvLine(line) {
  const out = []
  let inQ = false
  let cur = ''
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"'
        i++
      } else inQ = !inQ
    } else if (ch === ',' && !inQ) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out
}
const headers = parseCsvLine(csvLines[0])
const csvRows = csvLines.slice(1).map((l) => {
  const values = parseCsvLine(l)
  return Object.fromEntries(headers.map((h, i) => [h, values[i]]))
})

// ── Invariant 1: routes = 816 = Σ route rows ──────────────────────────────────
console.log('\n── routes ────────────────────────────────────────────────')
const routeRows = csvRows.filter((r) => !r.Route_ID.startsWith('HOOK:'))
const hookOnlyRows = csvRows.filter((r) => r.Route_ID.startsWith('HOOK:'))
check('routes.json length', routesJson.length, 816)
check('route-inventory length', routeInv.length, 816)
check('CSV route rows', routeRows.length, routesJson.length)
check('CSV rows = routes + hook-only', csvRows.length, routesJson.length + hookOnlyRows.length)

// ── Invariant 2: hooks = Σ hook classes, no remainder ────────────────────────
console.log('\n── hooks ─────────────────────────────────────────────────')
const hookClasses = summary.hookClassCounts
const hookClassSum = Object.values(hookClasses).reduce((a, b) => a + b, 0)
check('hook-inventory length', hookInv.length, 498)
check('Σ hook classes', hookClassSum, hookInv.length)

const expectedHookClasses = [
  'HOOK_CONNECTED_TO_ROUTE',
  'HOOK_DUPLICATE_NAME',
  'HOOK_UTILITY_WITHOUT_ROUTE',
  'HOOK_NO_ROUTE_UNRESOLVED',
  'HOOK_NO_ROUTE_NO_CONSUMER',
]
for (const cls of expectedHookClasses) {
  if (!(cls in hookClasses) && cls !== 'HOOK_NO_ROUTE_UNRESOLVED') {
    failures.push({ name: `hook class present: ${cls}`, actual: 'absent', expected: 'present' })
    console.log(`FAIL hook class present: ${cls} is absent`)
  }
}
for (const cls of Object.keys(hookClasses)) {
  if (!expectedHookClasses.includes(cls)) {
    failures.push({ name: `unknown hook class: ${cls}`, actual: cls, expected: 'known class' })
  }
}

console.log('\nCorrected hook breakdown:')
for (const cls of expectedHookClasses) {
  console.log(`  ${cls}: ${hookClasses[cls] || 0}`)
}
console.log(
  `  (duplicate names: ${summary.duplicateHookNames.length}) ${summary.duplicateHookNames.join(', ')}`,
)
for (const d of summary.duplicateHookDetails || []) {
  console.log(`    ${d.name}: primary ${d.primary} · duplicate ${d.duplicate} · ${d.exportedAs}`)
}

// 74 re-derivation: 72 HOOK_NO_UI_CONSUMER + 2 HOOK_NO_ROUTE_NO_CONSUMER
const noUiConsumerCount = summary.hookNoUiConsumer.length
const noRouteNoConsumer = hookClasses.HOOK_NO_ROUTE_NO_CONSUMER || 0
check('HOOK_NO_UI_CONSUMER entries', noUiConsumerCount, 72)
check('HOOK_NO_UI_CONSUMER + no-route-no-consumer', noUiConsumerCount + noRouteNoConsumer, 74)

const subClassSum = Object.values(summary.hookNoUiConsumerClasses).reduce((a, b) => a + b, 0)
check('Σ HOOK_NO_UI_CONSUMER sub-classes', subClassSum, noUiConsumerCount)

// ── Invariant 3: Σ status counts = rows ──────────────────────────────────────
console.log('\n── statuses ──────────────────────────────────────────────')
const statusSum = Object.values(summary.statusCounts).reduce((a, b) => a + b, 0)
check('Σ status counts', statusSum, csvRows.length)
const csvStatuses = {}
for (const r of csvRows)
  csvStatuses[r.Connection_Status] = (csvStatuses[r.Connection_Status] || 0) + 1
check(
  'summary statusCounts == CSV statusCounts',
  JSON.stringify(summary.statusCounts),
  JSON.stringify(csvStatuses),
)
check('no VERIFIED_CONNECTED remains', csvStatuses.VERIFIED_CONNECTED || 0, 0)
check('no ROUTE_EXISTS_UI_MISSING remains', csvStatuses.ROUTE_EXISTS_UI_MISSING || 0, 0)
check('no unqualified HOOK_ORPHAN remains', csvStatuses.HOOK_ORPHAN || 0, 0)

// ── Invariant 4: Σ domain counts = rows ─────────────────────────────────────
console.log('\n── domains ───────────────────────────────────────────────')
const domainSum = Object.values(summary.domainCounts).reduce((a, b) => a + b, 0)
check('Σ domain counts', domainSum, csvRows.length)
const csvDomains = new Set(csvRows.map((r) => r.Domain))
check('domain keys == CSV domains', Object.keys(summary.domainCounts).length, csvDomains.size)

// ── Invariant 5: route_class reconciles ─────────────────────────────────────
console.log('\n── route_class ───────────────────────────────────────────')
const classSum = Object.values(summary.routeClassCounts).reduce((a, b) => a + b, 0)
check('Σ route_class (all rows)', classSum, csvRows.length)
const noHookSum = Object.values(summary.routeNoHookClassCounts).reduce((a, b) => a + b, 0)
check('Σ route_class (ROUTE_NO_HOOK)', noHookSum, summary.statusCounts.ROUTE_NO_HOOK)
check(
  'customerFacingNoUi list length',
  summary.customerFacingNoUi.length,
  summary.routeNoHookClassCounts.CUSTOMER_FACING_NO_UI,
)

// ── Invariant 6: report facts == JSON ───────────────────────────────────────
console.log('\n── report facts ──────────────────────────────────────────')
const expectedFacts = {
  totalRows: String(summary.totalRows),
  backendRoutes: String(summary.backendRoutesCount),
  hooks: String(summary.frontendHooksCount),
  staticallyConnected: String(summary.statusCounts.STATICALLY_CONNECTED || 0),
  runtimeVerified: String(summary.statusCounts.RUNTIME_VERIFIED || 0),
  routeNoHook: String(summary.statusCounts.ROUTE_NO_HOOK || 0),
  hookNoUiConsumer: String(summary.statusCounts.HOOK_NO_UI_CONSUMER || 0),
  customerFacingNoUi: String(summary.routeNoHookClassCounts.CUSTOMER_FACING_NO_UI || 0),
  uiViaNonHook: String(summary.routeNoHookClassCounts.UI_VIA_NON_HOOK || 0),
  publicApi: String(summary.routeNoHookClassCounts.PUBLIC_API || 0),
  publicPageApi: String(summary.routeNoHookClassCounts.PUBLIC_PAGE_API || 0),
  infrastructure: String(summary.routeNoHookClassCounts.INFRASTRUCTURE || 0),
  deadHookCandidates: String(summary.hookNoUiConsumerClasses.DEAD_CANDIDATE || 0),
}

const reports = fs
  .readdirSync(PI)
  .filter((f) => f.endsWith('.md') || f.endsWith('.fa.md'))
  .map((f) => ({ file: f, text: fs.readFileSync(path.join(PI, f), 'utf8') }))

let factBlocks = 0
for (const report of reports) {
  for (const m of report.text.matchAll(/<!-- audit-facts ([\s\S]*?)-->/g)) {
    factBlocks++
    const facts = Object.fromEntries(
      m[1]
        .trim()
        .split(/\s+/)
        .map((pair) => {
          const idx = pair.indexOf('=')
          return [pair.slice(0, idx), pair.slice(idx + 1)]
        }),
    )
    for (const key of Object.keys(facts)) {
      if (!(key in expectedFacts)) {
        failures.push({
          name: `unknown fact ${key} in ${report.file}`,
          actual: key,
          expected: 'known fact',
        })
        console.log(`FAIL unknown fact ${key} in ${report.file}`)
        continue
      }
      if (facts[key] !== expectedFacts[key]) {
        failures.push({
          name: `fact ${key} in ${report.file}`,
          actual: facts[key],
          expected: expectedFacts[key],
        })
        console.log(`FAIL fact ${key} in ${report.file}: ${facts[key]} != ${expectedFacts[key]}`)
      }
    }
  }
}
check('reports carrying an audit-facts block', factBlocks > 0 ? 1 : 0, 1, `${factBlocks} blocks`)
console.log(
  '  reports with facts: ' +
    reports
      .filter((r) => r.text.includes('<!-- audit-facts'))
      .map((r) => r.file)
      .join(', '),
)

// ── Result ───────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════')
if (failures.length > 0) {
  console.log(`RECONCILE_FAILED — ${failures.length} invariant(s) failed:`)
  for (const f of failures) {
    console.log(`  - ${f.name}: actual=${f.actual} expected=${f.expected} ${f.detail}`)
  }
  process.exit(1)
}
console.log('RECONCILE_OK — all invariants hold.')
process.exit(0)
