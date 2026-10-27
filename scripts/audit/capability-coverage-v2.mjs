// Evidence-qualified capability comparison, version 2 (page-read evidence only).
//
// A cell is filled ONLY when a vendor page was opened and read in full by WebFetch during this audit round
// (docs/audit/evidence/round3-page-reads.md lists each URL). Search-result summaries (rounds 1 and 2) are NOT used here.
// 1 = documented present, 0.5 = documented partial / plan- or scope-limited, 0 = documented absent, null = not established.
// "Not stated on the page" is null: it is not evidence of absence.
//
// Qualification rule: a rival is EVIDENCE-QUALIFIED when at least 7 of the 10 capability cells are established.
// Hisabche's cells are repository evidence (code + route + UI or engine), not live verification.
import fs from 'node:fs'
import path from 'node:path'

const CAPS = [
  ['C1', 'serial/lot tracking'],
  ['C2', 'FIFO and average costing'],
  ['C3', 'multi-currency with revaluation'],
  ['C4', 'fixed assets'],
  ['C5', 'period lock / close'],
  ['C6', 'native multi-entity consolidation'],
  ['C7', 'REST API + webhooks'],
  ['C8', 'independent attestation (SOC / ISO 27001 / ISAE)'],
  ['C9', 'offline transaction entry'],
  ['C10', 'budgets'],
]
const N = null
const DATA = {
  'Hisabche (repository)': {
    v: [0.5, 1, 1, 1, 1, 0.5, 1, 0, 1, 1],
    note: 'code + route + UI/engine; not live verified',
  },
  Odoo: {
    v: [1, 1, 0.5, 1, 1, 1, 0.5, 1, 0.5, 1],
    note: 'C3 unrealised revaluation not stated; C7 JSON-2 API with API keys, webhooks not on that page; C9 official page: opened records readable, not editable offline; POS offline only referenced',
  },
  ERPNext: {
    v: [1, 1, 1, 1, 1, N, 1, 1, N, 1],
    note: 'C6 and C9 only in old v12 docs/search; SOC 2 and ISO belong to Frappe (self-hosted installs not covered)',
  },
  'Dynamics 365 Business Central': {
    v: [1, 1, 1, 1, 1, 1, 1, 1, N, 0.5],
    note: 'C10 fixed-asset budgets read, G/L budgets page not read; eliminations are manual; C8 ISO 27001 stated, full list in a datasheet',
  },
  'Zoho Books': {
    v: [1, N, 1, 1, 1, N, 1, 1, N, 1],
    note: 'C1 batch/serial on Elite and Ultimate; C2 FIFO "not stated"; SOC 1 Type 2 and SOC 2+HIPAA name Zoho Books',
  },
  TallyPrime: {
    v: [N, N, 0.5, N, N, 0.5, N, N, N, N],
    note: 'forex gain/loss, no revaluation stated; group company consolidates reports, same base currency required',
  },
  'Busy (IN)': {
    v: [1, N, 0.5, N, N, 0.5, N, N, 1, N],
    note: 'vendor page: offline/online mode, branch merge, batch + serial, forex gain',
  },
  'QuickBooks Online': {
    v: [N, N, N, N, 1, N, N, 1, N, 1],
    note: 'closing date + password; budgets Plus/Advanced; SOC and ISO 27001 listed (SOC type not stated)',
  },
  Xero: {
    v: [0, N, 0.5, 1, N, N, N, 1, N, N],
    note: 'serial/batch listed as third-party need; multicurrency only on the Established plan; ISO 27001:2022 + SOC 2',
  },
  'Exact Online': {
    v: [N, N, N, N, N, 0.5, N, 0.5, N, N],
    note: 'support portal pages did not render for the tool; Exact Consolidation is a separate product; ISAE 3402 for Exact Online, ISO for shared services',
  },
  'Oracle NetSuite': {
    v: [1, 1, N, N, N, N, N, N, 0.5, N],
    note: 'costing page read; offline page is the SuitePeople mobile app only',
  },
  'Sage Intacct': {
    v: [N, N, N, N, N, 1, N, N, N, N],
    note: 'global consolidation book with auto-elimination; security page returned 403',
  },
  'Sepidar (IR)': {
    v: [0.5, 0.5, 0.5, N, N, N, N, N, 0, N],
    note: 'warehouse page: serial-status and expiry reports, weighted average only, separate currency subsystem; Sepidar Cloud needs a network; desktop offline not stated',
  },
  'Hesabfa (IR)': {
    v: [N, N, 1, N, N, N, 0.5, N, 0, N],
    note: 'automatic exchange-rate revaluation entries; API documentation exists; FAQ: cloud-only, no offline version',
  },
  'Holoo (IR)': {
    v: [N, N, N, N, N, N, N, N, 1, N],
    note: 'APEX page: usable offline or online; multi-currency and serial not stated',
  },
  'SAP S/4HANA Cloud': { v: Array(10).fill(N), note: 'trust-center page returned 403' },
  'Oracle Fusion Cloud ERP': { v: Array(10).fill(N), note: 'no page read this round' },
  'Infor CloudSuite': { v: Array(10).fill(N), note: 'no page read this round' },
  'Epicor Kinetic': { v: Array(10).fill(N), note: 'no page read this round' },
  Acumatica: { v: Array(10).fill(N), note: 'security checklist is a PDF the tool could not read' },
  'Workday Financials': { v: Array(10).fill(N), note: 'no page read this round' },
  'Sage 50': { v: Array(10).fill(N), note: 'no page read this round' },
  Fishbowl: { v: Array(10).fill(N), note: 'no page read this round' },
  DATEV: { v: Array(10).fill(N), note: 'no page read this round' },
  MYOB: { v: Array(10).fill(N), note: 'no page read this round' },
  Pennylane: { v: Array(10).fill(N), note: 'no page read this round' },
  'Rahkaran (IR)': {
    v: Array(10).fill(N),
    note: 'site unreachable (socket hang up / DNS failure)',
  },
  FreeAgent: { v: Array(10).fill(N), note: 'no page read this round' },
  FreshBooks: { v: Array(10).fill(N), note: 'no page read this round' },
  Wave: { v: Array(10).fill(N), note: 'no page read this round' },
}
const NOT_COMPARABLE = new Set([
  'Workday Financials',
  'DATEV',
  'Pennylane',
  'Fishbowl',
  'FreeAgent',
  'FreshBooks',
  'Wave',
])

const MARKETS = {
  'GLOBAL ERP': [0.08, 0.08, 0.12, 0.1, 0.1, 0.16, 0.1, 0.2, 0.01, 0.05],
  'GENERAL SMB': [0.12, 0.12, 0.1, 0.08, 0.08, 0.04, 0.14, 0.12, 0.08, 0.12],
  'AFGHANISTAN / IRAN SMB': [0.14, 0.14, 0.16, 0.06, 0.08, 0.02, 0.06, 0.04, 0.22, 0.08],
  'OFFLINE-FIRST SMB': [0.08, 0.08, 0.08, 0.04, 0.06, 0.02, 0.06, 0.06, 0.5, 0.02],
}
for (const [k, w] of Object.entries(MARKETS))
  if (Math.abs(w.reduce((a, b) => a + b, 0) - 1) > 1e-9)
    throw new Error('weights must sum to 1: ' + k)

const known = (v) => v.filter((x) => x !== N).length
const lb = (v, w = null) => v.reduce((a, x, i) => a + (x ?? 0) * (w ? w[i] : 1), 0)
const ub = (v, w = null) => v.reduce((a, x, i) => a + (x ?? 1) * (w ? w[i] : 1), 0)
const sym = (x) => (x === N ? '?' : x === 1 ? '✔' : x === 0.5 ? '◐' : '✖')
const f = (x, d = 2) => x.toFixed(d)

const hisabche = DATA['Hisabche (repository)']
const qualified = Object.entries(DATA).filter(
  ([n, d]) => n !== 'Hisabche (repository)' && !NOT_COMPARABLE.has(n) && known(d.v) >= 7,
)
const lines = []
lines.push('# Capability comparison v2 — page-read evidence only (generated)')
lines.push('')
lines.push('Cells: ' + CAPS.map(([k, n]) => `${k} ${n}`).join(' · '))
lines.push('')
lines.push(
  '| Product | ' + CAPS.map(([k]) => k).join(' | ') + ' | established cells | LB | UB | status |',
)
lines.push('|---|' + CAPS.map(() => '---').join('|') + '|---|---|---|---|')
const order = Object.entries(DATA).sort(
  (a, b) => known(b[1].v) - known(a[1].v) || lb(b[1].v) - lb(a[1].v),
)
for (const [n, d] of order) {
  const status = n.startsWith('Hisabche')
    ? 'subject'
    : NOT_COMPARABLE.has(n)
      ? 'NOT_DIRECTLY_COMPARABLE'
      : known(d.v) >= 7
        ? 'EVIDENCE-QUALIFIED'
        : known(d.v) === 0
          ? 'NOT_VERIFIED'
          : 'PARTIAL — excluded'
  lines.push(
    `| ${n} | ${d.v.map(sym).join(' | ')} | ${known(d.v)}/10 | ${f(lb(d.v), 1)} | ${f(ub(d.v), 1)} | ${status} |`,
  )
}
lines.push('')
lines.push(
  `EVIDENCE-QUALIFIED COMPARISON SET = ${qualified.length} rivals (${qualified.map(([n]) => n).join(', ')}). Excluded: ${Object.keys(DATA).length - 1 - qualified.length} others (not comparable, partially evidenced, or not verified).`,
)
lines.push('')
lines.push('## Relative position inside the qualified set (not a market ranking)')
lines.push('')
lines.push(
  "A rival is *certainly ahead* when its lower bound exceeds Hisabche's upper bound, *certainly behind* when its upper bound is below Hisabche's lower bound, otherwise *undetermined*. Hisabche has no unknown cells, so its bounds coincide.",
)
lines.push('')
for (const [mname, w] of [['Equal weights (10 capabilities)', null], ...Object.entries(MARKETS)]) {
  const hs = lb(hisabche.v, w)
  let ahead = 0,
    behind = 0,
    und = 0
  const rows = []
  for (const [n, d] of qualified) {
    const l = lb(d.v, w),
      u = ub(d.v, w)
    let verdict
    if (l > hs) {
      verdict = 'certainly ahead'
      ahead++
    } else if (u < hs) {
      verdict = 'certainly behind'
      behind++
    } else {
      verdict = 'undetermined'
      und++
    }
    rows.push(`| ${n} | ${f(l)} | ${f(u)} | ${verdict} |`)
  }
  const sc = w ? f(hs, 3) : f(hs, 1)
  lines.push(`### ${mname}`)
  lines.push('')
  lines.push(
    `Hisabche = **${sc}** · qualified rivals: ${qualified.length} · certainly ahead ${ahead} · certainly behind ${behind} · undetermined ${und} · position among ${qualified.length + 1}: **${ahead + 1} to ${ahead + und + 1}**`,
  )
  lines.push('')
  lines.push('| Rival | LB | UB | vs Hisabche |')
  lines.push('|---|---|---|---|')
  lines.push(...rows)
  lines.push('')
}
lines.push('## Notes per product')
lines.push('')
for (const [n, d] of order) lines.push(`- **${n}** — ${d.note}`)
const dir = path.join(process.cwd(), 'docs/audit/generated')
fs.mkdirSync(dir, { recursive: true })
fs.writeFileSync(path.join(dir, 'capability-coverage-v2.md'), lines.join('\n') + '\n')
console.log(lines.slice(0, 40).join('\n'))
