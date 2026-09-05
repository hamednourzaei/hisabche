// ============================================================================
// scripts/find-missing-fks.mjs
//
// Every PostgREST embed the backend performs, and whether a foreign key exists
// to satisfy it.
//
// ---------------------------------------------------------------------------
// THE DEFECT CLASS
//
// supabase-js embeds a related table by naming it inside `.select()`:
//
//     .select('*, boms(*)')                 ← resolved by ANY fk between them
//     .select('*, customers!fk_invoices_customer(*)')  ← resolved BY NAME
//
// PostgREST resolves both against foreign key constraints. `base-schema-
// migration.sql` recreated 55 tables from a dump that recorded no constraints,
// so every embed whose FK was not separately restored fails with PGRST200 —
// an API-layer error about a "schema cache", which reads nothing like a
// missing foreign key.
//
// One at a time, that is a 500 per screen discovered by clicking. This finds
// them all at once.
// ============================================================================

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      return entry === '__tests__' || entry === 'node_modules' ? [] : sourceFiles(full)
    }
    return entry.endsWith('.ts') ? [full] : []
  })
}

const code = sourceFiles(join('backend', 'src')).map((f) => ({
  file: f,
  text: readFileSync(f, 'utf8'),
}))

/* ─── Which table does each .from() read? ─────────────────────────────────── */

const embeds = new Map() // "parent→child" → { parent, child, hint, file }

for (const { file, text } of code) {
  // A select block that follows a .from('x'), possibly with newlines between.
  for (const m of text.matchAll(
    /\.from\(\s*['"]([a-z0-9_]+)['"]\s*\)([\s\S]{0,1200}?)\.(?:eq|order|limit|single|range|then|maybeSingle)/g,
  )) {
    const parent = m[1]
    const block = m[2]

    const sel = /\.select\(\s*[`'"]([\s\S]*?)[`'"]\s*[,)]/.exec(block)
    if (!sel) continue

    // `child(...)` or `child!hint(...)` inside the select string.
    for (const e of sel[1].matchAll(/([a-z0-9_]+)(?:!([a-z0-9_]+))?\s*\(/g)) {
      const child = e[1]
      const hint = e[2] ?? null

      // `count(...)` and friends are aggregates, not embeds.
      if (['count', 'sum', 'avg', 'min', 'max'].includes(child)) continue

      const key = `${parent}→${child}`
      if (!embeds.has(key)) embeds.set(key, { parent, child, hint, file })
    }
  }
}

/* ─── Which FKs does the bundle create? ───────────────────────────────────── */

const bundle = readFileSync(join('docs', '_bundle.sql'), 'utf8')

/** A constraint by that exact name, anywhere in the bundle. */
//
// ⚠️ `\\s` and `\\b`, not `\s` and `\b`. These patterns are built from template
// literals, where the escape is consumed by the STRING before the regex ever
// sees it: `\s` becomes a plain `s`, and `\b` becomes a backspace character.
// Written singly, every pattern in this file matched nothing — and a checker
// that matches nothing reports every foreign key as missing, which reads as a
// catastrophic result rather than as a broken script.
const hasNamed = (name) => new RegExp(`CONSTRAINT\\s+${name}\\b`, 'i').test(bundle)

/** ANY foreign key from `parent` to `child`, which is what an unhinted embed needs. */
function hasAnyFk(parent, child) {
  const re = new RegExp(
    `ALTER TABLE[^;]*\\b${parent}\\b[^;]*FOREIGN KEY[^;]*REFERENCES\\s+(?:public\\.)?${child}\\b`,
    'is',
  )
  if (re.test(bundle)) return true
  // The reverse direction also satisfies an embed — PostgREST follows either way.
  const rev = new RegExp(
    `ALTER TABLE[^;]*\\b${child}\\b[^;]*FOREIGN KEY[^;]*REFERENCES\\s+(?:public\\.)?${parent}\\b`,
    'is',
  )
  return rev.test(bundle)
}

/* ─── Report ─────────────────────────────────────────────────────────────── */

const rule = '─'.repeat(74)
const missing = []

for (const { parent, child, hint, file } of embeds.values()) {
  const ok = hint ? hasNamed(hint) : hasAnyFk(parent, child)
  if (!ok) missing.push({ parent, child, hint, file })
}

console.log(rule)
console.log('PostgREST embeds vs foreign keys in the bundle')
console.log(rule)
console.log(`${embeds.size} embeds found in backend/src`)
console.log(`${missing.length} have no foreign key to resolve against\n`)

if (missing.length === 0) {
  console.log('✅ Every embed has a foreign key.')
  process.exit(0)
}

console.log('❌ These raise PGRST200 at runtime:\n')
for (const { parent, child, hint, file } of missing) {
  const via = hint ? `  !${hint}` : ''
  console.log(`   ${parent} → ${child}${via}`)
  // Windows paths, printed with forward slashes so the output is copy-pasteable
  // into a shell. The backslash needs escaping inside the pattern: /\/g is an
  // unterminated regex, because the backslash escapes the closing delimiter.
  console.log(`      ${file.replace(/\\/g, '/')}`)
}
console.log()
console.log(rule)
process.exitCode = 1
