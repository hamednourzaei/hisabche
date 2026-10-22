// The import's own field list — what a file's headers are matched against.
//   npx tsx scripts/list-import-fields.ts
import { suggestMapping, type MigrationEntity } from '../src/services/migration/migration.entities'

// The headers the AI conversion prompt (docs/import/AI-CONVERSION-PROMPT.md)
// tells a model to write. Each must map to its field on its own — and all of
// a sheet's headers together must map one-to-one (no field claimed twice).
const PROMPT_HEADERS: Record<MigrationEntity, Record<string, string>> = {
  customer: {
    'نام مشتری': 'fullName',
    تلفن: 'phone',
    ایمیل: 'email',
    آدرس: 'address',
    'مانده بدهکار': 'openingBalance',
    'مانده بستانکار': 'creditBalance',
    کد: 'externalId',
    یادداشت: 'notes',
  },
  product: {
    'نام کالا': 'name',
    'کد کالا': 'sku',
    بارکد: 'barcode',
    دسته: 'category',
    واحد: 'unit',
    موجودی: 'quantity',
    'قیمت خرید': 'buyPrice',
    'قیمت فروش': 'sellPrice',
    'قیمت عمده': 'wholesalePrice',
    انبار: 'warehouse',
  },
  invoice: {
    'شماره فاکتور': 'invoiceNumber',
    تاریخ: 'date',
    'نوع فاکتور': 'type',
    'نام مشتری': 'customerName',
    'تلفن مشتری': 'customerPhone',
    'شرح کالا': 'itemName',
    'کد کالا': 'sku',
    تعداد: 'quantity',
    فی: 'unitPrice',
    مبلغ: 'lineTotal',
    تخفیف: 'discount',
    'جمع کل': 'total',
    'پرداخت شده': 'paidAmount',
    ارز: 'currency',
    یادداشت: 'notes',
  },
}

let bad = 0
for (const [entity, headers] of Object.entries(PROMPT_HEADERS) as [
  MigrationEntity,
  Record<string, string>,
][]) {
  const all = suggestMapping(entity, Object.keys(headers))
  for (const [header, field] of Object.entries(headers)) {
    const got = all.find((m) => m.sourceHeader === header)?.targetField ?? null
    const ok = got === field
    if (!ok) bad++
    console.log(`${entity}: «${header}» → ${got} ${ok ? 'OK' : `EXPECTED ${field}`}`)
  }
}
console.log(bad === 0 ? 'ALL HEADERS MAP' : `${bad} HEADERS WRONG`)
