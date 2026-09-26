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
  // Planning and control
  'budget.read',
  'budget.manage',
  'budget.approve',
  // Bringing an existing business in
  'data.import',
  // Who else is signed in right now
  'people.presence.read',
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

  // A budget exposes the shop's financial plan, so reading it is a manager's
  // view like the P&L. Approving or revising one changes a spending limit
  // everyone else is held to — the owner's decision.
  'budget.read': 'manager',
  'budget.manage': 'manager',
  'budget.approve': 'owner',

  // An import creates thousands of rows with opening balances in one act. A
  // seller creates customers one at a time at a counter; this is a different
  // operation with a different blast radius.
  'data.import': 'manager',

  // ⚠️ SEEING WHO IS ONLINE IS A FACT ABOUT PEOPLE, NOT ABOUT THE BOOKS.
  //
  // It tells a colleague when someone started work and when they stopped, so
  // it is off for a seller by default and the owner turns it on per profile
  // — which is exactly what was asked for. `seller` would have made it a
  // default of «everyone can watch everyone».
  'people.presence.read': 'manager',

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

// ─── Per-workspace changes to the three roles ────────────────────────────────
//
// The static table above is the DEFAULT. A workspace may change what owner,
// manager and seller hold (docs/workspace-role-capabilities-migration.sql);
// the effective set is the default with that workspace's rows applied, and it
// is what every check enforces.

export interface CapabilityOverride {
  role: WorkspaceRole
  capability: Capability
  granted: boolean
}

/**
 * What the owner can never lose. Without these, one click on the matrix locks
 * a business out of the only screen that could give them back.
 */
export const OWNER_LOCKED_CAPABILITIES: readonly Capability[] = [
  'member.manage',
  'workspace.manage',
]

export function effectiveCapabilities(
  role: WorkspaceRole,
  overrides: readonly CapabilityOverride[],
): Set<Capability> {
  const set = new Set<Capability>(capabilitiesOf(role))
  for (const o of overrides) {
    if (o.role !== role || !(CAPABILITIES as readonly string[]).includes(o.capability)) continue
    if (o.granted) set.add(o.capability)
    else set.delete(o.capability)
  }
  if (role === 'owner') for (const c of OWNER_LOCKED_CAPABILITIES) set.add(c)
  return set
}

/**
 * The one question every check asks. A context that carries its resolved set
 * (every HTTP request, via requireWorkspaceContext) is answered from it; a
 * context built without one (a job, a test) falls back to the defaults.
 */
export function holds(
  actor: { role: WorkspaceRole; capabilities?: ReadonlySet<string> | undefined },
  capability: Capability,
): boolean {
  return actor.capabilities ? actor.capabilities.has(capability) : can(actor.role, capability)
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

// ─── Modules — the Permission Matrix's rows (G3) ────────────────────────────
//
// A capability like `ledger.lock_period` is the right unit for a route guard
// and the wrong unit for a screen: nobody administers a business by ticking
// twenty-four boxes. The matrix groups them into eight MODULES, each with an
// access LADDER — none → read → write → full — and each rung naming the
// capabilities it adds to the rungs below it.
//
// ⚠️ THE LADDER IS CUMULATIVE. `write` means read's capabilities PLUS write's;
// `full` means all three rungs. `capabilitiesForLevel` is the one place that
// expands it, so a screen cannot disagree with a guard about what "write"
// means.
//
// ⚠️ THE MODULES ARE DISJOINT. Every capability appears in exactly one module,
// checked by `authorization-rules.test.ts`. A capability in two modules would
// let one module's cell silently undo another's.
//
// Two groupings are deliberate rather than obvious:
//
//   `costing` is its own module holding only `inventory.cost.read`. It could
//   sit under inventory as a read, but the cost of stock IS the shop's margin
//   — a seller reads inventory all day and has no reason to know what it was
//   bought for. Burying it as a rung would hand it out with ordinary stock
//   access.
//
//   `products` is folded INTO inventory rather than standing alone, matching
//   G1's decision that the catalogue is a view of the inventory domain rather
//   than a destination of its own.

export type AccessLevel = 'none' | 'read' | 'write' | 'full'

export const ACCESS_LEVELS: readonly AccessLevel[] = ['none', 'read', 'write', 'full'] as const

export interface ModuleSpec {
  key: string
  /** Persian label. The UI may translate by key; this is the fallback. */
  label: string
  read: Capability[]
  write: Capability[]
  full: Capability[]
}

export const PERMISSION_MODULES: readonly ModuleSpec[] = [
  {
    key: 'invoices',
    label: 'فاکتورها',
    read: ['invoice.read'],
    write: ['invoice.create', 'invoice.update'],
    full: ['invoice.delete'],
  },
  {
    key: 'payments',
    label: 'پرداخت‌ها',
    read: ['payment.read'],
    write: ['payment.record'],
    full: ['payment.cancel'],
  },
  {
    key: 'accounting',
    label: 'حسابداری',
    read: ['ledger.read'],
    write: ['ledger.post', 'account.manage'],
    full: ['ledger.reverse', 'ledger.lock_period'],
  },
  {
    key: 'inventory',
    label: 'انبار و کالا',
    read: ['inventory.read', 'product.read'],
    write: ['product.write'],
    full: ['inventory.configure'],
  },
  {
    key: 'costing',
    label: 'بهای تمام‌شده',
    read: ['inventory.cost.read'],
    write: [],
    full: [],
  },
  {
    key: 'parties',
    label: 'مشتریان و تأمین‌کنندگان',
    read: ['customer.read'],
    write: ['customer.write'],
    full: [],
  },
  {
    key: 'reports',
    label: 'گزارش‌ها',
    read: ['report.operational.read'],
    write: [],
    full: ['report.financial.read'],
  },
  {
    key: 'budgets',
    label: 'بودجه',
    read: ['budget.read'],
    write: ['budget.manage'],
    full: ['budget.approve'],
  },
  {
    key: 'people',
    label: 'همکاران',
    // Read is the whole module: there is nothing to write. Keeping it its own
    // module is what lets the owner grant it to one person without also
    // handing over member management, which lives in `workspace` below.
    read: ['people.presence.read'],
    write: [],
    full: [],
  },
  {
    key: 'workspace',
    label: 'کسب‌وکار و اعضا',
    read: [],
    write: ['data.import'],
    full: ['member.manage', 'workspace.manage'],
  },
] as const

/** Every capability a module grants at this level, cumulatively. */
export function capabilitiesForLevel(module: ModuleSpec, level: AccessLevel): Capability[] {
  if (level === 'none') return []
  if (level === 'read') return [...module.read]
  if (level === 'write') return [...module.read, ...module.write]
  return [...module.read, ...module.write, ...module.full]
}

/**
 * The highest rung this capability set fully satisfies.
 *
 * A set that holds SOME of a rung's capabilities does not reach it — reporting
 * 'write' for a role that can create invoices but not update them would be a
 * screen that lies about what someone can do. Rungs with no capabilities are
 * skipped rather than counting as satisfied.
 */
export function levelOfCapabilities(module: ModuleSpec, held: Set<string>): AccessLevel {
  const satisfies = (codes: Capability[]) => codes.length > 0 && codes.every((c) => held.has(c))

  if (
    module.full.length > 0 &&
    satisfies(module.full) &&
    satisfies([...module.read, ...module.write].filter(Boolean) as Capability[])
  ) {
    return 'full'
  }
  if (satisfies(module.write) && (module.read.length === 0 || satisfies(module.read)))
    return 'write'
  if (satisfies(module.read)) return 'read'
  return 'none'
}

// ─── Per-member page blocks ──────────────────────────────────────────────────
//
// The owner can take whole modules away from ONE person
// (docs/member-module-blocks-migration.sql). Roles and profiles cannot: role
// overrides move a whole role, and profiles only ever ADD.
//
// ⚠️ A BLOCK ONLY RESTRICTS. The result is always a subset of what the role
// already holds, and the owner is never restricted — a block on the owner is
// ignored, because a business whose owner is locked out of a module has
// nobody left who can unlock it.

/**
 * Read access a module cannot work without, kept even when the module that
 * owns it is blocked. "Invoices only" still has to pick an item from stock and
 * a customer from the list — blocking the inventory PAGE must not break the
 * invoice form. Only READS: a dependency never keeps a write.
 */
export const MODULE_READ_DEPENDENCIES: Readonly<Record<string, readonly Capability[]>> = {
  invoices: ['product.read', 'inventory.read', 'customer.read'],
  payments: ['customer.read', 'invoice.read'],
}

/**
 * Never removed by a block. It is the floor every role holds, and the server's
 * own self-description endpoints (/governance/my-capabilities, /why-not) and
 * the home screen are guarded by it — blocking it would leave the app unable
 * even to ask which pages are locked. Blocking the reports module still
 * removes the financial reports.
 */
export const BLOCK_FLOOR: readonly Capability[] = ['report.operational.read']

/** Every module key a block may name. */
export const BLOCKABLE_MODULES: readonly string[] = PERMISSION_MODULES.map((m) => m.key)

/**
 * The capabilities left once `blocked` modules are taken away.
 *
 * `held` is the role's effective set; the answer is never larger than it.
 */
export function restrictByModuleBlocks(
  role: WorkspaceRole,
  held: ReadonlySet<Capability>,
  blocked: readonly string[],
): Set<Capability> {
  const result = new Set<Capability>(held)
  if (role === 'owner' || blocked.length === 0) return result

  const blockedSet = new Set(blocked)
  for (const module of PERMISSION_MODULES) {
    if (!blockedSet.has(module.key)) continue
    for (const capability of capabilitiesForLevel(module, 'full')) {
      if (!BLOCK_FLOOR.includes(capability)) result.delete(capability)
    }
  }

  // Put back the reads an ALLOWED module needs — but only ones the role had.
  for (const module of PERMISSION_MODULES) {
    if (blockedSet.has(module.key)) continue
    for (const capability of MODULE_READ_DEPENDENCIES[module.key] ?? []) {
      if (held.has(capability) && moduleCapabilitiesHeld(module, result)) result.add(capability)
    }
  }
  return result
}

/** Whether the member still holds anything of this module — a dependency of a module they cannot use is not needed. */
function moduleCapabilitiesHeld(module: ModuleSpec, held: ReadonlySet<Capability>): boolean {
  return capabilitiesForLevel(module, 'full').some((c) => held.has(c))
}
