// ============================================
// T9 — `paid_amount` has exactly one writer, and it is the allocations.
//
// ---------------------------------------------------------------------------
// THE BUG THIS PINS, FROM A REAL SALE
//
//   پرداخت‌های این فاکتور
//     هنوز پرداختی برای این فاکتور ثبت نشده است.
//
//   ⚠️ مبلغ پرداخت‌شده‌ی ثبت‌شده روی فاکتور با مجموع پرداخت‌ها یکی نیست:
//      ۱۸٬۰۰۰٬۰۰۰
//
// `invoices.paid_amount` held eighteen million and there was not one
// `payment_allocations` row behind it. The invoice claimed to be paid; the
// ledger had never seen a rial of it.
//
// Phase F made `paid_amount` a projection of `SUM(payment_allocations)` and
// closed the PATCH that wrote it. The CREATE path kept writing it:
//
//     paid_amount: data.paidAmount || 0,
//
// So creation was still a second writer on a derived number. The H2 drift
// warning was working correctly — it was reporting a real defect.
//
// ---------------------------------------------------------------------------
// This is a STATIC guard on purpose. The failure is a line of code that must
// not exist, and a static check catches it in every code path at once —
// including the ones no integration test happens to exercise.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SERVICES = join(__dirname, '..', 'services')

const read = (rel: string): string => readFileSync(join(SERVICES, rel), 'utf8')

/**
 * Comments stripped before matching.
 *
 * This file documents the defect it forbids, and those comments quote the very
 * line being banned. Matching them instead of the code is a mistake this suite
 * has made repeatedly — see lesson 82.
 */
function code(rel: string): string {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
}

const invoiceService = code('invoice.service.ts')

describe('nothing writes paid_amount to a value the allocations did not produce', () => {
  it('the invoice INSERT writes a literal zero', () => {
    // The one permitted mention in a write position. Anything else is the
    // second writer coming back.
    expect(invoiceService).toContain('paid_amount: 0')
  })

  it('never writes paid_amount from the request body', () => {
    // The exact shape of the original defect, plus the obvious variations of
    // it. `paidAmount` remains a legal INPUT — it just cannot land here.
    const forbidden = [
      /paid_amount:\s*data\.paidAmount/,
      /paid_amount:\s*data\.paid_amount/,
      /paid_amount:\s*input\.paidAmount/,
      /paid_amount:\s*[a-zA-Z_$][\w$]*\.paidAmount/,
    ]

    for (const pattern of forbidden) {
      expect(pattern.test(invoiceService), `forbidden write: ${pattern}`).toBe(false)
    }
  })

  it('no service outside the payment core assigns paid_amount at all', () => {
    // `paid_amount` may be READ anywhere — outstanding balances, dashboards,
    // exports. It may be ASSIGNED only where allocations are the source.
    //
    // The assigned VALUE is captured and inspected rather than excluded with a
    // negative lookahead. `\s*` backtracks to empty, the lookahead then sees a
    // space instead of the digit, and `paid_amount: 0` — the one line this was
    // written to ALLOW — matched as a violation. Capturing cannot backtrack
    // around the check.
    const assignment = /paid_amount\s*[:=]\s*([^,\n}]+)/g

    for (const file of ['invoice.service.ts', 'pos.service.ts', 'quick-invoice.service.ts']) {
      let source: string
      try {
        source = code(file)
      } catch {
        continue // not every service exists in every branch
      }
      for (const [, value] of source.matchAll(assignment)) {
        expect((value ?? '').trim(), `${file} assigns paid_amount a derived-unsafe value`).toBe('0')
      }
    }
  })
})

describe('the money is recorded as a payment instead', () => {
  it('create() calls the payment service', () => {
    expect(invoiceService).toContain('recordCreationPayments')
    expect(invoiceService).toContain('this.payments.recordPayment')
  })

  it('the payment is allocated to THIS invoice, not auto-allocated', () => {
    // Without an explicit allocation the payment settles the oldest open
    // invoice first — so paying for a new sale would quietly clear an older
    // debt and leave the new invoice unpaid.
    expect(invoiceService).toMatch(/allocations:\s*\[\{\s*invoiceId,/)
  })

  it('a purchase pays OUT and a sale takes IN', () => {
    // Reversed, this puts the payment on the wrong side of the ledger and
    // inverts the party's balance.
    expect(invoiceService).toMatch(/direction:\s*isPurchase\s*\?\s*'out'\s*:\s*'in'/)
  })

  it('each tranche becomes its own payment record', () => {
    // One row carrying a blended method would make the till count and the
    // bank reconciliation both wrong, unrepairably.
    expect(invoiceService).toMatch(/for\s*\(const tranche of tranches\)/)
  })

  it('does NOT delete the invoice when the payment fails', () => {
    // supabase-js has no transactions and a compensating DELETE is forbidden
    // (rule 4). It is also wrong: the goods moved and the ledger was written.
    // What failed is the receipt, and the invoice's true state is «unpaid».
    // Bounded at the NEXT method. The section marker that used to bound this
    // is a COMMENT, and `code()` strips comments — so the slice ran to the end
    // of the file and found a `.delete()` belonging to an unrelated method.
    const body = invoiceService.slice(
      invoiceService.indexOf('private async recordCreationPayments'),
    )
    const next = body.slice(1).search(/\n {2}(?:private |public )?async \w+\(/)
    const method = next === -1 ? body : body.slice(0, next)
    expect(method).not.toContain('.delete()')
  })
})

describe('an explicit allocation cannot cross parties', () => {
  const paymentsService = code('payments/payments.service.ts')

  it('checks the invoice belongs to the party being credited', () => {
    // `openInvoicesByIds` is workspace-scoped, which stops CROSS-TENANT
    // settlement. It does not stop settling one customer's debt with another
    // customer's money inside the same workspace — both rows are legitimately
    // visible, so nothing else in the chain would catch it.
    expect(paymentsService).toContain('PAYMENT_ALLOCATION_PARTY_MISMATCH')
  })

  it('the by-id lookup is filtered by workspace', () => {
    const repo = code('payments/payments.repository.ts')
    const start = repo.indexOf('async openInvoicesByIds')
    expect(start, 'openInvoicesByIds not found').toBeGreaterThan(-1)

    const body = repo.slice(start, start + 1400)
    expect(body).toContain("from('invoice_outstanding')")
    expect(body).toContain("eq('workspace_id', workspaceId)")
  })

  it('only settles invoices with something still outstanding', () => {
    const repo = code('payments/payments.repository.ts')
    const start = repo.indexOf('async openInvoicesByIds')
    const body = repo.slice(start, start + 1400)
    // Without this a fully-paid invoice could be paid a second time.
    expect(body).toContain("gt('outstanding', 0)")
  })
})
