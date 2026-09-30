// ============================================
// Engine N9 (data portability side) — snapshots and archives.
// Capabilities #43, #44, #45, #46, #42.
//
// ⚠️ A SNAPSHOT IS NOT A BACKUP, AND THE CONFUSION COSTS A CUSTOMER THEIR
// DATA.
//
// `backup.service.ts` already exports everything and marks it
// `restorable: false` — honestly, because there is no import path — and
// `USER-REQUESTS.md` records that `LESSON 79` is why: the old download button
// produced a file with zero invoices, zero customers and zero payments, and it
// always succeeded. A user who found out at the moment they needed it was the
// failure.
//
// So every test here is about a claim the snapshot must NOT make:
//
//   * a count of 0 for a table the reader could not read — that is a claim
//     about the PAST, and a permission failure does not support it
//   * a snapshot that reads cleanly under a newer schema without saying so
//   * an archive whose README implies you can put it back
//   * a schema comparison that puts 1.10 below 1.9
// ============================================

import { describe, expect, it } from 'vitest'

import {
  ARCHIVE_LAYOUT,
  SNAPSHOT_LIMITATIONS,
  buildSnapshot,
  checkReadable,
  versionNumber,
  type Snapshot,
} from '../services/portability/snapshot.domain'

const snapshot = (over: Partial<Snapshot> = {}): Snapshot =>
  buildSnapshot({
    id: 's-1',
    workspaceId: 'ws-1',
    kind: 'full',
    takenAt: '2026-09-30T10:00:00Z',
    sourceSchemaVersion: '1.9.0',
    counts: { journal_entries: 100, invoices: 42 },
    ...over,
  })

describe('#44 — a snapshot is never restorable, and says so', () => {
  it('carries restorable: false', () => {
    // ⚠️ NOT DROPPED FROM THE SHAPE. A reader that finds no field has to
    // wonder; a reader that finds `false` has been told.
    expect(snapshot().restorable).toBe(false)
  })

  it('states what it cannot answer', () => {
    // ⚠️ The point-in-time story is only true for DOCUMENTS. A renamed account
    // or a re-pointed customer is not effective-dated anywhere, so a snapshot
    // cannot answer for them and says so.
    const result = snapshot()

    expect(result.limitations).toContain(SNAPSHOT_LIMITATIONS[0]!)
    expect(result.limitations.length).toBeGreaterThan(3)
  })
})

describe('#43 — a count the reader could not take stays unknown', () => {
  it('a missing count is ABSENT, not zero', () => {
    // ⚠️ THE failure. Writing 0 says «this table was empty on that date», which
    // is a claim about the past. A permission failure supports no such claim,
    // and a customer told their ledger was empty stops trusting the product.
    const result = snapshot()

    expect(Object.keys(result.counts)).not.toContain('payments')
    expect(result.counts.payments).toBeUndefined()
  })

  it('a count that WAS taken is present', () => {
    const result = snapshot()

    expect(result.counts.journal_entries).toBe(100)
    expect(result.counts.invoices).toBe(42)
  })

  it('an explicit zero is kept, because zero IS a fact', () => {
    const result = buildSnapshot({
      id: 's-1',
      workspaceId: 'ws-1',
      kind: 'full',
      takenAt: '2026-09-30T10:00:00Z',
      sourceSchemaVersion: '1.9.0',
      counts: { payments: 0 },
    })

    expect(result.counts.payments).toBe(0)
  })

  it('lists the tables it covers, so a missing number is explicable', () => {
    expect(snapshot().tables).toContain('journal_entries')
    expect(snapshot().tables).toContain('payments')
  })

  it('a documents-only snapshot leaves the catalogue tables out', () => {
    const documents = snapshot()
    const scoped = buildSnapshot({
      id: 's-2',
      workspaceId: 'ws-1',
      kind: 'documents',
      takenAt: '2026-09-30T10:00:00Z',
      sourceSchemaVersion: '1.9.0',
      counts: {},
    })

    expect(documents.tables.length).toBeGreaterThan(scoped.tables.length)
    expect(scoped.tables).not.toContain('customers')
  })
})

describe('#45 — a schema version mismatch is ANSWERED, not assumed', () => {
  it('the same version reads cleanly', () => {
    expect(checkReadable(snapshot(), '1.9.0').readable).toBe(true)
  })

  it('a NEWER reader can read an older snapshot, and is told it is doing so', () => {
    // ⚠️ A WARNING, NOT A REFUSAL. Refusing would mean a shop cannot open a
    // snapshot from last year after the product updates — the opposite of what
    // snapshots are for.
    const verdict = checkReadable(snapshot(), '1.10.0')

    expect(verdict.readable).toBe(true)
    expect(verdict.reason).toContain('1.9.0')
  })

  it('an OLDER reader REFUSES, because it would read the figures differently', () => {
    const verdict = checkReadable(snapshot(), '1.8.0')

    expect(verdict.readable).toBe(false)
    expect(verdict.reason).toContain('cannot interpret')
  })

  it('1.10.0 is ABOVE 1.9.0, not below it', () => {
    // ⚠️ String comparison puts '1.10.0' before '1.9.0', so a snapshot taken
    // under 1.10 would be judged OLDER than one taken under 1.9 — and the
    // product would refuse snapshots of its own newest data while accepting
    // older ones.
    expect(versionNumber('1.10.0')).toBeGreaterThan(versionNumber('1.9.0')!)
    expect(checkReadable(snapshot({ sourceSchemaVersion: '1.9.0' }), '1.10.0').readable).toBe(true)
  })

  it('an unparseable version refuses rather than guessing', () => {
    expect(versionNumber('not-a-version')).toBeNull()
    expect(checkReadable(snapshot({ sourceSchemaVersion: 'nightly' }), '1.9.0').readable).toBe(
      false,
    )
  })
})

describe('#46 — the archive says it cannot be put back', () => {
  it('leads with a README whose purpose is the warning', () => {
    const readme = ARCHIVE_LAYOUT.find((f) => f.path === 'README.md')

    expect(readme).toBeDefined()
    expect(readme?.purpose).toContain('not restorable')
  })

  it('includes the machine-readable header alongside the human files', () => {
    // ⚠️ THE USER'S STANDING REQUEST (#129): download a backup as Markdown AND
    // Excel. `backup.service.ts` already has `backupToMarkdown` and
    // `backupToXlsx`; this layout is the wiring, not a third format.
    expect(ARCHIVE_LAYOUT.map((f) => f.format)).toContain('md')
    expect(ARCHIVE_LAYOUT.map((f) => f.format)).toContain('xlsx')
    expect(ARCHIVE_LAYOUT.some((f) => f.path === 'snapshot.json')).toBe(true)
  })

  it('the ledger itself is in there, not just the documents', () => {
    // ⚠️ An accountant handed an archive with no ledger in it has been handed
    // invoices and told to reconstruct the books. That is not an export.
    expect(ARCHIVE_LAYOUT.some((f) => f.path.startsWith('ledger/'))).toBe(true)
  })

  it('every file says why a person would open it', () => {
    for (const file of ARCHIVE_LAYOUT) {
      expect(file.purpose.length, file.path).toBeGreaterThan(10)
    }
  })
})
