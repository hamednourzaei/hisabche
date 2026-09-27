// ============================================
// Push order — an entry never goes before what it depends on (request #153).
//
// Offline, a shopkeeper creates a customer, then an invoice for them, then a
// payment on the invoice. All three sit in the queue. If the customer's create
// fails (a network blip, a 500), the old drain still sent the invoice — the
// server answered «customer not found», a 4xx, and the invoice was marked
// PERMANENTLY failed, although it would have succeeded one sync later.
//
// The rule: an entry whose payload mentions the id of a CREATE that has not
// been sent yet waits. It is not attempted and not marked failed; it stays
// pending and goes on a later run, after its dependency.
//
// Dependencies are found by value, not by field name: any UUID anywhere in the
// payload (customerId, customer_id, items[].productId, invoiceId, …) that is
// the id of an unsent create. No list of reference fields to keep in step with
// every schema, and ids are random UUIDs, so a false match is not a concern.
// ============================================

import type { QueueEntry } from './contract'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Every UUID-shaped string in a payload, at any depth. */
export function referencedIds(value: unknown, out = new Set<string>(), depth = 0): Set<string> {
  if (depth > 16) return out
  if (typeof value === 'string') {
    if (UUID.test(value)) out.add(value.toLowerCase())
  } else if (Array.isArray(value)) {
    for (const item of value) referencedIds(item, out, depth + 1)
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) referencedIds(item, out, depth + 1)
  }
  return out
}

/** The id an entry creates or changes, when it names one. */
export function ownId(entry: QueueEntry): string | null {
  const id = entry.payload.id
  return typeof id === 'string' && UUID.test(id) ? id.toLowerCase() : null
}

export interface PushGate {
  /** The unsent create this entry waits for, or null if it may go now. */
  blockedBy(entry: QueueEntry): string | null
  /** The entry reached the server: anything waiting on it may go. */
  markSent(entry: QueueEntry): void
}

/**
 * Build the gate for one drain of the queue, in queue order.
 *
 * Every create still in the queue is «unsent» until `markSent`. An update or
 * delete of a record whose create is still queued waits for it too — its own
 * id counts as a dependency unless it IS that create.
 */
export function createPushGate(queue: readonly QueueEntry[]): PushGate {
  const unsent = new Map<string, string>() // id → clientId of the create
  for (const entry of queue) {
    const id = ownId(entry)
    if (entry.operation === 'create' && id && !unsent.has(id)) unsent.set(id, entry.clientId)
  }

  return {
    blockedBy(entry) {
      for (const ref of referencedIds(entry.payload)) {
        const creator = unsent.get(ref)
        if (creator && creator !== entry.clientId) return ref
      }
      return null
    },
    markSent(entry) {
      const id = ownId(entry)
      if (entry.operation === 'create' && id && unsent.get(id) === entry.clientId) unsent.delete(id)
    },
  }
}
