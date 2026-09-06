// ============================================
// G6 — approval decides whether a document's financial effect happens.
//
// Before this, `invoice.service.create()` ran two unawaited chains side by
// side: one booked the journal entry, the other started the workflow. The
// entry was booked while the instance was still at step one, so
// «در انتظار تأیید» was a LABEL on a document that had already had its full
// effect. Approving changed a status column. Rejecting changed a status
// column. The money had moved either way.
//
// The rule is now pure, and these are its tests. What they lock is not the
// happy path — it is the two ways of getting it wrong that fail SILENTLY:
//
//   holding on a template nobody can grant  → the document is frozen forever
//                                             and looks like it is waiting on
//                                             a colleague
//   posting when a real approval is pending → the whole feature is decorative
// ============================================

import { describe, expect, it } from 'vitest'

import {
  AWAITING_APPROVAL_STATUS,
  decideApproval,
  mayPostDocument,
} from '../services/workflow/approval-gate.domain'

describe('no approval required', () => {
  it('posts immediately', () => {
    const outcome = decideApproval({ requiresApproval: false, workflowIds: [] })

    expect(outcome.kind).toBe('post_now')
    expect(mayPostDocument(outcome)).toBe(true)
  })

  it('posts even when workflow ids are present but no rule matched', () => {
    // A rule that did not fire does not hold the document because some
    // template happens to exist.
    const outcome = decideApproval({ requiresApproval: false, workflowIds: ['wf-1'] })

    expect(mayPostDocument(outcome)).toBe(true)
  })
})

describe('approval required, with a template that exists', () => {
  it('holds', () => {
    const outcome = decideApproval({ requiresApproval: true, workflowIds: ['wf-1'] })

    expect(outcome.kind).toBe('hold')
    expect(mayPostDocument(outcome)).toBe(false)
  })

  it('carries every template so each starts its own instance', () => {
    const outcome = decideApproval({ requiresApproval: true, workflowIds: ['wf-1', 'wf-2'] })

    expect(outcome.kind === 'hold' && outcome.workflowIds).toEqual(['wf-1', 'wf-2'])
  })
})

describe('approval required, but nothing can grant it', () => {
  it('posts rather than freezing the document', () => {
    // THE LOAD-BEARING CASE.
    //
    // A rule says "needs approval" and names templates that are all deleted,
    // deactivated, or another workspace's. Holding would leave the document
    // with no workflow instance and therefore no route out — indistinguishable
    // on every screen from "waiting on a colleague", and permanent.
    //
    // Posting leaves an entry that CAN be reversed. The freeze leaves a shop
    // unable to invoice with nothing to click.
    const outcome = decideApproval({ requiresApproval: true, workflowIds: [] })

    expect(outcome.kind).toBe('post_now')
    expect(mayPostDocument(outcome)).toBe(true)
  })
})

describe('the held status', () => {
  it('reuses an existing invoice status rather than inventing a sixth', () => {
    // `invoices.status` already conflates document state and settlement state
    // (Phase F). Adding a value would deepen that; the authoritative "is it
    // posted" answer is whether a journal entry exists.
    expect(AWAITING_APPROVAL_STATUS).toBe('pending')
  })
})

describe('mayPostDocument is the only predicate', () => {
  it('agrees with the outcome kind in both directions', () => {
    // One predicate so the ledger path, the stock path and anything added
    // later ask the same question of the same value, instead of each testing
    // a status string its own way and drifting.
    expect(mayPostDocument({ kind: 'post_now' })).toBe(true)
    expect(mayPostDocument({ kind: 'hold', workflowIds: ['wf-1'] })).toBe(false)
  })
})
