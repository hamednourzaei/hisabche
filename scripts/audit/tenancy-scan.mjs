// Read-only heuristic: query chains on tenant tables (tables that declare workspace_id in docs/*.sql)
// that filter by .eq('id', ...) / .in('id', ...) but never mention workspace_id in the same chain.
// Each hit is a CANDIDATE: a human must read it (the caller may have verified ownership one line earlier).
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const tables = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'docs/audit/generated/tables.json'), 'utf8'),
)
const tenant = new Set(tables.filter((t) => t.workspace).map((t) => t.table))
const walk = (d, o = []) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p, o)
    else if (p.endsWith('.ts') && !p.includes('__tests__')) o.push(p)
  }
  return o
}
const files = [
  ...walk(path.join(ROOT, 'backend/src/services')),
  ...walk(path.join(ROOT, 'backend/src/routes')),
]
const hits = []
let chains = 0
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8')
  const rel = path.relative(ROOT, f).split(path.sep).join('/')
  for (const m of s.matchAll(/\.from\(\s*['"`]([a-z_0-9]+)['"`]\s*\)/g)) {
    if (!tenant.has(m[1])) continue
    chains++
    // chain = until a blank line or a semicolon-terminated statement, capped
    let end = s.indexOf(';', m.index)
    const blank = s.indexOf('\n\n', m.index)
    if (end < 0 || (blank > 0 && blank < end)) end = blank > 0 ? blank : m.index + 700
    const chain = s.slice(m.index, Math.min(end, m.index + 900))
    if (/\.(eq|in)\(\s*['"`]id['"`]/.test(chain) && !/workspace_id|workspaceId/.test(chain)) {
      const line = s.slice(0, m.index).split('\n').length
      const op = /\.(update|delete|upsert)\(/.test(chain) ? 'WRITE' : 'read'
      hits.push({ file: rel, line, table: m[1], op })
    }
  }
}
fs.writeFileSync(
  path.join(ROOT, 'docs/audit/generated/tenancy-scan.json'),
  JSON.stringify(hits, null, 1),
)
const w = hits.filter((h) => h.op === 'WRITE')
console.log('tenant-table query chains scanned:', chains)
console.log(
  'chains filtering by id without workspace_id in the same chain:',
  hits.length,
  '(writes:',
  w.length + ')',
)
const byFile = {}
for (const h of w) (byFile[h.file] = byFile[h.file] || []).push(h.table + ':' + h.line)
for (const [f, v] of Object.entries(byFile)) console.log(' WRITE', f, v.slice(0, 6).join(' '))
