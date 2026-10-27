// Read-only: path-reference check over EVERY markdown file under docs/ and .claude/ and the root.
// A reference is a backticked token that ends in a code/data extension. It is resolved against the repository
// with a list of common prefixes, then by unique basename. Unresolved ≠ false: some are deleted-on-purpose names
// quoted as history; the output lets a reader sort those out.
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const mdFiles = []
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (
      [
        'node_modules',
        '.git',
        '.next',
        'dist',
        'graphify-out',
        '.pgtest',
        'generated',
        'verify-logs',
      ].includes(e.name)
    )
      continue
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p)
    else if (e.name.endsWith('.md')) mdFiles.push(p)
  }
}
for (const top of ['docs', '.claude'])
  if (fs.existsSync(path.join(ROOT, top))) walk(path.join(ROOT, top))
for (const f of ['CLAUDE.md', 'README.md', 'AGENTS.md'])
  if (fs.existsSync(path.join(ROOT, f))) mdFiles.push(path.join(ROOT, f))

const all = new Map()
const walkAll = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (['node_modules', '.git', '.next', 'dist', 'graphify-out', '.pgtest'].includes(e.name))
      continue
    const p = path.join(d, e.name)
    if (e.isDirectory()) walkAll(p)
    else all.set(e.name, (all.get(e.name) || 0) + 1)
  }
}
walkAll(ROOT)
const PREFIXES = [
  '',
  'docs/',
  '.claude/',
  'backend/src/',
  'backend/src/services/',
  'backend/src/routes/',
  'backend/src/__tests__/',
  'packages/',
  'packages/ui/src/',
  'packages/ui/src/components/ui/',
  'packages/ui/src/__tests__/',
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
let refsTotal = 0
let bad = 0
const perDoc = []
for (const f of mdFiles) {
  const s = fs.readFileSync(f, 'utf8')
  const refs = new Set()
  for (const m of s.matchAll(
    /`([A-Za-z0-9_@./\-[\]()]+\.(?:ts|tsx|sql|mjs|js|json|csv|yml|yaml))(?::\d+)?`/g,
  ))
    refs.add(m[1])
  const unresolved = []
  for (const r of refs) {
    if (/[*<>]|\.\.\./.test(r)) continue
    refsTotal++
    if (exists(r) || (!r.includes('/') && all.has(r))) continue
    unresolved.push(r)
    bad++
  }
  perDoc.push({
    doc: path.relative(ROOT, f).split(path.sep).join('/'),
    refs: refs.size,
    unresolved,
  })
}
perDoc.sort((a, b) => b.unresolved.length - a.unresolved.length)
fs.writeFileSync(
  path.join(ROOT, 'docs/audit/generated/doc-paths-all.json'),
  JSON.stringify({ docs: mdFiles.length, refsTotal, unresolvedTotal: bad, perDoc }, null, 1),
)
console.log(
  'markdown files scanned:',
  mdFiles.length,
  '· path references:',
  refsTotal,
  '· unresolved:',
  bad,
)
for (const d of perDoc.slice(0, 15)) console.log(String(d.unresolved.length).padStart(3), d.doc)
