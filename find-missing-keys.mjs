import { readFileSync, readdirSync, statSync } from 'fs'
import { resolve, relative, join } from 'path'

const ROOT = resolve('.')

// بارگذاری فایل ترجمه انگلیسی
const en = JSON.parse(readFileSync(resolve(ROOT, 'packages/i18n/src/locales/en.json'), 'utf8'))

// تبدیل آبجکت تو در تو به کلیدهای نقطه‌ای
function flatten(obj, prefix = '') {
  const keys = []
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flatten(v, path))
    } else {
      keys.push(path)
    }
  }
  return keys
}

const existingKeys = new Set(flatten(en))
console.log(`Existing keys in en.json: ${existingKeys.size}`)

// جستجوی بازگشتی فایل‌ها (بدون grep)
function findAllFiles(
  dir,
  extensions,
  ignores = ['node_modules', '.git', 'dist', '.next', 'build', '.claude', 'worktrees'],
) {
  const results = []
  for (const entry of readdirSync(dir)) {
    if (ignores.includes(entry) || entry.startsWith('.')) continue
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      results.push(...findAllFiles(fullPath, extensions, ignores))
    } else if (extensions.some((ext) => entry.endsWith(ext))) {
      results.push(fullPath)
    }
  }
  return results
}

// فقط کلیدهای معتبر i18n (a-z, 0-9, نقطه، underscore, dash)
const VALID_KEY = /^[a-z][a-z0-9_.-]+$/

// پیدا کردن تمام فراخوانی‌های t()
const files = findAllFiles(ROOT, ['.ts', '.tsx'])
const usedKeys = new Map() // key → Set<file>

for (const file of files) {
  const content = readFileSync(file, 'utf8')
  const pattern = /t\(\s*['"]([a-zA-Z0-9_.-]+)['"]\s*\)/g
  let match
  while ((match = pattern.exec(content)) !== null) {
    const key = match[1]
    // فیلتر: فقط کلیدهای معتبر i18n
    if (!VALID_KEY.test(key)) continue
    // فیلتر: کلید نباید خیلی کوتاه باشد (ASCII art / CSS variables)
    if (key.length < 3) continue
    // فیلتر: کلید نباید با -- شروع شود (CSS variable)
    if (key.startsWith('--')) continue
    if (!usedKeys.has(key)) usedKeys.set(key, new Set())
    usedKeys.get(key).add(relative(ROOT, file))
  }
}

console.log(`Unique keys used in code: ${usedKeys.size}`)

// پیدا کردن کلیدهای گمشده
const missing = []
for (const [key, files] of usedKeys) {
  if (!existingKeys.has(key)) {
    missing.push({
      key,
      files: [...files].slice(0, 2).join(', '),
    })
  }
}

missing.sort((a, b) => a.key.localeCompare(b.key))

console.log(`\n=== MISSING KEYS (${missing.length}) ===`)
for (const { key, files } of missing) {
  console.log(`  ${key}  ← ${files}`)
}
