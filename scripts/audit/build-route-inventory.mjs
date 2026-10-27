// ============================================
// scripts/audit/build-route-inventory.mjs
//
// Static route analyzer producing the complete backend route inventory:
// method, path, full canonical URL, file:line, guards, service calls,
// database tables/RPCs touched, cache scope, and API-key scope.
// ============================================

import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const rd = (p) => fs.readFileSync(p, 'utf8')
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/')

const walk = (d, o = []) => {
  if (!fs.existsSync(d)) return o
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p, o)
    else if (p.endsWith('.ts') && !p.includes('__tests__')) o.push(p)
  }
  return o
}

// 1. Extract route prefixes from backend/src/index.ts
const indexSrc = rd(path.join(ROOT, 'backend/src/index.ts'))
const pluginPrefixMap = new Map()

// Match: await server.register(accountingRoutes, { prefix: '/api/accounting' })
const regRe = /server\.register\(\s*(\w+)\s*,\s*\{\s*prefix:\s*['"`]([^'"`]+)['"`]/g
let rm
while ((rm = regRe.exec(indexSrc))) {
  pluginPrefixMap.set(rm[1], rm[2])
}

// Also map route file base name to prefix if function name matches
const routeFiles = walk(path.join(ROOT, 'backend/src/routes')).sort()

// 2. Extract API_ROUTE_SCOPES from developer.domain.ts
const devDomainSrc = rd(path.join(ROOT, 'backend/src/services/developer/developer.domain.ts'))
const apiScopes = {}
const scopeRe = /['"`]([A-Z]+)\s+([^'"`]+)['"`]\s*:\s*['"`]([^'"`]+)['"`]/g
let sm
while ((sm = scopeRe.exec(devDomainSrc))) {
  apiScopes[`${sm[1]} ${sm[2]}`] = sm[3]
}

// 3. Map services to source files
const serviceFiles = walk(path.join(ROOT, 'backend/src/services'))
const serviceFileMap = new Map()
for (const sf of serviceFiles) {
  const base = path.basename(sf, '.ts').replace(/\.service$/, '')
  serviceFileMap.set(base, sf)
  const fullBase = path.basename(sf, '.ts')
  serviceFileMap.set(fullBase, sf)
}

function resolveServiceFile(routeFile, importPath) {
  if (!importPath.startsWith('.')) return null
  const abs = path.resolve(path.dirname(routeFile), importPath)
  for (const cand of [abs + '.ts', path.join(abs, 'index.ts'), abs + '.domain.ts']) {
    if (fs.existsSync(cand)) return cand
  }
  return null
}

// Domain classifier by route path and file
function classifyDomain(filePath, routePath) {
  const p = routePath.toLowerCase()
  const f = filePath.toLowerCase()
  if (
    p.includes('accounting') ||
    p.includes('journal') ||
    p.includes('ledger') ||
    p.includes('/accounts') ||
    f.includes('accounting')
  )
    return 'Accounting'
  if (p.includes('invoice-return') || f.includes('invoice-return')) return 'Sales Returns'
  if (p.includes('invoice') || f.includes('invoice')) return 'Sales'
  if (p.includes('order-deposit') || f.includes('order-deposit')) return 'Sales'
  if (p.includes('purchasing') || p.includes('bill') || f.includes('purchasing'))
    return 'Purchasing'
  if (
    p.includes('inventory') ||
    p.includes('stock') ||
    p.includes('warehouse') ||
    p.includes('product') ||
    p.includes('variant') ||
    p.includes('fitment') ||
    p.includes('unit') ||
    f.includes('warehouse') ||
    f.includes('product')
  )
    return 'Inventory'
  if (p.includes('customer') || f.includes('customer')) return 'Customers'
  if (p.includes('supplier') || f.includes('supplier')) return 'Suppliers'
  if (p.includes('payment') || p.includes('installment') || f.includes('payment')) return 'Payments'
  if (p.includes('pos') || p.includes('till') || f.includes('pos')) return 'POS'
  if (
    p.includes('bank') ||
    p.includes('reconcil') ||
    p.includes('finance') ||
    f.includes('finance')
  )
    return 'Banking & Treasury'
  if (p.includes('tax') || f.includes('tax')) return 'Tax'
  if (
    p.includes('hr') ||
    p.includes('employee') ||
    p.includes('attendance') ||
    p.includes('compensation') ||
    f.includes('attendance') ||
    f.includes('human-resources')
  )
    return 'HR & Payroll'
  if (
    p.includes('project') ||
    p.includes('task') ||
    p.includes('time-entr') ||
    p.includes('timesheet') ||
    f.includes('project')
  )
    return 'Projects'
  if (
    p.includes('manufacturing') ||
    p.includes('agriculture') ||
    f.includes('manufacturing') ||
    f.includes('agriculture')
  )
    return 'Manufacturing'
  if (p.includes('ai') || p.includes('intelligence') || p.includes('mcp') || f.includes('ai'))
    return 'AI & Intelligence'
  if (
    p.includes('developer') ||
    p.includes('oauth') ||
    p.includes('sandbox') ||
    p.includes('webhook') ||
    f.includes('developer') ||
    f.includes('oauth')
  )
    return 'Developer Platform'
  if (p.includes('marketplace') || p.includes('market') || f.includes('market'))
    return 'Marketplace'
  if (p.includes('admin') || f.includes('admin')) return 'Admin'
  if (p.includes('sync') || f.includes('sync')) return 'Sync & Offline'
  if (
    p.includes('auth') ||
    p.includes('user') ||
    p.includes('permission') ||
    f.includes('auth') ||
    f.includes('permission')
  )
    return 'Auth & Users'
  if (
    p.includes('workspace') ||
    p.includes('branch') ||
    p.includes('billing') ||
    p.includes('wallet') ||
    f.includes('workspace') ||
    f.includes('branch') ||
    f.includes('billing')
  )
    return 'Workspaces & Billing'
  if (
    p.includes('audit') ||
    p.includes('activity') ||
    p.includes('event') ||
    p.includes('notification') ||
    p.includes('note') ||
    f.includes('audit') ||
    f.includes('activity')
  )
    return 'Audit & Activity'
  if (
    p.includes('report') ||
    p.includes('analytic') ||
    p.includes('saved-view') ||
    f.includes('analytics') ||
    f.includes('report')
  )
    return 'Reporting'
  if (
    p.includes('workflow') ||
    p.includes('automation') ||
    p.includes('escalation') ||
    p.includes('rule') ||
    f.includes('workflow') ||
    f.includes('automation')
  )
    return 'Workflows & Automation'
  return 'General Operations'
}

const inventory = []

for (const rf of routeFiles) {
  const src = rd(rf)
  const relFile = rel(rf)

  // Find plugin function name exported in file
  const fnMatch = src.match(/export\s+async\s+function\s+(\w+Routes)/)
  const pluginName = fnMatch ? fnMatch[1] : null
  const prefix = (pluginName && pluginPrefixMap.get(pluginName)) || ''

  // Build import map
  const imports = new Map()
  for (const m of src.matchAll(/import\s+\{([^}]+)\}\s+from\s+['"`]([^'"`]+)['"`]/g)) {
    for (const item of m[1].split(',')) {
      const parts = item.trim().split(/\s+as\s+/)
      const imported = parts[0]?.trim()
      const local = (parts[1] || parts[0])?.trim()
      if (local) imports.set(local, { imported, from: m[2] })
    }
  }
  for (const m of src.matchAll(/import\s+(\w+)\s+from\s+['"`]([^'"`]+)['"`]/g)) {
    imports.set(m[1], { imported: 'default', from: m[2] })
  }

  // Pre-handler constants
  const consts = {}
  for (const m of src.matchAll(/const\s+(\w+)\s*=\s*\[([^\]]*)\]/g)) {
    consts[m[1]] = m[2]
  }

  const fileHookAuth =
    /addHook\(\s*['"]preHandler['"]/.test(src) || /addHook\(\s*['"]onRequest['"]/.test(src)

  // Route regex: fastify.(get|post|put|patch|delete)('path', ...)
  const routeRe =
    /(?:fastify|server|app|instance)\.(get|post|put|patch|delete)\s*(?:<[^>]*>)?\s*\(\s*(['"`])([^'"`]+)\2/g
  const allRoutePositions = []
  let rm2
  while ((rm2 = routeRe.exec(src))) {
    allRoutePositions.push({ index: rm2.index, method: rm2[1].toUpperCase(), rawPath: rm2[3] })
  }

  const allStarts = [
    ...src.matchAll(
      /(?:fastify|server|app|instance)\.(?:get|post|put|patch|delete)\s*(?:<[^>]*>)?\s*\(/g,
    ),
  ]
    .map((x) => x.index)
    .sort((a, b) => a - b)

  for (let i = 0; i < allRoutePositions.length; i++) {
    const r = allRoutePositions[i]
    const nextStart = allStarts.find((idx) => idx > r.index) ?? src.length
    const block = src.slice(r.index, nextStart)

    // Compute line number
    const line = src.slice(0, r.index).split('\n').length

    // Compute canonical full path
    let fullPath = r.rawPath
    if (
      !fullPath.startsWith('/api') &&
      !fullPath.startsWith('/mcp') &&
      !fullPath.startsWith('/odata') &&
      !fullPath.startsWith('/updates')
    ) {
      if (prefix) {
        fullPath = `${prefix.replace(/\/+$/, '')}/${r.rawPath.replace(/^\/+/, '')}`
      } else {
        fullPath = `/api/${r.rawPath.replace(/^\/+/, '')}`
      }
    }

    // Normalised path with :id for parameters and no trailing slash
    let normalizedPath = fullPath.replace(/:[A-Za-z0-9_]+/g, ':id')
    if (normalizedPath.length > 1 && normalizedPath.endsWith('/')) {
      normalizedPath = normalizedPath.slice(0, -1)
    }

    // Guards extraction
    const pm = block.match(/preHandler\s*:\s*(\[[^\]]*\]|\w+)/)
    const preText = pm ? (pm[1].startsWith('[') ? pm[1] : consts[pm[1]] || pm[1]) : ''

    const hasAuth = /authenticate|apiKeyAuth|authenticateOptional/.test(preText) || fileHookAuth
    const hasWorkspace = /requireWorkspaceContext/.test(preText)
    const hasPlatform = /platformAdminGuard|requireAdmin|adminGuard/.test(preText)
    const hasStepUp = /requireStepUp/.test(preText)

    // Extract capability
    const capMatches = [...preText.matchAll(/requireCapability\(\s*['"`]([^'"`]+)['"`]\s*\)/g)].map(
      (m) => m[1],
    )
    const permMatches = [
      ...preText.matchAll(/requirePermission\(\s*['"`]([^'"`]+)['"`]\s*\)/g),
    ].map((m) => m[1])
    const capabilities = [...new Set([...capMatches, ...permMatches])]

    // Extract role
    const roleMatch =
      preText.match(/requireRole\(\s*['"`]([^'"`]+)['"`]\s*\)/) ||
      block.match(/requireRole\(\s*[^,]+,\s*['"`]([^'"`]+)['"`]\s*\)/)
    const requiredRole = roleMatch ? roleMatch[1] : null

    // Cache scope
    const cacheMatch = preText.match(/cacheMiddleware\(\s*\{[^}]*scope:\s*['"`]([^'"`]+)['"`]/)
    const cacheScope = cacheMatch ? cacheMatch[1] : null

    // API Key Scope
    const apiKeyScope =
      apiScopes[`${r.method} ${fullPath}`] || apiScopes[`${r.method} ${normalizedPath}`] || null

    // Service calls in block
    const servicesFound = new Set()
    for (const callMatch of block.matchAll(/\b([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)\s*\(/g)) {
      const obj = callMatch[1]
      const method = callMatch[2]
      if (
        [
          'request',
          'reply',
          'fastify',
          'server',
          'app',
          'z',
          'Math',
          'JSON',
          'Object',
          'Array',
          'console',
          'Number',
          'String',
          'Date',
          'Promise',
          'logger',
        ].includes(obj)
      ) {
        continue
      }
      if (imports.has(obj)) {
        const imp = imports.get(obj)
        const resolved = resolveServiceFile(rf, imp.from)
        servicesFound.add(
          JSON.stringify({
            symbol: `${obj}.${method}`,
            importedFrom: imp.from,
            file: resolved ? rel(resolved) : null,
            method,
          }),
        )
      } else {
        // Might be instantiated inside or above
        servicesFound.add(
          JSON.stringify({
            symbol: `${obj}.${method}`,
            importedFrom: null,
            file: null,
            method,
          }),
        )
      }
    }

    // Tables and RPCs touched
    const tablesTouched = new Set()
    const rpcsTouched = new Set()
    for (const tm of block.matchAll(/\.from\(\s*['"`]([^'"`]+)['"`]\s*\)/g)) {
      tablesTouched.add(tm[1])
    }
    for (const rm3 of block.matchAll(/\.rpc\(\s*['"`]([^'"`]+)['"`]\s*/g)) {
      rpcsTouched.add(rm3[1])
    }

    const domain = classifyDomain(relFile, fullPath)

    inventory.push({
      id: `${r.method} ${fullPath}`,
      method: r.method,
      rawPath: r.rawPath,
      fullPath,
      normalizedPath,
      file: relFile,
      line,
      domain,
      guards: {
        authenticate: hasAuth,
        workspace: hasWorkspace,
        platformAdmin: hasPlatform,
        stepUp: hasStepUp,
        capabilities,
        requiredRole,
        cacheScope,
        apiKeyScope,
        isPublic: !hasAuth || /publicRoute/.test(preText),
      },
      services: [...servicesFound].map((s) => JSON.parse(s)),
      database: {
        tables: [...tablesTouched],
        rpcs: [...rpcsTouched],
      },
    })
  }
}

// Summary stats
const outDir = path.join(ROOT, 'docs/audit/generated')
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'route-inventory.json'), JSON.stringify(inventory, null, 2))

console.log('--- Route Inventory Summary ---')
console.log('Total routes scanned:', inventory.length)
const byMethod = {}
const byDomain = {}
for (const r of inventory) {
  byMethod[r.method] = (byMethod[r.method] || 0) + 1
  byDomain[r.domain] = (byDomain[r.domain] || 0) + 1
}
console.log('By Method:', byMethod)
console.log(
  'By Domain (Top 10):',
  Object.entries(byDomain)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10),
)
