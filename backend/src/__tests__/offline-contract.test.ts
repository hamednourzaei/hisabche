// ============================================
// backend/src/__tests__/offline-contract.test.ts
//
// Every module's offline position is a DECISION, and this file is where it is
// written down and enforced.
//
// ---------------------------------------------------------------------------
// WHY "MAKE EVERYTHING OFFLINE" IS THE WRONG ANSWER
//
// Hisabche is offline-first, so the instinct is that every capability should
// sync. It should not, and the cases that should NOT are not oversights:
//
//   · A BUDGET is a limit an owner sets. Two devices editing it offline
//     produce two different ceilings, and merging them means picking whose
//     spending limit is real.
//   · A BANK STATEMENT is imported from a file the bank produced. Importing
//     offline on two devices and syncing both doubles every movement in the
//     account.
//   · An EXCHANGE RATE is reference data. The tax engine already settled this
//     shape: the rate is frozen onto the document when it is written, so the
//     document is correct offline without the rate table being writable.
//   · DEPRECIATION is derived from a schedule the server owns. A device that
//     could post it could post a month twice.
//
// A TIME ENTRY is the opposite case and is why the list is not empty: someone
// on a site with no signal writes down hours, and those hours are theirs to
// record. It syncs.
//
// ---------------------------------------------------------------------------
// WHAT THIS TEST IS FOR
//
// Without it, "we decided X should not sync" and "we forgot X" look identical
// in the code six months from now. Adding an entity to the protocol without
// coming here to say why fails the suite.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { syncEntitySchema } from '@hisabche/validation'

const ROOT = join(__dirname, '..', '..', '..')

const syncService = readFileSync(
  join(ROOT, 'backend', 'src', 'services', 'sync.service.ts'),
  'utf8',
)
const gc = readFileSync(join(ROOT, 'packages', 'sync', 'src', 'gc.ts'), 'utf8')

/** What the protocol accepts today. */
const entities = syncEntitySchema.options as readonly string[]

/**
 * The decision, per capability. Changing an answer here is changing the
 * product, which is exactly the bar it should have to clear.
 */
const OFFLINE_POSITION: Record<string, { syncs: boolean; because: string }> = {
  invoice: { syncs: true, because: 'a sale happens whether or not there is signal' },
  customer: { syncs: true, because: 'a new buyer is recorded at the counter' },
  product: { syncs: true, because: 'stock is counted where the stock is' },
  transaction: { syncs: true, because: 'money moves in the shop, not in the datacentre' },
  time_entry: { syncs: true, because: 'hours are logged on site, with no signal' },

  budget: { syncs: false, because: 'a limit edited on two devices is two limits' },
  dimension: { syncs: false, because: 'configuration, set once by an owner' },
  bank_statement: {
    syncs: false,
    because: 'imported from a file; syncing two imports doubles the account',
  },
  exchange_rate: { syncs: false, because: 'reference data, frozen onto the document instead' },
  fixed_asset: { syncs: false, because: 'depreciation is derived from a server-owned schedule' },
}

describe('the offline contract', () => {
  it('every entity in the protocol has a recorded reason', () => {
    const undocumented = entities.filter((entity) => !OFFLINE_POSITION[entity])

    expect(
      undocumented,
      'these entities sync but nobody wrote down why — add them to OFFLINE_POSITION',
    ).toEqual([])
  })

  it('nothing marked "does not sync" is in the protocol', () => {
    const contradictions = Object.entries(OFFLINE_POSITION)
      .filter(([entity, position]) => !position.syncs && entities.includes(entity))
      .map(([entity]) => entity)

    expect(
      contradictions,
      'these are documented as deliberately offline-excluded, yet the protocol accepts them',
    ).toEqual([])
  })

  it('everything marked "syncs" is actually in the protocol', () => {
    const missing = Object.entries(OFFLINE_POSITION)
      .filter(([entity, position]) => position.syncs && !entities.includes(entity))
      .map(([entity]) => entity)

    expect(missing, 'documented as syncing, but the protocol would reject it').toEqual([])
  })

  it('every syncing entity has a table, a column allow-list and a retention policy', () => {
    // Three separate places have to agree. A protocol entry with no table is a
    // 500; with no allow-list it writes nothing; with no retention policy the
    // device keeps its rows forever and the phone fills up.
    for (const entity of entities) {
      expect(syncService, `${entity} has no physical table`).toMatch(
        new RegExp(`${entity}:\\s*'\\w+'`),
      )
      expect(syncService, `${entity} has no writable column list`).toMatch(
        new RegExp(`${entity}:\\s*\\[`),
      )
      expect(gc, `${entity} has no retention policy`).toMatch(
        new RegExp(`${entity}:\\s*\\{\\s*keepDays`),
      )
    }
  })

  it('no allow-list lets a device write a field the server owns', () => {
    // Tenancy and versioning are the server's everywhere, without exception.
    // Accepting any of them from a client is how a row lands in someone else's
    // workspace.
    const alwaysServerOwned = ['workspace_id', 'user_id', 'version', 'created_at', 'finalized_at']

    const lists = syncService.match(/WRITABLE[\s\S]*?\n\}/)?.[0] ?? ''

    for (const field of alwaysServerOwned) {
      expect(lists, `a device may write \`${field}\`, which is the server's to set`).not.toMatch(
        new RegExp(`'${field}'`),
      )
    }
  })

  it('a device cannot un-bill hours it does not own', () => {
    // `invoice_id` is NOT server-owned everywhere, and the difference matters.
    //
    // On a TRANSACTION it is the device's own information: a payment taken at
    // the counter knows which invoice it settles, and refusing it would make
    // offline payments unattachable.
    //
    // On a TIME ENTRY it is the LOCK. Its presence is what says those hours
    // are already on a bill. A device that could send it could clear the lock
    // on hours somebody has been invoiced and paid for, or claim hours a
    // colleague already billed.
    const timeEntryList = /time_entry:\s*\[([\s\S]*?)\]/.exec(syncService)?.[1] ?? ''

    expect(timeEntryList, 'the time_entry allow-list was not found').not.toBe('')
    expect(
      timeEntryList,
      'a device may write `invoice_id` on a time entry — that is the billing lock',
    ).not.toMatch(/'invoice_id'/)
  })
})
