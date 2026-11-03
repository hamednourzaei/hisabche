// scripts/audit/universal-core-orphans.mjs — READ-ONLY. For each exported symbol of packages/validation/src/schemas/universal-core/*.ts,
// which production files (outside tests and the defining file) use it. ORPHAN = no production consumer.
// Run from the repository root: node scripts/audit/universal-core-orphans.mjs
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
const ROOT = process.cwd().split(String.fromCharCode(92)).join('/')
const SKIP = new Set([
  'node_modules',
  '.next',
  'dist',
  'build',
  '.git',
  '.turbo',
  'graphify-out',
  '.claude',
  '.ai',
  'android',
  'ios',
  '.p',
  'hisabche-promo-reel',
])
const all = []
const walk = (d) => {
  for (const n of readdirSync(d)) {
    if (SKIP.has(n)) continue
    const p = join(d, n)
    let st
    try {
      st = statSync(p)
    } catch {
      continue
    }
    if (st.isDirectory()) walk(p)
    else if (/\.(ts|tsx)$/.test(n) && st.size < 1_500_000) all.push(p)
  }
}
for (const t of ['backend/src', 'packages', 'apps']) walk(join(ROOT, t))
const slash = String.fromCharCode(92)
const rel = (p) =>
  p
    .split(slash)
    .join('/')
    .replace(ROOT + '/', '')
const texts = all.map((p) => ({ rel: rel(p), text: readFileSync(p, 'utf8') }))
const isTest = (r) => /__tests__|\.test\.|\.spec\./.test(r)
const dir = join(ROOT, 'packages/validation/src/schemas/universal-core')
const areaOf = (r) =>
  r.startsWith('backend/')
    ? 'backend'
    : r.startsWith('packages/local-engine')
      ? 'device'
      : r.startsWith('packages/ui/') || r.startsWith('apps/web')
        ? 'ui'
        : r.startsWith('packages/api')
          ? 'api'
          : r.startsWith('packages/validation')
            ? 'validation'
            : 'other'
for (const f of readdirSync(dir).filter((n) => n.endsWith('.ts') && n !== 'index.ts')) {
  const self = 'packages/validation/src/schemas/universal-core/' + f
  const src = readFileSync(join(dir, f), 'utf8')
  const names = [...src.matchAll(/export (?:async )?(?:function|const) (\w+)/g)].map((m) => m[1])
  console.log('== ' + f + ' (' + names.length + ' exports)')
  const orphans = []
  for (const name of names) {
    const re = new RegExp('\\b' + name + '\\b')
    const by = {}
    let tests = 0
    for (const { rel: r, text } of texts) {
      if (r === self) continue
      if (!re.test(text)) continue
      if (isTest(r)) {
        tests++
        continue
      }
      if (r.endsWith('/index.ts') && r.startsWith('packages/validation')) continue
      by[areaOf(r)] = (by[areaOf(r)] || 0) + 1
    }
    const total = Object.values(by).reduce((a, b) => a + b, 0)
    if (total === 0) orphans.push(name + (tests ? '(test-only)' : ''))
    else console.log('   ' + name + ' -> ' + JSON.stringify(by) + (tests ? ' tests=' + tests : ''))
  }
  if (orphans.length) console.log('   ORPHAN (no production consumer): ' + orphans.join(', '))
}
