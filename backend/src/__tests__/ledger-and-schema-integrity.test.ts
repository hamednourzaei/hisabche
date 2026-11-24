import { describe, expect, it } from 'vitest'
import {
  validateEntryLines,
  normaliseLines,
  reverseLines,
  type LedgerAccountFacts,
} from '../services/accounting/accounting.domain'
import { toTrialBalance, trialBalanceTotals } from '../services/accounting/accounting.reports'
import { SchemaFingerprintEngine } from '../db/index'

describe('Phase 6: Ledger, Financial Posting Integrity & Schema Parity', () => {
  const mockAccounts = new Map<string, LedgerAccountFacts>([
    ['acc-cash', { id: 'acc-cash', type: 'asset', isGroup: false, isActive: true }],
    ['acc-ar', { id: 'acc-ar', type: 'asset', isGroup: false, isActive: true }],
    ['acc-inventory', { id: 'acc-inventory', type: 'asset', isGroup: false, isActive: true }],
    ['acc-ap', { id: 'acc-ap', type: 'liability', isGroup: false, isActive: true }],
    ['acc-revenue', { id: 'acc-revenue', type: 'revenue', isGroup: false, isActive: true }],
    ['acc-bank', { id: 'acc-bank', type: 'asset', isGroup: false, isActive: true }],
  ])

  describe('Double-Entry Ledger Invariants', () => {
    it('accepts balanced entry lines (Debits === Credits)', () => {
      const lines = [
        { accountId: 'acc-cash', debit: 10000, credit: 0 },
        { accountId: 'acc-ar', debit: 0, credit: 10000 },
      ]

      const violations = validateEntryLines(lines, mockAccounts)
      expect(violations).toHaveLength(0)

      const normalised = normaliseLines(lines)
      const totalDebit = normalised.reduce((sum, l) => sum + l.debit, 0)
      const totalCredit = normalised.reduce((sum, l) => sum + l.credit, 0)
      expect(totalDebit).toBe(10000)
      expect(totalCredit).toBe(10000)
      expect(totalDebit).toBe(totalCredit)
    })

    it('rejects an unbalanced entry (even a 1-unit minor difference)', () => {
      const lines = [
        { accountId: 'acc-cash', debit: 10001, credit: 0 },
        { accountId: 'acc-ar', debit: 0, credit: 10000 },
      ]

      const violations = validateEntryLines(lines, mockAccounts)
      expect(violations.length).toBeGreaterThan(0)
      expect(violations.some((v) => v.code === 'JOURNAL_ENTRY_UNBALANCED')).toBe(true)
    })

    it('rejects negative debit or credit values', () => {
      const lines = [
        { accountId: 'acc-cash', debit: -500, credit: 0 },
        { accountId: 'acc-ar', debit: 0, credit: -500 },
      ]

      const violations = validateEntryLines(lines, mockAccounts)
      expect(violations.some((v) => v.code === 'JOURNAL_LINE_NEGATIVE')).toBe(true)
    })

    it('rejects a line where both debit and credit are populated', () => {
      const lines = [
        { accountId: 'acc-cash', debit: 500, credit: 500 },
        { accountId: 'acc-ar', debit: 0, credit: 1000 },
      ]

      const violations = validateEntryLines(lines, mockAccounts)
      expect(violations.some((v) => v.code === 'JOURNAL_LINE_TWO_SIDED')).toBe(true)
    })

    it('generates an exact linked reversal entry with inverted debits and credits', () => {
      const lines = [
        { accountId: 'acc-inventory', debit: 5000, credit: 0 },
        { accountId: 'acc-ap', debit: 0, credit: 5000 },
      ]

      const reversed = reverseLines(lines)
      expect(reversed[0]!.accountId).toBe('acc-inventory')
      expect(reversed[0]!.debit).toBe(0)
      expect(reversed[0]!.credit).toBe(5000) // Inverted

      expect(reversed[1]!.accountId).toBe('acc-ap')
      expect(reversed[1]!.debit).toBe(5000) // Inverted
      expect(reversed[1]!.credit).toBe(0)

      // Reversal is also perfectly balanced
      expect(validateEntryLines(reversed, mockAccounts)).toHaveLength(0)
    })

    it('preserves AFN integer minor amounts without scaling or division', () => {
      const afnAmount = 250000 // 250,000 AFN
      const lines = [
        { accountId: 'acc-bank', debit: afnAmount, credit: 0 },
        { accountId: 'acc-revenue', debit: 0, credit: afnAmount },
      ]

      expect(lines[0]!.debit).toBe(250000)
      expect(lines[0]!.debit % 1).toBe(0) // Integer, zero float
      expect(validateEntryLines(lines, mockAccounts)).toHaveLength(0)
    })
  })

  describe('Accounting Reconciliation & Trial Balance', () => {
    it('computes balanced trial balance report from ledger accounts', () => {
      const ledgerTotals = [
        {
          accountId: '1',
          accountCode: '1000',
          accountName: 'Cash',
          accountType: 'asset' as const,
          debit: 75000,
          credit: 0,
        },
        {
          accountId: '2',
          accountCode: '1200',
          accountName: 'Accounts Receivable',
          accountType: 'asset' as const,
          debit: 25000,
          credit: 0,
        },
        {
          accountId: '3',
          accountCode: '2000',
          accountName: 'Accounts Payable',
          accountType: 'liability' as const,
          debit: 0,
          credit: 40000,
        },
        {
          accountId: '4',
          accountCode: '3000',
          accountName: 'Owner Equity',
          accountType: 'equity' as const,
          debit: 0,
          credit: 60000,
        },
      ]

      const tbRows = toTrialBalance(ledgerTotals)
      expect(tbRows).toHaveLength(4)

      const totals = trialBalanceTotals(tbRows)
      expect(totals.totalDebit).toBe(100000)
      expect(totals.totalCredit).toBe(100000)
      expect(totals.difference).toBe(0)
    })
  })

  describe('Schema Parity & Promotion Gate', () => {
    const catalogPrimary = {
      tables: [
        {
          name: 'invoices',
          columns: [
            { name: 'id', type: 'uuid', nullable: false },
            { name: 'workspace_id', type: 'uuid', nullable: false },
            { name: 'total_minor', type: 'bigint', nullable: false },
          ],
        },
        {
          name: 'journal_entries',
          columns: [
            { name: 'id', type: 'uuid', nullable: false },
            { name: 'entry_number', type: 'text', nullable: false },
          ],
        },
      ],
      functions: ['invoice_write_document', 'accounting_post_journal_entry'],
      triggers: ['sync_change_log_trigger'],
    }

    it('computes identical fingerprint for identical schemas', () => {
      const fp1 = SchemaFingerprintEngine.computeFromCatalog(catalogPrimary)
      const fp2 = SchemaFingerprintEngine.computeFromCatalog(catalogPrimary)
      expect(fp1).toBe(fp2)
      expect(fp1).toHaveLength(64) // SHA-256 hex string

      const gateResult = SchemaFingerprintEngine.assertPromotionGate(fp1, fp2)
      expect(gateResult.matches).toBe(true)
    })

    it('blocks promotion when standby schema has diverged (Promotion Gate)', () => {
      const fpPrimary = SchemaFingerprintEngine.computeFromCatalog(catalogPrimary)

      const catalogStandbyWithMissingColumn = {
        ...catalogPrimary,
        tables: [
          {
            name: 'invoices',
            columns: [
              { name: 'id', type: 'uuid', nullable: false },
              // missing workspace_id!
              { name: 'total_minor', type: 'bigint', nullable: false },
            ],
          },
          catalogPrimary.tables[1]!,
        ],
      }

      const fpStandby = SchemaFingerprintEngine.computeFromCatalog(catalogStandbyWithMissingColumn)
      expect(fpPrimary).not.toBe(fpStandby)

      expect(() => SchemaFingerprintEngine.assertPromotionGate(fpPrimary, fpStandby)).toThrow(
        /Promotion Gate BLOCKED/,
      )
    })
  })
})
