// ============================================
// backend/src/services/migration/migration.presets.ts
//
// OPTION 44: MIGRATION KITS FOR IRANIAN & REGIONAL ERPs
//
// Presets & alias tables for:
// - Holoo (هلو)
// - Sepidar (سپیدار)
// - Tally (تالی)
// - QuickBooks (کوئیک‌بوکس)
//
// Maps foreign header variations into canonical Hisabche field keys.
// Real export samples pending owner confirmation (BLOCKED_EXTERNAL_CREDENTIAL).
// ============================================

export interface SystemPreset {
  readonly systemName: 'holoo' | 'sepidar' | 'tally' | 'quickbooks'
  readonly label: string
  readonly fieldAliases: Record<string, readonly string[]>
}

export const MIGRATION_PRESETS: Record<string, SystemPreset> = {
  holoo: {
    systemName: 'holoo',
    label: 'هلو (Holoo)',
    fieldAliases: {
      sku: ['کد کالا', 'کدکالا', 'کد جنس', 'کد'],
      name: ['نام کالا', 'عنوان کالا', 'نام جنس', 'شرح کالا'],
      buy_price: ['قیمت خرید', 'فی خرید', 'نرخ خرید'],
      sale_price: ['قیمت فروش', 'فی فروش', 'نرخ فروش', 'قیمت مصرف کننده'],
      stock: ['موجودی', 'تعداد', 'مقدار موجودی', 'مانده موجودی'],
      unit: ['واحد', 'واحد اندازه گیری', 'واحد شمارش'],
      customer_name: ['نام طرف حساب', 'نام مشتری', 'طرف حساب', 'نام حساب'],
      phone: ['تلفن', 'شماره تماس', 'موبایل', 'تلفن همراه'],
      balance: ['مانده', 'مانده حساب', 'بدهکار/بستانکار'],
    },
  },
  sepidar: {
    systemName: 'sepidar',
    label: 'سپیدار (Sepidar)',
    fieldAliases: {
      sku: ['کد محصول', 'کد کالا/خدمت', 'کد عطف'],
      name: ['عنوان محصول', 'نام محصول', 'شرح محصول'],
      buy_price: ['بهای تمام شده', 'نرخ خرید', 'فی ورودی'],
      sale_price: ['فی فروش', 'مبلغ فروش', 'نرخ پایه فروش'],
      stock: ['موجودی انبار', 'تعداد انبار', 'مانده انبار'],
      unit: ['واحد سنجش', 'واحد اصلی'],
      customer_name: ['عنوان طرف حساب', 'مشتری/فروشنده', 'شخص'],
      phone: ['تلفن ثابت', 'همراه', 'شماره همراه'],
      balance: ['مانده تراز', 'وضعیت حساب'],
    },
  },
  tally: {
    systemName: 'tally',
    label: 'Tally Prime / ERP 9',
    fieldAliases: {
      sku: ['part no', 'item code', 'stock item code'],
      name: ['item name', 'stock item', 'description'],
      buy_price: ['standard cost', 'rate (inwards)', 'purchase rate'],
      sale_price: ['standard rate', 'selling rate', 'rate (outwards)'],
      stock: ['closing balance qty', 'opening balance qty', 'quantity'],
      unit: ['units', 'uom', 'base units'],
      customer_name: ['ledger name', 'party name', 'sundry debtors'],
      phone: ['phone no', 'mobile', 'contact'],
      balance: ['closing balance', 'opening balance', 'current balance'],
    },
  },
  quickbooks: {
    systemName: 'quickbooks',
    label: 'QuickBooks Desktop / Online',
    fieldAliases: {
      sku: ['item #', 'sku', 'product code'],
      name: ['item', 'item name', 'product/service'],
      buy_price: ['cost', 'purchase cost'],
      sale_price: ['price', 'sales price', 'rate'],
      stock: ['qty on hand', 'quantity', 'on hand'],
      unit: ['u/m', 'unit of measure'],
      customer_name: ['customer', 'customer name', 'client'],
      phone: ['phone', 'main phone', 'mobile'],
      balance: ['open balance', 'amount due', 'balance'],
    },
  },
}

/**
 * Match a raw header string against a preset's alias dictionary.
 */
export function matchHeaderToPreset(header: string, preset: SystemPreset): string | null {
  const clean = header.trim().toLowerCase()
  for (const [targetKey, aliases] of Object.entries(preset.fieldAliases)) {
    if (aliases.some((a) => a.toLowerCase() === clean)) {
      return targetKey
    }
  }
  return null
}
