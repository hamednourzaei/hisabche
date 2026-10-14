// ============================================
// packages/ui/src/lib/accounting/account-name.ts
//
// The standard accounts the server creates carry a Persian name
// (`STANDARD_ACCOUNT_FOR_ROLE` in accounting.service.ts). A name is data the
// business may change, so it is never rewritten — but while it is still
// EXACTLY the default, it is shown in the reader's language (live audit #80:
// «موجودی کالا», «صندوق»… on the English site). A renamed account shows its
// own name, untouched.
// ============================================

const STANDARD_NAMES: Record<string, string> = {
  صندوق: 'cash',
  بانک: 'bank',
  'موجودی کالا': 'inventory',
  'حساب‌های دریافتنی': 'receivable',
  'حساب‌های پرداختنی': 'payable',
  مالیات: 'tax',
  'سود انباشته': 'retained_earnings',
  'سود سال جاری': 'current_year_earnings',
  فروش: 'sales',
  'بهای تمام‌شده‌ی کالای فروش‌رفته': 'cogs',
  خرید: 'purchase',
  'هزینه‌ی حقوق': 'salary_expense',
  'سود و زیان تسعیر ارز': 'fx_gain_loss',
  سرمایه: 'owner_capital',
  'کارمزد بانک و صرافی': 'bank_fees',
}

/** The default name in the reader's language; any other name as it is. */
export function accountName(name: string, t: (key: string, fallback?: string) => string): string {
  const role = STANDARD_NAMES[name.trim()]
  return role ? t(`accounting.standardAccount.${role}`, name) : name
}

export const STANDARD_ACCOUNT_ROLES = Object.values(STANDARD_NAMES)
