/**
 * Canonical Domain, Platform & Architectural Layer Classifier for Hisabche Code Intelligence
 * Shared across full rebuilds and incremental updates so metadata is never lost.
 */

export const DOMAIN_KEYWORDS = {
  Invoices: ['invoice', 'invoices', 'proforma', 'sale-order', 'sales-order'],
  POS: ['pos', 'point-of-sale', 'till', 'cashier', 'receipt'],
  Inventory: [
    'inventory',
    'stock',
    'product',
    'products',
    'variant',
    'variants',
    'sku',
    'costing',
    'batch',
    'serial',
  ],
  Warehouse: ['warehouse', 'storage_place', 'storage-bin', 'shelf', 'bin'],
  Customers: ['customer', 'customers', 'crm', 'contact', 'party'],
  Suppliers: ['supplier', 'suppliers', 'vendor', 'purchasing', 'purchase', 'rfq'],
  Payments: [
    'payment',
    'payments',
    'receivable',
    'payable',
    'collection',
    'allocation',
    'advance',
    'deposit',
  ],
  Accounting: [
    'accounting',
    'ledger',
    'journal',
    'trial-balance',
    'chart-of-accounts',
    'fiscal',
    'exchange',
  ],
  Auth: ['auth', 'login', 'session', 'rbac', 'tenancy', 'permission', 'capability', '2fa', 'totp'],
  Sync: ['sync', 'outbox', 'local-engine', 'sqlite', 'partition', 'conflict', 'cursor'],
  HR: ['employee', 'employees', 'attendance', 'payroll', 'shift', 'leave'],
  Infrastructure: ['fencing', 'replica', 'nginx', 'storage-adapter', 'ha-', 'health', 'admin'],
  Industries: ['industry', 'business-profile', 'operational-dna', 'sellable'],
}

export function normalizePath(p) {
  return (p || '').replace(/\\/g, '/')
}

/**
 * Classifies a file into { domain, platform, layer } deterministically from its path and snippet.
 */
export function classifyFileDomainAndPlatform(filePath, content = '') {
  const norm = normalizePath(filePath).toLowerCase()

  // Platform classification
  let platform = 'SHARED'
  if (norm.startsWith('apps/web/')) platform = 'WEB_ONLY'
  else if (norm.startsWith('apps/desktop/')) platform = 'WINDOWS_ONLY'
  else if (norm.startsWith('apps/mobile/')) platform = 'MOBILE_ONLY'
  else if (norm.startsWith('apps/admin/')) platform = 'ADMIN_ONLY'
  else if (norm.startsWith('backend/')) platform = 'SERVER_ONLY'
  else if (norm.startsWith('packages/local-engine/') || norm.startsWith('packages/sync/')) {
    platform = 'OFFLINE_ENGINE'
  } else if (norm.startsWith('packages/app-bridge/')) {
    platform = 'PLATFORM_ADAPTER'
  }

  // Layer classification
  let layer = 'other'
  if (/\.(test|spec)\.(ts|tsx|js|jsx|mjs)$/.test(norm) || norm.includes('/__tests__/')) {
    layer = 'test'
  } else if (norm.includes('.routes.') || norm.includes('/routes/')) {
    layer = 'route'
  } else if (norm.includes('.service.') || norm.includes('/services/')) {
    layer = 'service'
  } else if (
    norm.includes('.domain.') ||
    norm.includes('/schemas/') ||
    norm.startsWith('packages/validation/')
  ) {
    layer = 'validation'
  } else if (norm.startsWith('packages/api/') || norm.includes('/hooks/')) {
    layer = 'hook'
  } else if (
    norm.startsWith('packages/ui/') ||
    norm.startsWith('apps/web/app/') ||
    norm.startsWith('packages/app-shell/') ||
    norm.endsWith('.tsx')
  ) {
    layer = 'ui'
  } else if (norm.includes('/db/') || norm.endsWith('.sql')) {
    layer = 'db'
  } else if (norm.startsWith('packages/local-engine/') || norm.startsWith('packages/sync/')) {
    layer = 'sync'
  }

  // Domain classification
  const haystack = `${norm} ${content.slice(0, 1200).toLowerCase()}`
  let matchedDomain = 'SHARED'
  let bestHits = 0
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    let hits = 0
    for (const kw of keywords) {
      if (norm.includes(kw)) hits += 3
      else if (haystack.includes(kw)) hits += 1
    }
    if (hits > bestHits) {
      bestHits = hits
      matchedDomain = domain
    }
  }

  return { domain: matchedDomain, platform, layer }
}
