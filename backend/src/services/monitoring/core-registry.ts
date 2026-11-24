// ============================================
// backend/src/services/monitoring/core-registry.ts
//
// THE one typed registry of Hisabche's business cores (mission §5.2).
//
// Every core below is extracted from a service that actually exists in
// backend/src/services — the `owner` field names it. A core is NOT a new
// module: it is the observability identity of an existing one.
//
// ATTRIBUTION RULE (no double counting)
//   A route template belongs to exactly ONE core: the longest matching
//   prefix wins. `coreForRoute` is total — a template no prefix claims
//   lands in `platform` with operation group `other`, and the guard test
//   treats an unexpected `other` as a registry gap, never as silence.
//
// CARDINALITY RULE
//   Operation groups are a CLOSED enum (read/create/update/delete/action).
//   No dynamic labels, no per-entity metrics, no ids. The metric key space
//   is cores × groups × instances × minutes — bounded by construction.
//
// This module imports NOTHING (constants live where cycles cannot reach —
// CLAUDE.md «ثابتِ مشترک را از یک سرویس نگیر»).
// ============================================

export const CORE_GROUPS = [
  'identity',
  'commerce',
  'finance',
  'operations',
  'people',
  'industry',
  'sync',
  'intelligence',
  'platform',
] as const
export type CoreGroup = (typeof CORE_GROUPS)[number]

/** Fixed duration histogram: <50, <100, <250, <500, <1000, >=1000 ms. */
export const DURATION_BUCKETS_MS = [50, 100, 250, 500, 1000] as const

/** Index into the six-slot histogram. */
export function bucketIndex(durationMs: number): number {
  for (let index = 0; index < DURATION_BUCKETS_MS.length; index += 1) {
    if (durationMs < DURATION_BUCKETS_MS[index]!) return index
  }
  return DURATION_BUCKETS_MS.length
}

export const OPERATION_GROUPS = ['read', 'create', 'update', 'delete', 'action', 'other'] as const
export type OperationGroup = (typeof OPERATION_GROUPS)[number]

/**
 * The closed verb set that turns a POST into `action` instead of `create`.
 * Every verb here was extracted from a POST route that actually exists in
 * backend/src/routes (854 declared templates, 21 Nov 2026). Resource nouns
 * (`invoices`, `customers`, …) are deliberately absent: creating a resource
 * is `create`. A new verb is a registry edit, never a new label at runtime.
 */
export const ACTION_VERBS: ReadonlySet<string> = new Set([
  'accept',
  'accept-invite',
  'accept-quote',
  'accrue',
  'action',
  'activate',
  'activate-seat',
  'adjust',
  'answer',
  'apply',
  'apply-profile',
  'approve',
  'archive',
  'ask',
  'assign',
  'authorize',
  'bank-transfer',
  'bill',
  'book',
  'budget-check',
  'cancel',
  'check',
  'choose',
  'claim',
  'cleanup',
  'close',
  'commit',
  'complete',
  'confirm',
  'connect',
  'consume',
  'cut',
  'decide',
  'deliver',
  'disable',
  'dispose',
  'dry-run',
  'emit',
  'enable',
  'enroll',
  'evaluate',
  'exchange',
  'expire',
  'explain',
  'export-csv',
  'forgot-password',
  'fulfill',
  'grant',
  'hold',
  'inspect',
  'issue',
  'launch',
  'lease',
  'lease-return',
  'lift',
  'log',
  'login',
  'logout',
  'melt-scrap',
  'merge',
  'month-end',
  'move',
  'place',
  'plan-issue',
  'post',
  'post-to-ledger',
  'post-unposted',
  'preview',
  'process',
  'produce',
  'progress-cod',
  'provision',
  'publish',
  'push',
  'quality-check',
  'query',
  'quote',
  'read',
  'recall',
  'receive',
  'reconcile',
  'recover',
  'refresh',
  'refund',
  'reimburse',
  'reject',
  'release',
  'release-expired',
  'replay',
  'report',
  'request',
  'reset',
  'reset-password',
  'resolve',
  'resolve-review',
  'restore',
  'resume',
  'retry',
  'return',
  'revalue',
  'reverse',
  'revise',
  'revoke',
  'rollback',
  'rotate-secret',
  'run',
  'seed',
  'settle',
  'settle-cod',
  'signup',
  'step-up',
  'submit',
  'suspend',
  'terminate',
  'test',
  'tier1-report',
  'tier2-report',
  'transition',
  'translate',
  'trigger',
  'uninstall',
  'unmatch',
  'unsubscribe',
  'update',
  'upgrade',
  'validate-manifest',
  'value',
  'verify',
  'verify-payment',
  'void',
  'why-not',
])

export interface CoreSlo {
  /** P95 latency target in ms — the latency component normalizes against this. */
  p95TargetMs: number
  /** Error budget: 5xx percent above this saturates the error component. */
  errorBudgetPercent: number
  /** Queue capacity when the core has a measurable queue; absent = no queue. */
  queueCapacity?: number | undefined
}

export interface CoreDefinition {
  id: string
  group: CoreGroup
  /** The real service directory/file that owns this core's operations. */
  owner: string
  /** Route-template prefixes this core owns (longest match wins). */
  prefixes: readonly string[]
  slo: CoreSlo
}

const DEFAULT_SLO: CoreSlo = { p95TargetMs: 800, errorBudgetPercent: 1 }
const WRITE_SLO: CoreSlo = { p95TargetMs: 1500, errorBudgetPercent: 1 }
const HEAVY_SLO: CoreSlo = { p95TargetMs: 3000, errorBudgetPercent: 2 }

/**
 * The cores. `owner` is a real path under backend/src — the registry is a
 * map of the architecture, not a wish list. Prefixes are Fastify route
 * templates (registration prefix applied), never raw URLs.
 */
export const CORES: readonly CoreDefinition[] = [
  {
    id: 'auth',
    group: 'identity',
    owner: 'services/auth',
    prefixes: ['/api/auth'],
    slo: { p95TargetMs: 600, errorBudgetPercent: 0.5 },
  },
  {
    id: 'tenancy',
    group: 'identity',
    owner: 'services/workspace.service.ts + tenancy.service.ts + branch',
    prefixes: ['/api/workspaces', '/api/workspace', '/api/branches', '/api/me', '/api/workplace'],
    slo: DEFAULT_SLO,
  },
  {
    id: 'permissions',
    group: 'identity',
    owner: 'services/permission.service.ts + authorization',
    prefixes: [
      '/api/permissions',
      '/api/roles',
      '/api/users',
      '/api/governance',
      '/api/personalization',
    ],
    slo: DEFAULT_SLO,
  },
  {
    id: 'sales',
    group: 'commerce',
    owner: 'services/invoice.service.ts + sales + orders + order-deposit',
    prefixes: [
      '/api/invoices',
      '/api/orders',
      '/api/advances',
      '/api/late-fees',
      '/api/storefront',
      '/api/public/invoices',
      '/api/public/portal',
      '/api/customer-portal-links',
    ],
    slo: WRITE_SLO,
  },
  {
    id: 'payments',
    group: 'commerce',
    owner: 'services/payments',
    prefixes: ['/api/payments', '/api/webhooks'],
    slo: WRITE_SLO,
  },
  {
    id: 'pos',
    group: 'commerce',
    owner: 'services/pos',
    prefixes: ['/api/pos'],
    slo: WRITE_SLO,
  },
  {
    id: 'crm',
    group: 'commerce',
    owner: 'services/customer.service.ts + crm + customer-profile',
    prefixes: [
      '/api/customers',
      '/api/crm',
      '/api/interactions',
      '/api/opportunities',
      '/api/public/feedback',
    ],
    slo: DEFAULT_SLO,
  },
  {
    id: 'purchasing',
    group: 'commerce',
    owner: 'services/purchasing.service.ts + supplier',
    prefixes: [
      '/api/purchase-orders',
      '/api/purchase-contracts',
      '/api/quotations',
      '/api/rfqs',
      '/api/suppliers',
    ],
    slo: WRITE_SLO,
  },
  {
    id: 'pricing',
    group: 'commerce',
    owner: 'services/pricing + promotions + price-lists',
    prefixes: ['/api/promotions', '/api/price-lists'],
    slo: DEFAULT_SLO,
  },
  {
    id: 'accounting',
    group: 'finance',
    owner: 'services/accounting (ledger.postDocument / profit-report)',
    prefixes: ['/api/accounting', '/api/operations/budgets'],
    slo: WRITE_SLO,
  },
  {
    id: 'tax',
    group: 'finance',
    owner: 'services/tax',
    prefixes: ['/api/tax'],
    slo: DEFAULT_SLO,
  },
  {
    id: 'costing',
    group: 'finance',
    owner: 'services/inventory-costing',
    prefixes: [
      '/api/inventory/layers',
      '/api/inventory/valuation',
      '/api/inventory/cost-preview',
      '/api/inventory/cost-trail',
      '/api/inventory/unvalued',
      '/api/inventory/settings',
    ],
    slo: HEAVY_SLO,
  },
  {
    id: 'finance',
    group: 'finance',
    owner: 'services/banking + financing + exchange + currency',
    prefixes: ['/api/finance', '/api/fx', '/api/transactions', '/api/financing', '/api/currencies'],
    slo: WRITE_SLO,
  },
  {
    id: 'inventory',
    group: 'operations',
    owner: 'services/warehouse.service.ts + inventory + product.service.ts',
    prefixes: [
      '/api/inventory',
      '/api/warehouses',
      '/api/products',
      '/api/stock-transfers',
      '/api/transfer-requests',
      '/api/storage-locations',
      '/api/cycle-counts',
      '/api/units',
      '/api/custom-fields',
      '/api/operations/batches',
      '/api/operations/expiry',
      '/api/operations/lot-trail',
      '/api/operations/serials',
    ],
    slo: WRITE_SLO,
  },
  {
    id: 'manufacturing',
    group: 'industry',
    owner: 'services/manufacturing.service.ts + roll-cutting',
    prefixes: ['/api/manufacturing', '/api/boms', '/api/work-orders', '/api/rolls'],
    slo: HEAVY_SLO,
  },
  {
    id: 'service-delivery',
    group: 'industry',
    owner: 'services/service-delivery + repair + salon',
    prefixes: [
      '/api/service-delivery',
      '/api/repair-tickets',
      '/api/resource-bookings',
      '/api/service-catalog',
      '/api/service-resources',
      '/api/provider-commissions',
      '/api/appointments',
    ],
    slo: WRITE_SLO,
  },
  {
    id: 'projects',
    group: 'operations',
    owner: 'services/project.service.ts',
    prefixes: ['/api/projects', '/api/tasks', '/api/time-entries', '/api/public/tasks'],
    slo: DEFAULT_SLO,
  },
  {
    id: 'hr',
    group: 'people',
    owner: 'services/human-resources.service.ts + payroll + attendance',
    prefixes: [
      '/api/employees',
      '/api/departments',
      '/api/payrolls',
      '/api/leaves',
      '/api/leave-policies',
      '/api/expense-claims',
      '/api/attendance',
      '/api/attendance-sheet',
      '/api/attendance-devices',
      '/api/public/attendance-devices',
      '/api/attendance-links',
      '/api/attendance-submissions',
      '/api/shifts',
      '/api/shift-assignments',
      '/api/hr',
      '/api/compensation',
      '/api/public/attendance',
      '/api/operations/timesheets',
    ],
    slo: WRITE_SLO,
  },
  {
    id: 'sync',
    group: 'sync',
    owner: 'services/sync.service.ts + sync-stream + conflict',
    prefixes: ['/api/sync', '/api/conflicts'],
    slo: { p95TargetMs: 2000, errorBudgetPercent: 2 },
  },
  {
    id: 'offline',
    group: 'sync',
    owner: 'services/offline-license.service.ts + cloud-migration',
    prefixes: ['/api/public/offline', '/api/cloud-migration'],
    slo: HEAVY_SLO,
  },
  {
    id: 'reporting',
    group: 'intelligence',
    owner: 'services/analytics.service.ts + analysis + reporting',
    prefixes: [
      '/api/analytics',
      '/api/analysis',
      '/api/custom-reports',
      '/api/report-dashboards',
      '/api/odata',
      '/api/intelligence',
    ],
    slo: HEAVY_SLO,
  },
  {
    id: 'ai',
    group: 'intelligence',
    owner: 'services/ai.service.ts + ai/pipeline + mcp + ingest',
    prefixes: ['/api/ai', '/api/ai-requests', '/api/ingest', '/mcp'],
    slo: { p95TargetMs: 8000, errorBudgetPercent: 5 },
  },
  {
    id: 'notifications',
    group: 'platform',
    owner: 'services/notification.service.ts + email-outbox + messaging + campaigns',
    prefixes: ['/api/notifications', '/api/campaigns', '/api/v1/activities', '/v1/activities'],
    slo: DEFAULT_SLO,
  },
  {
    id: 'jobs',
    group: 'platform',
    owner: 'scheduler + services/distributed-work.ts + automation + workflow',
    prefixes: [
      '/api/automations',
      '/api/rules',
      '/api/v1/workflows',
      '/api/v1/escalations',
      '/api/events',
    ],
    slo: { p95TargetMs: 2000, errorBudgetPercent: 2, queueCapacity: 100 },
  },
  {
    id: 'verticals',
    group: 'industry',
    owner: 'services/contracts + quality + transport + agriculture + exchange (gold/metal)',
    prefixes: [
      '/api/contracts',
      '/api/quality-events',
      '/api/warranty-claims',
      '/api/warranties',
      '/api/agriculture',
      '/api/deliveries',
      '/api/transport',
      '/api/gold',
      '/api/metal-rates',
      '/api/vehicles',
    ],
    slo: WRITE_SLO,
  },
  {
    id: 'platform',
    group: 'platform',
    owner: 'services/admin + billing + package-credits + developer + oauth + market + cms + blog',
    prefixes: [
      '/api/admin',
      '/api/billing',
      '/api/package-credits',
      '/api/wallet',
      '/api/developer',
      '/api/oauth',
      '/api/marketplace',
      '/api/market',
      '/api/public/market',
      '/api/blog',
      '/api/cms',
      '/api/public/cms',
      '/api/referrals',
      '/api/updates',
      '/api/debug',
      '/api/audit',
      '/api/snapshots',
      '/api/migrations',
      '/api/saved-views',
      '/api/notes',
      '/api/system',
      '/api/wall',
      '/api/v1',
      '/v1/entities',
      '/metrics',
      '/health',
      '/api/health',
      '/live',
      '/ready',
      '/docs',
    ],
    slo: DEFAULT_SLO,
  },
] as const

export type CoreId = (typeof CORES)[number]['id']

const BY_ID = new Map<string, CoreDefinition>(CORES.map((core) => [core.id, core]))

/** Longest prefixes first — the specificity order that makes ownership unique. */
const PREFIX_ORDER: ReadonlyArray<{ prefix: string; core: CoreDefinition }> = CORES.flatMap(
  (core) => core.prefixes.map((prefix) => ({ prefix, core })),
).sort((a, b) => b.prefix.length - a.prefix.length)

export function coreById(id: string): CoreDefinition | null {
  return BY_ID.get(id) ?? null
}

/**
 * The ONE attribution function. Total and deterministic: longest claimed
 * prefix wins; an unclaimed template is `platform` (the API surface itself),
 * which the guard test audits so «other» never hides a missing core.
 */
export function coreForRoute(routeTemplate: string): CoreDefinition {
  for (const { prefix, core } of PREFIX_ORDER) {
    if (routeTemplate === prefix || routeTemplate.startsWith(prefix + '/')) return core
  }
  return BY_ID.get('platform')!
}

/** Bounded operation group — method plus the closed action-verb set. */
export function operationGroupFor(method: string, routeTemplate: string): OperationGroup {
  const upper = method.toUpperCase()
  if (upper === 'GET' || upper === 'HEAD' || upper === 'OPTIONS') return 'read'
  if (upper === 'DELETE') return 'delete'
  if (upper === 'PUT' || upper === 'PATCH') return 'update'
  if (upper === 'POST') {
    const segments = routeTemplate.split('/').filter(Boolean)
    const last = segments[segments.length - 1] ?? ''
    // A param tail (`/:id`) means the verb sits before it.
    const verb = last.startsWith(':') ? (segments[segments.length - 2] ?? '') : last
    return ACTION_VERBS.has(verb) ? 'action' : 'create'
  }
  return 'other'
}

// ─── Pressure formula contract (pressure-v1) ────────────────────────────────
// Documented in docs/admin/UNIFIED-CORE-MONITORING-ARCHITECTURE.md. Weights
// renormalize over the components that are actually measured; a core with no
// measurable component is UNKNOWN, never «healthy at 0».

export const PRESSURE_FORMULA_VERSION = 'pressure-v1'

export const PRESSURE_WEIGHTS = {
  latency: 0.35,
  errors: 0.3,
  queue: 0.15,
  retryTimeout: 0.1,
  dependencyWait: 0.1,
} as const

export const PRESSURE_THRESHOLDS = {
  /** Below this: healthy. */
  warning: 40,
  /** At or above this: critical. Between: warning. */
  critical: 70,
} as const

export type CoreStatus = 'healthy' | 'warning' | 'critical' | 'unknown'
