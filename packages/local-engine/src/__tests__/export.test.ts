// ============================================
// packages/local-engine/src/__tests__/export.test.ts
//
// M1 Tests: Package round-trip, checksum tampering detection,
// and preview calculation against in-memory SQLite engine.
// ============================================

import { describe, expect, it } from 'vitest'
import { createExportPackage, generatePreview, verifyExportPackage } from '../export'
import { createTestDb, TEST_WAREHOUSE_ID, TEST_WORKSPACE_ID } from './test-db'

describe('Offline -> Cloud Migration Export (Step M1)', () => {
  it('creates a complete checksummed export package from local engine DB', () => {
    const db = createTestDb()

    // Seed some products, customers, invoices
    db.run(
      `INSERT INTO product (id, workspace_id, name, buy_price, sell_price, quantity, is_active, created_at, updated_at)
       VALUES ('p1', '${TEST_WORKSPACE_ID}', 'زعفران اعلا', 1500, 2000, 10, 1, '2026-09-01T10:00:00Z', '2026-09-01T10:00:00Z')`,
    )
    db.run(
      `INSERT INTO product (id, workspace_id, name, buy_price, sell_price, quantity, is_active, created_at, updated_at)
       VALUES ('p2', '${TEST_WORKSPACE_ID}', 'کشمش سایگی', 0, 800, 5, 1, '2026-09-01T10:00:00Z', '2026-09-01T10:00:00Z')`,
    )
    db.run(
      `INSERT INTO product_stock (id, workspace_id, product_id, warehouse_id, qty, created_at, updated_at)
       VALUES ('ps1', '${TEST_WORKSPACE_ID}', 'p1', '${TEST_WAREHOUSE_ID}', 10, '2026-09-01T10:00:00Z', '2026-09-01T10:00:00Z')`,
    )
    db.run(
      `INSERT INTO product_stock (id, workspace_id, product_id, warehouse_id, qty, created_at, updated_at)
       VALUES ('ps2', '${TEST_WORKSPACE_ID}', 'p2', '${TEST_WAREHOUSE_ID}', 5, '2026-09-01T10:00:00Z', '2026-09-01T10:00:00Z')`,
    )
    db.run(
      `INSERT INTO customer (id, workspace_id, full_name, phone, opening_balance, is_active, created_at, updated_at)
       VALUES ('c1', '${TEST_WORKSPACE_ID}', 'احمد هروی', '0799000111', 0, 1, '2026-09-01T10:00:00Z', '2026-09-01T10:00:00Z')`,
    )
    db.run(
      `INSERT INTO invoice (id, workspace_id, invoice_number, external_number, type, customer_id, date, subtotal, total, paid_amount, currency, status, created_at, updated_at)
       VALUES ('inv1', '${TEST_WORKSPACE_ID}', 'INV-001', 'LOCAL-101', 'sale', 'c1', '2026-09-02T10:00:00Z', 4000, 4000, 2500, 'AFN', 'pending', '2026-09-02T10:00:00Z', '2026-09-02T10:00:00Z')`,
    )
    db.run(
      `INSERT INTO invoice_item (id, workspace_id, invoice_id, product_id, product_name, quantity, unit_price, total_price, created_at, updated_at)
       VALUES ('item1', '${TEST_WORKSPACE_ID}', 'inv1', 'p1', 'زعفران اعلا', 2, 2000, 4000, '2026-09-02T10:00:00Z', '2026-09-02T10:00:00Z')`,
    )
    db.run(
      `INSERT INTO cost_consumption (id, workspace_id, layer_id, product_id, warehouse_id, consumer_type, consumer_id, quantity, unit_cost, currency, entry_date, created_at, updated_at)
       VALUES ('cc1', '${TEST_WORKSPACE_ID}', 'lay1', 'p1', '${TEST_WAREHOUSE_ID}', 'invoice', 'inv1', 2, 1500, 'AFN', '2026-09-02', '2026-09-02T10:00:00Z', '2026-09-02T10:00:00Z')`,
    )

    const pkg = createExportPackage(db, {
      deviceId: 'device-test-uuid',
      licenceId: 'lic-test-uuid',
      workspaceId: TEST_WORKSPACE_ID,
    })

    expect(pkg.metadata.formatVersion).toBe(1)
    expect(pkg.metadata.deviceId).toBe('device-test-uuid')
    expect(pkg.metadata.workspaceId).toBe(TEST_WORKSPACE_ID)
    expect(pkg.packageChecksum).toMatch(/^[a-f0-9]{64}$/)

    // Section checks
    expect(pkg.sections.product?.rowCount).toBe(2)
    expect(pkg.sections.customer?.rowCount).toBe(1)
    expect(pkg.sections.invoice?.rowCount).toBe(1)
    expect(pkg.sections.cost_consumption?.rowCount).toBe(1)

    // Verification must pass
    const verification = verifyExportPackage(pkg)
    expect(verification.valid).toBe(true)
  })

  it('detects a flipped byte or tampered record', () => {
    const db = createTestDb()
    db.run(
      `INSERT INTO customer (id, workspace_id, full_name, is_active, created_at, updated_at)
       VALUES ('c1', '${TEST_WORKSPACE_ID}', 'احمد هروی', 1, '2026-09-01T10:00:00Z', '2026-09-01T10:00:00Z')`,
    )

    const pkg = createExportPackage(db, {
      deviceId: 'dev1',
      licenceId: 'lic1',
      workspaceId: TEST_WORKSPACE_ID,
    })

    expect(verifyExportPackage(pkg).valid).toBe(true)

    // Tamper with customer row
    const tamperedPkg = JSON.parse(JSON.stringify(pkg))
    tamperedPkg.sections.customer.rows[0].full_name = 'محمود هروی' // flipped byte

    const result = verifyExportPackage(tamperedPkg)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('SECTION_CHECKSUM_MISMATCH:customer')
  })

  it('generates accurate preview metrics respecting unknown cost rule', () => {
    const db = createTestDb()

    // 1. Known cost sale
    db.run(
      `INSERT INTO product (id, workspace_id, name, buy_price, sell_price, quantity, is_active, created_at, updated_at)
       VALUES ('p1', '${TEST_WORKSPACE_ID}', 'زعفران', 1000, 1500, 10, 1, '2026-09-01T10:00:00Z', '2026-09-01T10:00:00Z')`,
    )
    db.run(
      `INSERT INTO product_stock (id, workspace_id, product_id, warehouse_id, qty, created_at, updated_at)
       VALUES ('ps1', '${TEST_WORKSPACE_ID}', 'p1', '${TEST_WAREHOUSE_ID}', 8, '2026-09-01T10:00:00Z', '2026-09-01T10:00:00Z')`,
    )
    db.run(
      `INSERT INTO invoice (id, workspace_id, invoice_number, type, date, subtotal, total, paid_amount, currency, status, created_at, updated_at)
       VALUES ('inv1', '${TEST_WORKSPACE_ID}', 'INV-1', 'sale', '2026-09-02T10:00:00Z', 3000, 3000, 2000, 'AFN', 'pending', '2026-09-02T10:00:00Z', '2026-09-02T10:00:00Z')`,
    )
    db.run(
      `INSERT INTO invoice_item (id, workspace_id, invoice_id, product_id, product_name, quantity, unit_price, total_price, created_at, updated_at)
       VALUES ('it1', '${TEST_WORKSPACE_ID}', 'inv1', 'p1', 'زعفران', 2, 1500, 3000, '2026-09-02T10:00:00Z', '2026-09-02T10:00:00Z')`,
    )
    db.run(
      `INSERT INTO cost_consumption (id, workspace_id, layer_id, product_id, warehouse_id, consumer_type, consumer_id, quantity, unit_cost, currency, entry_date, is_shortfall, created_at, updated_at)
       VALUES ('cc1', '${TEST_WORKSPACE_ID}', 'l1', 'p1', '${TEST_WAREHOUSE_ID}', 'invoice', 'inv1', 2, 1000, 'AFN', '2026-09-02', 0, '2026-09-02T10:00:00Z', '2026-09-02T10:00:00Z')`,
    )

    // 2. Unknown cost sale (product with buy_price 0 and shortfall)
    db.run(
      `INSERT INTO product (id, workspace_id, name, buy_price, sell_price, quantity, is_active, created_at, updated_at)
       VALUES ('p2', '${TEST_WORKSPACE_ID}', 'کشمش', 0, 500, 5, 1, '2026-09-01T10:00:00Z', '2026-09-01T10:00:00Z')`,
    )
    db.run(
      `INSERT INTO invoice (id, workspace_id, invoice_number, type, date, subtotal, total, paid_amount, currency, status, created_at, updated_at)
       VALUES ('inv2', '${TEST_WORKSPACE_ID}', 'INV-2', 'sale', '2026-09-02T10:00:00Z', 1000, 1000, 1000, 'AFN', 'completed', '2026-09-02T10:00:00Z', '2026-09-02T10:00:00Z')`,
    )
    db.run(
      `INSERT INTO invoice_item (id, workspace_id, invoice_id, product_id, product_name, quantity, unit_price, total_price, created_at, updated_at)
       VALUES ('it2', '${TEST_WORKSPACE_ID}', 'inv2', 'p2', 'کشمش', 2, 500, 1000, '2026-09-02T10:00:00Z', '2026-09-02T10:00:00Z')`,
    )
    db.run(
      `INSERT INTO cost_consumption (id, workspace_id, layer_id, product_id, warehouse_id, consumer_type, consumer_id, quantity, unit_cost, currency, entry_date, is_shortfall, created_at, updated_at)
       VALUES ('cc2', '${TEST_WORKSPACE_ID}', null, 'p2', '${TEST_WAREHOUSE_ID}', 'invoice', 'inv2', 2, 0, 'AFN', '2026-09-02', 1, '2026-09-02T10:00:00Z', '2026-09-02T10:00:00Z')`,
    )

    // 3. Balanced journal entries
    db.run(
      `INSERT INTO journal_entry (id, workspace_id, entry_number, date, status, created_at, updated_at)
       VALUES ('je1', '${TEST_WORKSPACE_ID}', 'JE-1', '2026-09-02', 'posted', '2026-09-02T10:00:00Z', '2026-09-02T10:00:00Z')`,
    )
    db.run(
      `INSERT INTO journal_line (id, workspace_id, journal_id, account_id, debit, credit, created_at, updated_at)
       VALUES ('jl1', '${TEST_WORKSPACE_ID}', 'je1', 'acc-cash', 4000, 0, '2026-09-02T10:00:00Z', '2026-09-02T10:00:00Z')`,
    )
    db.run(
      `INSERT INTO journal_line (id, workspace_id, journal_id, account_id, debit, credit, created_at, updated_at)
       VALUES ('jl2', '${TEST_WORKSPACE_ID}', 'je1', 'acc-rev', 0, 4000, '2026-09-02T10:00:00Z', '2026-09-02T10:00:00Z')`,
    )

    const preview = generatePreview(db, TEST_WORKSPACE_ID)

    expect(preview.counts.invoices).toBe(2)
    expect(preview.counts.products).toBe(2)
    expect(preview.totalsByCurrency.AFN?.total).toBe(4000)
    expect(preview.totalsByCurrency.AFN?.paidAmount).toBe(3000)
    expect(preview.receivablesPerCurrency.AFN).toBe(1000) // 4000 - 3000

    expect(preview.trialBalance.balanced).toBe(true)
    expect(preview.trialBalance.totalDebit).toBe(4000)
    expect(preview.trialBalance.totalCredit).toBe(4000)

    // Profit report:
    // inv1: revenue 3000, cost 2000, profit 1000, costStatus 'known'
    const p1 = preview.profitByInvoice.find((i) => i.invoiceId === 'inv1')
    expect(p1?.costStatus).toBe('known')
    expect(p1?.cost).toBe(2000)
    expect(p1?.profit).toBe(1000)

    // inv2: unknown cost -> cost null, profit null, costStatus 'unknown'
    const p2 = preview.profitByInvoice.find((i) => i.invoiceId === 'inv2')
    expect(p2?.costStatus).toBe('unknown')
    expect(p2?.cost).toBeNull()
    expect(p2?.profit).toBeNull()
  })
})
