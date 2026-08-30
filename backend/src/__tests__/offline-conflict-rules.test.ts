// ============================================
// Offline conflict resolution on financial data.
//
// The invariant under test: a financial conflict is never settled by
// last-write-wins. Both versions are preserved, a person decides, and the
// decision is complete and reasoned before it can be applied.
// ============================================

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  applyResolution,
  classifyConflict,
  diverging,
  isFinancialField,
  orderMutations,
  validateResolution,
  type FieldDivergence,
} from '../services/conflict'

const serverInvoice = {
  id: 'inv-1',
  version: 4,
  total: 1000,
  notes: 'server note',
  reference: 'REF-1',
  updated_at: '2026-08-29T10:00:00Z',
}

describe('what counts as a financial disagreement', () => {
  it('an invoice total does', () => {
    expect(isFinancialField('invoice', 'total')).toBe(true)
    expect(isFinancialField('invoice', 'paid_amount')).toBe(true)
    expect(isFinancialField('invoice', 'customer_id')).toBe(true)
  })

  it('a note does not', () => {
    expect(isFinancialField('invoice', 'notes')).toBe(false)
    expect(isFinancialField('invoice', 'reference')).toBe(false)
  })

  it('a product quantity and its prices do', () => {
    expect(isFinancialField('product', 'quantity')).toBe(true)
    expect(isFinancialField('product', 'buy_price')).toBe(true)
  })

  it('a customer note does not, but their opening balance does', () => {
    expect(isFinancialField('customer', 'notes')).toBe(false)
    expect(isFinancialField('customer', 'opening_balance')).toBe(true)
  })
})

describe('finding where the two versions differ', () => {
  it('compares only the fields the client actually sent', () => {
    // A partial update that omits a field is not claiming anything about it.
    // Treating an absent key as an intent to blank the value is how offline
    // edits erase data they never touched.
    const divergences = diverging('invoice', serverInvoice, { notes: 'phone note' })
    expect(divergences.map((d) => d.field)).toEqual(['notes'])
  })

  it('ignores the columns the server owns', () => {
    const divergences = diverging('invoice', serverInvoice, {
      version: 9,
      updated_at: '2026-08-29T11:00:00Z',
      workspace_id: 'other',
    })
    expect(divergences).toEqual([])
  })

  it('does not report a difference that is only a number formatted as a string', () => {
    // Postgres hands money back as a string; the client sends a number.
    expect(diverging('invoice', { ...serverInvoice, total: '1000.00' }, { total: 1000 })).toEqual(
      [],
    )
  })

  it('marks a financial difference as financial', () => {
    const divergences = diverging('invoice', serverInvoice, { total: 1200 })
    expect(divergences[0]!.financial).toBe(true)
  })
})

describe('classification', () => {
  it('reports no divergence when the client agrees with the server', () => {
    expect(classifyConflict('invoice', serverInvoice, { total: 1000 })).toEqual({
      kind: 'no_divergence',
    })
  })

  it('auto-merges when only notes differ', () => {
    // Making somebody adjudicate this is how a review queue becomes noise
    // nobody reads.
    const verdict = classifyConflict('invoice', serverInvoice, { notes: 'phone note' })
    expect(verdict.kind).toBe('auto_merge')
    if (verdict.kind === 'auto_merge') {
      expect(verdict.merged.notes).toBe('phone note')
      expect(verdict.merged.total).toBe(1000)
    }
  })

  it('SENDS A DISPUTED TOTAL TO A PERSON, never resolving it by clock', () => {
    const verdict = classifyConflict('invoice', serverInvoice, { total: 1200 })
    expect(verdict.kind).toBe('needs_review')
  })

  it('sends the whole conflict to review if any one field is financial', () => {
    // Auto-merging the note and queuing the total separately would apply half
    // of a single edit the user made as one action.
    const verdict = classifyConflict('invoice', serverInvoice, {
      notes: 'phone note',
      total: 1200,
    })
    expect(verdict.kind).toBe('needs_review')
    if (verdict.kind === 'needs_review') {
      expect(verdict.divergences.map((d) => d.field).sort()).toEqual(['notes', 'total'])
    }
  })
})

describe('a resolution must be complete, reasoned and unapplied', () => {
  const divergences: FieldDivergence[] = [
    { field: 'total', serverValue: 1000, clientValue: 1200, financial: true },
    { field: 'notes', serverValue: 'server note', clientValue: 'phone note', financial: false },
  ]

  it('refuses a decision with no reason', () => {
    expect(validateResolution({ choice: 'keep_client', reason: '' }, divergences, false)).toContain(
      'CONFLICT_REASON_REQUIRED',
    )
  })

  it('refuses a merge that leaves a field undecided', () => {
    // An undecided field would fall back to a default, and a default IS
    // last-write-wins wearing a different hat.
    const problems = validateResolution(
      { choice: 'merge', fieldChoices: { total: 'client' }, reason: 'checked the till' },
      divergences,
      false,
    )
    expect(problems).toContain('CONFLICT_MERGE_FIELDS_REQUIRED')
  })

  it('refuses a merge naming a field that is not in dispute', () => {
    const problems = validateResolution(
      {
        choice: 'merge',
        fieldChoices: { total: 'client', notes: 'server', currency: 'client' },
        reason: 'checked the till',
      },
      divergences,
      false,
    )
    expect(problems).toContain('CONFLICT_MERGE_FIELD_UNKNOWN')
  })

  it('refuses to decide the same conflict twice', () => {
    const problems = validateResolution(
      { choice: 'keep_server', reason: 'again' },
      divergences,
      true,
    )
    expect(problems).toContain('CONFLICT_ALREADY_RESOLVED')
  })

  it('accepts a complete, reasoned merge', () => {
    const problems = validateResolution(
      {
        choice: 'merge',
        fieldChoices: { total: 'client', notes: 'server' },
        reason: 'counted the cash drawer',
      },
      divergences,
      false,
    )
    expect(problems).toEqual([])
  })
})

describe('applying a decision', () => {
  const server = { id: 'inv-1', total: 1000, notes: 'server note' }
  const client = { total: 1200, notes: 'phone note' }
  const divergences: FieldDivergence[] = [
    { field: 'total', serverValue: 1000, clientValue: 1200, financial: true },
    { field: 'notes', serverValue: 'server note', clientValue: 'phone note', financial: false },
  ]

  it('keeping the server changes nothing', () => {
    expect(
      applyResolution(server, client, divergences, { choice: 'keep_server', reason: 'r' }),
    ).toEqual(server)
  })

  it('keeping the client applies every diverging field', () => {
    expect(
      applyResolution(server, client, divergences, { choice: 'keep_client', reason: 'r' }),
    ).toEqual({ id: 'inv-1', total: 1200, notes: 'phone note' })
  })

  it('a merge takes each field from the side that was chosen', () => {
    const merged = applyResolution(server, client, divergences, {
      choice: 'merge',
      fieldChoices: { total: 'client', notes: 'server' },
      reason: 'r',
    })
    expect(merged).toEqual({ id: 'inv-1', total: 1200, notes: 'server note' })
  })

  it('never invents a field that was not in dispute', () => {
    const merged = applyResolution({ ...server, currency: 'AFN' }, client, divergences, {
      choice: 'keep_client',
      reason: 'r',
    })
    expect(merged.currency).toBe('AFN')
  })
})

describe('financial mutations keep their order', () => {
  it('applies them in the order the device recorded them', () => {
    // A payment applied before the invoice it settles fails; a reversal before
    // its entry books a correction to nothing.
    const ordered = orderMutations([
      { mutationId: 'b', createdAt: 200 },
      { mutationId: 'a', createdAt: 100 },
      { mutationId: 'c', createdAt: 300 },
    ])
    expect(ordered.map((m) => m.mutationId)).toEqual(['a', 'b', 'c'])
  })

  it('breaks a same-millisecond tie the same way every run', () => {
    const first = orderMutations([
      { mutationId: 'z', createdAt: 100 },
      { mutationId: 'a', createdAt: 100 },
    ])
    const second = orderMutations([
      { mutationId: 'a', createdAt: 100 },
      { mutationId: 'z', createdAt: 100 },
    ])
    expect(first.map((m) => m.mutationId)).toEqual(second.map((m) => m.mutationId))
  })
})

describe('the sync path files conflicts instead of discarding them', () => {
  it('records both versions before it refuses a stale write', () => {
    const source = readFileSync(join(__dirname, '..', 'services', 'sync.service.ts'), 'utf8')

    const refusal = source.indexOf("throw new SyncError(\n        'version_conflict'")
    expect(refusal).toBeGreaterThan(-1)

    // The filing must happen BEFORE the throw, or it never happens at all.
    const filing = source.indexOf('this.fileConflict(')
    expect(filing).toBeGreaterThan(-1)
    expect(filing).toBeLessThan(refusal)
  })

  it('ships the migration that preserves both versions', () => {
    const docs = readdirSync(join(__dirname, '..', '..', '..', 'docs'))
    expect(docs).toContain('sync-conflicts-migration.sql')
  })
})
