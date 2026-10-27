// Read-only: for the universal-core tables, compare the keys each backend service writes (.insert/.update objects)
// and the columns it selects with the columns declared in docs/universal-core-migration.sql.
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const mig = fs.readFileSync(path.join(ROOT, 'docs/universal-core-migration.sql'), 'utf8')
const cols = {}
for (const m of mig.matchAll(/CREATE TABLE IF NOT EXISTS public\.(\w+) \(([\s\S]*?)\n\);/g)) {
  const body = m[2]
  const set = new Set()
  for (const line of body.split('\n')) {
    const c = line
      .trim()
      .match(
        /^([a-z_0-9]+)\s+(?:uuid|text|integer|bigint|boolean|date|timestamptz|jsonb|numeric|int)\b/i,
      )
    if (c) set.add(c[1])
  }
  cols[m[1]] = set
}
// ALTER TABLE ... ADD COLUMN
for (const m of mig.matchAll(/ALTER TABLE public\.(\w+)\s+ADD COLUMN IF NOT EXISTS (\w+)/g)) {
  if (!cols[m[1]]) cols[m[1]] = new Set()
  cols[m[1]].add(m[2])
}

const walk = (d, o = []) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p, o)
    else if (p.endsWith('.ts') && !p.includes('__tests__')) o.push(p)
  }
  return o
}
const files = walk(path.join(ROOT, 'backend/src/services')).concat(
  walk(path.join(ROOT, 'backend/src/routes')),
)
const problems = []
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8')
  for (const m of s.matchAll(/\.from\(\s*['"`](\w+)['"`]\s*\)/g)) {
    const t = m[1]
    if (!cols[t]) continue
    const tail = s.slice(m.index, m.index + 1800)
    const w = tail.match(/\.(insert|update|upsert)\(\s*(\[?\s*\{)/)
    if (!w) continue
    const start = tail.indexOf('{', w.index)
    let depth = 0
    let end = start
    for (let i = start; i < tail.length; i++) {
      if (tail[i] === '{') depth++
      else if (tail[i] === '}') {
        depth--
        if (depth === 0) {
          end = i
          break
        }
      }
    }
    const obj = tail.slice(start + 1, end)
    const keys = new Set()
    // top-level keys only: depth-aware scan
    let d2 = 0
    let buf = ''
    for (const ch of obj) {
      if (ch === '{' || ch === '[' || ch === '(') d2++
      if (ch === '}' || ch === ']' || ch === ')') d2--
      if (d2 === 0 && ch === ',') {
        buf += '\n'
      } else buf += ch
    }
    for (const part of buf.split('\n')) {
      const k = part.trim().match(/^([a-z_0-9]+)\s*:/)
      if (k) keys.add(k[1])
    }
    for (const k of keys) {
      if (!cols[t].has(k))
        problems.push(
          `${path.relative(ROOT, f).split(path.sep).join('/')}: writes ${t}.${k} - column not in migration`,
        )
    }
  }
}
console.log('tables parsed from migration:', Object.keys(cols).length)
console.log(
  problems.length
    ? problems.join('\n')
    : 'no unknown columns found in insert/update objects of the parsed tables',
)
