// ============================================
// packages/ui/src/lib/entity-route.ts
//
// H6 — one entity type in, one route out.
//
// ---------------------------------------------------------------------------
// WHY THIS IS A MODULE AND NOT AN `if/else` AT EACH CALL SITE
//
// Several screens hold an `entity_type` and an `entity_id` and need to send
// someone to the record: the audit table, the activity feed, the notification
// bell, the conflict list, the migration report. Each one that writes its own
// mapping is a place that can disagree with the others about where an invoice
// lives — and `notification-bell.tsx` had exactly such a copy, which is how it
// went on pointing at `/human-resources/:id` after G1 moved that route.
//
// ---------------------------------------------------------------------------
// TWO CALLERS, TWO FALLBACK RULES — and both are right
//
// A NOTIFICATION must always go somewhere. The person tapped it; leaving them
// on the same screen reads as a broken app, so an unknown type lands on the
// activity feed and a missing id lands on the entity's LIST.
//
// An AUDIT ROW must not pretend. Rendering a link that silently goes nowhere
// useful is worse than plain text, because the user believes they have seen
// the record.
//
// So the MAPPING lives here once and the FALLBACK is the caller's choice:
// `routeForEntity` returns null when it cannot answer exactly, and
// `routeForEntityOrList` always answers.
// ============================================

/**
 * Where each entity type lives.
 *
 * `detail` is the record's own screen; `list` is where to land without an id,
 * or when the type has no detail screen at all.
 *
 * Paths are the CANONICAL ones after G1's route consolidation. Desktop mirrors
 * them exactly, so one string works on both renderers.
 */
const ROUTES: Record<string, { list: string; detail?: (id: string) => string }> = {
  invoice: { list: '/invoices', detail: (id) => `/invoices/${id}` },

  // A payment has no screen of its own — it is read on the invoice it settled.
  // The list is the honest destination rather than a detail route that 404s.
  payment: { list: '/invoices?filter=pending' },

  customer: { list: '/customers', detail: (id) => `/customers/${id}` },
  supplier: { list: '/customers', detail: (id) => `/customers/${id}` },
  party: { list: '/customers', detail: (id) => `/customers/${id}` },

  product: { list: '/warehouse', detail: (id) => `/warehouse/${id}` },
  inventory: { list: '/warehouse', detail: (id) => `/warehouse/${id}` },

  employee: { list: '/team-and-payroll', detail: (id) => `/team-and-payroll/${id}` },
  branch: { list: '/team-and-payroll?tab=branches' },

  journal_entry: { list: '/accounting' },
  purchase_order: { list: '/purchasing' },
  workspace: { list: '/settings' },

  workflow_instance: { list: '/approvals' },
  workflow: { list: '/approvals' },

  opportunity: { list: '/crm' },
  interaction: { list: '/crm' },

  // The projects module was removed. Historical notifications still name these
  // types, so they point at the activity log rather than a dead route.
  project: { list: '/activities' },
  task: { list: '/activities' },
}

/** Where a caller with nothing better to do should send someone. */
const DEFAULT_FALLBACK = '/activities'

/**
 * The exact route for this record, or `null` when there is not one.
 *
 * Returns null for an unknown type, a missing id, or a type with no detail
 * screen. Callers that must not fabricate a destination — the audit table —
 * use this and render text when it is null.
 */
export function routeForEntity(entityType: string, entityId: string): string | null {
  const entry = ROUTES[entityType]
  if (!entry || !entityId || !entry.detail) return null
  return entry.detail(entityId)
}

/**
 * A route that always exists: the record if possible, its list if not, and the
 * activity feed for a type nothing knows about.
 *
 * For callers where landing somewhere beats landing nowhere — a notification
 * the user has already tapped.
 */
export function routeForEntityOrList(
  entityType: string,
  entityId?: string | null,
  fallback: string = DEFAULT_FALLBACK,
): string {
  const entry = ROUTES[entityType]
  if (!entry) return fallback
  if (entityId && entry.detail) return entry.detail(entityId)
  return entry.list
}

/** Whether this entity type has a detail screen worth linking to. */
export function hasRouteForEntity(entityType: string): boolean {
  return Boolean(ROUTES[entityType]?.detail)
}
