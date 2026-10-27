// scratch: preview route_class counts without touching the generators
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const GEN = path.join(ROOT, 'docs/audit/generated')
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))

const routes = readJson(path.join(GEN, 'route-inventory.json'))
const hooks = readJson(path.join(GEN, 'hook-inventory.json'))

function normalizeEndpoint(method, rawUrl) {
  if (!rawUrl) return null
  let p = rawUrl.replace(/\/+$/, '')
  p = p.replace(/:[A-Za-z0-9_]+/g, ':id')
  p = p.replace(/\$\{[^}]+\}/g, ':id')
  const aliases = [
    ['/api/branches', '/api/branch'],
    ['/api/rules', '/api/business-rules'],
    ['/api/payments', '/api/payment'],
    ['/api/warehouses', '/api/warehouse'],
    ['/api/discounts', '/api/discount'],
    ['/api/activities', '/api/activity'],
    ['/api/orders', '/api/order'],
    ['/api/transactions', '/api/transaction'],
  ]
  for (const [from, to] of aliases) if (p === from) p = to
  return `${method} ${p}`
}

const hookKeys = new Set()
for (const h of hooks) {
  const k = normalizeEndpoint(h.method, h.canonicalUrl)
  if (k) hookKeys.add(k)
}
const routeKeys = new Set()
for (const r of routes) routeKeys.add(normalizeEndpoint(r.method, r.normalizedPath))

// UI corpus
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
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.|\.spec\./.test(e.name)) out.push(p)
  }
  return out
}
const corpusFiles = []
for (const d of [
  'packages/ui/src',
  'packages/app-shell/src',
  'apps/web/app',
  'apps/desktop/src',
  'apps/mobile/src',
]) {
  corpusFiles.push(...walk(path.join(ROOT, d)))
}
const corpus = corpusFiles.map((f) => ({
  file: path.relative(ROOT, f).replace(/\\/g, '/'),
  text: fs.readFileSync(f, 'utf8'),
}))
console.log('corpus files', corpus.length)

function mentions(p) {
  const noApi = p.startsWith('/api/') ? p.slice(4) : p
  const variants = [p, noApi]
  for (const v of variants) {
    const esc = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(esc.replace(/:id/g, '(?:\\$\\{[^}]+\\}|:[A-Za-z0-9_]+|[A-Za-z0-9_-]+)'))
    const hit = corpus.find((c) => re.test(c.text))
    if (hit) return hit.file
  }
  return null
}

const INFRA_PREFIX = [
  '/api/admin/',
  '/api/developer/',
  '/api/migrations/',
  '/api/cloud-migration/',
  '/api/debug/',
  '/api/system/',
  '/api/oauth/',
  '/api/cms/',
  '/api/blog/',
  '/api/ingest/',
  '/api/events',
  '/api/updates/',
  '/api/snapshots',
  '/api/marketplace',
  '/api/market',
]
const INFRA_EXACT = new Set(['/mcp', '/odata', '/updates', '/api/odata/:id'])

function classify(r) {
  const p = r.normalizedPath
  const g = r.guards
  if (g.platformAdmin) return 'INFRASTRUCTURE'
  if (INFRA_EXACT.has(p)) return 'INFRASTRUCTURE'
  if (INFRA_PREFIX.some((x) => p.startsWith(x))) return 'INFRASTRUCTURE'
  if (/\/(webhook|cron|health|metrics|sitemap|jobs)(\/|$)/.test(p)) return 'INFRASTRUCTURE'
  if (p.startsWith('/api/public/')) return 'PUBLIC_PAGE_API'
  if (p.includes('${STOREFRONT_PREFIX}')) return 'PUBLIC_PAGE_API'
  if (
    g.isPublic &&
    (p.startsWith('/api/auth/') ||
      p.startsWith('/api/billing/plans') ||
      p.startsWith('/api/updates'))
  )
    return 'PUBLIC_PAGE_API'
  if (g.apiKeyScope) return 'PUBLIC_API'
  if (mentions(p)) return 'UI_VIA_NON_HOOK'
  return 'CUSTOMER_FACING_NO_UI'
}

const counts = {}
const customer = []
for (const r of routes) {
  const key = normalizeEndpoint(r.method, r.normalizedPath)
  const hasHook = hookKeys.has(key)
  const c = classify(r)
  counts[c] = (counts[c] || 0) + 1
  if (c === 'CUSTOMER_FACING_NO_UI')
    customer.push(`${r.method} ${r.normalizedPath} | ${r.file}:${r.line} | hook=${hasHook}`)
}
console.log(counts)
console.log('CUSTOMER_FACING_NO_UI', customer.length)
fs.writeFileSync('scripts/audit/probe/customer-facing.txt', customer.join('\n'))
