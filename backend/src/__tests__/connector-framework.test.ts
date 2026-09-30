// ============================================
// Engine N5 — the connector framework.
// Capabilities #21–#35, #137, #147.
//
// ⚠️ THIS FILE IS THE ARGUMENT AGAINST FIFTEEN SERVICES.
//
// Each connector is a row in one table, not a service. That only works if the
// framework really does own everything shared, and the tests below are what
// would fail if someone started re-implementing it per connector:
//
//   * a connector whose own scopes allow it to WRITE financial records
//   * an inbound payload accepted without an identifier from the other system
//   * a poll that does not claim a slot, which sends every customer the same
//     message twice the moment Render runs two instances
//   * a poll rate that exhausts the provider's hourly ceiling on its own
//
// ⚠️ AND THE BIGGEST ONE: NO CONNECTOR CAN INVOKE A DOMAIN COMMAND.
//
// `acceptInbound` returns a command NAME. It cannot call one. A framework that
// could invoke would let a connector's payload reach the books without passing
// through the authorisation and validation that command already performs — and
// those checks are the entire safety surface.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  acceptInbound,
  allConnectors,
  connector,
  pollSlot,
  shouldPoll,
  type ConnectorId,
  type ConnectorScope,
  type InboundEvent,
} from '../services/connectors/connector.domain'

const event = (over: Partial<InboundEvent> = {}): InboundEvent => ({
  kind: 'order',
  sourceConnector: 'zapier',
  externalId: 'SO-1001',
  occurredAt: '2026-09-30T10:00:00Z',
  payload: { total: 100 },
  ...over,
})

describe('N5 — one table, not fifteen services', () => {
  it('every connector is a row with the same shape', () => {
    for (const definition of allConnectors()) {
      expect(definition.scopes.length, definition.id).toBeGreaterThan(0)
      expect(definition.labelKey, definition.id).toMatch(/^connectors\./)
      expect(['poll', 'push', 'both']).toContain(definition.direction)
    }
  })

  it('an unknown connector is null, not a default', () => {
    // ⚠️ A default here would silently route an unrecognised source into
    // whichever connector happened to be first in the array.
    expect(connector('not_a_connector' as ConnectorId)).toBeNull()
  })

  it('label keys are namespaced so a screen can find them', () => {
    // ⚠️ Three locales, and this file does not know which one is loaded. The
    // namespace is how the UI resolves it, and `t()` throws on a missing key —
    // so an unnamespaced key would take the page down.
    expect(allConnectors().every((c) => c.labelKey.startsWith('connectors.'))).toBe(true)
  })
})

describe('N5 — no connector may write financial records from an inbound payload', () => {
  it('a connector with no write scope is refused a write event', () => {
    // ⚠️ IFTTT has `notify:customer` and nothing else. Its triggers fire when
    // the USER presses a button in someone else's app, so it is the least
    // auditable surface of the lot.
    const verdict = acceptInbound(
      event({ sourceConnector: 'ifttt' }),
      ['notify:customer', 'write:invoices', 'read:invoices', 'write:customers', 'read:customers'],
      true,
      { usedThisHour: 0, limit: 300 },
    )

    expect(verdict).toMatchObject({ kind: 'refused', reason: 'SCOPE_NOT_GRANTED' })
  })

  it('granting the scope in the app does not override what the connector can do', () => {
    // ⚠️ TWO CHECKS, and the first is not optional. A shop that ticks every
    // box on the connection screen must not thereby turn a notification-only
    // connector into one that writes invoices.
    const verdict = acceptInbound(
      event({ sourceConnector: 'ifttt' }),
      ['write:invoices', 'read:invoices', 'write:customers', 'read:customers', 'notify:customer'],
      true,
      { usedThisHour: 0, limit: 300 },
    )

    expect(verdict).toMatchObject({ kind: 'refused', reason: 'SCOPE_NOT_GRANTED' })
    expect(verdict.kind === 'refused' && verdict.detail).toContain('cannot produce')
  })

  it('gmail can READ documents and cannot send mail', () => {
    const gmail = connector('gmail')

    expect(gmail?.scopes).toContain('capture:document')
    // ⚠️ The platform has no sending reputation to spend, and a connector that
    // could send would spend it silently.
    expect(gmail?.scopes).not.toContain('notify:customer')
  })

  it('no connector holds a financial write scope it does not declare as capable', () => {
    const writers = allConnectors().filter((c) => c.scopes.some((s) => s === 'write:invoices'))

    // Only the three automation platforms may write, and each of them is the
    // tool a shop already uses to automate things deliberately.
    expect(writers.map((c) => c.id).sort()).toEqual(['make', 'n8n', 'zapier'])
  })
})

describe('N5 — an inbound event with no identifier is never written', () => {
  it('refuses an event with no external id', () => {
    // ⚠️ THE refusal that matters most. Resolving by amount or date is how a
    // shop ends up with a customer's order on somebody else's invoice.
    const verdict = acceptInbound(
      event({ externalId: null }),
      ['write:invoices', 'read:invoices'],
      true,
      { usedThisHour: 0, limit: 1000 },
    )

    expect(verdict).toMatchObject({ kind: 'refused', reason: 'NO_EXTERNAL_ID' })
  })

  it('an empty string is also no identifier', () => {
    const verdict = acceptInbound(
      event({ externalId: '' }),
      ['write:invoices', 'read:invoices'],
      true,
      { usedThisHour: 0, limit: 1000 },
    )

    expect(verdict).toMatchObject({ kind: 'refused', reason: 'NO_EXTERNAL_ID' })
  })
})

describe('N5 — the framework names a command, it never calls one', () => {
  it('an accepted order names invoice.create and nothing else', () => {
    // ⚠️ A NAME. The caller resolves it to InvoiceService.create, which is where
    // the authorisation and the money derivation live. A framework that could
    // invoke would let a payload reach the books without them.
    const verdict = acceptInbound(event(), ['write:invoices', 'read:invoices'], true, {
      usedThisHour: 0,
      limit: 1000,
    })

    expect(verdict).toMatchObject({ kind: 'accepted', domainCommand: 'invoice.create' })
  })

  it('each kind maps to exactly one command, from a connector that CAN do it', () => {
    // ⚠️ Each kind needs a connector that declares BOTH the scope and the
    // capability. `google_drive` is `capture:document` only, so asking it for
    // an `order` is refused — correctly, and the first version of this test
    // failed for that reason rather than for any bug in the mapping.
    const cases = [
      { kind: 'order', scope: 'write:invoices', from: 'zapier' },
      { kind: 'document', scope: 'capture:document', from: 'google_drive' },
      { kind: 'message', scope: 'notify:customer', from: 'telegram' },
      { kind: 'sync', scope: 'read:invoices', from: 'gmail' },
    ] as const

    for (const { kind, scope, from } of cases) {
      const verdict = acceptInbound(
        event({ kind, sourceConnector: from }),
        [scope] as ConnectorScope[],
        true,
        { usedThisHour: 0, limit: 1000 },
      )

      expect(verdict.kind, `${kind} via ${from}`).toBe('accepted')
      expect(verdict.kind === 'accepted' && verdict.domainCommand.length, kind).toBeGreaterThan(0)
    }
  })
})

describe('N5 — a disabled connector receives nothing', () => {
  it('refuses before it even looks at the payload', () => {
    const verdict = acceptInbound(event(), ['write:invoices', 'read:invoices'], false, {
      usedThisHour: 0,
      limit: 1000,
    })

    expect(verdict).toMatchObject({ kind: 'refused', reason: 'CONNECTOR_DISABLED' })
  })

  it('an unknown connector is refused even when it claims a scope', () => {
    const verdict = acceptInbound(
      event({ sourceConnector: 'made_up' as ConnectorId }),
      ['write:invoices', 'read:invoices'],
      true,
      { usedThisHour: 0, limit: 1000 },
    )

    expect(verdict).toMatchObject({ kind: 'refused', reason: 'UNKNOWN_CONNECTOR' })
  })

  it('the rate ceiling is checked before acceptance', () => {
    const verdict = acceptInbound(event(), ['write:invoices', 'read:invoices'], true, {
      usedThisHour: 1000,
      limit: 1000,
    })

    expect(verdict).toMatchObject({ kind: 'refused', reason: 'RATE_LIMITED' })
  })
})

describe('N5 — a poll CLAIMS A SLOT, like every other scheduled job', () => {
  it('the slot is derived from the epoch and the period', () => {
    // ⚠️ Not from the host's clock or its timezone — the `scheduler/index.ts`
    // rule. Two instances in two regions compute the SAME slot and only the
    // first one through `claim_scheduled_run` polls.
    const at = new Date('2026-09-30T10:17:00Z')
    const again = new Date('2026-09-30T10:53:00Z')

    expect(pollSlot('gmail', 60, at)).toBe(pollSlot('gmail', 60, again))
  })

  it('different connectors never share a slot', () => {
    const at = new Date('2026-09-30T10:00:00Z')
    expect(pollSlot('gmail', 60, at)).not.toBe(pollSlot('dropbox', 60, at))
  })

  it('a push-only connector is never polled', () => {
    const instagram = connector('instagram')!
    const verdict = shouldPoll(instagram, { enabled: true, everyMinutes: 5, requestsThisHour: 0 })

    expect(verdict).toMatchObject({ kind: 'skip', reason: 'NOT_POLLING' })
  })

  it('a disabled connector is never polled', () => {
    const gmail = connector('gmail')!
    expect(
      shouldPoll(gmail, { enabled: false, everyMinutes: 60, requestsThisHour: 0 }),
    ).toMatchObject({
      reason: 'DISABLED',
    })
  })

  it('a poll that would exhaust the hourly ceiling is SKIPPED', () => {
    // ⚠️ Polling every 5 minutes costs 12 of the 600/hour ceiling per hour. At
    // 580 already used, 580 + 12 = 592 is still UNDER it, so this one proceeds —
    // and the first version of this test asserted it was skipped, which meant the
    // assertion was wrong and would have hidden a real over-skip if fixed.
    const email = connector('email_imap')!

    expect(shouldPoll(email, { enabled: true, everyMinutes: 5, requestsThisHour: 580 }).kind).toBe(
      'poll',
    )

    // At 595 the next poll would cross it, and that one is withheld.
    expect(
      shouldPoll(email, { enabled: true, everyMinutes: 5, requestsThisHour: 595 }),
    ).toMatchObject({ kind: 'skip', reason: 'RATE_LIMITED' })
  })

  it('a poll under the ceiling proceeds with its slot', () => {
    const email = connector('email_imap')!
    const verdict = shouldPoll(email, { enabled: true, everyMinutes: 60, requestsThisHour: 10 })

    expect(verdict.kind).toBe('poll')
    expect(verdict.kind === 'poll' && verdict.slot).toContain('email_imap')
  })

  it('a connector with no ceiling is never skipped for rate', () => {
    // `null` means the provider's own limit governs, which is not the same as
    // zero and must not be read as one.
    const noCeiling = allConnectors().filter((c) => c.maxRequestsPerHour === null)
    for (const definition of noCeiling) {
      const verdict = shouldPoll(definition, {
        enabled: true,
        everyMinutes: 5,
        requestsThisHour: 100_000,
      })
      expect(verdict.kind, definition.id).toBe('poll')
    }
  })
})
