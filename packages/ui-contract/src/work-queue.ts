// ============================================
// packages/ui-contract/src/work-queue.ts
//
// PHASE 12 — turning notifications into work.
//
// ---------------------------------------------------------------------------
// A NOTIFICATION SAYS SOMETHING HAPPENED. A WORK ITEM SAYS WHAT TO DO.
//
// "Invoice #1204 is overdue" is a fact. "3 invoices overdue — chase them" is a
// job. The difference is that the second has a verb, a count and somewhere to
// go, and it disappears when the work is done.
//
// This module derives the queue from counts the app already has. It invents
// nothing: a caller that cannot obtain a count passes `null`, and the item is
// omitted rather than shown as zero. An item that says "0 approvals waiting"
// is noise, and one that says zero because the request failed is a lie.
//
// ---------------------------------------------------------------------------
// ORDER IS BY CONSEQUENCE, NOT BY COUNT
//
// Forty stale draft invoices are less urgent than one unresolved conflict,
// because the conflict means two devices disagree about what is true and every
// number downstream is provisional until somebody decides. Sorting by count
// would bury it.
// ============================================

export const WORK_ITEM_KINDS = [
  'conflicts',
  'approvals',
  'overdue_invoices',
  'unmatched_bank',
  'low_stock',
  'expiring_stock',
  'pending_sync',
] as const

export type WorkItemKind = (typeof WORK_ITEM_KINDS)[number]

export type WorkItemUrgency = 'blocking' | 'due' | 'attention'

export interface WorkItemSpec {
  readonly kind: WorkItemKind
  readonly urgency: WorkItemUrgency
  /** i18n key for "3 invoices overdue". The count is passed separately. */
  readonly labelKey: string
  /** Where the verb happens. Must be a real destination. */
  readonly path: string
  /** Capability required to act. Null means anybody in the workspace. */
  readonly capability: string | null
}

/**
 * Ordered by consequence. The index is the priority, so adding an item means
 * deciding where it sits relative to the others.
 */
export const WORK_ITEMS: readonly WorkItemSpec[] = [
  {
    kind: 'conflicts',
    urgency: 'blocking',
    labelKey: 'workQueue.conflicts',
    path: '/data-and-sync?tab=details&view=conflicts',
    capability: null,
  },
  {
    kind: 'approvals',
    urgency: 'blocking',
    labelKey: 'workQueue.approvals',
    path: '/approvals',
    capability: null,
  },
  {
    kind: 'unmatched_bank',
    urgency: 'due',
    labelKey: 'workQueue.unmatched_bank',
    path: '/accounting?tab=treasury',
    // Reconciling a bank line writes to the ledger.
    capability: 'ledger.post',
  },
  {
    kind: 'overdue_invoices',
    urgency: 'due',
    labelKey: 'workQueue.overdue_invoices',
    // The nav id is 'get-paid'; the PATH is '/invoices'. Using the id here
    // would build a link to a page that does not exist.
    path: '/invoices',
    capability: null,
  },
  {
    kind: 'expiring_stock',
    urgency: 'due',
    labelKey: 'workQueue.expiring_stock',
    path: '/warehouse?tab=expiry',
    capability: 'inventory.read',
  },
  {
    kind: 'low_stock',
    urgency: 'attention',
    labelKey: 'workQueue.low_stock',
    path: '/warehouse',
    capability: 'inventory.read',
  },
  {
    kind: 'pending_sync',
    urgency: 'attention',
    labelKey: 'workQueue.pending_sync',
    path: '/data-and-sync',
    capability: null,
  },
]

/** `null` means "not known". It is not the same as zero and never rendered. */
export type WorkCounts = Partial<Record<WorkItemKind, number | null>>

export interface WorkItem {
  kind: WorkItemKind
  urgency: WorkItemUrgency
  labelKey: string
  path: string
  count: number
}

/**
 * The queue, for this actor, right now.
 *
 * Three filters, in order: a count that is unknown or zero is dropped, an item
 * the actor cannot act on is dropped, and what remains is ordered by
 * consequence. Showing somebody work they are not allowed to do is how a work
 * queue becomes a list of complaints.
 */
export function buildWorkQueue(counts: WorkCounts, held: readonly string[]): WorkItem[] {
  const items: WorkItem[] = []

  for (const spec of WORK_ITEMS) {
    const count = counts[spec.kind]
    if (count === null || count === undefined || count <= 0) continue
    if (spec.capability !== null && !held.includes(spec.capability)) continue

    items.push({
      kind: spec.kind,
      urgency: spec.urgency,
      labelKey: spec.labelKey,
      path: spec.path,
      count,
    })
  }

  return items
}

const URGENCY_RANK: Record<WorkItemUrgency, number> = {
  blocking: 0,
  due: 1,
  attention: 2,
}

export function urgencyRank(urgency: WorkItemUrgency): number {
  return URGENCY_RANK[urgency]
}

/**
 * Is there anything at all to do?
 *
 * Used to decide whether the queue renders. An empty queue shows nothing
 * rather than an encouraging empty state — a panel that says "nothing to do!"
 * on a dashboard every day is a panel that trains people to skip that part of
 * the screen.
 */
export function hasWork(items: readonly WorkItem[]): boolean {
  return items.length > 0
}

/** The single most pressing thing, for a one-line summary. */
export function mostPressing(items: readonly WorkItem[]): WorkItem | null {
  return items[0] ?? null
}
