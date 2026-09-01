// ============================================
// backend/src/services/authorization/authorization.domain.ts
//
// Who may do what, see which records, and read which fields — as pure data
// and pure functions.
//
// ---------------------------------------------------------------------------
// THREE SEPARATE QUESTIONS
//
//   CAPABILITY      may this role perform this operation at all?
//   RECORD-LEVEL    which rows of that entity may this actor touch?
//   FIELD-LEVEL     which columns of those rows may they read or write?
//
// They are separate because the answers differ. A seller may read invoices
// (capability), only their own (record), and not the buy price on them
// (field). Collapsing any two of these into one check is how "he can open the
// invoice list" quietly became "he can see the shop's margins".
//
// ---------------------------------------------------------------------------
// NOT THE SAME THING AS UI VISIBILITY
//
// Nothing here is affected by what a user has hidden in their interface.
// Hiding is a preference; this is authorization. The order is always
// authorization first, visibility second — never the reverse.
//
// ---------------------------------------------------------------------------
// ON THE ROLE NAMES
//
// The workspace roles are owner / manager / seller, defined by
// tenancy.service.ts and stored in `workspace_members`. `packages/auth-core`
// carries a DIFFERENT set (owner / admin / member / viewer) used by the client
// for display. They are not the same vocabulary, and the server's is the one
// that decides anything.
// ============================================

export type WorkspaceRole = 'owner' | 'manager' | 'seller'

export const ROLE_RANK: Record<WorkspaceRole, number> = {
  owner: 3,
  manager: 2,
  seller: 1,
}

export function roleAtLeast(role: WorkspaceRole, minimum: WorkspaceRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum]
}

// ─── Capabilities ────────────────────────────────────────────────────────────

export const CAPABILITIES = [
  // The books
  'ledger.read',
  'ledger.post',
  'ledger.reverse',
  'ledger.lock_period',
  'account.manage',
  // Money
  'payment.read',
  'payment.record',
  'payment.cancel',
  // Stock and its cost
  'inventory.read',
  'inventory.cost.read',
  'inventory.configure',
  // Documents
  'invoice.read',
  'invoice.create',
  'invoice.update',
  'invoice.delete',
  // Parties and catalogue
  'customer.read',
  'customer.write',
  'product.read',
  'product.write',
  // Reporting
  'report.operational.read',
  'report.financial.read',
  // Bringing an existing business in
  'data.import',
  // The workspace itself
  'member.manage',
  'workspace.manage',
] as const

export type Capability = (typeof CAPABILITIES)[number]

/**
 * The lowest role that holds each capability.
 *
 * The shape of a shop, not an abstraction: a seller rings up sales and takes
 * money; a manager runs the books day to day; only the owner closes a period,
 * reverses a posted entry, changes how stock is costed, or deletes anything.
 * Each of those last four rewrites what has already been reported.
 */
const MIN_ROLE: Record<Capability, WorkspaceRole> = {
  'ledger.read': 'manager',
  'ledger.post': 'manager',
  'ledger.reverse': 'owner',
  'ledger.lock_period': 'owner',
  'account.manage': 'manager',

  'payment.read': 'seller',
  'payment.record': 'seller',
  'payment.cancel': 'manager',

  'inventory.read': 'seller',
  // The cost of stock is the shop's margin. A seller sells at the sell price
  // and has no reason to know what it was bought for.
  'inventory.cost.read': 'manager',
  'inventory.configure': 'owner',

  'invoice.read': 'seller',
  'invoice.create': 'seller',
  'invoice.update': 'seller',
  'invoice.delete': 'owner',

  'customer.read': 'seller',
  'customer.write': 'seller',
  'product.read': 'seller',
  'product.write': 'manager',

  'report.operational.read': 'seller',
  'report.financial.read': 'manager',

  // An import creates thousands of rows with opening balances in one act. A
  // seller creates customers one at a time at a counter; this is a different
  // operation with a different blast radius.
  'data.import': 'manager',

  'member.manage': 'owner',
  'workspace.manage': 'owner',
}

/**
 * The lowest role that holds this capability.
 *
 * Exposed so a refusal can be explained as "a manager can do this" rather than
 * as `MISSING_CAPABILITY` — nobody outside this codebase knows what
 * `ledger.post` is, and a name they cannot act on is not an explanation.
 */
export function minRoleFor(capability: Capability): WorkspaceRole {
  return MIN_ROLE[capability]
}

export function can(role: WorkspaceRole, capability: Capability): boolean {
  return roleAtLeast(role, MIN_ROLE[capability])
}

export function capabilitiesOf(role: WorkspaceRole): Capability[] {
  return CAPABILITIES.filter((capability) => can(role, capability))
}

// ─── Record-level ────────────────────────────────────────────────────────────

export type RecordScope =
  /** Every row in the workspace. */
  | { kind: 'all' }
  /** Only rows this actor created. */
  | { kind: 'own'; userId: string }
  /** No rows at all — the capability is absent. */
  | { kind: 'none' }

export type ScopedEntity = 'invoice' | 'payment' | 'customer' | 'product' | 'journal_entry'

/**
 * Which rows of an entity an actor may see.
 *
 * A seller sees the invoices and payments they handled, not their colleagues'.
 * Customers and products are shared reference data — a shop with one shared
 * catalogue where each seller saw a different half of it would be unusable.
 *
 * The scope is returned rather than applied here: the caller turns it into a
 * WHERE clause, and it must be composed with the workspace filter, never
 * instead of it. `{ kind: 'all' }` means all rows IN THIS WORKSPACE.
 */
export function recordScope(
  role: WorkspaceRole,
  entity: ScopedEntity,
  userId: string,
): RecordScope {
  if (roleAtLeast(role, 'manager')) return { kind: 'all' }

  switch (entity) {
    case 'invoice':
    case 'payment':
      return { kind: 'own', userId }
    case 'customer':
    case 'product':
      return { kind: 'all' }
    case 'journal_entry':
      // A seller has no ledger.read capability at all.
      return { kind: 'none' }
  }
}

/** Whether one already-loaded row is within the actor's scope. */
export function mayTouchRecord(scope: RecordScope, row: { userId?: string | null }): boolean {
  if (scope.kind === 'none') return false
  if (scope.kind === 'all') return true
  return row.userId === scope.userId
}

// ─── Field-level ─────────────────────────────────────────────────────────────

export type FieldMode = 'read' | 'write'

/**
 * Fields that are NOT visible or writable below a given role.
 *
 * Everything not named here is open to anyone who holds the entity's
 * capability — a deny list, deliberately: a new column must be considered
 * before it is restricted, but a new column is never accidentally SECRET when
 * a screen forgets to ask for it.
 *
 * The costs are the interesting case. `buyPrice`, `unitCost`, `costOfGoodsSold`
 * and `grossProfit` are the shop's margin. A seller reading a product row got
 * all four of them before this existed.
 */
const RESTRICTED_FIELDS: Record<
  string,
  Array<{ field: string; minRole: WorkspaceRole; mode: FieldMode }>
> = {
  product: [
    { field: 'buyPrice', minRole: 'manager', mode: 'read' },
    { field: 'buy_price', minRole: 'manager', mode: 'read' },
    { field: 'sellPrice', minRole: 'manager', mode: 'write' },
    { field: 'sell_price', minRole: 'manager', mode: 'write' },
  ],
  invoice: [
    { field: 'costOfGoodsSold', minRole: 'manager', mode: 'read' },
    { field: 'grossProfit', minRole: 'manager', mode: 'read' },
    { field: 'margin', minRole: 'manager', mode: 'read' },
  ],
  invoice_item: [
    { field: 'unitCost', minRole: 'manager', mode: 'read' },
    { field: 'unit_cost', minRole: 'manager', mode: 'read' },
  ],
  cost_layer: [
    { field: 'unitCost', minRole: 'manager', mode: 'read' },
    { field: 'unit_cost', minRole: 'manager', mode: 'read' },
  ],
  customer: [
    { field: 'openingBalance', minRole: 'manager', mode: 'write' },
    { field: 'opening_balance', minRole: 'manager', mode: 'write' },
  ],
}

/** The field names of `entity` this role may not use in this mode. */
export function deniedFields(role: WorkspaceRole, entity: string, mode: FieldMode): string[] {
  const rules = RESTRICTED_FIELDS[entity] ?? []
  return rules
    .filter((rule) => rule.mode === mode && !roleAtLeast(role, rule.minRole))
    .map((rule) => rule.field)
}

/**
 * A copy of `row` with the fields this role may not read removed.
 *
 * REMOVED, not blanked: a null in a price field reads as "this product has no
 * buy price", which is a different and wrong statement. An absent key is
 * absent.
 */
export function maskForRead<T extends Record<string, unknown>>(
  role: WorkspaceRole,
  entity: string,
  row: T,
): Partial<T> {
  const denied = new Set(deniedFields(role, entity, 'read'))
  if (denied.size === 0) return row

  const masked: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    if (!denied.has(key)) masked[key] = value
  }
  return masked as Partial<T>
}

export function maskRowsForRead<T extends Record<string, unknown>>(
  role: WorkspaceRole,
  entity: string,
  rows: T[],
): Array<Partial<T>> {
  return rows.map((row) => maskForRead(role, entity, row))
}

/**
 * The fields in a write payload this role is not allowed to set.
 *
 * Returned rather than silently dropped: quietly ignoring a field the user
 * filled in tells them their change was saved when it was not.
 */
export function rejectedWriteFields(
  role: WorkspaceRole,
  entity: string,
  payload: Record<string, unknown>,
): string[] {
  const denied = new Set(deniedFields(role, entity, 'write'))
  if (denied.size === 0) return []
  return Object.keys(payload).filter((key) => denied.has(key))
}
