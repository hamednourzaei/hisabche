// ============================================
// Target A1: Purchase Return vs Sale Return Accounting Invariants
//
// Asserts that invoice_return_create SQL:
// 1. Branches on returnType.
// 2. For 'purchase_return': books Dr Accounts Payable, Cr Inventory.
// 3. For 'sale_return': books Dr Sales, Cr Accounts Receivable (and Dr Inventory, Cr COGS if cost restored).
// 4. Sets accurate Persian journal descriptions.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Target A1: Purchase return accounting correctness in migration SQL', () => {
  const sqlFile = join(
    __dirname,
    '..',
    '..',
    '..',
    'docs',
    'invoice-return-02-purchase-return-accounting-migration.sql',
  )
  const sql = readFileSync(sqlFile, 'utf8')

  it('branches on v_return_type == purchase_return vs sale_return', () => {
    expect(sql).toContain("IF v_return_type = 'purchase_return' THEN")
  })

  it('resolves payable and inventory accounts for purchase returns and separates tax (Scenario 01A)', () => {
    expect(sql).toContain("role = 'payable'")
    expect(sql).toContain("role = 'inventory'")
    expect(sql).toContain("role = 'tax'")
    expect(sql).toContain('v_tot_tax_minor > 0 AND v_tax_acct IS NOT NULL')
    expect(sql).toContain(
      "jsonb_build_object('account_id', v_pay_acct, 'debit', v_total_books, 'credit', 0)",
    )
    expect(sql).toContain(
      "jsonb_build_object('account_id', v_tax_acct, 'debit', 0, 'credit', v_tax_books)",
    )
  })

  it('verifies stock availability and decrements physical warehouse stock and cost layers without GREATEST(0) masking (Scenario 01C)', () => {
    expect(sql).toContain('PURCHASE_RETURN_INSUFFICIENT_STOCK')
    expect(sql).toContain('PURCHASE_RETURN_COST_LAYER_DEPLETED')
    expect(sql).toContain('UPDATE public.product_stock')
    expect(sql).toContain('SET qty = qty - v_qty')
    expect(sql).toContain('UPDATE public.products')
    expect(sql).toContain('SET quantity = quantity - v_qty')
    expect(sql).toContain('UPDATE public.cost_layers')
    expect(sql).toContain('SET remaining_qty = remaining_qty - v_qty')
    expect(sql).not.toContain('SET qty = GREATEST(0')
    expect(sql).not.toContain('SET remaining_qty = GREATEST(0')
  })

  it('preserves sales and receivable for sale returns', () => {
    expect(sql).toContain("role = 'sales'")
    expect(sql).toContain("role = 'receivable'")
    expect(sql).toContain(
      "jsonb_build_object('account_id', v_sales_acct, 'debit', v_total_books, 'credit', 0)",
    )
    expect(sql).toContain(
      "jsonb_build_object('account_id', v_recv_acct, 'debit', 0, 'credit', v_total_books)",
    )
  })

  it('locks original invoice line FOR UPDATE to serialize concurrent returns and prevent overdraft', () => {
    expect(sql).toContain('FROM public.invoice_items')
    expect(sql).toContain('FOR UPDATE;')
  })

  it('uses specific Persian journal descriptions per return type', () => {
    expect(sql).toContain("v_journal_desc := 'برگشت فاکتور خرید ' ||")
    expect(sql).toContain("v_journal_desc := 'برگشت فاکتور فروش ' ||")
  })
})
