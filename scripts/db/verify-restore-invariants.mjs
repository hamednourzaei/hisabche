// ============================================
// scripts/db/verify-restore-invariants.mjs
//
// Outcome-Driven System Integrity Standard — Layer 4 Restore Proof
// Verifies real database restore outcomes:
//   1. Checksum & artifact presence
//   2. Table completeness & referential integrity (zero orphaned rows)
//   3. Double-entry ledger balance: SUM(debit_minor) == SUM(credit_minor)
//   4. Workspace tenancy boundary: zero NULL or mismatched workspace_id
// ============================================

import { createHash } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'

/**
 * Calculates SHA-256 checksum of an exported dump or schema file.
 */
export function calculateDumpChecksum(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`RESTORE_FILE_NOT_FOUND: ${filePath}`)
  }
  const content = readFileSync(filePath)
  return createHash('sha256').update(content).digest('hex')
}

/**
 * Pure verification of business invariants on a restored dataset.
 * Can be executed against in-memory rows or a live PostgreSQL client.
 *
 * @param {Object} dataset
 * @param {Array<{id: string, name: string}>} dataset.workspaces
 * @param {Array<{id: string, workspace_id: string, total_minor: number}>} dataset.invoices
 * @param {Array<{id: string, invoice_id: string, product_id?: string}>} dataset.invoice_items
 * @param {Array<{id: string, workspace_id: string, status: string}>} dataset.journal_entries
 * @param {Array<{id: string, journal_entry_id: string, workspace_id: string, debit_minor: number, credit_minor: number}>} dataset.journal_lines
 */
export function verifyRestoreInvariants(dataset) {
  const violations = []

  // 1. Critical tables presence
  const requiredTables = [
    'workspaces',
    'invoices',
    'invoice_items',
    'journal_entries',
    'journal_lines',
  ]
  for (const table of requiredTables) {
    if (!Array.isArray(dataset[table])) {
      violations.push(`MISSING_TABLE_DATA: ${table}`)
    }
  }
  if (violations.length > 0) {
    return { ok: false, violations, counts: {} }
  }

  const { workspaces, invoices, invoice_items, journal_entries, journal_lines } = dataset

  const workspaceIds = new Set(workspaces.map((w) => String(w.id)))
  const invoiceIds = new Set(invoices.map((i) => String(i.id)))
  const entryIds = new Set(journal_entries.map((e) => String(e.id)))

  // 2. Tenancy boundary: every row must carry a valid workspace_id
  for (const inv of invoices) {
    if (!inv.workspace_id || !workspaceIds.has(String(inv.workspace_id))) {
      violations.push(`ORPHANED_WORKSPACE_INVOICE: ${inv.id}`)
    }
  }
  for (const entry of journal_entries) {
    if (!entry.workspace_id || !workspaceIds.has(String(entry.workspace_id))) {
      violations.push(`ORPHANED_WORKSPACE_ENTRY: ${entry.id}`)
    }
  }

  // 3. Foreign key integrity: items must point to existing invoices
  for (const item of invoice_items) {
    if (!item.invoice_id || !invoiceIds.has(String(item.invoice_id))) {
      violations.push(`ORPHANED_INVOICE_ITEM: ${item.id} -> invoice ${item.invoice_id}`)
    }
  }

  // 4. Foreign key integrity: lines must point to existing journal entries
  for (const line of journal_lines) {
    if (!line.journal_entry_id || !entryIds.has(String(line.journal_entry_id))) {
      violations.push(`ORPHANED_JOURNAL_LINE: ${line.id} -> entry ${line.journal_entry_id}`)
    }
  }

  // 5. Double-entry ledger balance: Per-entry and global
  const entrySums = new Map()
  let totalDebits = 0
  let totalCredits = 0

  for (const line of journal_lines) {
    const d = Number(line.debit_minor) || 0
    const c = Number(line.credit_minor) || 0
    totalDebits += d
    totalCredits += c

    const current = entrySums.get(String(line.journal_entry_id)) ?? { debit: 0, credit: 0 }
    current.debit += d
    current.credit += c
    entrySums.set(String(line.journal_entry_id), current)
  }

  for (const [entryId, sum] of entrySums.entries()) {
    if (sum.debit !== sum.credit) {
      violations.push(`UNBALANCED_JOURNAL_ENTRY: ${entryId} (Dr ${sum.debit} != Cr ${sum.credit})`)
    }
  }

  if (totalDebits !== totalCredits) {
    violations.push(`GLOBAL_LEDGER_UNBALANCED: Total Dr ${totalDebits} != Total Cr ${totalCredits}`)
  }

  return {
    ok: violations.length === 0,
    violations,
    counts: {
      workspaces: workspaces.length,
      invoices: invoices.length,
      invoice_items: invoice_items.length,
      journal_entries: journal_entries.length,
      journal_lines: journal_lines.length,
      total_debit_minor: totalDebits,
      total_credit_minor: totalCredits,
    },
  }
}
