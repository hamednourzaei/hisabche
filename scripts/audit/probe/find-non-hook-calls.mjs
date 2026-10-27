// scripts/audit/probe/find-non-hook-calls.mjs
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SKIP = new Set([
  'node_modules',
  '.next',
  'dist',
  'build',
  '.turbo',
  'graphify-out',
  '.git',
  'coverage',
  '.pgtest',
  'out',
])

const walk = (dir, out = []) => {
  if (!fs.existsSync(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(e.name) && !/(__tests__|\.test\.|\.spec\.)/.test(p)) out.push(p)
  }
  return out
}

const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/')

const uiFiles = [
  ...walk(path.join(ROOT, 'packages/ui/src')),
  ...walk(path.join(ROOT, 'packages/app-shell/src')),
  ...walk(path.join(ROOT, 'apps/web/app')),
  ...walk(path.join(ROOT, 'apps/desktop/src')),
  ...walk(path.join(ROOT, 'apps/desktop/electron')),
]

console.log(`Scanning ${uiFiles.length} UI/shell files for direct API calls...`)

const nonHookCalls = new Map() // url -> [file]
for (const f of uiFiles) {
  const content = fs.readFileSync(f, 'utf8')
  // Match apiClient.<verb>('url') or fetch('url') or localRequest('verb', 'url')
  const matches = [
    ...content.matchAll(
      /apiClient\.(?:get|post|put|patch|delete)\s*(?:<[^>]*>)?\s*\(\s*['"`]([^'"`]+)['"`]/g,
    ),
    ...content.matchAll(/fetch\s*\(\s*['"`]([^'"`]+)['"`]/g),
    ...content.matchAll(/localRequest\s*\(\s*['"`][^'"`]+['"`]\s*,\s*['"`]([^'"`]+)['"`]/g),
  ]
  for (const m of matches) {
    const rawUrl = m[1].split('?')[0]
    if (!nonHookCalls.has(rawUrl)) nonHookCalls.set(rawUrl, [])
    nonHookCalls.get(rawUrl).push(rel(f))
  }
}

console.log(`Found ${nonHookCalls.size} direct URL calls in UI/shell:`)
for (const [url, files] of nonHookCalls) {
  console.log(`- ${url} (in ${files.length} files: ${files[0]})`)
}
