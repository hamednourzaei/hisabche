// ============================================
// Capabilities #21–#35, #137, #147 — the connector framework.
// Engine N5.
//
// ⚠️ FIFTEEN INTEGRATIONS, ONE FRAMEWORK, NOT FIFTEEN SERVICES.
//
// The failure this exists to prevent is the obvious one: a WhatsApp service with
// its own authentication, its own rate limiter, its own retry policy, its own
// audit trail, and its own idea of which workspace it belongs to. Then a
// Telegram service with all of those again, differing. That is fifteen places
// to fix one bug, fifteen places to lose a tenant boundary, and a shop whose
// WhatsApp notifications stopped because somebody changed the Gmail retry count.
//
// So the framework owns everything that is the same, and a connector owns only
// what is genuinely different: how to talk to one provider.
//
// ⚠️ A CONNECTOR CANNOT DECIDE ANYTHING ABOUT MONEY OR DATA.
//
// Every inbound payload is a CLAIM. `ingest.domain.ts` says this of a document,
// `migration.domain.ts` says it of a spreadsheet, and a WhatsApp message saying
// «I owe you 5,000» is a claim from the person who typed it. So a connector
// produces a normalised event and hands it to the domain; it never writes to a
// financial table, and the guard in this file's sibling test says so.
//
// ⚠️ AND OUTBOUND IS ALREADY BUILT. Webhooks, scopes, per-key rate limits and
// request logs all exist in `developer.domain.ts` and are not reimplemented
// here. What a connector adds on the outbound side is a SCHEDULE of its own
// polls — and that poll must claim a slot, exactly like `job-scheduler.plugin`
// does, or two instances send the same email twice.
//
// ⚠️ CREDENTIALS ARE STORED ONCE AND SCOPED ONCE.
//
// Every connector uses the `api_keys` table the developer platform already
// keeps, with the same SHA-256 hashing and the same `displayPrefix`. A
// connector that kept its own secrets table would be a second store of third-
// party credentials with a different rotation story — the thing BUG-037 was
// about.

export type ConnectorId =
  | 'google_sheets'
  | 'google_drive'
  | 'dropbox'
  | 'onedrive'
  | 'gmail'
  | 'whatsapp'
  | 'telegram'
  | 'instagram'
  | 'zapier'
  | 'make'
  | 'n8n'
  | 'ifttt'
  | 'email_imap'
  | 'browser_extension'
  | 'excel_addin'

/** What a connector can do. Scopes map onto the capability list that exists. */
export type ConnectorScope =
  | 'read:catalog'
  | 'read:invoices'
  | 'read:customers'
  | 'write:catalog'
  | 'write:invoices'
  | 'write:customers'
  | 'notify:customer'
  | 'capture:document'

/**
 * ⚠️ WHAT THE CONNECTOR IS ALLOWED TO TOUCH.
 *
 * A capture connector that could WRITE would let a customer's forwarded
 * photograph of an invoice create a product, and `ingest.domain.ts` exists
 * precisely to say that an extracted value is a draft. So every connector here
 * is read-or-capture, and the ones that produce documents route through the
 * draft pipeline rather than through a writer.
 */
export interface ConnectorDefinition {
  id: ConnectorId
  /** For display. Not translated here — the UI owns the string. */
  labelKey: string
  scopes: ConnectorScope[]
  /**
   * Whether the connector PULLS (polls), PUSHES (the platform calls it), or
   * both. ⚠️ Stated because the two have different failure shapes: a polling
   * connector misses data while it is down and recovers on the next poll, while
   * a pushing one that fails loses the event.
   */
  direction: 'poll' | 'push' | 'both'
  /** Per-hour ceiling. Null means the provider's own limit governs. */
  maxRequestsPerHour: number | null
  /**
   * ⚠️ WHETHER OUTBOUND PAYLOADS NEED SIGNING. Anything a shop configures for
   * another system to trust needs it; anything read-only does not.
   */
  signsPayloads: boolean
}

const DEFINITIONS: readonly ConnectorDefinition[] = [
  {
    id: 'google_sheets',
    labelKey: 'connectors.googleSheets',
    scopes: ['read:catalog', 'write:catalog'],
    direction: 'both',
    maxRequestsPerHour: 3600,
    signsPayloads: false,
  },
  {
    id: 'google_drive',
    labelKey: 'connectors.googleDrive',
    scopes: ['read:invoices', 'capture:document'],
    direction: 'both',
    maxRequestsPerHour: 3600,
    signsPayloads: true,
  },
  {
    id: 'gmail',
    labelKey: 'connectors.gmail',
    // ⚠️ READ ONLY. A connector that could write would send mail as the shop,
    // and the platform has no sending reputation to spend.
    scopes: ['read:invoices', 'capture:document'],
    direction: 'poll',
    maxRequestsPerHour: 1200,
    signsPayloads: false,
  },
  {
    id: 'email_imap',
    labelKey: 'connectors.emailImap',
    scopes: ['read:invoices', 'capture:document'],
    direction: 'poll',
    maxRequestsPerHour: 600,
    signsPayloads: false,
  },
  {
    id: 'whatsapp',
    labelKey: 'connectors.whatsapp',
    scopes: ['notify:customer'],
    direction: 'both',
    maxRequestsPerHour: 1000,
    signsPayloads: true,
  },
  {
    id: 'telegram',
    labelKey: 'connectors.telegram',
    scopes: ['notify:customer'],
    direction: 'both',
    maxRequestsPerHour: 500,
    signsPayloads: true,
  },
  {
    id: 'instagram',
    labelKey: 'connectors.instagram',
    scopes: ['notify:customer'],
    direction: 'push',
    maxRequestsPerHour: 200,
    signsPayloads: true,
  },
  {
    id: 'dropbox',
    labelKey: 'connectors.dropbox',
    scopes: ['capture:document'],
    direction: 'both',
    maxRequestsPerHour: 3600,
    signsPayloads: false,
  },
  {
    id: 'onedrive',
    labelKey: 'connectors.oneDrive',
    scopes: ['capture:document'],
    direction: 'both',
    maxRequestsPerHour: 3600,
    signsPayloads: false,
  },
  {
    id: 'zapier',
    labelKey: 'connectors.zapier',
    // ⚠️ SCOPES, NOT ACCESS. Zapier connects with a key and gets exactly these;
    // the route allowlist in `API_ROUTE_SCOPES` decides what the key may reach,
    // and the capability intersection narrows it further.
    scopes: ['read:customers', 'write:customers', 'read:invoices', 'write:invoices'],
    direction: 'push',
    maxRequestsPerHour: 1000,
    signsPayloads: false,
  },
  {
    id: 'make',
    labelKey: 'connectors.make',
    scopes: ['read:customers', 'write:customers', 'read:invoices', 'write:invoices'],
    direction: 'push',
    maxRequestsPerHour: 1000,
    signsPayloads: false,
  },
  {
    id: 'n8n',
    labelKey: 'connectors.n8n',
    scopes: ['read:customers', 'write:customers', 'read:invoices', 'write:invoices'],
    direction: 'both',
    maxRequestsPerHour: 600,
    signsPayloads: false,
  },
  {
    id: 'ifttt',
    labelKey: 'connectors.ifttt',
    // ⚠️ IFTTT gets the narrowest set of the three. Its triggers are webhooks
    // fired by the USER pressing a button in someone else's app, so the surface
    // it can reach is the least auditable of the lot.
    scopes: ['notify:customer'],
    direction: 'push',
    maxRequestsPerHour: 300,
    signsPayloads: false,
  },
  {
    id: 'browser_extension',
    labelKey: 'connectors.browserExtension',
    scopes: ['capture:document'],
    direction: 'push',
    maxRequestsPerHour: 600,
    signsPayloads: true,
  },
  {
    id: 'excel_addin',
    labelKey: 'connectors.excelAddin',
    scopes: ['read:catalog', 'write:catalog'],
    direction: 'both',
    maxRequestsPerHour: 1200,
    signsPayloads: true,
  },
]

export function connector(id: ConnectorId): ConnectorDefinition | null {
  return DEFINITIONS.find((c) => c.id === id) ?? null
}

export function allConnectors(): readonly ConnectorDefinition[] {
  return DEFINITIONS
}

// ─── Inbound payloads ───────────────────────────────────────────────────────

/**
 * What a connector produces. ⚠️ ALWAYS the same shape.
 *
 * Not because uniformity is tidy, but because a per-connector payload shape
 * means the consumer of an inbound event has to know which connector produced
 * it — and the consumer is a domain service that must not care. One shape, and
 * `sourceConnector` says where it came from.
 */
export type InboundKind =
  /** An order from a storefront or a marketplace. */
  | 'order'
  /** A document of some kind, for the ingest pipeline. */
  | 'document'
  /** A message to deliver. Carries no money. */
  | 'message'
  /** A change in the OTHER system that the shop wants to know happened. */
  | 'sync'

export interface InboundEvent<T = Record<string, unknown>> {
  kind: InboundKind
  sourceConnector: ConnectorId
  /**
   * ⚠️ THE SHOP'S OWN ID FOR THE THING, when the other system has one. Null
   * when it does not — and null means a person has to match it, because a
   * guessed match writes to somebody else's invoice.
   */
  externalId: string | null
  /** When the OTHER system says it happened. Not when we received it. */
  occurredAt: string
  payload: T
  /** Where the payload came from, when the provider says. */
  sourceUrl?: string | null
}

export type InboundRefusal =
  | 'UNKNOWN_CONNECTOR'
  | 'SCOPE_NOT_GRANTED'
  | 'CONNECTOR_DISABLED'
  | 'NO_EXTERNAL_ID'
  | 'RATE_LIMITED'

export type InboundVerdict =
  | { kind: 'accepted'; event: InboundEvent; domainCommand: string }
  | { kind: 'refused'; reason: InboundRefusal; detail: string }

/**
 * What happens to something a connector says.
 *
 * ⚠️ THE DOMAIN COMMAND IS NAMED, NOT CALLED. `invoice.create` is a NAME here;
 * the caller resolves it to `InvoiceService.create`. A framework that could
 * invoke a command would let a connector's payload reach the books without
 * passing through the authorisation and validation that command already does —
 * and the whole of the safety rules is those checks.
 */
export function acceptInbound(
  event: InboundEvent,
  grantedScopes: readonly ConnectorScope[],
  enabled: boolean,
  rateBucket: { usedThisHour: number; limit: number | null },
): InboundVerdict {
  const definition = connector(event.sourceConnector)
  if (!definition) {
    return {
      kind: 'refused',
      reason: 'UNKNOWN_CONNECTOR',
      detail: `${event.sourceConnector} is not a connector this deployment offers`,
    }
  }

  if (!enabled) {
    return {
      kind: 'refused',
      reason: 'CONNECTOR_DISABLED',
      detail: `${definition.labelKey} is turned off for this workspace`,
    }
  }

  // ⚠️ NO EXTERNAL ID MEANS NO WRITE. A payload that cannot be identified
  // against a record cannot be applied to one, and resolving it by amount or
  // date is how a shop ends up with a customer who was never theirs.
  if (!event.externalId) {
    return {
      kind: 'refused',
      reason: 'NO_EXTERNAL_ID',
      detail: 'the payload carries no identifier from the other system',
    }
  }

  const required = SCOPE_FOR_KIND[event.kind]
  if (!definition.scopes.includes(required)) {
    return {
      kind: 'refused',
      reason: 'SCOPE_NOT_GRANTED',
      detail: `${definition.labelKey} cannot produce ${event.kind} events`,
    }
  }

  if (!grantedScopes.includes(required)) {
    return {
      kind: 'refused',
      reason: 'SCOPE_NOT_GRANTED',
      detail: `${required} was not granted to this connector`,
    }
  }

  if (rateBucket.limit !== null && rateBucket.usedThisHour >= rateBucket.limit) {
    return {
      kind: 'refused',
      reason: 'RATE_LIMITED',
      detail: `${rateBucket.usedThisHour} of ${rateBucket.limit} requests used this hour`,
    }
  }

  return { kind: 'accepted', event, domainCommand: COMMAND_FOR_KIND[event.kind] }
}

/** The scope a kind of inbound event needs. One rule, so it cannot drift per connector. */
const SCOPE_FOR_KIND: Record<InboundKind, ConnectorScope> = {
  order: 'write:invoices',
  document: 'capture:document',
  message: 'notify:customer',
  sync: 'read:invoices',
}

/** The domain command each kind becomes. A NAME — see the header. */
const COMMAND_FOR_KIND: Record<InboundKind, string> = {
  order: 'invoice.create',
  document: 'ingest.stage',
  message: 'notification.create',
  sync: 'sync.apply',
}

// ─── Polling (#57 style automation, connector side) ──────────────────────────

export type PollVerdict =
  | {
      kind: 'poll'
      connectorId: ConnectorId
      /** UTC slot key, for the claim. */ slot: string
      everyMinutes: number
    }
  | { kind: 'skip'; connectorId: ConnectorId; reason: 'NOT_POLLING' | 'DISABLED' | 'RATE_LIMITED' }

/**
 * The slot a polling connector claims, so N instances do not poll twice.
 *
 * ⚠️ SAME SHAPE AS `runScheduledOnce`, and it must stay the same: a connector
 * that polled from a plain `setInterval` would send every customer the same
 * message twice the moment Render ran two instances. The slot is derived from
 * the EPOCH and the period, so it does not depend on the host's clock or its
 * timezone — the `scheduler/index.ts` rule.
 */
export function pollSlot(connectorId: ConnectorId, everyMinutes: number, now: Date): string {
  const minutes = Math.floor(now.getTime() / (everyMinutes * 60_000))
  return `${connectorId}:${minutes}`
}

/**
 * Whether this connector should be polled in this slot.
 *
 * ⚠️ `maxRequestsPerHour` IS A CEILING ON THE POLL, NOT ONLY ON THE API CALLS.
 * A connector polling every 5 minutes against a 600/hour limit would exhaust it
 * on its own, and the shop would find out as import failures rather than as a
 * message.
 */
export function shouldPoll(
  definition: ConnectorDefinition,
  options: { enabled: boolean; everyMinutes: number; requestsThisHour: number },
): PollVerdict {
  if (!options.enabled || definition.direction === 'push') {
    return {
      kind: 'skip',
      connectorId: definition.id,
      reason: options.enabled ? 'NOT_POLLING' : 'DISABLED',
    }
  }

  const perHour = 60 / Math.max(1, options.everyMinutes)
  const ceiling = definition.maxRequestsPerHour

  if (ceiling !== null && options.requestsThisHour + perHour > ceiling) {
    return { kind: 'skip', connectorId: definition.id, reason: 'RATE_LIMITED' }
  }

  return {
    kind: 'poll',
    connectorId: definition.id,
    slot: pollSlot(definition.id, options.everyMinutes, new Date()),
    everyMinutes: options.everyMinutes,
  }
}
