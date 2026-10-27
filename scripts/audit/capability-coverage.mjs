// Documented-capability coverage, reproducible from the evidence files in docs/audit/evidence/.
// 1 = documented present, 0.5 = documented partial/limited, 0 = documented absent, null = not found in this pass.
// Rival cells come from vendor-domain search summaries (see evidence files); Hisabche cells come from the repository audit.
// Output: lower bound (only documented credit), upper bound (every unknown counted as present), interval rank vs Hisabche.
import fs from 'node:fs'
import path from 'node:path'

const CAPS = [
  'C1 serial/lot',
  'C2 FIFO+average costing',
  'C3 multi-currency revaluation',
  'C4 fixed assets',
  'C5 period lock/close',
  'C6 native consolidation',
  'C7 REST API + webhooks',
  'C8 independent attestation',
  'C9 offline transaction entry',
  'C10 budgets',
]
const U = null
// order C1..C10
const ROWS = {
  'Hisabche (repo audit)': [0.5, 1, 0.5, 1, 1, 0.5, 1, 0, 1, 1],
  'SAP S/4HANA Cloud': [U, 1, U, U, U, U, U, 1, U, U],
  'Oracle Fusion Cloud ERP': [1, 1, 0.5, U, U, U, U, U, U, U],
  'Oracle NetSuite': [1, 1, U, U, U, U, 0.5, 1, 0.5, U],
  'Dynamics 365 Business Central': [1, 1, U, 1, 0.5, 1, U, 1, U, 1],
  'Infor CloudSuite': [1, 0.5, 1, U, U, U, U, 1, U, U],
  'Epicor Kinetic': [1, U, 0.5, U, U, U, U, U, U, U],
  Odoo: [1, 1, U, 1, 1, 1, U, 1, 0.5, 1],
  'Sage Intacct': [1, 1, U, U, U, 1, 0.5, 1, U, U],
  Acumatica: [1, 1, 0.5, U, U, U, 1, 1, U, U],
  'Workday Financials': [1, U, U, U, U, U, U, 1, U, U],
  ERPNext: [1, 1, U, 1, 1, 1, U, 1, 0.5, 1],
  'Exact Online': [1, 0.5, U, 1, 1, 0.5, 0.5, 0.5, U, 1],
  TallyPrime: [1, U, 1, U, U, 1, U, 0.5, U, U],
  'Sepidar (IR)': [U, U, U, U, U, U, U, U, U, U],
  'Rahkaran (IR)': [U, U, U, U, U, U, U, U, U, U],
  'QuickBooks Online': [0.5, 0.5, 1, 0.5, 1, U, 1, 1, 0, 0.5],
  'Sage 50': [1, 1, 0.5, U, U, U, U, U, U, U],
  'Zoho Books': [1, U, 1, 1, 1, U, 1, 1, U, 1],
  Xero: [0, 0.5, 0.5, 1, 1, 0, 1, 1, U, 1],
  'Holoo (IR)': [U, U, U, U, U, U, U, U, U, U],
  'Fishbowl Inventory': [1, 1, 1, U, U, U, 0.5, U, U, U],
  'Busy (IN)': [1, U, 1, U, U, 0.5, U, U, 1, U],
  DATEV: [0, U, U, U, U, U, 1, 1, U, U],
  MYOB: [0, U, 0.5, U, U, U, U, 1, U, U],
  Pennylane: [0, 0, 0.5, U, U, U, 1, 1, U, U],
  'Hesabfa (IR)': [U, U, U, U, U, U, U, U, U, U],
  FreeAgent: [U, U, U, U, U, U, U, 0.5, U, U],
  FreshBooks: [0, 0, U, U, U, U, U, U, U, U],
  Wave: [0, 0, U, U, U, U, U, U, U, U],
}

const lb = (r) => r.reduce((a, x) => a + (x ?? 0), 0)
const ub = (r) => r.reduce((a, x) => a + (x ?? 1), 0)
const unk = (r) => r.filter((x) => x === null).length
const H = lb(ROWS['Hisabche (repo audit)'])

const rivals = Object.entries(ROWS).filter(([n]) => !n.startsWith('Hisabche'))
const lines = []
lines.push(
  '| Product | ' +
    CAPS.map((c) => c.split(' ')[0]).join(' | ') +
    ' | documented (LB) | with unknowns as present (UB) | unknown cells | vs Hisabche |',
)
lines.push('|---|' + CAPS.map(() => '---').join('|') + '|---|---|---|---|')
const sym = (x) => (x === null ? '?' : x === 1 ? '✔' : x === 0.5 ? '◐' : '✖')
let ahead = 0,
  behind = 0,
  open = 0
const all = [...Object.entries(ROWS)].sort((a, b) => lb(b[1]) - lb(a[1]))
for (const [n, r] of all) {
  let verdict = ''
  if (!n.startsWith('Hisabche')) {
    if (lb(r) > H) {
      verdict = 'certainly ahead'
      ahead++
    } else if (ub(r) < H) {
      verdict = 'certainly behind'
      behind++
    } else {
      verdict = 'undetermined'
      open++
    }
  }
  lines.push(`| ${n} | ${r.map(sym).join(' | ')} | ${lb(r)} | ${ub(r)} | ${unk(r)} | ${verdict} |`)
}
const summary = `Hisabche documented coverage = ${H}/10 (static repository evidence, no live verification).\nRivals certainly ahead: ${ahead}; certainly behind: ${behind}; undetermined: ${open} of ${rivals.length}.\nBest-case rank for Hisabche (undetermined rivals all behind): ${ahead + 1}. Worst-case (undetermined rivals all ahead): ${ahead + open + 1}.`
const out = `# Documented capability coverage (generated)\n\nLegend: ✔ documented present · ◐ documented partial · ✖ documented absent · ? not found in this pass.\n\n${lines.join('\n')}\n\n${summary}\n`
const dir = path.join(process.cwd(), 'docs/audit/generated')
fs.mkdirSync(dir, { recursive: true })
fs.writeFileSync(path.join(dir, 'capability-coverage.md'), out)
console.log(summary)
