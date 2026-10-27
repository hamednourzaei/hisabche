// Read-only: every .from('x') / .rpc('x') in backend services and routes, checked against names defined in docs/*.sql.
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = process.cwd()
const walk = (d, o = []) => {
  if (!fs.existsSync(d)) return o
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'node_modules') continue
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p, o)
    else o.push(p)
  }
  return o
}
const sql = walk(path.join(ROOT, 'docs'))
  .filter((f) => f.endsWith('.sql'))
  .map((f) => fs.readFileSync(f, 'utf8'))
  .join('\n')
const defined = new Set()
for (const m of sql.matchAll(
  /CREATE\s+(?:OR\s+REPLACE\s+)?(?:TABLE|VIEW|MATERIALIZED\s+VIEW)(?:\s+IF\s+NOT\s+EXISTS)?\s+(?:public\.)?"?([a-z_0-9]+)"?/gi,
))
  defined.add(m[1].toLowerCase())
const fns = new Set()
for (const m of sql.matchAll(
  /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?"?([a-z_0-9]+)"?/gi,
))
  fns.add(m[1].toLowerCase())
const changed = new Set(
  execSync('git status --short --untracked-files=all', { encoding: 'utf8' })
    .split('\n')
    .map((l) => l.slice(3).trim()),
)
const files = walk(path.join(ROOT, 'backend/src')).filter(
  (f) => /\.ts$/.test(f) && !/__tests__/.test(f),
)
const missing = {}
const missingFn = {}
for (const f of files) {
  const rel = path.relative(ROOT, f).split(path.sep).join('/')
  const tag = changed.has(rel) ? ' [CHANGED]' : ''
  const s = fs.readFileSync(f, 'utf8')
  for (const m of s.matchAll(/\.from\(\s*['"`]([a-z_0-9]+)['"`]\s*\)/g)) {
    if (!defined.has(m[1])) (missing[m[1]] = missing[m[1]] || new Set()).add(rel + tag)
  }
  for (const m of s.matchAll(/\.rpc\(\s*['"`]([a-z_0-9]+)['"`]/g)) {
    if (!fns.has(m[1])) (missingFn[m[1]] = missingFn[m[1]] || new Set()).add(rel + tag)
  }
}
console.log('tables/views defined in docs/*.sql:', defined.size, '· functions:', fns.size)
console.log('\n.from() names with no definition in docs/*.sql:')
for (const [k, v] of Object.entries(missing))
  console.log(' ', k, '<-', [...v].slice(0, 3).join(', '))
console.log('\n.rpc() names with no definition in docs/*.sql:')
for (const [k, v] of Object.entries(missingFn))
  console.log(' ', k, '<-', [...v].slice(0, 3).join(', '))
