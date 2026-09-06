// ============================================
// backend/src/__tests__/workspace-backup.test.ts
//
// G7 — a backup that contains the business's data.
//
// ---------------------------------------------------------------------------
// WHAT IT USED TO CONTAIN
//
// The settings button serialised `useBackupStore()`:
//
//     { backups: state.backups, auditLog: state.auditLog, exportedAt }
//
// `state.backups` is the list of PREVIOUS BACKUP ENTRIES in localStorage. So
// the downloaded file was metadata about backups that had never held anything.
// No invoices, no customers, no products, no payments.
//
// It succeeded every time, which is why nobody found it. The failure was
// reserved for the one moment it mattered.
//
// ---------------------------------------------------------------------------
// WHAT IS ASSERTED HERE
//
// The database is mocked in this suite, so this cannot prove rows come back.
// What it CAN prove is the shape of the thing: that the export names the
// tables a business is made of, that every read is workspace-scoped, and that
// it does not claim to be restorable when nothing can restore it.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SOURCE = readFileSync(
  join(__dirname, '..', 'services', 'workspace', 'backup.service.ts'),
  'utf8',
)

/** Comments stripped — a guard that reads prose reports the mention of a bug
 *  as the bug. Lesson 77. */
const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

/**
 * The tables a shopkeeper would need to reconstruct their books.
 *
 * A backup missing any of these is not a backup — it is a partial export that
 * will be discovered incomplete at the worst possible moment, which is exactly
 * the failure this replaced.
 */
const ESSENTIAL = [
  'invoices',
  'invoice_items',
  'customers',
  'products',
  'payments',
  'payment_allocations',
  'stock_movements',
  'accounts',
  'journal_entries',
  'journal_lines',
]

describe('the backup contains the business', () => {
  it.each(ESSENTIAL)('exports %s', (table) => {
    expect(code).toContain(`table: '${table}'`)
  })

  it('does not export the derived projections', () => {
    // `warehouse_stock` is a projection of `stock_movements` (Phase C). Both in
    // one file could be restored disagreeing, and the projection is rebuildable
    // from the source that IS exported.
    expect(code).not.toContain("table: 'warehouse_stock'")
  })
})

describe('every read is scoped to the caller’s workspace', () => {
  it('filters by workspace_id from the context', () => {
    // A backup is the widest read in the product. If this filter is ever
    // dropped, one request returns every business on the platform.
    expect(code).toContain("eq('workspace_id', ctx.workspaceId)")
  })

  it('takes the workspace from the context, never from an argument', () => {
    // The entry point's ONLY input is the verified context. A `workspaceId`
    // parameter here would let a caller name someone else's workspace, which
    // on this endpoint is the widest IDOR the product could have.
    //
    // ⚠️ Asserted on the SIGNATURE, not on the whole file: `meta.workspaceId`
    // is the exported metadata and a file-wide search matches it. The first
    // version of this test did exactly that and failed on the output type.
    const signature = /async export\(([^)]*)\)/.exec(code)?.[1] ?? ''
    expect(signature).toContain('ctx: TenancyContext')
    expect(signature).not.toContain('workspaceId')
  })

  it('is refused for anyone but the owner', () => {
    expect(code).toContain("ctx.role !== 'owner'")
    // A 403, not a 500 — a deliberate refusal reported as a server fault is
    // indistinguishable from a bug to the person refused.
    expect(code).toContain('ForbiddenError')
  })
})

describe('the file is honest about what it is', () => {
  it('says it cannot be restored', () => {
    // There is no import path. Claiming otherwise would be the same lie one
    // level further on.
    expect(code).toContain('restorable: false')
  })

  it('reports tables that were cut short or failed', () => {
    // A silently short backup fails the same way an empty one does.
    expect(code).toContain('truncatedTables')
    expect(code).toContain('failedTables')
  })

  it('detects the cap rather than guessing at it', () => {
    // Fetching ROW_CAP + 1 is what makes `truncated` decidable: exactly
    // ROW_CAP rows with no extra row would be ambiguous.
    expect(code).toContain('ROW_CAP + 1')
  })
})

describe('the settings screen no longer downloads localStorage', () => {
  const settings = readFileSync(
    join(
      __dirname,
      '..',
      '..',
      '..',
      'packages',
      'ui',
      'src',
      'components',
      'ui',
      'settings',
      'settings-page.tsx',
    ),
    'utf8',
  )
  const settingsCode = settings.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  it('calls the server export, not the store’s exportData', () => {
    expect(settingsCode).toContain('useWorkspaceBackup')
    // The exact call that produced the worthless file.
    expect(settingsCode).not.toContain('exportData()')
  })
})
