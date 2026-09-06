// ============================================
// backend/src/__tests__/offline-invoice-gap.test.ts
//
// M2 — ⚠️ A STOP CONDITION, PINNED.
//
// ---------------------------------------------------------------------------
// WHAT AN OFFLINE INVOICE ACTUALLY DOES TODAY
//
// `packages/sync/src/http-transport.ts` posts queued offline writes to
// `/sync/push`. `sync.service.execute()` then INSERTS DIRECTLY INTO THE TABLE:
//
//   • it never calls `InvoiceService`
//   • `WRITABLE.invoice` has no `items`, so no `invoice_items` rows are written
//   • `stock_movements` appears nowhere in the file
//
// So an offline sale syncs in as an INVOICE HEADER AND NOTHING ELSE. It has a
// total and a customer. It has no lines, moves no stock, consumes no cost
// layer, and posts no journal entry.
//
// It is in the receivables and in no other subsystem.
//
// ---------------------------------------------------------------------------
// WHY THIS TEST EXISTS RATHER THAN A FIX
//
// Routing sync's invoice path through `InvoiceService.create` is the right
// answer and is NOT a small change: that method runs the approval gate (G6),
// the costing chain, the ledger post and the branch resolution, and it
// interacts with sync's own idempotency and with `pickWritable`. Doing it in
// passing is how money breaks.
//
// So the state is pinned. If someone routes sync through the service, these
// assertions fail and force the change to be deliberate — which is the point.
//
// It also means M2's stated scenario (two offline tills overselling) CANNOT
// occur through the offline path today: stock never goes negative because it
// never moves. The detection built in M2 fires on the ONLINE path, where
// stock does move, and is ready for the offline one the moment it does.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SYNC = readFileSync(join(__dirname, '..', 'services', 'sync.service.ts'), 'utf8')
const code = SYNC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('⚠️ PINNED GAP — offline invoices are headers only', () => {
  it('the sync path never writes a stock movement', () => {
    // If this fails, someone taught sync to move stock. Good — but then the
    // costing, the ledger and the approval gate need to move with it, and
    // this file's header explains why.
    expect(code).not.toContain('stock_movements')
  })

  it('the sync path never calls the invoice service', () => {
    expect(code).not.toContain('InvoiceService')
    expect(code).not.toContain('batchUpdateStock')
  })

  it('an offline invoice cannot carry line items', () => {
    // `WRITABLE.invoice` is an allow-list. Without `items` the lines simply
    // do not arrive, so even a client that sends them writes a header.
    const writable = /invoice:\s*\[([\s\S]*?)\]/.exec(code)?.[1] ?? ''
    expect(writable).not.toContain("'items'")
    expect(writable).not.toContain("'invoice_items'")
  })

  it('the sync path posts no journal entry', () => {
    expect(code).not.toContain('ledger.')
    expect(code).not.toContain('postDocument')
  })
})

describe('what IS solid on the offline path', () => {
  it('idempotency is checked before anything touches money (M2.5)', () => {
    // The replay gate runs first, and the recorded outcome is returned
    // verbatim — a replayed mutation creates no second sale, payment,
    // movement or journal entry.
    const applyOne = code.slice(code.indexOf('private async applyOne'))
    const body = applyOne.slice(0, 900)
    expect(body).toContain('findRecordedMutation')
    expect(body.indexOf('findRecordedMutation')).toBeLessThan(body.indexOf('this.execute'))
  })

  it('a retryable failure is NOT recorded, so the retry can still succeed', () => {
    // Recording it would freeze a transient failure into a permanent one on
    // every replay of that mutation id.
    expect(code).toContain('if (!retryable)')
  })

  it('the workspace comes from the verified actor, never the payload', () => {
    expect(code).toContain('workspace_id: actor.workspaceId')
  })
})
