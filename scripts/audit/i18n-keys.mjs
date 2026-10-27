// Read-only: every literal translation key used in shared UI code, checked against the three catalogues.
// next-intl namespaces make exact resolution impossible statically, so a key counts as present if the full key exists,
// or if it is relative and some catalogue key ends with ".<key>". "Missing" therefore means missing under any prefix.
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const walk = (d, o = []) => {
  if (!fs.existsSync(d)) return o
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (['node_modules', '.next', 'dist'].includes(e.name)) continue
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p, o)
    else if (/\.(tsx|ts)$/.test(e.name) && !/__tests__|\.test\./.test(p)) o.push(p)
  }
  return o
}
const flat = (o, p = '', out = new Set()) => {
  for (const [k, v] of Object.entries(o)) {
    const key = p ? p + '.' + k : k
    if (v && typeof v === 'object') flat(v, key, out)
    else out.add(key)
  }
  return out
}
const cat = {}
for (const l of ['fa', 'af', 'en'])
  cat[l] = flat(
    JSON.parse(
      fs
        .readFileSync(path.join(ROOT, 'packages/i18n/messages', l, 'common.json'), 'utf8')
        .replace(/^\uFEFF/, ''),
    ),
  )
const suffixIndex = (set) => {
  const m = new Set()
  for (const k of set) {
    const parts = k.split('.')
    for (let i = 0; i < parts.length; i++) m.add(parts.slice(i).join('.'))
  }
  return m
}
const idx = { fa: suffixIndex(cat.fa), af: suffixIndex(cat.af), en: suffixIndex(cat.en) }

const used = new Map()
const re =
  /\b(?:t|tr|translateOr)\(\s*(?:t\s*,\s*)?['"]([a-zA-Z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_-]+)+)['"]/g
for (const f of [
  ...walk(path.join(ROOT, 'packages/ui/src')),
  ...walk(path.join(ROOT, 'packages/app-shell/src')),
]) {
  const s = fs.readFileSync(f, 'utf8')
  for (const m of s.matchAll(re)) {
    const k = m[1]
    if (!used.has(k)) used.set(k, new Set())
    used.get(k).add(path.relative(ROOT, f).split(path.sep).join('/'))
  }
}
const missing = { fa: [], af: [], en: [] }
for (const [k, files] of used) {
  for (const l of ['fa', 'af', 'en']) if (!idx[l].has(k)) missing[l].push([k, [...files][0]])
}
const out = {
  distinctLiteralKeys: used.size,
  missingFa: missing.fa.length,
  missingAf: missing.af.length,
  missingEn: missing.en.length,
}
fs.writeFileSync(
  path.join(ROOT, 'docs/audit/generated/i18n-keys.json'),
  JSON.stringify({ out, missing }, null, 1),
)
console.log(JSON.stringify(out))
for (const l of ['fa', 'af', 'en'])
  console.log(
    l,
    missing[l]
      .slice(0, 12)
      .map((x) => x[0] + ' <- ' + x[1].split('/').pop())
      .join('\n   '),
  )
