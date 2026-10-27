// scripts/industry/ranking-model.mjs
//
// A REPRODUCIBLE version of the market-ranking exercise. Everything the ranking
// depends on is data in this file: the weights, the 29 rivals' scores, Hisabche's
// scores, and the 50 options with the gain each one is assumed to give.
//
// ⚠️ WHAT THIS IS NOT
// The rivals' scores are the author's judgement from public product knowledge,
// not a benchmark; the Iranian, Indian and some mid-market rows are low
// confidence. The output is a PRIORITISATION MODEL ("which options move the
// score most per unit of effort under this rubric"), not a market fact.
// Sensitivity to the weights is measured below instead of assumed.
//
// Run: node scripts/industry/ranking-model.mjs   → writes
//      docs/architecture/universal-core/RANKING-MODEL.md

import fs from 'node:fs'

const DIMS = [
  ['A', 'Accounting depth', 0.2],
  ['I', 'Inventory and trade', 0.15],
  ['F', 'Industry fit', 0.1],
  ['L', 'Multi-currency and localisation', 0.1],
  ['O', 'Offline and resilience', 0.1],
  ['R', 'Reporting', 0.1],
  ['E', 'Ecosystem and integrations', 0.1],
  ['C', 'Compliance, trust and maturity', 0.15],
]
const W = DIMS.map((d) => d[2])
const KEYS = DIMS.map((d) => d[0])
const wsum = W.reduce((a, b) => a + b, 0)
if (Math.abs(wsum - 1) > 1e-9) throw new Error('weights must sum to 1, got ' + wsum)

// order: A I F L O R E C
const RIVALS = {
  'SAP S/4HANA Cloud': [10, 9, 9, 9, 2, 10, 9, 10],
  'Oracle Fusion Cloud ERP': [10, 8, 8, 10, 1, 10, 8, 10],
  'Oracle NetSuite': [9, 9, 9, 9, 1, 9, 9, 9],
  'Dynamics 365 Business Central': [9, 8, 8, 9, 2, 9, 9, 9],
  'Infor CloudSuite': [9, 9, 9, 8, 1, 8, 7, 9],
  'Epicor Kinetic': [8, 9, 8, 8, 2, 8, 7, 8],
  Odoo: [7, 9, 9, 8, 3, 7, 9, 7],
  'Sage Intacct': [9, 6, 7, 8, 1, 9, 8, 9],
  Acumatica: [8, 8, 8, 8, 2, 8, 7, 8],
  'Workday Financials': [9, 3, 5, 9, 1, 9, 8, 10],
  ERPNext: [7, 8, 8, 7, 4, 6, 6, 6],
  'Exact Online': [8, 6, 6, 8, 1, 7, 7, 8],
  'Tally Prime': [7, 6, 6, 6, 9, 6, 5, 7],
  'Sepidar (IR)': [8, 7, 6, 7, 7, 6, 4, 6],
  'Rahkaran (IR)': [8, 7, 7, 7, 3, 7, 4, 7],
  'QuickBooks Online': [7, 5, 5, 7, 1, 7, 10, 9],
  'Sage 50': [7, 6, 5, 6, 6, 6, 6, 8],
  'Zoho Books': [7, 5, 5, 8, 2, 7, 8, 8],
  Xero: [7, 4, 4, 8, 1, 7, 10, 9],
  'Holoo (IR)': [7, 7, 6, 7, 8, 5, 3, 5],
  'Fishbowl Inventory': [6, 9, 6, 4, 3, 6, 6, 6],
  'Busy (IN)': [7, 7, 6, 3, 8, 5, 3, 6],
  DATEV: [8, 4, 4, 3, 1, 7, 6, 10],
  MYOB: [7, 5, 5, 5, 1, 6, 6, 8],
  Pennylane: [7, 3, 3, 3, 1, 7, 7, 7],
  'Hesabfa (IR)': [6, 5, 4, 7, 2, 5, 4, 5],
  FreeAgent: [6, 2, 3, 6, 1, 6, 6, 7],
  FreshBooks: [4, 2, 3, 6, 1, 4, 6, 7],
  Wave: [4, 1, 2, 5, 1, 4, 4, 6],
}
// Re-scored after the second audit: depth 6->7.5 (period lock, month-end, year-end close, tax engine, cash flow, FX revaluation, dimensions, approvals, learned reconciliation all exist), reports 6->6.5 (ageing, working capital), ecosystem 4->4.5 (swagger /docs, OAuth apps, webhook replay), compliance 3->3.5 (audit UI, admin step-up TOTP). Still assumes every in-flight request ships.
const HISABCHE_NOW = [7.5, 7.5, 7, 9, 9, 6.5, 4.5, 3.5]

// effort: S=1 M=2 L=4 XL=8 (relative units, not weeks). org = organisational, not code.
const EFF = { S: 1, M: 2, L: 4, XL: 8 }
const CAP = { A: 9, I: 9.5, F: 9.5, L: 10, O: 9.8, R: 8.5, E: 8.5, C: 7.5 }

// [id, dim, gain, effort, org, option, repository state (checked 2026-10-26), external evidence]
const OPTIONS = [
  [
    1,
    'A',
    0.5,
    'M',
    0,
    'Fiscal-period close with soft and hard lock dates',
    'No period-lock or closing-entry code found by search',
    'Odoo year-end: lock-everything date plus irreversible hard lock (opened)',
  ],
  [
    2,
    'A',
    0.5,
    'XL',
    0,
    'Multi-entity consolidation with intercompany eliminations',
    'Only branch-consolidated statements (accounting.service); no intercompany',
    'No source opened',
  ],
  [
    3,
    'A',
    0.5,
    'L',
    0,
    'Tax-code engine: per-line codes, tax groups, withholding, returns that work offline',
    'Invoice-level taxRate only; GET /tax/return is online_required',
    'Odoo fiscal localizations list ~100 countries with taxes and reports (opened)',
  ],
  [
    4,
    'A',
    0.3,
    'M',
    0,
    'Deferred revenue and prepaid schedules',
    'Nothing found by search',
    'No source opened',
  ],
  [
    5,
    'A',
    0.4,
    'L',
    0,
    'Three-way match: purchase order ↔ receipt ↔ vendor bill',
    'Purchase orders exist; no match rule found',
    'No source opened',
  ],
  [
    6,
    'A',
    0.2,
    'S',
    0,
    'Recurring journal entries and allocations',
    'Recurring invoices exist; recurring journals not found',
    'No source opened',
  ],
  [7, 'A', 0.3, 'M', 0, 'Statement of cash flows', 'Not found by search', 'No source opened'],
  [
    8,
    'A',
    0.2,
    'M',
    0,
    'Rolling budget forecast, not only budget-vs-actual',
    'Budgets and variance exist (operations.routes)',
    'Odoo analytic accounting mentions budgets on analytic accounts (opened)',
  ],
  [
    9,
    'A',
    0.3,
    'M',
    0,
    'Employee expense claims with receipt capture',
    'Not searched in this round',
    'No source opened',
  ],
  [
    10,
    'A',
    0.2,
    'M',
    0,
    'Learned bank-reconciliation rules',
    'Match suggestions exist (auto-bank-match); no learned rules',
    'Odoo bank synchronisation page (opened) covers feeds, not rules',
  ],
  [
    11,
    'I',
    0.6,
    'XL',
    0,
    'Product variants (size, colour, finish, capacity)',
    'No variant entity in schema, service or UI',
    'ERPNext item variants (opened); Cybrosys footwear/apparel variants per store (opened)',
  ],
  [
    12,
    'I',
    0.5,
    'L',
    0,
    'Serial and batch bound to the invoice line, FEFO by default',
    'Traceability exists but is online-only and invoice.service never calls it',
    'Odoo lots (opened); Cleverence serial tracking (opened)',
  ],
  [
    13,
    'I',
    0.3,
    'M',
    0,
    'Landed-cost allocation over received goods',
    'Only a repost domain; no landed-cost allocation found',
    'Odoo landed-cost page returned 404 — not opened',
  ],
  [14, 'I', 0.2, 'M', 0, 'Kits and bundles', 'Not found by search', 'No source opened'],
  [
    15,
    'I',
    0.2,
    'M',
    0,
    'Pack-level barcodes tied to units (case = 24 pieces)',
    'Multi-barcode per product; case not bound to a unit',
    'barcode.graphics GTIN levels (opened, thin)',
  ],
  [
    16,
    'I',
    0.3,
    'L',
    0,
    'Delivery notes, partial deliveries, pick/pack/ship',
    'delivery_note exists only as an AI document class',
    'Kolonell builders-merchant needs (opened)',
  ],
  [
    17,
    'I',
    0.2,
    'S',
    0,
    'Reorder rules that draft a purchase order',
    'reorder.domain gives suggestions only',
    'No source opened',
  ],
  [
    18,
    'I',
    0.3,
    'L',
    0,
    'Warranty registration and RMA',
    'No warranty entity',
    'BUSY computer hardware (opened); Cleverence (opened)',
  ],
  [
    19,
    'F',
    0.4,
    'L',
    0,
    'Area / dimension pricing (width × length × price per m²)',
    'No area dimension in units',
    'Service Buddy flooring guide (opened)',
  ],
  [
    20,
    'F',
    0.4,
    'L',
    0,
    'Roll stock with partial sales and per-batch unit factor',
    'Batches hold remainingQty but invoices do not consume them',
    'Frappe forum threads on variable-length rolls and dual UOM (opened)',
  ],
  [
    21,
    'F',
    0.4,
    'L',
    0,
    'Gold purity rate table, making charges, old-gold trade-in',
    'gold_purity and making_charges are planned with no code',
    'ECOSIRE jewellery page (opened, vendor)',
  ],
  [
    22,
    'F',
    0.4,
    'XL',
    0,
    'Freight trips: vehicle, driver, load, freight charge, driver settlement',
    'No trip entity',
    'TruckLogics via SoftwareConnect (opened, vendor)',
  ],
  [
    23,
    'F',
    0.3,
    'XL',
    0,
    'Passenger ticketing: seat layout, routes, fares, passenger list',
    'No seat or ticket entity',
    'Odoo Apps bus booking listing (opened, vendor)',
  ],
  [
    24,
    'F',
    0.3,
    'XL',
    0,
    'Courier dispatch, proof of delivery, COD reconciliation',
    'No dispatch or COD lifecycle',
    'Shipox COD (opened); Planfix (opened)',
  ],
  [
    25,
    'F',
    0.3,
    'L',
    0,
    'OEM cross-reference, vehicle fitment, core charge',
    'No alternate-identifier or fitment table',
    'ECOSIRE auto-parts blog (opened, vendor)',
  ],
  [
    26,
    'F',
    0.2,
    'M',
    0,
    'Appointments and resource booking',
    'No appointment entity',
    'No source opened',
  ],
  [
    27,
    'F',
    0.2,
    'L',
    0,
    'Land, crops and livestock groups',
    'No agriculture entity',
    'ERPNext agriculture docs (opened); Frappe livestock thread (opened)',
  ],
  [
    28,
    'L',
    0.5,
    'XL',
    0,
    'Iran Moodian e-invoice connection',
    'No integration found (only a blog keyword)',
    'Sepidar explanation of Moodian duties (opened, vendor)',
  ],
  [
    29,
    'L',
    0.3,
    'L',
    0,
    'Afghanistan tax-return export aligned with the Revenue Department e-filing',
    'No integration found',
    'World Bank feature on ARD e-filing (opened)',
  ],
  [
    30,
    'L',
    0.2,
    'L',
    0,
    'Local payment-provider adapters',
    'Connector framework has definitions and zero adapters',
    'No source opened',
  ],
  [
    31,
    'O',
    0.2,
    'M',
    0,
    'Conflict-resolution screen and sync diagnostics',
    'SYNC_RUNBOOK and divergence alarm exist; no user-facing resolver',
    'No source opened',
  ],
  [
    32,
    'O',
    0.3,
    'L',
    0,
    'Automated Electron end-to-end offline suite',
    'No live offline run recorded this round',
    'No source opened',
  ],
  [
    33,
    'O',
    0.2,
    'M',
    0,
    'Encrypted local database and a tested restore drill',
    'No local encryption found by search',
    'No source opened',
  ],
  [
    34,
    'R',
    0.3,
    'M',
    0,
    'Scheduled report delivery by email',
    'Not found by search',
    'No source opened',
  ],
  [
    35,
    'R',
    0.4,
    'M',
    0,
    'KPI drill-through down to ledger lines',
    'Not verified in this round',
    'No source opened',
  ],
  [
    36,
    'R',
    0.4,
    'M',
    0,
    'Management pack: ageing, ratios, variance, PDF',
    'Partly present',
    'No source opened',
  ],
  [
    37,
    'R',
    0.4,
    'L',
    0,
    'BI connector (OData / Google Sheets)',
    'Not found by search',
    'No source opened',
  ],
  [38, 'R', 0.2, 'S', 0, 'Export parity with audit footer', 'Exports exist', 'No source opened'],
  [
    39,
    'E',
    0.4,
    'M',
    0,
    'Publish a versioned OpenAPI spec, SDKs and a docs site',
    '@fastify/swagger is registered in backend/src/index.ts; no published spec/SDK',
    'Odoo external API docs: XML-RPC with API keys (opened)',
  ],
  [
    40,
    'E',
    0.8,
    'XL',
    0,
    'Three real connectors (bank, payment, shipping)',
    '15 connector definitions, zero adapters (CLAUDE.md)',
    'Odoo bank sync via third-party providers (opened)',
  ],
  [41, 'E', 0.4, 'L', 0, 'Zapier / Make connector', 'Not found', 'No source opened'],
  [
    42,
    'E',
    0.3,
    'M',
    0,
    'Webhook delivery console with replay',
    'Webhooks exist; no replay console found',
    'No source opened',
  ],
  [
    43,
    'E',
    0.8,
    'XL',
    0,
    'Accountant portal: one login, many client businesses',
    'Not found by search',
    'Xero partner programme pages (search result only, not opened)',
  ],
  [
    44,
    'E',
    0.5,
    'L',
    0,
    'Migration kits from Tally, Holoo, Sepidar, QuickBooks',
    'Generic CSV/xlsx migration exists',
    'No source opened',
  ],
  [
    45,
    'C',
    1.0,
    'XL',
    1,
    'SOC 2 Type I, then Type II',
    'No report or programme in the repository',
    'AICPA SOC suite page (opened)',
  ],
  [
    46,
    'C',
    0.8,
    'XL',
    1,
    'ISO/IEC 27001 certification',
    'None',
    'iso.org returned 403 — not opened',
  ],
  [
    47,
    'C',
    0.6,
    'L',
    0,
    'Customer two-factor, passkeys and SSO',
    'Step-up TOTP exists for the admin panel only; landing-claims guard records that «two-step login» was a false claim',
    'No source opened',
  ],
  [
    48,
    'C',
    0.4,
    'M',
    0,
    'Customer-visible immutable audit trail with export',
    'audit.routes and an audit log exist; not customer-facing',
    'No source opened',
  ],
  [
    49,
    'C',
    0.8,
    'L',
    1,
    'Disaster-recovery plan: tested restore, published RTO/RPO, status page',
    'SYNC_RUNBOOK only; no DR document',
    'No source opened',
  ],
  [
    50,
    'C',
    0.5,
    'M',
    1,
    'Third-party penetration test, security policy, bug bounty',
    'None',
    'No source opened',
  ],
]

// ─── CORRECTIONS FROM THE SECOND AUDIT (2026-10-26) ───────────────────────────
// The first pass searched with narrow regexes and called several features
// missing that the repository already has. Each line below is the result of
// opening the file. `gain` is the RESIDUAL gain after what already exists.
// See docs/architecture/universal-core/FIFTY-OPTIONS-AUDIT.md for the evidence.
const CORRECTIONS = {
  1: [
    0.1,
    'EXISTS — setPeriodLock (per branch, audited), month-end package, year-end close, engine lock check; only the irreversible hard lock is missing',
  ],
  3: [
    0.3,
    'EXISTS online — tax components, rules, preview, freeze, drift, return; gap is offline (GET /tax/return online_required)',
  ],
  7: [0, 'EXISTS — GET /api/accounting/cash-flow (getCashFlow)'],
  8: [
    0,
    'NOT JUSTIFIED — budgets with distribution and a cash forecast (intelligence-forecast) already exist',
  ],
  10: [0, 'EXISTS — banking/match-learning.domain.ts feeds history into the scorer'],
  12: [
    0.4,
    'PARTIAL — stock_serials/stock_batches/traceability exist; only the call from invoice creation and the engine is missing',
  ],
  15: [
    0,
    'EXISTS — product_barcodes has a `unit` column (migration product-barcodes); no new table needed',
  ],
  31: [0, 'EXISTS — ui/conflicts + services/conflict'],
  32: [
    0.2,
    'PARTIAL — apps/desktop/e2e/app.e2e.ts has 4 Playwright-Electron tests; extend, do not restart',
  ],
  35: [
    0.2,
    'PARTIAL — ledger drill-down exists in accounting.repository; dashboard cards do not link to it',
  ],
  38: [0.1, 'PARTIAL — toCSV and buildXlsx exist in packages/formatting'],
  39: [0.2, 'PARTIAL — @fastify/swagger + /docs UI registered; spec not published, no SDK'],
  42: [
    0.15,
    'PARTIAL — webhook replay route exists in developer.routes; no delivery console UI found',
  ],
  43: [
    0.5,
    'PARTIAL — a user can already belong to several workspaces and switch (enterWorkspace); no firm dashboard',
  ],
  48: [
    0.2,
    'EXISTS — audit.routes + ui/audit with download; only tamper-evidence/export proof is missing',
  ],
  49: [
    0.5,
    'PARTIAL — snapshots, BackupService and a backup-download panel exist; no restore drill, RTO/RPO or status page',
  ],
}
for (const o of OPTIONS) {
  const c = CORRECTIONS[o[0]]
  if (c) {
    o[2] = c[0]
    o[6] = c[1]
  }
}

const total = (v, w = W) => v.reduce((s, x, i) => s + x * w[i], 0) * 10
const rankOf = (score, rivalScores) => 1 + rivalScores.filter((s) => s > score).length
const rivalTotals = (w) => Object.values(RIVALS).map((v) => total(v, w))

function apply(base, opts) {
  const v = [...base]
  for (const [, dim, gain] of opts) {
    const i = KEYS.indexOf(dim)
    v[i] = Math.min(CAP[dim], v[i] + gain)
  }
  return v
}

const now = total(HISABCHE_NOW)
const nowRank = rankOf(now, rivalTotals(W))
const full = apply(HISABCHE_NOW, OPTIONS)
const fullScore = total(full)
const fullRank = rankOf(fullScore, rivalTotals(W))

// greedy: best score-gain per effort unit, recomputed because of caps
const chosen = []
let remaining = [...OPTIONS]
let cur = HISABCHE_NOW
const path = []
while (remaining.length) {
  let best = null
  for (const o of remaining) {
    const next = apply(cur, [o])
    const gain = total(next) - total(cur)
    const ratio = gain / EFF[o[3]]
    if (!best || ratio > best.ratio) best = { o, next, gain, ratio }
  }
  if (best.gain <= 1e-9) break
  chosen.push(best.o)
  remaining = remaining.filter((x) => x !== best.o)
  cur = best.next
  const sc = total(cur)
  path.push({
    n: chosen.length,
    id: best.o[0],
    name: best.o[5],
    gain: best.gain,
    score: sc,
    rank: rankOf(sc, rivalTotals(W)),
    effort: chosen.reduce((s, x) => s + EFF[x[3]], 0),
    org: best.o[4],
  })
}
const TARGET = 4 // «below rank 5» = rank 4 or better
const firstTop5 = path.find((p) => p.rank <= TARGET)

// sensitivity: 2000 random weight vectors (Dirichlet(1)), same scores
function dirichlet() {
  const g = KEYS.map(() => -Math.log(1 - Math.random()))
  const s = g.reduce((a, b) => a + b, 0)
  return g.map((x) => x / s)
}
let seed = 12345
const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296
function dirichletSeeded() {
  const g = KEYS.map(() => -Math.log(1 - rnd()))
  const s = g.reduce((a, b) => a + b, 0)
  return g.map((x) => x / s)
}
void dirichlet
const N = 2000
const ranksNow = []
const ranksFull = []
for (let k = 0; k < N; k += 1) {
  const w = dirichletSeeded()
  const rt = rivalTotals(w)
  ranksNow.push(rankOf(total(HISABCHE_NOW, w), rt))
  ranksFull.push(rankOf(total(full, w), rt))
}
const pct = (arr, p) => [...arr].sort((a, b) => a - b)[Math.floor((p / 100) * (arr.length - 1))]
const share = (arr, limit) => ((arr.filter((r) => r <= limit).length / arr.length) * 100).toFixed(0)

const f1 = (x) => x.toFixed(1)

// Code-only view: the organisational options (audits, certifications, runbooks) are
// outside an engineering team's control, so show what is reachable without them.
const codeOnly = OPTIONS.filter((o) => !o[4])
const codeOnlyDims = apply(HISABCHE_NOW, codeOnly)
const codeOnlyScore = total(codeOnlyDims)
const codeOnlyRank = rankOf(codeOnlyScore, rivalTotals(W))
let codeCur = HISABCHE_NOW
let codeRem = [...codeOnly]
let codeN = 0
let codeEffort = 0
let codeReach = null
while (codeRem.length && !codeReach) {
  let best = null
  for (const o of codeRem) {
    const next = apply(codeCur, [o])
    const gain = total(next) - total(codeCur)
    const ratio = gain / EFF[o[3]]
    if (!best || ratio > best.ratio) best = { o, next, gain, ratio }
  }
  if (!best || best.gain <= 1e-9) break
  codeRem = codeRem.filter((x) => x !== best.o)
  codeCur = best.next
  codeN += 1
  codeEffort += EFF[best.o[3]]
  const sc = total(codeCur)
  if (rankOf(sc, rivalTotals(W)) <= TARGET) codeReach = { n: codeN, effort: codeEffort, score: sc }
}

const dimTable = DIMS.map(
  ([k, n, w]) =>
    `| ${k} | ${n} | ${(w * 100).toFixed(0)}% | ${HISABCHE_NOW[KEYS.indexOf(k)]} → ${f1(full[KEYS.indexOf(k)])} (cap ${CAP[k]}) |`,
).join('\n')
const optTable = OPTIONS.map(
  (o) =>
    `| ${o[0]} | ${o[1]} | +${o[2]} | ${o[3]}${o[4] ? ' (org)' : ''} | ${o[5]} | ${o[6]} | ${o[7]} |`,
).join('\n')
const pathTable = path
  .slice(0, 30)
  .map(
    (p) =>
      `| ${p.n} | #${p.id} ${p.name}${p.org ? ' (org)' : ''} | +${f1(p.gain)} | ${f1(p.score)} | ${p.rank} | ${p.effort} |`,
  )
  .join('\n')
const rivalTable = Object.entries(RIVALS)
  .map(([n, v]) => [n, v, total(v)])
  .sort((a, b) => b[2] - a[2])
  .map(([n, v, t], i) => `| ${i + 1} | ${n} | ${f1(t)} | ${v.join(' / ')} |`)
  .join('\n')

const md = `# Market-ranking model — reproducible, with its limits stated

> GENERATED by \`scripts/industry/ranking-model.mjs\`. Change the data in that file and rerun; do not edit this file.

## 0. Read this first

This is a **prioritisation model**, not a market fact. The 29 rivals' scores below are my judgement from public product knowledge — they are not measurements, and the Iranian, Indian and mid-market rows are low confidence. The 50 options' gains are assumptions about how much a dimension improves. What the model can honestly tell you is *which options move the score most per unit of effort under this rubric*, and *how fragile the rank is to the weights* (§5).

**A correction to an earlier answer.** I said raising ecosystem and compliance by 3 each would add "about 4–5 points". With these weights it adds 3 + 4.5 = **7.5** points. The earlier figure was wrong.

## 1. Rubric and Hisabche's starting point

Scores are 0–10; weights sum to 100%. Hisabche's "now" assumes every request from this project had shipped (it has not: the latest round wrote rules without wiring them, so the real score today is lower).

| Dim | Dimension | Weight | Hisabche now → after all 50 options |
|---|---|---|---|
${dimTable}

Hisabche now: **${f1(now)}** → rank **${nowRank}** of 30. After all 50 options: **${f1(fullScore)}** → rank **${fullRank}** of 30.

## 2. The 29 rivals as scored (dimension order A I F L O R E C)

| # | Product | Score | Dimensions |
|---|---|---|---|
${rivalTable}

## 3. The 50 options

Gain = assumed improvement in that dimension (capped, so gains in one dimension diminish). Effort units: S=1, M=2, L=4, XL=8 (relative, not weeks). "org" = needs an organisation or audit, not only code. "Repository state" was checked by search on 2026-10-26; "No source opened" means I did not open an external page for that claim.

| # | Dim | Gain | Effort | Option | Repository state | External evidence |
|---|---|---|---|---|---|---|
${optTable}

## 4. Cheapest path to rank ${TARGET} or better — «below 5» (greedy by score gained per effort unit)

${firstTop5 ? `Rank ${TARGET} or better is reached after **${firstTop5.n} options** (cumulative effort ${firstTop5.effort} units, score ${f1(firstTop5.score)}).` : 'The target is **not reached** by these options under this rubric.'}
Rank ${TARGET} means reaching **${f1(rivalTotals(W).sort((a, b) => b - a)[TARGET - 1])}** or more (the score of the ${TARGET}th-best rival).

| Step | Option | Gain | Score after | Rank after | Cumulative effort |
|---|---|---|---|---|---|
${pathTable}

## 4b. What is reachable with code alone (no audit, no certificate)

Excluding the organisational options (#45, #46, #49, #50): all ${codeOnly.length} code options give **${f1(codeOnlyScore)}** → rank **${codeOnlyRank}**. ${codeReach ? 'Rank ' + TARGET + ' or better is reached after **' + codeReach.n + ' options** (effort ' + codeReach.effort + ', score ' + f1(codeReach.score) + ') — a margin of ' + f1(codeReach.score - rivalTotals(W).sort((a, b) => b - a)[TARGET - 1]) + ' points over the threshold, which is thin.' : 'Rank ' + TARGET + ' is not reached with code alone.'}
Compliance can only reach ${f1(codeOnlyDims[7])} without a certificate, which is why the organisational options are the safest way to hold the position.

## 5. Sensitivity to the weights (2000 random weight vectors, same scores)

| | median rank | best 10% | worst 10% | share of draws in top ${TARGET} | in top 10 |
|---|---|---|---|---|---|
| Hisabche now | ${pct(ranksNow, 50)} | ${pct(ranksNow, 10)} | ${pct(ranksNow, 90)} | ${share(ranksNow, TARGET)}% | ${share(ranksNow, 10)}% |
| After all 50 options | ${pct(ranksFull, 50)} | ${pct(ranksFull, 10)} | ${pct(ranksFull, 90)} | ${share(ranksFull, TARGET)}% | ${share(ranksFull, 10)}% |

A rank that holds only under one weighting is a preference, not a result. If the "after" row shows a wide spread, the claim "rank ${TARGET} or better" depends on which dimensions the reader cares about.

## 6. What this model cannot tell you

- It scores features and trust signals, not adoption, support quality, price or sales reach — where the incumbents win decisively.
- Options 45, 46, 49 and 50 are organisational (audits, tests, runbooks); code alone cannot deliver them.
- Rival scores should be replaced by demo-based scenario results (foreign-currency purchase with FX gain/loss, multi-warehouse sale, offline sale then sync, return with ledger correction, full restore after failure) before any claim is made outside the team.
`

fs.mkdirSync('docs/architecture/universal-core', { recursive: true })
fs.writeFileSync('docs/architecture/universal-core/RANKING-MODEL.md', md)
console.log('now', f1(now), 'rank', nowRank, '| full', f1(fullScore), 'rank', fullRank)
console.log(
  'top5 at step',
  firstTop5 && firstTop5.n,
  firstTop5 && f1(firstTop5.score),
  'effort',
  firstTop5 && firstTop5.effort,
)
console.log('score needed for rank', TARGET, f1(rivalTotals(W).sort((a, b) => b - a)[TARGET - 1]))
console.log(
  'sens now median',
  pct(ranksNow, 50),
  'top4%',
  share(ranksNow, TARGET),
  '| full median',
  pct(ranksFull, 50),
  'top4%',
  share(ranksFull, TARGET),
  'p10-p90',
  pct(ranksFull, 10),
  pct(ranksFull, 90),
)
