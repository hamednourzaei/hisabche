import fs from 'node:fs'
import path from 'node:path'

// 1. Load concurrency-safety-map
const concurrencySafetyContent = fs.readFileSync(
  'backend/src/utils/concurrency-safety-map.ts',
  'utf8',
)

// 2. Load reversal-ledger.test.ts
const reversalLedgerContent = fs.existsSync('backend/src/__tests__/reversal-ledger.test.ts')
  ? fs.readFileSync('backend/src/__tests__/reversal-ledger.test.ts', 'utf8')
  : ''

// 3. Load OFFLINE_ENDPOINT_MATRIX
const offlineMatrixContent = fs.readFileSync(
  'packages/validation/src/schemas/offline-endpoint-matrix.ts',
  'utf8',
)

// Audit findings
const findings = []

function checkBackendRoutes() {
  const dir = 'backend/src/routes'
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'))

  for (const f of files) {
    const filePath = path.join(dir, f)
    const content = fs.readFileSync(filePath, 'utf8')
    const lines = content.split('\n')

    // Find all route declarations
    const routeRegex = /fastify\.(post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g
    let m
    while ((m = routeRegex.exec(content)) !== null) {
      const method = m[1].toUpperCase()
      const url = m[2]
      const startIndex = m.index
      const lineNumber = content.slice(0, startIndex).split('\n').length

      // Look at the route definition up to the next route or 80 lines
      const routeSnippet = content.slice(startIndex, startIndex + 3000)
      const handlerMatch = routeSnippet.match(
        /async\s*\(\s*request[^)]*\)\s*=>\s*\{([\s\S]*?)(?=(fastify\.(get|post|put|patch|delete)|\}\s*\)|$))/m,
      )
      const handlerCode = handlerMatch ? handlerMatch[1] : routeSnippet

      // Check 1: UserRole vs Tenancy Role (Rule 1.2)
      if (routeSnippet.includes('request.userRole') || handlerCode.includes('request.userRole')) {
        findings.push({
          type: 'USER_ROLE_VIOLATION',
          file: `backend/src/routes/${f}`,
          line: lineNumber,
          method,
          url,
          detail: 'Route reads userRole from request.userRole instead of request.tenancy.role',
        })
      }

      // Check 2: Missing requireWorkspaceContext on authenticated mutating route
      const hasAuth = routeSnippet.slice(0, 500).includes('authenticate')
      const hasWorkspace =
        routeSnippet.slice(0, 500).includes('requireWorkspaceContext') ||
        routeSnippet.slice(0, 500).includes('requireActiveSubscriptionForWorkspaceParam')
      const isPublicOrAuth =
        url.startsWith('/api/auth') ||
        url.startsWith('/auth') ||
        url.startsWith('/api/public') ||
        f.includes('auth.routes') ||
        f.includes('storefront.routes')

      if (hasAuth && !hasWorkspace && !isPublicOrAuth) {
        findings.push({
          type: 'MISSING_WORKSPACE_CONTEXT',
          file: `backend/src/routes/${f}`,
          line: lineNumber,
          method,
          url,
          detail: 'Authenticated mutating route is missing requireWorkspaceContext preHandler',
        })
      }

      // Check 3: Missing requireCapability on mutating workspace route
      const hasCapability = routeSnippet.slice(0, 500).includes('requireCapability')
      const isDevOrInternal = f.includes('debug') || f.includes('mcp') || f.includes('admin')
      if (hasAuth && hasWorkspace && !hasCapability && !isDevOrInternal && method !== 'GET') {
        // Some routes might do internal scope check, let's flag for review
        if (
          !handlerCode.includes('scopes.assertMay') &&
          !handlerCode.includes('requireCapability')
        ) {
          findings.push({
            type: 'MISSING_CAPABILITY_CHECK',
            file: `backend/src/routes/${f}`,
            line: lineNumber,
            method,
            url,
            detail:
              'Mutating route has requireWorkspaceContext but lacks requireCapability or scopes.assertMay',
          })
        }
      }

      // Check 4: Missing money cache invalidation on money-altering routes
      const touchesMoney =
        url.includes('invoice') ||
        url.includes('payment') ||
        url.includes('wallet') ||
        url.includes('transaction') ||
        url.includes('deposit')
      if (touchesMoney && method !== 'GET') {
        const hasInvalidate =
          handlerCode.includes('invalidateMoneyCaches') ||
          handlerCode.includes('invalidateWorkspaceCache') ||
          handlerCode.includes('invalidate') ||
          handlerCode.includes('clearCache')
        if (!hasInvalidate) {
          findings.push({
            type: 'MISSING_MONEY_CACHE_INVALIDATION',
            file: `backend/src/routes/${f}`,
            line: lineNumber,
            method,
            url,
            detail:
              'Mutating route affects financial entities but does not call invalidateMoneyCaches',
          })
        }
      }

      // Check 5: Idempotency support on creating invoices, payments, transfers, transactions
      const needsIdempotency =
        (url.includes('invoices') ||
          url.includes('payments') ||
          url.includes('transfers') ||
          url.includes('transactions') ||
          url.includes('orders')) &&
        method === 'POST'
      if (needsIdempotency) {
        const hasIdempotency =
          routeSnippet.includes('readClientRequestId') ||
          routeSnippet.includes('idempotencyKey') ||
          handlerCode.includes('readClientRequestId') ||
          handlerCode.includes('clientRequestId') ||
          handlerCode.includes('idempotency')
        if (!hasIdempotency) {
          findings.push({
            type: 'MISSING_IDEMPOTENCY_KEY',
            file: `backend/src/routes/${f}`,
            line: lineNumber,
            method,
            url,
            detail: 'Financial creation route lacks clientRequestId or Idempotency-Key support',
          })
        }
      }

      // Check 6: Direct supabase update/delete with .eq('id', ...) without .eq('workspace_id', ...)
      if (
        handlerCode.includes('.from(') &&
        (handlerCode.includes('.update(') || handlerCode.includes('.delete('))
      ) {
        // Look for patterns like .eq('id', id) where .eq('workspace_id') is missing in the same chain
        const matchUpdate = handlerCode.match(
          /\.from\(['"`]([a-z_]+)['"`]\)[\s\S]*?\.(update|delete)\([\s\S]*?;\s*/g,
        )
        if (matchUpdate) {
          for (const mu of matchUpdate) {
            if (
              mu.includes(".eq('id'") &&
              !mu.includes('workspace_id') &&
              !mu.includes('users') &&
              !mu.includes('workspaces')
            ) {
              findings.push({
                type: 'TENANCY_LEAK_IN_ROUTE_WRITE',
                file: `backend/src/routes/${f}`,
                line: lineNumber,
                method,
                url,
                detail: `Direct table write on id without workspace_id scoping: ${mu.slice(0, 100).replace(/\s+/g, ' ')}`,
              })
            }
          }
        }
      }
    }
  }
}

function checkLocalEngineRoutes() {
  const dir = 'packages/local-engine/src/routes'
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'))

  for (const f of files) {
    const filePath = path.join(dir, f)
    const content = fs.readFileSync(filePath, 'utf8')

    const routeRegex = /router\.(post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g
    let m
    while ((m = routeRegex.exec(content)) !== null) {
      const method = m[1].toUpperCase()
      const url = m[2]
      const startIndex = m.index
      const lineNumber = content.slice(0, startIndex).split('\n').length
      const routeSnippet = content.slice(startIndex, startIndex + 2500)

      // Check 1: Does local mutating route write to db without queuing to sync_queue?
      // When a user writes offline, changes MUST be queued to sync_queue so they reach server upon reconnect!
      const hasDbWrite =
        routeSnippet.includes('db.insert') ||
        routeSnippet.includes('db.update') ||
        routeSnippet.includes('db.upsert') ||
        routeSnippet.includes('db.remove') ||
        routeSnippet.includes('db.exec')
      const hasQueue =
        routeSnippet.includes('queue') ||
        routeSnippet.includes('sync_queue') ||
        routeSnippet.includes('enqueue') ||
        routeSnippet.includes('addQueue')

      // If it writes to local SQLite tables, does it queue for sync?
      if (
        hasDbWrite &&
        !hasQueue &&
        !f.includes('backup') &&
        !f.includes('import') &&
        !url.includes('session')
      ) {
        findings.push({
          type: 'OFFLINE_UNSYNCED_MUTATION',
          file: `packages/local-engine/src/routes/${f}`,
          line: lineNumber,
          method,
          url,
          detail: 'Local route mutates SQLite database directly without enqueuing to sync_queue',
        })
      }

      // Check 2: Missing workspaceId filter in local db queries
      if (routeSnippet.includes('db.query') || routeSnippet.includes('db.first')) {
        if (
          !routeSnippet.includes('workspaceId') &&
          !routeSnippet.includes('workspace_id') &&
          !f.includes('me.ts') &&
          !f.includes('workspace.ts')
        ) {
          findings.push({
            type: 'OFFLINE_TENANCY_MISSING',
            file: `packages/local-engine/src/routes/${f}`,
            line: lineNumber,
            method,
            url,
            detail: 'Local query does not scope by workspaceId',
          })
        }
      }
    }
  }
}

checkBackendRoutes()
checkLocalEngineRoutes()

console.log(`Total Findings: ${findings.length}`)
const grouped = {}
for (const item of findings) {
  grouped[item.type] = (grouped[item.type] || 0) + 1
}
console.log('Grouped by type:', JSON.stringify(grouped, null, 2))
fs.writeFileSync('scripts/audit-findings-raw.json', JSON.stringify(findings, null, 2))
console.log('Saved to scripts/audit-findings-raw.json')
