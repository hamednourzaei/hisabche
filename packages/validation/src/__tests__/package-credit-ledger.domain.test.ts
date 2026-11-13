// ============================================
// packages/validation/src/__tests__/package-credit-ledger.domain.test.ts
//
// M3 — PACKAGE CREDIT & ENTITLEMENT LEDGER
// Exhaustive pure domain tests for 3 distinct truths:
//   1. Package Credit / Entitlement Truth (append-only ledger of facts)
//   2. Payment Truth (handled strictly by existing payment engine)
//   3. Accounting Truth (handled strictly by existing double-entry ledger)
// ============================================

import { describe, expect, it } from 'vitest'
import {
  type PackageCreditEntry,
  derivePackageBalance,
  canConsumeCredit,
  planPackageConsumption,
  planPackageReversal,
  planPackageExpiration,
  planPackageAdjustment,
  planPackageGrant,
  filterEntriesForAccount,
} from '../schemas/universal-core/package-credit-ledger.domain'

describe('M3: Package Credit & Entitlement Ledger (Pure Domain)', () => {
  const ws1 = 'workspace-001'
  const cust1 = 'customer-001'
  const cust2 = 'customer-002'
  const pkg1 = 'product-pkg-10-sessions'
  const pkg2 = 'product-pkg-5-massages'

  // Helper to build a valid entry
  function makeEntry(overrides: Partial<PackageCreditEntry>): PackageCreditEntry {
    return {
      id: overrides.id || 'entry-test-1',
      workspaceId: overrides.workspaceId || ws1,
      customerId: overrides.customerId || cust1,
      packageProductId: overrides.packageProductId || pkg1,
      entryType: overrides.entryType || 'GRANT',
      quantity: overrides.quantity ?? 10,
      unit: overrides.unit ?? 'session',
      sourceDocumentType: overrides.sourceDocumentType ?? 'invoice',
      sourceDocumentId: overrides.sourceDocumentId ?? 'inv-001',
      sourceLineId: overrides.sourceLineId ?? 'inv-line-1',
      referenceEntryId: overrides.referenceEntryId ?? null,
      idempotencyKey: overrides.idempotencyKey ?? null,
      notes: overrides.notes ?? null,
      effectiveDate: overrides.effectiveDate ?? '2026-11-01',
      createdAt: overrides.createdAt ?? '2026-11-01T10:00:00Z',
    }
  }

  // 1. Balance derivation: empty entries return 0
  it('1. derivePackageBalance returns 0 for empty entries', () => {
    expect(derivePackageBalance([])).toBe(0)
  })

  // 2. Balance derivation: GRANT adds quantity
  it('2. derivePackageBalance adds GRANT quantities', () => {
    const entries = [
      makeEntry({ id: 'g1', entryType: 'GRANT', quantity: 10 }),
      makeEntry({ id: 'g2', entryType: 'GRANT', quantity: 5 }),
    ]
    expect(derivePackageBalance(entries)).toBe(15)
  })

  // 3. Balance derivation: CONSUME subtracts quantity
  it('3. derivePackageBalance subtracts CONSUME quantities', () => {
    const entries = [
      makeEntry({ id: 'g1', entryType: 'GRANT', quantity: 10 }),
      makeEntry({ id: 'c1', entryType: 'CONSUME', quantity: 3 }),
    ]
    expect(derivePackageBalance(entries)).toBe(7)
  })

  // 4. Balance derivation: REVERSAL adds quantity (restores consumed credits)
  it('4. derivePackageBalance adds REVERSAL quantities', () => {
    const entries = [
      makeEntry({ id: 'g1', entryType: 'GRANT', quantity: 10 }),
      makeEntry({ id: 'c1', entryType: 'CONSUME', quantity: 3 }),
      makeEntry({ id: 'r1', entryType: 'REVERSAL', referenceEntryId: 'c1', quantity: 1 }),
    ]
    expect(derivePackageBalance(entries)).toBe(8)
  })

  // 5. Balance derivation: EXPIRE subtracts quantity
  it('5. derivePackageBalance subtracts EXPIRE quantities', () => {
    const entries = [
      makeEntry({ id: 'g1', entryType: 'GRANT', quantity: 10 }),
      makeEntry({ id: 'c1', entryType: 'CONSUME', quantity: 4 }),
      makeEntry({ id: 'e1', entryType: 'EXPIRE', quantity: 6 }),
    ]
    expect(derivePackageBalance(entries)).toBe(0)
  })

  // 6. Balance derivation: positive ADJUSTMENT adds quantity
  it('6. derivePackageBalance adds positive ADJUSTMENT quantities', () => {
    const entries = [
      makeEntry({ id: 'g1', entryType: 'GRANT', quantity: 10 }),
      makeEntry({ id: 'a1', entryType: 'ADJUSTMENT', quantity: 2 }),
    ]
    expect(derivePackageBalance(entries)).toBe(12)
  })

  // 7. Balance derivation: negative ADJUSTMENT subtracts quantity
  it('7. derivePackageBalance subtracts negative ADJUSTMENT quantities', () => {
    const entries = [
      makeEntry({ id: 'g1', entryType: 'GRANT', quantity: 10 }),
      makeEntry({ id: 'a1', entryType: 'ADJUSTMENT', quantity: -3 }),
    ]
    expect(derivePackageBalance(entries)).toBe(7)
  })

  // 8. Universal formula: Remaining = Grants + Adjustments + Reversals - Consumes - Expirations
  it('8. derivePackageBalance satisfies universal formula across mixed lifecycle', () => {
    const entries = [
      makeEntry({ id: 'g1', entryType: 'GRANT', quantity: 20 }),
      makeEntry({ id: 'c1', entryType: 'CONSUME', quantity: 5 }),
      makeEntry({ id: 'c2', entryType: 'CONSUME', quantity: 4 }),
      makeEntry({ id: 'r1', entryType: 'REVERSAL', referenceEntryId: 'c2', quantity: 2 }),
      makeEntry({ id: 'a1', entryType: 'ADJUSTMENT', quantity: -1 }),
      makeEntry({ id: 'e1', entryType: 'EXPIRE', quantity: 4 }),
    ]
    // 20 - 5 - 4 + 2 - 1 - 4 = 8
    expect(derivePackageBalance(entries)).toBe(8)
  })

  // 9. canConsumeCredit: true when quantity <= current balance
  it('9. canConsumeCredit returns true when requested <= balance', () => {
    expect(canConsumeCredit(10, 5)).toBe(true)
    expect(canConsumeCredit(10, 10)).toBe(true)
  })

  // 10. canConsumeCredit: false when quantity > balance
  it('10. canConsumeCredit returns false when requested > balance', () => {
    expect(canConsumeCredit(5, 6)).toBe(false)
    expect(canConsumeCredit(0, 1)).toBe(false)
  })

  // 11. canConsumeCredit: false for zero or negative requested quantity
  it('11. canConsumeCredit returns false for non-positive requested quantity', () => {
    expect(canConsumeCredit(10, 0)).toBe(false)
    expect(canConsumeCredit(10, -1)).toBe(false)
  })

  // 12. Fail-closed on over-consumption
  it('12. planPackageConsumption throws INSUFFICIENT_PACKAGE_CREDIT on overdraw', () => {
    const entries = [makeEntry({ id: 'g1', entryType: 'GRANT', quantity: 3 })]
    expect(() =>
      planPackageConsumption({
        entries,
        workspaceId: ws1,
        customerId: cust1,
        packageProductId: pkg1,
        quantity: 4,
      }),
    ).toThrow('INSUFFICIENT_PACKAGE_CREDIT')
  })

  // 13. planPackageConsumption rejects non-positive quantity
  it('13. planPackageConsumption throws on zero or negative quantity', () => {
    const entries = [makeEntry({ id: 'g1', entryType: 'GRANT', quantity: 10 })]
    expect(() =>
      planPackageConsumption({
        entries,
        workspaceId: ws1,
        customerId: cust1,
        packageProductId: pkg1,
        quantity: 0,
      }),
    ).toThrow()
    expect(() =>
      planPackageConsumption({
        entries,
        workspaceId: ws1,
        customerId: cust1,
        packageProductId: pkg1,
        quantity: -2,
      }),
    ).toThrow()
  })

  // 14. planPackageConsumption produces valid CONSUME entry and calculates new balance
  it('14. planPackageConsumption produces CONSUME entry and calculates remaining balance', () => {
    const entries = [makeEntry({ id: 'g1', entryType: 'GRANT', quantity: 10 })]
    const result = planPackageConsumption({
      entries,
      workspaceId: ws1,
      customerId: cust1,
      packageProductId: pkg1,
      quantity: 2,
      unit: 'session',
      sourceDocumentType: 'service_delivery',
      sourceDocumentId: 'delivery-001',
      notes: 'Customer attended session 1',
    })

    expect(result.entry.entryType).toBe('CONSUME')
    expect(result.entry.quantity).toBe(2)
    expect(result.entry.customerId).toBe(cust1)
    expect(result.entry.packageProductId).toBe(pkg1)
    expect(result.newBalance).toBe(8)
  })

  // 15. Idempotency: no double-consumption when idempotencyKey matches
  it('15. planPackageConsumption is idempotent when idempotencyKey is reused', () => {
    const existingConsume = makeEntry({
      id: 'c1',
      entryType: 'CONSUME',
      quantity: 2,
      idempotencyKey: 'idemp-session-123',
    })
    const entries = [makeEntry({ id: 'g1', entryType: 'GRANT', quantity: 10 }), existingConsume]

    const result = planPackageConsumption({
      entries,
      workspaceId: ws1,
      customerId: cust1,
      packageProductId: pkg1,
      quantity: 2,
      idempotencyKey: 'idemp-session-123',
    })

    // Returns existing entry and doesn't double-decrement
    expect(result.entry.id).toBe('c1')
    expect(result.newBalance).toBe(8)
  })

  // 16. planPackageReversal restores credit balance
  it('16. planPackageReversal creates REVERSAL linked to referenceEntryId and restores balance', () => {
    const entries = [
      makeEntry({ id: 'g1', entryType: 'GRANT', quantity: 10 }),
      makeEntry({ id: 'c1', entryType: 'CONSUME', quantity: 3 }),
    ]

    const result = planPackageReversal({
      entries,
      referenceEntryId: 'c1',
      quantity: 2,
      notes: 'Session cancelled by tutor',
    })

    expect(result.entry.entryType).toBe('REVERSAL')
    expect(result.entry.referenceEntryId).toBe('c1')
    expect(result.entry.quantity).toBe(2)
    expect(result.newBalance).toBe(9) // 10 - 3 + 2 = 9
  })

  // 17. planPackageReversal throws when referenceEntryId does not exist
  it('17. planPackageReversal throws when referenceEntryId does not exist', () => {
    const entries = [makeEntry({ id: 'g1', entryType: 'GRANT', quantity: 10 })]
    expect(() =>
      planPackageReversal({
        entries,
        referenceEntryId: 'non-existent',
        quantity: 1,
      }),
    ).toThrow('REFERENCE_ENTRY_NOT_FOUND')
  })

  // 18. planPackageReversal throws when target is not a CONSUME entry
  it('18. planPackageReversal throws when referenceEntryId is not a CONSUME entry', () => {
    const entries = [makeEntry({ id: 'g1', entryType: 'GRANT', quantity: 10 })]
    expect(() =>
      planPackageReversal({
        entries,
        referenceEntryId: 'g1',
        quantity: 1,
      }),
    ).toThrow('CANNOT_REVERSE_NON_CONSUMPTION_ENTRY')
  })

  // 19. planPackageReversal throws when reversing more than original quantity
  it('19. planPackageReversal throws when reversing more than consumed quantity', () => {
    const entries = [
      makeEntry({ id: 'g1', entryType: 'GRANT', quantity: 10 }),
      makeEntry({ id: 'c1', entryType: 'CONSUME', quantity: 2 }),
    ]
    expect(() =>
      planPackageReversal({
        entries,
        referenceEntryId: 'c1',
        quantity: 3,
      }),
    ).toThrow('REVERSAL_EXCEEDS_CONSUMED_QUANTITY')
  })

  // 20. planPackageReversal prevents double-reversal across multiple calls
  it('20. planPackageReversal prevents cumulative reversals from exceeding original consume', () => {
    const entries = [
      makeEntry({ id: 'g1', entryType: 'GRANT', quantity: 10 }),
      makeEntry({ id: 'c1', entryType: 'CONSUME', quantity: 3 }),
      makeEntry({ id: 'r1', entryType: 'REVERSAL', referenceEntryId: 'c1', quantity: 2 }),
    ]
    // Remaining reversible is 3 - 2 = 1. Requesting 2 must throw!
    expect(() =>
      planPackageReversal({
        entries,
        referenceEntryId: 'c1',
        quantity: 2,
      }),
    ).toThrow('REVERSAL_EXCEEDS_CONSUMED_QUANTITY')
  })

  // 21. planPackageExpiration zeroes out balance
  it('21. planPackageExpiration creates EXPIRE entry that brings balance to 0', () => {
    const entries = [
      makeEntry({ id: 'g1', entryType: 'GRANT', quantity: 10 }),
      makeEntry({ id: 'c1', entryType: 'CONSUME', quantity: 4 }),
    ]
    const result = planPackageExpiration({
      entries,
      workspaceId: ws1,
      customerId: cust1,
      packageProductId: pkg1,
      notes: 'End of 6-month validity period',
    })

    expect(result.entry).not.toBeNull()
    expect(result.entry?.entryType).toBe('EXPIRE')
    expect(result.entry?.quantity).toBe(6)
    expect(result.newBalance).toBe(0)
  })

  // 22. Expiration separates entitlement from money/refund
  it('22. planPackageExpiration separates entitlement from money without creating cash refund', () => {
    const entries = [makeEntry({ id: 'g1', entryType: 'GRANT', quantity: 5 })]
    const result = planPackageExpiration({
      entries,
      workspaceId: ws1,
      customerId: cust1,
      packageProductId: pkg1,
    })

    // Entitlement is 0
    expect(result.newBalance).toBe(0)
    // No payment/cash effect is generated by expiration
    expect(result.entry?.entryType).toBe('EXPIRE')
    expect((result.entry as any).cashRefundAmount).toBeUndefined()
  })

  // 23. planPackageAdjustment adjusts balance
  it('23. planPackageAdjustment adjusts balance without touching payment records', () => {
    const entries = [makeEntry({ id: 'g1', entryType: 'GRANT', quantity: 5 })]
    const result = planPackageAdjustment({
      entries,
      workspaceId: ws1,
      customerId: cust1,
      packageProductId: pkg1,
      quantityDelta: -2,
      notes: 'Customer transferred 2 sessions to another branch',
    })

    expect(result.entry.entryType).toBe('ADJUSTMENT')
    expect(result.entry.quantity).toBe(-2)
    expect(result.newBalance).toBe(3)
  })

  // 24. Multi-customer and multi-package isolation
  it('24. filterEntriesForAccount isolates balance by customer and package product', () => {
    const entries = [
      makeEntry({ id: 'e1', customerId: cust1, packageProductId: pkg1, quantity: 10 }),
      makeEntry({ id: 'e2', customerId: cust2, packageProductId: pkg1, quantity: 20 }),
      makeEntry({ id: 'e3', customerId: cust1, packageProductId: pkg2, quantity: 5 }),
    ]

    const cust1Pkg1 = filterEntriesForAccount(entries, cust1, pkg1)
    const cust2Pkg1 = filterEntriesForAccount(entries, cust2, pkg1)
    const cust1Pkg2 = filterEntriesForAccount(entries, cust1, pkg2)

    expect(derivePackageBalance(cust1Pkg1)).toBe(10)
    expect(derivePackageBalance(cust2Pkg1)).toBe(20)
    expect(derivePackageBalance(cust1Pkg2)).toBe(5)
  })

  // 25. planPackageGrant creates valid GRANT entry
  it('25. planPackageGrant creates valid GRANT entry from invoice line', () => {
    const grant = planPackageGrant({
      workspaceId: ws1,
      customerId: cust1,
      packageProductId: pkg1,
      quantity: 12,
      unit: 'session',
      sourceDocumentType: 'invoice',
      sourceDocumentId: 'inv-999',
      sourceLineId: 'line-888',
      notes: '12-Session Bundle Promo',
    })

    expect(grant.entryType).toBe('GRANT')
    expect(grant.quantity).toBe(12)
    expect(grant.customerId).toBe(cust1)
    expect(grant.sourceDocumentId).toBe('inv-999')
  })
})
