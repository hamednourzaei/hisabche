import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { resolve, relative, join } from 'path'

const ROOT = resolve('.')

// ── helpers ──
function flatten(obj, prefix = '') {
  const keys = []
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) keys.push(...flatten(v, path))
    else keys.push(path)
  }
  return keys
}

function findAllFiles(
  dir,
  exts,
  ignores = ['node_modules', '.git', 'dist', '.next', 'build', '.claude'],
) {
  const results = []
  for (const entry of readdirSync(dir)) {
    if (ignores.includes(entry) || entry.startsWith('.')) continue
    const fp = join(dir, entry)
    if (statSync(fp).isDirectory()) results.push(...findAllFiles(fp, exts, ignores))
    else if (exts.some((e) => entry.endsWith(e))) results.push(fp)
  }
  return results
}

// ── 1. discover missing keys ──
const en = JSON.parse(readFileSync(resolve(ROOT, 'packages/i18n/src/locales/en.json'), 'utf8'))
const existing = new Set(flatten(en))

const files = findAllFiles(ROOT, ['.ts', '.tsx'])
const usedKeys = new Map()
const VALID = /^[a-z][a-z0-9_.-]+$/
for (const file of files) {
  const content = readFileSync(file, 'utf8')
  const pat = /t\(\s*['"]([a-zA-Z0-9_.-]+)['"]\s*\)/g
  let m
  while ((m = pat.exec(content)) !== null) {
    const key = m[1]
    if (!VALID.test(key) || key.length < 3) continue
    if (!usedKeys.has(key)) usedKeys.set(key, new Set())
    usedKeys.get(key).add(relative(ROOT, file))
  }
}

const missing = []
for (const [key] of usedKeys) {
  if (!existing.has(key)) missing.push(key)
}
missing.sort()
console.log(`Missing keys to add: ${missing.length}`)

// ── 2. build translations ──
// Rough heuristic: split key by '.', use last segment as translation base
// For real translations, use a mapping from the discovered analysis
const TRANSLATIONS = {}

// Auto-generate sensible EN values from key paths
for (const key of missing) {
  const parts = key.split('.')
  const last = parts[parts.length - 1]

  // Generate reasonable EN default
  const enVal = last
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()

  TRANSLATIONS[key] = { en: enVal }
}

// ── 3. inject into locale files ──
const LOCALES = [
  { file: 'packages/i18n/src/locales/en.json', lang: 'en' },
  { file: 'packages/i18n/src/locales/fa-IR.json', lang: 'fa' },
  { file: 'packages/i18n/src/locales/fa-AF.json', lang: 'af' },
]

for (const { file, lang } of LOCALES) {
  const path = resolve(ROOT, file)
  const data = JSON.parse(readFileSync(path, 'utf8'))
  let added = 0

  for (const key of missing) {
    const parts = key.split('.')

    // Check if key already exists
    let cur = data
    let exists = true
    for (const p of parts) {
      if (cur[p] === undefined) {
        exists = false
        break
      }
      cur = cur[p]
    }
    if (exists) continue

    // Navigate/create path, converting strings to objects
    cur = data
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i]
      if (typeof cur[p] === 'string') {
        cur[p] = { title: cur[p] }
        cur = cur[p]
      } else if (!cur[p] || typeof cur[p] !== 'object' || Array.isArray(cur[p])) {
        cur[p] = {}
        cur = cur[p]
      } else {
        cur = cur[p]
      }
    }

    const leaf = parts[parts.length - 1]
    if (cur[leaf] === undefined || typeof cur[leaf] === 'string') {
      cur[leaf] = TRANSLATIONS[key][lang] || TRANSLATIONS[key].en
      added++
    }
  }

  writeFileSync(path, JSON.stringify(data, null, 2), 'utf8')
  console.log(`✅ ${lang}: ${added} keys added`)
}

// ── 4. verify ──
const enAfter = JSON.parse(readFileSync(resolve(ROOT, 'packages/i18n/src/locales/en.json'), 'utf8'))
const existingAfter = new Set(flatten(enAfter))
let stillMissing = 0
for (const key of missing) {
  if (!existingAfter.has(key)) stillMissing++
}
console.log(`\nVerification: ${missing.length - stillMissing} added, ${stillMissing} still missing`)
