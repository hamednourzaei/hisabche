// ============================================
// backend/src/__tests__/restore-invariants.test.ts
//
// Layer 4 Restore Proof: Verification of database restore invariants
// (ledger balance, foreign keys, multitenancy, zero orphans).
// ============================================

import { describe, expect, it } from 'vitest'
import { verifyRestoreInvariants } from '../../../scripts/db/verify-restore-invariants.mjs'

describe('Restore Invariant Verification Harness (Layer 4 Proof)', () => {
  const validDataset = {
    workspaces: [{ id: 'ws-1', name: 'Main Shop' }],
    invoices: [{ id: 'inv-1', workspace_id: 'ws-1', total_minor: 1500 }],
    invoice_items: [{ id: 'item-1', invoice_id: 'inv-1', product_id: 'prod-1' }],
    journal_entries: [{ id: 'entry-1', workspace_id: 'ws-1', status: 'posted' }],
    journal_lines: [
      {
        id: 'line-1',
        journal_entry_id: 'entry-1',
        workspace_id: 'ws-1',
        debit_minor: 1500,
        credit_minor: 0,
      },
      {
        id: 'line-2',
        journal_entry_id: 'entry-1',
        workspace_id: 'ws-1',
        debit_minor: 0,
        credit_minor: 1500,
      },
    ],
  }

  it('passes on a valid restored dataset with balanced entries and intact FKs', () => {
    const result = verifyRestoreInvariants(validDataset)
    expect(result.ok).toBe(true)
    expect(result.violations).toHaveLength(0)
    expect(result.counts.total_debit_minor).toBe(1500)
    expect(result.counts.total_credit_minor).toBe(1500)
  })

  it('detects unbalanced ledger journal entries in restored data', () => {
    const corruptDataset = {
      ...validDataset,
      journal_lines: [
        {
          id: 'line-1',
          journal_entry_id: 'entry-1',
          workspace_id: 'ws-1',
          debit_minor: 1500,
          credit_minor: 0,
        },
        {
          id: 'line-2',
          journal_entry_id: 'entry-1',
          workspace_id: 'ws-1',
          debit_minor: 0,
          credit_minor: 1200,
        }, // Corrupted
      ],
    }
    const result = verifyRestoreInvariants(corruptDataset)
    expect(result.ok).toBe(false)
    expect(result.violations.some((v: string) => v.includes('UNBALANCED_JOURNAL_ENTRY'))).toBe(true)
    expect(result.violations.some((v: string) => v.includes('GLOBAL_LEDGER_UNBALANCED'))).toBe(true)
  })

  it('detects orphaned records referencing non-existent foreign keys or workspaces', () => {
    const orphanedDataset = {
      ...validDataset,
      invoice_items: [
        { id: 'item-orphan', invoice_id: 'non-existent-invoice', product_id: 'prod-1' },
      ],
      invoices: [{ id: 'inv-orphan', workspace_id: 'non-existent-workspace', total_minor: 1000 }],
    }
    const result = verifyRestoreInvariants(orphanedDataset)
    expect(result.ok).toBe(false)
    expect(result.violations.some((v: string) => v.includes('ORPHANED_INVOICE_ITEM'))).toBe(true)
    expect(result.violations.some((v: string) => v.includes('ORPHANED_WORKSPACE_INVOICE'))).toBe(
      true,
    )
  })
})
