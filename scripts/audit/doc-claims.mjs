// Read-only: for a set of documents, extract every backticked file path and test that it exists, and re-count a few
// numbers the documents state. Output: docs/audit/generated/doc-claims.json
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const DOCS = [
  'CLAUDE.md',
  '.claude/README.md',
  '.claude/STATE.md',
  '.claude/WORKFLOW.md',
  '.claude/architecture/core-modules.md',
  '.claude/architecture/api-surface.md',
  '.claude/architecture/data-model.md',
  '.claude/ux-audit/README.md',
  'docs/architecture/capability-matrix.csv',
  'docs/PRODUCTION-RELEASE-CHECKLIST-universal-core.md',
  'docs/security/disaster-recovery.md',
  'docs/security/pentest-scope.md',
  'docs/security/soc2/control-inventory.md',
  'docs/security/iso27001/scope-and-risk-register.md',
  'docs/security/iso27001/statement-of-applicability.md',
  'docs/architecture/universal-core/FIFTY-OPTIONS-LOG.md',
  'docs/architecture/universal-core/UNIVERSAL-CORE-GAP-ANALYSIS.md',
  'docs/architecture/universal-core/CORE-INVENTORY.md',
]
const PREFIXES = [
  '',
  'docs/',
  '.claude/',
  'backend/src/',
  'backend/src/services/',
  'backend/src/routes/',
  'packages/',
  'packages/ui/src/',
  'packages/ui/src/components/ui/',
  'packages/app-shell/src/',
  'packages/api/src/',
  'packages/api/src/hooks/',
  'packages/validation/src/schemas/',
  'packages/ui-contract/src/',
  'apps/web/',
  'apps/mobile/',
  'apps/desktop/',
  'scripts/',
]
const exists = (p) => PREFIXES.some((x) => fs.existsSync(path.join(ROOT, x + p)))
const basenameIndex = new Map()
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (['node_modules', '.git', '.next', 'dist', 'graphify-out', '.pgtest'].includes(e.name))
      continue
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p)
    else basenameIndex.set(e.name, (basenameIndex.get(e.name) || 0) + 1)
  }
}
walk(ROOT)
const rows = []
for (const doc of DOCS) {
  const f = path.join(ROOT, doc)
  if (!fs.existsSync(f)) {
    rows.push({ doc, missingDocument: true })
    continue
  }
  const s = fs.readFileSync(f, 'utf8')
  const refs = new Set()
  for (const m of s.matchAll(
    /`([A-Za-z0-9_@./\-[\]()]+\.(?:ts|tsx|sql|mjs|js|md|json|csv|yml|yaml))(?::\d+)?`/g,
  ))
    refs.add(m[1])
  let ok = 0
  const bad = []
  for (const r of refs) {
    if (/[*<>]|\.\.\./.test(r)) continue
    if (exists(r)) ok++
    else if (!r.includes('/') && basenameIndex.has(r)) ok++
    else bad.push(r)
  }
  rows.push({ doc, refs: refs.size, resolved: ok, unresolved: bad })
}
// numbers stated in CLAUDE.md that can be recounted
const count = {}
try {
  const cfg = fs.readFileSync(path.join(ROOT, 'apps/web/next.config.js'), 'utf8')
  const moved = cfg.match(/moved\s*=\s*\[([\s\S]*?)\n\s*\]/)
  count.movedPairs = moved ? (moved[1].match(/\[\s*['"`]/g) || []).length : null
} catch {
  count.movedPairs = null
}
const lessons = path.join(ROOT, '.claude/lessons-learned.md')
if (fs.existsSync(lessons)) {
  const nums = [
    ...fs.readFileSync(lessons, 'utf8').matchAll(/^#{1,4}\s*(?:درس\s*)?(\d{1,3})\b/gm),
  ].map((m) => Number(m[1]))
  count.lessonsMax = nums.length ? Math.max(...nums) : null
  count.lessonsCount = nums.length
}
count.skillDirs = fs.existsSync(path.join(ROOT, '.claude/skills'))
  ? fs.readdirSync(path.join(ROOT, '.claude/skills')).length
  : null
count.commands = fs.existsSync(path.join(ROOT, '.claude/commands'))
  ? fs.readdirSync(path.join(ROOT, '.claude/commands'))
  : null
count.agents = fs.existsSync(path.join(ROOT, '.claude/agents'))
  ? fs.readdirSync(path.join(ROOT, '.claude/agents'))
  : null
fs.writeFileSync(
  path.join(ROOT, 'docs/audit/generated/doc-claims.json'),
  JSON.stringify({ rows, count }, null, 1),
)
for (const r of rows)
  console.log(
    r.doc.padEnd(70),
    r.missingDocument ? 'MISSING DOCUMENT' : `${r.resolved}/${r.refs} resolved`,
    (r.unresolved || []).slice(0, 6).join(', '),
  )
console.log(count)
