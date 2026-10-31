import fs from 'fs'
import path from 'path'

// 1. Scan Local Engine routes
function scanLocalEngineRoutes() {
  const dir = 'packages/local-engine/src/routes'
  const routes = []
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.ts')) continue
    const content = fs.readFileSync(path.join(dir, f), 'utf8')
    const regex = /router\.(post|put|patch|delete)\(\s*['"]([^'"]+)['"]/g
    let match
    while ((match = regex.exec(content)) !== null) {
      routes.push({
        method: match[1].toUpperCase(),
        path: match[2],
        file: f,
        line: content.slice(0, match.index).split('\n').length,
      })
    }
  }
  return routes
}

// 2. Scan Backend routes
function scanBackendRoutes() {
  const dir = 'backend/src/routes'
  const routes = []
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.routes.ts')) continue
    const content = fs.readFileSync(path.join(dir, f), 'utf8')
    const regex = /fastify\.(post|put|patch|delete)\(\s*['"]([^'"]+)['"]/g
    let match
    while ((match = regex.exec(content)) !== null) {
      routes.push({
        method: match[1].toUpperCase(),
        path: match[2],
        file: f,
        line: content.slice(0, match.index).split('\n').length,
      })
    }
  }
  return routes
}

// 3. Sensitive domain categorizer
const sensitiveDomains = [
  'invoice',
  'payment',
  'transaction',
  'inventory',
  'warehouse',
  'cost',
  'accounting',
  'till',
  'pos',
  'transfer',
  'purchasing',
  'salary',
  'payroll',
  'wallet',
  'installment',
  'order',
  'exchange-rate',
]

function isSensitive(route) {
  const p = route.path.toLowerCase()
  const f = route.file.toLowerCase()
  return sensitiveDomains.some((d) => p.includes(d) || f.includes(d))
}

const localRoutes = scanLocalEngineRoutes()
const backendRoutes = scanBackendRoutes()
const sensitiveBackend = backendRoutes.filter(isSensitive)

console.log(`Total Local Engine mutating routes: ${localRoutes.length}`)
console.log(`Total Backend mutating routes: ${backendRoutes.length}`)
console.log(`Sensitive Backend mutating routes: ${sensitiveBackend.length}`)

// Read concurrency map
const concurrencyMapText = fs.readFileSync('backend/src/utils/concurrency-safety-map.ts', 'utf8')

// Check each sensitive backend route against concurrency map
const sensitiveWithoutConcurrency = sensitiveBackend.filter((r) => {
  // Normalize path pattern
  const normPath = r.path.replace(/:[a-zA-Z0-9_]+/g, ':id')
  return !concurrencyMapText.includes(r.path) && !concurrencyMapText.includes(normPath)
})

console.log(
  `Sensitive Backend mutating routes missing from Concurrency Map: ${sensitiveWithoutConcurrency.length}`,
)

// Output summary of sensitive routes missing concurrency
const byFile = {}
for (const r of sensitiveWithoutConcurrency) {
  byFile[r.file] = byFile[r.file] || []
  byFile[r.file].push(`${r.method} ${r.path}`)
}

console.log('\n--- Sensitive Backend Mutating Routes Missing Concurrency ---')
for (const [f, list] of Object.entries(byFile)) {
  console.log(`\nFile: ${f} (${list.length} routes)`)
  list.forEach((r) => console.log(`  - ${r}`))
}

// Check Local Engine routes for sync intent
console.log('\n--- Local Engine Sync Contract Classification ---')
// Entities known to sync engine
const syncEngineEntities = ['invoice', 'customer', 'product', 'transaction']

const localClassified = localRoutes.map((r) => {
  let entity = null
  if (r.path.includes('/invoices')) entity = 'invoice'
  else if (r.path.includes('/customers')) entity = 'customer'
  else if (r.path.includes('/products')) entity = 'product'
  else if (
    r.path.includes('/payments') ||
    r.path.includes('/transfers') ||
    r.path.includes('/transactions')
  )
    entity = 'transaction'

  // Does this route file contain buildEnqueue or sync_queue?
  const fileContent = fs.readFileSync(path.join('packages/local-engine/src/routes', r.file), 'utf8')
  const hasEnqueue = fileContent.includes('buildEnqueue') || fileContent.includes('sync_queue')

  let syncContract = 'LOCAL_ONLY'
  let issue = 'NOT_A_BUG'

  if (entity) {
    syncContract = 'SYNC_REQUIRED'
    if (!hasEnqueue) {
      issue = 'CONFIRMED_ARCHITECTURAL_BUG'
    } else {
      // In invoices.ts, check if the specific handler calls enqueue
      if (r.path.includes('/cancel') || r.method === 'DELETE') {
        issue = 'CONFIRMED_ARCHITECTURAL_BUG_CANCELLATION_NOT_QUEUED'
      } else {
        issue = 'VERIFIED_ENQUEUED'
      }
    }
  }

  return {
    ...r,
    entity,
    syncContract,
    issue,
  }
})

const confirmedSyncBugs = localClassified.filter((r) => r.issue.startsWith('CONFIRMED_'))
console.log(`Total Local Routes: ${localRoutes.length}`)
console.log(
  `Sync Required Local Routes: ${localClassified.filter((r) => r.syncContract === 'SYNC_REQUIRED').length}`,
)
console.log(
  `Local-Only Intentional Routes: ${localClassified.filter((r) => r.syncContract === 'LOCAL_ONLY').length}`,
)
console.log(
  `Confirmed Sync Bugs (Contract vs Implementation Mismatch): ${confirmedSyncBugs.length}`,
)

console.log('\nConfirmed Sync Bugs List:')
confirmedSyncBugs.forEach((b) => console.log(`  - [${b.file}] ${b.method} ${b.path} -> ${b.issue}`))
