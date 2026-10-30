// Finds `t('key', 'fallback')` calls in packages/ui whose key is missing from a
// message bundle. A missing key makes next-intl print the fallback — which is
// Persian for most of them — inside the English UI.
//
// Usage: node scripts/audit/probe/find-missing-i18n-fallbacks.mjs [locale]
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const LOCALE = process.argv[2] || 'en'
const BUNDLE = path.join(ROOT, 'packages', 'i18n', 'messages', LOCALE, 'common.json')
const SRC = path.join(ROOT, 'packages', 'ui', 'src')

const bundle = JSON.parse(fs.readFileSync(BUNDLE, 'utf8'))

function hasKey(dotted) {
  let node = bundle
  for (const part of dotted.split('.')) {
    if (!node || typeof node !== 'object' || !(part in node)) return false
    node = node[part]
  }
  return typeof node === 'string'
}

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry)
    const stat = fs.statSync(full)
    if (stat.isDirectory()) walk(full, out)
    else if (/\.(ts|tsx)$/.test(entry) && !full.includes('__tests__')) out.push(full)
  }
}

const files = []
walk(SRC, files)

// t('some.key', 'fallback')  |  t('some.key', "fallback")
const CALL = /\bt\(\s*'([a-zA-Z0-9_.]+)'\s*,\s*(['"`])([\s\S]*?)\2\s*\)/g
const missing = new Map()

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8')
  let match
  while ((match = CALL.exec(source)) !== null) {
    const key = match[1]
    const fallback = match[3]
    if (hasKey(key)) continue
    const rel = path.relative(ROOT, file).replace(/\\/g, '/')
    const entry = missing.get(key) || { key, fallback: fallback.slice(0, 60), files: new Set() }
    entry.files.add(rel)
    missing.set(key, entry)
  }
}

const rows = [...missing.values()].sort((a, b) => a.key.localeCompare(b.key))
const persian = rows.filter((r) => /[\u0600-\u06FF]/.test(r.fallback))

console.log(`locale: ${LOCALE}`)
console.log(`bundle: packages/i18n/messages/${LOCALE}/common.json`)
console.log(`ui files scanned: ${files.length}`)
console.log(`missing keys with a literal fallback: ${rows.length}`)
console.log(`of those, fallback contains Persian/Arabic script: ${persian.length}`)
console.log('')
for (const row of rows) {
  console.log(`${row.key}  |  fallback: ${row.fallback}  |  ${[...row.files].join(', ')}`)
}
