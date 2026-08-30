const fs = require('fs')
const path = require('path')

function flattenKeys(obj, prefix) {
  prefix = prefix || ''
  const keys = new Set()
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? prefix + '.' + k : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const ck of flattenKeys(v, full)) keys.add(ck)
    } else {
      keys.add(full)
    }
  }
  return keys
}

const localeDir = path.join(__dirname, 'packages', 'i18n', 'src', 'locales')
const allKeys = new Set()
for (const loc of ['en', 'fa-IR', 'fa-AF']) {
  const raw = JSON.parse(fs.readFileSync(path.join(localeDir, loc + '.json'), 'utf8'))
  for (const k of flattenKeys(raw)) allKeys.add(k)
}
console.log('Locale keys (post-dedup): ' + allKeys.size)

const srcDirs = [
  path.join(__dirname, 'apps', 'web'),
  path.join(__dirname, 'apps', 'desktop'),
  path.join(__dirname, 'apps', 'admin'),
  path.join(__dirname, 'apps', 'mobile'),
  path.join(__dirname, 'packages', 'ui'),
  path.join(__dirname, 'packages', 'shared'),
]
const excludeDirs = new Set([
  'node_modules',
  '.next',
  'dist',
  '.expo',
  '.turbo',
  '.git',
  'locales',
  'out',
])
const usedKeys = new Map()

function scanDir(dir) {
  if (!fs.existsSync(dir)) return
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (excludeDirs.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      scanDir(full)
      continue
    }
    if (!/\.(tsx?|jsx?)$/.test(entry.name) || entry.name.endsWith('.d.ts')) continue
    let content
    try {
      content = fs.readFileSync(full, 'utf8')
    } catch {
      continue
    }
    // Match t('namespace.sub.key') or t("namespace.sub.key")
    // Require at least one dot (namespace+key) to filter false positives
    const re = /\bt\(\s*['"]([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)+)['"]/g
    let m
    while ((m = re.exec(content)) !== null) {
      const key = m[1]
      if (!usedKeys.has(key)) usedKeys.set(key, new Set())
      const rel = path.relative(__dirname, full).split(path.sep).join('/')
      usedKeys.get(key).add(rel)
    }
  }
}
for (const d of srcDirs) scanDir(d)
console.log('t() keys in source: ' + usedKeys.size)

const missing = []
for (const [key, files] of usedKeys) {
  if (!allKeys.has(key)) {
    missing.push({ key, files: [...files] })
  }
}
missing.sort((a, b) => a.key.localeCompare(b.key))

const nsCount = {}
for (const m of missing) {
  const ns = m.key.split('.')[0]
  nsCount[ns] = (nsCount[ns] || 0) + 1
}

console.log('Truly missing: ' + missing.length)
console.log('\nBy namespace:')
for (const [ns, count] of Object.entries(nsCount).sort((a, b) => b[1] - a[1])) {
  console.log('  ' + ns + ': ' + count)
}
console.log('\n--- MISSING KEYS ---')
for (const m of missing) {
  const cleanFiles = m.files.map((f) => f.split('/').slice(-3).join('/'))
  console.log('KEY: "' + m.key + '"')
  console.log('  FILES: ' + cleanFiles.join('; '))
}
