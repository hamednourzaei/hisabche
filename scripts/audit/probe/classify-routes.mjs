// scripts/audit/probe/classify-routes.mjs
import fs from 'node:fs'

const routes = JSON.parse(fs.readFileSync('docs/audit/generated/route-inventory.json', 'utf8'))
const hooks = JSON.parse(fs.readFileSync('docs/audit/generated/hook-inventory.json', 'utf8'))

// Map hooks by endpoint
const hookEndpoints = new Set()
for (const h of hooks) {
  if (h.canonicalUrl) hookEndpoints.add(`${h.method} ${h.canonicalUrl}`)
}

const directNonHookPaths = new Set([
  'GET /api/public/tasks/:id',
  'POST /api/public/tasks/:id/status',
  'POST /api/public/tasks/:id/customer-outcome',
  'GET /api/public/portal/:id',
  'GET /api/public/invoices/:id',
  'GET /api/invoices/:id/pdf',
  'GET /api/public/attendance/:id',
  'POST /api/public/attendance/:id/phone',
  'GET /api/auth/validate',
  'POST /api/auth/refresh',
  'POST /api/auth/logout',
  'GET /api/workspaces',
  'POST /api/public/offline/licence-key',
  'GET /api/auth/profile',
  'GET /api/sync/cursor',
  'POST /api/sync/push',
  'POST /api/workspaces/accept-invite',
  'POST /api/auth/forgot-password',
  'POST /api/auth/reset-password',
  'GET /api/health',
  'GET /api/version',
])

const classCounts = {
  INFRASTRUCTURE: 0,
  PUBLIC_API: 0,
  PUBLIC_PAGE_API: 0,
  UI_VIA_NON_HOOK: 0,
  CUSTOMER_FACING_NO_UI: 0,
}

const customerFacingNoUi = []

for (const r of routes) {
  const normKey = `${r.method} ${r.normalizedPath}`
  const hasHook = hookEndpoints.has(normKey)
  if (hasHook) continue // already has a hook

  let routeClass = 'CUSTOMER_FACING_NO_UI'

  const isPublicPage =
    r.normalizedPath.includes('/public/') ||
    r.normalizedPath.includes('/portal/') ||
    r.normalizedPath.includes('/attendance-self/') ||
    r.file.includes('public-')

  const isInfra =
    r.guards.platformAdmin ||
    r.file.includes('admin') ||
    r.file.includes('internal') ||
    r.fullPath.includes('/admin/') ||
    r.fullPath.includes('/health') ||
    r.fullPath.includes('/cron') ||
    r.fullPath.includes('/webhook') ||
    r.fullPath.includes('/oauth') ||
    r.fullPath.includes('/mcp') ||
    r.fullPath.includes('/developer/webhooks') ||
    r.fullPath.includes('/cloud-migration')

  const isPublicApi = !isInfra && (r.guards.apiKeyScope !== null || r.file.includes('developer'))

  const isNonHookUi =
    directNonHookPaths.has(normKey) ||
    directNonHookPaths.has(`${r.method} ${r.fullPath}`) ||
    r.normalizedPath.includes('/pdf')

  if (isNonHookUi) {
    routeClass = 'UI_VIA_NON_HOOK'
  } else if (isPublicPage) {
    routeClass = 'PUBLIC_PAGE_API'
  } else if (isInfra) {
    routeClass = 'INFRASTRUCTURE'
  } else if (isPublicApi) {
    routeClass = 'PUBLIC_API'
  } else {
    routeClass = 'CUSTOMER_FACING_NO_UI'
    customerFacingNoUi.push(r)
  }

  classCounts[routeClass]++
}

console.log('--- Classification of routes without hooks ---')
console.log(classCounts)
console.log(
  'Total without hooks:',
  Object.values(classCounts).reduce((a, b) => a + b, 0),
)
console.log('\n--- Customer Facing No UI Candidate Gaps Count:', customerFacingNoUi.length)
customerFacingNoUi.forEach((r) => console.log(`- ${r.id} (${r.domain}) in ${r.file}`))
