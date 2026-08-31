// ============================================
// packages/ui-contract/src/entity-views.ts
//
// PHASE 4 + PHASE 6 — which views an entity has, and what a detail page shows.
//
// ---------------------------------------------------------------------------
// THE POINT IS THE ABSENCES
//
// §6 lists eight view types and §9 lists eight detail sections. Read as a
// menu, that becomes forty pages of scaffolding nobody opens. The value of
// writing it down is deciding what each entity does NOT get:
//
//   · a customer has no board — there are no stages to drag them between
//   · an invoice has no calendar — its date is a fact, not an appointment
//   · a product has no timeline — a price change is an audit row, not a story
//
// An empty tab is worse than a missing one. It costs a click, teaches the user
// the app is unfinished, and has to be maintained anyway.
//
// ---------------------------------------------------------------------------
// EVERY VIEW LISTED HERE MUST EXIST
//
// `entity-views.test.ts` holds this to the same standard as NAV_CONTRACT: a
// view named here that no screen renders is a lie in the contract. Add the
// entry when the screen lands, not when it is planned.
// ============================================

export const VIEW_KINDS = [
  'list',
  'detail',
  'form',
  'board',
  'calendar',
  'timeline',
  'analytics',
] as const
export type ViewKind = (typeof VIEW_KINDS)[number]

export const ENTITY_KINDS = [
  'invoice',
  'customer',
  'product',
  'employee',
  'project',
  'payment',
] as const
export type EntityKind = (typeof ENTITY_KINDS)[number]

/**
 * The views each entity actually has today.
 *
 * `list`, `detail` and `form` are the floor — an entity you cannot browse,
 * open or edit is not a business object. Everything beyond that is earned.
 */
export const ENTITY_VIEWS: Record<EntityKind, readonly ViewKind[]> = {
  // A project moves through stages, so a board is meaningful. Invoices do not:
  // an invoice's "stage" is its workflow status, and dragging one from
  // `posted` to `draft` is not a thing the ledger permits.
  invoice: ['list', 'detail', 'form'],
  customer: ['list', 'detail', 'form'],
  product: ['list', 'detail', 'form'],
  employee: ['list', 'detail', 'form'],
  project: ['list', 'detail', 'form', 'board'],
  // A payment is never edited — it is recorded or cancelled. No form.
  payment: ['list', 'detail'],
}

export function viewsFor(entity: EntityKind): readonly ViewKind[] {
  return ENTITY_VIEWS[entity]
}

export function hasView(entity: EntityKind, view: ViewKind): boolean {
  return ENTITY_VIEWS[entity].includes(view)
}

/* ─── Entity 360 ──────────────────────────────────────────────────────────── */

/**
 * §9's section order, as data.
 *
 * The order is not arbitrary and is not per-entity: overview before relations
 * before history, on every entity, so a user who learns one detail page has
 * learned all of them. What varies is WHICH sections appear.
 */
export const DETAIL_SECTIONS = [
  'overview',
  'lines',
  'financial',
  'relations',
  'documents',
  'activity',
  'audit',
] as const
export type DetailSection = (typeof DETAIL_SECTIONS)[number]

export const ENTITY_SECTIONS: Record<EntityKind, readonly DetailSection[]> = {
  invoice: ['overview', 'lines', 'financial', 'relations', 'documents', 'activity', 'audit'],
  customer: ['overview', 'financial', 'relations', 'documents', 'activity'],
  product: ['overview', 'financial', 'relations', 'activity'],
  // Sensitive by nature. `financial` here means payroll, and it is the one
  // section on any entity that is gated by capability rather than by role
  // rank — see `sectionRequiresCapability`.
  employee: ['overview', 'financial', 'relations', 'documents', 'activity', 'audit'],
  project: ['overview', 'financial', 'relations', 'documents', 'activity'],
  payment: ['overview', 'relations', 'activity', 'audit'],
}

export function sectionsFor(entity: EntityKind): readonly DetailSection[] {
  return ENTITY_SECTIONS[entity]
}

/**
 * Sections that must not render without a server-side capability.
 *
 * ⚠️ This is a RENDERING hint, never the authorization. §1.8 — hiding a tab is
 * not security, and the endpoint behind each of these enforces the same
 * capability itself. What this prevents is a screen requesting data the user
 * cannot have and showing them an error where a missing tab is the honest
 * answer.
 */
export const SECTION_CAPABILITY: Partial<Record<`${EntityKind}.${DetailSection}`, string>> = {
  'invoice.financial': 'ledger.read',
  'product.financial': 'inventory.cost.read',
  'employee.financial': 'report.financial.read',
  'invoice.audit': 'report.financial.read',
  'employee.audit': 'report.financial.read',
  'payment.audit': 'report.financial.read',
}

export function sectionRequiresCapability(
  entity: EntityKind,
  section: DetailSection,
): string | null {
  return SECTION_CAPABILITY[`${entity}.${section}`] ?? null
}

/**
 * The sections this actor may see.
 *
 * `held` is the caller's capability list, which came from the server. Passing
 * a locally-invented list would make this a decoration.
 */
export function visibleSections(
  entity: EntityKind,
  held: readonly string[],
): readonly DetailSection[] {
  return sectionsFor(entity).filter((section) => {
    const required = sectionRequiresCapability(entity, section)
    return required === null || held.includes(required)
  })
}
