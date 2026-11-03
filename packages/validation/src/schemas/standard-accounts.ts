// ============================================
// packages/validation/src/schemas/standard-accounts.ts
//
// The account a role gets when the business has none for it — one table for the
// server (`ensureAccountsForRoles`) and the offline engine, so a payroll posted
// on the device lands on the same «6000 هزینه‌ی حقوق» the server would create.
// ============================================

import type { AccountRole } from './accounting.schema'

export interface StandardAccount {
  code: string
  name: string
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
}

export const STANDARD_ACCOUNT_FOR_ROLE: Partial<Record<AccountRole, StandardAccount>> = {
  cash: { code: '1010', name: 'صندوق', type: 'asset' },
  bank: { code: '1020', name: 'بانک', type: 'asset' },
  inventory: { code: '1000', name: 'موجودی کالا', type: 'asset' },
  receivable: { code: '1200', name: 'حساب‌های دریافتنی', type: 'asset' },
  payable: { code: '2000', name: 'حساب‌های پرداختنی', type: 'liability' },
  tax: { code: '2100', name: 'مالیات', type: 'liability' },
  retained_earnings: { code: '3000', name: 'سود انباشته', type: 'equity' },
  current_year_earnings: { code: '3100', name: 'سود سال جاری', type: 'equity' },
  sales: { code: '4000', name: 'فروش', type: 'revenue' },
  cogs: { code: '5000', name: 'بهای تمام‌شده‌ی کالای فروش‌رفته', type: 'expense' },
  purchase: { code: '5100', name: 'خرید', type: 'expense' },
  salary_expense: { code: '6000', name: 'هزینه‌ی حقوق', type: 'expense' },
  // One account for both directions: a gain sits on its credit side, a loss
  // on its debit side, and its balance is the net of the two.
  fx_gain_loss: { code: '4900', name: 'سود و زیان تسعیر ارز', type: 'revenue' },
  owner_capital: { code: '3200', name: 'سرمایه', type: 'equity' },
  bank_fees: { code: '6100', name: 'کارمزد بانک و صرافی', type: 'expense' },
  deferred_revenue: { code: '2200', name: 'درآمد انتقالی (پیش‌دریافت)', type: 'liability' },
  inventory_loss: { code: '5200', name: 'ضرر و زیان ضایعات کالا', type: 'expense' },
  // P1 (V53): an order deposit is a liability to the customer until the final
  // invoice applies it. 2150 sits below «مالیات» (2100) and above «درآمد
  // انتقالی» (2200): both are money received before it is earned.
  customer_advances: { code: '2150', name: 'پیش‌دریافت مشتریان', type: 'liability' },
  // V53 (owner decision CC): two accounts, never one netted account.
  inventory_shrinkage: { code: '5210', name: 'کسری موجودی (شمارش)', type: 'expense' },
  inventory_gain: { code: '4910', name: 'اضافه موجودی (شمارش)', type: 'revenue' },
}
