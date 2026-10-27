// scripts/audit/join-matrix.mjs
// Read-only master matrix generator joining:
//   backend route -> service/domain -> data/tables -> hook -> UI surfaces -> tests -> offline matrix
// Outputs:
//   docs/product-intelligence/ROUTE-DOMAIN-HOOK-UI-MASTER-MATRIX.csv
//   docs/audit/generated/master-matrix-summary.json
//
// Vocabulary (defined once in docs/product-intelligence/MATRIX-METHOD.md):
//   STATICALLY_CONNECTED  hook resolves to the route AND at least one UI file imports the hook
//   RUNTIME_VERIFIED      the same chain plus a test recorded in flow-evidence.json ran and passed
//   HOOK_NO_UI_CONSUMER   hook resolves to a route, zero importing component
//   HOOK_NO_ROUTE         hook URL matches no registered route and is not a client utility
//   ROUTE_NO_HOOK         route with no hook
// "ORPHAN" is retired as an unqualified word.

import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const OUT_DIR = path.join(ROOT, 'docs/product-intelligence')
const GEN_DIR = path.join(ROOT, 'docs/audit/generated')
fs.mkdirSync(OUT_DIR, { recursive: true })
fs.mkdirSync(GEN_DIR, { recursive: true })

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))

// 1. Load inputs
const routes = readJson(path.join(GEN_DIR, 'route-inventory.json'))
const hooks = readJson(path.join(GEN_DIR, 'hook-inventory.json'))
const uiInv = readJson(path.join(GEN_DIR, 'ui-inventory.json'))

// Runtime evidence is produced by scripts/audit/probe/record-flow-evidence.mjs.
// Absent file means nothing in this session was executed -> nothing is RUNTIME_VERIFIED.
const evidencePath = path.join(GEN_DIR, 'flow-evidence.json')
const flowEvidence = fs.existsSync(evidencePath) ? readJson(evidencePath) : { routes: {} }

// 2. Load Offline Endpoint Matrix
const offlineMatrixSrc = fs.readFileSync(
  path.join(ROOT, 'packages/validation/src/schemas/offline-endpoint-matrix.ts'),
  'utf8',
)
const offlineMap = new Map() // "METHOD /path" -> { feature, status }
const matrixRe = /'(GET|POST|PUT|PATCH|DELETE)\s+([^']+)':\s*\[\s*'([^']*)',\s*'([^']*)'\s*\]/g
let mm
while ((mm = matrixRe.exec(offlineMatrixSrc))) {
  const p = mm[2].replace(/:x/g, ':id')
  offlineMap.set(`${mm[1]} ${p}`, { feature: mm[3], status: mm[4] })
}

// 3. Pre-index test files
const SKIP_DIRS = new Set([
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
    if (SKIP_DIRS.has(e.name)) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(test|spec)\.(ts|tsx|js|mjs)$/.test(e.name)) out.push(p)
  }
  return out
}

const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/')
const testFiles = [
  ...walk(path.join(ROOT, 'backend/src/__tests__')),
  ...walk(path.join(ROOT, 'packages')),
  ...walk(path.join(ROOT, 'apps')),
]

console.log(`Pre-indexing ${testFiles.length} test files...`)
const testContents = []
for (const tf of testFiles) {
  testContents.push({
    file: rel(tf),
    content: fs.readFileSync(tf, 'utf8'),
    isPg: /\.pg\.test\./.test(tf),
    isHttp: /\.inject\(|supertest|buildApp|createServer\(/.test(tf),
  })
}

// 4. Map hooks by normalized endpoint and by name
const hooksByEndpoint = new Map() // "METHOD /path" -> hook[]
const hookUsageByName = new Map()
for (const hu of uiInv.hookUsage) hookUsageByName.set(hu.name, hu)

// Path alias normalizer for minor singular/plural or prefix discrepancies
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

for (const h of hooks) {
  if (!h.canonicalUrl) continue
  const key = normalizeEndpoint(h.method, h.canonicalUrl)
  if (!key) continue
  if (!hooksByEndpoint.has(key)) hooksByEndpoint.set(key, [])
  hooksByEndpoint.get(key).push(h)
}

// 5. UI corpus for direct-call detection (UI_VIA_NON_HOOK) and re-export following
const UI_DIRS = [
  'packages/ui/src',
  'packages/app-shell/src',
  'apps/web/app',
  'apps/desktop/src',
  'apps/mobile/src',
]
const walkCode = (dir, out = []) => {
  if (!fs.existsSync(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walkCode(p, out)
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.(test|spec)\./.test(e.name)) out.push(p)
  }
  return out
}
const corpus = []
for (const d of UI_DIRS) {
  for (const f of walkCode(path.join(ROOT, d))) {
    corpus.push({ file: rel(f), text: fs.readFileSync(f, 'utf8') })
  }
}
console.log(`UI corpus: ${corpus.length} non-test files`)

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
function directUiCaller(routePath) {
  const noApi = routePath.startsWith('/api/') ? routePath.slice(4) : routePath
  for (const variant of [routePath, noApi]) {
    const pattern = escapeRe(variant).replace(
      /:id/g,
      '(?:\\$\\{[^}]+\\}|:[A-Za-z0-9_]+|[A-Za-z0-9_-]+)',
    )
    const re = new RegExp(pattern)
    const hit = corpus.find((c) => re.test(c.text))
    if (hit) return hit.file
  }
  return null
}

// 6. route_class — computed from path prefix, guards and registries.
const INFRA_PREFIXES = [
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
const INFRA_SEGMENT = /\/(webhook|webhooks|cron|health|metrics|sitemap|jobs)(\/|$)/
const PUBLIC_PAGE_EXACT = ['/api/auth/', '/api/billing/plans', '/api/updates']
const PUBLIC_PAGE_PREFIXES = ['/api/blog/', '/api/cms/']

function classifyRoute(r) {
  const p = r.normalizedPath
  const g = r.guards
  if (g.platformAdmin) return 'INFRASTRUCTURE'
  if (INFRA_EXACT.has(p)) return 'INFRASTRUCTURE'
  if (INFRA_PREFIXES.some((x) => p.startsWith(x))) return 'INFRASTRUCTURE'
  if (INFRA_SEGMENT.test(p)) return 'INFRASTRUCTURE'
  if (p.startsWith('/api/public/')) return 'PUBLIC_PAGE_API'
  if (p.includes('${STOREFRONT_PREFIX}')) return 'PUBLIC_PAGE_API'
  if (PUBLIC_PAGE_PREFIXES.some((x) => p.startsWith(x))) return 'PUBLIC_PAGE_API'
  if (g.isPublic && PUBLIC_PAGE_EXACT.some((x) => p.startsWith(x))) return 'PUBLIC_PAGE_API'
  if (g.apiKeyScope) return 'PUBLIC_API'
  if (directUiCaller(p)) return 'UI_VIA_NON_HOOK'
  return 'CUSTOMER_FACING_NO_UI'
}

// 7. Build Joined Matrix Rows
const matrixRows = []
const matchedHookNames = new Set()
const matchedRouteIds = new Set()

for (const r of routes) {
  const routeKey = normalizeEndpoint(r.method, r.normalizedPath)
  const matchedHooks = [...(hooksByEndpoint.get(routeKey) || [])]

  if (matchedHooks.length === 0) {
    const altKey = r.normalizedPath.startsWith('/api/')
      ? `${r.method} ${r.normalizedPath.replace('/api/', '/')}`
      : `${r.method} /api${r.normalizedPath}`
    const altHooks = hooksByEndpoint.get(altKey)
    if (altHooks) matchedHooks.push(...altHooks)
  }

  let offlineInfo = offlineMap.get(`${r.method} ${r.normalizedPath}`)
  if (!offlineInfo) offlineInfo = offlineMap.get(routeKey)
  const offlineStatus = offlineInfo ? offlineInfo.status : 'NOT_IN_MATRIX'
  const offlineFeature = offlineInfo ? offlineInfo.feature : ''

  const uiSurfaces = new Set()
  const uiFiles = new Set()
  const hookNames = []
  const hookFiles = []
  let totalUiConsumers = 0

  for (const h of matchedHooks) {
    hookNames.push(h.name)
    hookFiles.push(`${h.file}:${h.line}`)
    matchedHookNames.add(h.name)
    matchedRouteIds.add(h.name)

    const usage = hookUsageByName.get(h.name)
    if (usage) {
      totalUiConsumers += usage.totalConsumerFiles
      for (const s of usage.webSurfaces) uiSurfaces.add(`web:${s}`)
      for (const s of usage.shellSurfaces) uiSurfaces.add(`shell:${s}`)
      for (const f of usage.directCallingFiles) uiFiles.add(f)
    }
  }

  // Tests referencing this route
  const matchingTests = []
  const routeSearchStr = r.rawPath.length > 3 ? r.rawPath : r.normalizedPath
  const svcSymbols = r.services.map((s) => s.symbol).filter(Boolean)

  for (const tc of testContents) {
    let hit = tc.content.includes(routeSearchStr) || tc.content.includes(r.normalizedPath)
    if (!hit) {
      for (const sym of svcSymbols) {
        if (tc.content.includes(sym)) {
          hit = true
          break
        }
      }
    }
    if (hit) matchingTests.push(tc.file)
  }

  const hasHook = matchedHooks.length > 0
  const hasUi = totalUiConsumers > 0 || uiSurfaces.size > 0
  const routeClass = classifyRoute(r)
  const runtime =
    flowEvidence.routes[r.id] ??
    flowEvidence.routes[`${r.method} ${r.normalizedPath.replace(/\/+$/, '')}`]

  let connectionStatus = 'UNKNOWN'
  let evidenceLevel = 'NONE'
  let riskLevel = 'LOW'
  const riskNotes = []

  if (hasHook && hasUi) {
    if (runtime && runtime.passed === true) {
      connectionStatus = 'RUNTIME_VERIFIED'
      evidenceLevel = 'RUNTIME'
    } else {
      connectionStatus = 'STATICALLY_CONNECTED'
      evidenceLevel = 'STATIC'
    }
    const isGuarded =
      r.guards.authenticate && (r.guards.workspace || r.guards.platformAdmin || r.guards.isPublic)
    if (!isGuarded) {
      riskLevel = 'HIGH'
      riskNotes.push('Weak guards (missing workspace or auth guard on a tenant route)')
    } else if (matchingTests.length === 0) {
      riskLevel = 'MEDIUM'
      riskNotes.push('Lacks direct automated tests')
    }
  } else if (hasHook && !hasUi) {
    connectionStatus = 'HOOK_NO_UI_CONSUMER'
    riskLevel = r.method === 'GET' ? 'LOW' : 'MEDIUM'
    riskNotes.push('Hook resolves to this route; no UI file imports the hook')
  } else {
    connectionStatus = 'ROUTE_NO_HOOK'
    if (
      routeClass === 'INFRASTRUCTURE' ||
      routeClass === 'PUBLIC_API' ||
      routeClass === 'PUBLIC_PAGE_API'
    ) {
      riskLevel = 'LOW'
      riskNotes.push(`No hook by design (route_class=${routeClass})`)
    } else if (routeClass === 'UI_VIA_NON_HOOK') {
      riskLevel = 'LOW'
      riskNotes.push('Called directly from a UI package, no hook wrapper')
    } else {
      riskLevel = r.method === 'GET' ? 'LOW' : 'MEDIUM'
      riskNotes.push('Customer-facing route with no hook and no direct UI caller')
    }
  }

  matrixRows.push({
    Route_ID: r.id,
    Method: r.method,
    Route_Path: r.normalizedPath,
    Route_File: `${r.file}:${r.line}`,
    Domain: r.domain,
    Route_Class: routeClass,
    Services: r.services.map((s) => s.symbol).join('; ') || 'none',
    Tables: r.database.tables.join('; ') || 'none',
    Auth_Guarded: r.guards.authenticate ? 'YES' : 'NO',
    Workspace_Guarded: r.guards.workspace ? 'YES' : 'NO',
    Capabilities: r.guards.capabilities.join('; ') || 'none',
    Required_Role: r.guards.requiredRole || 'none',
    Cache_Scope: r.guards.cacheScope || 'none',
    Offline_Status: offlineStatus,
    Offline_Feature: offlineFeature,
    Hook_Name: hookNames.join('; ') || 'none',
    Hook_File: hookFiles.join('; ') || 'none',
    Hook_Count: hookNames.length,
    UI_Consumers_Count: totalUiConsumers,
    UI_Surfaces: Array.from(uiSurfaces).join('; ') || 'none',
    UI_Files: Array.from(uiFiles).slice(0, 5).join('; ') || 'none',
    Test_Files_Count: matchingTests.length,
    Test_References: matchingTests.slice(0, 3).join('; ') || 'none',
    Connection_Status: connectionStatus,
    Evidence_Level: evidenceLevel,
    Risk_Level: riskLevel,
    Notes: riskNotes.join('; ') || 'Fully connected and guarded',
  })
}

// 8. Hook accounting — one class per hook entry, no unaccounted remainder.
const nameCounts = new Map()
for (const h of hooks) nameCounts.set(h.name, (nameCounts.get(h.name) || 0) + 1)

// A duplicated hook name has exactly one "primary" definition: the one the
// package index re-exports under its bare name. The other entry is a second
// definition of the same symbol and is accounted for separately.
const indexSrc = fs.readFileSync(path.join(ROOT, 'packages/api/src/index.ts'), 'utf8')
const bareExportFile = new Map()
for (const block of indexSrc.matchAll(/export\s*\{([\s\S]*?)\}\s*from\s*'([^']+)'/g)) {
  const from = block[2].replace('./hooks/', 'packages/api/src/hooks/')
  const body = block[1].replace(/\/\/[^\n]*/g, '')
  for (const part of body.split(',')) {
    const bare = part
      .trim()
      .split(/\s+as\s+/)[0]
      .trim()
    if (bare && !bare.startsWith('type ') && !bareExportFile.has(bare)) {
      bareExportFile.set(bare, from)
    }
  }
}

const primaryByName = new Map()
for (const h of hooks) {
  const prev = primaryByName.get(h.name)
  const exportedFrom = bareExportFile.get(h.name)
  if (!prev) primaryByName.set(h.name, h)
  else if (exportedFrom && rel(h.file).startsWith(exportedFrom)) primaryByName.set(h.name, h)
  else if (!exportedFrom && rel(h.file) < rel(prev.file)) primaryByName.set(h.name, h)
}

const duplicateNames = []
const duplicateDetails = []
const hookClasses = new Map() // hook entry -> class
const hookNoUiConsumer = []
const hookNoRoute = []

for (const h of hooks) {
  const usage = hookUsageByName.get(h.name)
  const consumers = usage ? usage.totalConsumerFiles : 0
  const resolves = matchedHookNames.has(h.name)
  let cls

  if ((nameCounts.get(h.name) || 0) > 1 && primaryByName.get(h.name) !== h) {
    cls = 'HOOK_DUPLICATE_NAME'
    if (!duplicateNames.includes(h.name)) duplicateNames.push(h.name)
    duplicateDetails.push({
      name: h.name,
      primary: `${rel(primaryByName.get(h.name).file)}:${primaryByName.get(h.name).line}`,
      duplicate: `${rel(h.file)}:${h.line}`,
      exportedAs: bareExportFile.get(h.name) ? 'PRIMARY_EXPORTED_BARE' : 'PRIMARY_NOT_IN_INDEX',
    })
  } else if (resolves) {
    cls = 'HOOK_CONNECTED_TO_ROUTE'
    if (consumers === 0) {
      hookNoUiConsumer.push({
        name: h.name,
        file: `${rel(h.file)}:${h.line}`,
        route: h.canonicalUrl || null,
        method: h.method || 'GET',
      })
    }
  } else if (!h.canonicalUrl && consumers > 0) {
    cls = 'HOOK_UTILITY_WITHOUT_ROUTE'
  } else if (h.canonicalUrl && consumers > 0) {
    cls = 'HOOK_NO_ROUTE_UNRESOLVED'
    hookNoRoute.push({ name: h.name, file: `${rel(h.file)}:${h.line}`, url: h.canonicalUrl })
  } else {
    cls = 'HOOK_NO_ROUTE_NO_CONSUMER'
    hookNoRoute.push({ name: h.name, file: `${rel(h.file)}:${h.line}`, url: h.canonicalUrl })
  }
  hookClasses.set(h, cls)
}

// Sub-classify every HOOK_NO_UI_CONSUMER: dynamically called, test-only, dead candidate.
const allSourceTexts = []
for (const dir of ['packages/api/src', ...UI_DIRS]) {
  for (const f of walkCode(path.join(ROOT, dir))) {
    allSourceTexts.push({ file: rel(f), text: fs.readFileSync(f, 'utf8') })
  }
}
const testTexts = testContents.map((t) => ({ file: t.file, text: t.content }))

function classifyNoConsumerHook(entry) {
  const ownFile = entry.file.split(':')[0]
  const callRe = new RegExp(`\\b${entry.name}\\s*\\(`)
  const importRe = new RegExp(`\\b${entry.name}\\b`)

  const indirect = allSourceTexts.find(
    (s) =>
      s.file !== ownFile &&
      s.file !== 'packages/api/src/index.ts' &&
      callRe.test(s.text) &&
      !/\.test\./.test(s.file),
  )
  if (indirect) return { cls: 'CALLED_DYNAMICALLY_OR_INDIRECT', evidence: indirect.file }

  // A wrapper hook that imports it and calls it through a variable is still an
  // indirect call; the barrel (index.ts) is a re-export, not a caller.
  const importedByHook = allSourceTexts.find(
    (s) =>
      s.file !== ownFile &&
      s.file !== 'packages/api/src/index.ts' &&
      s.file.startsWith('packages/api/src') &&
      importRe.test(s.text),
  )
  if (importedByHook)
    return { cls: 'CALLED_DYNAMICALLY_OR_INDIRECT', evidence: importedByHook.file }

  const testOnly = testTexts.find((s) => importRe.test(s.text))
  if (testOnly) return { cls: 'TEST_ONLY', evidence: testOnly.file }

  return { cls: 'DEAD_CANDIDATE', evidence: '' }
}

for (const entry of hookNoUiConsumer) {
  Object.assign(entry, classifyNoConsumerHook(entry))
}

// 9. Hook-only rows (hooks that matched no route) stay in the CSV.
const unattachedHooks = hooks.filter((h) => !matchedHookNames.has(h.name))
for (const uh of unattachedHooks) {
  const usage = hookUsageByName.get(uh.name)
  const consumerCount = usage ? usage.totalConsumerFiles : 0
  const cls = hookClasses.get(uh)

  let status = 'HOOK_NO_ROUTE_NO_CONSUMER'
  let risk = 'LOW'
  let note = 'Hook matches no registered route and no UI file imports it'

  if (cls === 'HOOK_UTILITY_WITHOUT_ROUTE') {
    status = 'CLIENT_UTILITY_ACTIVE'
    note = `Client-only utility hook used by ${consumerCount} UI consumers (no HTTP endpoint by design)`
  } else if (cls === 'HOOK_NO_ROUTE_UNRESOLVED') {
    status = 'HOOK_NO_ROUTE_UNRESOLVED'
    risk = 'HIGH'
    note = `UI files import this hook (${consumerCount}), but no route matches ${uh.canonicalUrl}`
  } else if (cls === 'HOOK_DUPLICATE_NAME') {
    status = 'HOOK_DUPLICATE_NAME'
    note = 'Second definition of a hook name; the package index exports the primary'
  }

  matrixRows.push({
    Route_ID: `HOOK:${uh.name}`,
    Method: uh.method || 'GET',
    Route_Path: uh.canonicalUrl || 'none',
    Route_File: 'none',
    Domain: 'Client-Only',
    Route_Class: 'CLIENT_ONLY',
    Services: 'none',
    Tables: 'none',
    Auth_Guarded: 'N/A',
    Workspace_Guarded: 'N/A',
    Capabilities: 'none',
    Required_Role: 'none',
    Cache_Scope: 'none',
    Offline_Status: uh.offline?.status || 'NOT_IN_MATRIX',
    Offline_Feature: uh.offline?.feature || '',
    Hook_Name: uh.name,
    Hook_File: `${rel(uh.file)}:${uh.line}`,
    Hook_Count: 1,
    UI_Consumers_Count: consumerCount,
    UI_Surfaces: usage
      ? [
          ...usage.webSurfaces.map((s) => `web:${s}`),
          ...usage.shellSurfaces.map((s) => `shell:${s}`),
        ].join('; ') || 'none'
      : 'none',
    UI_Files: usage ? usage.directCallingFiles.slice(0, 5).join('; ') || 'none' : 'none',
    Test_Files_Count: 0,
    Test_References: 'none',
    Connection_Status: status,
    Evidence_Level: 'NONE',
    Risk_Level: risk,
    Notes: note,
  })
}

// 10. Write Master Matrix CSV
const csvHeaders = [
  'Route_ID',
  'Method',
  'Route_Path',
  'Route_File',
  'Domain',
  'Route_Class',
  'Services',
  'Tables',
  'Auth_Guarded',
  'Workspace_Guarded',
  'Capabilities',
  'Required_Role',
  'Cache_Scope',
  'Offline_Status',
  'Offline_Feature',
  'Hook_Name',
  'Hook_File',
  'UI_Consumers_Count',
  'UI_Surfaces',
  'UI_Files',
  'Test_Files_Count',
  'Test_References',
  'Connection_Status',
  'Evidence_Level',
  'Risk_Level',
  'Notes',
]

function escapeCsv(val) {
  if (val === null || val === undefined) return '""'
  const str = String(val)
  return `"${str.replace(/"/g, '""')}"`
}

const csvLines = [
  csvHeaders.join(','),
  ...matrixRows.map((r) => csvHeaders.map((h) => escapeCsv(r[h])).join(',')),
]
const csvPath = path.join(OUT_DIR, 'ROUTE-DOMAIN-HOOK-UI-MASTER-MATRIX.csv')
fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf8')

// 11. Summary statistics
const summary = {
  generatedBy: 'scripts/audit/join-matrix.mjs',
  totalRows: matrixRows.length,
  backendRoutesCount: routes.length,
  frontendHooksCount: hooks.length,
  statusCounts: {},
  routeClassCounts: {},
  routeNoHookClassCounts: {},
  domainCounts: {},
  riskCounts: {},
  offlineCounts: {},
  evidenceCounts: {},
  hookClassCounts: {},
  hookNoUiConsumerClasses: {},
  duplicateHookNames: duplicateNames,
  duplicateHookDetails: duplicateDetails,
  customerFacingNoUi: [],
  hookNoUiConsumer: [],
  hookNoRoute: [],
}

for (const r of matrixRows) {
  summary.statusCounts[r.Connection_Status] = (summary.statusCounts[r.Connection_Status] || 0) + 1
  summary.domainCounts[r.Domain] = (summary.domainCounts[r.Domain] || 0) + 1
  summary.riskCounts[r.Risk_Level] = (summary.riskCounts[r.Risk_Level] || 0) + 1
  summary.offlineCounts[r.Offline_Status] = (summary.offlineCounts[r.Offline_Status] || 0) + 1
  summary.evidenceCounts[r.Evidence_Level] = (summary.evidenceCounts[r.Evidence_Level] || 0) + 1
  summary.routeClassCounts[r.Route_Class] = (summary.routeClassCounts[r.Route_Class] || 0) + 1
  if (r.Connection_Status === 'ROUTE_NO_HOOK') {
    summary.routeNoHookClassCounts[r.Route_Class] =
      (summary.routeNoHookClassCounts[r.Route_Class] || 0) + 1
  }
  if (r.Connection_Status === 'ROUTE_NO_HOOK' && r.Route_Class === 'CUSTOMER_FACING_NO_UI') {
    summary.customerFacingNoUi.push({
      id: r.Route_ID,
      method: r.Method,
      path: r.Route_Path,
      file: r.Route_File,
      domain: r.Domain,
      tables: r.Tables,
      capabilities: r.Capabilities,
    })
  }
}

for (const [, cls] of hookClasses) {
  summary.hookClassCounts[cls] = (summary.hookClassCounts[cls] || 0) + 1
}
for (const entry of hookNoUiConsumer) {
  summary.hookNoUiConsumerClasses[entry.cls] = (summary.hookNoUiConsumerClasses[entry.cls] || 0) + 1
}
summary.hookNoUiConsumer = hookNoUiConsumer
summary.hookNoRoute = hookNoRoute

fs.writeFileSync(path.join(GEN_DIR, 'master-matrix-summary.json'), JSON.stringify(summary, null, 2))

console.log('Master Matrix generated.')
console.log(
  `- Rows: ${matrixRows.length} (routes: ${routes.length}, hook-only: ${unattachedHooks.length})`,
)
console.log('Status:', summary.statusCounts)
console.log('route_class (all rows):', summary.routeClassCounts)
console.log('route_class (ROUTE_NO_HOOK only):', summary.routeNoHookClassCounts)
console.log('hook classes:', summary.hookClassCounts)
console.log('hook without UI consumer:', summary.hookNoUiConsumerClasses)
console.log('evidence:', summary.evidenceCounts)
console.log(`CSV: ${rel(csvPath)}`)
