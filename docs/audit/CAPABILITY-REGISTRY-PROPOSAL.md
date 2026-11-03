# CAPABILITY REGISTRY PROPOSAL (پیشنهاد؛ چیزی پیاده نشد)

## 1. موجود چیست؟

| رجیستری               | مسیر                                                                                                | چه می‌داند                                                         | چه نمی‌داند                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Feature (پلن/اجرا)    | `packages/validation/src/schemas/feature-registry.ts` + `offline-endpoint-matrix.ts` (۵۰۷ endpoint) | اجرا محلی/سرور، پلن‌ها، `alwaysAllowed`، دسترسی آفلاین هر endpoint | وابستگی و اثر مالی؛ دو معنی «خواندن/نوشتن» برای ۱۶ کلید                             |
| Business capability   | `packages/validation/src/schemas/business-capabilities.ts:14,48` (۱۳ کلید)                          | وضعیت `available`/`planned` و فهرست مسیر شاهد                      | نسخه، وابستگی، تعارض، policy، فرمان/کوئری، اثر مالی/موجودی، sync، واژگان، بردار تست |
| Permission capability | `backend/src/services/authorization/authorization.domain.ts`                                        | نقش حداقل هر capability                                            | اتصال به قابلیت کسب‌وکار                                                            |
| Profile               | `packages/validation/src/schemas/industry-profiles.ts:437,490`                                      | اجتماع قابلیت‌های available، واحد/ستون/داشبورد/واژه                | policy و workflow و منو                                                             |

حکم: قرارداد حداقلی زیر را **هیچ‌کدام** کامل برآورده نمی‌کند. «capability» سه معنی دارد (مجوز، پلن، کسب‌وکار) و باید با نام‌های جدا بماند (مستندسازی در `docs/audit/UNIVERSAL-CORE-AUDIT-FINAL.md` و M1.5).

## 2. قرارداد پیشنهادیِ هر قابلیت (حداقل)

```ts
interface CapabilityContract {
  id: string // 'item.variant'
  version: number // خوانده‌شده توسط سرور و دستگاه
  dependencies: readonly string[] // 'item.measure'
  conflicts: readonly string[]
  dataModel: readonly string[] // جدول‌ها + نسخه‌ی schema محلی
  commands: readonly string[] // تنها مسیرهای نوشتن (route + local route)
  queries: readonly string[]
  policies: readonly PolicyKey[] // هر کدام مقدار پیش‌فرض صریح دارد (G4)
  accountingEffects: readonly AccountingEffect[] // نقش حساب، سند، بازگشت‌پذیری، قفل دوره
  inventoryEffects: readonly InventoryEffect[] // واحد، لایه‌ی بها، انبار، جابه‌جایی
  syncRequirements: SyncRule // کلید idempotency، رفتار رد، تعارض
  offlineSupport: 'available' | 'online_required' | 'not_supported' // = ماتریس آفلاین
  permissions: readonly Capability[] // نام مجوز مستقل، نه invoice.create
  reports: readonly string[]
  terminologyKeys: readonly string[] // کلیدهای i18n هر سه زبان
  testVectors: readonly string[] // golden مشترک TS/SQL/SQLite
}
```

## 3. قواعد

۱. قابلیتی `available` است فقط وقتی هر `commands` از route/دستگاه به **مصرف‌کننده‌ی production** برسد (گاردی مثل `unwired-capability.test.ts` که امروز برای موتورهای Business OS هست، به رجیستری هم تعمیم یابد).
۲. وابستگی/تعارض حل می‌شود در یک تابع خالص مشترک (سرور و دستگاه)، نه در UI.
۳. `policies` در یک جا حل شوند و سرور اعمال کند؛ UI فقط نمایش دهد.
۴. شواهد = تست رفتاری، نه فهرست مسیر فایل.
۵. رجیستری هیچ منطق مالی ندارد؛ فقط اثرها را اعلام می‌کند و به موتور مالی موجود نگاشت می‌شود.

## 4. مهاجرت از موجود

۱۳ کلید موجود به قرارداد بالا نگاشت می‌شوند؛ پنج کلید ادعاشده‌ی `available` (variants، serialized_items، auto_fitments، gold_purity، making_charges) تا اتصال کامل `partial` برچسب بخورند (شکاف AG-1).
